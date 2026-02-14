/**
 * GET /api/payment/logs
 *
 * 결제 시스템 로그 조회 API (관리자 전용, 인증 필수)
 *
 * 쿼리 파라미터:
 * - level: 로그 레벨 필터 (INFO, WARN, ERROR, CRITICAL)
 * - payment_id: 특정 결제 로그만
 * - order_id: 특정 주문 로그만
 * - from: 시작 시간 (ISO 8601)
 * - to: 종료 시간 (ISO 8601)
 * - limit: 페이지 크기 (기본 50)
 * - offset: 오프셋
 * - view: 'timeline' | 'errors' | 'stats' | 'all' (기본 'all')
 */
import type { APIRoute } from 'astro';
import { PaymentLogger } from '../../../lib/payment/logger';
import { verifyAdminAuth, unauthorizedResponse } from '../../../lib/payment/auth-guard';
import type { ApiResponse, LogLevel } from '../../../lib/payment/types';

export const GET: APIRoute = async ({ request, url }) => {
  // 인증 필수 - 시스템 로그는 관리자만 조회
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const view = url.searchParams.get('view') ?? 'all';
    const paymentId = url.searchParams.get('payment_id') ?? undefined;
    const orderId = url.searchParams.get('order_id') ?? undefined;
    const level = url.searchParams.get('level') as LogLevel | null;
    const from = url.searchParams.get('from') ?? undefined;
    const to = url.searchParams.get('to') ?? undefined;
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);
    const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10), 0);

    switch (view) {
      case 'timeline': {
        if (!paymentId) {
          return jsonResponse<ApiResponse>(400, {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'payment_id is required for timeline view' },
          });
        }
        const timeline = PaymentLogger.getPaymentTimeline(paymentId);
        return jsonResponse<ApiResponse>(200, {
          success: true,
          data: { logs: timeline, total: timeline.length },
        });
      }

      case 'errors': {
        const errors = PaymentLogger.getErrorLogs(limit);
        return jsonResponse<ApiResponse>(200, {
          success: true,
          data: { logs: errors, total: errors.length },
        });
      }

      case 'stats': {
        const stats = PaymentLogger.getStats();
        return jsonResponse<ApiResponse>(200, {
          success: true,
          data: stats,
        });
      }

      default: {
        const result = PaymentLogger.getAllLogs({
          level: level ?? undefined,
          payment_id: paymentId,
          order_id: orderId,
          from,
          to,
          limit,
          offset,
        });
        return jsonResponse<ApiResponse>(200, {
          success: true,
          data: result,
        });
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    return jsonResponse<ApiResponse>(500, {
      success: false,
      error: { code: 'LOG_ERROR', message: error.message },
    });
  }
};

function jsonResponse<T>(status: number, body: T): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
