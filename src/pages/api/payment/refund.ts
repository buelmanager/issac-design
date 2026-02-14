/**
 * POST /api/payment/refund
 *
 * 환불 요청 API (PAID 상태에서만 가능)
 */
import type { APIRoute } from 'astro';
import { PaymentService } from '../../../lib/payment/payment-service';
import { MockPaymentAdapter } from '../../../lib/payment/adapters/mock-adapter';
import { PaymentLogger } from '../../../lib/payment/logger';
import { validateRefundRequest } from '../../../lib/payment/validators';
import type { ApiResponse } from '../../../lib/payment/types';

const gateway = new MockPaymentAdapter();
const paymentService = new PaymentService(gateway);

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const validation = validateRefundRequest(body);
    if (!validation.valid) {
      return jsonResponse<ApiResponse>(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: validation.errors.join(', ') },
      });
    }

    const { payment_id, reason, amount } = body;
    const payment = await paymentService.requestRefund(payment_id, reason, amount);

    return jsonResponse<ApiResponse>(200, {
      success: true,
      data: { payment },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    PaymentLogger.error('API_REFUND_ERROR', error);

    const status = error.message.includes('cannot be refunded') ? 400 : 500;
    return jsonResponse<ApiResponse>(status, {
      success: false,
      error: { code: 'REFUND_ERROR', message: error.message },
    });
  }
};

function jsonResponse<T>(status: number, body: T): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
