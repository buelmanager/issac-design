/**
 * POST /api/auth/logout
 *
 * 서버사이드 로그아웃 API
 * - 세션 쿠키 삭제
 * - 감사 로깅
 */
import type { APIRoute } from 'astro';
import { createAstroServerClient } from '../../../lib/supabase-server';
import { PaymentLogger } from '../../../lib/payment/logger';

export const POST: APIRoute = async ({ request }) => {
  const ip = request.headers.get('x-forwarded-for')
    ?? request.headers.get('x-real-ip')
    ?? 'unknown';

  try {
    const { supabase, response } = createAstroServerClient(request);

    // 현재 사용자 정보 가져오기 (로깅용)
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.auth.signOut();

    if (error) {
      PaymentLogger.warn('AUTH_LOGOUT_FAILED', {
        user_id: user?.id,
        ip,
        reason: error.message,
      });
    } else {
      PaymentLogger.info('AUTH_LOGOUT', {
        user_id: user?.id,
        email: user?.email,
        ip,
      });
    }

    const jsonResponse = new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    // Supabase가 설정한 쿠키 삭제 헤더 병합
    response.headers.forEach((value, key) => {
      jsonResponse.headers.append(key, value);
    });

    return jsonResponse;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    PaymentLogger.error('AUTH_LOGOUT_ERROR', error, { ip });

    return new Response(JSON.stringify({
      success: false,
      error: { code: 'SERVER_ERROR', message: '로그아웃 처리 중 오류가 발생했습니다.' },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
