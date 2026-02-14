/**
 * GET /api/payment/status?order_id=xxx
 *
 * 결제 상태 조회 API (인증 필수)
 * 주문 정보 + 결제 정보 + 상태 변경 로그 반환
 */
import type { APIRoute } from 'astro';
import { getPaymentService } from '../../../lib/payment/gateway-factory';
import { PaymentLogger } from '../../../lib/payment/logger';
import { isValidUUID } from '../../../lib/payment/validators';
import { verifyAdminAuth, unauthorizedResponse } from '../../../lib/payment/auth-guard';
import type { ApiResponse } from '../../../lib/payment/types';

const { service: paymentService } = getPaymentService();

export const GET: APIRoute = async ({ request, url }) => {
  const startTime = performance.now();
  const cleanup = PaymentLogger.apiRequest(request, '/api/payment/status');

  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.authorized) {
      PaymentLogger.apiResponse(401, startTime);
      cleanup();
      return unauthorizedResponse(auth.error);
    }

    const orderId = url.searchParams.get('order_id');

    if (!orderId || !isValidUUID(orderId)) {
      PaymentLogger.apiResponse(400, startTime, { reason: 'invalid_order_id' });
      cleanup();
      return jsonResponse<ApiResponse>(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid order_id is required' },
      });
    }

    const result = await paymentService.getPaymentStatus(orderId);

    PaymentLogger.apiResponse(200, startTime, { order_id: orderId });
    cleanup();
    return jsonResponse<ApiResponse>(200, {
      success: true,
      data: result,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    PaymentLogger.error('API_STATUS_ERROR', error);

    const status = error.message.includes('not found') ? 404 : 500;
    PaymentLogger.apiResponse(status, startTime, { error: error.message });
    cleanup();
    return jsonResponse<ApiResponse>(status, {
      success: false,
      error: { code: 'STATUS_ERROR', message: error.message },
    });
  }
};

function jsonResponse<T>(status: number, body: T): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
