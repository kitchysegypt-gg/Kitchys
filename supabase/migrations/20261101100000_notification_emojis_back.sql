-- The owner wants the emojis back in the notifications (20261101090000 took them out by mistake).
-- Puts each title back as it was; nothing else in the functions changes.
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
    v_def := pg_get_functiondef(r.oid);
    v_def := replace(v_def, '''New order!''', '''New order! 🍲''');
    v_def := replace(v_def, '''Your chef is cooking''', '''Your chef is cooking 👩‍🍳''');
    v_def := replace(v_def, '''Your food is ready''', '''Your food is ready 🍱''');
    v_def := replace(v_def, '''Your food is on the way''', '''Your food is on the way 🛵''');
    v_def := replace(v_def, '''Delivered! Enjoy your meal''', '''Delivered! Enjoy your meal 😋''');
    v_def := replace(v_def, '''Order accepted''', '''Order accepted ✅''');
    v_def := replace(v_def, '''New pickup ready''', '''New pickup ready 🛵''');
    v_def := replace(v_def, '''Welcome to Kitchy''''s Rider''', '''Welcome to Kitchy''''s Rider 🛵''');
    v_def := replace(v_def, '''Your rider is 5 minutes away''', '''Your rider is 5 minutes away 🛵''');
    execute v_def;
  end loop;
end $$;
