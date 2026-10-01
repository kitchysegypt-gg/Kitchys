-- Photos for home chefs and their dishes, and a portion size (grams) for dishes.

-- 1. Storage: anyone can view, signed-in people upload only into their own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kitchen-photos', 'kitchen-photos', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Chefs upload photos to their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'kitchen-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Chefs replace their own photos"
  on storage.objects for update to authenticated
  using (bucket_id = 'kitchen-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Chefs delete their own photos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'kitchen-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Only links to photos in our own bucket are accepted.
create or replace function public.is_kitchen_photo_url(url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select url is null
    or url ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/kitchen-photos/[0-9a-f-]{36}/[A-Za-z0-9._-]+$';
$$;

-- 2. New columns.
alter table public.chef_applications
  add column if not exists photo_url text check (public.is_kitchen_photo_url(photo_url));

alter table public.kitchen_chefs
  add column if not exists photo_url text check (public.is_kitchen_photo_url(photo_url));

alter table public.kitchen_dishes
  add column if not exists photo_url text check (public.is_kitchen_photo_url(photo_url)),
  add column if not exists portion_grams integer check (portion_grams between 10 and 20000);

-- 3. Check the photos and sizes inside the application's dish list too.
create or replace function public.prepare_chef_application()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := auth.uid();
  new.status := 'pending';
  new.reviewed_at := null;
  select email into new.email from auth.users where id = new.user_id;
  if exists (
    select 1 from public.chef_applications
    where user_id = new.user_id and status in ('pending', 'approved')
  ) then
    raise exception 'You already have an application in review or approved';
  end if;
  if jsonb_typeof(new.dishes) <> 'array' or jsonb_array_length(new.dishes) > 15 then
    raise exception 'Add up to 15 dishes';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.dishes) as d
    where not public.is_kitchen_photo_url(d->>'photoUrl')
       or (d ? 'portionGrams' and jsonb_typeof(d->'portionGrams') <> 'null'
           and (d->>'portionGrams')::integer not between 10 and 20000)
  ) then
    raise exception 'A dish has an invalid photo or size';
  end if;
  return new;
end;
$$;

-- 4. Approval copies the photos and sizes into the live kitchen.
create or replace function public.approve_chef_application(p_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  app public.chef_applications%rowtype;
  new_chef_id uuid;
  d jsonb;
begin
  select * into app from public.chef_applications where id = p_id for update;
  if not found then raise exception 'Application not found'; end if;
  if app.status = 'approved' then
    select id into new_chef_id from public.kitchen_chefs where user_id = app.user_id;
    return new_chef_id;
  end if;

  insert into public.kitchen_chefs (user_id, application_id, name, area, specialty, bio, photo_url)
  values (app.user_id, app.id, app.full_name, app.area, app.specialty, app.bio, app.photo_url)
  on conflict (user_id) do update set
    application_id = excluded.application_id, name = excluded.name, area = excluded.area,
    specialty = excluded.specialty, bio = excluded.bio, photo_url = excluded.photo_url
  returning id into new_chef_id;

  for d in select * from jsonb_array_elements(app.dishes) loop
    insert into public.kitchen_dishes
      (chef_id, name, description, ingredients, allergens, category, price, prep_minutes, serves, spicy, vegetarian,
       photo_url, portion_grams)
    values (
      new_chef_id,
      d->>'name',
      coalesce(d->>'description', ''),
      coalesce(d->>'ingredients', ''),
      coalesce(array(select jsonb_array_elements_text(d->'allergens')), '{}'),
      coalesce(d->>'category', 'main'),
      (d->>'price')::numeric,
      coalesce((d->>'prepMinutes')::integer, 30),
      coalesce((d->>'serves')::integer, 1),
      coalesce((d->>'spicy')::boolean, false),
      coalesce((d->>'vegetarian')::boolean, false),
      d->>'photoUrl',
      (d->>'portionGrams')::integer
    );
  end loop;

  update public.chef_applications set status = 'approved', reviewed_at = now() where id = p_id;
  return new_chef_id;
end;
$$;

revoke execute on function public.approve_chef_application(uuid) from public, anon, authenticated;
revoke execute on function public.prepare_chef_application() from public, anon, authenticated;
