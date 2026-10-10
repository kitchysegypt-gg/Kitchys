// Rider applications (Kitchy's Rider app): emails each new application to the Kitchy's team
// with one-click Approve / Reject links, and handles those links. Same setup as chef-applications.
//
// Secrets (Supabase dashboard -> Edge Functions -> Secrets):
//   RESEND_API_KEY  - from resend.com, used to send the email (or store it in Vault as resend_api_key)
//   OWNER_EMAIL     - where applications go (defaults to kitchysegypt@gmail.com)
//   EMAIL_FROM      - sender, e.g. "Kitchy's <apply@yourdomain.com>" (defaults to Resend's test sender)
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OWNER_EMAIL = Deno.env.get('OWNER_EMAIL') ?? 'kitchysegypt@gmail.com';
const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? "Kitchy's <onboarding@resend.dev>";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const escapeHtml = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** HMAC signature so only links from the email can approve or reject. */
async function sign(text: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SERVICE_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
}

function page(title: string, message: string, color: string) {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title></head>
<body style="margin:0;font-family:system-ui,sans-serif;background:#FFF8F3;color:#1E1B18;display:grid;place-items:center;min-height:100vh">
<div style="max-width:420px;padding:32px;margin:16px;background:#fff;border-radius:24px;border:1px solid #F1DED3;text-align:center">
<h1 style="color:${color};margin:0 0 8px">${escapeHtml(title)}</h1><p style="font-size:17px;line-height:1.5">${escapeHtml(message)}</p></div></body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

/** The team clicks Approve / Reject in the email. */
async function handleDecision(url: URL) {
  const id = url.searchParams.get('id') ?? '';
  const action = url.searchParams.get('action') ?? '';
  const sig = url.searchParams.get('sig') ?? '';
  if (!/^[0-9a-f-]{36}$/.test(id) || !['approve', 'reject'].includes(action)) {
    return page('Link not valid', 'This link is incomplete.', '#D93025');
  }
  if (sig !== (await sign(`rider:${id}:${action}`))) {
    return page('Link not valid', 'This link was changed or is not from Kitchy’s.', '#D93025');
  }
  const { data: app } = await admin.from('rider_applications').select('full_name, status').eq('id', id).single();
  if (!app) return page('Not found', 'This application no longer exists.', '#D93025');

  if (action === 'approve') {
    const { error } = await admin.rpc('approve_rider_application', { p_id: id });
    if (error) return page('Could not approve', error.message, '#D93025');
    return page('Approved ✓', `${app.full_name} is now a Kitchy's rider and can go online in the rider app.`, '#2E9E5B');
  }
  if (app.status === 'approved') {
    return page('Already approved', `${app.full_name} was already approved, so the application can't be rejected here.`, '#B8330D');
  }
  await admin.rpc('reject_rider_application', { p_id: id });
  return page('Rejected', `${app.full_name}'s rider application was rejected.`, '#B8330D');
}

const VEHICLES: Record<string, string> = { motorbike: 'Motorbike', scooter: 'Scooter', bicycle: 'Bicycle', car: 'Car' };

/** The rider app calls this right after the rider applies. */
async function handleNotify(req: Request, functionUrl: string) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const { data: userData } = await admin.auth.getUser(token);
  if (!userData?.user) return json({ error: 'Sign in first' }, 401);

  const body = await req.json().catch(() => null);
  const id = body?.application_id;
  const { data: app } = await admin.from('rider_applications').select('*').eq('id', id).single();
  if (!app || app.user_id !== userData.user.id) return json({ error: 'Application not found' }, 404);

  const apiKey =
    Deno.env.get('RESEND_API_KEY') ?? (await admin.rpc('app_secret', { p_name: 'resend_api_key' })).data ?? null;
  if (!apiKey) return json({ emailed: false, reason: 'RESEND_API_KEY is not set' });

  const link = async (action: string) =>
    `${functionUrl}?action=${action}&id=${app.id}&sig=${await sign(`rider:${app.id}:${action}`)}`;
  const button = (href: string, label: string, color: string) =>
    `<a href="${href}" style="display:inline-block;padding:12px 22px;margin:4px;border-radius:12px;background:${color};color:#fff;text-decoration:none;font-weight:bold">${label}</a>`;

  const html = `<div style="font-family:system-ui,sans-serif;max-width:560px">
<h2 style="color:#F4511E">New rider application 🛵</h2>
<p><b>${escapeHtml(app.full_name)}</b> wants to deliver for Kitchy's.</p>
<table cellpadding="4">
<tr><td>Email</td><td>${escapeHtml(app.email)}</td></tr>
<tr><td>Phone</td><td>${escapeHtml(app.phone)}</td></tr>
<tr><td>Vehicle</td><td>${escapeHtml(VEHICLES[app.vehicle] ?? app.vehicle)}</td></tr>
<tr><td>Area</td><td>${escapeHtml(app.area)}</td></tr>
</table>
<p>Approving lets them go online in Kitchy's Rider and take deliveries right away.</p>
<p>${button(await link('approve'), 'Approve', '#2E9E5B')} ${button(await link('reject'), 'Reject', '#D93025')}</p>
</div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [OWNER_EMAIL],
      reply_to: app.email ?? undefined,
      subject: `New Kitchy's rider application: ${app.full_name}`,
      html,
    }),
  });
  if (!res.ok) {
    console.error('Resend error', res.status, await res.text());
    return json({ emailed: false, reason: 'email service error' });
  }
  return json({ emailed: true });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const url = new URL(req.url);
  const functionUrl = `${SUPABASE_URL}/functions/v1/rider-applications`;
  try {
    if (req.method === 'GET') return await handleDecision(url);
    if (req.method === 'POST') return await handleNotify(req, functionUrl);
    return json({ error: 'Method not allowed' }, 405);
  } catch (error) {
    console.error(error);
    return json({ error: 'Something went wrong' }, 500);
  }
});
