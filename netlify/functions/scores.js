import { adminClient, ok, bad } from './_supabase.js';

export async function handler(event) {
  const customer_id = (event.queryStringParameters || {}).customer_id;
  if (!customer_id) return bad('customer_id required');

  const supa = adminClient();

  // scores by category
  const { data: cat, error: e1 } = await supa
    .from('v_scores_by_category')
    .select('*')
    .eq('customer_id', customer_id);

  if (e1) return bad(e1.message, 500);

  // latest result row (instead of missing "analyses" table)
  const { data: an, error: e2 } = await supa
    .from('results')
    .select('*')
    .eq('customer_id', customer_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (e2) return bad(e2.message, 500);

  return ok({ by_category: cat, latest_result: an });
}
