-- How the money of an order is split:
--   food (subtotal)   -> 85% to the chef, 15% Kitchy's commission
--   delivery (EGP 30) -> all of it to the rider, also on free deliveries (Kitchy's pays it then)
--   service fee (20)  -> Kitchy's (packaging)
--   tip               -> all of it to the rider
-- The rider collects the cash, keeps their pay (30 + tip) and hands the rest to Kitchy's.

alter table public.orders add column if not exists tip numeric(10, 2) not null default 0;
alter table public.orders add constraint orders_tip_range check (tip >= 0 and tip <= 500);

-- What a rider earns for one delivery, before tips.
create or replace function public.rider_delivery_pay()
returns numeric
language sql
immutable
set search_path = ''
as $$
  select 30::numeric;
$$;

-- Tip: whole pounds, 0 to 500, added to the total. Kitchy's credit doesn't pay tips,
-- so the rider always gets theirs in cash.
do $$
declare
  v_def text := pg_get_functiondef('public.apply_order_pricing'::regproc);
  v_new text;
begin
  v_new := replace(v_def,
    $old$  new.service_fee := 20;
  new.total := new.subtotal - new.discount + new.delivery_fee + new.service_fee;$old$,
    $new$  new.service_fee := 20;
  new.tip := greatest(0, least(round(coalesce(new.tip, 0)), 500));
  new.total := new.subtotal - new.discount + new.delivery_fee + new.service_fee + new.tip;$new$);
  v_new := replace(v_new,
    $old$new.credit_used := greatest(0, least(balance, new.total));$old$,
    $new$new.credit_used := greatest(0, least(balance, new.total - new.tip));$new$);
  if v_new = v_def or v_new not like '%new.total - new.tip%' or v_new not like '%+ new.tip;%' then
    raise exception 'apply_order_pricing: text to replace not found';
  end if;
  execute v_new;
end;
$$;

-- The rider sees the tip and what they earn on each order.
do $$
declare
  v_def text := pg_get_functiondef('public.rider_order_json(public.orders, boolean, double precision, double precision)'::regprocedure);
  v_new text;
begin
  v_new := replace(v_def,
    $old$'delivery_fee', o.delivery_fee,$old$,
    $new$'delivery_fee', o.delivery_fee,
    'tip', o.tip,
    'pay', public.rider_delivery_pay() + o.tip,$new$);
  if v_new = v_def then
    raise exception 'rider_order_json: text to replace not found';
  end if;
  execute v_new;
end;
$$;

-- Earnings: 30 per delivery plus tips; the rest of the cash goes to Kitchy's.
create or replace function public.rider_stats(p_days integer default 7)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with me as (select id from public.riders where user_id = auth.uid()),
  done as (
    select o.*, public.rider_delivery_pay() + o.tip as pay from public.orders o, me
    where o.rider_id = me.id and o.status = 'delivered'
      and o.delivered_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 90)))
  ),
  today as (
    select * from done
    where (delivered_at at time zone 'Africa/Cairo')::date = (now() at time zone 'Africa/Cairo')::date
  )
  select jsonb_build_object(
    'deliveries', (select count(*) from done),
    'cash', (select coalesce(sum(total), 0) from done),
    'delivery_fees', (select coalesce(sum(delivery_fee), 0) from done),
    'earnings', (select coalesce(sum(pay), 0) from done),
    'tips', (select coalesce(sum(tip), 0) from done),
    'hand_over', (select coalesce(sum(total - pay), 0) from done),
    'today_deliveries', (select count(*) from today),
    'today_cash', (select coalesce(sum(total), 0) from today),
    'today_earnings', (select coalesce(sum(pay), 0) from today),
    'today_hand_over', (select coalesce(sum(total - pay), 0) from today),
    'by_day', (select coalesce(jsonb_agg(jsonb_build_object('day', d, 'deliveries', n, 'cash', c, 'earnings', e) order by d), '[]'::jsonb)
               from (select (delivered_at at time zone 'Africa/Cairo')::date as d, count(*) as n, sum(total) as c, sum(pay) as e
                     from done group by 1) x));
$$;
