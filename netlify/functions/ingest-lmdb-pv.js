// netlify/functions/ingest-lmdb-pv.js
import { adminClient, ok, bad } from './_supabase.js';
import fetch from 'node-fetch';
import * as XLSX from 'xlsx';

export async function handler(event) {
  console.log("🚀 ingest-lmdb-pv invoked");

  if (event.httpMethod !== "POST") return bad("POST only", 405);

  try {
    const body = JSON.parse(event.body || "{}");
    console.log("📥 Parsed body:", body);

    const { customer_id, dataset_type, storage_key, original_filename } = body;

    if (!customer_id || !dataset_type || !storage_key || !original_filename) {
      console.error("❌ Missing fields", body);
      return bad("Missing fields: customer_id, dataset_type, storage_key, original_filename");
    }
    if (dataset_type !== "lmdb_pv") {
      return bad("Invalid dataset_type for this endpoint");
    }

    const supa = adminClient();
    console.log("🔑 Supabase client initialized");

    // 1) create dataset row
    const { data: ds, error: e0 } = await supa
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

    if (e0) {
      console.error("❌ Insert error:", e0);
      return bad(e0.message, 500);
    }

    console.log("✅ Dataset row inserted:", ds);

    // 2) download file from Supabase storage
    const downloadUrl = `${process.env.SUPABASE_URL}/storage/v1/object/${process.env.SUPABASE_BUCKET_DATASETS}/${storage_key}`;
    console.log("⬇️ Downloading from:", downloadUrl);

    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

    const buf = Buffer.from(await res.arrayBuffer());
    console.log("📂 File downloaded, size:", buf.length);

    // 3) parse Excel
    const wb = XLSX.read(buf, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

    console.log("📝 Parsed rows:", rows.length);
    if (rows.length > 0) {
      console.log("Row sample:", rows[0]);
      console.log("Headers:", Object.keys(rows[0]));
    }

    // Prepare inserts
    const inserts = rows
      .map(r => ({
        customer_id,
        source_dataset_id: ds.id,
        tech_system_display_name: (r["Technical System Display Name"] ?? r["Technical System"] ?? "").toString(),
        product_version_name: (r["Product Version Name"] ?? r["Product Version"] ?? "").toString(),
        raw: r
      }))
      .filter(x => x.product_version_name && x.tech_system_display_name);

    console.log("Prepared inserts:", inserts.slice(0, 3));

    // delete previous rows for this dataset
    await supa.from("customer_product_versions").delete().match({ source_dataset_id: ds.id });

    // insert in chunks
    let inserted = 0;
    const chunk = 500;
    for (let i = 0; i < inserts.length; i += chunk) {
      const part = inserts.slice(i, i + chunk);
      const { error: e2 } = await supa.from("customer_product_versions").insert(part);
      if (e2) throw e2;
      inserted += part.length;
    }

    console.log(`✅ Inserted ${inserted} product versions`);

    // update dataset row
    await supa
      .from("customer_datasets")
      .update({ status: "parsed", row_count: inserted })
      .eq("id", ds.id);

    return ok({ dataset_id: ds.id, inserted });
  } catch (err) {
    console.error("💥 ingest-lmdb-pv crashed:", err);
    return bad(`${err}`, 500);
  }
}
