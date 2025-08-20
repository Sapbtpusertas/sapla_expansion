// rag_search_gemini.js
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function embedQuery(text) {
  const model = genAI.getGenerativeModel({ model: "embedding-001" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

async function searchChecks(query, topK = 5) {
  const vector = await embedQuery(query);

  const { data, error } = await supabase.rpc('match_checks_gemini', {
    query_embedding: vector,
    match_count: topK
  });

  if (error) throw error;
  return data;
}

async function run() {
  const query = "Why are my SAP transports slow?";
  const results = await searchChecks(query);

  console.log("Top matches for query:", query);
  results.forEach((r, i) => {
    console.log(`#${i+1}: ${r.checkname} (score ${r.similarity.toFixed(4)})`);
  });
}

run();
