-- Kitchy's: dinner-only menu, scheduled delivery, chef reviews, and home-chef applications.

-- 1. Dinner-only menu: drop drinks and breakfast, add dinner dishes, remember each dish's chef.
alter table public.dish_prices add column if not exists chef_id text;

delete from public.dish_prices where id in ('feteer', 'karkade', 'mango', 'taameya', 'lemon-mint');

insert into public.dish_prices (id, price) values
  ('hamam-mahshi', 320), ('roz-moammar', 200), ('shawarma-plate', 190)
on conflict (id) do update set price = excluded.price;

update public.dish_prices set chef_id = case
  when id in ('koshari', 'molokhia', 'mahshi', 'fatta', 'hamam-mahshi') then 'fatma'
  when id in ('sayadeya', 'shrimp', 'lentil-soup', 'calamari') then 'samira'
  when id in ('roz-moammar', 'hawawshi', 'bechamel', 'moussaka') then 'mona'
  when id in ('om-ali', 'basbousa', 'roz-bel-laban', 'konafa') then 'hoda'
  when id in ('salad', 'grilled-chicken', 'kofta', 'shawarma-plate') then 'nour'
end;

-- 2. Home chefs who applied through the app -----------------------------------------
create table if not exists public.chef_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email text,
  full_name text not null check (char_length(full_name) between 2 and 80),
  phone text not null check (char_length(phone) between 6 and 30),
  area text not null check (char_length(area) between 2 and 80),
  specialty text not null check (char_length(specialty) between 2 and 80),
  bio text not null default '' check (char_length(bio) <= 600),
  dishes jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists chef_applications_user_idx on public.chef_applications (user_id, created_at desc);

alter table public.chef_applications enable row level security;

create policy "Applicants can read their own applications"
  on public.chef_applications for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Applicants can submit an application"
  on public.chef_applications for insert to authenticated
  with check ((select auth.uid()) = user_id);

create table if not exists public.kitchen_chefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  application_id uuid references public.chef_applications (id),
  name text not null,
  area text not null,
  specialty text not null,
  bio text not null default '',
  created_at timestamptz not null default now()
);

alter table public.kitchen_chefs enable row level security;

create policy "Everyone signed in can see approved chefs"
  on public.kitchen_chefs for select to authenticated
  using (true);

create table if not exists public.kitchen_dishes (
  id uuid primary key default gen_random_uuid(),
  chef_id uuid not null references public.kitchen_chefs (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 800),
  ingredients text not null default '' check (char_length(ingredients) <= 400),
  allergens text[] not null default '{}'
    check (allergens <@ array['gluten', 'dairy', 'eggs', 'nuts', 'peanuts', 'fish', 'shellfish', 'soy', 'sesame']),
  category text not null default 'main' check (category in ('main', 'baked', 'seafood', 'desserts', 'healthy')),
  price numeric(10, 2) not null check (price > 0 and price <= 5000),
  prep_minutes integer not null default 30 check (prep_minutes between 5 and 240),
  serves integer not null default 1 check (serves between 1 and 12),
  spicy boolean not null default false,
  vegetarian boolean not null default false,
  available boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists kitchen_dishes_chef_idx on public.kitchen_dishes (chef_id);

alter table public.kitchen_dishes enable row level security;

create policy "Customers see available dishes, chefs see all of their own"
  on public.kitchen_dishes for select to authenticated
  using (
    available
    or chef_id in (select id from public.kitchen_chefs where user_id = (select auth.uid()))
  );

create policy "Chefs add dishes to their own kitchen"
  on public.kitchen_dishes for insert to authenticated
  with check (chef_id in (select id from public.kitchen_chefs where user_id = (select auth.uid())));

create policy "Chefs edit their own dishes"
  on public.kitchen_dishes for update to authenticated
  using (chef_id in (select id from public.kitchen_chefs where user_id = (select auth.uid())))
  with check (chef_id in (select id from public.kitchen_chefs where user_id = (select auth.uid())));

create policy "Chefs remove their own dishes"
  on public.kitchen_dishes for delete to authenticated
  using (chef_id in (select id from public.kitchen_chefs where user_id = (select auth.uid())));

-- Applications always start as pending, with the applicant's verified account email.
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
  if jsonb_typeof(new.dishes) <> 'array' or jsonb_array_length(new.dishes) > 15 then
    raise exception 'Add up to 15 dishes';
  end if;
  return new;
end;
$$;

create trigger chef_applications_prepare
  before insert on public.chef_applications
  for each row execute function public.prepare_chef_application();

-- Approve / reject (only the Kitchy's team: service role or the dashboard SQL editor).
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

  insert into public.kitchen_chefs (user_id, application_id, name, area, specialty, bio)
  values (app.user_id, app.id, app.full_name, app.area, app.specialty, app.bio)
  on conflict (user_id) do update set
    application_id = excluded.application_id, name = excluded.name, area = excluded.area,
    specialty = excluded.specialty, bio = excluded.bio
  returning id into new_chef_id;

  for d in select * from jsonb_array_elements(app.dishes) loop
    insert into public.kitchen_dishes
      (chef_id, name, description, ingredients, allergens, category, price, prep_minutes, serves, spicy, vegetarian)
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
      coalesce((d->>'vegetarian')::boolean, false)
    );
  end loop;

  update public.chef_applications set status = 'approved', reviewed_at = now() where id = p_id;
  return new_chef_id;
end;
$$;

create or replace function public.reject_chef_application(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.chef_applications set status = 'rejected', reviewed_at = now()
  where id = p_id and status = 'pending';
$$;

revoke execute on function public.approve_chef_application(uuid) from public, anon, authenticated;
revoke execute on function public.reject_chef_application(uuid) from public, anon, authenticated;
revoke execute on function public.prepare_chef_application() from public, anon, authenticated;

-- 3. Scheduled delivery and pricing for chef dishes --------------------------------
alter table public.orders add column if not exists scheduled_for timestamptz;

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

  select count(*) into previous_orders
  from public.orders
  where user_id = new.user_id and status <> 'cancelled';

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

-- 4. Chef reviews ------------------------------------------------------------------
create table if not exists public.chef_reviews (
  id uuid primary key default gen_random_uuid(),
  chef_id text not null,
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reviewer_name text not null default '',
  food smallint not null check (food between 1 and 5),
  delivery smallint not null check (delivery between 1 and 5),
  packaging smallint not null check (packaging between 1 and 5),
  value smallint not null check (value between 1 and 5),
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  unique (order_id, chef_id)
);

create index if not exists chef_reviews_chef_idx on public.chef_reviews (chef_id, created_at desc);

alter table public.chef_reviews enable row level security;

create policy "Everyone signed in can read reviews"
  on public.chef_reviews for select to authenticated
  using (true);

create policy "Customers review chefs from their own orders"
  on public.chef_reviews for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- A review must come from the customer's own, non-cancelled order that included the chef's food.
create or replace function public.prepare_chef_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.orders%rowtype;
begin
  new.user_id := auth.uid();
  select * into o from public.orders where id = new.order_id and user_id = new.user_id and status <> 'cancelled';
  if not found then
    raise exception 'You can only review your own orders';
  end if;
  if not exists (
    select 1
    from jsonb_array_elements(o.items) as item
    left join public.dish_prices p on p.id = item->>'dishId'
    left join public.kitchen_dishes k on k.id::text = item->>'dishId'
    where coalesce(p.chef_id, k.chef_id::text) = new.chef_id
  ) then
    raise exception 'This order had no food from that chef';
  end if;
  select coalesce(split_part(raw_user_meta_data->>'full_name', ' ', 1), '')
    into new.reviewer_name from auth.users where id = new.user_id;
  return new;
end;
$$;

revoke execute on function public.prepare_chef_review() from public, anon, authenticated;

create trigger chef_reviews_prepare
  before insert on public.chef_reviews
  for each row execute function public.prepare_chef_review();

create or replace view public.chef_ratings
with (security_invoker = true) as
  select
    chef_id,
    count(*)::integer as review_count,
    round(avg(food), 2)::float as food,
    round(avg(delivery), 2)::float as delivery,
    round(avg(packaging), 2)::float as packaging,
    round(avg(value), 2)::float as value,
    round(avg((food + delivery + packaging + value) / 4.0), 2)::float as overall
  from public.chef_reviews
  group by chef_id;
