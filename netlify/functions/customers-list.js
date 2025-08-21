// netlify/functions/customers-list.js
import { adminClient, ok, bad } from './_supabase.js';

export async function handler() {
  try {
    const supa = adminClient();

    const { data, error } = await supa
      .from('customers')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) return bad(error.message, 500);

    return ok({ customers: data });
  } catch (err) {
    return bad(err.message, 500);
  }
}
