-- Notification texts without emojis (the owner doesn't want them). Rewrites each function that
-- still has one: the emoji and the space before it are taken out, nothing else changes.
do $$
declare
  r record;
  v_def text;
begin
  for r in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.proname in ('notify_order_change', 'rider_update_location', 'approve_rider_application')
  loop
    v_def := regexp_replace(pg_get_functiondef(r.oid),
      ' ?[\U0001F300-\U0001FAFF☀-➿✅⏰‍️]+', '', 'g');
    execute v_def;
  end loop;
end $$;
