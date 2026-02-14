import type { APIRoute } from 'astro';
import { createAstroServerClient } from '../../../lib/supabase-server';
import { PaymentLogger } from '../../../lib/payment/logger';
import { createClient } from '@supabase/supabase-js';

export const POST: APIRoute = async ({ request }) => {
  const { supabase } = createAstroServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ success: false, error: { message: '인증이 필요합니다.' } }),
      { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  PaymentLogger.info('ACCOUNT_WITHDRAW_ATTEMPT', { user_id: user.id, email: user.email, ip });

  try {
    await supabase.from('profiles').delete().eq('id' as never, user.id);

    const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
    const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
    
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteError) {
      PaymentLogger.error('ACCOUNT_WITHDRAW_FAILED', new Error(deleteError.message), { user_id: user.id });
      return new Response(JSON.stringify({ success: false, error: { message: '회원 탈퇴에 실패했습니다.' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    await supabase.auth.signOut();

    PaymentLogger.info('ACCOUNT_WITHDRAWN', { user_id: user.id, email: user.email, ip });

    return new Response(JSON.stringify({ success: true }), 
      { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    PaymentLogger.error('ACCOUNT_WITHDRAW_ERROR', err instanceof Error ? err : new Error(String(err)), { user_id: user.id });
    return new Response(JSON.stringify({ success: false, error: { message: '회원 탈퇴 중 오류가 발생했습니다.' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
