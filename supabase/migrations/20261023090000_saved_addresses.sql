-- Saved addresses: a customer keeps several delivery places (home, work, family) on their account
-- and switches between them in one tap. Only the owner can see or change their own rows.
create table if not exists public.saved_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 40),
  kind text not null default 'other' check (kind in ('home', 'work', 'family', 'other')),
  address text not null check (char_length(address) between 1 and 300),
  details text not null default '' check (char_length(details) <= 300),
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  created_at timestamptz not null default now()
);

create index if not exists saved_addresses_user_idx on public.saved_addresses (user_id, created_at);

alter table public.saved_addresses enable row level security;

-- Up to 20 addresses each, so the list stays usable.
create or replace function public.saved_addresses_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.saved_addresses where user_id = new.user_id) >= 20 then
    raise exception 'You can save up to 20 addresses. Remove one to add another.';
  end if;
  return new;
end;
$$;

create or replace trigger saved_addresses_limit before insert on public.saved_addresses
  for each row execute function public.saved_addresses_limit();

create policy "Own saved addresses: read" on public.saved_addresses
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Own saved addresses: add" on public.saved_addresses
  for insert to authenticated with check (user_id = (select auth.uid()));

create policy "Own saved addresses: change" on public.saved_addresses
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Own saved addresses: remove" on public.saved_addresses
  for delete to authenticated using (user_id = (select auth.uid()));
