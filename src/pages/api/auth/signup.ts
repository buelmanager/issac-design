import type { APIRoute } from 'astro';
import { createAstroServerClient } from '../../../lib/supabase-server';
import { PaymentLogger } from '../../../lib/payment/logger';

const signupAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 3;
const WINDOW_MS = 300_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = signupAttempts.get(ip);

  if (!entry || now > entry.resetAt) {
    signupAttempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;

export const POST: APIRoute = async ({ request }) => {
  const ip = getClientIp(request);

  if (!checkRateLimit(ip)) {
    PaymentLogger.warn('SIGNUP_RATE_LIMITED', { ip });
    return new Response(JSON.stringify({
      success: false,
      error: { code: 'RATE_LIMITED', message: '회원가입 시도가 너무 많습니다. 5분 후 다시 시도하세요.' },
    }), {
      status: 429,
      headers: { 'Content-Type': 'application/json', 'Retry-After': '300' },
    });
  }

  try {
    const body = await request.json();
    const { email, password, displayName } = body;

    if (!email || !password) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '이메일과 비밀번호를 입력하세요.' },
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!EMAIL_REGEX.test(email)) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '유효한 이메일 주소를 입력하세요.' },
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return new Response(JSON.stringify({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.` },
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const { supabase, response } = createAstroServerClient(request);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: displayName || email.split('@')[0],
        },
      },
    });

    if (error) {
      PaymentLogger.warn('SIGNUP_FAILED', { ip, reason: error.message });

      return new Response(JSON.stringify({
        success: false,
        error: { code: 'SIGNUP_FAILED', message: '회원가입에 실패했습니다. 다시 시도하세요.' },
      }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    PaymentLogger.info('SIGNUP_SUCCESS', {
      user_id: data.user?.id,
      ip,
    });

    const needsEmailConfirmation = data.user && !data.session;

    const jsonResponse = new Response(JSON.stringify({
      success: true,
      data: {
        user: data.user ? { id: data.user.id, email: data.user.email } : null,
        needsEmailConfirmation,
      },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } });

    response.headers.forEach((value, key) => {
      jsonResponse.headers.append(key, value);
    });

    return jsonResponse;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    PaymentLogger.error('SIGNUP_ERROR', error, { ip });

    return new Response(JSON.stringify({
      success: false,
      error: { code: 'SERVER_ERROR', message: '서버 오류가 발생했습니다.' },
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
