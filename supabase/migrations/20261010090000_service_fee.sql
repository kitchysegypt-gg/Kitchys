-- Every order pays an EGP 20 service fee for packaging (containers and bags that keep the
-- food hot and safe). Older orders keep 0.
alter table public.orders add column if not exists service_fee numeric(10, 2) not null default 0;

do $$
declare
  d text;
begin
  d := pg_get_functiondef('public.apply_order_pricing()'::regprocedure);
  d := replace(d,
    'new.total := new.subtotal - new.discount + new.delivery_fee;',
    'new.service_fee := 20;
  new.total := new.subtotal - new.discount + new.delivery_fee + new.service_fee;');
  if position('new.service_fee := 20' in d) = 0 then
    raise exception 'apply_order_pricing did not change';
  end if;
  execute d;
end $$;
