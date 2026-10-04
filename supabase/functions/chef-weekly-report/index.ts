// Weekly kitchen report: every Sunday morning a pg_cron job (see the chef_weekly_report migration)
// calls this function. For each approved home chef it reads last week's numbers from
// kitchen_stats() and emails them a short report: orders, sales, best dish, busiest day,
// rating and a few tips.
//
// Email goes through Resend (RESEND_API_KEY secret, or "resend_api_key" in Vault).
// EMAIL_FROM sets the sender, e.g. "Kitchy's <reports@yourdomain.com>". Until a domain is
// verified in Resend, its test sender can only deliver to the Resend account's own address.
//
// POST body (optional): { "dryRun": true } returns the emails without sending them,
// { "chefId": "<uuid>" } limits the run to one kitchen.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const EMAIL_FROM = Deno.env.get('EMAIL_FROM') ?? "Kitchy's <onboarding@resend.dev>";
const BRAND = '#F4511E';

type Stats = {
  orders: number;
  sales: number;
  prev_orders: number;
  prev_sales: number;
  average_order: number;
  customers: number;
  repeat_customers: number;
  cancelled: number;
  by_weekday: { weekday: number; orders: number }[];
  top_dishes: { name: string; qty: number; sales: number }[];
  rating: { count: number; overall: number | null; recent: number | null; unanswered: number };
};

type Lang = 'en' | 'ar';

const TEXT = {
  en: {
    subject: (name: string) => `${name}, your Kitchy's week in numbers`,
    hello: (name: string) => `Hi Chef ${name} 👋`,
    intro: "Here's how your kitchen did in the last 7 days.",
    orders: 'Orders',
    sales: 'Sales',
    average: 'Average order',
    customers: 'Customers',
    vs: 'vs the week before',
    best: 'Best-selling dish',
    portions: (n: number) => `${n} portion${n === 1 ? '' : 's'}`,
    busiest: 'Busiest day',
    rating: 'Your rating',
    reviews: (n: number) => `${n} review${n === 1 ? '' : 's'}`,
    tips: 'Tips for this week',
    quiet: 'A quiet week. New photos and a "Today\'s special" help customers notice your kitchen.',
    tipBest: (dish: string) => `${dish} is your star. Make sure it has great photos and stays switched on.`,
    tipDay: (day: string) => `${day} is your busiest day. Cook a little extra or set a daily limit you can handle.`,
    tipReplies: (n: number) => `${n} review${n === 1 ? ' is' : 's are'} waiting for your reply. A thank-you brings customers back.`,
    tipCancelled: (n: number) => `${n} order${n === 1 ? ' was' : 's were'} cancelled. Pause orders in the app when you're too busy instead.`,
    tipRepeat: (n: number) => `${n} customer${n === 1 ? '' : 's'} ordered more than once. They love your food!`,
    open: 'Open my kitchen',
    footer: "You get this email every Sunday because you cook on Kitchy's.",
    days: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  },
  ar: {
    subject: (name: string) => `${name}، أسبوعك على كيتشيز بالأرقام`,
    hello: (name: string) => `أهلاً يا شيف ${name} 👋`,
    intro: 'ده أداء مطبخك في آخر ٧ أيام.',
    orders: 'الطلبات',
    sales: 'المبيعات',
    average: 'متوسط الطلب',
    customers: 'الزباين',
    vs: 'عن الأسبوع اللي قبله',
    best: 'الأكلة الأكتر مبيعاً',
    portions: (n: number) => `${n} حصة`,
    busiest: 'أكتر يوم طلبات',
    rating: 'تقييمك',
    reviews: (n: number) => `${n} تقييم`,
    tips: 'نصايح للأسبوع ده',
    quiet: 'أسبوع هادي. صور جديدة و"طبق اليوم" بيخلّوا الزباين ياخدوا بالهم من مطبخك.',
    tipBest: (dish: string) => `${dish} هي النجمة عندك. خلّي صورها حلوة وخليها شغالة دايماً.`,
    tipDay: (day: string) => `${day} أكتر يوم عليه طلبات. اطبخ زيادة شوية أو حط حد يومي تقدر عليه.`,
    tipReplies: (n: number) => `${n} تقييم مستني ردك. كلمة شكر بترجّع الزباين.`,
    tipCancelled: (n: number) => `${n} طلب اتلغى. لما تكون مشغول وقّف الطلبات من التطبيق أحسن.`,
    tipRepeat: (n: number) => `${n} زبون طلب أكتر من مرة. بيحبوا أكلك!`,
    open: 'افتح مطبخي',
    footer: 'بيوصلك الإيميل ده كل يوم حد عشان انت بتطبخ على كيتشيز.',
    days: ['الحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت'],
  },
} as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function sameSecret(a: string, b: string) {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const egp = (n: number) => `EGP ${Math.round(Number(n)).toLocaleString('en-US')}`;

function change(now: number, before: number) {
  if (!before) return null;
  return Math.round(((Number(now) - Number(before)) / Number(before)) * 100);
}

function buildEmail(name: string, s: Stats, lang: Lang) {
  const T = TEXT[lang];
  const first = name.split(' ')[0] || name;
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const top = s.top_dishes[0];
  const busiest = [...s.by_weekday].sort((a, b) => b.orders - a.orders)[0];
  const tips: string[] = [];
  if (!s.orders) tips.push(T.quiet);
  if (top) tips.push(T.tipBest(top.name));
  if (busiest?.orders) tips.push(T.tipDay(T.days[busiest.weekday]));
  if (s.rating.unanswered) tips.push(T.tipReplies(s.rating.unanswered));
  if (s.cancelled) tips.push(T.tipCancelled(s.cancelled));
  if (s.repeat_customers) tips.push(T.tipRepeat(s.repeat_customers));

  const delta = (pct: number | null) =>
    pct === null
      ? ''
      : `<div style="font-size:12px;font-weight:700;color:${pct >= 0 ? '#1E9E4F' : '#E5484D'}">${pct >= 0 ? '+' : ''}${pct}% ${T.vs}</div>`;
  const tile = (label: string, value: string, extra = '') =>
    `<td style="width:50%;padding:6px"><div style="border:1px solid #E1E5E2;border-radius:14px;padding:14px">
      <div style="font-size:22px;font-weight:800;color:#1B1D1F">${escape(value)}</div>
      <div style="font-size:13px;color:#7A7F86">${escape(label)}</div>${extra}</div></td>`;

  const html = `<!doctype html><html dir="${dir}"><body style="margin:0;background:#F4F6F5;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:24px 12px">
    <div style="background:#fff;border-radius:20px;padding:24px;border:1px solid #E1E5E2">
      <div style="font-size:22px;font-weight:800;color:${BRAND}">Kitchy's</div>
      <h1 style="font-size:22px;margin:16px 0 4px;color:#1B1D1F">${escape(T.hello(first))}</h1>
      <p style="margin:0 0 12px;color:#7A7F86">${escape(T.intro)}</p>
      <table role="presentation" style="width:100%;border-collapse:collapse">
        <tr>${tile(T.orders, String(s.orders), delta(change(s.orders, s.prev_orders)))}${tile(T.sales, egp(s.sales), delta(change(s.sales, s.prev_sales)))}</tr>
        <tr>${tile(T.average, egp(s.average_order))}${tile(T.customers, String(s.customers))}</tr>
      </table>
      ${top ? `<p style="margin:16px 0 0"><b>${escape(T.best)}:</b> ${escape(top.name)} · ${escape(T.portions(top.qty))} · ${escape(egp(top.sales))}</p>` : ''}
      ${busiest?.orders ? `<p style="margin:6px 0 0"><b>${escape(T.busiest)}:</b> ${escape(T.days[busiest.weekday])}</p>` : ''}
      ${s.rating.count ? `<p style="margin:6px 0 0"><b>${escape(T.rating)}:</b> ⭐ ${Number(s.rating.overall).toFixed(1)} (${escape(T.reviews(s.rating.count))})</p>` : ''}
      ${tips.length ? `<h2 style="font-size:16px;margin:20px 0 6px;color:#1B1D1F">${escape(T.tips)}</h2><ul style="margin:0;padding-${dir === 'rtl' ? 'right' : 'left'}:20px;color:#1B1D1F">${tips.map((tip) => `<li style="margin:4px 0">${escape(tip)}</li>`).join('')}</ul>` : ''}
      <div style="margin-top:22px"><a href="https://kitchys.expo.app/kitchen" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:12px">${escape(T.open)}</a></div>
    </div>
    <p style="font-size:12px;color:#7A7F86;text-align:center;margin-top:14px">${escape(T.footer)}</p>
  </div></body></html>`;

  const text = [
    T.hello(first),
    T.intro,
    `${T.orders}: ${s.orders}`,
    `${T.sales}: ${egp(s.sales)}`,
    `${T.average}: ${egp(s.average_order)}`,
    `${T.customers}: ${s.customers}`,
    top ? `${T.best}: ${top.name} (${T.portions(top.qty)})` : '',
    ...tips.map((tip) => `- ${tip}`),
  ]
    .filter(Boolean)
    .join('\n');

  return { subject: T.subject(first), html, text };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: secret } = await admin.rpc('app_secret', { p_name: 'notifications_cron_secret' });
  if (typeof secret !== 'string' || !sameSecret(req.headers.get('x-cron-secret') ?? '', secret)) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const options = await req.json().catch(() => ({}));
  const dryRun = options?.dryRun === true;
  const onlyChef = typeof options?.chefId === 'string' ? options.chefId : null;

  let query = admin.from('kitchen_chefs').select('id, user_id, name');
  if (onlyChef) query = query.eq('id', onlyChef);
  const { data: chefs, error } = await query;
  if (error) return json({ error: error.message }, 500);

  const apiKey =
    Deno.env.get('RESEND_API_KEY') ?? (await admin.rpc('app_secret', { p_name: 'resend_api_key' })).data ?? null;
  if (!dryRun && !apiKey) return json({ error: 'RESEND_API_KEY is not set' }, 500);

  const results = [];
  for (const chef of chefs ?? []) {
    const [{ data: stats, error: statsError }, { data: user }, { data: device }] = await Promise.all([
      admin.rpc('kitchen_stats', { p_chef: chef.id, p_days: 7 }),
      admin.auth.admin.getUserById(chef.user_id),
      admin.from('push_devices').select('language').eq('user_id', chef.user_id).limit(1).maybeSingle(),
    ]);
    const email = user?.user?.email;
    if (statsError || !stats || !email) {
      results.push({ chef: chef.id, sent: false, reason: statsError?.message ?? 'no email' });
      continue;
    }
    const lang: Lang = device?.language === 'ar' ? 'ar' : 'en';
    const message = buildEmail(chef.name, stats as Stats, lang);
    if (dryRun) {
      results.push({ chef: chef.id, sent: false, dryRun: true, lang, subject: message.subject, html: message.html });
      continue;
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: EMAIL_FROM, to: [email], subject: message.subject, html: message.html, text: message.text }),
    });
    const ok = res.ok;
    // Resend's test sender only reaches the account owner; other chefs fail until a domain is verified.
    const reason = ok ? undefined : (await res.text()).slice(0, 200);
    if (!ok) console.error('Resend error', chef.id, res.status, reason);
    results.push({ chef: chef.id, sent: ok, reason });
  }
  return json({ count: results.length, sent: results.filter((r) => r.sent).length, results });
});
