import type { APIRoute } from 'astro';
import { PaymentLogger } from '../../../lib/payment/logger';
import { getPaymentService } from '../../../lib/payment/gateway-factory';

const { service: paymentService } = getPaymentService();

export const GET: APIRoute = async ({ request, redirect }) => {
  const startTime = performance.now();
  const cleanup = PaymentLogger.apiRequest(request, '/api/payment/fail');
  const url = new URL(request.url);

  const code = url.searchParams.get('code') ?? 'UNKNOWN';
  const message = url.searchParams.get('message') ?? '알 수 없는 오류';
  const orderId = url.searchParams.get('orderId') ?? '';

  PaymentLogger.warn('PAYMENT_FAIL_REDIRECT', { code, message, orderId });

  if (orderId) {
    try {
      const pgPaymentId = `toss_${orderId}_fail`;
      await paymentService.failPayment(pgPaymentId, `${code}: ${message}`, 'system');
    } catch {
      PaymentLogger.warn('PAYMENT_FAIL_STATUS_UPDATE_SKIPPED', { orderId, reason: 'payment_not_found_or_already_final' });
    }
  }

  PaymentLogger.apiResponse(302, startTime);
  cleanup();
  return redirect(`/shop/payment-fail?code=${encodeURIComponent(code)}&message=${encodeURIComponent(message)}&orderId=${encodeURIComponent(orderId)}`);
};
