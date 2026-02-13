import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TABLES_TO_BACKUP = [
  'hero_slides',
  'service_items',
  'signage_types',
  'client_projects',
  'project_filter_tabs',
  'landing_faqs',
  'trust_indicators',
  'site_config',
  'navigation_items',
  'about_sections',
  'inquiry_types',
  'simulator_config',
  'product_categories',
  'products',
  'portfolio_items',
  'faq_categories',
  'faq_items',
];

async function backupSeedData() {
  try {
    let totalRecords = 0;

    for (const tableName of TABLES_TO_BACKUP) {
      const { data: records, error: fetchError } = await supabase
        .from(tableName)
        .select('*')
        .eq('is_seed', true);

      if (fetchError) {
        console.warn(`Warning: Could not fetch from ${tableName}:`, fetchError.message);
        continue;
      }

      if (!records || records.length === 0) {
        continue;
      }

      const backupRecords = records.map((record) => ({
        table_name: tableName,
        record_id: String(record.id || record.slug || ''),
        seed_data: record,
      }));

      const { error: insertError } = await supabase
        .from('seed_data_backup')
        .upsert(backupRecords, { onConflict: 'table_name,record_id' });

      if (insertError) {
        console.error(`Error backing up ${tableName}:`, insertError);
        process.exit(1);
      }

      totalRecords += records.length;
      console.log(`✓ Backed up ${records.length} records from ${tableName}`);
    }

    console.log(`✓ Successfully backed up ${totalRecords} total seed records`);
  } catch (error) {
    console.error('Backup failed:', error);
    process.exit(1);
  }
}

backupSeedData();
