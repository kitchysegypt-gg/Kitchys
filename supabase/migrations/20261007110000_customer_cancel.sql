-- Customers can cancel their own order until the chef starts cooking it.
alter table public.orders add column if not exists cancelled_by text
  check (cancelled_by is null or cancelled_by in ('customer', 'chef'));

create or replace function public.cancel_my_order(p_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order and user_id = auth.uid() for update;
  if v_order.id is null then
    raise exception 'Order not found';
  end if;
  if v_order.status <> 'placed' then
    raise exception 'The chef already started cooking this order, so it can''t be cancelled.';
  end if;
  update public.orders set status = 'cancelled', cancelled_by = 'customer' where id = p_order;
  -- A reward used on this order can be used again.
  update public.reward_vouchers set status = 'available', order_id = null
  where order_id = p_order and user_id = v_order.user_id and status = 'used';
end;
$$;
revoke execute on function public.cancel_my_order(uuid) from public, anon;
grant execute on function public.cancel_my_order(uuid) to authenticated;

-- A chef declining marks who cancelled, so the right person is told.
do $$
declare
  d text;
begin
  d := pg_get_functiondef('public.chef_set_order_status(uuid, text)'::regprocedure);
  d := replace(d,
    'set status = p_status,',
    'set status = p_status, cancelled_by = case when p_status = ''cancelled'' then ''chef'' else cancelled_by end,');
  execute d;
end $$;

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
  select k.user_id into v_chef_user from public.kitchen_chefs k where k.id::text = new.chef_id;
  if tg_op = 'INSERT' then
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
  elsif new.status = 'cancelled' and old.status <> 'cancelled' and new.cancelled_by = 'customer' then
    if v_chef_user is not null then
      perform public.send_push(
        v_chef_user,
        'Order cancelled',
        'The customer cancelled order #' || upper(left(new.id::text, 6)) || '. No need to cook it.',
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
        when 'cooking' then 'The chef started cooking your order.'
        when 'on_the_way' then 'It will be with you soon.'
        when 'delivered' then 'Tell the chef how it was: leave a review.'
        when 'cancelled' then 'The kitchen couldn''t take this order. Any credit you used was returned.'
        else 'Open the app to see your order.' end,
      '/orders');
  elsif new.accepted_at is not null and old.accepted_at is null then
    perform public.send_push(
      new.user_id,
      'Order accepted ✅',
      case when new.scheduled_for is null then 'Your chef will start cooking soon.'
           else 'Your chef will cook it fresh for ' || to_char(new.scheduled_for at time zone 'Africa/Cairo', 'Dy DD Mon, FMHH12:MI AM') || '.' end,
      '/orders');
  end if;
  return null;
end;
$$;
revoke execute on function public.notify_order_change() from public, anon, authenticated;
