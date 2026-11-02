-- Big orders for family gatherings: only kitchens that switch it on. The customer books a few
-- days ahead, pays the full price (no bulk discount) and Kitchy's takes the usual 15%. It is a
-- normal scheduled order (the chef accepts it, a rider delivers it); daily dish limits don't apply.

alter table public.kitchen_chefs
  add column if not exists big_orders boolean not null default false,
  add column if not exists big_min_portions integer not null default 10 check (big_min_portions between 5 and 200),
  add column if not exists big_notice_days integer not null default 2 check (big_notice_days between 1 and 7);

alter table public.orders
  add column if not exists big_order boolean not null default false,
  add column if not exists guests integer check (guests is null or guests between 1 and 500);

create or replace function public.set_big_orders(p_on boolean, p_min integer, p_days integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.kitchen_chefs
     set big_orders = p_on,
         big_min_portions = least(greatest(coalesce(p_min, 10), 5), 200),
         big_notice_days = least(greatest(coalesce(p_days, 2), 1), 7)
   where user_id = auth.uid();
  if not found then
    raise exception 'Kitchen not found';
  end if;
end;
$$;
revoke execute on function public.set_big_orders(boolean, integer, integer) from public, anon;
grant execute on function public.set_big_orders(boolean, integer, integer) to authenticated;

create or replace function public.check_order_limits()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_day date := public.order_day(now(), new.scheduled_for);
  r record;
  v_taken integer;
  v_chef public.kitchen_chefs%rowtype;
  v_portions integer;
begin
  if new.chef_id is not null
     and exists (select 1 from public.chef_hours h where h.chef_id = new.chef_id and h.paused) then
    raise exception 'This kitchen is not taking orders right now. Please try again later.';
  end if;

  if new.big_order then
    select * into v_chef from public.kitchen_chefs where id::text = new.chef_id;
    if v_chef.id is null or not v_chef.big_orders then
      raise exception 'This kitchen does not take big orders.';
    end if;
    if new.scheduled_for is null
       or (new.scheduled_for at time zone 'Africa/Cairo')::date
          < (now() at time zone 'Africa/Cairo')::date + v_chef.big_notice_days then
      raise exception 'Big orders from this kitchen need % days notice. Please pick a later day.', v_chef.big_notice_days;
    end if;
    select coalesce(sum((item->>'quantity')::int), 0) into v_portions from jsonb_array_elements(new.items) as item;
    if v_portions < v_chef.big_min_portions then
      raise exception 'Big orders from this kitchen start at % portions.', v_chef.big_min_portions;
    end if;
    -- The chef cooks it specially, so the everyday portion limits don't count.
    return new;
  end if;

  for r in
    select d.id, d.name, d.daily_limit, sum((item->>'quantity')::int)::int as qty
    from jsonb_array_elements(new.items) as item
    join public.kitchen_dishes d on d.id::text = item->>'dishId'
    where d.daily_limit is not null
    group by d.id, d.name, d.daily_limit
  loop
    select coalesce(sum((item->>'quantity')::int), 0) into v_taken
    from public.orders o, jsonb_array_elements(o.items) as item
    where o.status <> 'cancelled'
      and not o.big_order
      and item->>'dishId' = r.id::text
      and public.order_day(o.created_at, o.scheduled_for) = v_day;
    if v_taken + r.qty > r.daily_limit then
      if v_taken >= r.daily_limit then
        raise exception '% is sold out for that day. Please pick another day or dish.', r.name;
      end if;
      raise exception 'Only % portions of % are left for that day.', r.daily_limit - v_taken, r.name;
    end if;
  end loop;
  return new;
end;
$$;

-- The chef sees which orders are big ones and for how many guests.
create or replace function public.kitchen_orders()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(row order by row->>'created_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', o.id,
      'items', o.items,
      'subtotal', o.subtotal,
      'notes', o.notes,
      'status', o.status,
      'created_at', o.created_at,
      'scheduled_for', o.scheduled_for,
      'accepted_at', o.accepted_at,
      'rider_id', o.rider_id,
      'big_order', o.big_order,
      'guests', o.guests) as row
    from public.orders o
    where o.chef_id is not null and o.chef_id = public.my_chef_id()
    order by o.created_at desc
    limit 100
  ) recent;
$$;
