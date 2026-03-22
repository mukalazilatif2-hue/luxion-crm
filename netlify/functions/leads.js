const { getDb, ok, err, pre } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return pre();
  const sql = getDb();
  const id = event.queryStringParameters?.id ? parseInt(event.queryStringParameters.id) : null;

  try {
    if (event.httpMethod === 'GET') {
      const rows = await sql`SELECT * FROM leads ORDER BY created_at DESC`;
      return ok(rows.map(r => ({
        id:r.id, org:r.org, contact:r.contact, phone:r.phone,
        email:r.email, svc:r.svc, val:r.val, stage:r.stage,
        src:r.src, demo:r.demo, prop:r.prop, act:r.act,
        date: r.follow_date ? String(r.follow_date).slice(0,10) : '',
        notes:r.notes,
      })));
    }
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      if (!b.org) return err('org is required');
      const [r] = await sql`
        INSERT INTO leads (org,contact,phone,email,svc,val,stage,src,demo,prop,act,follow_date,notes)
        VALUES (${b.org},${b.contact||null},${b.phone||null},${b.email||null},
                ${b.svc||null},${b.val||0},${b.stage||'Lead'},${b.src||null},
                ${b.demo||'No'},${b.prop||'No'},${b.act||null},
                ${b.date||null},${b.notes||null})
        RETURNING *`;
      return ok({...r, date: r.follow_date ? String(r.follow_date).slice(0,10) : ''}, 201);
    }
    if (event.httpMethod === 'PUT') {
      if (!id) return err('id required');
      const b = JSON.parse(event.body || '{}');
      const [r] = await sql`
        UPDATE leads SET
          org=${b.org},contact=${b.contact||null},phone=${b.phone||null},
          email=${b.email||null},svc=${b.svc||null},val=${b.val||0},
          stage=${b.stage||'Lead'},src=${b.src||null},demo=${b.demo||'No'},
          prop=${b.prop||'No'},act=${b.act||null},follow_date=${b.date||null},
          notes=${b.notes||null},updated_at=NOW()
        WHERE id=${id} RETURNING *`;
      if (!r) return err('Not found', 404);
      return ok({...r, date: r.follow_date ? String(r.follow_date).slice(0,10) : ''});
    }
    if (event.httpMethod === 'DELETE') {
      if (!id) return err('id required');
      await sql`DELETE FROM leads WHERE id=${id}`;
      return ok({ deleted: true });
    }
    return err('Method not allowed', 405);
  } catch(e) {
    return err('Server error: ' + e.message, 500);
  }
};
