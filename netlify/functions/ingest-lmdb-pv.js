// netlify/functions/ingest-lmdb-pv.js
import { adminClient, ok, bad } from './_supabase.js';
import * as XLSX from 'xlsx';

export async function handler(event) {
  if (event.httpMethod !== "POST") return bad("POST only", 405);

  try {
    const body = JSON.parse(event.body || "{}");
    const { customer_id, dataset_type, storage_key, original_filename } = body;

    if (!customer_id || !dataset_type || !storage_key || !original_filename) {
      return bad("Missing required fields");
    }
    if (dataset_type !== "lmdb_pv") return bad("Invalid dataset_type");

    const supa = adminClient();

    // Step 1: insert dataset row
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

    // Step 2: download the file from Supabase storage
    const downloadUrl = `${process.env.SUPABASE_URL}/storage/v1/object/${process.env.SUPABASE_BUCKET_DATASETS}/${storage_key}`;
    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

    const buf = Buffer.from(await res.arrayBuffer());

    // Step 3: parse with XLSX
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

    console.log("🔎 First row keys:", Object.keys(rows[0] || {}));
    console.log("🔎 Sample row:", rows[0]);

    // Step 4: update dataset row (parsed but not inserted)
    await supa.from("customer_datasets")
      .update({ status: "parsed", row_count: rows.length })
      .eq("id", ds.id);

    return ok({
      message: "Parsed file ✅ (dry run, no inserts yet)",
      dataset_id: ds.id,
      row_count: rows.length,
      sample: rows[0]
    });

  } catch (err) {
    console.error("💥 Ingest error:", err);
    return bad(`${err}`, 500);
  }
}
