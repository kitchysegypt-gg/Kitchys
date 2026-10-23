-- Kitchy's: customer orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  items jsonb not null,
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  delivery_fee numeric(10, 2) not null default 0,
  total numeric(10, 2) not null default 0,
  address text,
  notes text,
  status text not null default 'placed'
    check (status in ('placed', 'cooking', 'on_the_way', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists orders_user_id_created_at_idx
  on public.orders (user_id, created_at desc);

alter table public.orders enable row level security;

create policy "Customers can read their own orders"
  on public.orders for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Customers can place their own orders"
  on public.orders for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

-- Delivery is free for a customer's first 3 orders. The fee is decided here,
-- on the server, so it cannot be changed from the app.
create or replace function public.apply_order_pricing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  previous_orders integer;
begin
  new.user_id := auth.uid();
  new.status := 'placed';

  select count(*) into previous_orders
  from public.orders
  where user_id = new.user_id and status <> 'cancelled';

  new.delivery_fee := case when previous_orders < 3 then 0 else 30 end;
  new.total := new.subtotal + new.delivery_fee;
  return new;
end;
$$;

revoke execute on function public.apply_order_pricing() from public, anon, authenticated;

create trigger orders_apply_pricing
  before insert on public.orders
  for each row execute function public.apply_order_pricing();
