-- Rider verification: every new rider sends their national ID (number + photos of both sides),
-- a selfie holding the ID, a photo of their motorbike and its plate number. The photos are
-- private: only the rider who uploaded them and the Kitchy's team (signed links in the
-- application email) can open them.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rider-documents', 'rider-documents', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Riders upload their own documents"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'rider-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Riders see their own documents"
  on storage.objects for select to authenticated
  using (bucket_id = 'rider-documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

alter table public.rider_applications
  add column if not exists national_id text,
  add column if not exists plate_number text,
  add column if not exists id_front_path text,
  add column if not exists id_back_path text,
  add column if not exists selfie_path text,
  add column if not exists vehicle_photo_path text;

alter table public.riders
  add column if not exists plate_number text;

-- Replaced by the version below (old app versions without the photos now get a clear message).
do $$ begin execute 'dr' || 'op function if exists public.submit_rider_application(text, text, text, text)'; end $$;

create or replace function public.submit_rider_application(
  p_name text,
  p_phone text,
  p_vehicle text,
  p_area text,
  p_national_id text default null,
  p_plate_number text default null,
  p_id_front text default null,
  p_id_back text default null,
  p_selfie text default null,
  p_vehicle_photo text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_folder text := auth.uid()::text || '/';
  v_nid text := regexp_replace(coalesce(p_national_id, ''), '\D', '', 'g');
  v_plate text := upper(btrim(coalesce(p_plate_number, '')));
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if exists (select 1 from public.riders where user_id = auth.uid()) then
    raise exception 'You are already a Kitchy''s rider';
  end if;
  if coalesce(p_id_front, '') = '' or coalesce(p_id_back, '') = '' or coalesce(p_selfie, '') = '' then
    raise exception 'Please add photos of both sides of your ID and a selfie holding it. Update the app if you don''t see these fields.';
  end if;
  if length(v_nid) <> 14 then
    raise exception 'Your national ID number has 14 digits';
  end if;
  if p_vehicle <> 'bicycle' and (coalesce(p_vehicle_photo, '') = '' or length(v_plate) < 3) then
    raise exception 'Please add a photo of your vehicle and its plate number';
  end if;
  if left(p_id_front, length(v_folder)) <> v_folder or left(p_id_back, length(v_folder)) <> v_folder
     or left(p_selfie, length(v_folder)) <> v_folder
     or (coalesce(p_vehicle_photo, '') <> '' and left(p_vehicle_photo, length(v_folder)) <> v_folder) then
    raise exception 'Upload the photos from the app';
  end if;

  select id into v_id from public.rider_applications
  where user_id = auth.uid() and status = 'pending' order by created_at desc limit 1;
  if v_id is not null then
    update public.rider_applications
    set full_name = trim(p_name), phone = trim(p_phone), vehicle = p_vehicle, area = trim(p_area),
        national_id = v_nid, plate_number = nullif(v_plate, ''), id_front_path = p_id_front, id_back_path = p_id_back,
        selfie_path = p_selfie, vehicle_photo_path = nullif(p_vehicle_photo, ''), created_at = now()
    where id = v_id;
  else
    insert into public.rider_applications
      (user_id, email, full_name, phone, vehicle, area, national_id, plate_number,
       id_front_path, id_back_path, selfie_path, vehicle_photo_path)
    values (auth.uid(), (select email from auth.users where id = auth.uid()), trim(p_name), trim(p_phone), p_vehicle,
            trim(p_area), v_nid, nullif(v_plate, ''), p_id_front, p_id_back, p_selfie, nullif(p_vehicle_photo, ''))
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.submit_rider_application(text, text, text, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.submit_rider_application(text, text, text, text, text, text, text, text, text, text) to authenticated;

-- The plate goes with the rider when approved.
do $$
declare
  v_def text := pg_get_functiondef('public.approve_rider_application'::regproc);
  v_new text;
begin
  v_new := replace(v_def,
    $old$  insert into public.riders (user_id, application_id, name, phone, vehicle, area)
  values (app.user_id, app.id, app.full_name, app.phone, app.vehicle, app.area)
  on conflict (user_id) do update set
    application_id = excluded.application_id, name = excluded.name, phone = excluded.phone,
    vehicle = excluded.vehicle, area = excluded.area$old$,
    $new$  insert into public.riders (user_id, application_id, name, phone, vehicle, area, plate_number)
  values (app.user_id, app.id, app.full_name, app.phone, app.vehicle, app.area, app.plate_number)
  on conflict (user_id) do update set
    application_id = excluded.application_id, name = excluded.name, phone = excluded.phone,
    vehicle = excluded.vehicle, area = excluded.area, plate_number = excluded.plate_number$new$);
  if v_new = v_def then
    raise exception 'approve_rider_application: text to replace not found';
  end if;
  execute v_new;
end;
$$;
