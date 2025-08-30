// netlify/functions/ingest-lmdb-pv.js
import { ok, bad } from './_supabase.js';

export async function handler(event) {
  console.log("🚀 ingest-lmdb-pv invoked", event.httpMethod);

  if (event.httpMethod !== "POST") return bad("POST only", 405);

  try {
    const body = JSON.parse(event.body || "{}");
    console.log("📥 Parsed body (dry-run):", body);

    return ok({
      message: "Dry run successful 🚀",
      received: body
    });
  } catch (err) {
    console.error("💥 Error parsing body:", err);
    return bad(`Crash: ${err}`, 500);
  }
}
