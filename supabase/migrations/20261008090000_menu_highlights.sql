-- Home screen highlights: what each kitchen is known for, and what people order most.
-- Deal orders count towards their dish. Cancelled orders are left out.

-- Every kitchen: orders so far and its best-selling dish.
create or replace function public.chef_highlights()
returns table (chef_id text, orders integer, top_dish text)
language sql
stable
security definer
set search_path = ''
as $$
  with dishes as (
    select id, chef_id, id as base from public.dish_prices
    union all
    select id::text, chef_id::text, id::text from public.kitchen_dishes
    union all
    select id::text, chef_id::text, dish_id::text from public.dish_deals
  ),
  lines as (
    select o.id as order_id, d.chef_id, d.base, (item->>'quantity')::int as qty
    from public.orders o
    cross join lateral jsonb_array_elements(o.items) as item
    join dishes d on d.id = item->>'dishId'
    where o.status <> 'cancelled'
  ),
  per_dish as (
    select chef_id, base, sum(qty) as qty,
           row_number() over (partition by chef_id order by sum(qty) desc, base) as rank
    from lines group by chef_id, base
  )
  select l.chef_id, count(distinct l.order_id)::integer, max(p.base) filter (where p.rank = 1)
  from lines l
  left join per_dish p on p.chef_id = l.chef_id and p.rank = 1
  group by l.chef_id;
$$;
revoke execute on function public.chef_highlights() from public, anon;
grant execute on function public.chef_highlights() to authenticated;

-- Dishes by portions ordered in the last 30 days.
create or replace function public.popular_dishes()
returns table (dish_id text, portions integer)
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
  select d.base, sum((item->>'quantity')::int)::integer
  from public.orders o
  cross join lateral jsonb_array_elements(o.items) as item
  join dishes d on d.id = item->>'dishId'
  where o.status <> 'cancelled' and o.created_at > now() - interval '30 days'
  group by d.base
  order by 2 desc
  limit 20;
$$;
revoke execute on function public.popular_dishes() from public, anon;
grant execute on function public.popular_dishes() to authenticated;
