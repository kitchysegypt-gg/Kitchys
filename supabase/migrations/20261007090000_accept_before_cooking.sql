-- Scheduled orders: the chef accepts first, and can only mark "cooking" on the delivery day
-- (Cairo time). "As soon as possible" orders can still go straight to cooking.
alter table public.orders add column if not exists accepted_at timestamptz;

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

  -- 'accepted' is not a status of its own: it marks a new order as accepted.
  if p_status = 'accepted' then
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
  if p_status = 'cooking' and v_day is not null and v_day > v_today then
    raise exception 'You can start cooking on the delivery day (%).', to_char(v_day, 'Dy DD Mon');
  end if;
  update public.orders
  set status = p_status,
      accepted_at = case when p_status = 'cooking' then coalesce(accepted_at, now()) else accepted_at end
  where id = p_order;
end;
$$;
revoke execute on function public.chef_set_order_status(uuid, text) from public, anon;
grant execute on function public.chef_set_order_status(uuid, text) to authenticated;

-- Push notifications: also tell the customer when a scheduled order is accepted.
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

create or replace trigger orders_notify_change
  after insert or update of status, accepted_at on public.orders
  for each row execute function public.notify_order_change();
