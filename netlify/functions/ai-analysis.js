import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";

export async function handler(event) {
  try {
    const { customer_id, check_id, category, subcategory, evidence } = JSON.parse(event.body);

    if (!customer_id || !check_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing customer_id or check_id" }),
      };
    }

    // 1) Prompt
    const prompt = `
      You are an SAP Technical Assessment AI.
      Analyze the following evidence for customer ${customer_id}, category ${category}, subcategory ${subcategory}, check ${check_id}.
      
      Evidence:
      ${evidence}

      Output JSON with:
      - score (0-100)
      - risk_level (Low/Medium/High)
      - summary (short sentence)
      - analysis (detailed text)
    `;

    // 2) Call Gemini
    const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = {
        score: null,
        risk_level: "Unknown",
        summary: rawText.slice(0, 200),
        analysis: rawText,
      };
    }

    // 3) Insert into results table
    const { data, error } = await supabase.from("results").insert({
      customer_id,
      check_id,
      score: parsed.score,
      benchmark: null,
      delta: null,
      run_source: "ai",
      output: {
        risk_level: parsed.risk_level,
        summary: parsed.summary,
        analysis: parsed.analysis,
        ai_model: "gemini-1.5-flash",
      },
    }).select();

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ result: data[0] }),
    };
  } catch (err) {
    console.error("AI Analysis Error:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
