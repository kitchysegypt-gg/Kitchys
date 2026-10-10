-- Today's deals: a chef sells extra portions of a dish (cooked but not ordered) at a lower
-- price, today only, as soon as possible. Orders use the deal's id as the dish id.
create table if not exists public.dish_deals (
  id uuid primary key default gen_random_uuid(),
  chef_id uuid not null references public.kitchen_chefs (id) on delete cascade,
  dish_id uuid not null references public.kitchen_dishes (id) on delete cascade,
  price numeric(10, 2) not null check (price > 0),
  quantity integer not null check (quantity between 1 and 50),
  sold integer not null default 0 check (sold >= 0),
  expires_at timestamptz not null,
  cancelled boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists dish_deals_open_idx on public.dish_deals (expires_at) where not cancelled;

alter table public.dish_deals enable row level security;
create policy "Signed-in users see deals" on public.dish_deals for select to authenticated using (true);

-- The chef starts a deal: up to their last delivery time today, cheaper than the usual price.
create or replace function public.start_deal(p_dish uuid, p_price numeric, p_quantity integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chef uuid := public.my_chef_id()::uuid;
  v_dish public.kitchen_dishes%rowtype;
  v_ends timestamptz;
  v_id uuid;
begin
  if v_chef is null then
    raise exception 'Only approved home chefs have a kitchen';
  end if;
  select * into v_dish from public.kitchen_dishes where id = p_dish and chef_id = v_chef;
  if v_dish.id is null then
    raise exception 'Dish not found';
  end if;
  if p_price is null or p_price <= 0 or p_price >= v_dish.price then
    raise exception 'The deal price must be lower than the usual price (EGP %).', round(v_dish.price);
  end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 50 then
    raise exception 'Pick between 1 and 50 portions';
  end if;
  v_ends := ((now() at time zone 'Africa/Cairo')::date + public.chef_last_delivery(v_chef::text)) at time zone 'Africa/Cairo';
  if v_ends <= now() then
    raise exception 'Your kitchen is closed for today. Start deals before your last delivery time.';
  end if;
  -- One deal per dish at a time.
  update public.dish_deals set cancelled = true where dish_id = p_dish and not cancelled and expires_at > now();
  insert into public.dish_deals (chef_id, dish_id, price, quantity, expires_at)
  values (v_chef, p_dish, round(p_price), p_quantity, v_ends)
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.start_deal(uuid, numeric, integer) from public, anon;
grant execute on function public.start_deal(uuid, numeric, integer) to authenticated;

create or replace function public.end_deal(p_deal uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.dish_deals set cancelled = true
  where id = p_deal and chef_id = public.my_chef_id()::uuid;
  if not found then
    raise exception 'Deal not found';
  end if;
end;
$$;
revoke execute on function public.end_deal(uuid) from public, anon;
grant execute on function public.end_deal(uuid) to authenticated;

-- Orders: deals are priced at the deal price and belong to the chef, like a dish.
do $$
declare
  d text;
  f text;
begin
  d := pg_get_functiondef('public.apply_order_pricing()'::regprocedure);
  d := replace(d,
    'select id::text, price from public.kitchen_dishes where available',
    'select id::text, price from public.kitchen_dishes where available
    union all
    select id::text, price from public.dish_deals where not cancelled and expires_at > now()');
  execute d;

  foreach f in array array['public.check_order_chef()', 'public.check_order_hours()', 'public.chef_popularity()'] loop
    d := pg_get_functiondef(f::regprocedure);
    d := replace(d,
      'select id::text, chef_id::text from public.kitchen_dishes',
      'select id::text, chef_id::text from public.kitchen_dishes
    union all
    select id::text, chef_id::text from public.dish_deals');
    execute d;
  end loop;
end $$;

-- Every order with deals: today, as soon as possible, and not more than what's left.
create or replace function public.check_order_deals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_sold integer;
  v_quantity integer;
begin
  for r in
    select d.id, k.name, sum((item->>'quantity')::int)::int as qty
    from jsonb_array_elements(new.items) as item
    join public.dish_deals d on d.id::text = item->>'dishId'
    join public.kitchen_dishes k on k.id = d.dish_id
    group by d.id, k.name
  loop
    if new.scheduled_for is not null then
      raise exception 'Deals are for today, delivered as soon as possible. Choose "As soon as possible" or remove the deal.';
    end if;
    select sold, quantity into v_sold, v_quantity from public.dish_deals where id = r.id for update;
    if v_sold + r.qty > v_quantity then
      if v_sold >= v_quantity then
        raise exception 'The % deal is sold out.', r.name;
      end if;
      raise exception 'Only % left in the % deal.', v_quantity - v_sold, r.name;
    end if;
    update public.dish_deals set sold = sold + r.qty where id = r.id;
  end loop;
  return new;
end;
$$;
revoke execute on function public.check_order_deals() from public, anon, authenticated;

create or replace trigger orders_check_deals
  before insert on public.orders
  for each row execute function public.check_order_deals();

-- A cancelled order gives its deal portions back.
create or replace function public.release_order_deals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.dish_deals d
    set sold = greatest(0, d.sold - x.qty)
    from (
      select item->>'dishId' as id, sum((item->>'quantity')::int)::int as qty
      from jsonb_array_elements(new.items) as item group by 1
    ) x
    where d.id::text = x.id;
  end if;
  return null;
end;
$$;
revoke execute on function public.release_order_deals() from public, anon, authenticated;

create or replace trigger orders_release_deals
  after update of status on public.orders
  for each row execute function public.release_order_deals();
