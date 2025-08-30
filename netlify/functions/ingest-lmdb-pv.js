// netlify/functions/ingest-lmdb-pv.js
export async function handler(event) {
  try {
    console.log("📥 ingest-lmdb-pv invoked");
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Dry run successful 🚀",
        method: event.httpMethod,
        body: event.body?.slice(0, 200)
      })
    };
  } catch (err) {
    console.error("💥 Function crash", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
}
