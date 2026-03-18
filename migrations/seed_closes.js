// Seed 150 personalized closes from JSON files
// Reads closes_foundation.json, closes_consolidation.json, closes_chiron.json
// Inserts into personalized_closes table (idempotent via ON CONFLICT)

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  try {
    const files = [
      path.join(__dirname, '..', '..', 'Downloads', 'closes_foundation.json'),
      path.join(__dirname, '..', '..', 'Downloads', 'closes_consolidation.json'),
      path.join(__dirname, '..', '..', 'Downloads', 'closes_chiron.json')
    ];

    let totalInserted = 0;

    for (const file of files) {
      const closes = JSON.parse(fs.readFileSync(file, 'utf8'));
      console.log(`Loading ${closes.length} closes from ${path.basename(file)}`);

      for (const close of closes) {
        await pool.query(
          `INSERT INTO personalized_closes (id, tier, session_range_min, session_range_max, tags, priority, text, active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)
           ON CONFLICT (id) DO UPDATE SET
             tier = EXCLUDED.tier,
             session_range_min = EXCLUDED.session_range_min,
             session_range_max = EXCLUDED.session_range_max,
             tags = EXCLUDED.tags,
             priority = EXCLUDED.priority,
             text = EXCLUDED.text,
             active = true`,
          [
            close.id,
            close.tier,
            close.session_range_min,
            close.session_range_max,
            JSON.stringify(close.tags),
            close.priority,
            close.text
          ]
        );
        totalInserted++;
      }
    }

    // Reset sequence to max id
    await pool.query(`SELECT setval('personalized_closes_id_seq', (SELECT MAX(id) FROM personalized_closes))`);

    // Verify
    const count = await pool.query('SELECT COUNT(*) as c FROM personalized_closes');
    console.log(`\nSeed complete. Total rows: ${count.rows[0].c}`);

    if (parseInt(count.rows[0].c) !== 150) {
      console.error(`WARNING: Expected 150 rows, got ${count.rows[0].c}`);
      process.exit(1);
    }

    console.log('SELECT COUNT(*) = 150 — verified.');

    // Show tier breakdown
    const tiers = await pool.query(
      `SELECT tier, COUNT(*) as c FROM personalized_closes GROUP BY tier ORDER BY tier`
    );
    tiers.rows.forEach(r => console.log(`  ${r.tier}: ${r.c}`));

  } catch (e) {
    console.error('Seed FAILED:', e.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
