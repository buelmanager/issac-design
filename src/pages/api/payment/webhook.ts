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
 */
import type { APIRoute } from 'astro';
import { PaymentService } from '../../../lib/payment/payment-service';
import { MockPaymentAdapter } from '../../../lib/payment/adapters/mock-adapter';
import { PaymentLogger } from '../../../lib/payment/logger';

const gateway = new MockPaymentAdapter();
const paymentService = new PaymentService(gateway);

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
        // 결제 성공 확인
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

    // Webhook은 항상 200 반환 (재전송 방지)
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    PaymentLogger.error('WEBHOOK_PROCESSING_ERROR', error, { body_length: rawBody.length });

    // Webhook 처리 실패 시에도 200 반환 (무한 재전송 방지)
    // PG사가 재전송하면 멱등성으로 처리됨
    return new Response(JSON.stringify({ received: true, error: error.message }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
