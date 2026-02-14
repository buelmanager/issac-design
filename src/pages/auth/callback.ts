/**
 * GET /auth/callback
 *
 * Supabase Auth PKCE 콜백 핸들러
 * OAuth 로그인, 이메일 확인, 비밀번호 재설정 등에서 사용.
 *
 * 흐름:
 * 1. Supabase가 ?code=xxx 쿼리 파라미터로 리다이렉트
 * 2. 서버에서 code를 세션 토큰으로 교환
 * 3. 쿠키에 세션 저장 후 /admin으로 리다이렉트
 */
import type { APIRoute } from 'astro';
import { createAstroServerClient } from '../../lib/supabase-server';
import { validateRedirect } from '../../lib/auth/validate-redirect';
import { PaymentLogger } from '../../lib/payment/logger';

export const GET: APIRoute = async ({ request, redirect, url }) => {
  const code = url.searchParams.get('code');
  const errorParam = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');
  const safeDest = validateRedirect(url.searchParams.get('next'));
  const errorRedirect = safeDest.startsWith('/admin') ? '/admin/login' : '/shop/login';

  PaymentLogger.info('AUTH_CALLBACK_RECEIVED', {
    has_code: !!code,
    has_error: !!errorParam,
    error_param: errorParam,
    error_description: errorDescription,
    next: safeDest,
    full_url: url.pathname + url.search,
  });

  if (errorParam) {
    PaymentLogger.warn('AUTH_CALLBACK_OAUTH_ERROR', {
      error: errorParam,
      description: errorDescription,
      next: safeDest,
    });
    return redirect(`${errorRedirect}?error=${errorParam}`);
  }

  if (!code) {
    PaymentLogger.warn('AUTH_CALLBACK_MISSING_CODE', { next: safeDest });
    return redirect(`${errorRedirect}?error=missing_code`);
  }

  const { supabase, response } = createAstroServerClient(request);

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    PaymentLogger.error('AUTH_CALLBACK_EXCHANGE_FAILED', new Error(error.message), {
      error_code: error.status,
      error_name: error.name,
      next: safeDest,
    });
    return redirect(`${errorRedirect}?error=auth_failed`);
  }

  PaymentLogger.info('AUTH_CALLBACK_SUCCESS', {
    user_id: data.user?.id,
    email: data.user?.email,
    provider: data.user?.app_metadata?.provider,
    next: safeDest,
  });

  const redirectResponse = new Response(null, {
    status: 302,
    headers: { Location: safeDest },
  });

  response.headers.forEach((value, key) => {
    redirectResponse.headers.append(key, value);
  });

  return redirectResponse;
};
