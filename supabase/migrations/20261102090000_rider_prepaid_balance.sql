-- Riders pay Kitchy's share of an order before picking it up, from a prepaid balance.
--
-- Kitchy's share = what the customer pays in cash minus the rider's pay (EGP 30 + tip). The rider
-- tops up the balance by InstaPay or Vodafone Cash and sends the reference; an admin confirms it.
-- Taking an order needs enough balance; "Picked up" takes the share from the balance. After that,
-- all the cash the rider collects from the customer is theirs. A cancelled order gives it back.

-- 1. Balance, top-ups and the history of every change ---------------------------------------
alter table public.riders add column if not exists balance numeric not null default 0;
alter table public.orders add column if not exists rider_prepaid numeric;

create table if not exists public.rider_topups (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders(id) on delete cascade,
  amount numeric not null check (amount >= 50 and amount <= 20000),
  method text not null check (method in ('instapay', 'vodafone_cash')),
  reference text not null check (char_length(reference) between 3 and 80),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists rider_topups_rider_idx on public.rider_topups (rider_id, created_at desc);
create index if not exists rider_topups_pending_idx on public.rider_topups (created_at) where status = 'pending';
alter table public.rider_topups enable row level security;
create policy "Riders see their own top-ups" on public.rider_topups
  for select to authenticated using (rider_id = public.my_rider_id() or public.is_admin());

create table if not exists public.rider_ledger (
  id bigint generated always as identity primary key,
  rider_id uuid not null references public.riders(id) on delete cascade,
  -- Positive: top-up or refund. Negative: paid for a pickup.
  amount numeric not null,
  kind text not null check (kind in ('topup', 'pickup', 'refund', 'adjust')),
  order_id uuid references public.orders(id) on delete set null,
  topup_id uuid references public.rider_topups(id) on delete set null,
  balance_after numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists rider_ledger_rider_idx on public.rider_ledger (rider_id, created_at desc);
alter table public.rider_ledger enable row level security;
create policy "Riders see their own balance history" on public.rider_ledger
  for select to authenticated using (rider_id = public.my_rider_id() or public.is_admin());

-- Where riders send top-ups (InstaPay address, Vodafone Cash number). Readable by signed-in users.
create table if not exists public.app_config (
  key text primary key,
  value text not null
);
alter table public.app_config enable row level security;
create policy "Signed-in users read the app config" on public.app_config
  for select to authenticated using (true);

create or replace function public.set_app_config(p_key text, p_value text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Only the Kitchy''s team can change this'; end if;
  if p_key not in ('rider_topup_instapay', 'rider_topup_vodafone_cash') then raise exception 'Unknown setting'; end if;
  insert into public.app_config (key, value) values (p_key, left(trim(coalesce(p_value, '')), 120))
  on conflict (key) do update set value = excluded.value;
end;
$$;
revoke execute on function public.set_app_config(text, text) from public, anon;
grant execute on function public.set_app_config(text, text) to authenticated;

-- 2. Kitchy's share of an order ----------------------------------------------------------------
create or replace function public.rider_share(p_total numeric, p_tip numeric)
returns numeric language sql immutable set search_path = '' as $$
  select greatest(0, coalesce(p_total, 0) - (public.rider_delivery_pay() + coalesce(p_tip, 0)));
$$;

-- 3. Top-ups ------------------------------------------------------------------------------------
create or replace function public.request_rider_topup(p_amount numeric, p_method text, p_reference text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_rider uuid := public.my_rider_id();
  v_id uuid;
  r record;
begin
  if v_rider is null then raise exception 'Only approved riders can top up'; end if;
  if p_amount is null or p_amount < 50 or p_amount > 20000 then
    raise exception 'Top up between EGP 50 and EGP 20,000';
  end if;
  if p_method not in ('instapay', 'vodafone_cash') then raise exception 'Choose InstaPay or Vodafone Cash'; end if;
  if char_length(trim(coalesce(p_reference, ''))) < 3 then
    raise exception 'Type the transfer reference number';
  end if;
  if (select count(*) from public.rider_topups where rider_id = v_rider and status = 'pending') >= 3 then
    raise exception 'Wait until Kitchy''s confirms your other top-ups';
  end if;
  insert into public.rider_topups (rider_id, amount, method, reference)
  values (v_rider, round(p_amount, 2), p_method, left(trim(p_reference), 80))
  returning id into v_id;

  -- Tell the team there's a top-up to check.
  for r in
    select a.user_id from public.admins a
    union
    select u.id from auth.users u where lower(u.email) = 'kitchysegypt@gmail.com' and u.email_confirmed_at is not null
  loop
    perform public.send_push(r.user_id, 'Rider top-up to check 💰',
      'EGP ' || round(p_amount) || ' by ' || case p_method when 'instapay' then 'InstaPay' else 'Vodafone Cash' end
        || ' · ref ' || left(trim(p_reference), 30), '/admin');
  end loop;
  return v_id;
end;
$$;
revoke execute on function public.request_rider_topup(numeric, text, text) from public, anon;
grant execute on function public.request_rider_topup(numeric, text, text) to authenticated;

create or replace function public.review_rider_topup(p_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_topup public.rider_topups%rowtype;
  v_balance numeric;
  v_user uuid;
begin
  if not public.is_admin() then raise exception 'Only the Kitchy''s team can confirm top-ups'; end if;
  select * into v_topup from public.rider_topups where id = p_id for update;
  if v_topup.id is null then raise exception 'Top-up not found'; end if;
  if v_topup.status <> 'pending' then raise exception 'This top-up was already handled'; end if;
  select user_id into v_user from public.riders where id = v_topup.rider_id;

  if p_approve then
    update public.riders set balance = balance + v_topup.amount where id = v_topup.rider_id
    returning balance into v_balance;
    insert into public.rider_ledger (rider_id, amount, kind, topup_id, balance_after)
    values (v_topup.rider_id, v_topup.amount, 'topup', v_topup.id, v_balance);
    update public.rider_topups set status = 'approved', reviewed_at = now() where id = p_id;
    perform public.send_push(v_user, 'Balance topped up ✅',
      'EGP ' || round(v_topup.amount) || ' added. Your balance is EGP ' || round(v_balance) || '.', '/rider');
  else
    update public.rider_topups set status = 'rejected', reviewed_at = now() where id = p_id;
    perform public.send_push(v_user, 'Top-up not confirmed',
      'We couldn''t find your transfer (ref ' || v_topup.reference || '). Call Kitchy''s if you sent it.', '/rider');
  end if;
end;
$$;
revoke execute on function public.review_rider_topup(uuid, boolean) from public, anon;
grant execute on function public.review_rider_topup(uuid, boolean) to authenticated;

-- Pending top-ups with the rider's name and phone, for the admin screen.
create or replace function public.admin_rider_topups()
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when not public.is_admin() then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', t.id, 'amount', t.amount, 'method', t.method, 'reference', t.reference, 'created_at', t.created_at,
      'rider', jsonb_build_object('name', r.name, 'phone', r.phone, 'balance', r.balance)) order by t.created_at)
    from public.rider_topups t join public.riders r on r.id = t.rider_id
    where t.status = 'pending'), '[]'::jsonb) end;
$$;
revoke execute on function public.admin_rider_topups() from public, anon;
grant execute on function public.admin_rider_topups() to authenticated;

-- 4. Taking and picking up orders -------------------------------------------------------------
-- Taking an order needs enough balance for it and for the rider's other orders not picked up yet.
create or replace function public.rider_claim_order(p_order uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  me public.riders%rowtype;
  v_order public.orders%rowtype;
  v_needed numeric;
begin
  select * into me from public.riders where user_id = auth.uid();
  if me.id is null then raise exception 'Only approved riders can take orders'; end if;
  if not me.online then raise exception 'Go online first'; end if;
  if (select count(*) from public.orders where rider_id = me.id and status in ('cooking', 'ready', 'on_the_way')) >= 2 then
    raise exception 'Finish your current deliveries first (2 at a time)';
  end if;
  select * into v_order from public.orders where id = p_order for update;
  if v_order.id is null or v_order.status not in ('cooking', 'ready') then
    raise exception 'This order is no longer available';
  end if;
  if v_order.rider_id is not null then
    raise exception 'Another rider already took this order';
  end if;
  v_needed := public.rider_share(v_order.total, v_order.tip) + coalesce((
    select sum(public.rider_share(o.total, o.tip)) from public.orders o
    where o.rider_id = me.id and o.status in ('cooking', 'ready')), 0);
  if me.balance < v_needed then
    raise exception 'Top up your balance first: you need EGP % to take this order (you have EGP %)',
      round(v_needed), round(me.balance);
  end if;
  update public.orders set rider_id = me.id, rider_assigned_at = now() where id = p_order;
end;
$$;

-- "Picked up" pays Kitchy's share from the balance.
create or replace function public.rider_set_order_status(p_order uuid, p_step text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_share numeric;
  v_balance numeric;
begin
  select * into v_order from public.orders where id = p_order and rider_id = public.my_rider_id() for update;
  if v_order.id is null then raise exception 'Order not found'; end if;
  if p_step = 'picked_up' and v_order.status in ('cooking', 'ready') then
    v_share := public.rider_share(v_order.total, v_order.tip);
    select balance into v_balance from public.riders where id = v_order.rider_id for update;
    if v_balance < v_share then
      raise exception 'Not enough balance: top up to pay Kitchy''s EGP % for this order (you have EGP %)',
        round(v_share), round(v_balance);
    end if;
    if v_share > 0 then
      update public.riders set balance = balance - v_share where id = v_order.rider_id returning balance into v_balance;
      insert into public.rider_ledger (rider_id, amount, kind, order_id, balance_after)
      values (v_order.rider_id, -v_share, 'pickup', v_order.id, v_balance);
    end if;
    update public.orders set status = 'on_the_way', picked_up_at = now(), ready_at = coalesce(ready_at, now()),
      rider_prepaid = v_share
    where id = p_order;
  elsif p_step = 'delivered' and v_order.status = 'on_the_way' then
    update public.orders set status = 'delivered', delivered_at = now() where id = p_order;
  else
    raise exception 'This order can''t be marked % now', p_step;
  end if;
end;
$$;

-- A cancelled order the rider already paid for goes back to their balance.
create or replace function public.refund_rider_prepaid()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_balance numeric;
  v_user uuid;
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' and coalesce(new.rider_prepaid, 0) > 0 and new.rider_id is not null then
    update public.riders set balance = balance + new.rider_prepaid where id = new.rider_id
    returning balance, user_id into v_balance, v_user;
    insert into public.rider_ledger (rider_id, amount, kind, order_id, balance_after)
    values (new.rider_id, new.rider_prepaid, 'refund', new.id, v_balance);
    perform public.send_push(v_user, 'Money back in your balance',
      'Order #' || upper(left(new.id::text, 6)) || ' was cancelled. EGP ' || round(new.rider_prepaid) || ' is back in your balance.', '/rider');
  end if;
  return null;
end;
$$;
create or replace trigger orders_refund_rider after update of status on public.orders
  for each row execute function public.refund_rider_prepaid();

-- Only "Picked up" sets what the rider paid; a new order never starts with it.
create or replace function public.orders_clear_rider_prepaid()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.rider_prepaid := null;
  return new;
end;
$$;
create or replace trigger orders_clear_rider_prepaid before insert on public.orders
  for each row execute function public.orders_clear_rider_prepaid();

-- 5. What the rider app reads ------------------------------------------------------------------
create or replace function public.my_rider_status()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select jsonb_build_object('status', 'approved', 'rider', jsonb_build_object(
       'id', r.id, 'name', r.name, 'phone', r.phone, 'vehicle', r.vehicle, 'area', r.area, 'online', r.online,
       'balance', r.balance))
     from public.riders r where r.user_id = auth.uid()),
    (select jsonb_build_object('status', a.status)
     from public.rider_applications a where a.user_id = auth.uid() order by a.created_at desc limit 1),
    jsonb_build_object('status', 'none'));
$$;

create or replace function public.rider_order_json(o public.orders, p_full boolean, p_lat double precision, p_lng double precision)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'scheduled_for', o.scheduled_for,
    'created_at', o.created_at,
    'ready_at', o.ready_at,
    'items', (select coalesce(sum((i->>'quantity')::int), 0) from jsonb_array_elements(o.items) i),
    'cash', o.total,
    'delivery_fee', o.delivery_fee,
    'tip', o.tip,
    'pay', public.rider_delivery_pay() + o.tip,
    'share', public.rider_share(o.total, o.tip),
    'prepaid', o.rider_prepaid,
    'chef', jsonb_build_object(
      'name', k.name,
      'area', k.area,
      'lat', cl.latitude,
      'lng', cl.longitude,
      'phone', case when p_full then (select a.phone from public.chef_applications a
                                     where a.user_id = k.user_id order by a.created_at desc limit 1) end),
    'customer', jsonb_build_object(
      'name', case when p_full then split_part(coalesce(u.raw_user_meta_data->>'full_name', ''), ' ', 1) end,
      'phone', case when p_full then (select c.phone from public.order_contacts c where c.order_id = o.id) end,
      'address', case when p_full then o.address end,
      'notes', case when p_full then o.notes end,
      'lat', o.delivery_lat,
      'lng', o.delivery_lng),
    'to_kitchen_km', case when p_lat is not null and cl.latitude is not null
                          then round(public.km_between(p_lat, p_lng, cl.latitude, cl.longitude)::numeric, 1) end,
    'trip_km', case when cl.latitude is not null and o.delivery_lat is not null
                    then round(public.km_between(cl.latitude, cl.longitude, o.delivery_lat, o.delivery_lng)::numeric, 1) end)
  from public.kitchen_chefs k
  left join public.chef_locations cl on cl.chef_id = k.id::text
  left join auth.users u on u.id = o.user_id
  where k.id::text = o.chef_id;
$$;

-- Earnings: only orders from before prepaying still have cash to hand over.
create or replace function public.rider_stats(p_days integer default 7)
returns jsonb language sql stable security definer set search_path = '' as $$
  with me as (select id, balance from public.riders where user_id = auth.uid()),
  done as (
    select o.*, public.rider_delivery_pay() + o.tip as pay,
      case when o.rider_prepaid is null then o.total - (public.rider_delivery_pay() + o.tip) else 0 end as owed
    from public.orders o, me
    where o.rider_id = me.id and o.status = 'delivered'
      and o.delivered_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90)))
  ),
  today as (
    select * from done
    where (delivered_at at time zone 'Africa/Cairo')::date = (now() at time zone 'Africa/Cairo')::date
  )
  select jsonb_build_object(
    'balance', (select balance from me),
    'deliveries', (select count(*) from done),
    'cash', (select coalesce(sum(total), 0) from done),
    'delivery_fees', (select coalesce(sum(delivery_fee), 0) from done),
    'earnings', (select coalesce(sum(pay), 0) from done),
    'tips', (select coalesce(sum(tip), 0) from done),
    'prepaid', (select coalesce(sum(rider_prepaid), 0) from done),
    'hand_over', (select coalesce(sum(owed), 0) from done),
    'today_deliveries', (select count(*) from today),
    'today_cash', (select coalesce(sum(total), 0) from today),
    'today_earnings', (select coalesce(sum(pay), 0) from today),
    'today_prepaid', (select coalesce(sum(rider_prepaid), 0) from today),
    'today_hand_over', (select coalesce(sum(owed), 0) from today),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'deliveries', n, 'cash', c, 'earnings', e) order by d), '[]'::jsonb)
               from (select (delivered_at at time zone 'Africa/Cairo')::date as d, count(*) as n, sum(total) as c, sum(pay) as e
                     from done group by 1) x));
$$;
