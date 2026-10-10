-- Kitchens only cook; Kitchy's riders do every delivery.
--
-- 1. Chefs can no longer send an order out or mark it delivered themselves:
--    placed -> cooking -> ready (or cancelled). Riders take it from there.
-- 2. Chefs no longer read the orders table directly, so they never see the customer's
--    address or location. kitchen_orders() gives them only what they need to cook.
-- 3. Live updates for the kitchen come from kitchen_order_pings (a "something changed"
--    row per kitchen), since Realtime on orders would carry the address.

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
    or (v_order.status = 'cooking' and p_status in ('ready', 'cancelled'))
    or (v_order.status = 'ready' and p_status = 'cancelled')
  ) then
    raise exception 'This order can''t go from % to %', v_order.status, p_status;
  end if;
  update public.orders
  set status = p_status,
      cancelled_by = case when p_status = 'cancelled' then 'chef' else cancelled_by end,
      accepted_at = case when p_status = 'cooking' then coalesce(accepted_at, now()) else accepted_at end,
      ready_at = case when p_status = 'ready' then now() else ready_at end
  where id = p_order;
end;
$$;

-- The kitchen's orders, without the customer's address, location or phone.
create or replace function public.kitchen_orders()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(row order by row->>'created_at' desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', o.id,
      'items', o.items,
      'subtotal', o.subtotal,
      'notes', o.notes,
      'status', o.status,
      'created_at', o.created_at,
      'scheduled_for', o.scheduled_for,
      'accepted_at', o.accepted_at,
      'rider_id', o.rider_id) as row
    from public.orders o
    where o.chef_id is not null and o.chef_id = public.my_chef_id()
    order by o.created_at desc
    limit 100
  ) recent;
$$;

revoke execute on function public.kitchen_orders() from public, anon;
grant execute on function public.kitchen_orders() to authenticated;

create table if not exists public.kitchen_order_pings (
  chef_id text primary key,
  changed_at timestamptz not null default now()
);

alter table public.kitchen_order_pings enable row level security;

create policy "Chefs see their kitchen's pings"
  on public.kitchen_order_pings for select to authenticated
  using (chef_id = (select public.my_chef_id()));

create or replace function public.ping_kitchen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.chef_id is not null then
    insert into public.kitchen_order_pings (chef_id, changed_at) values (new.chef_id, now())
    on conflict (chef_id) do update set changed_at = excluded.changed_at;
  end if;
  return null;
end;
$$;

revoke execute on function public.ping_kitchen() from public, anon, authenticated;

create trigger orders_ping_kitchen
  after insert or update on public.orders
  for each row execute function public.ping_kitchen();

alter publication supabase_realtime add table public.kitchen_order_pings;

-- Chefs no longer read orders directly (applied after the app update that uses kitchen_orders()).
drop policy if exists "Chefs read their kitchen's orders" on public.orders;
