-- Before launch: remove the test orders and everything made from them (reviews, contacts,
-- referrals, credit, chef points), test Premium subscriptions and charges, test deals, the
-- notification log and saved carts. Accounts, kitchens, riders and applications stay.
-- Two test dishes with placeholder text are removed; three others get proper meal photos.
begin;
delete from public.orders;
delete from public.wallet_entries;
delete from public.chef_points;
delete from public.chef_charges;
delete from public.chef_premium;
delete from public.customer_premium;
delete from public.dish_deals;
delete from public.notification_log;
delete from public.saved_carts;
delete from public.kitchen_order_pings;
delete from public.kitchen_dishes where id in ('3993ce77-726a-4209-abad-1e5484bceba5', '54f7bfb1-e2b2-4df6-a3fd-1fe0227aba64');
update public.kitchen_dishes set
  photo_url = 'https://qbyzamcxlxarslfeglfl.supabase.co/storage/v1/object/public/kitchen-photos/aba2f8f2-d159-4154-b84e-7a6fb6d8e23f/kitchys-salad.jpg',
  photo_urls = array['https://qbyzamcxlxarslfeglfl.supabase.co/storage/v1/object/public/kitchen-photos/aba2f8f2-d159-4154-b84e-7a6fb6d8e23f/kitchys-salad.jpg'],
  description = 'Fresh homemade salad.', ingredients = 'Fresh vegetables'
  where id = '65fc0b12-b4c0-4c28-9af6-1489a3333804';
update public.kitchen_dishes set
  photo_url = 'https://qbyzamcxlxarslfeglfl.supabase.co/storage/v1/object/public/kitchen-photos/bc3048cd-80d9-4d6c-88fc-4f2273c485c3/kitchys-mahshi.jpg',
  photo_urls = array['https://qbyzamcxlxarslfeglfl.supabase.co/storage/v1/object/public/kitchen-photos/bc3048cd-80d9-4d6c-88fc-4f2273c485c3/kitchys-mahshi.jpg'],
  description = 'Homemade mahshi.', ingredients = 'Vegetables stuffed with rice and herbs'
  where id = '3289f724-c181-45eb-83d5-9cd1855cb6cb';
update public.kitchen_dishes set
  photo_url = 'https://qbyzamcxlxarslfeglfl.supabase.co/storage/v1/object/public/kitchen-photos/29a5478c-00f7-4fa9-867b-6c42148a6c79/kitchys-makarona.jpg',
  photo_urls = array['https://qbyzamcxlxarslfeglfl.supabase.co/storage/v1/object/public/kitchen-photos/29a5478c-00f7-4fa9-867b-6c42148a6c79/kitchys-makarona.jpg']
  where id = '36a5c24e-3cc9-412c-ab97-b556048352b6';
commit;
