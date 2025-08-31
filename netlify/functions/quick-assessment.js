// netlify/functions/quick-assessment.js
import { adminClient, ok, bad } from './_supabase.js';

export async function handler(event) {
  const customer_id = (event.queryStringParameters || {}).customer_id;
  if (!customer_id) return bad("customer_id required");

  const supa = adminClient();

  try {
    // 1) Raw rows (detailed assessment)
    const { data: rows, error: e1 } = await supa
      .from('v_quick_assessment')
      .select('*')
      .eq('customer_id', customer_id);

    if (e1) return bad(e1.message, 500);

    // 2) Summary counts (aggregated by status)
    const { data: summary, error: e2 } = await supa
      .from('v_quick_assessment_summary')
      .select('*')
      .eq('customer_id', customer_id);

    if (e2) return bad(e2.message, 500);

    return ok({
      rows: rows || [],
      summary: summary || []
    });

  } catch (err) {
    return bad(`Server error: ${err.message}`, 500);
  }
}
