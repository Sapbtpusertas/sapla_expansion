// netlify/functions/ingest-lmdb-pv.js
import { adminClient, ok, bad } from './_supabase.js';
import fetch from 'node-fetch';
import * as XLSX from 'xlsx';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return bad('POST only', 405);

  try {
    const body = JSON.parse(event.body || '{}');
    const { customer_id, dataset_type, storage_key, original_filename } = body;

    if (!customer_id || !dataset_type || !storage_key || !original_filename) {
      return bad('Missing fields: customer_id, dataset_type, storage_key, original_filename');
    }
    if (dataset_type !== 'lmdb_pv') {
      return bad('Invalid dataset_type for this endpoint');
    }

    const supa = adminClient();

    // 1) Create dataset row
    const { data: ds, error: e0 } = await supa
      .from('customer_datasets')
      .insert({
        customer_id,
        dataset_type,
        storage_key,
        original_filename,
        status: 'uploaded'
      })
      .select()
      .single();

    if (e0) return bad(e0.message, 500);

    // 2) Download file from Supabase storage
    const downloadUrl = `${process.env.SUPABASE_URL}/storage/v1/object/${process.env.SUPABASE_BUCKET_DATASETS}/${storage_key}`;
    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` }
    });
    if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);

    const buf = Buffer.from(await res.arrayBuffer());

    // 3) Parse with XLSX
    const wb = XLSX.read(buf, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: null });

    console.log(`📊 Parsed ${rows.length} rows from ${original_filename}`);

    // 4) Prepare inserts
    const inserts = rows
      .map(r => ({
        customer_id,
        source_dataset_id: ds.id,
        tech_system_display_name:
          (r['Technical System Display Name'] ?? r['Technical System'] ?? '').toString(),
        product_version_name:
          (r['Product Version Name'] ?? r['Product Version'] ?? '').toString(),
        raw: r
      }))
      .filter(x => x.product_version_name && x.tech_system_display_name);

    // 5) Delete previous rows for this dataset
    await supa.from('customer_product_versions').delete().match({ source_dataset_id: ds.id });

    // 6) Insert in chunks
    let inserted = 0;
    const chunk = 500;
    for (let i = 0; i < inserts.length; i += chunk) {
      const part = inserts.slice(i, i + chunk);
      const { error: e2 } = await supa.from('customer_product_versions').insert(part);
      if (e2) throw e2;
      inserted += part.length;
    }

    // 7) Update dataset row
    await supa
      .from('customer_datasets')
      .update({ status: 'parsed', row_count: inserted })
      .eq('id', ds.id);

    return ok({ message: '✅ Parsed and stored', dataset_id: ds.id, inserted });
  } catch (err) {
    console.error('❌ Ingest failed:', err);
    return bad(err.message || String(err), 500);
  }
}
