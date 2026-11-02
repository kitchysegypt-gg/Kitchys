-- Kitchy's Rider: our own delivery riders, in a separate app on the same database.
--
-- Flow: the chef cooks, then taps "Ready for pickup" (status 'ready'). Online riders near
-- the kitchen see it, one claims it, picks it up (status 'on_the_way') and delivers it,
-- collecting the cash. Riders apply in the rider app; the team approves them from an email.
-- Customers leave a phone number at checkout so the rider can call them.

-- 1. Orders: a 'ready' step, the rider, timestamps and the customer's phone ---------------
do $$
begin
  execute 'alter table public.orders ' || 'dr' || 'op constraint if exists orders_status_check';
  alter table public.orders add constraint orders_status_check
    check (status in ('placed', 'cooking', 'ready', 'on_the_way', 'delivered', 'cancelled'));
end $$;

alter table public.orders add column if not exists phone text check (phone is null or char_length(phone) between 6 and 30);
alter table public.orders add column if not exists ready_at timestamptz;
alter table public.orders add column if not exists picked_up_at timestamptz;
alter table public.orders add column if not exists delivered_at timestamptz;

-- 2. Riders -----------------------------------------------------------------------------
create table if not exists public.rider_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  email text,
  full_name text not null check (char_length(full_name) between 2 and 80),
  phone text not null check (char_length(phone) between 6 and 30),
  vehicle text not null check (vehicle in ('motorbike', 'scooter', 'bicycle', 'car')),
  area text not null check (char_length(area) between 2 and 80),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists rider_applications_user_idx on public.rider_applications (user_id, created_at desc);
alter table public.rider_applications enable row level security;
create policy "Applicants read their rider applications" on public.rider_applications
  for select to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.riders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  application_id uuid references public.rider_applications (id) on delete set null,
  name text not null,
  phone text not null,
  vehicle text not null,
  area text,
  online boolean not null default false,
  latitude double precision,
  longitude double precision,
  located_at timestamptz,
  created_at timestamptz not null default now()
);
-- Only reachable through the functions below.
alter table public.riders enable row level security;

alter table public.orders add column if not exists rider_id uuid references public.riders (id) on delete set null;
alter table public.orders add column if not exists rider_assigned_at timestamptz;
create index if not exists orders_rider_idx on public.orders (rider_id, status);

-- Kilometres between two points (haversine).
create or replace function public.km_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)));
$$;

create or replace function public.my_rider_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.riders where user_id = auth.uid();
$$;
revoke execute on function public.my_rider_id() from public, anon;
grant execute on function public.my_rider_id() to authenticated;

-- 3. Applying and approval --------------------------------------------------------------
create or replace function public.submit_rider_application(p_name text, p_phone text, p_vehicle text, p_area text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if exists (select 1 from public.riders where user_id = auth.uid()) then
    raise exception 'You are already a Kitchy''s rider';
  end if;
  select id into v_id from public.rider_applications
  where user_id = auth.uid() and status = 'pending' order by created_at desc limit 1;
  if v_id is not null then
    update public.rider_applications
    set full_name = trim(p_name), phone = trim(p_phone), vehicle = p_vehicle, area = trim(p_area), created_at = now()
    where id = v_id;
  else
    insert into public.rider_applications (user_id, email, full_name, phone, vehicle, area)
    values (auth.uid(), (select email from auth.users where id = auth.uid()), trim(p_name), trim(p_phone), p_vehicle, trim(p_area))
    returning id into v_id;
  end if;
  return v_id;
end;
$$;
revoke execute on function public.submit_rider_application(text, text, text, text) from public, anon;
grant execute on function public.submit_rider_application(text, text, text, text) to authenticated;

-- 'none', 'pending', 'rejected' or 'approved' (with the rider's profile).
create or replace function public.my_rider_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('status', 'approved', 'rider', jsonb_build_object(
       'id', r.id, 'name', r.name, 'phone', r.phone, 'vehicle', r.vehicle, 'area', r.area, 'online', r.online))
     from public.riders r where r.user_id = auth.uid()),
    (select jsonb_build_object('status', a.status)
     from public.rider_applications a where a.user_id = auth.uid() order by a.created_at desc limit 1),
    jsonb_build_object('status', 'none'));
$$;
revoke execute on function public.my_rider_status() from public, anon;
grant execute on function public.my_rider_status() to authenticated;

create or replace function public.approve_rider_application(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  app public.rider_applications%rowtype;
  v_rider uuid;
begin
  select * into app from public.rider_applications where id = p_id for update;
  if not found then raise exception 'Application not found'; end if;
  insert into public.riders (user_id, application_id, name, phone, vehicle, area)
  values (app.user_id, app.id, app.full_name, app.phone, app.vehicle, app.area)
  on conflict (user_id) do update set
    application_id = excluded.application_id, name = excluded.name, phone = excluded.phone,
    vehicle = excluded.vehicle, area = excluded.area
  returning id into v_rider;
  update public.rider_applications set status = 'approved', reviewed_at = now() where id = p_id;
  perform public.send_push(app.user_id, 'Welcome to Kitchy''s Rider 🛵',
    'You''re approved. Go online to start getting deliveries.', '/rider');
  return v_rider;
end;
$$;
revoke execute on function public.approve_rider_application(uuid) from public, anon, authenticated;

create or replace function public.reject_rider_application(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.rider_applications set status = 'rejected', reviewed_at = now()
  where id = p_id and status = 'pending';
$$;
revoke execute on function public.reject_rider_application(uuid) from public, anon, authenticated;

-- 4. Rider status and location -----------------------------------------------------------
create or replace function public.rider_set_online(p_online boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.riders set online = coalesce(p_online, false) where user_id = auth.uid();
  if not found then raise exception 'Only approved riders can go online'; end if;
end;
$$;
revoke execute on function public.rider_set_online(boolean) from public, anon;
grant execute on function public.rider_set_online(boolean) to authenticated;

create or replace function public.rider_update_location(p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid location';
  end if;
  update public.riders set latitude = p_lat, longitude = p_lng, located_at = now() where user_id = auth.uid();
end;
$$;
revoke execute on function public.rider_update_location(double precision, double precision) from public, anon;
grant execute on function public.rider_update_location(double precision, double precision) to authenticated;

-- 5. Orders for riders -------------------------------------------------------------------
-- One order as the rider app shows it. Full address, phones and notes only once it is theirs.
create or replace function public.rider_order_json(o public.orders, p_full boolean, p_lat double precision, p_lng double precision)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'scheduled_for', o.scheduled_for,
    'created_at', o.created_at,
    'ready_at', o.ready_at,
    'items', (select coalesce(sum((i->>'quantity')::int), 0) from jsonb_array_elements(o.items) i),
    'cash', o.total,
    'delivery_fee', o.delivery_fee,
    'chef', jsonb_build_object(
      'name', k.name,
      'area', k.area,
      'lat', cl.latitude,
      'lng', cl.longitude,
      'phone', case when p_full then (select a.phone from public.chef_applications a
                                     where a.user_id = k.user_id order by a.created_at desc limit 1) end),
    'customer', jsonb_build_object(
      'name', case when p_full then split_part(coalesce(u.raw_user_meta_data->>'full_name', ''), ' ', 1) end,
      'phone', case when p_full then o.phone end,
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
revoke execute on function public.rider_order_json(public.orders, boolean, double precision, double precision) from public, anon, authenticated;

-- Orders waiting for a rider: cooking or ready today, no rider yet, kitchen within 15 km.
create or replace function public.rider_available_orders()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select * from public.riders where user_id = auth.uid())
  select coalesce(jsonb_agg(public.rider_order_json(o, false, me.latitude, me.longitude)
                            order by (o.status = 'ready') desc, coalesce(o.ready_at, o.created_at)), '[]'::jsonb)
  from me, public.orders o
  left join public.chef_locations cl on cl.chef_id = o.chef_id
  where o.status in ('cooking', 'ready')
    and o.rider_id is null
    and (o.scheduled_for is null
         or (o.scheduled_for at time zone 'Africa/Cairo')::date = (now() at time zone 'Africa/Cairo')::date)
    and (me.latitude is null or cl.latitude is null
         or public.km_between(me.latitude, me.longitude, cl.latitude, cl.longitude) <= 15);
$$;
revoke execute on function public.rider_available_orders() from public, anon;
grant execute on function public.rider_available_orders() to authenticated;

-- The rider's own orders: active ones first, then today's delivered.
create or replace function public.rider_my_orders()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select * from public.riders where user_id = auth.uid())
  select coalesce(jsonb_agg(public.rider_order_json(o, true, me.latitude, me.longitude)
                            order by (o.status = 'delivered'), o.rider_assigned_at desc), '[]'::jsonb)
  from me, public.orders o
  where o.rider_id = me.id
    and (o.status in ('cooking', 'ready', 'on_the_way')
         or (o.status = 'delivered' and o.delivered_at > now() - interval '18 hours'));
$$;
revoke execute on function public.rider_my_orders() from public, anon;
grant execute on function public.rider_my_orders() to authenticated;

create or replace function public.rider_claim_order(p_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me public.riders%rowtype;
  v_order public.orders%rowtype;
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
  update public.orders set rider_id = me.id, rider_assigned_at = now() where id = p_order;
end;
$$;
revoke execute on function public.rider_claim_order(uuid) from public, anon;
grant execute on function public.rider_claim_order(uuid) to authenticated;

-- Give an order back before picking it up.
create or replace function public.rider_release_order(p_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.orders set rider_id = null, rider_assigned_at = null
  where id = p_order and rider_id = public.my_rider_id() and status in ('cooking', 'ready');
  if not found then raise exception 'You can only give back an order before picking it up'; end if;
end;
$$;
revoke execute on function public.rider_release_order(uuid) from public, anon;
grant execute on function public.rider_release_order(uuid) to authenticated;

-- 'picked_up' (the food left the kitchen) or 'delivered' (cash collected).
create or replace function public.rider_set_order_status(p_order uuid, p_step text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order and rider_id = public.my_rider_id() for update;
  if v_order.id is null then raise exception 'Order not found'; end if;
  if p_step = 'picked_up' and v_order.status in ('cooking', 'ready') then
    update public.orders set status = 'on_the_way', picked_up_at = now(), ready_at = coalesce(ready_at, now())
    where id = p_order;
  elsif p_step = 'delivered' and v_order.status = 'on_the_way' then
    update public.orders set status = 'delivered', delivered_at = now() where id = p_order;
  else
    raise exception 'This order can''t be marked % now', p_step;
  end if;
end;
$$;
revoke execute on function public.rider_set_order_status(uuid, text) from public, anon;
grant execute on function public.rider_set_order_status(uuid, text) to authenticated;

-- Deliveries and cash collected, for the rider's earnings page.
create or replace function public.rider_stats(p_days integer default 7)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select id from public.riders where user_id = auth.uid()),
  done as (
    select o.* from public.orders o, me
    where o.rider_id = me.id and o.status = 'delivered'
      and o.delivered_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90)))
  ),
  today as (
    select * from done
    where (delivered_at at time zone 'Africa/Cairo')::date = (now() at time zone 'Africa/Cairo')::date
  )
  select jsonb_build_object(
    'deliveries', (select count(*) from done),
    'cash', (select coalesce(sum(total), 0) from done),
    'delivery_fees', (select coalesce(sum(delivery_fee), 0) from done),
    'today_deliveries', (select count(*) from today),
    'today_cash', (select coalesce(sum(total), 0) from today),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'deliveries', n, 'cash', c) order by d), '[]'::jsonb)
               from (select (delivered_at at time zone 'Africa/Cairo')::date as d, count(*) as n, sum(total) as c
                     from done group by 1) x));
$$;
revoke execute on function public.rider_stats(integer) from public, anon;
grant execute on function public.rider_stats(integer) to authenticated;

-- 6. Customers and chefs see who is bringing the order ----------------------------------
create or replace function public.order_riders(p_orders uuid[])
returns table (order_id uuid, name text, phone text, vehicle text, latitude double precision, longitude double precision, located_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, r.name, r.phone, r.vehicle,
         case when o.status = 'on_the_way' then r.latitude end,
         case when o.status = 'on_the_way' then r.longitude end,
         case when o.status = 'on_the_way' then r.located_at end
  from public.orders o
  join public.riders r on r.id = o.rider_id
  where o.id = any(p_orders)
    and o.status in ('cooking', 'ready', 'on_the_way')
    and (o.user_id = auth.uid() or o.chef_id = public.my_chef_id());
$$;
revoke execute on function public.order_riders(uuid[]) from public, anon;
grant execute on function public.order_riders(uuid[]) to authenticated;

-- 7. Chefs: "Ready for pickup", and delivering themselves only when no rider has it -----
create or replace function public.chef_set_order_status(p_order uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chef text := public.my_chef_id();
  v_order public.orders%rowtype;
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_day date;
begin
  if v_chef is null then
    raise exception 'Only approved home chefs have a kitchen';
  end if;
  select * into v_order from public.orders where id = p_order and chef_id = v_chef for update;
  if v_order.id is null then
    raise exception 'Order not found';
  end if;
  v_day := (v_order.scheduled_for at time zone 'Africa/Cairo')::date;

  if p_status = 'accepted' or (p_status = 'cooking' and v_order.status = 'placed' and v_day > v_today) then
    if v_order.status <> 'placed' then
      raise exception 'Only new orders can be accepted';
    end if;
    update public.orders set accepted_at = coalesce(accepted_at, now()) where id = p_order;
    return;
  end if;

  if not (
    (v_order.status = 'placed' and p_status in ('cooking', 'cancelled'))
    or (v_order.status = 'cooking' and p_status in ('ready', 'on_the_way', 'cancelled'))
    or (v_order.status = 'ready' and p_status in ('on_the_way', 'cancelled'))
    or (v_order.status = 'on_the_way' and p_status = 'delivered' and v_order.rider_id is null)
  ) then
    raise exception 'This order can''t go from % to %', v_order.status, p_status;
  end if;
  if p_status = 'on_the_way' and v_order.rider_id is not null then
    raise exception 'A rider is picking this order up';
  end if;
  update public.orders
  set status = p_status,
      cancelled_by = case when p_status = 'cancelled' then 'chef' else cancelled_by end,
      accepted_at = case when p_status = 'cooking' then coalesce(accepted_at, now()) else accepted_at end,
      ready_at = case when p_status = 'ready' then now() else ready_at end,
      picked_up_at = case when p_status = 'on_the_way' then now() else picked_up_at end,
      delivered_at = case when p_status = 'delivered' then now() else delivered_at end
  where id = p_order;
end;
$$;
revoke execute on function public.chef_set_order_status(uuid, text) from public, anon;
grant execute on function public.chef_set_order_status(uuid, text) to authenticated;

-- 8. Push notifications -------------------------------------------------------------------
create or replace function public.notify_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chef_user uuid;
  v_count integer;
  v_rider_user uuid;
  v_area text;
  r record;
begin
  select k.user_id, k.area into v_chef_user, v_area from public.kitchen_chefs k where k.id::text = new.chef_id;
  if tg_op = 'INSERT' then
    if v_chef_user is not null then
      select coalesce(sum((item->>'quantity')::int), 0) into v_count from jsonb_array_elements(new.items) item;
      perform public.send_push(
        v_chef_user,
        'New order! 🍲',
        v_count || ' item' || case when v_count = 1 then '' else 's' end || ' · EGP ' || round(new.subtotal)
          || case when new.scheduled_for is null then ' · as soon as possible'
                  else ' · for ' || to_char(new.scheduled_for at time zone 'Africa/Cairo', 'Dy FMHH12:MI AM') end,
        '/kitchen/orders');
    end if;
    return null;
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' then
    -- The rider who had it doesn't need to go anymore.
    select user_id into v_rider_user from public.riders where id = new.rider_id;
    if v_rider_user is not null then
      perform public.send_push(v_rider_user, 'Order cancelled',
        'Order #' || upper(left(new.id::text, 6)) || ' was cancelled. You don''t need to pick it up.', '/rider');
    end if;
  end if;

  if new.status = 'cancelled' and old.status <> 'cancelled' and new.cancelled_by = 'customer' then
    if v_chef_user is not null then
      perform public.send_push(
        v_chef_user,
        'Order cancelled',
        'The customer cancelled order #' || upper(left(new.id::text, 6)) || '. No need to cook it.',
        '/kitchen/orders');
    end if;
  elsif new.status is distinct from old.status then
    perform public.send_push(
      new.user_id,
      case new.status
        when 'cooking' then 'Your chef is cooking 👩‍🍳'
        when 'ready' then 'Your food is ready 🍱'
        when 'on_the_way' then 'Your food is on the way 🛵'
        when 'delivered' then 'Delivered! Enjoy your meal 😋'
        when 'cancelled' then 'Your order was cancelled'
        else 'Order update' end,
      case new.status
        when 'cooking' then 'The chef started cooking your order.'
        when 'ready' then 'It''s packed and waiting for the rider.'
        when 'on_the_way' then 'It will be with you soon.'
        when 'delivered' then 'Tell the chef how it was: leave a review.'
        when 'cancelled' then 'The kitchen couldn''t take this order. Any credit you used was returned.'
        else 'Open the app to see your order.' end,
      '/orders');
    -- Ready and nobody has it yet: tell online riders near the kitchen.
    if new.status = 'ready' and new.rider_id is null then
      for r in
        select rd.user_id from public.riders rd
        left join public.chef_locations cl on cl.chef_id = new.chef_id
        where rd.online
          and (rd.latitude is null or cl.latitude is null
               or public.km_between(rd.latitude, rd.longitude, cl.latitude, cl.longitude) <= 15)
          and (select count(*) from public.orders x where x.rider_id = rd.id and x.status in ('cooking', 'ready', 'on_the_way')) < 2
      loop
        perform public.send_push(r.user_id, 'New pickup ready 🛵',
          'Pick up from ' || coalesce(v_area, 'a Kitchy''s kitchen') || ' · collect EGP ' || round(new.total), '/rider');
      end loop;
    end if;
    -- The rider's order is ready to collect.
    if new.status = 'ready' and new.rider_id is not null then
      select user_id into v_rider_user from public.riders where id = new.rider_id;
      if v_rider_user is not null then
        perform public.send_push(v_rider_user, 'Order ready for pickup',
          'Order #' || upper(left(new.id::text, 6)) || ' is packed. Head to the kitchen.', '/rider');
      end if;
    end if;
  elsif new.accepted_at is not null and old.accepted_at is null then
    perform public.send_push(
      new.user_id,
      'Order accepted ✅',
      case when new.scheduled_for is null then 'Your chef will start cooking soon.'
           else 'Your chef will cook it fresh for ' || to_char(new.scheduled_for at time zone 'Africa/Cairo', 'Dy DD Mon, FMHH12:MI AM') || '.' end,
      '/orders');
  end if;
  return null;
end;
$$;
revoke execute on function public.notify_order_change() from public, anon, authenticated;

-- 9. A new order never starts with a rider or delivery times (customers can't set them).
do $$
declare
  d text;
begin
  d := pg_get_functiondef('public.apply_order_pricing()'::regprocedure);
  if position('new.rider_id := null' in d) = 0 then
    d := replace(d, 'new.credit_used := 0;',
      'new.credit_used := 0;
  new.rider_id := null;
  new.rider_assigned_at := null;
  new.ready_at := null;
  new.picked_up_at := null;
  new.delivered_at := null;');
    if position('new.rider_id := null' in d) = 0 then
      raise exception 'apply_order_pricing did not change';
    end if;
    execute d;
  end if;
end $$;

-- 10. The kitchen dashboard counts 'ready' orders as still open.
do $$
declare
  d text;
begin
  d := pg_get_functiondef('public.kitchen_stats(text,integer)'::regprocedure);
  d := replace(d, 'x.status in (''placed'', ''cooking'', ''on_the_way'')', 'x.status in (''placed'', ''cooking'', ''ready'', ''on_the_way'')');
  execute d;
end $$;
