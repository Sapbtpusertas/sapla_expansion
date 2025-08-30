// netlify/functions/quick-assessment-lmdb.js
import { adminClient, ok, bad } from './_supabase.js';

export async function handler(event) {
  const customer_id = (event.queryStringParameters || {}).customer_id;
  if (!customer_id) return bad('customer_id required');

  const supa = adminClient();

  const { data, error } = await supa
    .from('v_lmdb_eomm_risk')
    .select('*')
    .eq('customer_id', customer_id);

  if (error) return bad(error.message, 500);

  const flagged = (data || []).filter(r => ['expired','urgent','soon'].includes(r.risk_band))
    .map(r => ({
      tech_system_display_name: r.tech_system_display_name,
      product_version_name: r.product_version_name,
      matched_product_version: r.matched_product_version,
      eomm: r.eomm,
      days_to_eomm: r.days_to_eomm,
      risk_band: r.risk_band
    }));

  const summary = {
    total: data.length,
    flagged: flagged.length,
    bands: {
      expired: flagged.filter(x => x.risk_band === 'expired').length,
      urgent: flagged.filter(x => x.risk_band === 'urgent').length,
      soon: flagged.filter(x => x.risk_band === 'soon').length
    },
    generated_at: new Date().toISOString()
  };

  return ok({ summary, flagged, all_count: data.length });
}
