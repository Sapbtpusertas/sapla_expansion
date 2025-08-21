import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  try {
    const { customer_id, check_id } = JSON.parse(event.body);

    if (!customer_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing customer_id" }),
      };
    }

    // query evidence table
    let query = supabase
      .from("evidence")
      .select("id, check_id, filename, storage_path, uploaded_at, notes")
      .eq("customer_id", customer_id)
      .order("uploaded_at", { ascending: false });

    // optional: restrict to a specific check
    if (check_id) {
      query = query.eq("check_id", check_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ evidence: data }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
