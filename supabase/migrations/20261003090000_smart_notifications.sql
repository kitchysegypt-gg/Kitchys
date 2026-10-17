-- Smart notifications: the app saves each phone's push token and the customer's cart;
-- every hour the `smart-notifications` edge function asks `notification_candidates()`
-- who is due a reminder, has Claude write a personal message, and sends it through
-- Expo's push service.
--
--   "Your cart is calling": dishes left in the cart for 2+ hours without ordering.
--   "We miss you": no order for 7+ days (at most once a week).
--
-- At most one notification per customer per 20 hours, only between 12:00 and 22:00 Cairo time.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1. Phones that can receive notifications -------------------------------------------
create table if not exists public.push_devices (
  token text primary key check (token ~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,200}\]$'),
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text not null check (platform in ('android', 'ios')),
  language text not null default 'en' check (language in ('en', 'ar', 'fr')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists push_devices_user_idx on public.push_devices (user_id);

-- Only reachable through the functions below.
alter table public.push_devices enable row level security;

-- A phone belongs to whoever signed in on it last.
create or replace function public.register_push_device(
  p_token text,
  p_platform text,
  p_language text,
  p_enabled boolean default true
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  insert into public.push_devices (token, user_id, platform, language, enabled, updated_at)
  values (p_token, auth.uid(), p_platform, coalesce(p_language, 'en'), coalesce(p_enabled, true), now())
  on conflict (token) do update
    set user_id = excluded.user_id,
        platform = excluded.platform,
        language = excluded.language,
        enabled = excluded.enabled,
        updated_at = now();
end;
$$;

create or replace function public.unregister_push_device(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_devices where token = p_token and user_id = auth.uid();
$$;

revoke execute on function public.register_push_device(text, text, text, boolean) from public, anon;
revoke execute on function public.unregister_push_device(text) from public, anon;
grant execute on function public.register_push_device(text, text, text, boolean) to authenticated;
grant execute on function public.unregister_push_device(text) to authenticated;

-- 2. The customer's cart, so it survives restarts and "your cart is calling" can see it --
create table if not exists public.saved_carts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  item_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.saved_carts enable row level security;

create policy "Customers read their own cart"
  on public.saved_carts for select to authenticated
  using ((select auth.uid()) = user_id);

-- Items are [{ "dish_id": "...", "name": "...", "quantity": 2 }]. An empty list removes the cart.
create or replace function public.save_cart(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_items jsonb;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 50 then
    raise exception 'Invalid cart';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'dish_id', left(i->>'dish_id', 64),
           'name', left(i->>'name', 60),
           'quantity', least(greatest((i->>'quantity')::integer, 1), 99))), '[]'::jsonb),
         coalesce(sum(least(greatest((i->>'quantity')::integer, 1), 99)), 0)
    into v_items, v_count
  from jsonb_array_elements(p_items) as i
  where coalesce(i->>'dish_id', '') <> '' and coalesce((i->>'quantity')::integer, 0) > 0;

  if v_count = 0 then
    delete from public.saved_carts where user_id = auth.uid();
    return;
  end if;

  insert into public.saved_carts (user_id, items, item_count, updated_at)
  values (auth.uid(), v_items, v_count, now())
  on conflict (user_id) do update
    set items = excluded.items,
        item_count = excluded.item_count,
        -- The reminder clock restarts only when the cart actually changes.
        updated_at = case when public.saved_carts.items = excluded.items
                          then public.saved_carts.updated_at else now() end;
end;
$$;

revoke execute on function public.save_cart(jsonb) from public, anon;
grant execute on function public.save_cart(jsonb) to authenticated;

-- 3. What was sent, so nobody gets the same reminder twice ----------------------------
create table if not exists public.notification_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('cart', 'weekly')),
  title text not null,
  body text not null,
  written_by text not null check (written_by in ('claude', 'template')),
  devices integer not null default 0,
  sent_at timestamptz not null default now()
);

create index if not exists notification_log_user_idx on public.notification_log (user_id, sent_at desc);

-- Only the edge function (service role) reads and writes it.
alter table public.notification_log enable row level security;

-- 4. Who is due a reminder right now, with what Claude needs to write it ---------------
create or replace function public.notification_candidates(p_limit integer default 200)
returns table (user_id uuid, kind text, language text, tokens text[], context jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with devices as (
    select d.user_id,
           array_agg(d.token order by d.updated_at desc) as tokens,
           (array_agg(d.language order by d.updated_at desc))[1] as language
    from public.push_devices d
    where d.enabled
    group by d.user_id
  ),
  stats as (
    select dv.user_id,
           (select count(*) from public.orders o
             where o.user_id = dv.user_id and o.status <> 'cancelled') as orders_count,
           (select max(o.created_at) from public.orders o
             where o.user_id = dv.user_id and o.status <> 'cancelled') as last_order_at,
           (select max(l.sent_at) from public.notification_log l
             where l.user_id = dv.user_id) as last_sent_at,
           (select max(l.sent_at) from public.notification_log l
             where l.user_id = dv.user_id and l.kind = 'weekly') as last_weekly_at,
           (select max(l.sent_at) from public.notification_log l
             where l.user_id = dv.user_id and l.kind = 'cart') as last_cart_at
    from devices dv
  ),
  due as (
    select s.*, c.items as cart_items, c.updated_at as cart_updated_at, u.created_at as joined_at,
           split_part(coalesce(u.raw_user_meta_data->>'full_name', ''), ' ', 1) as first_name,
           case
             when c.item_count > 0
                  and c.updated_at < now() - interval '2 hours'
                  and c.updated_at > now() - interval '3 days'
                  and (s.last_cart_at is null or s.last_cart_at < c.updated_at)
                  and (s.last_order_at is null or s.last_order_at < c.updated_at)
               then 'cart'
             when coalesce(s.last_order_at, u.created_at) < now() - interval '7 days'
                  and (s.last_weekly_at is null or s.last_weekly_at < now() - interval '7 days')
               then 'weekly'
           end as kind
    from stats s
    join auth.users u on u.id = s.user_id
    left join public.saved_carts c on c.user_id = s.user_id
    where s.last_sent_at is null or s.last_sent_at < now() - interval '20 hours'
  )
  select d.user_id,
         d.kind,
         dv.language,
         dv.tokens,
         jsonb_build_object(
           'first_name', nullif(d.first_name, ''),
           'cart', case when d.kind = 'cart' then d.cart_items end,
           'orders_count', d.orders_count,
           'days_since_last_order', floor(extract(epoch from now() - d.last_order_at) / 86400),
           'free_deliveries_left', greatest(0, 3 - d.orders_count),
           'credit_egp', greatest(0, public.wallet_balance(d.user_id)),
           'favourite_dishes', (
             select coalesce(jsonb_agg(f.name), '[]'::jsonb) from (
               select i->>'name' as name
               from public.orders o, jsonb_array_elements(o.items) as i
               where o.user_id = d.user_id and o.status <> 'cancelled'
               group by i->>'name'
               order by sum(coalesce((i->>'quantity')::integer, 1)) desc
               limit 3
             ) f)
         )
  from due d
  join devices dv on dv.user_id = d.user_id
  where d.kind is not null
    and extract(hour from now() at time zone 'Africa/Cairo') between 12 and 21
  limit p_limit;
$$;

revoke execute on function public.notification_candidates(integer) from public, anon, authenticated;
grant execute on function public.notification_candidates(integer) to service_role;

-- 5. Every hour, wake the edge function. The shared secret lives in Vault. -------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'notifications_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'notifications_cron_secret',
      'Lets the hourly cron job call the smart-notifications edge function');
  end if;
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'smart-notifications';

select cron.schedule(
  'smart-notifications',
  '7 * * * *',
  $cron$
  select net.http_post(
    url := 'https://qbyzamcxlxarslfeglfl.supabase.co/functions/v1/smart-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notifications_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);
