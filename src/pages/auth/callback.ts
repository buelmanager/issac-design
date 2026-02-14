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

export const GET: APIRoute = async ({ request, redirect, url }) => {
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/admin';

  if (!code) {
    return redirect('/admin/login?error=missing_code');
  }

  const { supabase, response } = createAstroServerClient(request);

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Auth callback error:', error.message);
    return redirect('/admin/login?error=auth_failed');
  }

  // 세션 쿠키가 설정된 리다이렉트 응답
  const redirectResponse = new Response(null, {
    status: 302,
    headers: {
      Location: next,
    },
  });

  // Supabase Set-Cookie 헤더 병합
  response.headers.forEach((value, key) => {
    redirectResponse.headers.append(key, value);
  });

  return redirectResponse;
};
