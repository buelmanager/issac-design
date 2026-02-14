/**
 * 토스 페이먼츠 PG 어댑터
 *
 * 토스 페이먼츠 API v1을 사용하여 결제 처리.
 * PaymentGateway 인터페이스를 구현하여 기존 시스템에 플러그인 방식으로 연결.
 *
 * API 문서: https://docs.tosspayments.com/reference
 *
 * 주요 특성:
 * - 인증: HTTP Basic Auth (Base64(secretKey + ':'))
 * - 멱등성: Idempotency-Key 헤더 (최대 300자, 15일 유효)
 * - 타임아웃: 10초 (AbortController)
 * - 재시도: PROVIDER_ERROR 에러 시 자동 재시도 (최대 2회)
 * - ALREADY_PROCESSED_PAYMENT: 성공으로 처리 (멱등성)
 */
import type { PaymentGateway } from '../payment-gateway';
import type {
  CreatePaymentParams,
  CreatePaymentResult,
  ConfirmPaymentResult,
  CancelPaymentResult,
  RefundPaymentResult,
} from '../types';
import { PaymentLogger } from '../logger';
import crypto from 'node:crypto';

// ─── 토스 API 상수 ────────────────────────────────
const TOSS_API_BASE = 'https://api.tosspayments.com';
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1_000;

// 재시도 가능한 에러 코드
const RETRYABLE_ERROR_CODES = new Set([
  'PROVIDER_ERROR',
  'FAILED_INTERNAL_SYSTEM_PROCESSING',
]);

// 성공으로 간주하는 에러 코드 (멱등성)
const IDEMPOTENT_SUCCESS_CODES = new Set([
  'ALREADY_PROCESSED_PAYMENT',
]);

// ─── 토스 API 응답 타입 ───────────────────────────
interface TossPaymentResponse {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  method?: string;
  approvedAt?: string;
  requestedAt?: string;
  receipt?: { url: string };
  card?: {
    issuerCode: string;
    number: string;
    installmentPlanMonths: number;
    isInterestFree: boolean;
  };
  virtualAccount?: {
    accountNumber: string;
    bankCode: string;
    dueDate: string;
  };
  secret?: string;
  cancels?: TossCancelResponse[];
}

interface TossCancelResponse {
  cancelAmount: number;
  cancelReason: string;
  canceledAt: string;
  transactionKey: string;
}

interface TossErrorResponse {
  code: string;
  message: string;
}

export class TossPaymentAdapter implements PaymentGateway {
  readonly provider = 'toss';
  private readonly secretKey: string;
  private readonly authHeader: string;

  constructor() {
    this.secretKey = import.meta.env.TOSS_SECRET_KEY ?? '';
    if (!this.secretKey) {
      PaymentLogger.critical(
        'TOSS_ADAPTER_NO_SECRET_KEY',
        new Error('TOSS_SECRET_KEY environment variable is not set')
      );
      throw new Error('TOSS_SECRET_KEY is required');
    }

    // Basic Auth: Base64(secretKey + ':')
    const encoded = Buffer.from(`${this.secretKey}:`).toString('base64');
    this.authHeader = `Basic ${encoded}`;

    PaymentLogger.info('TOSS_ADAPTER_INITIALIZED', {
      key_prefix: this.secretKey.slice(0, 10) + '...',
    });
  }

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    PaymentLogger.info('TOSS_CREATE_PAYMENT', {
      order_id: params.order_id,
      amount: params.amount,
    });

    const pgPaymentId = `toss_${params.order_id}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;

    return {
      success: true,
      pg_payment_id: pgPaymentId,
      checkout_url: undefined,
      raw_response: {
        provider: this.provider,
        order_id: params.order_id,
        amount: params.amount,
      },
    };
  }

  async confirmPayment(pgPaymentId: string, amount: number): Promise<ConfirmPaymentResult> {
    return this.confirmPaymentWithOrderId(pgPaymentId, '', amount);
  }

  async confirmPaymentWithOrderId(paymentKey: string, orderId: string, amount: number): Promise<ConfirmPaymentResult> {
    PaymentLogger.info('TOSS_CONFIRM_START', {
      payment_key: paymentKey,
      order_id: orderId,
      amount,
    });

    const response = await this.callApi<TossPaymentResponse>(
      '/v1/payments/confirm',
      'POST',
      { paymentKey, orderId, amount },
      `confirm_${paymentKey}`
    );

    if (!response.success) {
      if (response.errorCode && IDEMPOTENT_SUCCESS_CODES.has(response.errorCode)) {
        PaymentLogger.info('TOSS_CONFIRM_IDEMPOTENT', {
          payment_key: paymentKey,
          error_code: response.errorCode,
        });

        return {
          success: true,
          pg_payment_id: paymentKey,
          amount,
          approved_at: new Date().toISOString(),
          raw_response: { idempotent: true, original_code: response.errorCode },
        };
      }

      return {
        success: false,
        pg_payment_id: paymentKey,
        amount,
        error_code: response.errorCode,
        error_message: response.errorMessage,
        raw_response: response.rawResponse,
      };
    }

    const data = response.data!;

    const method = this.mapPaymentMethod(data.method);

    return {
      success: true,
      pg_payment_id: data.paymentKey,
      amount: data.totalAmount,
      method,
      approved_at: data.approvedAt,
      raw_response: data as unknown as Record<string, unknown>,
    };
  }

  // ─── 결제 취소 ────────────────────────────────────
  // POST /v1/payments/{paymentKey}/cancel
  async cancelPayment(pgPaymentId: string, reason: string): Promise<CancelPaymentResult> {
    PaymentLogger.info('TOSS_CANCEL_START', {
      payment_key: pgPaymentId,
      reason,
    });

    const response = await this.callApi<TossPaymentResponse>(
      `/v1/payments/${encodeURIComponent(pgPaymentId)}/cancel`,
      'POST',
      { cancelReason: reason },
      `cancel_${pgPaymentId}_${Date.now()}`
    );

    if (!response.success) {
      return {
        success: false,
        pg_payment_id: pgPaymentId,
        canceled_amount: 0,
        error_code: response.errorCode,
        error_message: response.errorMessage,
        raw_response: response.rawResponse,
      };
    }

    const data = response.data!;
    const lastCancel = data.cancels?.[data.cancels.length - 1];

    return {
      success: true,
      pg_payment_id: data.paymentKey,
      canceled_amount: lastCancel?.cancelAmount ?? data.totalAmount,
      raw_response: data as unknown as Record<string, unknown>,
    };
  }

  // ─── 환불 요청 ────────────────────────────────────
  // 토스에서는 취소와 환불이 같은 API (cancelAmount로 부분환불)
  async refundPayment(pgPaymentId: string, amount: number, reason: string): Promise<RefundPaymentResult> {
    PaymentLogger.info('TOSS_REFUND_START', {
      payment_key: pgPaymentId,
      amount,
      reason,
    });

    const response = await this.callApi<TossPaymentResponse>(
      `/v1/payments/${encodeURIComponent(pgPaymentId)}/cancel`,
      'POST',
      {
        cancelReason: reason,
        cancelAmount: amount,
      },
      `refund_${pgPaymentId}_${Date.now()}`
    );

    if (!response.success) {
      return {
        success: false,
        pg_payment_id: pgPaymentId,
        refunded_amount: 0,
        error_code: response.errorCode,
        error_message: response.errorMessage,
        raw_response: response.rawResponse,
      };
    }

    const data = response.data!;
    const lastCancel = data.cancels?.[data.cancels.length - 1];

    return {
      success: true,
      pg_payment_id: data.paymentKey,
      refunded_amount: lastCancel?.cancelAmount ?? amount,
      raw_response: data as unknown as Record<string, unknown>,
    };
  }

  // ─── Webhook 서명 검증 ────────────────────────────
  // 토스 웹훅은 HMAC-SHA256으로 서명
  // 검증: HMAC(secretKey, timestamp + body) === signature
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!signature) {
      PaymentLogger.warn('TOSS_WEBHOOK_NO_SIGNATURE');
      return false;
    }

    try {
      const hmac = crypto.createHmac('sha256', this.secretKey);
      hmac.update(payload);
      const expected = hmac.digest('base64');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(expected),
        Buffer.from(signature)
      );

      if (!isValid) {
        PaymentLogger.warn('TOSS_WEBHOOK_SIGNATURE_MISMATCH', {
          expected_length: expected.length,
          received_length: signature.length,
        });
      }

      return isValid;
    } catch (err) {
      PaymentLogger.error('TOSS_WEBHOOK_SIGNATURE_ERROR', err instanceof Error ? err : new Error(String(err)));
      return false;
    }
  }

  // ─── Private: API 호출 (재시도 + 타임아웃) ───────
  private async callApi<T>(
    path: string,
    method: string,
    body: Record<string, unknown>,
    idempotencyKey?: string,
    retryCount = 0
  ): Promise<{
    success: boolean;
    data?: T;
    errorCode?: string;
    errorMessage?: string;
    rawResponse?: Record<string, unknown>;
  }> {
    const url = `${TOSS_API_BASE}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const headers: Record<string, string> = {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      };

      // 멱등성 키 (최대 300자)
      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey.slice(0, 300);
      }

      const startTime = performance.now();

      const response = await fetch(url, {
        method,
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const duration = Math.round(performance.now() - startTime);

      const responseText = await response.text();
      let responseData: Record<string, unknown>;

      try {
        responseData = JSON.parse(responseText);
      } catch {
        PaymentLogger.error('TOSS_API_INVALID_JSON', new Error('Invalid JSON response'), {
          status: response.status,
          body_preview: responseText.slice(0, 200),
        });
        return {
          success: false,
          errorCode: 'INVALID_RESPONSE',
          errorMessage: 'Invalid JSON response from Toss API',
          rawResponse: { status: response.status, body: responseText.slice(0, 500) },
        };
      }

      PaymentLogger.info('TOSS_API_RESPONSE', {
        path,
        status: response.status,
        duration_ms: duration,
      });

      if (!response.ok) {
        const errorData = responseData as unknown as TossErrorResponse;

        // 재시도 가능한 에러인지 확인
        if (RETRYABLE_ERROR_CODES.has(errorData.code) && retryCount < MAX_RETRIES) {
          PaymentLogger.warn('TOSS_API_RETRYING', {
            path,
            error_code: errorData.code,
            retry: retryCount + 1,
          });
          await this.delay(RETRY_DELAY_MS * (retryCount + 1));
          return this.callApi<T>(path, method, body, idempotencyKey, retryCount + 1);
        }

        return {
          success: false,
          errorCode: errorData.code,
          errorMessage: errorData.message,
          rawResponse: responseData,
        };
      }

      return {
        success: true,
        data: responseData as T,
      };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        PaymentLogger.error('TOSS_API_TIMEOUT', new Error(`Request to ${path} timed out after ${REQUEST_TIMEOUT_MS}ms`));

        // 타임아웃도 재시도
        if (retryCount < MAX_RETRIES) {
          PaymentLogger.warn('TOSS_API_TIMEOUT_RETRY', { path, retry: retryCount + 1 });
          await this.delay(RETRY_DELAY_MS * (retryCount + 1));
          return this.callApi<T>(path, method, body, idempotencyKey, retryCount + 1);
        }

        return {
          success: false,
          errorCode: 'TIMEOUT',
          errorMessage: `Request timed out after ${REQUEST_TIMEOUT_MS}ms`,
        };
      }

      const error = err instanceof Error ? err : new Error(String(err));
      PaymentLogger.error('TOSS_API_ERROR', error, { path });

      return {
        success: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: error.message,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Private ──────────────────────────────────────
  private mapPaymentMethod(tossMethod?: string): string {
    if (!tossMethod) return 'unknown';

    const methodMap: Record<string, string> = {
      '카드': 'card',
      '가상계좌': 'virtual_account',
      '간편결제': 'card',
      '계좌이체': 'transfer',
      '휴대폰': 'mobile',
      '문화상품권': 'voucher',
      '도서문화상품권': 'voucher',
      '게임문화상품권': 'voucher',
    };

    return methodMap[tossMethod] ?? tossMethod.toLowerCase();
  }

  // ─── Private: 지연 ────────────────────────────────
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
