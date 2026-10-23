-- Lets edge functions (service role only) read a named secret from Supabase Vault.
-- Store a secret with: select vault.create_secret('<value>', 'resend_api_key');
create or replace function public.app_secret(p_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = p_name limit 1;
$$;

revoke all on function public.app_secret(text) from public, anon, authenticated;
grant execute on function public.app_secret(text) to service_role;
