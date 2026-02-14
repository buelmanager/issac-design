/**
 * GET /api/payment/status?order_id=xxx
 *
 * 결제 상태 조회 API
 * 주문 정보 + 결제 정보 + 상태 변경 로그 반환
 */
import type { APIRoute } from 'astro';
import { PaymentService } from '../../../lib/payment/payment-service';
import { MockPaymentAdapter } from '../../../lib/payment/adapters/mock-adapter';
import { PaymentLogger } from '../../../lib/payment/logger';
import { isValidUUID } from '../../../lib/payment/validators';
import type { ApiResponse } from '../../../lib/payment/types';

const gateway = new MockPaymentAdapter();
const paymentService = new PaymentService(gateway);

export const GET: APIRoute = async ({ url }) => {
  try {
    const orderId = url.searchParams.get('order_id');

    if (!orderId || !isValidUUID(orderId)) {
      return jsonResponse<ApiResponse>(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Valid order_id is required' },
      });
    }

    const result = await paymentService.getPaymentStatus(orderId);

    return jsonResponse<ApiResponse>(200, {
      success: true,
      data: result,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    PaymentLogger.error('API_STATUS_ERROR', error);

    const status = error.message.includes('not found') ? 404 : 500;
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
