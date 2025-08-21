import { adminClient, ok, bad } from './_supabase.js';

export async function handler(event) {
  const customer_id = (event.queryStringParameters || {}).customer_id;
  if (!customer_id) return bad('customer_id required');

  const supa = adminClient();

  const { data, error } = await supa
    .from('v_customer_coverage')
    .select('*')
    .eq('customer_id', customer_id);

  if (error) return bad(error.message, 500);

  return ok({ coverage: data });
}
