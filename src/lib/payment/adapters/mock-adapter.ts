/**
 * Mock PG 어댑터 (개발/테스트용)
 *
 * 실제 PG 없이 결제 플로우 전체를 테스트할 수 있다.
 * PG사 결정 후 이 파일을 참고하여 실제 어댑터를 구현하면 된다.
 */
import type { PaymentGateway } from '../payment-gateway';
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  ConfirmPaymentResult,
  CancelPaymentResult,
  RefundPaymentResult,
} from '../types';

const MOCK_SECRET = 'mock-webhook-secret-key';

export class MockPaymentAdapter implements PaymentGateway {
  readonly provider = 'mock';

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const pgPaymentId = `mock_pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return {
      success: true,
      pg_payment_id: pgPaymentId,
      checkout_url: `/api/payment/mock-checkout?pg_id=${pgPaymentId}&amount=${params.amount}`,
      raw_response: {
        provider: this.provider,
        created_at: new Date().toISOString(),
        params,
      },
    };
  }

  async confirmPayment(pgPaymentId: string, amount: number): Promise<ConfirmPaymentResult> {
    return {
      success: true,
      pg_payment_id: pgPaymentId,
      amount,
      method: 'card',
      approved_at: new Date().toISOString(),
      raw_response: {
        provider: this.provider,
        status: 'DONE',
      },
    };
  }

  async cancelPayment(pgPaymentId: string, reason: string): Promise<CancelPaymentResult> {
    return {
      success: true,
      pg_payment_id: pgPaymentId,
      canceled_amount: 0,
      raw_response: {
        provider: this.provider,
        cancel_reason: reason,
      },
    };
  }

  async refundPayment(pgPaymentId: string, amount: number, reason: string): Promise<RefundPaymentResult> {
    return {
      success: true,
      pg_payment_id: pgPaymentId,
      refunded_amount: amount,
      raw_response: {
        provider: this.provider,
        refund_reason: reason,
      },
    };
  }

  verifyWebhookSignature(payload: string, signature: string): boolean {
    // Mock: 간단한 HMAC 시뮬레이션
    const expected = `mock_sig_${payload.length}_${MOCK_SECRET.length}`;
    return signature === expected;
  }

  /**
   * 테스트용: Mock Webhook 서명 생성
   */
  static generateMockSignature(payload: string): string {
    return `mock_sig_${payload.length}_${MOCK_SECRET.length}`;
  }
}
