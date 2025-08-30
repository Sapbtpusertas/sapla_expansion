// netlify/functions/ingest-lmdb-pv.js
import { adminClient, ok, bad } from './_supabase.js';
import * as XLSX from 'xlsx';

export async function handler(event) {
  try {
    console.log("📥 ingest-lmdb-pv invoked", {
      method: event.httpMethod,
      bodyLength: event.body?.length,
      rawBody: event.body?.slice(0, 200)  // first 200 chars for debug
    });

    if (event.httpMethod !== "POST") {
      console.log("❌ Wrong method");
      return bad("POST only", 405);
    }

    let body;
    try {
      body = JSON.parse(event.body || "{}");
    } catch (parseErr) {
      console.error("❌ JSON parse failed", parseErr);
      return bad("Invalid JSON body", 400);
    }

    console.log("✅ Parsed body:", body);
    const { customer_id, dataset_type, storage_key, original_filename } = body;
    if (!customer_id || !dataset_type || !storage_key || !original_filename) {
      console.error("❌ Missing fields");
      return bad("Missing fields: customer_id, dataset_type, storage_key, original_filename", 400);
    }

    if (dataset_type !== "lmdb_pv") {
      console.error("❌ Wrong dataset_type:", dataset_type);
      return bad("Invalid dataset_type", 400);
    }

    // 🔴 TEMP: stop here just to verify function works
    return ok({ message: "Dry run successful 🚀", received: body });
  } catch (err) {
    console.error("💥 Fatal error in handler", err);
    return bad("Unhandled error: " + err.message, 500);
  }
}
