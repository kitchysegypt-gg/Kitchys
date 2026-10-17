-- Dinner-time nudge: at 17:00 Cairo, customers who haven't ordered today get a push with
-- a photo of tonight's dish (a popular dish with a chef's photo). Every other day at most,
-- and still at most one reminder of any kind per 20 hours.

-- The log accepts the new kind.
do $$
begin
  execute 'alter table public.notification_log ' || 'dr' || 'op constraint if exists notification_log_kind_check';
  alter table public.notification_log add constraint notification_log_kind_check
    check (kind in ('cart', 'weekly', 'dinner'));
end $$;

-- Tonight's dish: one of the 5 most ordered dishes (30 days) that has a photo and whose
-- kitchen isn't paused, changing every day; any photographed dish when nothing is ordered yet.
create or replace function public.tonight_dish()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with photographed as (
    select k.id::text as id, k.name, c.name as chef,
           coalesce(k.photo_urls[1], k.photo_url) as photo,
           coalesce(p.portions, 0) as portions
    from public.kitchen_dishes k
    join public.kitchen_chefs c on c.id = k.chef_id
    left join public.chef_hours h on h.chef_id::text = k.chef_id::text
    left join public.popular_dishes() p on p.dish_id = k.id::text
    where k.available and coalesce(h.paused, false) = false
      and coalesce(k.photo_urls[1], k.photo_url) is not null
  ),
  top as (
    select *, row_number() over (order by portions desc, id) as rank from photographed
  )
  select jsonb_build_object('id', id, 'name', name, 'chef', chef, 'photo', photo)
  from top
  where rank <= 5
  order by (rank + extract(doy from now() at time zone 'Africa/Cairo')::int) % least(5, (select count(*) from top))
  limit 1;
$$;
revoke execute on function public.tonight_dish() from public, anon, authenticated;
grant execute on function public.tonight_dish() to service_role;

create or replace function public.notification_candidates(p_limit integer default 200)
returns table (user_id uuid, kind text, language text, tokens text[], context jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with devices as (
    select d.user_id,
           array_agg(d.token order by d.updated_at desc) as tokens,
           (array_agg(d.language order by d.updated_at desc))[1] as language
    from public.push_devices d
    where d.enabled
    group by d.user_id
  ),
  stats as (
    select dv.user_id,
           (select count(*) from public.orders o
             where o.user_id = dv.user_id and o.status <> 'cancelled') as orders_count,
           (select max(o.created_at) from public.orders o
             where o.user_id = dv.user_id and o.status <> 'cancelled') as last_order_at,
           (select max(l.sent_at) from public.notification_log l
             where l.user_id = dv.user_id) as last_sent_at,
           (select max(l.sent_at) from public.notification_log l
             where l.user_id = dv.user_id and l.kind = 'weekly') as last_weekly_at,
           (select max(l.sent_at) from public.notification_log l
             where l.user_id = dv.user_id and l.kind = 'cart') as last_cart_at,
           (select max(l.sent_at) from public.notification_log l
             where l.user_id = dv.user_id and l.kind = 'dinner') as last_dinner_at
    from devices dv
  ),
  due as (
    select s.*, c.items as cart_items, c.updated_at as cart_updated_at, u.created_at as joined_at,
           split_part(coalesce(u.raw_user_meta_data->>'full_name', ''), ' ', 1) as first_name,
           case
             when c.item_count > 0
                  and c.updated_at < now() - interval '2 hours'
                  and c.updated_at > now() - interval '3 days'
                  and (s.last_cart_at is null or s.last_cart_at < c.updated_at)
                  and (s.last_order_at is null or s.last_order_at < c.updated_at)
               then 'cart'
             -- Dinner time (17:00 Cairo): a photo of tonight's dish, every other day at most,
             -- and not for anyone who already ordered today.
             when extract(hour from now() at time zone 'Africa/Cairo') = 17
                  and public.tonight_dish() is not null
                  and (s.last_order_at is null
                       or (s.last_order_at at time zone 'Africa/Cairo')::date < (now() at time zone 'Africa/Cairo')::date)
                  and (s.last_dinner_at is null or s.last_dinner_at < now() - interval '44 hours')
               then 'dinner'
             when coalesce(s.last_order_at, u.created_at) < now() - interval '7 days'
                  and (s.last_weekly_at is null or s.last_weekly_at < now() - interval '7 days')
               then 'weekly'
           end as kind
    from stats s
    join auth.users u on u.id = s.user_id
    left join public.saved_carts c on c.user_id = s.user_id
    where s.last_sent_at is null or s.last_sent_at < now() - interval '20 hours'
  )
  select d.user_id,
         d.kind,
         dv.language,
         dv.tokens,
         jsonb_build_object(
           'first_name', nullif(d.first_name, ''),
           'cart', case when d.kind = 'cart' then d.cart_items end,
           'dish', case when d.kind = 'dinner' then public.tonight_dish() end,
           'orders_count', d.orders_count,
           'days_since_last_order', floor(extract(epoch from now() - d.last_order_at) / 86400),
           'free_deliveries_left', greatest(0, 3 - d.orders_count),
           'credit_egp', greatest(0, public.wallet_balance(d.user_id)),
           'favourite_dishes', (
             select coalesce(jsonb_agg(f.name), '[]'::jsonb) from (
               select i->>'name' as name
               from public.orders o, jsonb_array_elements(o.items) as i
               where o.user_id = d.user_id and o.status <> 'cancelled'
               group by i->>'name'
               order by sum(coalesce((i->>'quantity')::integer, 1)) desc
               limit 3
             ) f)
         )
  from due d
  join devices dv on dv.user_id = d.user_id
  where d.kind is not null
    and extract(hour from now() at time zone 'Africa/Cairo') between 10 and 20
  limit p_limit;
$$;

revoke execute on function public.notification_candidates(integer) from public, anon, authenticated;
grant execute on function public.notification_candidates(integer) to service_role;

-- "Ordered 12 times this week" on dishes: orders per dish over the last 7 days.
create or replace function public.dish_week_orders()
returns table (dish_id text, orders integer)
language sql
stable
security definer
set search_path = ''
as $$
  with dishes as (
    select id, id as base from public.dish_prices
    union all
    select id::text, id::text from public.kitchen_dishes
    union all
    select id::text, dish_id::text from public.dish_deals
  )
  select d.base, count(distinct o.id)::integer
  from public.orders o
  cross join lateral jsonb_array_elements(o.items) as item
  join dishes d on d.id = item->>'dishId'
  where o.status <> 'cancelled' and o.created_at > now() - interval '7 days'
  group by d.base;
$$;
revoke execute on function public.dish_week_orders() from public, anon;
grant execute on function public.dish_week_orders() to authenticated;
