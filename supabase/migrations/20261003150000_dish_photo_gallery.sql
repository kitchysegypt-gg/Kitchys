-- Up to 4 photos per home-chef dish. The first photo is the cover; `photo_url` keeps
-- following it so everything that shows a single photo keeps working.

create or replace function public.are_kitchen_photo_urls(urls text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(urls, 1), 0) <= 4
     and not exists (select 1 from unnest(urls) as u where u is null or not public.is_kitchen_photo_url(u));
$$;

alter table public.kitchen_dishes
  add column if not exists photo_urls text[] not null default '{}'
    check (public.are_kitchen_photo_urls(photo_urls));

update public.kitchen_dishes
set photo_urls = array[photo_url]
where photo_url is not null and photo_urls = '{}';

create or replace function public.sync_dish_cover()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.photo_urls = '{}' and new.photo_url is not null then
      new.photo_urls := array[new.photo_url];
    end if;
    new.photo_url := new.photo_urls[1];
  elsif new.photo_urls is distinct from old.photo_urls then
    new.photo_url := new.photo_urls[1];
  elsif new.photo_url is distinct from old.photo_url then
    -- Changing just the cover keeps the other photos.
    new.photo_urls := array_remove(array[new.photo_url] || coalesce(old.photo_urls[2:4], '{}'), null);
  end if;
  return new;
end;
$$;

create or replace trigger kitchen_dishes_sync_cover
  before insert or update of photo_url, photo_urls on public.kitchen_dishes
  for each row execute function public.sync_dish_cover();

-- Applications: each dish may carry "photoUrls" (up to 4).
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
  if new.kitchen_lat is null or new.kitchen_lng is null
     or not public.is_in_egypt(new.kitchen_lat, new.kitchen_lng) then
    raise exception 'Add your kitchen location so we know which customers are near you';
  end if;
  if jsonb_typeof(new.dishes) <> 'array' or jsonb_array_length(new.dishes) > 15 then
    raise exception 'Add up to 15 dishes';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.dishes) as d
    where not public.is_kitchen_photo_url(d->>'photoUrl')
       or (d ? 'photoUrls' and (
             jsonb_typeof(d->'photoUrls') <> 'array'
             or not public.are_kitchen_photo_urls(array(select jsonb_array_elements_text(d->'photoUrls')))))
       or (d ? 'portionGrams' and jsonb_typeof(d->'portionGrams') <> 'null'
           and (d->>'portionGrams')::integer not between 10 and 20000)
  ) then
    raise exception 'A dish has an invalid photo or size (up to 4 photos per dish)';
  end if;
  if exists (
    select 1 from jsonb_array_elements(new.dishes) as d
    where public.word_count(d->>'description') < 10 or public.word_count(d->>'ingredients') < 3
  ) then
    raise exception 'Each dish needs a description of at least 10 words and at least 3 ingredients';
  end if;
  return new;
end;
$$;

revoke execute on function public.prepare_chef_application() from public, anon, authenticated;

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

  if app.kitchen_lat is not null and app.kitchen_lng is not null then
    insert into public.chef_locations (chef_id, latitude, longitude)
    values (new_chef_id::text, app.kitchen_lat, app.kitchen_lng)
    on conflict (chef_id) do update set latitude = excluded.latitude, longitude = excluded.longitude, updated_at = now();
  end if;

  for d in select * from jsonb_array_elements(app.dishes) loop
    insert into public.kitchen_dishes
      (chef_id, name, description, ingredients, allergens, category, price, prep_minutes, serves, spicy, vegetarian,
       photo_url, photo_urls, portion_grams)
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
      case when jsonb_typeof(d->'photoUrls') = 'array'
           then array(select jsonb_array_elements_text(d->'photoUrls')) else '{}' end,
      (d->>'portionGrams')::integer
    );
  end loop;

  update public.chef_applications set status = 'approved', reviewed_at = now() where id = p_id;
  return new_chef_id;
end;
$$;

revoke execute on function public.approve_chef_application(uuid) from public, anon, authenticated;
