// netlify/functions/ingest-lmdb-pv.js
import { adminClient, ok, bad } from './_supabase.js';

export async function handler(event) {
  if (event.httpMethod !== "POST") return bad("POST only", 405);

  try {
    const body = JSON.parse(event.body || "{}");
    const { customer_id, dataset_type, storage_key, original_filename } = body;

    console.log("📥 Body:", body);

    if (!customer_id || !dataset_type || !storage_key || !original_filename) {
      return bad("Missing required fields");
    }

    if (dataset_type !== "lmdb_pv") return bad("Invalid dataset_type");

    const supa = adminClient();

    // only create dataset row
    const { data: ds, error } = await supa
      .from("customer_datasets")
      .insert({
        customer_id,
        dataset_type,
        storage_key,
        original_filename,
        status: "uploaded"
      })
      .select()
      .single();

    if (error) throw error;

    return ok({
      message: "Dataset row created ✅",
      dataset: ds
    });

  } catch (err) {
    console.error("💥 Error:", err);
    return bad(`${err}`, 500);
  }
}
