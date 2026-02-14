/**
 * 결제 상태 머신 (State Machine)
 *
 * 규칙:
 * - 허용된 전이만 실행 가능
 * - 직접 UPDATE 절대 금지
 * - 모든 전이는 이 머신을 통해서만
 */
import { PAYMENT_STATUS, type PaymentStatus } from './types';

const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  [PAYMENT_STATUS.INIT]:           [PAYMENT_STATUS.PENDING],
  [PAYMENT_STATUS.PENDING]:        [PAYMENT_STATUS.PAID, PAYMENT_STATUS.FAILED, PAYMENT_STATUS.CANCELED],
  [PAYMENT_STATUS.PAID]:           [PAYMENT_STATUS.REFUND_PENDING],
  [PAYMENT_STATUS.FAILED]:         [],
  [PAYMENT_STATUS.CANCELED]:       [],
  [PAYMENT_STATUS.REFUND_PENDING]: [PAYMENT_STATUS.REFUNDED],
  [PAYMENT_STATUS.REFUNDED]:       [],
};

export class PaymentStateMachine {
  /**
   * 상태 전이가 유효한지 검증
   */
  static canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
    const allowed = VALID_TRANSITIONS[from];
    return allowed ? allowed.includes(to) : false;
  }

  /**
   * 허용된 다음 상태 목록 반환
   */
  static getNextStates(current: PaymentStatus): PaymentStatus[] {
    return VALID_TRANSITIONS[current] ?? [];
  }

  /**
   * 상태가 최종 상태(더 이상 전이 불가)인지 확인
   */
  static isFinalState(status: PaymentStatus): boolean {
    const next = VALID_TRANSITIONS[status];
    return !next || next.length === 0;
  }

  /**
   * 결제가 성공 상태인지 확인
   */
  static isPaid(status: PaymentStatus): boolean {
    return status === PAYMENT_STATUS.PAID;
  }

  /**
   * 취소/환불 가능한 상태인지 확인
   */
  static isCancelable(status: PaymentStatus): boolean {
    return status === PAYMENT_STATUS.PENDING;
  }

  static isRefundable(status: PaymentStatus): boolean {
    return status === PAYMENT_STATUS.PAID;
  }

  /**
   * 상태 전이 검증 + 에러 메시지 반환
   */
  static validateTransition(from: PaymentStatus, to: PaymentStatus): { valid: boolean; error?: string } {
    if (!Object.values(PAYMENT_STATUS).includes(from)) {
      return { valid: false, error: `Unknown status: ${from}` };
    }
    if (!Object.values(PAYMENT_STATUS).includes(to)) {
      return { valid: false, error: `Unknown status: ${to}` };
    }
    if (!PaymentStateMachine.canTransition(from, to)) {
      const allowed = PaymentStateMachine.getNextStates(from);
      return {
        valid: false,
        error: `Transition ${from} → ${to} is not allowed. Allowed: [${allowed.join(', ')}]`,
      };
    }
    return { valid: true };
  }
}
