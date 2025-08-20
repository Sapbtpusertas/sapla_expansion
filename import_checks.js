// import_checks.js
const fs = require('fs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const CSV_FILE = process.env.CSV_FILE || 'expanded_checks.csv';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function importCSV() {
  const rows = [];
  fs.createReadStream(CSV_FILE)
    .pipe(csv())
    .on('data', (data) => rows.push(data))
    .on('end', async () => {
      console.log(`Read ${rows.length} rows — inserting in batches...`);
      const payload = rows.map(r => ({
        category: r.Category || r['Assessment Category'],
        subcategory: r.Subcategory || r['Assessment Subcategory'],
        checkname: r.CheckName || r['Assessment Point'],
        datasource: r.DataSource || r['Prerequisites/DataSources'],
        command_query: r['Command/Report/Query'] || r['Commands / API Calls'],
        parser_fields: r.Parser_Fields || null,
        suggested_weight: r.SuggestedWeight || r['Weightage'] || 0,
        automation_level: r.AutomationLevel || r['Automation Level'],
        ai_capability: r.AI_Capability || r['AI Capability'],
        risk_level: r.RiskLevel || r['Risk Level'],
        prerequisites: r['Prerequisites/DataSources'] || null,
        notes: r.Notes || r['Rationale'] || null
      }));

      const { data, error } = await supabase
        .from('checks')       // since your tables are in public schema
        .insert(payload)
        .select();             // ✅ force returning rows

      if (error) {
        console.error('Insert error', error);
      } else {
        console.log(`Inserted ${data.length} rows`);
      }
    });
}

importCSV().catch(console.error);
