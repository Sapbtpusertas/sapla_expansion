// netlify/functions/dataset-rows.js
import { adminClient, ok, bad } from './_supabase.js';

export async function handler(event) {
  if (event.httpMethod !== 'GET') return bad('GET only', 405);

  const { customer_id, dataset_type } = event.queryStringParameters || {};
  if (!customer_id || !dataset_type) {
    return bad("Missing customer_id or dataset_type", 400);
  }

  const supa = adminClient();

  // get latest dataset id for that type
  const { data: ds, error: e1 } = await supa
    .from('customer_datasets')
    .select('id')
    .eq('customer_id', customer_id)
    .eq('dataset_type', dataset_type)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (e1) return bad(e1.message, 500);
  if (!ds) return ok({ rows: [] });

  // fetch rows
  const { data: rows, error: e2 } = await supa
    .from('customer_product_versions')
    .select('*')
    .eq('source_dataset_id', ds.id)
    .limit(200); // safety cap

  if (e2) return bad(e2.message, 500);

  return ok({ rows });
}
