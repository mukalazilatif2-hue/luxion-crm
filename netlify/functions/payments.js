const { getDb, ok, err, pre } = require('./_db');

const toFront = r => ({
  id:r.id, client:r.client, svc:r.svc,
  total:r.total, deposit:r.deposit, balPaid:r.bal_paid,
  depDate:  r.dep_date   ? String(r.dep_date).slice(0,10)   : '',
  balDate:  r.bal_date   ? String(r.bal_date).slice(0,10)   : '',
  method:r.method,
  start:    r.start_date ? String(r.start_date).slice(0,10) : '',
  end:      r.end_date   ? String(r.end_date).slice(0,10)   : '',
  nextDue:  r.next_due   ? String(r.next_due).slice(0,10)   : '',
  notes:r.notes,
});

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return pre();
  const sql = getDb();
  const id = event.queryStringParameters?.id ? parseInt(event.queryStringParameters.id) : null;

  try {
    if (event.httpMethod === 'GET') {
      const rows = await sql`SELECT * FROM payments ORDER BY created_at DESC`;
      return ok(rows.map(toFront));
    }
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      if (!b.client) return err('client is required');
      const [r] = await sql`
        INSERT INTO payments
          (client,svc,total,deposit,bal_paid,dep_date,bal_date,method,start_date,end_date,next_due,notes)
        VALUES
          (${b.client},${b.svc||null},${b.total||0},${b.deposit||0},${b.balPaid||0},
           ${b.depDate||null},${b.balDate||null},${b.method||'MTN Mobile Money'},
           ${b.start||null},${b.end||null},${b.nextDue||null},${b.notes||null})
        RETURNING *`;
      return ok(toFront(r), 201);
    }
    if (event.httpMethod === 'PUT') {
      if (!id) return err('id required');
      const b = JSON.parse(event.body || '{}');
      const [r] = await sql`
        UPDATE payments SET
          client=${b.client},svc=${b.svc||null},total=${b.total||0},
          deposit=${b.deposit||0},bal_paid=${b.balPaid||0},
          dep_date=${b.depDate||null},bal_date=${b.balDate||null},
          method=${b.method||'MTN Mobile Money'},start_date=${b.start||null},
          end_date=${b.end||null},next_due=${b.nextDue||null},
          notes=${b.notes||null},updated_at=NOW()
        WHERE id=${id} RETURNING *`;
      if (!r) return err('Not found', 404);
      return ok(toFront(r));
    }
    if (event.httpMethod === 'DELETE') {
      if (!id) return err('id required');
      await sql`DELETE FROM payments WHERE id=${id}`;
      return ok({ deleted: true });
    }
    return err('Method not allowed', 405);
  } catch(e) {
    return err('Server error: ' + e.message, 500);
  }
};
