// netlify/functions/_supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function adminClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
  });
}

export function ok(data, status = 200) {
  return {
    statusCode: status,
    body: JSON.stringify(data)
  };
}

export function bad(message, status = 400) {
  return {
    statusCode: status,
    body: JSON.stringify({ error: message })
  };
}
