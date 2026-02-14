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

export const GET: APIRoute = async ({ request, redirect, url }) => {
  const code = url.searchParams.get('code');
  const safeDest = validateRedirect(url.searchParams.get('next'));
  const errorRedirect = safeDest.startsWith('/admin') ? '/admin/login' : '/shop/login';

  if (!code) {
    return redirect(`${errorRedirect}?error=missing_code`);
  }

  const { supabase, response } = createAstroServerClient(request);

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Auth callback error:', error.message);
    return redirect(`${errorRedirect}?error=auth_failed`);
  }

  const redirectResponse = new Response(null, {
    status: 302,
    headers: { Location: safeDest },
  });

  response.headers.forEach((value, key) => {
    redirectResponse.headers.append(key, value);
  });

  return redirectResponse;
};
