-- Kitchy's Premium for customers: EGP 149 a month.
--   * Free delivery on every order (the rider still gets EGP 30; Kitchy's pays it)
--   * Tonight's dinner (the daily pick on the home screen, and its 5 PM push) is members only
-- No card payments yet, so the month's fee is added to the member's next order and paid in
-- cash. Each new month is charged on its first order; a month without orders isn't charged
-- and the membership simply ends.

create or replace function public.customer_premium_price() returns numeric
language sql immutable set search_path = '' as $$ select 149::numeric $$;

create table if not exists public.customer_premium (
  user_id uuid primary key references auth.users (id) on delete cascade,
  started_at timestamptz not null default now(),
  period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  -- The month's fee, waiting for the next order.
  pending_fee numeric(10, 2) not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.customer_premium enable row level security;
create policy "Customers read their own Premium"
  on public.customer_premium for select to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.is_customer_premium(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.customer_premium p where p.user_id = p_user and p.period_end > now());
$$;
revoke execute on function public.is_customer_premium(uuid) from public, anon, authenticated;

create or replace function public.customer_premium_subscribe() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_row public.customer_premium%rowtype;
begin
  if v_user is null then
    raise exception 'Sign in first';
  end if;
  select * into v_row from public.customer_premium where user_id = v_user for update;
  if v_row.user_id is not null and v_row.period_end > now() then
    update public.customer_premium set cancel_at_period_end = false, updated_at = now() where user_id = v_user;
    return;
  end if;
  insert into public.customer_premium (user_id, started_at, period_end, pending_fee)
  values (v_user, now(), now() + interval '1 month', public.customer_premium_price())
  on conflict (user_id) do update
    set started_at = now(), period_end = now() + interval '1 month', cancel_at_period_end = false,
        pending_fee = public.customer_premium_price(), updated_at = now();
end;
$$;

-- Stays until the end of the month. A month that wasn't paid yet (no order) isn't charged.
create or replace function public.customer_premium_cancel() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.customer_premium set cancel_at_period_end = true, updated_at = now()
  where user_id = auth.uid() and period_end > now();
end;
$$;

revoke execute on function public.customer_premium_subscribe() from public, anon;
revoke execute on function public.customer_premium_cancel() from public, anon;
grant execute on function public.customer_premium_subscribe() to authenticated;
grant execute on function public.customer_premium_cancel() to authenticated;

create or replace function public.my_customer_premium() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'active', coalesce(p.period_end > now(), false),
    'price', public.customer_premium_price(),
    'period_end', case when p.period_end > now() then p.period_end end,
    'cancel_at_period_end', coalesce(p.cancel_at_period_end, false),
    'pending_fee', case when p.period_end > now() then p.pending_fee else 0 end)
  from (select 1) one
  left join public.customer_premium p on p.user_id = auth.uid();
$$;
revoke execute on function public.my_customer_premium() from public, anon;
grant execute on function public.my_customer_premium() to authenticated;

-- Runs every night: renews months that ended. Only a paid month renews; an unpaid one
-- (no order all month) or a cancelled one ends, and its unpaid fee is forgiven.
create or replace function public.renew_customer_premium() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer := 0;
begin
  update public.customer_premium
  set period_end = period_end + interval '1 month', pending_fee = public.customer_premium_price(), updated_at = now()
  where period_end <= now() and not cancel_at_period_end and pending_fee = 0;
  get diagnostics n = row_count;
  update public.customer_premium set pending_fee = 0, updated_at = now()
  where period_end <= now() and pending_fee > 0;
  return n;
end;
$$;
revoke execute on function public.renew_customer_premium() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Orders: free delivery for members, and the month's fee on the next order
-- ---------------------------------------------------------------------------

alter table public.orders add column if not exists membership_fee numeric(10, 2) not null default 0;

do $$
declare
  v_def text := pg_get_functiondef('public.apply_order_pricing'::regproc);
  v_new text;
begin
  v_new := replace(v_def,
    $old$  new.delivery_fee := case when previous_orders < 3 then 0 else 30 end;$old$,
    $new$  new.delivery_fee := case when previous_orders < 3 then 0 else 30 end;
  -- Premium members never pay delivery (the rider is still paid).
  if public.is_customer_premium(new.user_id) then
    new.delivery_fee := 0;
  end if;$new$);
  v_new := replace(v_new,
    $old$  new.total := new.subtotal - new.discount + new.delivery_fee + new.service_fee + new.tip;$old$,
    $new$  -- This month's Premium fee rides on the member's first order of the month.
  select p.pending_fee into new.membership_fee from public.customer_premium p
  where p.user_id = new.user_id and p.period_end > now() and p.pending_fee > 0
  for update;
  new.membership_fee := coalesce(new.membership_fee, 0);
  if new.membership_fee > 0 then
    update public.customer_premium set pending_fee = 0, updated_at = now() where user_id = new.user_id;
  end if;
  new.total := new.subtotal - new.discount + new.delivery_fee + new.service_fee + new.tip + new.membership_fee;$new$);
  if v_new = v_def or v_new not like '%is_customer_premium%' or v_new not like '%new.membership_fee;%' then
    raise exception 'apply_order_pricing: text to replace not found';
  end if;
  execute v_new;
end;
$$;

-- A cancelled order gives its Premium fee back to the next one.
create or replace function public.restore_membership_fee() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and new.membership_fee > 0 then
    update public.customer_premium
    set pending_fee = pending_fee + new.membership_fee, updated_at = now()
    where user_id = new.user_id and period_end > now();
  end if;
  return null;
end;
$$;
revoke execute on function public.restore_membership_fee() from public, anon, authenticated;

create trigger orders_restore_membership_fee
  after update of status on public.orders
  for each row execute function public.restore_membership_fee();

-- ---------------------------------------------------------------------------
-- Tonight's dinner push: members only
-- ---------------------------------------------------------------------------

do $$
declare
  v_def text := pg_get_functiondef('public.notification_candidates(integer)'::regprocedure);
  v_new text;
begin
  v_new := replace(v_def,
    $old$                  and public.tonight_dish() is not null$old$,
    $new$                  and public.tonight_dish() is not null
                  and public.is_customer_premium(s.user_id)$new$);
  if v_new = v_def then
    raise exception 'notification_candidates: text to replace not found';
  end if;
  execute v_new;
end;
$$;

select cron.schedule('customer-premium', '10 22 * * *', 'select public.renew_customer_premium()');
