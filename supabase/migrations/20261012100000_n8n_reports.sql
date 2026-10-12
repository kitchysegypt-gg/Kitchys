-- Reports for the Kitchy's n8n workflows (daily report, live alerts, weekly payouts, social posts).
-- n8n calls this through the public REST endpoint with the anon key; the function only answers
-- when it gets the secret stored in Vault as 'n8n_secret' (created outside this file).
-- Money rules: chef gets 85% of food (88% while Premium), rider gets EGP 30 a delivery plus tips,
-- Kitchy's keeps the commission, service fee, delivery fee and Premium fees and covers discounts,
-- credit and free deliveries.

create or replace function public.n8n_report(p_secret text, p_kind text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_from timestamptz;
  v_to timestamptz;
  v_result jsonb;
begin
  if p_secret is null or p_secret <> coalesce(public.app_secret('n8n_secret'), '') or length(p_secret) < 24 then
    raise exception 'Not allowed';
  end if;

  if p_kind = 'daily' then
    v_from := v_today::timestamp at time zone 'Africa/Cairo';
    v_to := v_from + interval '1 day';
    with o as (
      select * from public.orders where created_at >= v_from and created_at < v_to
    ), ok as (select * from o where status <> 'cancelled'),
    d as (
      select * from public.orders
      where status = 'delivered' and coalesce(delivered_at, created_at) >= v_from and coalesce(delivered_at, created_at) < v_to
    ),
    items as (
      select item->>'name' as name, sum((item->>'quantity')::int) as qty
      from ok, jsonb_array_elements(ok.items) item group by 1 order by 2 desc limit 5
    ),
    rv as (select * from public.chef_reviews where created_at >= v_from and created_at < v_to)
    select jsonb_build_object(
      'date', v_today,
      'orders', (select count(*) from o),
      'orders_ok', (select count(*) from ok),
      'cancelled', (select count(*) from o where status = 'cancelled'),
      'cancelled_by_chef', (select count(*) from o where status = 'cancelled' and cancelled_by = 'chef'),
      'cancelled_by_customer', (select count(*) from o where status = 'cancelled' and cancelled_by = 'customer'),
      'open_now', (select count(*) from public.orders where status in ('placed', 'cooking', 'ready', 'on_the_way')),
      'food_sales', (select coalesce(sum(subtotal), 0) from ok),
      'average_order', (select coalesce(round(avg(total)), 0) from ok),
      'commission', (select coalesce(sum(round(subtotal * commission_rate)), 0) from ok),
      'service_fees', (select coalesce(sum(service_fee), 0) from ok),
      'delivery_fees', (select coalesce(sum(delivery_fee), 0) from ok),
      'membership_fees', (select coalesce(sum(membership_fee), 0) from ok),
      'discounts', (select coalesce(sum(discount), 0) from ok),
      'credit_used', (select coalesce(sum(credit_used), 0) from ok),
      'tips', (select coalesce(sum(tip), 0) from ok),
      'deliveries', (select count(*) from d where rider_id is not null),
      'rider_pay', (select coalesce(sum(public.rider_delivery_pay() + tip), 0) from d where rider_id is not null),
      'kitchys_net', (select coalesce(sum(round(subtotal * commission_rate) + service_fee + delivery_fee + membership_fee - discount - credit_used), 0) from ok)
                     - (select count(*) * public.rider_delivery_pay() from d where rider_id is not null),
      'new_customers', (select count(*) from auth.users where created_at >= v_from and created_at < v_to),
      'first_orders', (select count(*) from ok where not exists (
                         select 1 from public.orders p where p.user_id = ok.user_id and p.created_at < ok.created_at and p.status <> 'cancelled')),
      'new_chef_applications', (select count(*) from public.chef_applications where created_at >= v_from and created_at < v_to),
      'new_rider_applications', (select count(*) from public.rider_applications where created_at >= v_from and created_at < v_to),
      'riders_online', (select count(*) from public.riders where online),
      'customer_premium_members', (select count(*) from public.customer_premium where period_end > now()),
      'chef_premium_kitchens', (select count(*) from public.chef_premium where period_end > now()),
      'top_dishes', (select coalesce(jsonb_agg(jsonb_build_object('name', name, 'portions', qty)), '[]'::jsonb) from items),
      'reviews', (select count(*) from rv),
      'average_rating', (select round(avg((food + delivery + packaging + value) / 4.0)::numeric, 2) from rv),
      'low_reviews', (select coalesce(jsonb_agg(jsonb_build_object(
                        'kitchen', k.name, 'by', r.reviewer_name, 'comment', r.comment,
                        'food', r.food, 'delivery', r.delivery, 'packaging', r.packaging, 'value', r.value)), '[]'::jsonb)
                      from rv r left join public.kitchen_chefs k on k.id::text = r.chef_id
                      where least(r.food, r.delivery, r.packaging, r.value) <= 2)
    ) into v_result;
    return v_result;
  end if;

  if p_kind = 'alerts' then
    -- Each alert covers a 10-minute window, so a workflow running every 10 minutes reports it once.
    select jsonb_build_object(
      'ready_no_rider', (select coalesce(jsonb_agg(jsonb_build_object(
          'order', upper(left(o.id::text, 6)), 'kitchen', k.name, 'area', k.area,
          'waiting_minutes', floor(extract(epoch from now() - o.ready_at) / 60), 'cash', o.total)), '[]'::jsonb)
        from public.orders o left join public.kitchen_chefs k on k.id::text = o.chef_id
        where o.status = 'ready' and o.rider_id is null
          and o.ready_at < now() - interval '10 minutes' and o.ready_at >= now() - interval '20 minutes'),
      'not_accepted', (select coalesce(jsonb_agg(jsonb_build_object(
          'order', upper(left(o.id::text, 6)), 'kitchen', k.name, 'area', k.area,
          'waiting_minutes', floor(extract(epoch from now() - o.created_at) / 60))), '[]'::jsonb)
        from public.orders o left join public.kitchen_chefs k on k.id::text = o.chef_id
        where o.status = 'placed' and o.accepted_at is null and o.scheduled_for is null
          and o.created_at < now() - interval '15 minutes' and o.created_at >= now() - interval '25 minutes'),
      'low_reviews', (select coalesce(jsonb_agg(jsonb_build_object(
          'kitchen', k.name, 'by', r.reviewer_name, 'comment', r.comment,
          'food', r.food, 'delivery', r.delivery, 'packaging', r.packaging, 'value', r.value)), '[]'::jsonb)
        from public.chef_reviews r left join public.kitchen_chefs k on k.id::text = r.chef_id
        where r.created_at >= now() - interval '10 minutes' and least(r.food, r.delivery, r.packaging, r.value) <= 2),
      'care_waiting', (select coalesce(jsonb_agg(jsonb_build_object(
          'kitchen', k.name, 'appliance', c.appliance, 'problem', c.problem)), '[]'::jsonb)
        from public.care_requests c left join public.kitchen_chefs k on k.id::text = c.chef_id
        where c.status = 'open' and c.created_at < now() - interval '48 hours'
          and c.created_at >= now() - interval '48 hours 10 minutes'),
      'applications_waiting', (
        select coalesce(jsonb_agg(a), '[]'::jsonb) from (
          select jsonb_build_object('type', 'chef', 'name', full_name, 'area', area) as a
          from public.chef_applications
          where status = 'pending' and created_at < now() - interval '24 hours'
            and created_at >= now() - interval '24 hours 10 minutes'
          union all
          select jsonb_build_object('type', 'rider', 'name', full_name, 'area', area)
          from public.rider_applications
          where status = 'pending' and created_at < now() - interval '24 hours'
            and created_at >= now() - interval '24 hours 10 minutes'
        ) x)
    ) into v_result;
    return v_result;
  end if;

  if p_kind = 'weekly' then
    -- The last 7 full days, ending yesterday (Cairo time).
    v_to := v_today::timestamp at time zone 'Africa/Cairo';
    v_from := v_to - interval '7 days';
    with d as (
      select * from public.orders
      where status = 'delivered' and coalesce(delivered_at, created_at) >= v_from and coalesce(delivered_at, created_at) < v_to
    ),
    chefs as (
      select k.id::text as chef_id, k.name, k.area,
             (select a.phone from public.chef_applications a where a.user_id = k.user_id order by a.created_at desc limit 1) as phone,
             count(d.id) as orders,
             coalesce(sum(d.subtotal), 0) as food_sales,
             coalesce(sum(round(d.subtotal * d.commission_rate)), 0) as commission,
             (select coalesce(sum(c.amount), 0) from public.chef_charges c
               where c.chef_id::text = k.id::text and c.created_at >= v_from and c.created_at < v_to) as charges
      from public.kitchen_chefs k left join d on d.chef_id = k.id::text
      group by k.id, k.name, k.area, k.user_id
    ),
    riders as (
      select r.id, r.name, r.phone, r.plate_number,
             count(d.id) as deliveries,
             coalesce(sum(d.tip), 0) as tips,
             count(d.id) * public.rider_delivery_pay() + coalesce(sum(d.tip), 0) as pay,
             coalesce(sum(d.total), 0) as cash_collected
      from public.riders r left join d on d.rider_id = r.id
      group by r.id, r.name, r.phone, r.plate_number
    ),
    needs_help as (
      select k.name, k.area,
             (select count(*) from public.kitchen_dishes x where x.chef_id::text = k.id::text and x.available) as dishes_on,
             (select count(*) from public.kitchen_dishes x where x.chef_id::text = k.id::text and x.available
                and coalesce(array_length(x.photo_urls, 1), 0) = 0 and x.photo_url is null) as dishes_without_photos,
             (select count(*) from public.orders o where o.chef_id = k.id::text and o.status <> 'cancelled'
                and o.created_at > now() - interval '14 days') as orders_14d,
             coalesce((select h.paused from public.chef_hours h where h.chef_id::text = k.id::text), false) as paused
      from public.kitchen_chefs k
    )
    select jsonb_build_object(
      'from', (v_from at time zone 'Africa/Cairo')::date,
      'to', ((v_to at time zone 'Africa/Cairo')::date - 1),
      'chefs', (select coalesce(jsonb_agg(jsonb_build_object(
                  'name', name, 'area', area, 'phone', phone, 'orders', orders, 'food_sales', food_sales,
                  'commission', commission, 'share', food_sales - commission, 'charges', charges,
                  'to_pay', food_sales - commission - charges) order by food_sales desc), '[]'::jsonb)
                from chefs where orders > 0 or charges > 0),
      'riders', (select coalesce(jsonb_agg(jsonb_build_object(
                   'name', name, 'phone', phone, 'plate', plate_number, 'deliveries', deliveries, 'tips', tips,
                   'pay', pay, 'cash_collected', cash_collected, 'hand_over', cash_collected - pay) order by deliveries desc), '[]'::jsonb)
                 from riders where deliveries > 0),
      'totals', jsonb_build_object(
        'orders', (select count(*) from d),
        'food_sales', (select coalesce(sum(subtotal), 0) from d),
        'chef_payouts', (select coalesce(sum(food_sales - commission - charges), 0) from chefs),
        'rider_payouts', (select coalesce(sum(pay), 0) from riders),
        'cash_collected', (select coalesce(sum(cash_collected), 0) from riders),
        'commission', (select coalesce(sum(commission), 0) from chefs),
        'service_fees', (select coalesce(sum(service_fee), 0) from d),
        'premium_fees_chefs', (select coalesce(sum(charges), 0) from chefs),
        'premium_fees_customers', (select coalesce(sum(membership_fee), 0) from d)),
      'kitchens_needing_help', (select coalesce(jsonb_agg(jsonb_build_object(
          'name', name, 'area', area, 'dishes_on', dishes_on, 'dishes_without_photos', dishes_without_photos,
          'orders_14d', orders_14d, 'paused', paused)), '[]'::jsonb)
        from needs_help where dishes_on = 0 or dishes_without_photos > 0 or orders_14d = 0 or paused)
    ) into v_result;
    return v_result;
  end if;

  if p_kind = 'social' then
    with week as (
      select item->>'dishId' as dish_id, sum((item->>'quantity')::int) as portions
      from public.orders o, jsonb_array_elements(o.items) item
      where o.status <> 'cancelled' and o.created_at > now() - interval '7 days'
      group by 1
    )
    select jsonb_build_object(
      'top_dishes', (select coalesce(jsonb_agg(t), '[]'::jsonb) from (
        select jsonb_build_object(
          'dish', x.name, 'description', left(x.description, 240), 'price', x.price,
          'photo', coalesce(x.photo_urls[1], x.photo_url), 'kitchen', k.name, 'area', k.area,
          'portions_this_week', coalesce(w.portions, 0)) as t
        from public.kitchen_dishes x
        join public.kitchen_chefs k on k.id::text = x.chef_id::text
        left join week w on w.dish_id = x.id::text
        where x.available and coalesce(x.photo_urls[1], x.photo_url) is not null
        order by coalesce(w.portions, 0) desc, x.created_at desc
        limit 5) s),
      'best_review', (select jsonb_build_object('comment', r.comment, 'by', r.reviewer_name, 'kitchen', k.name)
        from public.chef_reviews r left join public.kitchen_chefs k on k.id::text = r.chef_id
        where r.created_at > now() - interval '14 days' and coalesce(btrim(r.comment), '') <> ''
          and least(r.food, r.delivery, r.packaging, r.value) >= 4
        order by r.created_at desc limit 1),
      'kitchens', (select count(*) from public.kitchen_chefs)
    ) into v_result;
    return v_result;
  end if;

  raise exception 'Unknown report %', p_kind;
end;
$$;

revoke execute on function public.n8n_report(text, text) from public;
grant execute on function public.n8n_report(text, text) to anon, authenticated;
