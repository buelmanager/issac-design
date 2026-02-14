# ISSAC Design 결제 시스템 설계 명세서

> **작성일**: 2026-02-14
> **대상 시스템**: Astro 5 + Supabase (PostgreSQL) + React + Vercel
> **현재 상태**: 견적 요청 기반 → 결제 시스템 추가

---

## 진행 상태

| Step | 작업 | 상태 |
|------|------|------|
| 1 | DB 마이그레이션 스키마 | ✅ 완료 |
| 2 | TypeScript 타입 정의 | ✅ 완료 |
| 3 | 결제 서비스 레이어 (추상화 + 상태머신 + 로거) | ✅ 완료 |
| 4 | API 엔드포인트 구현 | ✅ 완료 |
| 5 | 관리자 결제 관리 페이지 (+ 로그 대시보드) | ✅ 완료 |
| 6 | 커밋 및 푸시 | ✅ 완료 |

---

## 1. 핵심 설계 원칙 (시니어 개발자 가이드 기반)

### 반드시 지켜야 할 5가지 원칙

| # | 원칙 | 우리 시스템 적용 방법 |
|---|------|---------------------|
| 1 | **멱등성 (Idempotency)** | `idempotency_key` UNIQUE 컬럼 + 동일 요청 시 기존 결과 반환 |
| 2 | **DB가 진실의 근원** | PG 응답이 아닌 Supabase DB의 `payment_status`가 기준 |
| 3 | **Webhook 기반 검증** | Astro SSR 엔드포인트로 PG Webhook 수신 → 서명 검증 → DB 업데이트 |
| 4 | **상태 머신으로 관리** | `PaymentStateMachine` 클래스로 허용된 전이만 실행 |
| 5 | **트랜잭션 + 롤백** | Supabase RPC (DB 함수)로 주문+결제 원자적 처리 |

### 절대 하면 안 되는 것

- ❌ 클라이언트 응답만 믿고 결제 완료 처리
- ❌ Webhook 서명 검증 없이 상태 변경
- ❌ 트랜잭션 없이 주문과 결제 따로 업데이트
- ❌ 금액 검증 없이 성공 처리
- ❌ 카드 정보 서버 저장
- ❌ 로그에 카드번호 기록

---

## 2. 시스템 아키텍처

### 현재 → 변경 후

```
[현재]
고객 → 장바구니 → 견적 요청 (quote_requests) → 관리자 검토

[변경 후]
고객 → 장바구니 → 주문 생성 (orders) → 결제 요청 (payments)
                                              ↓
                                    PG SDK (프론트) → PG 서버
                                              ↓
                                    Webhook → Backend API
                                              ↓
                                    DB 상태 업데이트 (트랜잭션)
                                              ↓
                                    주문 완료 → 고객 알림
```

### 레이어 구조

```
src/
├── lib/
│   └── payment/
│       ├── types.ts              # 결제 관련 타입 정의
│       ├── state-machine.ts      # 결제 상태 머신
│       ├── payment-service.ts    # 결제 비즈니스 로직 (PG 무관)
│       ├── payment-gateway.ts    # PG 추상화 인터페이스
│       ├── adapters/
│       │   └── mock-adapter.ts   # 테스트용 Mock PG 어댑터
│       └── validators.ts        # 금액/서명 검증 유틸
├── pages/
│   └── api/
│       └── payment/
│           ├── create.ts         # POST: 결제 생성
│           ├── confirm.ts        # POST: 결제 확인
│           ├── cancel.ts         # POST: 결제 취소
│           ├── refund.ts         # POST: 환불 요청
│           ├── webhook.ts        # POST: PG Webhook 수신
│           └── status.ts         # GET: 결제 상태 조회
└── components/
    └── admin/
        └── pages/
            └── PaymentsPage.tsx  # 관리자 결제 관리
```

---

## 3. 결제 상태 머신 (State Machine)

### 상태 전이 다이어그램

```
                    ┌──────────┐
                    │   INIT   │  주문 생성 시 초기 상태
                    └────┬─────┘
                         │ create_payment()
                         ▼
                    ┌──────────┐
            ┌───── │ PENDING  │ ─────┐
            │      └────┬─────┘      │
            │           │            │
     timeout/fail    confirm()    cancel()
            │           │            │
            ▼           ▼            ▼
      ┌──────────┐ ┌──────────┐ ┌──────────┐
      │  FAILED  │ │   PAID   │ │ CANCELED │
      └──────────┘ └────┬─────┘ └──────────┘
                        │
                   refund_request()
                        │
                        ▼
                  ┌─────────────┐
                  │REFUND_PENDING│
                  └──────┬──────┘
                         │
                  refund_confirm()
                         │
                         ▼
                   ┌──────────┐
                   │ REFUNDED │
                   └──────────┘
```

### 허용된 상태 전이 규칙

| From | To | 트리거 |
|------|----|--------|
| `INIT` | `PENDING` | 결제 요청 생성 |
| `PENDING` | `PAID` | Webhook 결제 성공 확인 |
| `PENDING` | `FAILED` | Webhook 결제 실패 / Timeout |
| `PENDING` | `CANCELED` | 사용자 취소 |
| `PAID` | `REFUND_PENDING` | 환불 요청 |
| `REFUND_PENDING` | `REFUNDED` | Webhook 환불 확인 |

> **규칙**: 위 표에 없는 전이는 무조건 거부한다. 직접 UPDATE 금지.

---

## 4. DB 스키마 설계

### 4.1 orders 테이블

기존 `quote_requests`에서 확정된 견적 → 주문으로 전환.

```sql
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    TEXT UNIQUE NOT NULL,           -- 'ORD-20260214-XXXX' 형식
  quote_id        UUID REFERENCES quote_requests(id),  -- 견적에서 전환된 경우
  customer_name   TEXT NOT NULL,
  customer_email  TEXT,
  customer_phone  TEXT NOT NULL,
  business_name   TEXT,
  shipping_address JSONB DEFAULT '{}',
  items           JSONB NOT NULL DEFAULT '[]',    -- [{product_id, name, qty, unit_price, options}]
  total_amount    BIGINT NOT NULL,                -- 원 단위 (정수)
  currency        TEXT NOT NULL DEFAULT 'KRW',
  status          TEXT NOT NULL DEFAULT 'pending_payment',
  admin_notes     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

**order.status 값**:
- `pending_payment` → 결제 대기
- `paid` → 결제 완료
- `processing` → 제작 중
- `shipped` → 배송 중
- `delivered` → 배송 완료
- `canceled` → 취소됨

### 4.2 payments 테이블

```sql
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES orders(id),
  idempotency_key TEXT UNIQUE NOT NULL,           -- 멱등성 키
  amount          BIGINT NOT NULL,                -- 결제 금액 (원 단위)
  currency        TEXT NOT NULL DEFAULT 'KRW',
  status          TEXT NOT NULL DEFAULT 'INIT',   -- 상태 머신 값
  pg_provider     TEXT,                           -- 'toss', 'nice', 'stripe' 등
  pg_payment_id   TEXT UNIQUE,                    -- PG사 결제 ID
  pg_response     JSONB DEFAULT '{}',             -- PG 응답 원본 저장
  method          TEXT,                           -- 'card', 'transfer', 'virtual_account'
  failed_reason   TEXT,                           -- 실패 사유
  paid_at         TIMESTAMPTZ,                    -- 결제 완료 시각
  canceled_at     TIMESTAMPTZ,                    -- 취소 시각
  refunded_at     TIMESTAMPTZ,                    -- 환불 완료 시각
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
```

### 4.3 payment_status_logs 테이블 (감사 추적)

```sql
CREATE TABLE payment_status_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id      UUID NOT NULL REFERENCES payments(id),
  from_status     TEXT NOT NULL,
  to_status       TEXT NOT NULL,
  reason          TEXT,                           -- 변경 사유
  actor           TEXT NOT NULL DEFAULT 'system', -- 'system', 'webhook', 'admin', 'user'
  metadata        JSONB DEFAULT '{}',             -- 추가 정보
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

### 4.4 인덱스

```sql
CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_pg_id ON payments(pg_payment_id);
CREATE INDEX idx_payment_logs_payment ON payment_status_logs(payment_id);
```

### 4.5 DB 함수 (트랜잭션 보장)

```sql
-- 결제 상태 전이 함수 (원자적 처리)
CREATE OR REPLACE FUNCTION transition_payment_status(
  p_payment_id UUID,
  p_from_status TEXT,
  p_to_status TEXT,
  p_reason TEXT DEFAULT NULL,
  p_actor TEXT DEFAULT 'system',
  p_metadata JSONB DEFAULT '{}'
) RETURNS BOOLEAN AS $$
DECLARE
  current_status TEXT;
BEGIN
  -- 비관적 잠금으로 동시성 제어
  SELECT status INTO current_status
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF current_status IS NULL THEN
    RAISE EXCEPTION 'Payment not found: %', p_payment_id;
  END IF;

  IF current_status != p_from_status THEN
    RAISE EXCEPTION 'Invalid transition: current=%, expected=%', current_status, p_from_status;
  END IF;

  -- 결제 상태 업데이트
  UPDATE payments
  SET status = p_to_status,
      updated_at = now(),
      paid_at = CASE WHEN p_to_status = 'PAID' THEN now() ELSE paid_at END,
      canceled_at = CASE WHEN p_to_status = 'CANCELED' THEN now() ELSE canceled_at END,
      refunded_at = CASE WHEN p_to_status = 'REFUNDED' THEN now() ELSE refunded_at END
  WHERE id = p_payment_id;

  -- 감사 로그 기록
  INSERT INTO payment_status_logs (payment_id, from_status, to_status, reason, actor, metadata)
  VALUES (p_payment_id, p_from_status, p_to_status, p_reason, p_actor, p_metadata);

  -- 주문 상태 연동
  IF p_to_status = 'PAID' THEN
    UPDATE orders SET status = 'paid', updated_at = now()
    WHERE id = (SELECT order_id FROM payments WHERE id = p_payment_id);
  ELSIF p_to_status = 'CANCELED' THEN
    UPDATE orders SET status = 'canceled', updated_at = now()
    WHERE id = (SELECT order_id FROM payments WHERE id = p_payment_id);
  ELSIF p_to_status = 'REFUNDED' THEN
    UPDATE orders SET status = 'canceled', updated_at = now()
    WHERE id = (SELECT order_id FROM payments WHERE id = p_payment_id);
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

---

## 5. TypeScript 타입 설계

### 5.1 결제 상태 Enum

```typescript
export const PAYMENT_STATUS = {
  INIT: 'INIT',
  PENDING: 'PENDING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  CANCELED: 'CANCELED',
  REFUND_PENDING: 'REFUND_PENDING',
  REFUNDED: 'REFUNDED',
} as const;

export type PaymentStatus = typeof PAYMENT_STATUS[keyof typeof PAYMENT_STATUS];
```

### 5.2 PG 추상화 인터페이스

```typescript
export interface PaymentGateway {
  readonly provider: string;

  createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult>;
  confirmPayment(pgPaymentId: string, amount: number): Promise<ConfirmPaymentResult>;
  cancelPayment(pgPaymentId: string, reason: string): Promise<CancelPaymentResult>;
  refundPayment(pgPaymentId: string, amount: number, reason: string): Promise<RefundPaymentResult>;
  verifyWebhookSignature(payload: string, signature: string): boolean;
}
```

> 이 인터페이스만 구현하면 어떤 PG사든 교체 가능.

### 5.3 주문/결제 타입

```typescript
export interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;    // 원 단위
  options?: Record<string, string>;
}

export interface Order {
  id: string;
  order_number: string;
  quote_id?: string;
  customer_name: string;
  customer_email?: string;
  customer_phone: string;
  business_name?: string;
  shipping_address?: ShippingAddress;
  items: OrderItem[];
  total_amount: number;
  currency: string;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  idempotency_key: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  pg_provider?: string;
  pg_payment_id?: string;
  pg_response?: Record<string, unknown>;
  method?: string;
  failed_reason?: string;
  paid_at?: string;
  canceled_at?: string;
  refunded_at?: string;
  created_at: string;
  updated_at: string;
}
```

---

## 6. API 엔드포인트 설계

모든 엔드포인트는 Astro SSR (`src/pages/api/payment/`) 경로.

### 6.1 결제 생성

```
POST /api/payment/create
```

**요청**: `{ order_id, idempotency_key }`
**처리**:
1. `idempotency_key`로 중복 확인 → 이미 있으면 기존 반환
2. 주문 금액 검증
3. `payments` 레코드 생성 (INIT)
4. PG 결제 세션 생성 (PENDING 전이)
5. PG SDK 초기화 정보 반환

### 6.2 결제 확인 (Webhook)

```
POST /api/payment/webhook
```

**처리**:
1. PG 서명 검증 (`verifyWebhookSignature`)
2. `pg_payment_id`로 결제 조회
3. 금액 일치 검증 (우리 DB vs PG 응답)
4. `transition_payment_status` RPC 호출 (트랜잭션)
5. 200 OK 응답

### 6.3 결제 취소

```
POST /api/payment/cancel
```

**요청**: `{ payment_id, reason }`
**처리**:
1. 상태 검증 (PENDING만 취소 가능)
2. PG 취소 API 호출
3. `transition_payment_status` RPC 호출

### 6.4 환불 요청

```
POST /api/payment/refund
```

**요청**: `{ payment_id, amount?, reason }`
**처리**:
1. 상태 검증 (PAID만 환불 가능)
2. PG 환불 API 호출
3. REFUND_PENDING 전이
4. Webhook으로 최종 확인 후 REFUNDED 전이

### 6.5 결제 상태 조회

```
GET /api/payment/status?order_id=xxx
```

**응답**: `{ payment, order }`

---

## 7. 보안 설계

### 7.1 RLS 정책

```sql
-- orders: 고객은 INSERT만, 관리자는 ALL
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY public_insert ON orders FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY admin_all ON orders FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM admin_users));

-- payments: 서비스 레벨만 접근 (service_role_key)
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_all ON payments FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM admin_users));

-- payment_status_logs: 관리자 읽기 전용
ALTER TABLE payment_status_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON payment_status_logs FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT id FROM admin_users));
```

### 7.2 API 보안

- Webhook 엔드포인트: PG 서명 검증 필수
- 결제 API: `createAdminClient()` 사용 (service_role_key)
- HTTPS 전용 (Vercel 기본 제공)
- 카드 정보 비저장 (PG SDK가 직접 처리)

---

## 8. 장애 대응 설계

### 8.1 PG 응답 지연

```typescript
const PG_TIMEOUT = 5000;      // 5초
const MAX_RETRIES = 3;
const RETRY_BACKOFF = [1000, 2000, 4000]; // exponential backoff
```

### 8.2 Webhook 유실 대응

- 결제 생성 후 30분 이상 PENDING → cron으로 PG에 상태 재조회
- `payment_status_logs`로 모든 변경 추적

### 8.3 동시성 제어

- DB `FOR UPDATE` 비관적 잠금 (transition_payment_status 함수)
- `idempotency_key` UNIQUE 제약 (중복 결제 방지)
- `pg_payment_id` UNIQUE 제약 (중복 확인 방지)

---

## 9. 로그 설계

```typescript
enum LogLevel {
  INFO = 'INFO',       // 결제 시작, 상태 전이
  WARN = 'WARN',       // 재시도, 멱등 키 중복
  ERROR = 'ERROR',     // PG 호출 실패, 검증 실패
  CRITICAL = 'CRITICAL' // 금액 불일치, 서명 위변조
}
```

**금지 항목**: 카드번호, CVV, 비밀번호 절대 로그 금지

---

## 10. 구현 파일 목록

### 신규 생성 파일

| 파일 | 설명 |
|------|------|
| `supabase/migrations/005_payment_schema.sql` | 결제 테이블 + RLS + 트리거 + 함수 |
| `src/lib/payment/types.ts` | 결제 타입 정의 |
| `src/lib/payment/state-machine.ts` | 상태 머신 |
| `src/lib/payment/payment-service.ts` | 결제 비즈니스 로직 |
| `src/lib/payment/payment-gateway.ts` | PG 추상화 인터페이스 |
| `src/lib/payment/adapters/mock-adapter.ts` | Mock PG 어댑터 |
| `src/lib/payment/validators.ts` | 검증 유틸 |
| `src/pages/api/payment/create.ts` | 결제 생성 API |
| `src/pages/api/payment/confirm.ts` | 결제 확인 API |
| `src/pages/api/payment/cancel.ts` | 결제 취소 API |
| `src/pages/api/payment/refund.ts` | 환불 API |
| `src/pages/api/payment/webhook.ts` | Webhook 수신 |
| `src/pages/api/payment/status.ts` | 상태 조회 API |
| `src/components/admin/pages/PaymentsPage.tsx` | 관리자 결제 관리 |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/types/database.ts` | 결제 테이블 타입 추가 |

---

## 11. 향후 PG 연동 시 해야 할 것

PG사가 결정되면 어댑터만 추가하면 된다:

```
src/lib/payment/adapters/
├── mock-adapter.ts        ← 지금 만들 것 (테스트용)
├── toss-adapter.ts        ← 토스페이먼츠 선택 시
├── nice-adapter.ts        ← 나이스페이먼츠 선택 시
└── stripe-adapter.ts      ← Stripe 선택 시
```

어댑터가 `PaymentGateway` 인터페이스만 구현하면 나머지 코드 변경 없이 동작한다.
