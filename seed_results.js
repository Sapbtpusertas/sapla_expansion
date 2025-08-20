// seed_results.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

function makeScore(checkId){
  return Math.max(55, 75 + (checkId % 26)); // deterministic sample
}

async function seed() {
  const { data: checks, error } = await supabase
    .from('checks')
    .select('id,category,subcategory,checkname,datasource,command_query')
    .limit(10000);
  if (error) throw error;

  const inserts = checks.map(c => {
    const score = makeScore(c.id);
    const output = { 
      message: `Simulated output for ${c.checkname}`, 
      datasource: c.datasource, 
      sample: true 
    };
    return {
      check_id: c.id,
      output,
      score,
      benchmark: null,
      delta: null,
      run_source: 'simulated'
    };
  });

  const chunkSize = 200;
  for (let i=0;i<inserts.length;i+=chunkSize){
    const chunk = inserts.slice(i,i+chunkSize);
    const { error: e } = await supabase
      .from('results')
      .insert(chunk);
    if(e) console.error('insert error', e);
    else console.log('Inserted chunk', i);
  }
  console.log('Seeding complete');
}

seed().catch(console.error);
