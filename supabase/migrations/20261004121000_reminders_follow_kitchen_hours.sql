-- Reminders only go out while kitchens are open (10:00 - 21:00 Cairo time).
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
             where l.user_id = dv.user_id and l.kind = 'cart') as last_cart_at
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
