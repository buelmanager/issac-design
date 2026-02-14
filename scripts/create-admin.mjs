import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = process.env.ADMIN_EMAIL || 'admin@issac.design';
const PASSWORD = process.env.ADMIN_INITIAL_PASSWORD;

if (!PASSWORD) {
  console.error('❌ ADMIN_INITIAL_PASSWORD 환경변수가 설정되지 않았습니다.');
  console.error('   사용법: ADMIN_INITIAL_PASSWORD=your_password node scripts/create-admin.mjs');
  console.error('   또는 .env.local 파일에 ADMIN_INITIAL_PASSWORD=your_password 추가');
  process.exit(1);
}

async function main() {
  console.log(`Creating admin user: ${EMAIL}...`);

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });

  if (authError) {
    if (authError.message.includes('already been registered')) {
      console.log('⚠️  User already exists in Auth, fetching...');
      const { data: listData } = await supabase.auth.admin.listUsers();
      const existing = listData?.users?.find(u => u.email === EMAIL);
      if (existing) {
        console.log(`   Found user: ${existing.id}`);
        await ensureAdminRow(existing.id);
      }
      return;
    }
    console.error('Auth error:', authError.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`✅ Auth user created: ${userId}`);

  await ensureAdminRow(userId);
}

async function ensureAdminRow(userId) {
  const { error } = await supabase
    .from('admin_users')
    .upsert({ id: userId, role: 'admin', name: 'Admin' }, { onConflict: 'id' });

  if (error) {
    console.error('admin_users insert error:', error.message);
    process.exit(1);
  }

  console.log(`✅ admin_users row created for ${userId}`);
  console.log(`\n🎉 Admin account ready!`);
  console.log(`   Email: ${EMAIL}`);
  console.log(`   Password: ********** (환경변수로 설정한 비밀번호)`);
}

main();
