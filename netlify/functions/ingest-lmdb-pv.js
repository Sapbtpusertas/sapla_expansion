// netlify/functions/ingest-lmdb-pv.js
import { adminClient } from "./_supabase.js";

export async function handler(event) {
  try {
    console.log("📥 ingest-lmdb-pv invoked");

    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "POST only" };
    }

    const body = JSON.parse(event.body || "{}");
    const { customer_id, dataset_type, storage_key, original_filename } = body;

    const supa = adminClient();

    // Create dataset row
    const { data, error } = await supa.from("customer_datasets").insert({
      customer_id,
      dataset_type,
      storage_key,
      original_filename,
      status: "uploaded",
    }).select().single();

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Dataset row created ✅",
        dataset: data,
      }),
    };
  } catch (err) {
    console.error("💥 Function crash", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
