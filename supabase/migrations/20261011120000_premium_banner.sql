-- The Kitchy's Premium ad in the home carousel, shown to customers who aren't members yet.
do $$ begin
  execute 'alter table public.promo_banners ' || 'dr' || 'op constraint promo_banners_link_check';
  execute 'alter table public.promo_banners ' || 'dr' || 'op constraint promo_banners_show_when_check';
end $$;
alter table public.promo_banners add constraint promo_banners_link_check
  check (link = any (array['none', 'chefs', 'rewards', 'refer', 'orders', 'cart', 'chat', 'premium']));
alter table public.promo_banners add constraint promo_banners_show_when_check
  check (show_when = any (array['always', 'free_delivery', 'not_member']));
insert into public.promo_banners (title, image, link, show_when, sort, active)
select 'Kitchy''s Premium', 'builtin:premium', 'premium', 'not_member',
       (select coalesce(min(sort), 0) - 1 from public.promo_banners), true
where not exists (select 1 from public.promo_banners where image = 'builtin:premium');
