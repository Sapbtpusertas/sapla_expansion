import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // service role required
);

export async function handler(event) {
  try {
    const { customer_id, check_id, filename, notes } = JSON.parse(event.body);

    if (!customer_id || !check_id || !filename) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing customer_id, check_id or filename" }),
      };
    }

    // Object path → store inside customer folder
    const objectPath = `${customer_id}/${filename}`;

    // 1) Generate signed upload URL
    const { data, error } = await supabase.storage
      .from("customer-files")
      .createSignedUploadUrl(objectPath);

    if (error) throw error;

    // 2) Insert metadata into evidence table
    const { error: insertError } = await supabase
      .from("evidence")
      .insert({
        customer_id,
        check_id,
        filename,
        storage_path: objectPath,
        notes: notes || null,
      });

    if (insertError) throw insertError;

    return {
      statusCode: 200,
      body: JSON.stringify({
        url: data.signedUrl,
        path: objectPath,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
