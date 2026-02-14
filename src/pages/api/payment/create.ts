/**
 * POST /api/payment/create
 *
 * 결제 생성 API (인증 필수)
 * 1. 관리자 인증 확인
 * 2. 주문 확인 → 결제 레코드 생성 (멱등성 보장)
 * 3. PG 결제 세션 생성
 * 4. 결제창 URL 반환
 */
import type { APIRoute } from 'astro';
import { getPaymentService } from '../../../lib/payment/gateway-factory';
import { PaymentLogger } from '../../../lib/payment/logger';
import { validateCreatePaymentRequest, isValidUUID } from '../../../lib/payment/validators';
import { verifyAdminAuth, unauthorizedResponse } from '../../../lib/payment/auth-guard';
import type { ApiResponse } from '../../../lib/payment/types';

const { service: paymentService } = getPaymentService();

export const POST: APIRoute = async ({ request }) => {
  // 인증 확인
  const auth = await verifyAdminAuth(request);
  if (!auth.authorized) {
    return unauthorizedResponse(auth.error);
  }

  try {
    const body = await request.json();

    // 요청 검증
    const validation = validateCreatePaymentRequest(body);
    if (!validation.valid) {
      return jsonResponse<ApiResponse>(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: validation.errors.join(', ') },
      });
    }

    const { order_id, idempotency_key } = body;

    // UUID 형식 검증
    if (!isValidUUID(order_id)) {
      return jsonResponse<ApiResponse>(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid order_id format' },
      });
    }

    // 결제 생성 (멱등성 보장)
    const payment = await paymentService.createPayment(order_id, idempotency_key);

    // PG 결제 세션 생성 (INIT → PENDING)
    const { checkout_url, pg_payment_id } = await paymentService.requestPayment(payment.id);

    return jsonResponse<ApiResponse>(200, {
      success: true,
      data: {
        payment_id: payment.id,
        pg_payment_id,
        checkout_url,
        status: 'PENDING',
      },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    PaymentLogger.error('API_CREATE_PAYMENT_ERROR', error);

    return jsonResponse<ApiResponse>(500, {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message },
    });
  }
};

function jsonResponse<T>(status: number, body: T): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
