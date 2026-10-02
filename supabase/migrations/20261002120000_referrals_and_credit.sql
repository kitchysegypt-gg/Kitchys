-- Refer a friend: every customer has a code. A friend enters it at checkout on their
-- first order, and the referrer gets 10% of that order (food, after discounts) as
-- Kitchy's credit. Credit comes off the customer's next orders when they choose to use it.
-- Also lets approved home chefs change their profile photo.

-- 1. Referral codes ---------------------------------------------------------------
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^KIT[A-Z0-9]{6}$'),
  created_at timestamptz not null default now()
);

alter table public.referral_codes enable row level security;

create policy "Customers can read their own referral code"
  on public.referral_codes for select to authenticated
  using ((select auth.uid()) = user_id);

-- Returns the signed-in customer's code, creating it the first time.
create or replace function public.my_referral_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result text;
begin
  if uid is null then raise exception 'Sign in first'; end if;
  select code into result from public.referral_codes where user_id = uid;
  if result is not null then return result; end if;
  loop
    -- No 0/O or 1/I so codes are easy to read out loud.
    result := 'KIT' || (
      select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
      from generate_series(1, 6)
    );
    begin
      insert into public.referral_codes (user_id, code) values (uid, result);
      return result;
    exception when unique_violation then
      -- Another request created this user's code, or the random code is taken: try again.
      select code into result from public.referral_codes where user_id = uid;
      if result is not null then return result; end if;
    end;
  end loop;
end;
$$;

revoke execute on function public.my_referral_code() from public, anon;
grant execute on function public.my_referral_code() to authenticated;

-- 2. Credit ledger: positive rows add credit, negative rows spend it -----------------
create table if not exists public.wallet_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(10, 2) not null check (amount <> 0),
  kind text not null check (kind in ('referral', 'spent', 'refund', 'reversal')),
  order_id uuid references public.orders (id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists wallet_entries_user_idx on public.wallet_entries (user_id, created_at desc);

alter table public.wallet_entries enable row level security;

create policy "Customers can read their own credit history"
  on public.wallet_entries for select to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.wallet_balance(p_user uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0) from public.wallet_entries where user_id = p_user;
$$;

revoke execute on function public.wallet_balance(uuid) from public, anon, authenticated;

-- 3. Referrals: one per friend, made on the friend's first order --------------------
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null unique references auth.users (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  cashback numeric(10, 2) not null,
  status text not null default 'earned' check (status in ('earned', 'cancelled')),
  friend_name text not null default '',
  created_at timestamptz not null default now()
);

alter table public.referrals enable row level security;

create policy "Referrers can see the friends they referred"
  on public.referrals for select to authenticated
  using ((select auth.uid()) = referrer_id);

-- 4. Orders: referral code and credit -----------------------------------------------
alter table public.orders
  add column if not exists referral_code text,
  add column if not exists referred_by uuid references auth.users (id),
  add column if not exists use_credit boolean not null default false,
  add column if not exists credit_used numeric(10, 2) not null default 0;

create or replace function public.apply_order_pricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_orders integer;
  ever_ordered boolean;
  computed_subtotal numeric(10, 2);
  item_count integer;
  priced_count integer;
  v public.reward_vouchers%rowtype;
  r public.rewards%rowtype;
  referrer uuid;
  balance numeric(10, 2);
begin
  new.user_id := auth.uid();
  if new.user_id is null then
    raise exception 'You need to be signed in to order';
  end if;
  new.status := 'placed';
  new.referred_by := null;
  new.credit_used := 0;

  -- One order at a time per customer, so credit and vouchers can't be spent twice.
  perform pg_advisory_xact_lock(hashtext(new.user_id::text));

  -- Delivery time: as soon as possible (null) or any time in the next 14 days.
  if new.scheduled_for is not null
     and (new.scheduled_for < now() - interval '5 minutes' or new.scheduled_for > now() + interval '14 days') then
    raise exception 'Pick a delivery time within the next 14 days';
  end if;

  -- Subtotal from the server's prices (menu dishes and approved chefs' dishes).
  with prices as (
    select id, price from public.dish_prices
    union all
    select id::text, price from public.kitchen_dishes where available
  )
  select count(*),
         count(p.id),
         coalesce(sum(p.price * (item->>'quantity')::integer), 0)
    into item_count, priced_count, computed_subtotal
  from jsonb_array_elements(new.items) as item
  left join prices p on p.id = item->>'dishId';

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

  select count(*) filter (where status <> 'cancelled'), count(*) > 0
    into previous_orders, ever_ordered
  from public.orders
  where user_id = new.user_id;

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

  -- A friend's referral code only counts on their very first order.
  new.referral_code := nullif(upper(trim(coalesce(new.referral_code, ''))), '');
  if new.referral_code is not null then
    select user_id into referrer from public.referral_codes where code = new.referral_code;
    if referrer is null then
      raise exception 'That referral code doesn''t exist';
    end if;
    if referrer = new.user_id then
      raise exception 'You can''t use your own referral code';
    end if;
    if ever_ordered or exists (select 1 from public.referrals where friend_id = new.user_id) then
      raise exception 'Referral codes only work on your first order';
    end if;
    new.referred_by := referrer;
  end if;

  new.total := new.subtotal - new.discount + new.delivery_fee;

  if new.use_credit then
    balance := public.wallet_balance(new.user_id);
    new.credit_used := greatest(0, least(balance, new.total));
    new.total := new.total - new.credit_used;
  end if;

  new.points_earned := floor(
    (new.subtotal - new.discount) / 10 * public.loyalty_multiplier(public.loyalty_level(previous_orders))
  );
  return new;
end;
$$;

-- After the order is saved: spend the credit and pay the referrer.
create or replace function public.after_order_placed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cashback numeric(10, 2);
begin
  if new.credit_used > 0 then
    insert into public.wallet_entries (user_id, amount, kind, order_id, note)
    values (new.user_id, -new.credit_used, 'spent', new.id, 'Used on an order');
  end if;

  if new.referred_by is not null then
    cashback := round((new.subtotal - new.discount) * 0.10, 2);
    insert into public.referrals (referrer_id, friend_id, order_id, cashback, friend_name)
    values (
      new.referred_by, new.user_id, new.id, cashback,
      coalesce((select split_part(raw_user_meta_data->>'full_name', ' ', 1) from auth.users where id = new.user_id), '')
    );
    if cashback > 0 then
      insert into public.wallet_entries (user_id, amount, kind, order_id, note)
      values (new.referred_by, cashback, 'referral', new.id, 'A friend ordered with your code');
    end if;
  end if;
  return null;
end;
$$;

create trigger orders_after_placed
  after insert on public.orders
  for each row execute function public.after_order_placed();

-- If the Kitchy's team cancels an order: refund its credit and take back its cashback.
create or replace function public.after_order_cancelled()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref public.referrals%rowtype;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    if new.credit_used > 0 then
      insert into public.wallet_entries (user_id, amount, kind, order_id, note)
      values (new.user_id, new.credit_used, 'refund', new.id, 'Order cancelled');
    end if;
    select * into ref from public.referrals where order_id = new.id and status = 'earned';
    if found then
      update public.referrals set status = 'cancelled' where id = ref.id;
      if ref.cashback > 0 then
        insert into public.wallet_entries (user_id, amount, kind, order_id, note)
        values (ref.referrer_id, -ref.cashback, 'reversal', new.id, 'Friend''s order was cancelled');
      end if;
    end if;
  end if;
  return null;
end;
$$;

create trigger orders_after_cancelled
  after update of status on public.orders
  for each row execute function public.after_order_cancelled();

revoke execute on function public.after_order_placed() from public, anon, authenticated;
revoke execute on function public.after_order_cancelled() from public, anon, authenticated;
revoke execute on function public.apply_order_pricing() from public, anon, authenticated;

-- The app reads its balance through this.
create or replace function public.my_wallet_balance()
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select public.wallet_balance(auth.uid());
$$;

revoke execute on function public.my_wallet_balance() from public, anon;
grant execute on function public.my_wallet_balance() to authenticated;

-- 5. Approved chefs can change their profile photo -----------------------------------
create or replace function public.set_kitchen_photo(p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_url is not null and p_url !~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/kitchen-photos/'
                                     || auth.uid()::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'Upload the photo first';
  end if;
  update public.kitchen_chefs set photo_url = p_url where user_id = auth.uid();
  if not found then raise exception 'Only approved home chefs have a profile photo'; end if;
end;
$$;

revoke execute on function public.set_kitchen_photo(text) from public, anon;
grant execute on function public.set_kitchen_photo(text) to authenticated;
