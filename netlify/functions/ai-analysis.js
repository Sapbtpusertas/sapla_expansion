import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAIEmbeddings, GoogleGenerativeAI } from "@google/generative-ai"; 

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

export async function handler(event) {
  try {
    const { question, category } = JSON.parse(event.body);

    // fetch top N embeddings
    const embeddingModel = new GoogleGenerativeAIEmbeddings({
      model: "embedding-001",
      apiKey: process.env.GEMINI_API_KEY,
    });
    const embedding = await embeddingModel.embedContent(question);

    const { data: matches, error } = await supabase.rpc("match_checks_gemini", {
      query_embedding: embedding.embedding,
      match_count: 5,
      filter_category: category || null,
    });
    if (error) throw error;

    // build context
    const context = matches.map(m => `- ${m.category} / ${m.subcategory}: ${m.content}`).join("\n");

    // ask Gemini
    const prompt = `You are an SAP Technical Architect assistant.
Use the following context from SAP Landscape Assessment checks to answer:
${context}

Question: ${question}

Answer in clear bullet points with recommendations.`;

    const result = await model.generateContent(prompt);

    return {
      statusCode: 200,
      body: JSON.stringify({ answer: result.response.text(), sources: matches }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
