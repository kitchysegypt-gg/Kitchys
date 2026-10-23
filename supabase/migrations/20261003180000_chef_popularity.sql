-- How many orders each chef received in the last 30 days, for the "Popular" tag.
-- Only totals per chef come back; nobody can see who ordered.
create or replace function public.chef_popularity()
returns table (chef_id text, recent_orders integer)
language sql
stable
security definer
set search_path = ''
as $$
  select c.chef_id, count(distinct o.id)::integer
  from public.orders o
  cross join lateral jsonb_array_elements(o.items) as item
  join (
    select id, chef_id from public.dish_prices
    union all
    select id::text, chef_id::text from public.kitchen_dishes
  ) c on c.id = item->>'dishId'
  where o.status <> 'cancelled' and o.created_at > now() - interval '30 days'
  group by c.chef_id;
$$;

revoke execute on function public.chef_popularity() from public, anon;
grant execute on function public.chef_popularity() to authenticated;
