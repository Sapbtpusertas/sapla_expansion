const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();
const { searchChecks } = require("./rag_search_gemini"); // reuse function

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function chatbot(query) {
  // Step 1: Search relevant checks
  const results = await searchChecks(query, 5);

  // Step 2: Build context
  const context = results.map((r, i) =>
    `${i+1}. ${r.checkname}: ${r.command_query || "no query"}`
  ).join("\n");

  const prompt = `
You are an SAP Technical Architect assistant.
User query: "${query}"

Relevant checks from SAP Landscape Assessment:
${context}

Answer the query by referencing these checks and giving practical guidance.
`;

  // Step 3: Ask Gemini
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  console.log("Assistant:", result.response.text());
}

// Test it
chatbot("Why are my SAP transports slow?");
