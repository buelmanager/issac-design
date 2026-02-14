/**
 * POST /api/auth/login
 *
 * 서버사이드 로그인 API
 * - Rate Limiting: IP당 5회/분
 * - 감사 로깅: 성공/실패 기록
 * - 쿠키 기반 세션 설정
 */
import type { APIRoute } from 'astro';
import { createAstroServerClient } from '../../../lib/supabase-server';
import { PaymentLogger } from '../../../lib/payment/logger';

const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return false;
  }

  entry.count++;
  return true;
}

function getClientIp(request: Request): string {
  return request.headers.get('x-real-ip')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
}

export const POST: APIRoute = async ({ request }) => {
  const ip = getClientIp(request);
  const userAgent = request.headers.get('user-agent') ?? 'unknown';

  // Rate Limit 체크
  if (!checkRateLimit(ip)) {
    PaymentLogger.warn('AUTH_RATE_LIMITED', { ip, user_agent: userAgent });
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'RATE_LIMITED', message: '로그인 시도가 너무 많습니다. 1분 후 다시 시도하세요.' },
    }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': '60',
      },
    });
  }

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '이메일과 비밀번호를 입력하세요.' },
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { supabase, response } = createAstroServerClient(request);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      PaymentLogger.warn('AUTH_LOGIN_FAILED', {
        ip,
        user_agent: userAgent,
        reason: error?.message ?? 'unknown',
      });

      return new Response(JSON.stringify({
        success: false,
        error: { code: 'AUTH_FAILED', message: '이메일 또는 비밀번호가 올바르지 않습니다.' },
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    PaymentLogger.info('AUTH_LOGIN_SUCCESS', {
      user_id: data.user.id,
      email: data.user.email,
      ip,
      user_agent: userAgent,
    });

    const profileResult = await supabase
      .from('profiles')
      .select('display_name, avatar_url, provider')
      .eq('id' as never, data.user.id)
      .limit(1);

    const profile = (profileResult.data as Array<{ display_name?: string; avatar_url?: string; provider?: string }> | null)?.[0];

    const jsonResponse = new Response(JSON.stringify({
      success: true,
      data: {
        user: {
          id: data.user.id,
          email: data.user.email,
          displayName: profile?.display_name ?? data.user.email?.split('@')[0],
          avatarUrl: profile?.avatar_url ?? null,
          provider: profile?.provider ?? 'email',
        },
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    // Supabase Set-Cookie 헤더 병합
    response.headers.forEach((value, key) => {
      jsonResponse.headers.append(key, value);
    });

    return jsonResponse;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    PaymentLogger.error('AUTH_LOGIN_ERROR', error, { ip });

    return new Response(JSON.stringify({
      success: false,
      error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
