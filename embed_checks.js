// embed_checks.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function embed(text){
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text
    })
  });

  const j = await resp.json();
  if (!resp.ok) {
    console.error("OpenAI error:", j);
    return null;
  }

  if (!j.data || !j.data[0] || !j.data[0].embedding) {
    console.error("No embedding in response:", JSON.stringify(j));
    return null;
  }

  return j.data[0].embedding;
}


async function run(){
  const { data: checks, error } = await supabase.from('checks').select('id,checkname,command_query').limit(10000);
  if (error) throw error;
  for (const c of checks){
    const text = `${c.checkname}\n\n${c.command_query || ''}`;
    const vector = await embed(text);
    if (!vector) { console.error('no vector for', c.id); continue; }
    const { error: e } = await supabase.from('embeddings').insert({
      check_id: c.id,
      content: text,
      metadata: { checkname: c.checkname },
      embedding: vector
    });
    if (e) console.error('insert embedding error', e);
    else console.log('embedded', c.id);
  }
  console.log('done');
}
run().catch(console.error);
