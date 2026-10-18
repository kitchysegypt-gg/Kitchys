import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from './auth';
import type { ProblemKind, ProblemStatus } from './problems';
import { supabase } from './supabase';

export type PendingDish = {
  id: string;
  name: string;
  description: string;
  ingredients: string;
  price: number;
  category: string;
  photo_url: string | null;
  photo_urls: string[] | null;
  kitchen: string;
  area: string | null;
  submitted_at: string;
};

export type AdminProblem = {
  id: string;
  order_id: string;
  order: string;
  kind: ProblemKind;
  details: string;
  photo_path: string | null;
  status: ProblemStatus;
  refund: number;
  created_at: string;
  total: number;
  items: { name: string; quantity: number }[];
  kitchen: string | null;
  customer_phone: string | null;
  rider: string | null;
};

export type AdminDashboard = {
  pending_dishes: PendingDish[];
  problems: AdminProblem[];
  today: { orders: number; open: number; delivered: number; cancelled: number };
};

/** True for the Kitchy's admin account (kitchysegypt@gmail.com). The database checks it again. */
export function useIsAdmin() {
  const { session } = useAuth();
  const [admin, setAdmin] = useState(false);
  useEffect(() => {
    if (!session) {
      setAdmin(false);
      return;
    }
    supabase.rpc('is_admin').then(({ data, error }) => setAdmin(!error && data === true));
  }, [session]);
  return admin;
}

export function useAdminDashboard() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const res = await supabase.rpc('admin_dashboard');
    setLoading(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setError(null);
    const d = res.data as AdminDashboard;
    setData({
      ...d,
      pending_dishes: d.pending_dishes.map((x) => ({ ...x, price: Number(x.price) })),
      problems: d.problems.map((p) => ({ ...p, total: Number(p.total), refund: Number(p.refund) })),
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload])
  );

  return { data, loading, error, reload };
}

export async function reviewDish(dishId: string, approve: boolean, note?: string) {
  const { error } = await supabase.rpc('admin_review_dish', { p_dish: dishId, p_approve: approve, p_note: note ?? null });
  if (error) throw error;
}

/** Refunds the amount as Kitchy's credit (0 closes it without a refund) and tells the customer. */
export async function resolveProblem(problemId: string, refund: number, note?: string) {
  const { error } = await supabase.rpc('admin_resolve_problem', { p_problem: problemId, p_refund: refund, p_note: note ?? null });
  if (error) throw error;
}

/** A short-lived link to the customer's private photo. */
export async function problemPhotoUrl(path: string) {
  const { data } = await supabase.storage.from('order-problems').createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}
