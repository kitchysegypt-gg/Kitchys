-- Kitchy's: server-side prices, points, ranks, rewards and delivery location.
-- Numbers here mirror lib/loyalty.ts and data/menu.ts; keep them in sync.

-- 1. Dish prices, so order totals are calculated on the server -------------
create table if not exists public.dish_prices (
  id text primary key,
  price numeric(10, 2) not null check (price >= 0)
);

alter table public.dish_prices enable row level security;

create policy "Anyone signed in can read dish prices"
  on public.dish_prices for select
  to authenticated
  using (true);

insert into public.dish_prices (id, price) values
  ('koshari', 85), ('molokhia', 180), ('mahshi', 220), ('fatta', 240),
  ('sayadeya', 260), ('shrimp', 320), ('lentil-soup', 60), ('calamari', 350),
  ('feteer', 150), ('hawawshi', 120), ('bechamel', 190), ('moussaka', 110),
  ('om-ali', 90), ('basbousa', 120), ('roz-bel-laban', 55), ('konafa', 140),
  ('karkade', 45), ('mango', 65), ('taameya', 70), ('salad', 75),
  ('grilled-chicken', 210), ('kofta', 230), ('lemon-mint', 50)
on conflict (id) do update set price = excluded.price;

-- 2. Rewards catalogue --------------------------------------------------------
create table if not exists public.rewards (
  id text primary key,
  kind text not null check (kind in ('free_delivery', 'fixed', 'percent')),
  value numeric(10, 2) not null default 0,
  max_discount numeric(10, 2),
  cost integer not null check (cost > 0),
  min_rank integer not null default 0
);

alter table public.rewards enable row level security;

create policy "Anyone signed in can read rewards"
  on public.rewards for select
  to authenticated
  using (true);

insert into public.rewards (id, kind, value, max_discount, cost, min_rank) values
  ('free_delivery', 'free_delivery', 0, null, 80, 0),
  ('off_25', 'fixed', 25, null, 100, 0),
  ('pct_10', 'percent', 10, 60, 150, 1),
  ('off_50', 'fixed', 50, null, 180, 1),
  ('pct_20', 'percent', 20, 120, 300, 2),
  ('off_100', 'fixed', 100, null, 350, 2),
  ('pct_30', 'percent', 30, 200, 600, 3)
on conflict (id) do update set
  kind = excluded.kind, value = excluded.value, max_discount = excluded.max_discount,
  cost = excluded.cost, min_rank = excluded.min_rank;

-- 3. Vouchers a customer bought with points -----------------------------------
create table if not exists public.reward_vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reward_id text not null references public.rewards (id),
  cost integer not null,
  status text not null default 'available' check (status in ('available', 'used')),
  order_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists reward_vouchers_user_id_idx on public.reward_vouchers (user_id, created_at desc);

alter table public.reward_vouchers enable row level security;

-- Read-only for customers: vouchers are created by redeem_reward() and used by the order trigger.
create policy "Customers can read their own vouchers"
  on public.reward_vouchers for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- 4. Order columns --------------------------------------------------------------
alter table public.orders
  add column if not exists discount numeric(10, 2) not null default 0,
  add column if not exists voucher_id uuid references public.reward_vouchers (id),
  add column if not exists points_earned integer not null default 0,
  add column if not exists delivery_lat double precision,
  add column if not exists delivery_lng double precision;

-- 5. Ranks: number of earlier (non-cancelled) orders -> level and multiplier -----
create or replace function public.loyalty_level(order_count integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case
    when order_count >= 100 then 5
    when order_count >= 50 then 4
    when order_count >= 25 then 3
    when order_count >= 10 then 2
    when order_count >= 3 then 1
    else 0
  end;
$$;

create or replace function public.loyalty_multiplier(level integer)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select (array[1, 1.1, 1.25, 1.5, 1.75, 2])[level + 1]::numeric;
$$;

-- 6. Order pricing: prices, delivery, voucher discount and points, all server-side --
create or replace function public.apply_order_pricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_orders integer;
  computed_subtotal numeric(10, 2);
  item_count integer;
  priced_count integer;
  v public.reward_vouchers%rowtype;
  r public.rewards%rowtype;
begin
  new.user_id := auth.uid();
  if new.user_id is null then
    raise exception 'You need to be signed in to order';
  end if;
  new.status := 'placed';

  -- Subtotal from the server's price list; the app's numbers are ignored.
  select count(*),
         count(p.id),
         coalesce(sum(p.price * (item->>'quantity')::integer), 0)
    into item_count, priced_count, computed_subtotal
  from jsonb_array_elements(new.items) as item
  left join public.dish_prices p on p.id = item->>'dishId';

  if item_count = 0 then
    raise exception 'Your order is empty';
  end if;
  if priced_count <> item_count then
    raise exception 'One of the dishes is no longer on the menu';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.items) as item
    where (item->>'quantity')::integer not between 1 and 50
  ) then
    raise exception 'Quantities must be between 1 and 50';
  end if;
  new.subtotal := computed_subtotal;

  select count(*) into previous_orders
  from public.orders
  where user_id = new.user_id and status <> 'cancelled';

  -- First 3 orders deliver free.
  new.delivery_fee := case when previous_orders < 3 then 0 else 30 end;
  new.discount := 0;

  if new.voucher_id is not null then
    select * into v from public.reward_vouchers
    where id = new.voucher_id and user_id = new.user_id and status = 'available'
    for update;
    if not found then
      raise exception 'That voucher is not available';
    end if;
    select * into r from public.rewards where id = v.reward_id;

    if r.kind = 'free_delivery' then
      if new.delivery_fee = 0 then
        raise exception 'Delivery is already free on this order; keep the voucher for later';
      end if;
      new.delivery_fee := 0;
    elsif r.kind = 'fixed' then
      new.discount := least(r.value, new.subtotal);
    else
      new.discount := least(round(new.subtotal * r.value / 100), coalesce(r.max_discount, new.subtotal));
    end if;

    update public.reward_vouchers set status = 'used', order_id = new.id where id = v.id;
  end if;

  new.total := new.subtotal - new.discount + new.delivery_fee;
  new.points_earned := floor(
    (new.subtotal - new.discount) / 10 * public.loyalty_multiplier(public.loyalty_level(previous_orders))
  );
  return new;
end;
$$;

-- 7. Redeem points for a voucher ----------------------------------------------------
create or replace function public.redeem_reward(p_reward_id text)
returns public.reward_vouchers
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r public.rewards%rowtype;
  order_count integer;
  earned integer;
  spent integer;
  voucher public.reward_vouchers;
begin
  if uid is null then
    raise exception 'You need to be signed in';
  end if;

  -- One redemption at a time per customer, so the balance can't be spent twice.
  perform pg_advisory_xact_lock(hashtext('redeem:' || uid::text));

  select * into r from public.rewards where id = p_reward_id;
  if not found then
    raise exception 'Unknown reward';
  end if;

  select count(*), coalesce(sum(points_earned), 0) into order_count, earned
  from public.orders where user_id = uid and status <> 'cancelled';

  if public.loyalty_level(order_count) < r.min_rank then
    raise exception 'Your rank is too low for this reward';
  end if;

  select coalesce(sum(cost), 0) into spent from public.reward_vouchers where user_id = uid;
  if earned - spent < r.cost then
    raise exception 'Not enough points';
  end if;

  insert into public.reward_vouchers (user_id, reward_id, cost)
  values (uid, r.id, r.cost)
  returning * into voucher;
  return voucher;
end;
$$;

revoke execute on function public.redeem_reward(text) from public, anon;
grant execute on function public.redeem_reward(text) to authenticated;
revoke execute on function public.apply_order_pricing() from public, anon, authenticated;
