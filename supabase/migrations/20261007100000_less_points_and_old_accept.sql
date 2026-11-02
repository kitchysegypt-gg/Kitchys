-- 1. Points are less generous: 1 point per EGP 20 (was 10), smaller rank bonuses (max x1.5, was x2).
do $$
declare
  d text;
begin
  d := pg_get_functiondef('public.apply_order_pricing()'::regprocedure);
  d := replace(d, '(new.subtotal - new.discount) / 10 *', '(new.subtotal - new.discount) / 20 *');
  execute d;

  d := pg_get_functiondef('public.loyalty_multiplier(integer)'::regprocedure);
  d := replace(d, 'array[1, 1.1, 1.25, 1.5, 1.75, 2]', 'array[1, 1.05, 1.1, 1.2, 1.3, 1.5]');
  execute d;
end $$;

-- 2. Older app versions only have "Accept & start cooking". For an order scheduled on a later
--    day, treat that tap as "accept" instead of refusing it; cooking unlocks on the delivery day.
create or replace function public.chef_set_order_status(p_order uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chef text := public.my_chef_id();
  v_order public.orders%rowtype;
  v_today date := (now() at time zone 'Africa/Cairo')::date;
  v_day date;
begin
  if v_chef is null then
    raise exception 'Only approved home chefs have a kitchen';
  end if;
  select * into v_order from public.orders where id = p_order and chef_id = v_chef for update;
  if v_order.id is null then
    raise exception 'Order not found';
  end if;
  v_day := (v_order.scheduled_for at time zone 'Africa/Cairo')::date;

  if p_status = 'accepted' or (p_status = 'cooking' and v_order.status = 'placed' and v_day > v_today) then
    if v_order.status <> 'placed' then
      raise exception 'Only new orders can be accepted';
    end if;
    update public.orders set accepted_at = coalesce(accepted_at, now()) where id = p_order;
    return;
  end if;

  if not (
    (v_order.status = 'placed' and p_status in ('cooking', 'cancelled'))
    or (v_order.status = 'cooking' and p_status in ('on_the_way', 'cancelled'))
    or (v_order.status = 'on_the_way' and p_status = 'delivered')
  ) then
    raise exception 'This order can''t go from % to %', v_order.status, p_status;
  end if;
  update public.orders
  set status = p_status,
      accepted_at = case when p_status = 'cooking' then coalesce(accepted_at, now()) else accepted_at end
  where id = p_order;
end;
$$;
revoke execute on function public.chef_set_order_status(uuid, text) from public, anon;
grant execute on function public.chef_set_order_status(uuid, text) to authenticated;
