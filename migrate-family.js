// Co-Breathe Database Migration
// Run this to add family connection tables to your Ascen BreathWorx database

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runFamilyMigration() {
    const client = await pool.connect();
    
    try {
        console.log('Starting Co-Breathe family connections migration...');
        
        // Family connections table
        await client.query(`
            CREATE TABLE IF NOT EXISTS family_connections (
                id SERIAL PRIMARY KEY,
                participant_user_id VARCHAR(255) NOT NULL,
                family_member_email VARCHAR(255) NOT NULL,
                family_member_name VARCHAR(255),
                relationship_type VARCHAR(50), -- 'parent', 'spouse', 'child', 'sibling', 'partner', 'friend'
                connection_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'active', 'paused', 'blocked'
                privacy_settings JSONB DEFAULT '{"shareHRV": false, "shareCoherence": true, "shareProgress": true, "shareMilestones": true}',
                invitation_code VARCHAR(10),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                activated_at TIMESTAMP,
                last_session_together TIMESTAMP,
                total_shared_sessions INTEGER DEFAULT 0
            );
        `);
        
        console.log('✓ family_connections table created');
        
        // Breath rooms logging table (optional - for analytics)
        await client.query(`
            CREATE TABLE IF NOT EXISTS breath_rooms_log (
                room_id VARCHAR(20) PRIMARY KEY,
                participant_user_id VARCHAR(255) NOT NULL,
                session_number INTEGER,
                session_name VARCHAR(255),
                family_count INTEGER DEFAULT 0,
                privacy_settings JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                session_duration_seconds INTEGER,
                total_breaths INTEGER,
                avg_coherence_score DECIMAL(4,2),
                family_celebration_sent BOOLEAN DEFAULT false
            );
        `);
        
        console.log('✓ breath_rooms_log table created');
        
        // Family milestones table
        await client.query(`
            CREATE TABLE IF NOT EXISTS family_milestones (
                id SERIAL PRIMARY KEY,
                participant_user_id VARCHAR(255) NOT NULL,
                milestone_type VARCHAR(50), -- 'first_shared_session', 'week_streak', 'month_streak', 'coherence_improvement'
                milestone_data JSONB,
                achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                family_notified BOOLEAN DEFAULT false,
                celebration_sent_at TIMESTAMP
            );
        `);
        
        console.log('✓ family_milestones table created');
        
        // Add indexes for performance
        await client.query('CREATE INDEX IF NOT EXISTS idx_family_connections_participant ON family_connections(participant_user_id);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_family_connections_status ON family_connections(connection_status);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_breath_rooms_participant ON breath_rooms_log(participant_user_id);');
        await client.query('CREATE INDEX IF NOT EXISTS idx_family_milestones_participant ON family_milestones(participant_user_id);');
        
        console.log('✓ Indexes created');
        
        // Insert sample privacy setting templates
        await client.query(`
            INSERT INTO family_connections (
                participant_user_id, 
                family_member_email, 
                family_member_name,
                relationship_type, 
                connection_status,
                privacy_settings,
                invitation_code
            ) VALUES 
            ('demo_participant_001', 'family@example.com', 'Demo Family Member', 'parent', 'active', 
             '{"shareHRV": false, "shareCoherence": true, "shareProgress": true, "shareMilestones": true, "shareSessionStart": true}',
             'DEMO01')
            ON CONFLICT DO NOTHING;
        `);
        
        console.log('✓ Sample family connection created');
        
        console.log('🎉 Co-Breathe family connections migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Function to test the migration
async function testFamilyTables() {
    try {
        console.log('\n--- Testing family tables ---');
        
        // Test family_connections table
        const connectionsResult = await pool.query('SELECT COUNT(*) FROM family_connections;');
        console.log(`✓ family_connections table: ${connectionsResult.rows[0].count} records`);
        
        // Test breath_rooms_log table
        const roomsResult = await pool.query('SELECT COUNT(*) FROM breath_rooms_log;');
        console.log(`✓ breath_rooms_log table: ${roomsResult.rows[0].count} records`);
        
        // Test family_milestones table
        const milestonesResult = await pool.query('SELECT COUNT(*) FROM family_milestones;');
        console.log(`✓ family_milestones table: ${milestonesResult.rows[0].count} records`);
        
        console.log('✓ All Co-Breathe tables are working correctly!');
        
    } catch (error) {
        console.error('❌ Table test failed:', error);
    }
}

// Run migration if called directly
if (require.main === module) {
    runFamilyMigration()
        .then(() => testFamilyTables())
        .then(() => {
            console.log('\n🚀 Co-Breathe database setup complete!');
            console.log('Next step: Add WebSocket server to your existing server.js');
            process.exit(0);
        })
        .catch(error => {
            console.error('Migration failed:', error);
            process.exit(1);
        });
}

module.exports = { runFamilyMigration, testFamilyTables };
