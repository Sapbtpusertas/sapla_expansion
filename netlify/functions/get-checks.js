import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // use service key on server side
);

export async function handler(event) {
  try {
    const { category, subcategory } = JSON.parse(event.body);

    let query = supabase.from("checks").select("*");
    if (category) query = query.eq("category", category);
    if (subcategory) query = query.eq("subcategory", subcategory);

    const { data, error } = await query;
    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ rows: data }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
