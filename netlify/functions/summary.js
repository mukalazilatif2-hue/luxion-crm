const { getDb, ok, err, pre } = require('./_db');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return pre();
  if (event.httpMethod !== 'GET') return err('GET only', 405);
  const sql = getDb();

  try {
    const [ls] = await sql`
      SELECT
        COUNT(*)                                            AS total,
        COUNT(*) FILTER (WHERE stage='Won')                AS won,
        COUNT(*) FILTER (WHERE stage NOT IN ('Won','Lost')) AS open,
        COALESCE(SUM(val) FILTER (WHERE stage='Won'),0)    AS won_val
      FROM leads`;

    const [ps] = await sql`
      SELECT
        COALESCE(SUM(deposit + bal_paid),0)                      AS collected,
        COALESCE(SUM(GREATEST(total - deposit - bal_paid,0)),0)  AS outstanding
      FROM payments`;

    const [es] = await sql`
      SELECT COALESCE(SUM(amount),0) AS total_exp FROM expenses`;

    const today = new Date().toISOString().split('T')[0];

    const overdue = await sql`
      SELECT client FROM payments
      WHERE bal_date < ${today}
        AND (total - deposit - bal_paid) > 0`;

    const expiring = await sql`
      SELECT client, next_due FROM payments
      WHERE next_due IS NOT NULL
        AND next_due >= ${today}
        AND next_due <= (CURRENT_DATE + INTERVAL '14 days')`;

    const collected = Number(ps.collected);
    const expenses  = Number(es.total_exp);

    return ok({
      leads: {
        total:  Number(ls.total),
        won:    Number(ls.won),
        open:   Number(ls.open),
        wonVal: Number(ls.won_val),
      },
      finance: {
        collected,
        outstanding: Number(ps.outstanding),
        expenses,
        profit: collected - expenses,
      },
      overdue:  overdue.map(r => r.client),
      expiring: expiring.map(r => ({
        client: r.client,
        nextDue: String(r.next_due).slice(0,10)
      })),
    });
  } catch(e) {
    console.error('summary error:', e);
    return err('Server error: ' + e.message, 500);
  }
};
