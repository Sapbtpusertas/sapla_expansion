import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role required
);

export async function handler(event) {
  try {
    const { customer_id, filename } = JSON.parse(event.body);

    // ensure both required
    if (!customer_id || !filename) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing customer_id or filename" }),
      };
    }

    // object path inside bucket
    const objectPath = `${customer_id}/${filename}`;

    // generate signed URL valid for 5 minutes
    const { data, error } = await supabase
      .storage
      .from("customer-files")
      .createSignedUrl(objectPath, 60 * 5);

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ url: data.signedUrl }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
