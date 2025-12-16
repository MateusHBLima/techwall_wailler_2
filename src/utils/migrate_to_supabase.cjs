/**
 * Migration Script: Upload local models to Supabase
 * 
 * This script reads all models from local_models.json and uploads them to Supabase.
 * Run this ONCE before deploying to Vercel to migrate your data.
 * 
 * Usage: node src/utils/migrate_to_supabase.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase credentials
const SUPABASE_URL = 'https://dupeycsyinvckudaexwe.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1cGV5Y3N5aW52Y2t1ZGFleHdlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTg1MTAxNiwiZXhwIjoyMDgxNDI3MDE2fQ.uL_Lc1M0P3sCvvAZz-vJcltAYIG2e7hhVd1fdHO3jU4';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Path to local models
const localModelsPath = path.join(__dirname, '..', 'data', 'local_models.json');

async function createTableIfNotExists() {
    console.log('🔧 Checking/Creating table...');

    // This SQL creates the table if it doesn't exist
    const { error } = await supabase.rpc('exec_sql', {
        sql: `
            CREATE TABLE IF NOT EXISTS models (
                id TEXT PRIMARY KEY,
                type TEXT DEFAULT 'template',
                name TEXT NOT NULL,
                data JSONB NOT NULL,
                progress INTEGER DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            
            -- Enable RLS
            ALTER TABLE models ENABLE ROW LEVEL SECURITY;
            
            -- Create policy to allow all operations (for public access)
            CREATE POLICY IF NOT EXISTS "Allow all operations" ON models
                FOR ALL USING (true) WITH CHECK (true);
        `
    });

    if (error) {
        console.log('⚠️ Note: Table might already exist or RPC not available. Continuing...');
        console.log('   If you see errors below, create the table manually in Supabase Dashboard:');
        console.log('   SQL Editor → New Query → Paste and run:');
        console.log(`
   CREATE TABLE models (
       id TEXT PRIMARY KEY,
       type TEXT DEFAULT 'template',
       name TEXT NOT NULL,
       data JSONB NOT NULL,
       progress INTEGER DEFAULT 0,
       created_at TIMESTAMPTZ DEFAULT NOW(),
       updated_at TIMESTAMPTZ DEFAULT NOW()
   );
   ALTER TABLE models ENABLE ROW LEVEL SECURITY;
   CREATE POLICY "Allow all" ON models FOR ALL USING (true) WITH CHECK (true);
        `);
    }
}

async function migrateModels() {
    console.log('\n📦 Loading local models from:', localModelsPath);

    if (!fs.existsSync(localModelsPath)) {
        console.error('❌ File not found:', localModelsPath);
        process.exit(1);
    }

    const modelsJson = fs.readFileSync(localModelsPath, 'utf8');
    const models = JSON.parse(modelsJson);

    console.log(`📊 Found ${models.length} models to migrate\n`);

    let success = 0;
    let failed = 0;

    for (const model of models) {
        const record = {
            id: model.id,
            type: model.type || 'template',
            name: model.name,
            data: model.data,
            progress: model.progress || 0,
            created_at: model.created || model.created_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('models')
            .upsert(record, { onConflict: 'id' });

        if (error) {
            console.error(`❌ Failed: ${model.name} (${model.id})`, error.message);
            failed++;
        } else {
            console.log(`✅ Migrated: ${model.name} (${model.id})`);
            success++;
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log(`📈 Migration Complete!`);
    console.log(`   ✅ Success: ${success}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log('='.repeat(50));

    if (failed > 0) {
        console.log('\n⚠️ Some models failed. Check if the table exists in Supabase.');
    }
}

async function main() {
    console.log('🚀 Supabase Migration Script');
    console.log('='.repeat(50));

    await createTableIfNotExists();
    await migrateModels();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
