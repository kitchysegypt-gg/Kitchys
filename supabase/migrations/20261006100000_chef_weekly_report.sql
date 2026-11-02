-- Every Sunday at 07:00 UTC (9-10 AM in Cairo) email each home chef last week's numbers.
grant execute on function public.kitchen_stats(text, integer) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'chef-weekly-report';

select cron.schedule(
  'chef-weekly-report',
  '0 7 * * 0',
  $cron$
  select net.http_post(
    url := 'https://qbyzamcxlxarslfeglfl.supabase.co/functions/v1/chef-weekly-report',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notifications_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);
