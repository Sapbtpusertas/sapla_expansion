// netlify/functions/quick-assessment.js
import { adminClient, ok, bad } from './_supabase.js';

export async function handler(event) {
  try {
    if (event.httpMethod !== "GET") return bad("GET only", 405);

    const customer_id = (event.queryStringParameters || {}).customer_id;
    if (!customer_id) return bad("customer_id required");

    const supa = adminClient();

    const { data, error } = await supa
      .from("v_quick_assessment")
      .select("*")
      .eq("customer_id", customer_id);

    if (error) return bad(error.message, 500);

    return ok({ rows: data || [] });
  } catch (err) {
    console.error("❌ quick-assessment function error", err);
    return bad(err.message || "Unexpected error", 500);
  }
}
