// netlify/functions/dataset-rows.js
import { adminClient, ok, bad } from './_supabase.js';

export async function handler(event) {
  try {
    const { customer_id, dataset_type, summary } = event.queryStringParameters || {};
    if (!customer_id || !dataset_type) {
      return bad("Missing params: customer_id, dataset_type");
    }

    const supa = adminClient();

    if (summary) {
      // just return count + latest upload
      const { data, error } = await supa
        .from('customer_datasets')
        .select('id, created_at, row_count')
        .eq('customer_id', customer_id)
        .eq('dataset_type', dataset_type)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) return bad(error.message, 500);
      return ok({ summary: data && data.length ? data[0] : null });
    }

    // full rows
    const { data: rows, error } = await supa
      .from('customer_product_versions')
      .select('*')
      .eq('customer_id', customer_id);

    if (error) return bad(error.message, 500);
    return ok({ rows });
  } catch (err) {
    return bad(err.message, 500);
  }
}
