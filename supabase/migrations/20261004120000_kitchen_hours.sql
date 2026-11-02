-- Kitchens take and deliver orders from 10:00 to 21:00, Cairo time.
-- "As soon as possible" orders only while open; scheduled orders must be for a time in that window.
create or replace function public.check_order_hours()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  t time := (coalesce(new.scheduled_for, now()) at time zone 'Africa/Cairo')::time;
begin
  if new.scheduled_for is null and (t < time '10:00' or t >= time '21:00') then
    raise exception 'Kitchens are open from 10 AM to 9 PM. Please schedule your order for a time when they are open.';
  end if;
  if new.scheduled_for is not null and (t < time '10:00' or t > time '21:00') then
    raise exception 'Please pick a delivery time between 10 AM and 9 PM.';
  end if;
  return new;
end;
$$;

create or replace trigger orders_check_hours
  before insert on public.orders
  for each row execute function public.check_order_hours();
