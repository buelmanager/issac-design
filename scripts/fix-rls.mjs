import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const tables = [
  'admin_users', 'site_config', 'landing_sections', 'hero_slides',
  'service_items', 'signage_types', 'client_projects', 'project_filter_tabs',
  'product_categories', 'products', 'portfolio_items', 'faq_categories',
  'faq_items', 'landing_faqs', 'trust_indicators', 'client_logos',
  'about_sections', 'blog_posts', 'quote_requests', 'contact_inquiries',
  'simulator_config', 'page_contents', 'navigation_items', 'inquiry_types',
  'seed_data_backup',
];

async function run() {
  await client.connect();
  console.log('Connected.\n');

  // 1. Drop all existing policies
  for (const table of tables) {
    try {
      const { rows } = await client.query(
        `SELECT policyname FROM pg_policies WHERE tablename = $1`,
        [table]
      );
      for (const row of rows) {
        await client.query(`DROP POLICY IF EXISTS "${row.policyname}" ON ${table}`);
        console.log(`  Dropped policy "${row.policyname}" on ${table}`);
      }
    } catch (err) {
      console.log(`  Skip ${table}: ${err.message}`);
    }
  }

  // 2. Create a security definer function to check admin status
  // This avoids the RLS recursion on admin_users
  await client.query(`
    CREATE OR REPLACE FUNCTION is_admin()
    RETURNS BOOLEAN AS $$
    BEGIN
      RETURN EXISTS (
        SELECT 1 FROM admin_users WHERE id = auth.uid()
      );
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `);
  console.log('\n✅ Created is_admin() SECURITY DEFINER function');

  // 3. Re-create policies using is_admin() instead of subquery
  // admin_users: special — admin can read/update themselves
  await client.query(`
    CREATE POLICY admin_all ON admin_users FOR ALL TO authenticated
      USING (is_admin());
  `);

  // Tables with public_read (is_visible filter)
  const visibleTables = [
    'landing_sections', 'hero_slides', 'service_items', 'signage_types',
    'client_projects', 'project_filter_tabs', 'product_categories', 'products',
    'portfolio_items', 'faq_items', 'landing_faqs', 'trust_indicators',
    'client_logos', 'about_sections', 'navigation_items', 'inquiry_types',
  ];
  for (const t of visibleTables) {
    await client.query(`
      CREATE POLICY public_read ON ${t} FOR SELECT TO anon, authenticated
        USING (is_visible = true);
    `);
    await client.query(`
      CREATE POLICY admin_all ON ${t} FOR ALL TO authenticated
        USING (is_admin());
    `);
  }

  // Tables with public_read (no is_visible, just true)
  const alwaysReadable = ['site_config', 'faq_categories', 'simulator_config', 'page_contents'];
  for (const t of alwaysReadable) {
    await client.query(`
      CREATE POLICY public_read ON ${t} FOR SELECT TO anon, authenticated
        USING (true);
    `);
    await client.query(`
      CREATE POLICY admin_all ON ${t} FOR ALL TO authenticated
        USING (is_admin());
    `);
  }

  // blog_posts: published check
  await client.query(`
    CREATE POLICY public_read ON blog_posts FOR SELECT TO anon, authenticated
      USING (is_published = true);
  `);
  await client.query(`
    CREATE POLICY admin_all ON blog_posts FOR ALL TO authenticated
      USING (is_admin());
  `);

  // quote_requests & contact_inquiries: public insert, admin all
  for (const t of ['quote_requests', 'contact_inquiries']) {
    await client.query(`
      CREATE POLICY public_insert ON ${t} FOR INSERT TO anon, authenticated
        WITH CHECK (true);
    `);
    await client.query(`
      CREATE POLICY admin_all ON ${t} FOR ALL TO authenticated
        USING (is_admin());
    `);
  }

  // seed_data_backup: admin only
  await client.query(`
    CREATE POLICY admin_all ON seed_data_backup FOR ALL TO authenticated
      USING (is_admin());
  `);

  console.log('\n🎉 All RLS policies recreated with is_admin() function!');
  await client.end();
}

run().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
