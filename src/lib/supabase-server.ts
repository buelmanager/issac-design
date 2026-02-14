/**
 * Supabase SSR 서버 클라이언트
 *
 * Astro 서버사이드(미들웨어, API 라우트, .astro 페이지)에서 사용.
 * 쿠키 기반 세션으로 httpOnly 보호 + SSR 호환.
 *
 * @supabase/ssr의 createServerClient를 사용하여
 * Request 쿠키에서 세션을 읽고, Response 쿠키로 갱신.
 */
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import type { Database } from '../types/database';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;

/**
 * Astro 미들웨어 / API 라우트 전용 서버 클라이언트 생성
 *
 * 사용법:
 *   const { supabase, response } = createAstroServerClient(Astro.request);
 *   const { data: { user } } = await supabase.auth.getUser();
 *   return new Response(body, { headers: response.headers });
 */
export function createAstroServerClient(request: Request) {
  const responseHeaders = new Headers();

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const cookieHeader = request.headers.get('Cookie') ?? '';
        return parseCookieHeader(cookieHeader);
      },
      setAll(cookiesToSet) {
         cookiesToSet.forEach(({ name, value, options }) => {
           responseHeaders.append(
             'Set-Cookie',
             serializeCookieHeader(name, value, {
               ...options,
               secure: true,
               sameSite: 'lax',
               path: '/',
             }),
           );
         });
       },
    },
  });

  return {
    supabase,
    response: { headers: responseHeaders },
  };
}
