// netlify/functions/quick-assessment.js
import { adminClient, ok, bad } from './_supabase.js';

export async function handler(event) {
  try {
    const customer_id = (event.queryStringParameters || {}).customer_id;
    if (!customer_id) return bad("customer_id required");

    const supa = adminClient();

    // Query the new view
    const { data, error } = await supa
      .from("v_quick_assessment")
      .select("*")
      .eq("customer_id", customer_id);

    if (error) return bad(error.message, 500);

    return ok({
      customer_id,
      row_count: data.length,
      records: data
    });

  } catch (err) {
    console.error("quick-assessment error", err);
    return bad(err.message || "Unknown error", 500);
  }
}
