-- Each chef picks their last delivery time (1 PM - 11 PM, 9 PM until they choose).
-- Kitchens open at 10 AM. While a chef's kitchen is closed, orders for the next day they open
-- start at 1 PM, so the chef has the morning to shop and cook.

create table if not exists public.chef_hours (
  chef_id text primary key,
  last_delivery_minutes integer not null default 1260
    check (last_delivery_minutes between 780 and 1380 and last_delivery_minutes % 15 = 0),
  updated_at timestamptz not null default now()
);

alter table public.chef_hours enable row level security;

-- Everyone can see when a chef stops delivering; chefs change theirs through set_last_delivery.
create policy "Chef hours are public" on public.chef_hours
  for select to anon, authenticated using (true);

-- A chef's last delivery time of day, 9 PM when they haven't picked one.
create or replace function public.chef_last_delivery(p_chef_id text)
returns time
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select make_time(h.last_delivery_minutes / 60, h.last_delivery_minutes % 60, 0)
       from public.chef_hours h where h.chef_id = p_chef_id),
    time '21:00'
  );
$$;

-- The signed-in home chef sets their own last delivery time.
create or replace function public.set_last_delivery(p_minutes integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chef uuid;
begin
  select id into v_chef from public.kitchen_chefs where user_id = auth.uid();
  if v_chef is null then
    raise exception 'Only approved home chefs have a kitchen';
  end if;
  if p_minutes is null or p_minutes < 780 or p_minutes > 1380 or p_minutes % 15 <> 0 then
    raise exception 'Pick a last delivery time between 1 PM and 11 PM';
  end if;
  insert into public.chef_hours (chef_id, last_delivery_minutes)
  values (v_chef::text, p_minutes)
  on conflict (chef_id) do update set last_delivery_minutes = excluded.last_delivery_minutes, updated_at = now();
end;
$$;

revoke execute on function public.set_last_delivery(integer) from public, anon;
grant execute on function public.set_last_delivery(integer) to authenticated;

-- Every order: inside the chef's hours (Cairo time).
create or replace function public.check_order_hours()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chef text;
  v_close time := time '21:00';
  v_now timestamp := now() at time zone 'Africa/Cairo';
  v_open boolean;
  v_next_day date;
  v_at timestamp;
begin
  select c.chef_id into v_chef
  from jsonb_array_elements(new.items) as item
  join (
    select id, chef_id from public.dish_prices
    union all
    select id::text, chef_id::text from public.kitchen_dishes
  ) c on c.id = item->>'dishId'
  limit 1;
  if v_chef is not null then
    v_close := public.chef_last_delivery(v_chef);
  end if;

  v_open := v_now::time >= time '10:00' and v_now::time < v_close;

  if new.scheduled_for is null then
    if not v_open then
      raise exception 'This kitchen delivers from 10 AM to %. Please schedule your order.',
        to_char(v_close, 'FMHH12:MI AM');
    end if;
    return new;
  end if;

  v_at := new.scheduled_for at time zone 'Africa/Cairo';
  if v_at::time < time '10:00' or v_at::time > v_close then
    raise exception 'Please pick a delivery time between 10 AM and %.', to_char(v_close, 'FMHH12:MI AM');
  end if;

  -- Ordered while closed: the next day the kitchen opens starts at 1 PM.
  if not v_open then
    v_next_day := case when v_now::time < time '10:00' then v_now::date else v_now::date + 1 end;
    if v_at::date = v_next_day and v_at::time < time '13:00' then
      raise exception 'The kitchen is closed now, so the earliest delivery is 1 PM.';
    end if;
  end if;
  return new;
end;
$$;

revoke execute on function public.check_order_hours() from public, anon, authenticated;
