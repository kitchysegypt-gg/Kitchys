// Emails the Kitchy's team when a chef subscribes to Premium, asks for a Kitchy's Care repair
// visit (one-click "Repair done"), sends a new or changed dish for approval (one-click Approve /
// Reject), or a customer reports a problem with an order.
//
// Secrets: same as rider-applications (RESEND_API_KEY or Vault resend_api_key, OWNER_EMAIL, EMAIL_FROM).
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

/** HMAC signature so only links from the email can change a request. */
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

const APPLIANCES: Record<string, string> = {
  oven: 'Oven',
  stove: 'Stove',
  air_fryer: 'Air fryer',
  fridge: 'Fridge',
  mixer: 'Mixer',
  other: 'Other',
};

async function chefUser(chefId: string) {
  const { data } = await admin.from('kitchen_chefs').select('user_id, name, area').eq('id', chefId).single();
  return data as { user_id: string; name: string; area: string | null } | null;
}

async function push(userId: string, title: string, body: string) {
  await admin.rpc('send_push', { p_user: userId, p_title: title, p_body: body, p_url: '/kitchen/premium' });
}

/** The team clicks a link in the email. */
async function handleAction(url: URL) {
  const kind = url.searchParams.get('kind') ?? '';
  const id = url.searchParams.get('id') ?? '';
  const action = url.searchParams.get('action') ?? '';
  const sig = url.searchParams.get('sig') ?? '';
  const allowed = (kind === 'care' && action === 'done') || (kind === 'dish' && ['approve', 'reject'].includes(action));
  if (!/^[0-9a-f-]{36}$/.test(id) || !allowed) return page('Link not valid', 'This link is incomplete.', '#D93025');
  if (sig !== (await sign(`${kind}:${id}:${action}`))) {
    return page('Link not valid', 'This link was changed or is not from Kitchy’s.', '#D93025');
  }

  if (kind === 'dish') {
    const { data: dish } = await admin.from('kitchen_dishes').select('chef_id, name, approval').eq('id', id).single();
    if (!dish) return page('Not found', 'This dish no longer exists.', '#D93025');
    if (dish.approval !== 'pending') return page('Already handled', `${dish.name} was already ${dish.approval}.`, '#B8330D');
    const approve = action === 'approve';
    await admin
      .from('kitchen_dishes')
      .update({ approval: approve ? 'approved' : 'rejected', reviewed_at: new Date().toISOString() })
      .eq('id', id);
    const chef = await chefUser(dish.chef_id);
    if (chef) {
      await admin.rpc('send_push', {
        p_user: chef.user_id,
        p_title: approve ? 'Dish approved' : 'Dish not approved',
        p_body: approve ? `${dish.name} is now on the menu.` : `${dish.name} needs changes before it can go on the menu.`,
        p_url: '/kitchen/menu',
      });
    }
    return approve
      ? page('Approved', `${dish.name} is now on the menu and the chef was told.`, '#2E9E5B')
      : page('Rejected', `${dish.name} stays off the menu and the chef was told.`, '#D93025');
  }

  const { data: req } = await admin.from('care_requests').select('chef_id, status, appliance').eq('id', id).single();
  if (!req) return page('Not found', 'This request no longer exists.', '#D93025');
  if (req.status !== 'open') return page('Already handled', 'This repair visit was already marked.', '#B8330D');
  await admin.from('care_requests').update({ status: 'done', done_at: new Date().toISOString() }).eq('id', id);
  const chef = await chefUser(req.chef_id);
  if (chef) await push(chef.user_id, "Kitchy's Care", `Your ${APPLIANCES[req.appliance]?.toLowerCase() ?? 'appliance'} repair is done.`);
  return page('Done', 'The repair visit is marked as done and the chef was told.', '#2E9E5B');
}

/** The chef app calls this right after a chef subscribes or sends a request. */
async function handleNotify(req: Request, functionUrl: string) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const { data: userData } = await admin.auth.getUser(token);
  if (!userData?.user) return json({ error: 'Sign in first' }, 401);
  const body = await req.json().catch(() => null);
  const kind = body?.kind;
  const id = body?.id;
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) return json({ error: 'Not found' }, 404);

  // Customers report order problems; everything else comes from a chef's kitchen.
  const { data: kitchen } = await admin.from('kitchen_chefs').select('id, name, area').eq('user_id', userData.user.id).maybeSingle();
  if (!kitchen && kind !== 'problem') return json({ error: 'Kitchen not found' }, 404);
  const chefId = String(kitchen?.id ?? '');

  const link = async (k: string, action: string) =>
    `${functionUrl}?kind=${k}&action=${action}&id=${id}&sig=${await sign(`${k}:${id}:${action}`)}`;
  const button = (href: string, label: string, color: string) =>
    `<a href="${href}" style="display:inline-block;padding:12px 22px;margin:4px;border-radius:12px;background:${color};color:#fff;text-decoration:none;font-weight:bold">${label}</a>`;
  const who = kitchen
    ? `<p><b>${escapeHtml(kitchen.name)}</b>${kitchen.area ? ` · ${escapeHtml(kitchen.area)}` : ''}<br>Contact: ${escapeHtml(userData.user.email)}</p>`
    : `<p>Customer: ${escapeHtml(userData.user.email)}</p>`;

  let subject = '';
  let html = '';
  if (kind === 'dish') {
    const { data: dish } = await admin.from('kitchen_dishes').select('*').eq('id', id).single();
    if (!dish || String(dish.chef_id) !== chefId) return json({ error: 'Not found' }, 404);
    if (dish.approval !== 'pending') return json({ emailed: false, reason: 'not pending' });
    const photos: string[] = (dish.photo_urls?.length ? dish.photo_urls : [dish.photo_url]).filter(Boolean);
    subject = `New dish to approve: ${dish.name} from ${kitchen!.name}`;
    html = `<h2 style="color:#F4511E">Dish waiting for approval</h2>${who}
<p><b>${escapeHtml(dish.name)}</b> · EGP ${escapeHtml(dish.price)} · ${escapeHtml(dish.category)}</p>
<p style="white-space:pre-wrap">${escapeHtml(dish.description)}</p>
<p style="white-space:pre-wrap;color:#555">Ingredients: ${escapeHtml(dish.ingredients)}</p>
${photos.map((u) => `<p><img src="${escapeHtml(u)}" style="max-width:100%;border-radius:12px"></p>`).join('')}
<p>Customers can't see it until you approve it. You can also do this in the app (More > Admin).</p>
<p>${button(await link('dish', 'approve'), 'Approve', '#2E9E5B')} ${button(await link('dish', 'reject'), 'Reject', '#D93025')}</p>`;
  } else if (kind === 'problem') {
    const { data: problem } = await admin.from('order_problems').select('*').eq('id', id).single();
    if (!problem || problem.user_id !== userData.user.id) return json({ error: 'Not found' }, 404);
    const { data: order } = await admin.from('orders').select('total, items, chef_id').eq('id', problem.order_id).single();
    const { data: chef } = order?.chef_id
      ? await admin.from('kitchen_chefs').select('name').eq('id', order.chef_id).maybeSingle()
      : { data: null };
    const photo = problem.photo_path
      ? (await admin.storage.from('order-problems').createSignedUrl(problem.photo_path, 60 * 60 * 24 * 7)).data?.signedUrl
      : null;
    const items = Array.isArray(order?.items)
      ? order!.items.map((i: { name?: string; quantity?: number }) => `${i.quantity ?? 1} x ${escapeHtml(i.name ?? '')}`).join('<br>')
      : '';
    subject = `Order problem (${problem.kind}) - order ${String(problem.order_id).slice(0, 6).toUpperCase()}`;
    html = `<h2 style="color:#F4511E">A customer reported a problem</h2>${who}
<p>Order ${escapeHtml(String(problem.order_id).slice(0, 6).toUpperCase())} from ${escapeHtml(chef?.name ?? 'a kitchen')} · EGP ${escapeHtml(order?.total)}</p>
<p>${items}</p>
<p><b>${escapeHtml(problem.kind)}</b></p>
<p style="white-space:pre-wrap">${escapeHtml(problem.details)}</p>
${photo ? `<p><img src="${escapeHtml(photo)}" style="max-width:100%;border-radius:12px"></p>` : ''}
<p>Open the app (More > Admin) to refund it as Kitchy's credit or close it.</p>`;
  } else if (kind === 'premium') {
    const { data: prem } = await admin.from('chef_premium').select('period_end').eq('chef_id', chefId).single();
    if (!prem) return json({ error: 'Not found' }, 404);
    subject = `Kitchy's Premium: ${kitchen!.name} subscribed`;
    html = `<h2 style="color:#F4511E">New Kitchy's Premium kitchen</h2>${who}
<p>EGP 320 a month comes out of their earnings. First month paid until ${new Date(prem.period_end).toDateString()}.</p>`;
  } else if (kind === 'care') {
    const { data: care } = await admin.from('care_requests').select('*').eq('id', id).single();
    if (!care || String(care.chef_id) !== chefId) return json({ error: 'Not found' }, 404);
    subject = `Kitchy's Care: ${APPLIANCES[care.appliance] ?? care.appliance} repair for ${kitchen!.name}`;
    html = `<h2 style="color:#F4511E">Kitchy's Care repair visit</h2>${who}
<p><b>${escapeHtml(APPLIANCES[care.appliance] ?? care.appliance)}</b></p>
<p style="white-space:pre-wrap">${escapeHtml(care.problem)}</p>
${care.photo_url ? `<p><img src="${escapeHtml(care.photo_url)}" style="max-width:100%;border-radius:12px"></p>` : ''}
<p>Send a technician, then mark it done:</p>
<p>${button(await link('care', 'done'), 'Repair done', '#2E9E5B')}</p>`;
  } else {
    return json({ error: 'Unknown request' }, 400);
  }

  const apiKey =
    Deno.env.get('RESEND_API_KEY') ?? (await admin.rpc('app_secret', { p_name: 'resend_api_key' })).data ?? null;
  if (!apiKey) return json({ emailed: false, reason: 'RESEND_API_KEY is not set' });
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [OWNER_EMAIL],
      reply_to: userData.user.email ?? undefined,
      subject,
      html: `<div style="font-family:system-ui,sans-serif;max-width:560px">${html}</div>`,
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
  const functionUrl = `${SUPABASE_URL}/functions/v1/kitchen-requests`;
  try {
    if (req.method === 'GET') return await handleAction(url);
    if (req.method === 'POST') return await handleNotify(req, functionUrl);
    return json({ error: 'Method not allowed' }, 405);
  } catch (error) {
    console.error(error);
    return json({ error: 'Something went wrong' }, 500);
  }
});
