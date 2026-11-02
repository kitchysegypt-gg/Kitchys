-- Orders come from one chef at a time, and only from chefs near the delivery address.
--
-- Chefs cook at home, so their exact location is private: it lives in `chef_locations`
-- (no read access for anyone), and the app only asks `chefs_near()` which chefs deliver
-- to an address. Home chefs give their kitchen location when they apply.

-- 1. Distance and delivery radius -------------------------------------------------------
create or replace function public.delivery_radius_km()
returns numeric
language sql
immutable
set search_path = ''
as $$ select 15::numeric $$;

-- Straight-line distance between two points on Earth (haversine).
create or replace function public.distance_km(lat1 double precision, lng1 double precision,
                                              lat2 double precision, lng2 double precision)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- A point inside Egypt (roughly), to catch a pin dropped in the wrong place.
create or replace function public.is_in_egypt(lat double precision, lng double precision)
returns boolean
language sql
immutable
set search_path = ''
as $$ select lat between 21.5 and 31.8 and lng between 24.6 and 36.95 $$;

-- 2. Where each chef cooks (private) -----------------------------------------------------
create table if not exists public.chef_locations (
  -- Menu chefs use their text id ('fatma'); home chefs use their kitchen_chefs id.
  chef_id text primary key,
  latitude double precision not null,
  longitude double precision not null,
  updated_at timestamptz not null default now(),
  check (public.is_in_egypt(latitude, longitude))
);

alter table public.chef_locations enable row level security;

insert into public.chef_locations (chef_id, latitude, longitude) values
  ('fatma', 30.0880, 31.2450),   -- Shubra, Cairo
  ('samira', 31.2050, 29.8820),  -- Anfoushi, Alexandria
  ('mona', 30.0560, 31.3300),    -- Nasr City, Cairo
  ('hoda', 30.0910, 31.3220),    -- Heliopolis, Cairo
  ('nour', 29.9600, 31.2570)     -- Maadi, Cairo
on conflict (chef_id) do nothing;

-- Which chefs deliver to this address. Only ids come back, never locations or distances.
create or replace function public.chefs_near(p_lat double precision, p_lng double precision)
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select chef_id from public.chef_locations
  where public.distance_km(p_lat, p_lng, latitude, longitude) <= public.delivery_radius_km();
$$;

revoke execute on function public.chefs_near(double precision, double precision) from public, anon;
grant execute on function public.chefs_near(double precision, double precision) to authenticated;

-- 3. Home chefs give their kitchen location when applying ---------------------------------
alter table public.chef_applications
  add column if not exists kitchen_lat double precision,
  add column if not exists kitchen_lng double precision;

create or replace function public.prepare_chef_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  new.status := 'pending';
  new.reviewed_at := null;
  select email into new.email from auth.users where id = new.user_id;
  if exists (
    select 1 from public.chef_applications
    where user_id = new.user_id and status in ('pending', 'approved')
  ) then
    raise exception 'You already have an application in review or approved';
  end if;
  if new.kitchen_lat is null or new.kitchen_lng is null
     or not public.is_in_egypt(new.kitchen_lat, new.kitchen_lng) then
    raise exception 'Add your kitchen location so we know which customers are near you';
  end if;
  if jsonb_typeof(new.dishes) <> 'array' or jsonb_array_length(new.dishes) > 15 then
    raise exception 'Add up to 15 dishes';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.dishes) as d
    where not public.is_kitchen_photo_url(d->>'photoUrl')
       or (d ? 'portionGrams' and jsonb_typeof(d->'portionGrams') <> 'null'
           and (d->>'portionGrams')::integer not between 10 and 20000)
  ) then
    raise exception 'A dish has an invalid photo or size';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.dishes) as d
    where public.word_count(d->>'description') < 10 or public.word_count(d->>'ingredients') < 3
  ) then
    raise exception 'Each dish needs a description of at least 10 words and at least 3 ingredients';
  end if;
  return new;
end;
$$;

revoke execute on function public.prepare_chef_application() from public, anon, authenticated;

-- Approval also saves the kitchen location.
create or replace function public.approve_chef_application(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  app public.chef_applications%rowtype;
  new_chef_id uuid;
  d jsonb;
begin
  select * into app from public.chef_applications where id = p_id for update;
  if not found then raise exception 'Application not found'; end if;
  if app.status = 'approved' then
    select id into new_chef_id from public.kitchen_chefs where user_id = app.user_id;
    return new_chef_id;
  end if;

  insert into public.kitchen_chefs (user_id, application_id, name, area, specialty, bio, photo_url)
  values (app.user_id, app.id, app.full_name, app.area, app.specialty, app.bio, app.photo_url)
  on conflict (user_id) do update set
    application_id = excluded.application_id, name = excluded.name, area = excluded.area,
    specialty = excluded.specialty, bio = excluded.bio, photo_url = excluded.photo_url
  returning id into new_chef_id;

  if app.kitchen_lat is not null and app.kitchen_lng is not null then
    insert into public.chef_locations (chef_id, latitude, longitude)
    values (new_chef_id::text, app.kitchen_lat, app.kitchen_lng)
    on conflict (chef_id) do update set latitude = excluded.latitude, longitude = excluded.longitude, updated_at = now();
  end if;

  for d in select * from jsonb_array_elements(app.dishes) loop
    insert into public.kitchen_dishes
      (chef_id, name, description, ingredients, allergens, category, price, prep_minutes, serves, spicy, vegetarian,
       photo_url, portion_grams)
    values (
      new_chef_id,
      d->>'name',
      coalesce(d->>'description', ''),
      coalesce(d->>'ingredients', ''),
      coalesce(array(select jsonb_array_elements_text(d->'allergens')), '{}'),
      coalesce(d->>'category', 'main'),
      (d->>'price')::numeric,
      coalesce((d->>'prepMinutes')::integer, 30),
      coalesce((d->>'serves')::integer, 1),
      coalesce((d->>'spicy')::boolean, false),
      coalesce((d->>'vegetarian')::boolean, false),
      d->>'photoUrl',
      (d->>'portionGrams')::integer
    );
  end loop;

  update public.chef_applications set status = 'approved', reviewed_at = now() where id = p_id;
  return new_chef_id;
end;
$$;

revoke execute on function public.approve_chef_application(uuid) from public, anon, authenticated;

-- Approved chefs set or move their kitchen location in My kitchen.
create or replace function public.set_kitchen_location(p_lat double precision, p_lng double precision)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chef uuid;
begin
  select id into v_chef from public.kitchen_chefs where user_id = auth.uid();
  if v_chef is null then
    raise exception 'Only approved home chefs have a kitchen';
  end if;
  if p_lat is null or p_lng is null or not public.is_in_egypt(p_lat, p_lng) then
    raise exception 'Pick a location in Egypt';
  end if;
  insert into public.chef_locations (chef_id, latitude, longitude)
  values (v_chef::text, p_lat, p_lng)
  on conflict (chef_id) do update set latitude = excluded.latitude, longitude = excluded.longitude, updated_at = now();
end;
$$;

-- Whether the signed-in chef has set a kitchen location (their own location only).
create or replace function public.my_kitchen_location()
returns table (latitude double precision, longitude double precision)
language sql
stable
security definer
set search_path = ''
as $$
  select l.latitude, l.longitude
  from public.kitchen_chefs k
  join public.chef_locations l on l.chef_id = k.id::text
  where k.user_id = auth.uid();
$$;

revoke execute on function public.set_kitchen_location(double precision, double precision) from public, anon;
revoke execute on function public.my_kitchen_location() from public, anon;
grant execute on function public.set_kitchen_location(double precision, double precision) to authenticated;
grant execute on function public.my_kitchen_location() to authenticated;

-- 4. Every order: one chef, and that chef delivers to the address -----------------------
create or replace function public.check_order_chef()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  chef_ids text[];
  chef_lat double precision;
  chef_lng double precision;
begin
  select array_agg(distinct c.chef_id) into chef_ids
  from jsonb_array_elements(new.items) as item
  join (
    select id, chef_id from public.dish_prices
    union all
    select id::text, chef_id::text from public.kitchen_dishes
  ) c on c.id = item->>'dishId';

  if coalesce(array_length(chef_ids, 1), 0) > 1 then
    raise exception 'You can order from one chef at a time. Please place a separate order for each chef.';
  end if;
  if chef_ids is null then
    -- Unknown dishes are reported by the pricing check.
    return new;
  end if;

  if new.delivery_lat is null or new.delivery_lng is null then
    raise exception 'Set your delivery location on the map first';
  end if;

  select latitude, longitude into chef_lat, chef_lng from public.chef_locations where chef_id = chef_ids[1];
  if chef_lat is null
     or public.distance_km(new.delivery_lat, new.delivery_lng, chef_lat, chef_lng) > public.delivery_radius_km() then
    raise exception 'This chef is too far from your address to deliver. Chefs deliver within % km.',
      public.delivery_radius_km();
  end if;
  return new;
end;
$$;

revoke execute on function public.check_order_chef() from public, anon, authenticated;

create or replace trigger orders_check_chef
  before insert on public.orders
  for each row execute function public.check_order_chef();
