import type { APIRoute } from 'astro';
import { createAdminClient } from '../../../lib/supabase';
import { PaymentLogger } from '../../../lib/payment/logger';
import { getPaymentService } from '../../../lib/payment/gateway-factory';
import { TossPaymentAdapter } from '../../../lib/payment/adapters/toss-adapter';
import { validateAmount } from '../../../lib/payment/validators';

const { gateway, service: paymentService } = getPaymentService();

export const GET: APIRoute = async ({ request, redirect }) => {
  const startTime = performance.now();
  const cleanup = PaymentLogger.apiRequest(request, '/api/payment/confirm');
  const url = new URL(request.url);

  const paymentKey = url.searchParams.get('paymentKey') ?? '';
  const orderId = url.searchParams.get('orderId') ?? '';
  const amountStr = url.searchParams.get('amount') ?? '';

  PaymentLogger.info('PAYMENT_CONFIRM_REDIRECT', { paymentKey, orderId, amount: amountStr });

  if (!paymentKey || !orderId || !amountStr) {
    PaymentLogger.apiResponse(400, startTime, { reason: 'missing_params' });
    cleanup();
    return redirect(`/shop/payment-fail?code=MISSING_PARAMS&message=${encodeURIComponent('필수 파라미터가 누락되었습니다')}&orderId=${orderId}`);
  }

  const requestedAmount = parseInt(amountStr, 10);
  if (isNaN(requestedAmount) || requestedAmount <= 0) {
    PaymentLogger.apiResponse(400, startTime, { reason: 'invalid_amount' });
    cleanup();
    return redirect(`/shop/payment-fail?code=INVALID_AMOUNT&message=${encodeURIComponent('금액이 올바르지 않습니다')}&orderId=${orderId}`);
  }

  try {
    const supabase = createAdminClient();

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!payment) {
      PaymentLogger.error('CONFIRM_PAYMENT_NOT_FOUND', new Error(`No payment for orderId: ${orderId}`));
      cleanup();
      return redirect(`/shop/payment-fail?code=PAYMENT_NOT_FOUND&message=${encodeURIComponent('결제 정보를 찾을 수 없습니다')}&orderId=${orderId}`);
    }

    if (!validateAmount(payment.amount as number, requestedAmount, { payment_id: payment.id })) {
      PaymentLogger.critical('CONFIRM_AMOUNT_TAMPERED', new Error('Amount mismatch detected'), {
        db_amount: payment.amount,
        requested_amount: requestedAmount,
        payment_id: payment.id,
      });
      cleanup();
      return redirect(`/shop/payment-fail?code=AMOUNT_MISMATCH&message=${encodeURIComponent('결제 금액이 일치하지 않습니다')}&orderId=${orderId}`);
    }

    let confirmResult;
    if (gateway instanceof TossPaymentAdapter) {
      confirmResult = await PaymentLogger.measurePgCall(
        'PG_CALL_CONFIRM_TOSS',
        () => (gateway as TossPaymentAdapter).confirmPaymentWithOrderId(paymentKey, orderId, requestedAmount),
        { payment_id: payment.id, order_id: orderId }
      );
    } else {
      confirmResult = await PaymentLogger.measurePgCall(
        'PG_CALL_CONFIRM',
        () => gateway.confirmPayment(paymentKey, requestedAmount),
        { payment_id: payment.id, order_id: orderId }
      );
    }

    if (!confirmResult.success) {
      if (confirmResult.error_code === 'ALREADY_PROCESSED_PAYMENT') {
        PaymentLogger.info('CONFIRM_ALREADY_PROCESSED', {
          payment_id: payment.id,
          orderId,
        });

        await supabase
          .from('payments')
          .update({ pg_payment_id: paymentKey })
          .eq('id', payment.id);

        try {
          await paymentService.completeConfirmation(paymentKey, requestedAmount, {
            method: confirmResult.method,
            raw_response: confirmResult.raw_response,
          }, 'system');
        } catch {
          // completeConfirmation의 멱등 처리에 의존
        }

        PaymentLogger.apiResponse(302, startTime);
        cleanup();
        return redirect(`/shop/payment-success?orderId=${orderId}`);
      }

      PaymentLogger.error('CONFIRM_PG_FAILED', new Error(confirmResult.error_message ?? 'PG confirm failed'), {
        error_code: confirmResult.error_code,
      });

      await paymentService.failPayment(paymentKey, confirmResult.error_message ?? 'PG confirm failed', 'system');

      cleanup();
      return redirect(`/shop/payment-fail?code=${confirmResult.error_code ?? 'PG_ERROR'}&message=${encodeURIComponent(confirmResult.error_message ?? '결제 승인에 실패했습니다')}&orderId=${orderId}`);
    }

    await supabase
      .from('payments')
      .update({ pg_payment_id: paymentKey })
      .eq('id', payment.id);

    await paymentService.completeConfirmation(paymentKey, requestedAmount, {
      method: confirmResult.method,
      raw_response: confirmResult.raw_response,
    }, 'system');

    // 견적 기반 결제인 경우 quote_requests 상태를 completed로 업데이트
    try {
      const { data: order } = await supabase
        .from('orders')
        .select('quote_id')
        .eq('id', orderId)
        .single();

      if (order?.quote_id) {
        await supabase
          .from('quote_requests')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', order.quote_id);

        PaymentLogger.info('QUOTE_STATUS_UPDATED', {
          quote_id: order.quote_id,
          new_status: 'completed',
          order_id: orderId,
        });
      }
    } catch (quoteErr) {
      // 견적 상태 업데이트 실패해도 결제 자체는 성공이므로 로그만 남김
      PaymentLogger.warn('QUOTE_STATUS_UPDATE_FAILED', {
        order_id: orderId,
        error: quoteErr instanceof Error ? quoteErr.message : String(quoteErr),
      });
    }

    PaymentLogger.info('PAYMENT_CONFIRMED_SUCCESS', {
      payment_id: payment.id,
      amount: requestedAmount,
      method: confirmResult.method,
    });

    PaymentLogger.apiResponse(302, startTime);
    cleanup();
    return redirect(`/shop/payment-success?orderId=${orderId}`);
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    PaymentLogger.error('CONFIRM_UNEXPECTED_ERROR', error);
    PaymentLogger.apiResponse(500, startTime);
    cleanup();
    return redirect(`/shop/payment-fail?code=INTERNAL_ERROR&message=${encodeURIComponent('결제 처리 중 오류가 발생했습니다')}&orderId=${orderId}`);
  }
};
