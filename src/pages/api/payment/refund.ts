/**
 * POST /api/payment/refund
 *
 * 환불 요청 API
 * - 일반 사용자: order_id + reason → 자기 주문만 환불 가능 (쿠키 인증)
 * - 관리자: payment_id + reason → 모든 주문 환불 가능 (Bearer 토큰)
 */
import type { APIRoute } from 'astro';
import { getPaymentService } from '../../../lib/payment/gateway-factory';
import { PaymentLogger } from '../../../lib/payment/logger';
import { isValidUUID } from '../../../lib/payment/validators';
import { verifyAdminAuth } from '../../../lib/payment/auth-guard';
import { createAstroServerClient } from '../../../lib/supabase-server';
import { createAdminClient } from '../../../lib/supabase';
import type { ApiResponse } from '../../../lib/payment/types';

const { service: paymentService } = getPaymentService();

export const POST: APIRoute = async ({ request }) => {
  const startTime = performance.now();
  const cleanup = PaymentLogger.apiRequest(request, '/api/payment/refund');

  try {
    const body = await request.json();
    const { order_id, payment_id, reason, amount } = body;

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      cleanup();
      return jsonResponse<ApiResponse>(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '환불 사유를 입력해주세요.' },
      });
    }

    // ── 관리자 경로: payment_id 직접 지정 ──
    const auth = await verifyAdminAuth(request);
    if (auth.authorized && payment_id) {
      if (!isValidUUID(payment_id)) {
        cleanup();
        return jsonResponse<ApiResponse>(400, {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid payment_id format' },
        });
      }

      const payment = await paymentService.requestRefund(payment_id, reason.trim(), amount, 'admin');

      const adminSupa = createAdminClient();
      const { data: pmt } = await adminSupa.from('payments').select('order_id').eq('id', payment_id).single();
      if (pmt?.order_id) {
        await adminSupa.from('orders').update({ status: 'refund_pending' }).eq('id', pmt.order_id);
      }

      PaymentLogger.apiResponse(200, startTime, { payment_id: payment.id });
      cleanup();
      return jsonResponse<ApiResponse>(200, { success: true, data: { payment } });
    }

    // ── 일반 사용자 경로: order_id로 환불 ──
    if (!order_id || typeof order_id !== 'string') {
      cleanup();
      return jsonResponse<ApiResponse>(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '주문 ID가 필요합니다.' },
      });
    }

    if (!isValidUUID(order_id)) {
      cleanup();
      return jsonResponse<ApiResponse>(400, {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: '유효하지 않은 주문 ID입니다.' },
      });
    }

    // 쿠키 기반 사용자 인증
    let userId: string | null = null;
    let userEmail: string | null = null;
    try {
      const { supabase } = createAstroServerClient(request);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        userEmail = user.email ?? null;
      }
    } catch {
      // not authenticated
    }

    if (!userId) {
      PaymentLogger.apiResponse(401, startTime);
      cleanup();
      return jsonResponse<ApiResponse>(401, {
        success: false,
        error: { code: 'UNAUTHORIZED', message: '로그인이 필요합니다.' },
      });
    }

    // 주문 소유권 확인
    const adminSupabase = createAdminClient();
    const { data: order, error: orderError } = await adminSupabase
      .from('orders')
      .select('id, user_id, customer_email, status')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      cleanup();
      return jsonResponse<ApiResponse>(404, {
        success: false,
        error: { code: 'NOT_FOUND', message: '주문을 찾을 수 없습니다.' },
      });
    }

    const isOwner =
      (order.user_id && order.user_id === userId) ||
      (order.customer_email && order.customer_email === userEmail);

    if (!isOwner) {
      PaymentLogger.warn('REFUND_NOT_OWNER', { order_id, userId });
      cleanup();
      return jsonResponse<ApiResponse>(403, {
        success: false,
        error: { code: 'FORBIDDEN', message: '본인의 주문만 환불할 수 있습니다.' },
      });
    }

    // 해당 주문의 결제 레코드 조회 (PAID 상태)
    const { data: paymentRecord } = await adminSupabase
      .from('payments')
      .select('id, status')
      .eq('order_id', order_id)
      .eq('status', 'PAID')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!paymentRecord) {
      cleanup();
      return jsonResponse<ApiResponse>(400, {
        success: false,
        error: { code: 'REFUND_ERROR', message: '환불 가능한 결제 내역이 없습니다.' },
      });
    }

    const refunded = await paymentService.requestRefund(paymentRecord.id, reason.trim(), amount, 'user');

    await adminSupabase
      .from('orders')
      .update({ status: 'refund_pending' })
      .eq('id', order_id);

    PaymentLogger.info('USER_REFUND_REQUESTED', {
      order_id,
      payment_id: paymentRecord.id,
      user_id: userId,
      reason: reason.trim(),
    });

    PaymentLogger.apiResponse(200, startTime, { payment_id: refunded.id });
    cleanup();
    return jsonResponse<ApiResponse>(200, { success: true, data: { payment: refunded } });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    PaymentLogger.error('API_REFUND_ERROR', error);

    const status = error.message.includes('cannot be refunded') ? 400 : 500;
    PaymentLogger.apiResponse(status, startTime, { error: error.message });
    cleanup();
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
