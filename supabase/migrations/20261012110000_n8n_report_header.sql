-- n8n sends its shared secret in an "x-n8n-secret" header (an n8n Header Auth credential), so
-- the secret never sits inside the workflow itself.
create or replace function public.n8n_report(p_kind text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text := coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-n8n-secret';
begin
  return public.n8n_report(v_secret, p_kind);
end;
$$;

grant execute on function public.n8n_report(text) to anon, authenticated;
