-- Home-screen promo banners, managed from the Supabase dashboard (no app update needed).
--   image:     'builtin:free-delivery' | 'builtin:points' | 'builtin:refer' (shipped with the app),
--              or the public link of a picture uploaded to the promo-banners bucket.
--              Banners are 16:9 (e.g. 1600 x 900).
--   link:      what tapping it opens.
--   show_when: 'always', or 'free_delivery' (only while the customer still has free deliveries).
--   sort:      lower comes first. Untick `active` to hide a banner without deleting it.
create table if not exists public.promo_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  image text not null check (
    image like 'builtin:%'
    or image ~ '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/promo-banners/'
  ),
  link text not null default 'none' check (link in ('none', 'chefs', 'rewards', 'refer', 'orders', 'cart', 'chat')),
  show_when text not null default 'always' check (show_when in ('always', 'free_delivery')),
  sort integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.promo_banners enable row level security;

create policy "Anyone can see active banners"
  on public.promo_banners for select to anon, authenticated
  using (active);

insert into public.promo_banners (title, image, link, show_when, sort) values
  ('Free delivery', 'builtin:free-delivery', 'chefs', 'free_delivery', 10),
  ('Win points when you order', 'builtin:points', 'rewards', 'always', 20),
  ('Refer a friend, 10% cashback', 'builtin:refer', 'refer', 'always', 30);

-- Pictures for new banners: public to read, uploaded only from the dashboard.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('promo-banners', 'promo-banners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
