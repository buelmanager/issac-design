/**
 * POST /api/payment/webhook
 *
 * PG Webhook 수신 엔드포인트
 *
 * 핵심 보안:
 * 1. 서명 검증 필수
 * 2. 금액 검증 필수
 * 3. 트랜잭션으로 상태 변경
 * 4. 모든 이벤트 로깅
 * 5. 내부 에러 메시지 외부 노출 금지
 */
import type { APIRoute } from 'astro';
import { getPaymentService } from '../../../lib/payment/gateway-factory';
import { PaymentLogger } from '../../../lib/payment/logger';

const { gateway, service: paymentService } = getPaymentService();

export const POST: APIRoute = async ({ request }) => {
  const rawBody = await request.text();
  const signature = request.headers.get('x-webhook-signature') ?? '';

  PaymentLogger.info('WEBHOOK_RECEIVED', {
    content_length: rawBody.length,
    has_signature: !!signature,
  });

  // 1. 서명 검증
  if (!gateway.verifyWebhookSignature(rawBody, signature)) {
    PaymentLogger.critical(
      'WEBHOOK_SIGNATURE_INVALID',
      new Error('Webhook signature verification failed'),
      { signature_provided: !!signature }
    );

    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const event = JSON.parse(rawBody);

    PaymentLogger.info('WEBHOOK_EVENT', {
      type: event.type,
      pg_payment_id: event.pg_payment_id,
    });

    switch (event.type) {
      case 'payment.confirmed':
      case 'payment_intent.succeeded': {
        await paymentService.confirmPayment(
          event.pg_payment_id,
          event.amount
        );
        PaymentLogger.info('WEBHOOK_PAYMENT_CONFIRMED', {
          pg_payment_id: event.pg_payment_id,
          amount: event.amount,
        });
        break;
      }

      case 'payment.failed':
      case 'payment_intent.payment_failed': {
        // CRITICAL FIX: PENDING → FAILED 상태 전이 실행
        await paymentService.failPayment(
          event.pg_payment_id,
          event.error_message ?? 'Payment failed'
        );
        PaymentLogger.warn('WEBHOOK_PAYMENT_FAILED', {
          pg_payment_id: event.pg_payment_id,
          error: event.error_message,
        });
        break;
      }

      case 'payment.refunded':
      case 'charge.refunded': {
        await paymentService.confirmRefund(event.pg_payment_id);
        PaymentLogger.info('WEBHOOK_REFUND_CONFIRMED', {
          pg_payment_id: event.pg_payment_id,
        });
        break;
      }

      default: {
        PaymentLogger.warn('WEBHOOK_UNKNOWN_EVENT', { type: event.type });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    PaymentLogger.error('WEBHOOK_PROCESSING_ERROR', error, { body_length: rawBody.length });

    // 내부 에러 메시지 절대 외부 노출 금지
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
