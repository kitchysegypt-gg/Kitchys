-- Only signed-in users need these (the app requires an account to browse).
revoke execute on function public.dish_portions_ordered(date) from public, anon;
grant execute on function public.dish_portions_ordered(date) to authenticated;
revoke execute on function public.chef_last_delivery(text) from public, anon;
grant execute on function public.chef_last_delivery(text) to authenticated;
