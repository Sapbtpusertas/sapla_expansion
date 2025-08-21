// netlify/functions/customers-create.js
import { adminClient, ok, bad } from './_supabase.js';

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return bad('Method not allowed', 405);
    }

    const body = JSON.parse(event.body || '{}');
    const { name, industry, systems_count, notes } = body;

    if (!name) return bad('Missing required field: name');

    const supa = adminClient();
    const { data, error } = await supa
      .from('customers')
      .insert([{
        name,
        industry,
        systems_count: systems_count || 0,
        notes: notes || ''
      }])
      .select()
      .single();

    if (error) return bad(error.message, 500);

    return ok({ customer: data });
  } catch (err) {
    return bad(err.message, 500);
  }
}
