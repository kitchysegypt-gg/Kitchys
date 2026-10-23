-- The chef's kitchen as its own app: orders linked to their chef, live order status,
-- pausing the kitchen, daily portion limits, review replies, stats and push notifications.

-- 1. Every order remembers its chef -----------------------------------------------------
alter table public.orders add column if not exists chef_id text;
create index if not exists orders_chef_idx on public.orders (chef_id, created_at desc);

-- Fill in chef_id on existing orders from their dishes.
update public.orders o
set chef_id = sub.chef_id
from (
  select o2.id, min(c.chef_id) as chef_id
  from public.orders o2
  cross join lateral jsonb_array_elements(o2.items) as item
  join (
    select id, chef_id from public.dish_prices
    union all
    select id::text, chef_id::text from public.kitchen_dishes
  ) c on c.id = item->>'dishId'
  group by o2.id
) sub
where o.id = sub.id and o.chef_id is null;

-- The signed-in person's kitchen id (null for customers).
create or replace function public.my_chef_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select id::text from public.kitchen_chefs where user_id = auth.uid() limit 1;
$$;
revoke execute on function public.my_chef_id() from public, anon;
grant execute on function public.my_chef_id() to authenticated;

-- Chefs see the orders for their kitchen (to cook and deliver them).
create policy "Chefs read their kitchen's orders" on public.orders
  for select to authenticated using (chef_id is not null and chef_id = (select public.my_chef_id()));

-- 2. Pausing the kitchen and daily portion limits -----------------------------------------
alter table public.chef_hours add column if not exists paused boolean not null default false;
alter table public.kitchen_dishes add column if not exists daily_limit integer
  check (daily_limit is null or daily_limit between 1 and 500);

create or replace function public.set_kitchen_paused(p_paused boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chef text := public.my_chef_id();
begin
  if v_chef is null then
    raise exception 'Only approved home chefs have a kitchen';
  end if;
  insert into public.chef_hours (chef_id, paused) values (v_chef, coalesce(p_paused, false))
  on conflict (chef_id) do update set paused = excluded.paused, updated_at = now();
end;
$$;
revoke execute on function public.set_kitchen_paused(boolean) from public, anon;
grant execute on function public.set_kitchen_paused(boolean) to authenticated;

-- The Cairo day an order is delivered on.
create or replace function public.order_day(p_created timestamptz, p_scheduled timestamptz)
returns date
language sql
immutable
set search_path = ''
as $$
  select (coalesce(p_scheduled, p_created) at time zone 'Africa/Cairo')::date;
$$;

-- Portions already ordered per dish for a day (customers see "only N left").
create or replace function public.dish_portions_ordered(p_day date default null)
returns table (dish_id text, portions integer)
language sql
stable
security definer
set search_path = ''
as $$
  select item->>'dishId', sum((item->>'quantity')::int)::int
  from public.orders o, jsonb_array_elements(o.items) as item
  where o.status <> 'cancelled'
    and public.order_day(o.created_at, o.scheduled_for)
        = coalesce(p_day, (now() at time zone 'Africa/Cairo')::date)
  group by 1;
$$;
grant execute on function public.dish_portions_ordered(date) to anon, authenticated;

-- Every order: the kitchen isn't paused and no dish goes over its daily limit.
create or replace function public.check_order_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := public.order_day(now(), new.scheduled_for);
  r record;
  v_taken integer;
begin
  if new.chef_id is not null
     and exists (select 1 from public.chef_hours h where h.chef_id = new.chef_id and h.paused) then
    raise exception 'This kitchen is not taking orders right now. Please try again later.';
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
revoke execute on function public.check_order_limits() from public, anon, authenticated;

-- check_order_chef now also stores the chef on the order (runs before check_order_limits,
-- since triggers run in name order).
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
  new.chef_id := chef_ids[1];

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

create or replace trigger orders_check_limits
  before insert on public.orders
  for each row execute function public.check_order_limits();

-- 3. Chefs move their orders along ------------------------------------------------------
-- placed -> cooking (accepted) -> on_the_way -> delivered; placed/cooking -> cancelled (declined).
create or replace function public.chef_set_order_status(p_order uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chef text := public.my_chef_id();
  v_old text;
begin
  if v_chef is null then
    raise exception 'Only approved home chefs have a kitchen';
  end if;
  select status into v_old from public.orders where id = p_order and chef_id = v_chef for update;
  if v_old is null then
    raise exception 'Order not found';
  end if;
  if not (
    (v_old = 'placed' and p_status in ('cooking', 'cancelled'))
    or (v_old = 'cooking' and p_status in ('on_the_way', 'cancelled'))
    or (v_old = 'on_the_way' and p_status = 'delivered')
  ) then
    raise exception 'This order can''t go from % to %', v_old, p_status;
  end if;
  update public.orders set status = p_status where id = p_order;
end;
$$;
revoke execute on function public.chef_set_order_status(uuid, text) from public, anon;
grant execute on function public.chef_set_order_status(uuid, text) to authenticated;

-- 4. Review replies ---------------------------------------------------------------------
alter table public.chef_reviews add column if not exists chef_reply text
  check (chef_reply is null or char_length(chef_reply) between 1 and 500);
alter table public.chef_reviews add column if not exists replied_at timestamptz;

create or replace function public.reply_to_review(p_review uuid, p_reply text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chef text := public.my_chef_id();
  v_text text := nullif(btrim(p_reply), '');
begin
  if v_chef is null then
    raise exception 'Only approved home chefs have a kitchen';
  end if;
  update public.chef_reviews
  set chef_reply = v_text, replied_at = case when v_text is null then null else now() end
  where id = p_review and chef_id = v_chef;
  if not found then
    raise exception 'Review not found';
  end if;
end;
$$;
revoke execute on function public.reply_to_review(uuid, text) from public, anon;
grant execute on function public.reply_to_review(uuid, text) to authenticated;

-- 5. Stats for the chef's dashboard (and the weekly email) -------------------------------
create or replace function public.kitchen_stats(p_chef text, p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with o as (
    select o.*, public.order_day(o.created_at, o.scheduled_for) as day,
           extract(hour from coalesce(o.scheduled_for, o.created_at) at time zone 'Africa/Cairo')::int as hour
    from public.orders o
    where o.chef_id = p_chef and o.status <> 'cancelled'
  ),
  today as (select (now() at time zone 'Africa/Cairo')::date as d),
  win as (select * from o where day > (select d from today) - greatest(1, least(p_days, 365))
                              and day <= (select d from today)),
  prev as (select * from o where day > (select d from today) - 2 * greatest(1, least(p_days, 365))
                               and day <= (select d from today) - greatest(1, least(p_days, 365))),
  items as (
    select item->>'dishId' as dish_id, item->>'name' as name,
           (item->>'quantity')::int as qty, (item->>'price')::numeric * (item->>'quantity')::int as sales
    from win, jsonb_array_elements(win.items) as item
  ),
  reviews as (select * from public.chef_reviews where chef_id = p_chef)
  select jsonb_build_object(
    'days', greatest(1, least(p_days, 365)),
    'today', jsonb_build_object(
      'orders', (select count(*) from o where day = (select d from today)),
      'sales', (select coalesce(sum(subtotal), 0) from o where day = (select d from today)),
      'open', (select count(*) from public.orders x where x.chef_id = p_chef and x.status in ('placed', 'cooking', 'on_the_way'))
    ),
    'orders', (select count(*) from win),
    'sales', (select coalesce(sum(subtotal), 0) from win),
    'prev_orders', (select count(*) from prev),
    'prev_sales', (select coalesce(sum(subtotal), 0) from prev),
    'average_order', (select coalesce(round(avg(subtotal)), 0) from win),
    'customers', (select count(distinct user_id) from win),
    'repeat_customers', (select count(*) from (select user_id from win group by user_id having count(*) > 1) r),
    'cancelled', (select count(*) from public.orders x where x.chef_id = p_chef and x.status = 'cancelled'
                    and public.order_day(x.created_at, x.scheduled_for) > (select d from today) - greatest(1, least(p_days, 365))),
    'by_day', (
      select coalesce(jsonb_agg(jsonb_build_object('day', g.day, 'orders', coalesce(w.n, 0), 'sales', coalesce(w.s, 0)) order by g.day), '[]')
      from generate_series((select d from today) - (greatest(1, least(p_days, 365)) - 1), (select d from today), interval '1 day') as g0(day)
      cross join lateral (select g0.day::date as day) g
      left join (select day, count(*) n, sum(subtotal) s from win group by day) w on w.day = g.day
    ),
    'by_weekday', (
      select coalesce(jsonb_agg(jsonb_build_object('weekday', wd, 'orders', coalesce(n, 0)) order by wd), '[]')
      from generate_series(0, 6) wd
      left join (select extract(dow from day)::int d, count(*) n from win group by 1) x on x.d = wd
    ),
    'by_hour', (
      select coalesce(jsonb_agg(jsonb_build_object('hour', hour, 'orders', n) order by hour), '[]')
      from (select hour, count(*) n from win group by hour) h
    ),
    'top_dishes', (
      select coalesce(jsonb_agg(t order by t.qty desc), '[]')
      from (select dish_id, max(name) as name, sum(qty)::int as qty, sum(sales) as sales
            from items group by dish_id order by sum(qty) desc limit 5) t
    ),
    'rating', (
      select jsonb_build_object(
        'count', count(*),
        'overall', round(avg((food + delivery + packaging + value) / 4.0)::numeric, 2),
        'food', round(avg(food)::numeric, 2),
        'delivery', round(avg(delivery)::numeric, 2),
        'packaging', round(avg(packaging)::numeric, 2),
        'value', round(avg(value)::numeric, 2),
        'recent', round((avg((food + delivery + packaging + value) / 4.0)
                   filter (where created_at > now() - make_interval(days => greatest(1, least(p_days, 365)))))::numeric, 2),
        'unanswered', count(*) filter (where chef_reply is null and comment is not null and btrim(comment) <> '')
      ) from reviews
    )
  );
$$;
revoke execute on function public.kitchen_stats(text, integer) from public, anon, authenticated;

-- The signed-in chef's own stats.
create or replace function public.my_kitchen_stats(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_chef text := public.my_chef_id();
begin
  if v_chef is null then
    raise exception 'Only approved home chefs have a kitchen';
  end if;
  return public.kitchen_stats(v_chef, p_days);
end;
$$;
revoke execute on function public.my_kitchen_stats(integer) from public, anon;
grant execute on function public.my_kitchen_stats(integer) to authenticated;

-- 6. Push notifications: new orders to the chef, status changes to the customer ----------
create or replace function public.send_push(p_user uuid, p_title text, p_body text, p_url text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_messages jsonb;
begin
  select jsonb_agg(jsonb_build_object(
    'to', d.token, 'title', p_title, 'body', p_body, 'sound', 'default',
    'priority', 'high', 'channelId', 'reminders', 'data', jsonb_build_object('url', p_url)))
  into v_messages
  from public.push_devices d
  where d.user_id = p_user and d.enabled;
  if v_messages is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := v_messages,
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
exception when others then
  -- A failed notification never blocks an order.
  raise warning 'push failed: %', sqlerrm;
end;
$$;
revoke execute on function public.send_push(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.notify_order_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chef_user uuid;
  v_count integer;
begin
  if tg_op = 'INSERT' then
    select k.user_id into v_chef_user from public.kitchen_chefs k where k.id::text = new.chef_id;
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
  elsif new.status is distinct from old.status then
    perform public.send_push(
      new.user_id,
      case new.status
        when 'cooking' then 'Your chef is cooking 👩‍🍳'
        when 'on_the_way' then 'Your food is on the way 🛵'
        when 'delivered' then 'Delivered! Enjoy your meal 😋'
        when 'cancelled' then 'Your order was cancelled'
        else 'Order update' end,
      case new.status
        when 'cooking' then 'The chef accepted your order and started cooking.'
        when 'on_the_way' then 'It will be with you soon.'
        when 'delivered' then 'Tell the chef how it was: leave a review.'
        when 'cancelled' then 'The kitchen couldn''t take this order. Any credit you used was returned.'
        else 'Open the app to see your order.' end,
      '/orders');
  end if;
  return null;
end;
$$;
revoke execute on function public.notify_order_change() from public, anon, authenticated;

create or replace trigger orders_notify_change
  after insert or update of status on public.orders
  for each row execute function public.notify_order_change();

-- 7. Live updates in the app --------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'orders') then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
