-- Live tracking and private customer phones.
--
-- 1. The customer sees the rider on a map only once the rider is about 5 minutes away
--    (orders.live_at). Before that they see "on the way" and an ETA, never the position.
-- 2. The customer's phone is kept in order_contacts, which chefs can't read, so a chef
--    can't call a customer directly (only the customer and their rider see it).

-- ---------------------------------------------------------------------------
-- Private phone numbers
-- ---------------------------------------------------------------------------

create table if not exists public.order_contacts (
  -- Deferred, so the row can be written while the order itself is being inserted.
  order_id uuid primary key references public.orders (id) on delete cascade deferrable initially deferred,
  user_id uuid not null references auth.users (id) on delete cascade,
  phone text not null check (length(phone) between 8 and 20),
  created_at timestamptz not null default now()
);

alter table public.order_contacts enable row level security;

create policy "Customers read their own order phones"
  on public.order_contacts for select to authenticated
  using (user_id = (select auth.uid()));

create index if not exists order_contacts_user_idx on public.order_contacts (user_id, created_at desc);

-- The phone sent with a new order goes into order_contacts; orders.phone stays empty,
-- so it never reaches the chef (not by a select, and not through Realtime).
create or replace function public.stash_order_phone()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := nullif(regexp_replace(coalesce(new.phone, ''), '[^0-9+]', '', 'g'), '');
begin
  new.phone := null;
  if v_phone is not null and auth.uid() is not null then
    insert into public.order_contacts (order_id, user_id, phone) values (new.id, auth.uid(), left(v_phone, 20));
  end if;
  return new;
end;
$$;

revoke execute on function public.stash_order_phone() from public, anon, authenticated;

-- "zz" so it runs after the other BEFORE INSERT checks (they run in name order).
create trigger orders_zz_stash_phone
  before insert on public.orders
  for each row execute function public.stash_order_phone();

-- Move the phones already saved on orders.
insert into public.order_contacts (order_id, user_id, phone, created_at)
select o.id, o.user_id, left(regexp_replace(o.phone, '[^0-9+]', '', 'g'), 20), o.created_at
from public.orders o
where o.phone is not null and length(regexp_replace(o.phone, '[^0-9+]', '', 'g')) >= 8
on conflict (order_id) do nothing;

update public.orders set phone = null where phone is not null;

-- The phone the customer used last, to fill in checkout.
create or replace function public.my_last_phone()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select c.phone from public.order_contacts c
  where c.user_id = auth.uid()
  order by c.created_at desc
  limit 1;
$$;

revoke execute on function public.my_last_phone() from public, anon;
grant execute on function public.my_last_phone() to authenticated;

-- The rider reads the phone from order_contacts.
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

-- ---------------------------------------------------------------------------
-- Live tracking
-- ---------------------------------------------------------------------------

-- When the rider first came within about 5 minutes of the customer.
alter table public.orders add column if not exists live_at timestamptz;

-- Minutes for a rider to ride from one point to another in the city: straight-line
-- distance x 1.35 for the roads, at 22 km/h, plus a minute to park and ring.
create or replace function public.ride_minutes(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns integer
language sql
immutable
set search_path = ''
as $$
  select ceil(public.km_between(lat1, lng1, lat2, lng2) * 1.35 / 22 * 60)::int + 1;
$$;

-- Customers can't set it themselves when ordering.
create or replace function public.clear_order_live()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.live_at := null;
  return new;
end;
$$;

revoke execute on function public.clear_order_live() from public, anon, authenticated;

create trigger orders_clear_live
  before insert on public.orders
  for each row execute function public.clear_order_live();

-- The rider's position, plus: once they're 5 minutes from a customer, the live map
-- opens for that customer and they get a push.
create or replace function public.rider_update_location(p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rider uuid;
  r record;
begin
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Invalid location';
  end if;
  update public.riders set latitude = p_lat, longitude = p_lng, located_at = now()
  where user_id = auth.uid()
  returning id into v_rider;
  if v_rider is null then
    return;
  end if;

  for r in
    update public.orders o set live_at = now()
    where o.rider_id = v_rider
      and o.status = 'on_the_way'
      and o.live_at is null
      and o.delivery_lat is not null
      and public.ride_minutes(p_lat, p_lng, o.delivery_lat, o.delivery_lng) <= 5
    returning o.id, o.user_id
  loop
    perform public.send_push(r.user_id, 'Your rider is 5 minutes away 🛵',
      'Watch them coming on the map.', '/track/' || r.id);
  end loop;
end;
$$;

-- Who is bringing each order, and how far they are. The position is only sent once the
-- order is live (rider about 5 minutes away). Chefs see the rider but never the position.
drop function if exists public.order_riders(uuid[]);
create function public.order_riders(p_orders uuid[])
returns table (
  order_id uuid,
  name text,
  phone text,
  vehicle text,
  latitude double precision,
  longitude double precision,
  located_at timestamptz,
  eta_minutes integer,
  live boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, r.name, r.phone, r.vehicle,
         case when shown then r.latitude end,
         case when shown then r.longitude end,
         case when shown then r.located_at end,
         case when o.status = 'on_the_way' and fresh and o.delivery_lat is not null
              then public.ride_minutes(r.latitude, r.longitude, o.delivery_lat, o.delivery_lng) end,
         shown
  from public.orders o
  join public.riders r on r.id = o.rider_id
  cross join lateral (
    select r.latitude is not null and r.located_at > now() - interval '15 minutes' as fresh
  ) f
  cross join lateral (
    select o.status = 'on_the_way' and o.user_id = auth.uid() and fresh
           and (o.live_at is not null
                or (o.delivery_lat is not null
                    and public.ride_minutes(r.latitude, r.longitude, o.delivery_lat, o.delivery_lng) <= 5)) as shown
  ) s
  where o.id = any(p_orders)
    and o.status in ('cooking', 'ready', 'on_the_way')
    and (o.user_id = auth.uid() or o.chef_id = public.my_chef_id());
$$;

revoke execute on function public.order_riders(uuid[]) from public, anon;
grant execute on function public.order_riders(uuid[]) to authenticated;

-- "On the way" pushes open the tracking screen.
do $$
declare
  v_def text := pg_get_functiondef('public.notify_order_change'::regproc);
  v_new text;
begin
  v_new := replace(v_def,
    $old$else 'Open the app to see your order.' end,
      '/orders');$old$,
    $new$else 'Open the app to see your order.' end,
      case when new.status = 'on_the_way' then '/track/' || new.id else '/orders' end);$new$);
  if v_new = v_def then
    raise exception 'notify_order_change: text to replace not found';
  end if;
  execute v_new;
end;
$$;
