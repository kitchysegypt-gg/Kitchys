import { supabase } from './supabase';

export type Review = {
  id: string;
  chef_id: string;
  order_id: string;
  user_id: string;
  reviewer_name: string;
  food: number;
  delivery: number;
  packaging: number;
  value: number;
  comment: string;
  created_at: string;
};

export type NewReview = Pick<Review, 'chef_id' | 'order_id' | 'food' | 'delivery' | 'packaging' | 'value' | 'comment'>;

export const RATING_PARTS = [
  { key: 'food', label: 'ratingFood', emoji: 'pot' },
  { key: 'delivery', label: 'ratingDelivery', emoji: 'scooter' },
  { key: 'packaging', label: 'ratingPackaging', emoji: 'bags' },
  { key: 'value', label: 'ratingValue', emoji: 'coin' },
] as const;

export async function fetchChefReviews(chefId: string) {
  const { data, error } = await supabase
    .from('chef_reviews')
    .select('*')
    .eq('chef_id', chefId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Review[];
}

/** Reviews the signed-in customer already wrote, to mark orders as rated. */
export async function fetchMyReviews(userId: string) {
  const { data, error } = await supabase.from('chef_reviews').select('*').eq('user_id', userId);
  if (error) throw error;
  return (data ?? []) as Review[];
}

export async function submitReview(review: NewReview) {
  // The database checks the order is the customer's own and included this chef's food.
  const { error } = await supabase.from('chef_reviews').insert(review);
  if (error) throw error;
}
