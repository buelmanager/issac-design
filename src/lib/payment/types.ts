/**
 * 결제 시스템 타입 정의
 *
 * 원칙:
 * - 금액은 항상 정수 (원 단위, BIGINT)
 * - 상태는 enum으로 제한
 * - PG 응답은 unknown으로 받아서 검증
 */

// ─── 결제 상태 ────────────────────────────────────
export const PAYMENT_STATUS = {
  INIT: 'INIT',
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELED: 'CANCELED',
  REFUND_PENDING: 'REFUND_PENDING',
  REFUNDED: 'REFUNDED',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

// ─── 주문 상태 ────────────────────────────────────
export const ORDER_STATUS = {
  PENDING_PAYMENT: 'pending_payment',
  PAID: 'paid',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELED: 'canceled',
} as const;

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS];

// ─── 결제 수단 ────────────────────────────────────
export const PAYMENT_METHOD = {
  CARD: 'card',
  TRANSFER: 'transfer',
  VIRTUAL_ACCOUNT: 'virtual_account',
  MOBILE: 'mobile',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

// ─── 로그 레벨 ────────────────────────────────────
export const LOG_LEVEL = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL',
} as const;

export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];

// ─── 로그 액터 (누가 변경했는지) ──────────────────
export const LOG_ACTOR = {
  SYSTEM: 'system',
  WEBHOOK: 'webhook',
  ADMIN: 'admin',
  USER: 'user',
  CRON: 'cron',
} as const;

export type LogActor = (typeof LOG_ACTOR)[keyof typeof LOG_ACTOR];

// ─── 주문 아이템 ──────────────────────────────────
export interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  options?: Record<string, string>;
  thumbnail?: string;
}

// ─── 배송지 ───────────────────────────────────────
export interface ShippingAddress {
  zipcode?: string;
  address1?: string;
  address2?: string;
  receiver_name?: string;
  receiver_phone?: string;
  memo?: string;
}

// ─── 주문 ─────────────────────────────────────────
export interface Order {
  id: string;
  order_number: string;
  quote_id?: string | null;
  customer_name: string;
  customer_email?: string | null;
  customer_phone: string;
  business_name?: string | null;
  shipping_address: ShippingAddress;
  items: OrderItem[];
  total_amount: number;
  currency: string;
  status: OrderStatus;
  admin_notes?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── 결제 ─────────────────────────────────────────
export interface Payment {
  id: string;
  order_id: string;
  idempotency_key: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  pg_provider?: string | null;
  pg_payment_id?: string | null;
  pg_response?: Record<string, unknown>;
  method?: string | null;
  failed_reason?: string | null;
  paid_at?: string | null;
  canceled_at?: string | null;
  refunded_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── 결제 상태 로그 ───────────────────────────────
export interface PaymentStatusLog {
  id: string;
  payment_id: string;
  from_status: PaymentStatus;
  to_status: PaymentStatus;
  reason?: string | null;
  actor: LogActor;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── PG 연동 인터페이스 파라미터 ──────────────────
export interface CreatePaymentParams {
  order_id: string;
  amount: number;
  currency: string;
  order_name: string;
  customer_name: string;
  customer_email?: string;
  idempotency_key: string;
  method?: PaymentMethod;
  return_url?: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentResult {
  success: boolean;
  pg_payment_id?: string;
  checkout_url?: string;
  error_code?: string;
  error_message?: string;
  raw_response?: Record<string, unknown>;
}

export interface ConfirmPaymentResult {
  success: boolean;
  pg_payment_id: string;
  amount: number;
  method?: string;
  approved_at?: string;
  error_code?: string;
  error_message?: string;
  raw_response?: Record<string, unknown>;
}

export interface CancelPaymentResult {
  success: boolean;
  pg_payment_id: string;
  canceled_amount: number;
  error_code?: string;
  error_message?: string;
  raw_response?: Record<string, unknown>;
}

export interface RefundPaymentResult {
  success: boolean;
  pg_payment_id: string;
  refunded_amount: number;
  error_code?: string;
  error_message?: string;
  raw_response?: Record<string, unknown>;
}

// ─── API 요청/응답 ────────────────────────────────
export interface CreatePaymentRequest {
  order_id: string;
  idempotency_key: string;
  method?: PaymentMethod;
}

export interface CancelPaymentRequest {
  payment_id: string;
  reason: string;
}

export interface RefundPaymentRequest {
  payment_id: string;
  amount?: number;
  reason: string;
}

export interface PaymentStatusResponse {
  order: Order;
  payment: Payment;
  logs: PaymentStatusLog[];
}

// ─── API 공통 응답 ────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

// ─── 상태 전이 결과 (DB 함수 반환) ────────────────
export interface TransitionResult {
  success: boolean;
  payment_id?: string;
  from_status?: string;
  to_status?: string;
  error?: string;
  message?: string;
}

// ─── 시스템 로그 (DB 영구 저장 + 관리자 화면용) ──────
export interface SystemLog {
  timestamp: string;
  level: LogLevel;
  action: string;
  payment_id?: string;
  order_id?: string;
  request_id?: string;
  details: Record<string, unknown>;
  error?: string;
  stack?: string;
  duration_ms?: number;
  actor_ip?: string;
  http_method?: string;
  http_path?: string;
  http_status?: number;
}
