// Kitchy AI: the in-app assistant, powered by Claude.
// Needs the ANTHROPIC_API_KEY secret (Supabase dashboard -> Edge Functions -> Secrets).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Anthropic from 'npm:@anthropic-ai/sdk@0.129.0';
import { createClient } from 'npm:@supabase/supabase-js@2';

import { MENU } from './menu.ts';

const MODEL = 'claude-opus-5-5';
const MAX_TURNS = 20;
const MAX_CHARS = 2000;
const LANGUAGES: Record<string, string> = { en: 'English', ar: 'Egyptian Arabic', fr: 'French' };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM = `You are Kitchy, the friendly assistant inside the Kitchy's app. Kitchy's delivers homemade food cooked by mothers and grandmothers ("home chefs") in Egypt. You are powered by Claude, made by Anthropic; say so if asked what you are.

Kitchy's is a dinner delivery service: the menu has dinner dishes and desserts only, no drinks and no breakfast. Delivery usually takes 45-60 minutes. Each order comes from one chef: adding a dish from a different chef asks to start a new cart. Chefs only deliver within 15 km of their kitchen, so customers only see chefs near their delivery address (set on the Home screen at the top); if no chefs show up, suggest checking or changing the address. Chefs' exact locations are private. Customers can order for as soon as possible or schedule delivery for any day and time in the next 14 days (Cart > Delivery time). After an order they can rate each chef on food quality, delivery, packaging and value (Orders > Rate this order). Some dishes list a portion size in grams or kilograms; mention it when it's given and don't guess it when it isn't.

Refer a friend (More > Refer a friend, or Settings): every customer has a personal code that starts with KIT. A friend types it in the cart on their very first order, and the customer who shared it gets 10% of that order's food total (after discounts) as Kitchy's credit, with no maximum. The friend doesn't get a discount. Each friend can be referred only once, a code only works on the friend's first order, and customers can't use their own code. If that order is cancelled, the cashback is taken back. Credit comes off future orders when the customer turns on "Use my credit" in the cart; cancelled orders refund any credit they used. Credit can't be withdrawn as cash.

Home cooks can apply to become chefs from the sign-in screen or More > Become a home chef, with their kitchen location (required, so the right customers can order), an optional photo of themselves and of each dish and an optional size for each dish. The Kitchy's team reviews every application. Approved chefs manage their dishes, profile photo and kitchen location in More > My kitchen.

Help customers choose dishes, understand ingredients and allergens, and understand delivery, points, ranks and rewards. Use only the menu and rules below; never invent dishes, prices or promotions. If something isn't covered, say you don't know and suggest contacting Kitchy's support.

Allergies: state the listed allergens for a dish plainly. For severe allergies, add that home kitchens can have cross-contact and the customer should mention the allergy in the notes for the chef.

You can't place, change or cancel orders, and you can't change points; explain where in the app to do it (Home or Chefs to browse, Cart to order, schedule, apply vouchers, enter a friend's referral code and use credit, Orders to track and rate; the More tab has Refer a friend, Kitchy's Points for rewards, Kitchy AI, the delivery address, Become a home chef or My kitchen, and Settings for language, theme and colour).

Keep replies short and warm: usually 1-4 sentences or a short list. Plain text only, no markdown headings or tables. Reply in the language the customer writes in.

${MENU}`;

type ChatTurn = { role: 'user' | 'assistant'; content: string };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function validate(body: any): { messages: ChatTurn[]; language: string } | string {
  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) return 'messages is required';
  const recent = messages.slice(-MAX_TURNS);
  // The API needs the conversation to start with a user turn.
  while (recent.length && recent[0].role !== 'user') recent.shift();
  for (const m of recent) {
    if ((m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') return 'invalid message';
    if (!m.content.trim() || m.content.length > MAX_CHARS) return 'message is empty or too long';
  }
  if (!recent.length || recent[recent.length - 1].role !== 'user') return 'last message must be from the user';
  const language = typeof body.language === 'string' && LANGUAGES[body.language] ? body.language : 'en';
  return { messages: recent.map((m) => ({ role: m.role, content: m.content })), language };
}

/** A short summary of this customer's orders and points, read with their own permissions. */
async function customerContext(authHeader: string) {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const [
    { data: user },
    { data: orders },
    { data: vouchers },
    { data: kitchenChefs },
    { data: kitchenDishes },
    { data: credit },
    { data: referralCode },
    { data: referrals },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('orders').select('status, total, points_earned, created_at, items').order('created_at', { ascending: false }),
    supabase.from('reward_vouchers').select('reward_id, cost, status'),
    supabase.from('kitchen_chefs').select('id, name, area, specialty'),
    supabase
      .from('kitchen_dishes')
      .select('chef_id, name, description, ingredients, allergens, category, price, portion_grams, available')
      .eq('available', true),
    supabase.rpc('my_wallet_balance'),
    supabase.from('referral_codes').select('code').limit(1),
    supabase.from('referrals').select('cashback, status'),
  ]);
  const active = (orders ?? []).filter((o) => o.status !== 'cancelled');
  const earned = active.reduce((sum, o) => sum + Number(o.points_earned ?? 0), 0);
  const spent = (vouchers ?? []).reduce((sum, v) => sum + Number(v.cost), 0);
  const name = user?.user?.user_metadata?.full_name;
  const last = (orders ?? []).slice(0, 3).map(
    (o) => `${o.created_at.slice(0, 10)} ${o.status} EGP ${o.total}: ${(o.items ?? []).map((i: any) => `${i.quantity}x ${i.name}`).join(', ')}`
  );
  const newChefs = (kitchenChefs ?? []).map((c) => {
    const dishes = (kitchenDishes ?? [])
      .filter((d) => d.chef_id === c.id)
      .map(
        (d) =>
          `  - ${d.name} [${d.category}] EGP ${d.price}${d.portion_grams ? `, ${d.portion_grams >= 1000 ? `${d.portion_grams / 1000} kg` : `${d.portion_grams} g`}` : ''}. ${d.description} Ingredients: ${d.ingredients}. Allergens: ${
            (d.allergens ?? []).join(', ') || 'none of the common allergens'
          }.`
      )
      .join('\n');
    return `- ${c.name} (${c.specialty}, ${c.area}), a home chef who joined through the app:\n${dishes || '  (no dishes yet)'}`;
  });
  return [
    newChefs.length ? `More home chefs on the menu:\n${newChefs.join('\n')}\n` : null,
    `Customer context (private; use it only to answer this customer's questions):`,
    name ? `- Name: ${name}` : null,
    `- Orders placed (not cancelled): ${active.length}`,
    `- Free deliveries left: ${Math.max(0, 3 - active.length)}`,
    `- Points balance: ${Math.max(0, earned - spent)}`,
    `- Kitchy's credit: EGP ${Math.max(0, Number(credit ?? 0))}`,
    `- Referral code: ${referralCode?.[0]?.code ?? 'not created yet (it appears when they open Refer a friend)'}`,
    `- Friends referred: ${(referrals ?? []).filter((r) => r.status === 'earned').length} (cashback earned: EGP ${(referrals ?? [])
      .filter((r) => r.status === 'earned')
      .reduce((sum, r) => sum + Number(r.cashback), 0)})`,
    `- Can still use a friend's referral code: ${(orders ?? []).length === 0 ? 'yes (no orders yet)' : 'no (already ordered)'}`,
    `- Unused vouchers: ${(vouchers ?? []).filter((v) => v.status === 'available').map((v) => v.reward_id).join(', ') || 'none'}`,
    last.length ? `- Recent orders:\n  ${last.join('\n  ')}` : '- No orders yet',
  ]
    .filter(Boolean)
    .join('\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'The assistant is not set up yet (missing ANTHROPIC_API_KEY).' }, 503);

  const input = validate(await req.json().catch(() => null));
  if (typeof input === 'string') return json({ error: input }, 400);

  const context = await customerContext(req.headers.get('Authorization') ?? '').catch(() => null);
  const client = new Anthropic({ apiKey });

  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      // Chat answers are short; low effort keeps them quick and inexpensive.
      output_config: { effort: 'low' },
      // If a request is declined by a safety classifier, retry it on a suitable fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      messages: [
        ...input.messages,
        // Per-request details go last so the stable system prompt above stays cached.
        {
          role: 'system',
          content: `${context ?? 'Customer context is unavailable right now.'}\nThe app language is ${LANGUAGES[input.language]}; reply in the language the customer writes in.`,
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return json({ reply: "Sorry, I can't help with that. Ask me about our dishes, allergens, orders or points." });
    }
    const reply = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    return json({ reply: reply || "Sorry, I didn't catch that. Could you ask again?" });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) {
      return json({ error: 'Kitchy is busy right now. Please try again in a minute.' }, 429);
    }
    if (error instanceof Anthropic.AuthenticationError) {
      console.error('Invalid ANTHROPIC_API_KEY');
      return json({ error: 'The assistant is not set up correctly.' }, 503);
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`Claude API error ${error.status}:`, error.message);
      return json({ error: 'The assistant is unavailable right now.' }, 502);
    }
    console.error(error);
    return json({ error: 'Something went wrong.' }, 500);
  }
});
