-- Kitchy's Premium for chefs: EGP 320 a month, taken from their earnings.
--   * 12% commission instead of 15% on orders placed while Premium
--   * Kitchy's Care: up to 2 repair visits a year for kitchen appliances (after 30 days)
--   * Chef shop: points from every delivered order (Premium earns double), spent on
--     equipment; Premium chefs can also pay for equipment monthly from their earnings
--   * A Premium badge on their kitchen

-- ---------------------------------------------------------------------------
-- Subscription
-- ---------------------------------------------------------------------------

create or replace function public.premium_price() returns numeric
language sql immutable set search_path = '' as $$ select 320::numeric $$;

create table if not exists public.chef_premium (
  chef_id text primary key,
  -- Start of the current unbroken subscription (Kitchy's Care opens 30 days after it).
  first_started_at timestamptz not null default now(),
  period_start timestamptz not null default now(),
  period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.chef_premium enable row level security;
create policy "Chefs read their own Premium"
  on public.chef_premium for select to authenticated
  using (chef_id = (select public.my_chef_id()));

-- What Kitchy's takes out of a chef's earnings (Premium months, equipment instalments).
create table if not exists public.chef_charges (
  id uuid primary key default gen_random_uuid(),
  chef_id text not null,
  kind text not null check (kind in ('premium', 'instalment')),
  amount numeric(10, 2) not null check (amount > 0),
  note text,
  -- The equipment bought monthly (one charge a month, for its number of months).
  shop_order_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists chef_charges_chef_idx on public.chef_charges (chef_id, created_at desc);
alter table public.chef_charges enable row level security;
create policy "Chefs read their own charges"
  on public.chef_charges for select to authenticated
  using (chef_id = (select public.my_chef_id()));

create or replace function public.is_premium(p_chef text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.chef_premium p where p.chef_id = p_chef and p.period_end > now());
$$;

-- Kitchens with the Premium badge (shown to customers).
create or replace function public.premium_chef_ids() returns setof text
language sql stable security definer set search_path = '' as $$
  select chef_id from public.chef_premium where period_end > now();
$$;
grant execute on function public.premium_chef_ids() to anon, authenticated;

create or replace function public.premium_subscribe() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_chef text := public.my_chef_id();
  v_row public.chef_premium%rowtype;
begin
  if v_chef is null then
    raise exception 'Only approved home chefs have a kitchen';
  end if;
  select * into v_row from public.chef_premium where chef_id = v_chef for update;
  if v_row.chef_id is not null and v_row.period_end > now() then
    -- Still paid up: just keep it going.
    update public.chef_premium set cancel_at_period_end = false, updated_at = now() where chef_id = v_chef;
    return;
  end if;
  insert into public.chef_premium (chef_id, first_started_at, period_start, period_end)
  values (v_chef, now(), now(), now() + interval '1 month')
  on conflict (chef_id) do update
    set first_started_at = now(), period_start = now(), period_end = now() + interval '1 month',
        cancel_at_period_end = false, updated_at = now();
  insert into public.chef_charges (chef_id, kind, amount, note)
  values (v_chef, 'premium', public.premium_price(), 'Kitchy''s Premium');
end;
$$;

-- Premium stays until the end of the month already paid for.
create or replace function public.premium_cancel() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.chef_premium set cancel_at_period_end = true, updated_at = now()
  where chef_id = public.my_chef_id() and period_end > now();
end;
$$;

-- Runs every day: renews Premium months that ended (unless cancelled).
create or replace function public.renew_premium() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select * from public.chef_premium
    where period_end <= now() and not cancel_at_period_end
    for update
  loop
    update public.chef_premium
    set period_start = r.period_end, period_end = r.period_end + interval '1 month', updated_at = now()
    where chef_id = r.chef_id;
    insert into public.chef_charges (chef_id, kind, amount, note)
    values (r.chef_id, 'premium', public.premium_price(), 'Kitchy''s Premium');
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke execute on function public.renew_premium() from public, anon, authenticated;
revoke execute on function public.premium_subscribe() from public, anon;
revoke execute on function public.premium_cancel() from public, anon;
grant execute on function public.premium_subscribe() to authenticated;
grant execute on function public.premium_cancel() to authenticated;

-- ---------------------------------------------------------------------------
-- Commission: 12% on orders placed while the kitchen is Premium
-- ---------------------------------------------------------------------------

alter table public.orders add column if not exists commission_rate numeric(4, 3) not null default 0.15;

create or replace function public.set_order_commission() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.commission_rate := case when public.is_premium(new.chef_id) then 0.12 else 0.15 end;
  return new;
end;
$$;

revoke execute on function public.set_order_commission() from public, anon, authenticated;

create trigger orders_set_commission
  before insert on public.orders
  for each row execute function public.set_order_commission();

-- ---------------------------------------------------------------------------
-- Chef points: 1 point per EGP 10 of food on every delivered order, double for Premium
-- ---------------------------------------------------------------------------

create table if not exists public.chef_points (
  id uuid primary key default gen_random_uuid(),
  chef_id text not null,
  amount integer not null,
  reason text not null check (reason in ('order', 'shop', 'refund', 'bonus')),
  order_id uuid unique,
  shop_order_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists chef_points_chef_idx on public.chef_points (chef_id, created_at desc);
alter table public.chef_points enable row level security;
create policy "Chefs read their own points"
  on public.chef_points for select to authenticated
  using (chef_id = (select public.my_chef_id()));

create or replace function public.chef_points_balance(p_chef text) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount), 0)::int from public.chef_points where chef_id = p_chef;
$$;
revoke execute on function public.chef_points_balance(text) from public, anon, authenticated;

create or replace function public.award_chef_points() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_points integer;
begin
  if new.status = 'delivered' and old.status <> 'delivered' and new.chef_id is not null then
    v_points := floor(new.subtotal / 10)::int * case when public.is_premium(new.chef_id) then 2 else 1 end;
    if v_points > 0 then
      insert into public.chef_points (chef_id, amount, reason, order_id)
      values (new.chef_id, v_points, 'order', new.id)
      on conflict (order_id) do nothing;
    end if;
  end if;
  return null;
end;
$$;

revoke execute on function public.award_chef_points() from public, anon, authenticated;

create trigger orders_award_chef_points
  after update of status on public.orders
  for each row execute function public.award_chef_points();

-- Points for orders already delivered before the shop opened.
insert into public.chef_points (chef_id, amount, reason, order_id, created_at)
select o.chef_id, floor(o.subtotal / 10)::int, 'order', o.id, coalesce(o.delivered_at, o.created_at)
from public.orders o
where o.status = 'delivered' and o.chef_id is not null and floor(o.subtotal / 10) > 0
on conflict (order_id) do nothing;

-- ---------------------------------------------------------------------------
-- Chef shop
-- ---------------------------------------------------------------------------

create table if not exists public.shop_items (
  id text primary key,
  name jsonb not null,
  description jsonb not null,
  emoji text not null default 'pan',
  price numeric(10, 2) not null check (price > 0),
  points integer not null check (points > 0),
  active boolean not null default true,
  sort integer not null default 0
);

alter table public.shop_items enable row level security;
create policy "Anyone signed in sees the shop"
  on public.shop_items for select to authenticated
  using (active);

-- Starting catalogue; prices are editable in the shop_items table.
insert into public.shop_items (id, name, description, emoji, price, points, sort) values
  ('oven', '{"en":"Electric oven 45 L","ar":"فرن كهربا ٤٥ لتر","fr":"Four électrique 45 L"}',
   '{"en":"Bakes trays of béchamel pasta, roast chicken and sweets at once.","ar":"يخبز صواني مكرونة بشاميل وفراخ وحلويات مرة واحدة.","fr":"Cuit à la fois pâtes béchamel, poulet rôti et desserts."}',
   'fire', 9500, 23750, 1),
  ('air_fryer', '{"en":"Air fryer 5.5 L","ar":"إير فراير ٥٫٥ لتر","fr":"Friteuse à air 5,5 L"}',
   '{"en":"Crispy without the oil: chicken, potatoes, kofta.","ar":"مقرمش من غير زيت: فراخ، بطاطس، كفتة.","fr":"Croustillant sans huile : poulet, pommes de terre, kofta."}',
   'pot', 4000, 10000, 2),
  ('mixer', '{"en":"Stand mixer","ar":"عجّان كهربا","fr":"Robot pâtissier"}',
   '{"en":"Kneads dough and whips cream while you cook.","ar":"يعجن ويخفق الكريمة وإنتي بتطبخي.","fr":"Pétrit et fouette pendant que vous cuisinez."}',
   'cake', 6000, 15000, 3),
  ('containers', '{"en":"Food containers (50)","ar":"علب أكل (٥٠)","fr":"Boîtes alimentaires (50)"}',
   '{"en":"Sturdy containers with lids for your orders.","ar":"علب قوية بغطا لطلباتك.","fr":"Boîtes solides avec couvercle pour vos commandes."}',
   'bags', 600, 1500, 4)
on conflict (id) do nothing;

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  chef_id text not null,
  item_id text not null references public.shop_items (id),
  method text not null check (method in ('points', 'instalments')),
  points_spent integer not null default 0,
  months integer,
  monthly numeric(10, 2),
  status text not null default 'requested' check (status in ('requested', 'delivered', 'cancelled')),
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index if not exists shop_orders_chef_idx on public.shop_orders (chef_id, created_at desc);
alter table public.shop_orders enable row level security;
create policy "Chefs read their own shop orders"
  on public.shop_orders for select to authenticated
  using (chef_id = (select public.my_chef_id()));

-- Get an item with points (anyone), or monthly over 6 months from earnings (Premium only).
create or replace function public.shop_redeem(p_item text, p_method text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_chef text := public.my_chef_id();
  v_item public.shop_items%rowtype;
  v_id uuid;
begin
  if v_chef is null then
    raise exception 'Only approved home chefs have a kitchen';
  end if;
  select * into v_item from public.shop_items where id = p_item and active;
  if v_item.id is null then
    raise exception 'This item is not in the shop any more';
  end if;
  perform pg_advisory_xact_lock(hashtext('chef-shop:' || v_chef));

  if p_method = 'points' then
    if public.chef_points_balance(v_chef) < v_item.points then
      raise exception 'You need % points for this', v_item.points;
    end if;
    insert into public.shop_orders (chef_id, item_id, method, points_spent)
    values (v_chef, v_item.id, 'points', v_item.points) returning id into v_id;
    insert into public.chef_points (chef_id, amount, reason, shop_order_id)
    values (v_chef, -v_item.points, 'shop', v_id);
  elsif p_method = 'instalments' then
    if not public.is_premium(v_chef) then
      raise exception 'Paying monthly is for Kitchy''s Premium kitchens';
    end if;
    if exists (
      select 1 from public.shop_orders s
      where s.chef_id = v_chef and s.method = 'instalments'
        and (s.status = 'requested'
             or (s.status = 'delivered' and s.delivered_at + make_interval(months => s.months) > now()))
    ) then
      raise exception 'You can pay for one item monthly at a time';
    end if;
    insert into public.shop_orders (chef_id, item_id, method, months, monthly)
    values (v_chef, v_item.id, 'instalments', 6, ceil(v_item.price / 6)) returning id into v_id;
  else
    raise exception 'Choose points or monthly';
  end if;
  return v_id;
end;
$$;

-- Runs every day: one charge a month for equipment paid monthly, starting on delivery.
create or replace function public.charge_instalments() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    select s.*, i.name->>'en' as item_name,
           least(s.months, floor(extract(epoch from now() - s.delivered_at) / (30 * 86400))::int + 1) as due,
           (select count(*) from public.chef_charges c where c.shop_order_id = s.id) as charged
    from public.shop_orders s join public.shop_items i on i.id = s.item_id
    where s.method = 'instalments' and s.status = 'delivered' and s.delivered_at is not null
  loop
    for k in (r.charged + 1)..r.due loop
      insert into public.chef_charges (chef_id, kind, amount, note, shop_order_id)
      values (r.chef_id, 'instalment', r.monthly, r.item_name || ' (' || k || '/' || r.months || ')', r.id);
      n := n + 1;
    end loop;
  end loop;
  return n;
end;
$$;

revoke execute on function public.charge_instalments() from public, anon, authenticated;

revoke execute on function public.shop_redeem(text, text) from public, anon;
grant execute on function public.shop_redeem(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Kitchy's Care: repair visits for Premium kitchens
-- ---------------------------------------------------------------------------

create table if not exists public.care_requests (
  id uuid primary key default gen_random_uuid(),
  chef_id text not null,
  appliance text not null check (appliance in ('oven', 'stove', 'air_fryer', 'fridge', 'mixer', 'other')),
  problem text not null check (length(problem) between 10 and 1000),
  photo_url text,
  status text not null default 'open' check (status in ('open', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  done_at timestamptz
);

create index if not exists care_requests_chef_idx on public.care_requests (chef_id, created_at desc);
alter table public.care_requests enable row level security;
create policy "Chefs read their own care requests"
  on public.care_requests for select to authenticated
  using (chef_id = (select public.my_chef_id()));

create or replace function public.care_request(p_appliance text, p_problem text, p_photo text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_chef text := public.my_chef_id();
  v_prem public.chef_premium%rowtype;
  v_used integer;
  v_id uuid;
begin
  if v_chef is null then
    raise exception 'Only approved home chefs have a kitchen';
  end if;
  select * into v_prem from public.chef_premium where chef_id = v_chef and period_end > now();
  if v_prem.chef_id is null then
    raise exception 'Kitchy''s Care is part of Kitchy''s Premium';
  end if;
  if v_prem.first_started_at > now() - interval '30 days' then
    raise exception 'Kitchy''s Care starts on %', to_char((v_prem.first_started_at + interval '30 days') at time zone 'Africa/Cairo', 'FMDD Mon YYYY');
  end if;
  perform pg_advisory_xact_lock(hashtext('chef-care:' || v_chef));
  select count(*) into v_used from public.care_requests
  where chef_id = v_chef and status <> 'cancelled' and created_at > now() - interval '365 days';
  if v_used >= 2 then
    raise exception 'You used your 2 Kitchy''s Care visits this year';
  end if;
  insert into public.care_requests (chef_id, appliance, problem, photo_url)
  values (v_chef, p_appliance, btrim(p_problem), nullif(btrim(coalesce(p_photo, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

revoke execute on function public.care_request(text, text, text) from public, anon;
grant execute on function public.care_request(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Everything the Premium screen shows
-- ---------------------------------------------------------------------------

create or replace function public.my_premium() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_chef text := public.my_chef_id();
  v_prem public.chef_premium%rowtype;
  v_active boolean;
begin
  if v_chef is null then
    raise exception 'Only approved home chefs have a kitchen';
  end if;
  select * into v_prem from public.chef_premium where chef_id = v_chef;
  v_active := v_prem.chef_id is not null and v_prem.period_end > now();
  return jsonb_build_object(
    'active', v_active,
    'price', public.premium_price(),
    'period_end', case when v_active then v_prem.period_end end,
    'cancel_at_period_end', coalesce(v_prem.cancel_at_period_end, false),
    'care_from', case when v_active then v_prem.first_started_at + interval '30 days' end,
    'care_used', (select count(*) from public.care_requests c
                  where c.chef_id = v_chef and c.status <> 'cancelled' and c.created_at > now() - interval '365 days'),
    'care_limit', 2,
    'points', public.chef_points_balance(v_chef),
    'points_multiplier', case when v_active then 2 else 1 end,
    'care_requests', (select coalesce(jsonb_agg(to_jsonb(c) order by c.created_at desc), '[]'::jsonb)
                      from (select id, appliance, problem, status, created_at from public.care_requests
                            where chef_id = v_chef order by created_at desc limit 10) c),
    'shop_orders', (select coalesce(jsonb_agg(to_jsonb(s) order by s.created_at desc), '[]'::jsonb)
                    from (select id, item_id, method, points_spent, months, monthly, status, created_at, delivered_at
                          from public.shop_orders where chef_id = v_chef order by created_at desc limit 10) s)
  );
end;
$$;

revoke execute on function public.my_premium() from public, anon;
grant execute on function public.my_premium() to authenticated;

-- ---------------------------------------------------------------------------
-- Earnings: commission at each order's own rate, and what Kitchy's took out
-- ---------------------------------------------------------------------------

do $$
declare
  v_def text := pg_get_functiondef('public.kitchen_stats(text, integer)'::regprocedure);
  v_new text;
begin
  v_new := replace(v_def,
    $old$'sales', (select coalesce(sum(subtotal), 0) from win),$old$,
    $new$'sales', (select coalesce(sum(subtotal), 0) from win),
    'commission', (select coalesce(sum(round(subtotal * commission_rate)), 0) from win),
    'deductions', (select coalesce(sum(c.amount), 0) from public.chef_charges c
                   where c.chef_id = p_chef
                     and c.created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))),$new$);
  if v_new = v_def then
    raise exception 'kitchen_stats: text to replace not found';
  end if;
  execute v_new;
end;
$$;

-- Renew Premium months every night (00:05 Cairo, roughly).
select cron.schedule('chef-billing', '5 22 * * *', 'select public.renew_premium(); select public.charge_instalments()');
