/**
 * 결제 검증 유틸리티
 *
 * 원칙:
 * - 금액은 반드시 정수 (원 단위)
 * - 금액 불일치 = CRITICAL 에러
 * - 모든 외부 입력은 검증 후 사용
 */
import type {
  CreatePaymentRequest,
  CancelPaymentRequest,
  RefundPaymentRequest,
  OrderItem,
} from './types';
import { PaymentLogger } from './logger';

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 금액 검증 (우리 DB vs PG 응답)
 */
export function validateAmount(expected: number, actual: number, context?: { payment_id?: string }): boolean {
  if (expected !== actual) {
    PaymentLogger.critical(
      'AMOUNT_MISMATCH',
      new Error(`Expected ${expected} but received ${actual}`),
      { expected, actual, diff: actual - expected },
      context
    );
    return false;
  }
  return true;
}

/**
 * 금액이 유효한 정수인지 검증
 */
export function isValidAmount(amount: unknown): amount is number {
  return typeof amount === 'number' && Number.isInteger(amount) && amount > 0;
}

/**
 * 주문 아이템으로부터 총 금액 계산 (검증용)
 */
export function calculateOrderTotal(items: OrderItem[]): number {
  return items.reduce((sum, item) => {
    if (!isValidAmount(item.unit_price) || !isValidAmount(item.quantity)) {
      throw new Error(`Invalid item: ${item.product_id}`);
    }
    return sum + item.unit_price * item.quantity;
  }, 0);
}

/**
 * 결제 생성 요청 검증
 */
export function validateCreatePaymentRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const req = body as Partial<CreatePaymentRequest>;

  if (!req.order_id || typeof req.order_id !== 'string') {
    errors.push('order_id is required');
  }
  if (!req.idempotency_key || typeof req.idempotency_key !== 'string') {
    errors.push('idempotency_key is required');
  }
  if (req.idempotency_key && req.idempotency_key.length > 255) {
    errors.push('idempotency_key must be 255 chars or less');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 결제 취소 요청 검증
 */
export function validateCancelRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const req = body as Partial<CancelPaymentRequest>;

  if (!req.payment_id || typeof req.payment_id !== 'string') {
    errors.push('payment_id is required');
  }
  if (!req.reason || typeof req.reason !== 'string') {
    errors.push('reason is required');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 환불 요청 검증
 */
export function validateRefundRequest(body: unknown): ValidationResult {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return { valid: false, errors: ['Request body is required'] };
  }

  const req = body as Partial<RefundPaymentRequest>;

  if (!req.payment_id || typeof req.payment_id !== 'string') {
    errors.push('payment_id is required');
  }
  if (!req.reason || typeof req.reason !== 'string') {
    errors.push('reason is required');
  }
  if (req.amount !== undefined && !isValidAmount(req.amount)) {
    errors.push('amount must be a positive integer');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * UUID 형식 검증
 */
export function isValidUUID(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * 멱등성 키 생성 (클라이언트 → 서버)
 */
export function generateIdempotencyKey(orderId: string, attempt = 1): string {
  const timestamp = Date.now();
  return `${orderId}_${timestamp}_${attempt}`;
}
