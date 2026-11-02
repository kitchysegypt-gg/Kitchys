-- The chef shop is not part of Kitchy's Premium after all (Kitchy's provides containers
-- itself): hide every item and stop chefs from ordering. Tables stay so nothing breaks.
update public.shop_items set active = false;
revoke execute on function public.shop_redeem(text, text) from authenticated;
