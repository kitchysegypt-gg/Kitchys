-- Premium no longer lowers the commission: every new order pays 15%.
-- Orders already placed keep the rate they were placed with.
create or replace function public.set_order_commission() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.commission_rate := 0.15;
  return new;
end;
$$;
