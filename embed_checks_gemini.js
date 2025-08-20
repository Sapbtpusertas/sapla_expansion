// embed_checks_gemini.js
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });

async function embed(text) {
  try {
    const result = await embeddingModel.embedContent(text);
    return result.embedding.values; // array of floats (768 length)
  } catch (err) {
    console.error("Gemini embed error:", err.message);
    return null;
  }
}

async function run() {
  // Fetch checks from Supabase
  const { data: checks, error } = await supabase
    .from('checks')
    .select('id, checkname, command_query')
    .limit(1000);

  if (error) {
    console.error("Fetch error:", error);
    return;
  }

  console.log(`Read ${checks.length} checks`);

  for (const c of checks) {
    const text = `${c.checkname}\n${c.command_query || ""}`.slice(0, 2000); // safety truncate
    const vector = await embed(text);

    if (!vector) {
      console.log(`Skipping ${c.id} (no vector)`);
      continue;
    }

    const { error: insertErr } = await supabase
      .from('embeddings_gemini')
      .insert({
        check_id: c.id,
        content: text,
        metadata: { source: "checks" },
        embedding: vector
      });

    if (insertErr) {
      console.error(`Insert error for ${c.id}:`, insertErr);
    } else {
      console.log(`Inserted embedding for check ${c.id}`);
    }
  }

  console.log("done");
}

run();
