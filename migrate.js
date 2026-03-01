// One-time migration script — run once, then delete
// Fixes F-1 (S091 missing), F-2 (sessions 81-90 no breath params), F-3 (arc naming)

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting migration...');

    // F-3: Fix arc naming
    const f3 = await client.query(`
      UPDATE session_templates
      SET arc = 'emotional_granularity'
      WHERE arc = 'Emotional Granularity'
    `);
    console.log(`F-3 done: ${f3.rowCount} rows normalized`);

    // F-2: Fix sessions 81-90 missing breath params
    const f2 = await client.query(`
      UPDATE session_templates
      SET breath_mode = 'box_extended', ratio = '4-2-7', duration_seconds = 780
      WHERE session_number BETWEEN 81 AND 90
      AND (breath_mode IS NULL OR ratio IS NULL)
    `);
    console.log(`F-2 done: ${f2.rowCount} sessions updated`);

    // F-1: Insert S091
    const exists = await client.query(
      `SELECT 1 FROM session_templates WHERE session_number = 91`
    );
    if (exists.rowCount === 0) {
      await client.query(`
        INSERT INTO session_templates (
          session_number, title, arc, breath_mode, ratio, duration_seconds,
          vault_enabled, vault_prompt, luno_arrival, luno_mid, luno_close, notes
        ) VALUES (
          91,
          'The Room Remembers',
          'repatterning',
          'box_extended',
          '4-2-7',
          840,
          true,
          'A room I''ve walked into that my body knew before my mind did was ___. What my nervous system picked up was ___. From now on, when I walk into that kind of space, I will ___.',
          '91 sessions. Take a second with that. You changed how you handle your own body. You changed how you move through relationships. Today we go wider. Today we talk about rooms.',
          'Rooms have energy. Not the mystical kind — the real kind. Collective nervous systems. Dozens of bodies in one space, each carrying their own fear, grief, power, or calm. You feel it. You always have. The question is — what do you do with it?',
          'This week pick one room. Any room. Your treatment group. Your family dinner. Your probation check-in. Walk in. Pause. Notice what your body picks up before your mind starts talking. Just read it. Consciously. On purpose. That is the skill. We build from here.',
          'Arc transition: closes Relational Somatics 61-90, opens Somatic Mastery 91-120. Do not skip resistance phase.'
        )
      `);
      console.log('F-1 done: S091 inserted');
    } else {
      console.log('F-1 skipped: S091 already exists');
    }

    // Verify
    const count = await client.query(
      `SELECT COUNT(*) FROM session_templates WHERE session_number > 0`
    );
    console.log(`Total real sessions: ${count.rows[0].count}`);
    console.log('Migration complete.');

  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
