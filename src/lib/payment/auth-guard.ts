/**
 * 결제 API 인증 가드
 *
 * Webhook 제외 모든 결제 API는 이 가드를 통과해야 한다.
 * service_role_key 또는 인증된 admin 사용자만 접근 가능.
 */
import { createClient } from '@supabase/supabase-js';
import { PaymentLogger } from './logger';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;

interface AuthResult {
  authorized: boolean;
  userId?: string;
  error?: string;
}

/**
 * 관리자 인증 확인
 * Authorization: Bearer <access_token> 헤더에서 토큰 추출
 */
export async function verifyAdminAuth(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    PaymentLogger.warn('AUTH_MISSING_TOKEN', {
      path: new URL(request.url).pathname,
      ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
    });
    return { authorized: false, error: 'Authorization header required' };
  }

  const token = authHeader.slice(7);

  try {
    // 토큰으로 사용자 인증
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      PaymentLogger.warn('AUTH_INVALID_TOKEN', {
        path: new URL(request.url).pathname,
        error: authError?.message,
        ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      });
      return { authorized: false, error: 'Invalid or expired token' };
    }

    // admin_users 테이블에서 관리자 확인
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('id')
      .eq('id', user.id)
      .single();

    if (!adminUser) {
      PaymentLogger.warn('AUTH_NOT_ADMIN', {
        user_id: user.id,
        path: new URL(request.url).pathname,
        ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      });
      return { authorized: false, error: 'Admin access required' };
    }

    // 인증 성공 로깅 (보안 감사)
    PaymentLogger.info('AUTH_SUCCESS', {
      user_id: user.id,
      path: new URL(request.url).pathname,
    });

    return { authorized: true, userId: user.id };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    PaymentLogger.error('AUTH_VERIFICATION_ERROR', error, {
      path: new URL(request.url).pathname,
      ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
    });
    return { authorized: false, error: 'Authentication failed' };
  }
}

/**
 * 인증 실패 응답 생성
 */
export function unauthorizedResponse(message = 'Unauthorized'): Response {
  return new Response(JSON.stringify({
    success: false,
    error: { code: 'UNAUTHORIZED', message },
  }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
