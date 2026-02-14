/**
 * POST /api/payment/create
 *
 * 결제 생성 API
 * 1. 주문 확인 → 결제 레코드 생성 (멱등성 보장)
 * 2. PG 결제 세션 생성
 * 3. 결제창 URL 반환
 */
import type { APIRoute } from 'astro';
import { PaymentService } from '../../../lib/payment/payment-service';
import { MockPaymentAdapter } from '../../../lib/payment/adapters/mock-adapter';
import { PaymentLogger } from '../../../lib/payment/logger';
import { validateCreatePaymentRequest } from '../../../lib/payment/validators';
import type { ApiResponse } from '../../../lib/payment/types';

// PG 어댑터 설정 (나중에 환경변수로 분기)
const gateway = new MockPaymentAdapter();
const paymentService = new PaymentService(gateway);

export const POST: APIRoute = async ({ request }) => {
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
