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
 * 6. Raw payload 보존 (디버깅/감사용)
 */
import type { APIRoute } from 'astro';
import { getPaymentService } from '../../../lib/payment/gateway-factory';
import { PaymentLogger } from '../../../lib/payment/logger';
import { isValidAmount } from '../../../lib/payment/validators';

const { gateway, service: paymentService } = getPaymentService();

export const POST: APIRoute = async ({ request }) => {
  const startTime = performance.now();
  const cleanup = PaymentLogger.apiRequest(request, '/api/payment/webhook');

  const rawBody = await request.text();
  const signature = request.headers.get('x-webhook-signature')
    ?? request.headers.get('toss-signature') ?? '';

  // Raw payload 보존 (디버깅/감사용, 민감정보 자동 마스킹)
  PaymentLogger.info('WEBHOOK_RAW_PAYLOAD', {
    content_length: rawBody.length,
    has_signature: !!signature,
    body_preview: rawBody.slice(0, 500),
  });

  // 1. 서명 검증
  if (!gateway.verifyWebhookSignature(rawBody, signature)) {
    PaymentLogger.critical(
      'WEBHOOK_SIGNATURE_INVALID',
      new Error('Webhook signature verification failed'),
      {
        signature_provided: !!signature,
        content_length: rawBody.length,
        ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      }
    );

    PaymentLogger.apiResponse(401, startTime, { reason: 'invalid_signature' });
    cleanup();
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

    switch (event.type ?? event.eventType) {
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

      case 'PAYMENT_STATUS_CHANGED': {
        const tossData = event.data;
        const paymentKey = tossData?.paymentKey;
        const status = tossData?.status;

        if (!paymentKey) {
          PaymentLogger.warn('WEBHOOK_TOSS_NO_PAYMENT_KEY', { event_type: event.eventType });
          break;
        }

        if (status === 'DONE') {
          if (!isValidAmount(tossData.totalAmount)) {
            PaymentLogger.critical('WEBHOOK_TOSS_INVALID_AMOUNT', new Error('Invalid totalAmount in PAYMENT_STATUS_CHANGED'), {
              paymentKey,
              totalAmount: tossData.totalAmount,
            });
            break;
          }
          await paymentService.confirmPayment(paymentKey, tossData.totalAmount);
          PaymentLogger.info('WEBHOOK_TOSS_CONFIRMED', { paymentKey, amount: tossData.totalAmount });
        } else if (status === 'CANCELED' || status === 'PARTIAL_CANCELED') {
          await paymentService.confirmRefund(paymentKey);
          PaymentLogger.info('WEBHOOK_TOSS_CANCELED', { paymentKey, status });
        } else if (status === 'ABORTED' || status === 'EXPIRED') {
          await paymentService.failPayment(paymentKey, `Toss status: ${status}`);
          PaymentLogger.warn('WEBHOOK_TOSS_FAILED', { paymentKey, status });
        } else {
          PaymentLogger.info('WEBHOOK_TOSS_STATUS_IGNORED', { paymentKey, status });
        }
        break;
      }

      case 'DEPOSIT_CALLBACK': {
        const depositData = event.data;
        const depositPaymentKey = depositData?.paymentKey;
        const depositStatus = depositData?.status;

        if (depositPaymentKey && depositStatus === 'DONE') {
          if (!isValidAmount(depositData.totalAmount)) {
            PaymentLogger.critical('WEBHOOK_DEPOSIT_INVALID_AMOUNT', new Error('Invalid totalAmount in DEPOSIT_CALLBACK'), {
              paymentKey: depositPaymentKey,
              totalAmount: depositData.totalAmount,
            });
            break;
          }
          await paymentService.confirmPayment(depositPaymentKey, depositData.totalAmount);
          PaymentLogger.info('WEBHOOK_TOSS_DEPOSIT_CONFIRMED', { paymentKey: depositPaymentKey });
        }
        break;
      }

      case 'CANCEL_STATUS_CHANGED': {
        const cancelData = event.data;
        const cancelPaymentKey = cancelData?.paymentKey;

        if (cancelPaymentKey) {
          await paymentService.confirmRefund(cancelPaymentKey);
          PaymentLogger.info('WEBHOOK_TOSS_CANCEL_CONFIRMED', { paymentKey: cancelPaymentKey });
        }
        break;
      }

      default: {
        PaymentLogger.warn('WEBHOOK_UNKNOWN_EVENT', {
          type: event.type ?? event.eventType,
          body_preview: rawBody.slice(0, 300),
        });
      }
    }

    PaymentLogger.apiResponse(200, startTime, { event_type: event.type });
    cleanup();
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    PaymentLogger.error('WEBHOOK_PROCESSING_ERROR', error, { body_length: rawBody.length });
    PaymentLogger.apiResponse(500, startTime, { error: 'processing_failed' });
    cleanup();

    return new Response(JSON.stringify({ error: 'Internal processing error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
