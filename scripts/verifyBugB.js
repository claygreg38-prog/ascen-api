// Bug B verification — read-only.
// Runs against DATABASE_URL injected by `railway run` (hearty-optimism service env).
// Never prints the connection string. Outputs query results only.
const { Pool } = require('pg');

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set in env');
    process.exit(2);
  }
  const pool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 2,
  });

  try {
    const recent = await pool.query(`
      SELECT id, user_id, session_id, window_start, window_end, tick_count,
             ns3_mean, zone, coherence_mean, rmssd_mean, created_at
        FROM ns3_snapshots
        ORDER BY created_at DESC
        LIMIT 20
    `);
    console.log('=== ns3_snapshots LAST 20 ROWS ===');
    console.log(`row count: ${recent.rowCount}`);
    for (const r of recent.rows) {
      console.log(JSON.stringify({
        id: r.id,
        user_id: r.user_id,
        user_id_type: typeof r.user_id,
        session_id: r.session_id,
        window_start: r.window_start,
        window_end: r.window_end,
        tick_count: r.tick_count,
        ns3_mean: r.ns3_mean,
        zone: r.zone,
        coherence_mean: r.coherence_mean,
        rmssd_mean: r.rmssd_mean,
        created_at: r.created_at,
      }));
    }

    const agg = await pool.query(`
      SELECT session_id,
             COUNT(*)               AS row_count,
             MIN(ns3_mean)          AS ns3_min,
             MAX(ns3_mean)          AS ns3_max,
             ROUND(AVG(ns3_mean)::numeric, 2) AS ns3_avg,
             MIN(coherence_mean)    AS coh_min,
             MAX(coherence_mean)    AS coh_max,
             ROUND(AVG(coherence_mean)::numeric, 4) AS coh_avg,
             MIN(rmssd_mean)        AS rmssd_min,
             MAX(rmssd_mean)        AS rmssd_max,
             ROUND(AVG(rmssd_mean)::numeric, 2) AS rmssd_avg,
             MIN(window_start)      AS first_window,
             MAX(window_end)        AS last_window
        FROM ns3_snapshots
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY session_id
        ORDER BY MAX(window_end) DESC
    `);
    console.log('\n=== 7-DAY PER-SESSION AGG ===');
    console.log(`session count: ${agg.rowCount}`);
    for (const r of agg.rows) {
      console.log(JSON.stringify(r));
    }

    const totals = await pool.query(`
      SELECT COUNT(*)                 AS total_rows,
             COUNT(DISTINCT user_id)  AS distinct_users,
             COUNT(DISTINCT session_id) AS distinct_sessions,
             MIN(created_at)          AS earliest,
             MAX(created_at)          AS latest
        FROM ns3_snapshots
    `);
    console.log('\n=== TABLE TOTALS ===');
    console.log(JSON.stringify(totals.rows[0]));

    const colCheck = await pool.query(`
      SELECT column_name, data_type
        FROM information_schema.columns
       WHERE table_name = 'ns3_snapshots'
       ORDER BY ordinal_position
    `);
    console.log('\n=== ns3_snapshots SCHEMA ===');
    for (const r of colCheck.rows) console.log(`${r.column_name}: ${r.data_type}`);
  } catch (e) {
    console.error('Query failed:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
