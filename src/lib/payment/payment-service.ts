/**
 * 결제 서비스 레이어 (Payment Service)
 *
 * 핵심 비즈니스 로직을 담당한다.
 * PG사에 의존하지 않는 순수한 결제 처리 로직.
 *
 * 원칙:
 * 1. DB가 진실의 근원 (Source of Truth)
 * 2. 모든 상태 변경은 상태 머신을 통해서만
 * 3. 트랜잭션 보장 (Supabase RPC)
 * 4. 멱등성 보장 (idempotency_key)
 * 5. 모든 작업은 로그로 추적
 */
import { createAdminClient } from '../supabase';
import { PaymentStateMachine } from './state-machine';
import { PaymentLogger } from './logger';
import { validateAmount, isValidAmount, calculateOrderTotal } from './validators';
import {
  PAYMENT_STATUS,
  type Payment,
  type Order,
  type OrderItem,
  type PaymentStatus,
  type TransitionResult,
  type PaymentStatusLog,
  type LogActor,
} from './types';
import type { PaymentGateway } from './payment-gateway';

export class PaymentService {
  private gateway: PaymentGateway;

  constructor(gateway: PaymentGateway) {
    this.gateway = gateway;
    PaymentLogger.info('PAYMENT_SERVICE_INIT', { provider: gateway.provider });
  }

  // ─── 1. 주문 생성 ───────────────────────────────
  async createOrder(params: {
    customer_name: string;
    customer_email?: string;
    customer_phone: string;
    user_id?: string;
    business_name?: string;
    shipping_address?: Record<string, string>;
    items: OrderItem[];
    quote_id?: string;
  }): Promise<Order> {
    const supabase = createAdminClient();

    // 금액 계산 및 검증
    const totalAmount = calculateOrderTotal(params.items);
    if (!isValidAmount(totalAmount)) {
      throw new Error('Invalid total amount');
    }

    PaymentLogger.info('ORDER_CREATE_START', {
      customer: params.customer_name,
      item_count: params.items.length,
      total_amount: totalAmount,
    });

    const insertData: Record<string, unknown> = {
      customer_name: params.customer_name,
      customer_email: params.customer_email ?? null,
      customer_phone: params.customer_phone,
      business_name: params.business_name ?? null,
      shipping_address: params.shipping_address ?? {},
      items: params.items as unknown as Record<string, unknown>[],
      total_amount: totalAmount,
      quote_id: params.quote_id ?? null,
    };
    if (params.user_id) {
      insertData.user_id = params.user_id;
    }

    const { data, error } = await supabase
      .from('orders')
      .insert(insertData)
      .select()
      .single();

    if (error || !data) {
      PaymentLogger.error('ORDER_CREATE_FAILED', error ?? new Error('No data returned'));
      throw new Error(`Failed to create order: ${error?.message}`);
    }

    PaymentLogger.info('ORDER_CREATED', {
      order_number: data.order_number,
      total_amount: totalAmount,
    }, { order_id: data.id });

    return data as unknown as Order;
  }

  // ─── 2. 결제 생성 (멱등성 보장) ────────────────
  async createPayment(orderId: string, idempotencyKey: string): Promise<Payment> {
    const supabase = createAdminClient();

    PaymentLogger.info('PAYMENT_CREATE_START', { idempotency_key: idempotencyKey }, { order_id: orderId });

    // 멱등성 체크: 이미 같은 키로 결제가 있으면 반환
    const { data: existing } = await supabase
      .from('payments')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (existing) {
      PaymentLogger.warn('PAYMENT_IDEMPOTENCY_HIT', {
        idempotency_key: idempotencyKey,
        existing_status: existing.status,
      }, { payment_id: existing.id, order_id: orderId });
      return existing as unknown as Payment;
    }

    // 주문 조회 및 금액 검증
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      PaymentLogger.error('ORDER_NOT_FOUND', new Error(`Order ${orderId} not found`), {}, { order_id: orderId });
      throw new Error(`Order not found: ${orderId}`);
    }

    if (order.status !== 'pending_payment') {
      PaymentLogger.warn('ORDER_INVALID_STATUS', {
        current_status: order.status,
        expected: 'pending_payment',
      }, { order_id: orderId });
      throw new Error(`Order status is ${order.status}, expected pending_payment`);
    }

    // 결제 레코드 생성 (INIT)
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        order_id: orderId,
        idempotency_key: idempotencyKey,
        amount: order.total_amount,
        currency: order.currency || 'KRW',
        status: PAYMENT_STATUS.INIT,
        pg_provider: this.gateway.provider,
      })
      .select()
      .single();

    if (paymentError || !payment) {
      PaymentLogger.error('PAYMENT_CREATE_FAILED', paymentError ?? new Error('No data'), {}, { order_id: orderId });
      throw new Error(`Failed to create payment: ${paymentError?.message}`);
    }

    PaymentLogger.info('PAYMENT_CREATED', {
      amount: payment.amount,
      provider: this.gateway.provider,
    }, { payment_id: payment.id, order_id: orderId });

    return payment as unknown as Payment;
  }

  // ─── 3. 결제 요청 (PG 세션 생성) ───────────────
  async requestPayment(paymentId: string): Promise<{ checkout_url?: string; pg_payment_id?: string }> {
    const supabase = createAdminClient();

    const { data: payment } = await supabase
      .from('payments')
      .select('*, orders(*)')
      .eq('id', paymentId)
      .single();

    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    const order = (payment as Record<string, unknown>).orders as Record<string, unknown>;

    PaymentLogger.info('PAYMENT_REQUEST_START', {
      amount: payment.amount,
      provider: this.gateway.provider,
    }, { payment_id: paymentId, order_id: payment.order_id });

    // PG에 결제 세션 생성 (타이밍 측정)
    const pgResult = await PaymentLogger.measurePgCall(
      'PG_CALL_CREATE_PAYMENT',
      () => this.gateway.createPayment({
        order_id: payment.order_id,
        amount: payment.amount as number,
        currency: payment.currency as string,
        order_name: `ISSAC Design 주문 ${(order?.order_number as string) ?? ''}`,
        customer_name: order?.customer_name as string,
        customer_email: order?.customer_email as string | undefined,
        idempotency_key: payment.idempotency_key as string,
      }),
      { payment_id: paymentId, order_id: payment.order_id }
    );

    if (!pgResult.success) {
      PaymentLogger.error(
        'PG_CREATE_FAILED',
        new Error(pgResult.error_message ?? 'Unknown PG error'),
        { pg_error_code: pgResult.error_code, raw_response: pgResult.raw_response },
        { payment_id: paymentId, order_id: payment.order_id }
      );
      throw new Error(`PG payment creation failed: ${pgResult.error_message}`);
    }

    // pg_payment_id 저장 + INIT → PENDING 전이
    await supabase
      .from('payments')
      .update({
        pg_payment_id: pgResult.pg_payment_id,
        pg_response: pgResult.raw_response ?? {},
      })
      .eq('id', paymentId);

    await this.transitionStatus(paymentId, PAYMENT_STATUS.INIT, PAYMENT_STATUS.PENDING, 'system', 'Payment requested to PG');

    PaymentLogger.info('PAYMENT_REQUESTED', {
      pg_payment_id: pgResult.pg_payment_id,
      checkout_url: pgResult.checkout_url,
    }, { payment_id: paymentId, order_id: payment.order_id });

    return {
      checkout_url: pgResult.checkout_url,
      pg_payment_id: pgResult.pg_payment_id,
    };
  }

  // ─── 4. 결제 확인 (Webhook 수신 시) ─────────────
  async confirmPayment(pgPaymentId: string, pgAmount: number, actor: LogActor = 'webhook'): Promise<Payment> {
    const supabase = createAdminClient();

    PaymentLogger.info('PAYMENT_CONFIRM_START', { pg_payment_id: pgPaymentId, pg_amount: pgAmount });

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('pg_payment_id', pgPaymentId)
      .single();

    if (!payment) {
      PaymentLogger.error('PAYMENT_NOT_FOUND_BY_PG_ID', new Error(`PG ID: ${pgPaymentId}`));
      throw new Error(`Payment not found for pg_payment_id: ${pgPaymentId}`);
    }

    if (payment.status === PAYMENT_STATUS.PAID) {
      PaymentLogger.info('PAYMENT_ALREADY_CONFIRMED', {
        pg_payment_id: pgPaymentId,
        payment_id: payment.id,
      });
      return payment as unknown as Payment;
    }

    const FINAL_STATUSES: string[] = [PAYMENT_STATUS.FAILED, PAYMENT_STATUS.CANCELED, PAYMENT_STATUS.REFUNDED];
    if (FINAL_STATUSES.includes(payment.status as string)) {
      throw new Error(`Payment is in final status: ${payment.status}, cannot confirm`);
    }

    if (!validateAmount(payment.amount as number, pgAmount, { payment_id: payment.id })) {
      throw new Error(`Amount mismatch: expected ${payment.amount}, received ${pgAmount}`);
    }

    // PG 확인 API 호출 (타이밍 측정)
    const confirmResult = await PaymentLogger.measurePgCall(
      'PG_CALL_CONFIRM_PAYMENT',
      () => this.gateway.confirmPayment(pgPaymentId, pgAmount),
      { payment_id: payment.id, order_id: payment.order_id }
    );

    if (!confirmResult.success) {
      await this.transitionStatus(payment.id, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED, actor, confirmResult.error_message);

      // PG 응답 저장
      await supabase
        .from('payments')
        .update({
          pg_response: confirmResult.raw_response ?? {},
          failed_reason: confirmResult.error_message,
        })
        .eq('id', payment.id);

      PaymentLogger.error(
        'PAYMENT_CONFIRM_FAILED',
        new Error(confirmResult.error_message ?? 'Confirm failed'),
        { raw_response: confirmResult.raw_response },
        { payment_id: payment.id, order_id: payment.order_id }
      );
      throw new Error(`Payment confirmation failed: ${confirmResult.error_message}`);
    }

    // PENDING → PAID 전이
    await this.transitionStatus(payment.id, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PAID, actor, 'Payment confirmed');

    // PG 응답 저장
    await supabase
      .from('payments')
      .update({
        pg_response: confirmResult.raw_response ?? {},
        method: confirmResult.method,
      })
      .eq('id', payment.id);

    // 최신 데이터 반환
    const { data: updated } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment.id)
      .single();

    PaymentLogger.info('PAYMENT_CONFIRMED', {
      amount: payment.amount,
      method: confirmResult.method,
    }, { payment_id: payment.id, order_id: payment.order_id });

    return updated as unknown as Payment;
  }

  /** confirmPayment()과 달리 PG API를 재호출하지 않고 상태 전이 + PG 응답 저장만 수행 */
  async completeConfirmation(
    pgPaymentId: string,
    pgAmount: number,
    confirmResult: { method?: string; raw_response?: Record<string, unknown> },
    actor: LogActor = 'system'
  ): Promise<Payment> {
    const supabase = createAdminClient();

    PaymentLogger.info('PAYMENT_COMPLETE_CONFIRMATION_START', { pg_payment_id: pgPaymentId, pg_amount: pgAmount });

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('pg_payment_id', pgPaymentId)
      .single();

    if (!payment) {
      PaymentLogger.error('PAYMENT_NOT_FOUND_BY_PG_ID', new Error(`PG ID: ${pgPaymentId}`));
      throw new Error(`Payment not found for pg_payment_id: ${pgPaymentId}`);
    }

    if (payment.status === PAYMENT_STATUS.PAID) {
      PaymentLogger.info('PAYMENT_ALREADY_CONFIRMED', {
        pg_payment_id: pgPaymentId,
        payment_id: payment.id,
      });
      return payment as unknown as Payment;
    }

    if (payment.status !== PAYMENT_STATUS.PENDING) {
      throw new Error(`Payment status is ${payment.status}, expected PENDING for confirmation`);
    }

    if (!validateAmount(payment.amount as number, pgAmount, { payment_id: payment.id })) {
      throw new Error(`Amount mismatch: expected ${payment.amount}, received ${pgAmount}`);
    }

    await this.transitionStatus(payment.id, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.PAID, actor, 'Payment confirmed');

    await supabase
      .from('payments')
      .update({
        pg_response: confirmResult.raw_response ?? {},
        method: confirmResult.method,
      })
      .eq('id', payment.id);

    const { data: updated } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment.id)
      .single();

    PaymentLogger.info('PAYMENT_CONFIRMED', {
      amount: payment.amount,
      method: confirmResult.method,
    }, { payment_id: payment.id, order_id: payment.order_id });

    return updated as unknown as Payment;
  }

  // ─── 5. 결제 취소 ───────────────────────────────
  async cancelPayment(paymentId: string, reason: string, actor: LogActor = 'user'): Promise<Payment> {
    const supabase = createAdminClient();

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (!payment) throw new Error(`Payment not found: ${paymentId}`);

    if (!PaymentStateMachine.isCancelable(payment.status as PaymentStatus)) {
      throw new Error(`Payment cannot be canceled in status: ${payment.status}`);
    }

    PaymentLogger.info('PAYMENT_CANCEL_START', { reason }, { payment_id: paymentId, order_id: payment.order_id });

    // PG 취소 호출 (pg_payment_id가 있으면, 타이밍 측정)
    if (payment.pg_payment_id) {
      const cancelResult = await PaymentLogger.measurePgCall(
        'PG_CALL_CANCEL_PAYMENT',
        () => this.gateway.cancelPayment(payment.pg_payment_id as string, reason),
        { payment_id: paymentId, order_id: payment.order_id }
      );
      if (!cancelResult.success) {
        PaymentLogger.error(
          'PG_CANCEL_FAILED',
          new Error(cancelResult.error_message ?? 'Cancel failed'),
          { raw_response: cancelResult.raw_response },
          { payment_id: paymentId }
        );
        throw new Error(`PG cancel failed: ${cancelResult.error_message}`);
      }
    }

    // PENDING → CANCELED 전이
    await this.transitionStatus(paymentId, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.CANCELED, actor, reason);

    const { data: updated } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    PaymentLogger.info('PAYMENT_CANCELED', { reason }, { payment_id: paymentId, order_id: payment.order_id });

    return updated as unknown as Payment;
  }

  // ─── 6. 환불 요청 ──────────────────────────────
  async requestRefund(paymentId: string, reason: string, amount?: number, actor: LogActor = 'admin'): Promise<Payment> {
    const supabase = createAdminClient();

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (!payment) throw new Error(`Payment not found: ${paymentId}`);

    if (!PaymentStateMachine.isRefundable(payment.status as PaymentStatus)) {
      throw new Error(`Payment cannot be refunded in status: ${payment.status}`);
    }

    const refundAmount = amount ?? (payment.amount as number);

    if (!payment.pg_payment_id) {
      PaymentLogger.error('REFUND_NO_PG_PAYMENT_ID', new Error('Missing pg_payment_id'), {}, { payment_id: paymentId });
      throw new Error(`Cannot refund: payment has no pg_payment_id`);
    }

    PaymentLogger.info('REFUND_REQUEST_START', {
      refund_amount: refundAmount,
      original_amount: payment.amount,
      reason,
    }, { payment_id: paymentId, order_id: payment.order_id });

    // PG 환불 호출 (타이밍 측정)
    const refundResult = await PaymentLogger.measurePgCall(
      'PG_CALL_REFUND_PAYMENT',
      () => this.gateway.refundPayment(
        payment.pg_payment_id as string,
        refundAmount,
        reason
      ),
      { payment_id: paymentId, order_id: payment.order_id }
    );

    if (!refundResult.success) {
      PaymentLogger.error(
        'PG_REFUND_FAILED',
        new Error(refundResult.error_message ?? 'Refund failed'),
        { raw_response: refundResult.raw_response },
        { payment_id: paymentId }
      );
      throw new Error(`PG refund failed: ${refundResult.error_message}`);
    }

    // PAID → REFUND_PENDING
    await this.transitionStatus(paymentId, PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUND_PENDING, actor, reason);

    const { data: updated } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    PaymentLogger.info('REFUND_REQUESTED', {
      refund_amount: refundAmount,
    }, { payment_id: paymentId, order_id: payment.order_id });

    return updated as unknown as Payment;
  }

  // ─── 6.5 결제 실패 처리 (Webhook에서 호출) ───────
  async failPayment(pgPaymentId: string, reason: string, actor: LogActor = 'webhook'): Promise<Payment> {
    const supabase = createAdminClient();

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('pg_payment_id', pgPaymentId)
      .single();

    if (!payment) {
      PaymentLogger.error('FAIL_PAYMENT_NOT_FOUND', new Error(`PG ID: ${pgPaymentId}`));
      throw new Error(`Payment not found for pg_payment_id: ${pgPaymentId}`);
    }

    // 이미 최종 상태면 무시 (멱등성)
    const FINAL_STATUSES: string[] = [PAYMENT_STATUS.FAILED, PAYMENT_STATUS.CANCELED, PAYMENT_STATUS.PAID, PAYMENT_STATUS.REFUNDED];
    if (FINAL_STATUSES.includes(payment.status as string)) {
      PaymentLogger.warn('FAIL_PAYMENT_ALREADY_FINAL', {
        current_status: payment.status,
        pg_payment_id: pgPaymentId,
      }, { payment_id: payment.id });
      return payment as unknown as Payment;
    }

    // PENDING → FAILED 전이
    await this.transitionStatus(payment.id, PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED, actor, reason);

    // 실패 사유 저장
    await supabase
      .from('payments')
      .update({ failed_reason: reason })
      .eq('id', payment.id);

    const { data: updated } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment.id)
      .single();

    PaymentLogger.warn('PAYMENT_FAILED', {
      reason,
      pg_payment_id: pgPaymentId,
    }, { payment_id: payment.id, order_id: payment.order_id });

    return updated as unknown as Payment;
  }

  // ─── 7. 환불 확인 (Webhook) ────────────────────
  async confirmRefund(pgPaymentId: string, actor: LogActor = 'webhook'): Promise<Payment> {
    const supabase = createAdminClient();

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('pg_payment_id', pgPaymentId)
      .single();

    if (!payment) throw new Error(`Payment not found for pg_payment_id: ${pgPaymentId}`);

    await this.transitionStatus(payment.id, PAYMENT_STATUS.REFUND_PENDING, PAYMENT_STATUS.REFUNDED, actor, 'Refund confirmed by PG');

    const { data: updated } = await supabase
      .from('payments')
      .select('*')
      .eq('id', payment.id)
      .single();

    PaymentLogger.info('REFUND_CONFIRMED', {
      amount: payment.amount,
    }, { payment_id: payment.id, order_id: payment.order_id });

    return updated as unknown as Payment;
  }

  // ─── 8. 상태 조회 ──────────────────────────────
  async getPaymentStatus(orderId: string): Promise<{
    order: Order;
    payment: Payment | null;
    logs: PaymentStatusLog[];
  }> {
    const supabase = createAdminClient();

    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (!order) throw new Error(`Order not found: ${orderId}`);

    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let logs: PaymentStatusLog[] = [];
    if (payment) {
      const { data: logData } = await supabase
        .from('payment_status_logs')
        .select('*')
        .eq('payment_id', payment.id)
        .order('created_at', { ascending: true });

      logs = (logData ?? []) as unknown as PaymentStatusLog[];
    }

    return {
      order: order as unknown as Order,
      payment: payment as unknown as Payment | null,
      logs,
    };
  }

  // ─── 9. 관리자: 결제 목록 조회 ─────────────────
  async listPayments(params?: {
    status?: PaymentStatus;
    limit?: number;
    offset?: number;
  }): Promise<{ payments: (Payment & { order?: Order })[]; total: number }> {
    const supabase = createAdminClient();
    const limit = params?.limit ?? 20;
    const offset = params?.offset ?? 0;

    let query = supabase
      .from('payments')
      .select('*, orders(*)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params?.status) {
      query = query.eq('status', params.status);
    }

    const { data, count, error } = await query;

    if (error) {
      PaymentLogger.error('LIST_PAYMENTS_FAILED', error);
      throw error;
    }

    return {
      payments: (data ?? []) as unknown as (Payment & { order?: Order })[],
      total: count ?? 0,
    };
  }

  // ─── 내부: 상태 전이 (DB RPC 호출) ─────────────
  private async transitionStatus(
    paymentId: string,
    fromStatus: PaymentStatus,
    toStatus: PaymentStatus,
    actor: LogActor | string,
    reason?: string
  ): Promise<void> {
    // 로컬 상태 머신 검증
    const validation = PaymentStateMachine.validateTransition(fromStatus, toStatus);
    if (!validation.valid) {
      PaymentLogger.error(
        'INVALID_STATE_TRANSITION',
        new Error(validation.error ?? ''),
        { from: fromStatus, to: toStatus },
        { payment_id: paymentId }
      );
      throw new Error(validation.error);
    }

    const supabase = createAdminClient();

    // DB 함수로 원자적 전이 (비관적 잠금 포함)
    const { data, error } = await supabase.rpc('transition_payment_status', {
      p_payment_id: paymentId,
      p_from_status: fromStatus,
      p_to_status: toStatus,
      p_reason: reason ?? null,
      p_actor: actor,
      p_metadata: {},
    });

    const result = data as unknown as TransitionResult;

    if (error || !result?.success) {
      const errorMsg = error?.message ?? result?.message ?? 'Transition failed';
      PaymentLogger.error(
        'STATE_TRANSITION_FAILED',
        new Error(errorMsg),
        { from: fromStatus, to: toStatus, result },
        { payment_id: paymentId }
      );
      throw new Error(errorMsg);
    }

    PaymentLogger.info('STATE_TRANSITION', {
      from: fromStatus,
      to: toStatus,
      actor,
      reason,
    }, { payment_id: paymentId });
  }
}
