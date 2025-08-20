// netlify/functions/run-command.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const { check_id, checkname } = body;

    let q = supabase.from('checks').select('*').limit(1);
    if (check_id) q = q.eq('id', check_id);
    else if (checkname) q = q.eq('checkname', checkname);
    else return { statusCode: 400, body: JSON.stringify({ error: 'check_id or checkname required' }) };

    const { data: checks, error: err } = await q;
    if (err) throw err;
    if (!checks || checks.length === 0) return { statusCode: 404, body: JSON.stringify({ error: 'check not found' }) };
    const check = checks[0];

    const { data: results } = await supabase
      .from('results')
      .select('*')
      .eq('check_id', check.id)
      .order('created_at', { ascending: false })
      .limit(1);

    let result = (results && results[0]) || null;

    if (!result) {
      // create a simulated result if none exists
      const score = 80 + (check.id % 20);
      const newRes = {
        check_id: check.id,
        output: { message: `Simulated output for ${check.checkname}`, sample: true },
        score,
        benchmark: null,
        delta: null,
        run_source: 'simulated'
      };
      const { data: inserted } = await supabase.from('results').insert(newRes).select().limit(1);
      result = inserted && inserted[0];
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ check, result })
    };

  } catch (e) {
    console.error(e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message || e }) };
  }
};
