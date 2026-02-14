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
 * - search: 텍스트 검색 (action, error, payment_id, order_id, request_id)
 * - view: 'timeline' | 'errors' | 'stats' | 'all' (기본 'all')
 * - source: 'memory' | 'db' (기본 'memory', db는 영구 저장 로그 조회)
 */
import type { APIRoute } from 'astro';
import { PaymentLogger } from '../../../lib/payment/logger';
import { verifyAdminAuth, unauthorizedResponse } from '../../../lib/payment/auth-guard';
import type { ApiResponse, LogLevel } from '../../../lib/payment/types';

export const GET: APIRoute = async ({ request, url }) => {
  const startTime = performance.now();
  const cleanup = PaymentLogger.apiRequest(request, '/api/payment/logs');

  // 인증 필수 - 시스템 로그는 관리자만 조회
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    PaymentLogger.apiResponse(401, startTime);
    cleanup();
    return unauthorizedResponse(auth.error);
  }

  try {
    const view = url.searchParams.get('view') ?? 'all';
    const source = url.searchParams.get('source') ?? 'memory';
    const paymentId = url.searchParams.get('payment_id') ?? undefined;
    const orderId = url.searchParams.get('order_id') ?? undefined;
    const level = url.searchParams.get('level') as LogLevel | null;
    const from = url.searchParams.get('from') ?? undefined;
    const to = url.searchParams.get('to') ?? undefined;
    const search = url.searchParams.get('search') ?? undefined;
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);
    const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10), 0);

    switch (view) {
      case 'timeline': {
        if (!paymentId) {
          PaymentLogger.apiResponse(400, startTime, { reason: 'missing_payment_id' });
          cleanup();
          return jsonResponse<ApiResponse>(400, {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'payment_id is required for timeline view' },
          });
        }
        const timeline = PaymentLogger.getPaymentTimeline(paymentId);
        PaymentLogger.apiResponse(200, startTime, { view, count: timeline.length });
        cleanup();
        return jsonResponse<ApiResponse>(200, {
          success: true,
          data: { logs: timeline, total: timeline.length },
        });
      }

      case 'errors': {
        const errors = PaymentLogger.getErrorLogs(limit);
        PaymentLogger.apiResponse(200, startTime, { view, count: errors.length });
        cleanup();
        return jsonResponse<ApiResponse>(200, {
          success: true,
          data: { logs: errors, total: errors.length },
        });
      }

      case 'stats': {
        const stats = PaymentLogger.getStats();
        PaymentLogger.apiResponse(200, startTime, { view });
        cleanup();
        return jsonResponse<ApiResponse>(200, {
          success: true,
          data: stats,
        });
      }

      default: {
        const filters = {
          level: level ?? undefined,
          payment_id: paymentId,
          order_id: orderId,
          from,
          to,
          limit,
          offset,
          search,
        };

        // DB 소스 요청 시 영구 저장 로그에서 조회
        const result = source === 'db'
          ? await PaymentLogger.getLogsFromDB(filters)
          : PaymentLogger.getAllLogs(filters);

        PaymentLogger.apiResponse(200, startTime, { view, source, count: result.logs.length, total: result.total });
        cleanup();
        return jsonResponse<ApiResponse>(200, {
          success: true,
          data: result,
        });
      }
    }
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    PaymentLogger.apiResponse(500, startTime, { error: error.message });
    cleanup();
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
