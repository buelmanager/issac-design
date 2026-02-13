import { execSync } from 'child_process';

const scripts = [
  'migrate-products.ts',
  'migrate-portfolio.ts',
  'migrate-faq.ts',
  'migrate-blog.ts',
  'backup-seed-data.ts',
];

async function runAllMigrations() {
  try {
    for (const script of scripts) {
      console.log(`\n📦 Running ${script}...`);
      execSync(`npx tsx scripts/${script}`, { stdio: 'inherit' });
      console.log(`✓ ${script} completed\n`);
    }

    console.log('✅ All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runAllMigrations();
