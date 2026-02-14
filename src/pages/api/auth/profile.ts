import type { APIRoute } from 'astro';
import { createAstroServerClient } from '../../../lib/supabase-server';
import { PaymentLogger } from '../../../lib/payment/logger';

export const PATCH: APIRoute = async ({ request }) => {
  const { supabase, response } = createAstroServerClient(request);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ success: false, error: { message: '인증이 필요합니다.' } }), 
      { status: 401, headers: { 'Content-Type': 'application/json' } });
  }

  const body = await request.json();
  const { displayName, phone, currentPassword, newPassword } = body;

  const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  PaymentLogger.info('PROFILE_UPDATE_ATTEMPT', { user_id: user.id, ip, has_password_change: !!newPassword });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (displayName !== undefined) updates.display_name = displayName;
  if (phone !== undefined) updates.phone = phone;

  const { error: profileError } = await supabase
    .from('profiles')
    .update(updates as never)
    .eq('id' as never, user.id);

  if (profileError) {
    PaymentLogger.error('PROFILE_UPDATE_FAILED', new Error(profileError.message), { user_id: user.id });
    return new Response(JSON.stringify({ success: false, error: { message: '프로필 업데이트에 실패했습니다.' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  if (newPassword) {
    if (!currentPassword) {
      return new Response(JSON.stringify({ success: false, error: { message: '현재 비밀번호를 입력하세요.' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });

    if (signInError) {
      PaymentLogger.warn('PROFILE_PASSWORD_VERIFY_FAILED', { user_id: user.id, ip });
      return new Response(JSON.stringify({ success: false, error: { message: '현재 비밀번호가 올바르지 않습니다.' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });

    if (passwordError) {
      PaymentLogger.error('PROFILE_PASSWORD_CHANGE_FAILED', new Error(passwordError.message), { user_id: user.id });
      return new Response(JSON.stringify({ success: false, error: { message: '비밀번호 변경에 실패했습니다.' } }),
        { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    PaymentLogger.info('PROFILE_PASSWORD_CHANGED', { user_id: user.id, ip });
  }

  PaymentLogger.info('PROFILE_UPDATED', { user_id: user.id, ip });

  const res = new Response(JSON.stringify({ success: true }), 
    { status: 200, headers: { 'Content-Type': 'application/json' } });

  response.headers.forEach((value, key) => {
    res.headers.append(key, value);
  });

  return res;
};
