/**
 * Astro 미들웨어
 *
 * 3단계 보안 체인:
 * 1. authMiddleware — 모든 요청에서 쿠키 기반 세션 파싱 → locals.user 설정
 * 2. adminGuard — /admin/* 경로 보호 (로그인 페이지 제외)
 * 3. securityHeaders — 보안 HTTP 헤더 추가
 */
import { defineMiddleware, sequence } from 'astro:middleware';
import { createAstroServerClient } from './lib/supabase-server';

/**
 * 1단계: 인증 미들웨어
 * 모든 요청에서 쿠키 → Supabase 세션 파싱
 */
const authMiddleware = defineMiddleware(async (context, next) => {
  const { supabase, response } = createAstroServerClient(context.request);

  // getUser()는 서버에서 토큰을 검증 (getSession보다 안전)
  const { data: { user } } = await supabase.auth.getUser();

  context.locals.user = user;
  context.locals.responseHeaders = response.headers;

  const resp = await next();

  // Supabase가 설정한 Set-Cookie 헤더를 응답에 병합
  response.headers.forEach((value, key) => {
    resp.headers.append(key, value);
  });

  return resp;
});

/**
 * 2단계: 관리자 경로 가드
 * /admin/* 경로는 인증된 admin_users만 접근 가능
 * /admin/login은 예외
 */
const adminGuard = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // /admin/* 경로가 아니면 통과
  if (!pathname.startsWith('/admin')) {
    return next();
  }

  // /admin/login은 인증 불필요
  if (pathname === '/admin/login') {
    // 이미 로그인된 사용자는 대시보드로 리다이렉트
    if (context.locals.user) {
      return context.redirect('/admin');
    }
    return next();
  }

  // 미인증 → 로그인 페이지로 리다이렉트
  if (!context.locals.user) {
    return context.redirect('/admin/login');
  }

  return next();
});

/**
 * 3단계: 보안 HTTP 헤더
 */
const securityHeaders = defineMiddleware(async (context, next) => {
  const resp = await next();
  const { pathname } = context.url;

  // 공통 보안 헤더
  resp.headers.set('X-Content-Type-Options', 'nosniff');
  resp.headers.set('X-Frame-Options', 'DENY');
  resp.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  resp.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  // /admin/* 경로는 캐시 금지
  if (pathname.startsWith('/admin')) {
    resp.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }

  return resp;
});

export const onRequest = sequence(authMiddleware, adminGuard, securityHeaders);
