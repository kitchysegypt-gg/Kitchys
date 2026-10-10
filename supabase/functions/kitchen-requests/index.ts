// Kitchy's Premium requests from chefs: emails the Kitchy's team when a chef subscribes,
// asks for a Kitchy's Care repair visit or gets something from the chef shop, with one-click
// links to mark it done / delivered (or cancel a shop order and give the points back).
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
  const allowed = (kind === 'care' && action === 'done') || (kind === 'shop' && ['delivered', 'cancel'].includes(action));
  if (!/^[0-9a-f-]{36}$/.test(id) || !allowed) return page('Link not valid', 'This link is incomplete.', '#D93025');
  if (sig !== (await sign(`${kind}:${id}:${action}`))) {
    return page('Link not valid', 'This link was changed or is not from Kitchy’s.', '#D93025');
  }

  if (kind === 'care') {
    const { data: req } = await admin.from('care_requests').select('chef_id, status, appliance').eq('id', id).single();
    if (!req) return page('Not found', 'This request no longer exists.', '#D93025');
    if (req.status !== 'open') return page('Already handled', 'This repair visit was already marked.', '#B8330D');
    await admin.from('care_requests').update({ status: 'done', done_at: new Date().toISOString() }).eq('id', id);
    const chef = await chefUser(req.chef_id);
    if (chef) await push(chef.user_id, "Kitchy's Care ✓", `Your ${APPLIANCES[req.appliance]?.toLowerCase() ?? 'appliance'} repair is done.`);
    return page('Done ✓', 'The repair visit is marked as done and the chef was told.', '#2E9E5B');
  }

  const { data: order } = await admin
    .from('shop_orders')
    .select('chef_id, status, method, points_spent, item_id, shop_items(name)')
    .eq('id', id)
    .single();
  if (!order) return page('Not found', 'This shop order no longer exists.', '#D93025');
  if (order.status !== 'requested') return page('Already handled', `This shop order is already ${order.status}.`, '#B8330D');
  const itemName = (order.shop_items as { name?: { en?: string } } | null)?.name?.en ?? order.item_id;
  const chef = await chefUser(order.chef_id);

  if (action === 'delivered') {
    await admin.from('shop_orders').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('id', id);
    if (chef) await push(chef.user_id, 'Your order from the chef shop 🎁', `${itemName} was delivered. Enjoy cooking with it!`);
    if (order.method === 'instalments') await admin.rpc('charge_instalments');
    return page('Delivered ✓', `${itemName} is marked as delivered.`, '#2E9E5B');
  }

  await admin.from('shop_orders').update({ status: 'cancelled' }).eq('id', id);
  if (order.method === 'points' && order.points_spent > 0) {
    await admin
      .from('chef_points')
      .insert({ chef_id: order.chef_id, amount: order.points_spent, reason: 'refund', shop_order_id: id });
  }
  if (chef) {
    await push(
      chef.user_id,
      'Chef shop order cancelled',
      order.method === 'points' ? `We couldn't get ${itemName}. Your points are back.` : `We couldn't get ${itemName}.`
    );
  }
  return page('Cancelled', order.method === 'points' ? 'The order is cancelled and the points were given back.' : 'The order is cancelled.', '#B8330D');
}

/** The chef app calls this right after a chef subscribes or sends a request. */
async function handleNotify(req: Request, functionUrl: string) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
  const { data: userData } = await admin.auth.getUser(token);
  if (!userData?.user) return json({ error: 'Sign in first' }, 401);
  const { data: kitchen } = await admin.from('kitchen_chefs').select('id, name, area').eq('user_id', userData.user.id).single();
  if (!kitchen) return json({ error: 'Kitchen not found' }, 404);
  const chefId = String(kitchen.id);

  const body = await req.json().catch(() => null);
  const kind = body?.kind;
  const id = body?.id;

  const link = async (k: string, action: string) =>
    `${functionUrl}?kind=${k}&action=${action}&id=${id}&sig=${await sign(`${k}:${id}:${action}`)}`;
  const button = (href: string, label: string, color: string) =>
    `<a href="${href}" style="display:inline-block;padding:12px 22px;margin:4px;border-radius:12px;background:${color};color:#fff;text-decoration:none;font-weight:bold">${label}</a>`;
  const who = `<p><b>${escapeHtml(kitchen.name)}</b>${kitchen.area ? ` · ${escapeHtml(kitchen.area)}` : ''}<br>Contact: ${escapeHtml(userData.user.email)}</p>`;

  let subject = '';
  let html = '';
  if (kind === 'premium') {
    const { data: prem } = await admin.from('chef_premium').select('period_end').eq('chef_id', chefId).single();
    if (!prem) return json({ error: 'Not found' }, 404);
    subject = `Kitchy's Premium: ${kitchen.name} subscribed`;
    html = `<h2 style="color:#F4511E">New Kitchy's Premium kitchen ⭐</h2>${who}
<p>EGP 320 a month comes out of their earnings. First month paid until ${new Date(prem.period_end).toDateString()}.</p>`;
  } else if (kind === 'care') {
    const { data: care } = await admin.from('care_requests').select('*').eq('id', id).single();
    if (!care || String(care.chef_id) !== chefId) return json({ error: 'Not found' }, 404);
    subject = `Kitchy's Care: ${APPLIANCES[care.appliance] ?? care.appliance} repair for ${kitchen.name}`;
    html = `<h2 style="color:#F4511E">Kitchy's Care repair visit 🔧</h2>${who}
<p><b>${escapeHtml(APPLIANCES[care.appliance] ?? care.appliance)}</b></p>
<p style="white-space:pre-wrap">${escapeHtml(care.problem)}</p>
${care.photo_url ? `<p><img src="${escapeHtml(care.photo_url)}" style="max-width:100%;border-radius:12px"></p>` : ''}
<p>Send a technician, then mark it done:</p>
<p>${button(await link('care', 'done'), 'Repair done', '#2E9E5B')}</p>`;
  } else if (kind === 'shop') {
    const { data: order } = await admin.from('shop_orders').select('*, shop_items(name, price)').eq('id', id).single();
    if (!order || String(order.chef_id) !== chefId) return json({ error: 'Not found' }, 404);
    const item = order.shop_items as { name: { en: string }; price: number };
    subject = `Chef shop: ${item.name.en} for ${kitchen.name}`;
    html = `<h2 style="color:#F4511E">Chef shop order 🎁</h2>${who}
<p><b>${escapeHtml(item.name.en)}</b> (EGP ${item.price})</p>
<p>${
      order.method === 'points'
        ? `Paid with <b>${order.points_spent}</b> points.`
        : `Paying monthly: <b>EGP ${order.monthly} × ${order.months} months</b> from their earnings, starting when it's delivered.`
    }</p>
<p>${button(await link('shop', 'delivered'), 'Delivered', '#2E9E5B')} ${button(await link('shop', 'cancel'), order.method === 'points' ? 'Cancel & give points back' : 'Cancel', '#D93025')}</p>`;
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
