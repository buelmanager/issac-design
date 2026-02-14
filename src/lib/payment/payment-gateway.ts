/**
 * PG 추상화 인터페이스
 *
 * 이 인터페이스만 구현하면 어떤 PG사든 교체 가능.
 * - 토스페이먼츠 → TossAdapter implements PaymentGateway
 * - 나이스페이먼츠 → NiceAdapter implements PaymentGateway
 * - Stripe → StripeAdapter implements PaymentGateway
 */
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  ConfirmPaymentResult,
  CancelPaymentResult,
  RefundPaymentResult,
} from './types';

export interface PaymentGateway {
  /** PG사 식별자 (ex: 'toss', 'nice', 'stripe', 'mock') */
  readonly provider: string;

  /** 결제 세션 생성 (결제창 호출 준비) */
  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;

  /** 결제 승인 확인 (클라이언트 → 서버 → PG 확인) */
  confirmPayment(pgPaymentId: string, amount: number): Promise<ConfirmPaymentResult>;

  /** 결제 취소 (PENDING 상태에서) */
  cancelPayment(pgPaymentId: string, reason: string): Promise<CancelPaymentResult>;

  /** 환불 요청 (PAID 상태에서) */
  refundPayment(pgPaymentId: string, amount: number, reason: string): Promise<RefundPaymentResult>;

  /** Webhook 서명 검증 */
  verifyWebhookSignature(payload: string, signature: string): boolean;
}
