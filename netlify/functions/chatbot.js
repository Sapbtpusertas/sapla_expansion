// netlify/functions/chatbot.js
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE // ⚠️ service role, keep secret in Netlify env
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- Embed query with Gemini ---
async function embedQuery(text) {
  const model = genAI.getGenerativeModel({ model: "embedding-001" });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// --- Similarity search via Supabase RPC ---
async function searchChecks(query, topK = 5) {
  const vector = await embedQuery(query);
  const { data, error } = await supabase.rpc('match_checks_gemini', {
    query_embedding: vector,
    match_count: topK
  });
  if (error) throw error;
  return data;
}

// --- Chatbot handler ---
exports.handler = async (event) => {
  try {
    const { query } = JSON.parse(event.body || "{}");
    if (!query) {
      return { statusCode: 400, body: "Missing query" };
    }

    // Step 1: Retrieve top matches
    const results = await searchChecks(query, 5);

    // Step 2: Build context
    const context = results.map((r, i) =>
      `${i+1}. ${r.checkname}: ${r.command_query || "no command"}`
    ).join("\n");

    const prompt = `
You are an SAP Technical Architect assistant.
User query: "${query}"

Relevant checks from SAP Landscape Assessment:
${context}

Answer the query by referencing these checks and giving practical SAP guidance.
`;

    // Step 3: Ask Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);

    return {
      statusCode: 200,
      body: JSON.stringify({
        answer: result.response.text(),
        sources: results
      })
    };
  } catch (err) {
    console.error("Chatbot error:", err);
    return { statusCode: 500, body: err.message };
  }
};
