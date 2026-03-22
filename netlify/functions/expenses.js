const { getDb, ok, err, pre } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return pre();
  const sql = getDb();
  const id = event.queryStringParameters?.id ? parseInt(event.queryStringParameters.id) : null;

  try {
    if (event.httpMethod === 'GET') {
      const rows = await sql`SELECT * FROM expenses ORDER BY expense_date DESC, created_at DESC`;
      return ok(rows.map(r => ({
        id:r.id, desc:r.description, amount:r.amount,
        date: r.expense_date ? String(r.expense_date).slice(0,10) : '',
        cat:r.category, method:r.method, project:r.project, notes:r.notes,
      })));
    }
    if (event.httpMethod === 'POST') {
      const b = JSON.parse(event.body || '{}');
      if (!b.desc || !b.amount) return err('desc and amount required');
      const [r] = await sql`
        INSERT INTO expenses
          (description,amount,expense_date,category,method,project,notes)
        VALUES
          (${b.desc},${b.amount},${b.date||null},${b.cat||null},
           ${b.method||'MTN Mobile Money'},${b.project||null},${b.notes||null})
        RETURNING *`;
      return ok({
        id:r.id, desc:r.description, amount:r.amount,
        date: r.expense_date ? String(r.expense_date).slice(0,10) : '',
        cat:r.category, method:r.method, project:r.project, notes:r.notes,
      }, 201);
    }
    if (event.httpMethod === 'PUT') {
      if (!id) return err('id required');
      const b = JSON.parse(event.body || '{}');
      const [r] = await sql`
        UPDATE expenses SET
          description=${b.desc},amount=${b.amount},
          expense_date=${b.date||null},category=${b.cat||null},
          method=${b.method||'MTN Mobile Money'},
          project=${b.project||null},notes=${b.notes||null},
          updated_at=NOW()
        WHERE id=${id} RETURNING *`;
      if (!r) return err('Not found', 404);
      return ok({
        id:r.id, desc:r.description, amount:r.amount,
        date: r.expense_date ? String(r.expense_date).slice(0,10) : '',
        cat:r.category, method:r.method, project:r.project, notes:r.notes,
      });
    }
    if (event.httpMethod === 'DELETE') {
      if (!id) return err('id required');
      await sql`DELETE FROM expenses WHERE id=${id}`;
      return ok({ deleted: true });
    }
    return err('Method not allowed', 405);
  } catch(e) {
    return err('Server error: ' + e.message, 500);
  }
};
