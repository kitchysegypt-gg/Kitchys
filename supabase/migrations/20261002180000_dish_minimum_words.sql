-- Dishes need a real description (at least 10 words) and ingredient list (at least 3 words).
-- Checked when an application is sent and when an approved chef adds or edits a dish.
-- Approving an application that was sent before this rule still works.

create or replace function public.word_count(p text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select coalesce(array_length(regexp_split_to_array(btrim(coalesce(p, '')), '\s+'), 1), 0)
         - case when btrim(coalesce(p, '')) = '' then 1 else 0 end;
$$;

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

-- Chefs adding or editing dishes in My kitchen. (Approval runs as the Kitchy's team,
-- without a signed-in user, so older applications can still be approved.)
create or replace function public.check_kitchen_dish_words()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and (public.word_count(new.description) < 10 or public.word_count(new.ingredients) < 3) then
    raise exception 'Each dish needs a description of at least 10 words and at least 3 ingredients';
  end if;
  return new;
end;
$$;

create trigger kitchen_dishes_check_words
  before insert or update of description, ingredients on public.kitchen_dishes
  for each row execute function public.check_kitchen_dish_words();
