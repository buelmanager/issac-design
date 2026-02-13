/**
 * Run SQL migrations against Supabase PostgreSQL
 * Usage: node scripts/run-migrations.mjs
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Load .env.local
dotenv.config({ path: path.join(rootDir, '.env.local') });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('❌ DATABASE_URL not found in .env.local');
  process.exit(1);
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: { rejectUnauthorized: false },
});

const migrations = [
  '001_schema.sql',
  '002_rls.sql',
  '003_triggers.sql',
  '004_seed.sql',
];

async function run() {
  try {
    console.log('🔌 Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!\n');

    for (const file of migrations) {
      const filePath = path.join(rootDir, 'supabase', 'migrations', file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      console.log(`📦 Running ${file}...`);
      try {
        await client.query(sql);
        console.log(`   ✅ ${file} — success`);
      } catch (err) {
        const ignorable = ['42P07', '42710', '42P16', '42501'];
        if (ignorable.includes(err.code)) {
          console.log(`   ⚠️  ${file} — already exists (skipping): ${err.message.split('\n')[0]}`);
        } else {
          console.error(`   ❌ ${file} — FAILED (code: ${err.code}):`, err.message);
          throw err;
        }
      }
    }

    console.log('\n🎉 All migrations completed!');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
