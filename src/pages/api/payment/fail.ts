import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';
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
      const supabase = createAdminClient();
      const { data: payment } = await supabase
        .from('payments')
        .select('id, pg_payment_id, status')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (payment?.pg_payment_id) {
        await paymentService.failPayment(
          payment.pg_payment_id as string,
          `${code}: ${message}`,
          'system'
        );
      } else if (payment) {
        PaymentLogger.warn('PAYMENT_FAIL_NO_PG_ID', { orderId, payment_id: payment.id });
      }
    } catch {
      PaymentLogger.warn('PAYMENT_FAIL_STATUS_UPDATE_SKIPPED', { orderId, reason: 'payment_not_found_or_already_final' });
    }
  }

  PaymentLogger.apiResponse(302, startTime);
  cleanup();
  return redirect(`/shop/payment-fail?code=${encodeURIComponent(code)}&message=${encodeURIComponent(message)}&orderId=${encodeURIComponent(orderId)}`);
};
