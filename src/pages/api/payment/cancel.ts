/**
 * POST /api/payment/cancel
 *
 * 결제 취소 API (인증 필수, PENDING 상태에서만 가능)
 */
import type { APIRoute } from 'astro';
import { getPaymentService } from '../../../lib/payment/gateway-factory';
import { PaymentLogger } from '../../../lib/payment/logger';
import { validateCancelRequest, isValidUUID } from '../../../lib/payment/validators';
import { verifyAdminAuth, unauthorizedResponse } from '../../../lib/payment/auth-guard';
import type { ApiResponse } from '../../../lib/payment/types';

const { service: paymentService } = getPaymentService();

export const POST: APIRoute = async ({ request }) => {
  const startTime = performance.now();
  const cleanup = PaymentLogger.apiRequest(request, '/api/payment/cancel');

  try {
    const auth = await verifyAdminAuth(request);
    if (!auth.authorized) {
      PaymentLogger.apiResponse(401, startTime);
      cleanup();
      return unauthorizedResponse(auth.error);
    }

    const body = await request.json();

    const validation = validateCancelRequest(body);
    if (!validation.valid) {
      PaymentLogger.apiResponse(400, startTime, { validation_errors: validation.errors });
      cleanup();
      return jsonResponse<ApiResponse>(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: validation.errors.join(', ') },
      });
    }

    const { payment_id, reason } = body;

    if (!isValidUUID(payment_id)) {
      PaymentLogger.apiResponse(400, startTime, { reason: 'invalid_uuid' });
      cleanup();
      return jsonResponse<ApiResponse>(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid payment_id format' },
      });
    }

    const payment = await paymentService.cancelPayment(payment_id, reason);

    PaymentLogger.apiResponse(200, startTime, { payment_id: payment.id });
    cleanup();
    return jsonResponse<ApiResponse>(200, {
      success: true,
      data: { payment },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    PaymentLogger.error('API_CANCEL_PAYMENT_ERROR', error);

    const status = error.message.includes('cannot be canceled') ? 400 : 500;
    PaymentLogger.apiResponse(status, startTime, { error: error.message });
    cleanup();
    return jsonResponse<ApiResponse>(status, {
      success: false,
      error: { code: 'CANCEL_ERROR', message: error.message },
    });
  }
};

function jsonResponse<T>(status: number, body: T): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
