// "Delete my account": removes the person's account and personal data. Past orders stay as
// anonymous records (no name, phone, address or email) so chef and rider payouts still add up.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const ACTIVE = ['placed', 'cooking', 'ready', 'on_the_way'];

/** Removes every file under `<userId>/` in a bucket. */
async function clearFolder(bucket: string, userId: string) {
  const { data } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
  const paths = (data ?? []).map((f) => `${userId}/${f.name}`);
  if (paths.length) await admin.storage.from(bucket).remove(paths);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
    const { data: auth } = await admin.auth.getUser(token);
    const user = auth?.user;
    if (!user) return json({ error: 'Sign in first' }, 401);
    const uid = user.id;

    // Nothing can be in progress: the food, the rider or the money would be left hanging.
    const { count: myActive } = await admin
      .from('orders').select('id', { count: 'exact', head: true }).eq('user_id', uid).in('status', ACTIVE);
    if (myActive) return json({ error: 'active_order' }, 409);

    const { data: kitchen } = await admin.from('kitchen_chefs').select('id').eq('user_id', uid).maybeSingle();
    if (kitchen) {
      const { count } = await admin
        .from('orders').select('id', { count: 'exact', head: true }).eq('chef_id', String(kitchen.id)).in('status', ACTIVE);
      if (count) return json({ error: 'kitchen_busy' }, 409);
    }
    const { data: rider } = await admin.from('riders').select('id').eq('user_id', uid).maybeSingle();
    if (rider) {
      const { count } = await admin
        .from('orders').select('id', { count: 'exact', head: true }).eq('rider_id', rider.id).in('status', ACTIVE);
      if (count) return json({ error: 'rider_busy' }, 409);
    }

    // Personal details on past orders.
    await admin.from('orders')
      .update({ address: 'Deleted account', notes: null, phone: null, delivery_lat: null, delivery_lng: null })
      .eq('user_id', uid);
    await admin.from('order_contacts').delete().eq('user_id', uid);
    await admin.from('orders').update({ referred_by: null }).eq('referred_by', uid);
    await admin.from('chef_reviews').update({ reviewer_name: 'Kitchy\'s customer' }).eq('user_id', uid);

    // Everything else about the person.
    for (const table of ['push_devices', 'saved_carts', 'favorite_dishes', 'referral_codes', 'customer_premium', 'notification_log']) {
      await admin.from(table).delete().eq('user_id', uid);
    }
    if (kitchen) {
      // The kitchen leaves the app; its dishes and deals go with it. Past orders keep the chef id.
      await admin.from('kitchen_chefs').delete().eq('id', kitchen.id);
    }
    if (rider) await admin.from('riders').delete().eq('id', rider.id);
    await admin.from('rider_applications').delete().eq('user_id', uid);
    await admin.from('chef_applications').delete().eq('user_id', uid);
    await clearFolder('rider-documents', uid);
    await clearFolder('order-problems', uid);
    await clearFolder('kitchen-photos', uid);

    // Close the login for good. The row stays only so the anonymous orders still point somewhere.
    const { error } = await admin.auth.admin.updateUserById(uid, {
      email: `deleted-${uid}@deleted.kitchys.app`,
      email_confirm: true,
      password: crypto.randomUUID() + crypto.randomUUID(),
      user_metadata: { deleted: true },
      ban_duration: '876000h',
    });
    if (error) throw error;
    return json({ deleted: true });
  } catch (error) {
    console.error(error);
    return json({ error: 'Something went wrong' }, 500);
  }
});
