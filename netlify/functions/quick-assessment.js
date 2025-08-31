// netlify/functions/quick-assessment.js
import { adminClient, ok, bad } from './_supabase.js';

export async function handler(event) {
  try {
    const customer_id = (event.queryStringParameters || {}).customer_id;
    if (!customer_id) return bad("customer_id required");

    const supa = adminClient();

    // pull from v_quick_assessment
    const { data, error } = await supa
      .from('v_quick_assessment')
      .select('*')
      .eq('customer_id', customer_id);

    if (error) {
      console.error("❌ Supabase error:", error);
      return bad(error.message, 500);
    }

    if (!data || data.length === 0) {
      console.warn("⚠️ No quick assessment rows found for", customer_id);
      return ok({ rows: [] });
    }

    console.log(`✅ Quick assessment returned ${data.length} rows`);
    return ok({ rows: data });
  } catch (err) {
    console.error("❌ quick-assessment handler failed:", err);
    return bad(err.message || "Server error", 500);
  }
}
