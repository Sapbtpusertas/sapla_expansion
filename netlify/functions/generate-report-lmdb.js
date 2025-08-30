// netlify/functions/generate-report-lmdb.js
import { adminClient, ok, bad } from './_supabase.js';

const REPORTS_BUCKET = process.env.SUPABASE_BUCKET_REPORTS || 'reports';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return bad('POST only', 405);
  const body = JSON.parse(event.body || '{}');
  const { customer_id, results } = body;
  if (!customer_id || !results) return bad('customer_id and results are required');

  const supa = adminClient();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const base = `customers/${customer_id}/reports/lmdb-eomm-${ts}`;

  const flagged = results.flagged || [];
  const csvHeader = 'Technical System,Product Version,Matched PV,EOMM,Days to EOMM,Risk';
  const csvBody = flagged.map(r => [
    (r.tech_system_display_name||'').replace(/,/g,' '),
    (r.product_version_name||'').replace(/,/g,' '),
    (r.matched_product_version||'').replace(/,/g,' '),
    (r.eomm || '').toString().slice(0,10),
    (r.days_to_eomm ?? ''),
    r.risk_band
  ].join(',')).join('\n');
  const csvContent = [csvHeader, csvBody].join('\n');

  const html = makeHtml(results);

  const csvKey = `${base}.csv`;
  const htmlKey = `${base}.html`;

  // upload
  const { error: e1 } = await supa.storage.from(REPORTS_BUCKET).upload(csvKey, Buffer.from(csvContent), { upsert: true });
  if (e1) return bad(e1.message, 500);

  const { error: e2 } = await supa.storage.from(REPORTS_BUCKET).upload(htmlKey, Buffer.from(html), { upsert: true });
  if (e2) return bad(e2.message, 500);

  const { data: csvUrl }  = supa.storage.from(REPORTS_BUCKET).getPublicUrl(csvKey);
  const { data: htmlUrl } = supa.storage.from(REPORTS_BUCKET).getPublicUrl(htmlKey);

  return ok({ csv_url: csvUrl.publicUrl, html_url: htmlUrl.publicUrl });
}

function makeHtml({ summary, flagged }) {
  // (The full HTML markup can be copied from earlier in the conversation — use a themed template.)
  // For brevity here, return a simple HTML that the frontend can open.
  const rows = flagged.map(r => `
    <tr data-band="${r.risk_band}">
      <td>${escapeHtml(r.tech_system_display_name)}</td>
      <td>${escapeHtml(r.product_version_name)}</td>
      <td>${escapeHtml(r.matched_product_version||'')}</td>
      <td>${(r.eomm||'').toString().slice(0,10)}</td>
      <td>${r.days_to_eomm ?? ''}</td>
      <td>${r.risk_band}</td>
    </tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>LMDB Assessment</title></head><body>
    <h1>LMDB Quick Assessment</h1>
    <p>Generated: ${new Date().toLocaleString()}</p>
    <p>Total: ${summary.total} — Flagged: ${summary.flagged}</p>
    <table border="1" cellpadding="6">
      <thead><tr><th>System</th><th>PV</th><th>Matched</th><th>EOMM</th><th>Days</th><th>Band</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;
}

function escapeHtml(s) { return (s||'').toString().replace(/[&<>"]/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' })[m]); }
