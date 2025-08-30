// scripts/import_master_pv.js
import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import pkg from '@supabase/supabase-js';

dotenv.config();
const { createClient } = pkg;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Helper to safely parse date (SAP CSV uses DD.MM.YYYY or empty)
function parseDate(str) {
  if (!str || !str.trim()) return null;
  const [d, m, y] = str.split('.');
  if (!y) return null;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`; // YYYY-MM-DD
}

async function run() {
  try {
    const filePath = path.join(process.cwd(), 'assets', 'All_SAP_PV.csv');
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Parse CSV robustly
    const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    delimiter: ';',     // ✅ SAP CSV uses semicolon
    relax_quotes: true  // ✅ tolerate SAP quirks
    });


    console.log(`Read ${records.length} rows from All_SAP_PV.csv`);

    // Map only to columns in your table
    const cleaned = records.map(r => ({
      product_version: r['Product Version'] || null,
      official_name: r['Official Name'] || null,
      product: r['Product'] || null,
      product_line: r['Product Line'] || null,
      product_category: r['Product Category'] || null,
      current_status: r['Current Status'] || null,
      readiness_status_for_sap_hana: r['Readiness Status for SAP HANA'] || null,
      readiness_date_for_sap_hana: parseDate(r['Readiness Date for SAP HANA']),
      end_of_mainstream_maintenance: parseDate(r['End of mainstream maintenance']),
      end_of_extended_maintenance: parseDate(r['End of extended maintenance']),
      end_of_priority_one_support: parseDate(r['End of Priority-One Support']),
      source: r, // dump full raw row for reference
      loaded_at: new Date().toISOString()
    }));

    console.log(`Prepared ${cleaned.length} cleaned rows`);

    // Wipe old data
    const { error: delError } = await supabase
      .from('all_sap_pv_current')
      .delete()
      .neq('product_version', '');
    if (delError) throw delError;

    // Insert new
    const { error: insError, count } = await supabase
      .from('all_sap_pv_current')
      .insert(cleaned, { count: 'exact' });
    if (insError) throw insError;

    console.log(`✅ Inserted ${count} rows into master.all_sap_pv_current`);
  } catch (err) {
    console.error('Import failed:', err);
    process.exit(1);
  }
}

run();
