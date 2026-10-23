-- Kitchy's admin (the owner's account), dish approval, favourite meals and order problem reports.

-- 1. Admin ------------------------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- No policies: only is_admin() (security definer) reads it.

insert into public.admins (user_id)
select id from auth.users where email = 'kitchysegypt@gmail.com'
on conflict do nothing;

/** True for Kitchy's admins: listed in admins, or the confirmed kitchysegypt@gmail.com account. */
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and (
    exists (select 1 from public.admins a where a.user_id = auth.uid())
    or exists (
      select 1 from auth.users u
      where u.id = auth.uid() and lower(u.email) = 'kitchysegypt@gmail.com' and u.email_confirmed_at is not null
    )
  );
$$;
grant execute on function public.is_admin() to authenticated;

-- 2. Dish approval -----------------------------------------------------------------------------
-- New dishes and edits to what customers see (name, text, price, photos, category) wait for the
-- admin. Turning a dish on/off or changing the daily limit does not.
alter table public.kitchen_dishes
  add column if not exists approval text not null default 'approved'
    check (approval in ('pending', 'approved', 'rejected')),
  add column if not exists approval_note text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists submitted_at timestamptz;

-- The two placeholder test dishes stay hidden.
update public.kitchen_dishes set approval = 'rejected', approval_note = 'Test dish'
where id in ('3993ce77-726a-4209-abad-1e5484bceba5', '54f7bfb1-e2b2-4df6-a3fd-1fe0227aba64');

create or replace function public.kitchen_dish_approval() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- The team (and approve_chef_application, which runs without a user) decide directly.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.approval := 'pending';
    new.approval_note := null;
    new.reviewed_at := null;
    new.submitted_at := now();
    return new;
  end if;
  if (new.name, new.description, new.ingredients, new.price, new.photo_url, new.photo_urls, new.category)
     is distinct from
     (old.name, old.description, old.ingredients, old.price, old.photo_url, old.photo_urls, old.category) then
    new.approval := 'pending';
    new.approval_note := null;
    new.reviewed_at := null;
    new.submitted_at := now();
  else
    -- Chefs can't approve their own dishes.
    new.approval := old.approval;
    new.approval_note := old.approval_note;
    new.reviewed_at := old.reviewed_at;
    new.submitted_at := old.submitted_at;
  end if;
  return new;
end;
$$;

create trigger kitchen_dishes_approval
  before insert or update on public.kitchen_dishes
  for each row execute function public.kitchen_dish_approval();

-- Customers only see approved dishes; chefs see all of theirs; the admin sees everything.
alter policy "Customers see available dishes, chefs see all of their own" on public.kitchen_dishes
  using (
    (available and approval = 'approved')
    or chef_id in (select k.id from public.kitchen_chefs k where k.user_id = (select auth.uid()))
    or (select public.is_admin())
  );

-- Orders can only include approved dishes.
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.apply_order_pricing'::regproc) into v_def;
  if position('from public.kitchen_dishes where available and approval' in v_def) = 0 then
    v_def := replace(v_def, 'from public.kitchen_dishes where available',
                     'from public.kitchen_dishes where available and approval = ''approved''');
    execute v_def;
  end if;
end $$;

create or replace function public.admin_review_dish(p_dish uuid, p_approve boolean, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_dish public.kitchen_dishes%rowtype;
  v_user uuid;
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  update public.kitchen_dishes
     set approval = case when p_approve then 'approved' else 'rejected' end,
         approval_note = nullif(trim(coalesce(p_note, '')), ''),
         reviewed_at = now()
   where id = p_dish
  returning * into v_dish;
  if v_dish.id is null then
    raise exception 'Dish not found';
  end if;
  select user_id into v_user from public.kitchen_chefs where id = v_dish.chef_id;
  if v_user is not null then
    perform public.send_push(
      v_user,
      case when p_approve then 'Dish approved' else 'Dish not approved' end,
      case when p_approve then v_dish.name || ' is now on the menu.'
           else v_dish.name || coalesce(': ' || v_dish.approval_note, ' needs changes before it can go on the menu.') end,
      '/kitchen/menu'
    );
  end if;
end;
$$;
revoke execute on function public.admin_review_dish(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_dish(uuid, boolean, text) to authenticated;

-- 3. Favourite meals ---------------------------------------------------------------------------
create table if not exists public.favorite_dishes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dish_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, dish_id)
);
alter table public.favorite_dishes enable row level security;
create policy "People see their own favourites" on public.favorite_dishes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "People add their own favourites" on public.favorite_dishes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "People remove their own favourites" on public.favorite_dishes
  for delete to authenticated using (user_id = (select auth.uid()));

-- 4. Problem with my order ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('order-problems', 'order-problems', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Customers upload photos of their order problems"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'order-problems' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Customers and the admin see order problem photos"
  on storage.objects for select to authenticated
  using (bucket_id = 'order-problems'
         and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_admin())));

create table if not exists public.order_problems (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('missing', 'wrong', 'cold', 'spilled', 'late', 'quality', 'other')),
  details text not null default '',
  photo_path text,
  status text not null default 'open' check (status in ('open', 'refunded', 'closed')),
  refund numeric(10, 2) not null default 0,
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (order_id)
);
alter table public.order_problems enable row level security;
create policy "Customers see their own order problems" on public.order_problems
  for select to authenticated using (user_id = (select auth.uid()));

create or replace function public.report_order_problem(
  p_order uuid, p_kind text, p_details text default '', p_photo text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_order public.orders%rowtype;
  v_id uuid;
begin
  select * into v_order from public.orders where id = p_order and user_id = auth.uid();
  if v_order.id is null then
    raise exception 'Order not found';
  end if;
  if v_order.status <> 'delivered' and not (v_order.status = 'on_the_way' and p_kind = 'late') then
    raise exception 'You can report a problem once the order is delivered';
  end if;
  if coalesce(v_order.delivered_at, v_order.created_at) < now() - interval '3 days' then
    raise exception 'This order is too old to report';
  end if;
  if p_photo is not null and split_part(p_photo, '/', 1) <> auth.uid()::text then
    raise exception 'Photo not allowed';
  end if;
  insert into public.order_problems (order_id, user_id, kind, details, photo_path)
  values (p_order, auth.uid(), p_kind, left(coalesce(p_details, ''), 1000), p_photo)
  on conflict (order_id) do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'You already reported a problem with this order';
  end if;
  return v_id;
end;
$$;
revoke execute on function public.report_order_problem(uuid, text, text, text) from public, anon;
grant execute on function public.report_order_problem(uuid, text, text, text) to authenticated;

-- Refunds go back as Kitchy's credit (cash orders have nothing to send back to a card).
create or replace function public.admin_resolve_problem(p_problem uuid, p_refund numeric, p_note text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_problem public.order_problems%rowtype;
  v_total numeric;
  v_refund numeric := greatest(round(coalesce(p_refund, 0)), 0);
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  select * into v_problem from public.order_problems where id = p_problem for update;
  if v_problem.id is null then
    raise exception 'Problem not found';
  end if;
  if v_problem.status <> 'open' then
    raise exception 'Already handled';
  end if;
  select total into v_total from public.orders where id = v_problem.order_id;
  if v_refund > coalesce(v_total, 0) then
    raise exception 'The refund is more than the order total';
  end if;
  update public.order_problems
     set status = case when v_refund > 0 then 'refunded' else 'closed' end,
         refund = v_refund,
         admin_note = nullif(trim(coalesce(p_note, '')), ''),
         resolved_at = now()
   where id = p_problem;
  if v_refund > 0 then
    insert into public.wallet_entries (user_id, amount, kind, order_id, note)
    values (v_problem.user_id, v_refund, 'refund', v_problem.order_id, 'Problem with your order');
  end if;
  perform public.send_push(
    v_problem.user_id,
    'About your order',
    case when v_refund > 0 then 'Sorry about that. EGP ' || v_refund || ' was added to your Kitchy''s credit.'
         else coalesce(nullif(trim(coalesce(p_note, '')), ''), 'We looked into your order problem. Thank you for telling us.') end,
    '/orders'
  );
end;
$$;
revoke execute on function public.admin_resolve_problem(uuid, numeric, text) from public, anon;
grant execute on function public.admin_resolve_problem(uuid, numeric, text) to authenticated;

-- 5. What the admin screen shows -----------------------------------------------------------------
create or replace function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  return jsonb_build_object(
    'pending_dishes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id, 'name', d.name, 'description', d.description, 'ingredients', d.ingredients,
        'price', d.price, 'category', d.category, 'photo_url', d.photo_url, 'photo_urls', d.photo_urls,
        'kitchen', k.name, 'area', k.area, 'submitted_at', coalesce(d.submitted_at, d.created_at)
      ) order by coalesce(d.submitted_at, d.created_at)), '[]'::jsonb)
      from public.kitchen_dishes d join public.kitchen_chefs k on k.id = d.chef_id
      where d.approval = 'pending'
    ),
    'problems', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id, 'order_id', p.order_id, 'order', upper(left(p.order_id::text, 6)), 'kind', p.kind,
        'details', p.details, 'photo_path', p.photo_path, 'status', p.status, 'refund', p.refund,
        'created_at', p.created_at, 'total', o.total, 'items', o.items, 'kitchen', k.name,
        'customer_phone', c.phone, 'rider', r.name
      ) order by (p.status = 'open') desc, p.created_at desc), '[]'::jsonb)
      from public.order_problems p
      join public.orders o on o.id = p.order_id
      left join public.kitchen_chefs k on k.id::text = o.chef_id
      left join public.order_contacts c on c.order_id = o.id
      left join public.riders r on r.id = o.rider_id
      where p.status = 'open' or p.created_at > now() - interval '14 days'
    ),
    'today', (
      select jsonb_build_object(
        'orders', count(*),
        'open', count(*) filter (where o.status in ('placed', 'cooking', 'ready', 'on_the_way')),
        'delivered', count(*) filter (where o.status = 'delivered'),
        'cancelled', count(*) filter (where o.status = 'cancelled')
      )
      from public.orders o
      where o.created_at >= date_trunc('day', now() at time zone 'Africa/Cairo') at time zone 'Africa/Cairo'
    )
  );
end;
$$;
revoke execute on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;
