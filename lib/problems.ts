import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { Order } from './orders';
import { isDemo, supabase } from './supabase';

/** What went wrong with an order (matches order_problems.kind). */
export const PROBLEM_KINDS = ['missing', 'wrong', 'cold', 'spilled', 'late', 'quality', 'other'] as const;
export type ProblemKind = (typeof PROBLEM_KINDS)[number];
export type ProblemStatus = 'open' | 'refunded' | 'closed';

/** Days after delivery a customer can still report a problem (the database checks this too). */
const REPORT_DAYS = 3;

export function canReportProblem(order: Order) {
  if (order.status === 'on_the_way') return true;
  if (order.status !== 'delivered') return false;
  const at = new Date(order.delivered_at ?? order.created_at).getTime();
  return Date.now() - at < REPORT_DAYS * 24 * 60 * 60 * 1000;
}

/** The customer's reported problems by order id, refreshed whenever the screen is shown. */
export function useOrderProblems(refreshKey: unknown) {
  const [byOrder, setByOrder] = useState<Record<string, ProblemStatus>>({});
  useFocusEffect(
    useCallback(() => {
      let live = true;
      supabase
        .from('order_problems')
        .select('order_id, status')
        .then(({ data, error }) => {
          if (!live || error || !data) return;
          setByOrder(Object.fromEntries((data as { order_id: string; status: ProblemStatus }[]).map((r) => [r.order_id, r.status])));
        });
      return () => {
        live = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refreshKey])
  );
  return byOrder;
}

/** Uploads the photo to the private order-problems bucket (the customer's own folder). */
async function uploadProblemPhoto(uri: string | null): Promise<string | null> {
  if (!uri) return null;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Sign in first');
  if (isDemo) return `${userId}/problem-demo.jpg`;
  const response = await fetch(uri);
  const body = await response.arrayBuffer();
  const type = response.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  const ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}/problem-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('order-problems').upload(path, body, { contentType: type });
  if (error) throw error;
  return path;
}

export async function reportOrderProblem(input: { orderId: string; kind: ProblemKind; details: string; photo: string | null }) {
  const photoPath = await uploadProblemPhoto(input.photo);
  const { data, error } = await supabase.rpc('report_order_problem', {
    p_order: input.orderId,
    p_kind: input.kind,
    p_details: input.details.trim(),
    p_photo: photoPath,
  });
  if (error) throw error;
  // Emails the Kitchy's team (a failed email doesn't undo the report).
  supabase.functions.invoke('kitchen-requests', { body: { kind: 'problem', id: data } }).catch(() => null);
}
