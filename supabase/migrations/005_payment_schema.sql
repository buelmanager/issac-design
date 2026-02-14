-- ============================================================
-- 005_payment_schema.sql
-- 결제 시스템 DB 스키마
-- 원칙: 멱등성, 상태머신, 트랜잭션, 감사추적
-- ============================================================

-- ────────────────────────────────────────────────
-- 1. orders 테이블
-- ────────────────────────────────────────────────
CREATE TABLE orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     TEXT UNIQUE NOT NULL,
  quote_id         UUID REFERENCES quote_requests(id),
  customer_name    TEXT NOT NULL,
  customer_email   TEXT,
  customer_phone   TEXT NOT NULL,
  business_name    TEXT,
  shipping_address JSONB DEFAULT '{}',
  items            JSONB NOT NULL DEFAULT '[]',
  total_amount     BIGINT NOT NULL CHECK (total_amount > 0),
  currency         TEXT NOT NULL DEFAULT 'KRW',
  status           TEXT NOT NULL DEFAULT 'pending_payment'
                   CHECK (status IN (
                     'pending_payment', 'paid', 'processing',
                     'shipped', 'delivered', 'canceled'
                   )),
  admin_notes      TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_orders_number ON orders(order_number);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_quote ON orders(quote_id);

-- ────────────────────────────────────────────────
-- 2. payments 테이블
-- ────────────────────────────────────────────────
CREATE TABLE payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         UUID NOT NULL REFERENCES orders(id),
  idempotency_key  TEXT UNIQUE NOT NULL,
  amount           BIGINT NOT NULL CHECK (amount > 0),
  currency         TEXT NOT NULL DEFAULT 'KRW',
  status           TEXT NOT NULL DEFAULT 'INIT'
                   CHECK (status IN (
                     'INIT', 'PENDING', 'PAID', 'FAILED',
                     'CANCELED', 'REFUND_PENDING', 'REFUNDED'
                   )),
  pg_provider      TEXT,
  pg_payment_id    TEXT UNIQUE,
  pg_response      JSONB DEFAULT '{}',
  method           TEXT,
  failed_reason    TEXT,
  paid_at          TIMESTAMPTZ,
  canceled_at      TIMESTAMPTZ,
  refunded_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_pg_id ON payments(pg_payment_id);
CREATE INDEX idx_payments_idempotency ON payments(idempotency_key);
CREATE INDEX idx_payments_created ON payments(created_at DESC);

-- ────────────────────────────────────────────────
-- 3. payment_status_logs 테이블 (감사 추적)
-- ────────────────────────────────────────────────
CREATE TABLE payment_status_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id       UUID NOT NULL REFERENCES payments(id),
  from_status      TEXT NOT NULL,
  to_status        TEXT NOT NULL,
  reason           TEXT,
  actor            TEXT NOT NULL DEFAULT 'system',
  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payment_logs_payment ON payment_status_logs(payment_id);
CREATE INDEX idx_payment_logs_created ON payment_status_logs(created_at DESC);

-- ────────────────────────────────────────────────
-- 4. RLS 정책
-- ────────────────────────────────────────────────
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_status_logs ENABLE ROW LEVEL SECURITY;

-- orders: 고객은 INSERT만, 관리자는 ALL
CREATE POLICY public_insert ON orders FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY admin_all ON orders FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM admin_users));

-- payments: 관리자만 접근
CREATE POLICY admin_all ON payments FOR ALL TO authenticated
  USING (auth.uid() IN (SELECT id FROM admin_users));

-- payment_status_logs: 관리자 읽기 전용
CREATE POLICY admin_read ON payment_status_logs FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT id FROM admin_users));
CREATE POLICY admin_insert ON payment_status_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT id FROM admin_users));

-- ────────────────────────────────────────────────
-- 5. 주문번호 생성 함수 (동시성 안전)
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  date_part TEXT;
  seq_val INT;
BEGIN
  date_part := to_char(now(), 'YYYYMMDD');

  -- advisory lock: 같은 날짜의 주문번호 생성을 직렬화
  PERFORM pg_advisory_xact_lock(hashtext('order_number_' || date_part));

  SELECT COALESCE(MAX(
    NULLIF(split_part(order_number, '-', 3), '')::INT
  ), 0) + 1 INTO seq_val
  FROM orders
  WHERE order_number LIKE 'ORD-' || date_part || '-%';

  NEW.order_number := 'ORD-' || date_part || '-' || lpad(seq_val::TEXT, 4, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.order_number IS NULL OR NEW.order_number = '')
  EXECUTE FUNCTION generate_order_number();

-- ────────────────────────────────────────────────
-- 6. updated_at 자동 갱신 트리거
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────
-- 7. 결제 상태 전이 함수 (핵심 - 트랜잭션 보장)
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION transition_payment_status(
  p_payment_id  UUID,
  p_from_status TEXT,
  p_to_status   TEXT,
  p_reason      TEXT DEFAULT NULL,
  p_actor       TEXT DEFAULT 'system',
  p_metadata    JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  current_record RECORD;
  is_valid_transition BOOLEAN := FALSE;
BEGIN
  -- 비관적 잠금으로 동시성 제어
  SELECT * INTO current_record
  FROM payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'PAYMENT_NOT_FOUND',
      'message', format('Payment not found: %s', p_payment_id)
    );
  END IF;

  -- 현재 상태 검증
  IF current_record.status != p_from_status THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'STATUS_MISMATCH',
      'message', format('Expected %s but current is %s', p_from_status, current_record.status)
    );
  END IF;

  -- 허용된 상태 전이 검증
  is_valid_transition := CASE
    WHEN p_from_status = 'INIT'           AND p_to_status = 'PENDING'        THEN TRUE
    WHEN p_from_status = 'PENDING'        AND p_to_status = 'PAID'           THEN TRUE
    WHEN p_from_status = 'PENDING'        AND p_to_status = 'FAILED'         THEN TRUE
    WHEN p_from_status = 'PENDING'        AND p_to_status = 'CANCELED'       THEN TRUE
    WHEN p_from_status = 'PAID'           AND p_to_status = 'REFUND_PENDING' THEN TRUE
    WHEN p_from_status = 'REFUND_PENDING' AND p_to_status = 'REFUNDED'       THEN TRUE
    ELSE FALSE
  END;

  IF NOT is_valid_transition THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'INVALID_TRANSITION',
      'message', format('Transition %s → %s is not allowed', p_from_status, p_to_status)
    );
  END IF;

  -- 결제 상태 업데이트
  UPDATE payments
  SET status      = p_to_status,
      paid_at     = CASE WHEN p_to_status = 'PAID'     THEN now() ELSE paid_at END,
      canceled_at = CASE WHEN p_to_status = 'CANCELED'  THEN now() ELSE canceled_at END,
      refunded_at = CASE WHEN p_to_status = 'REFUNDED'  THEN now() ELSE refunded_at END
  WHERE id = p_payment_id;

  -- 감사 로그 기록
  INSERT INTO payment_status_logs (payment_id, from_status, to_status, reason, actor, metadata)
  VALUES (p_payment_id, p_from_status, p_to_status, p_reason, p_actor, p_metadata);

  -- 주문 상태 자동 연동
  IF p_to_status = 'PAID' THEN
    UPDATE orders SET status = 'paid'
    WHERE id = current_record.order_id;
  ELSIF p_to_status IN ('CANCELED', 'REFUNDED') THEN
    UPDATE orders SET status = 'canceled'
    WHERE id = current_record.order_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'payment_id', p_payment_id,
    'from_status', p_from_status,
    'to_status', p_to_status
  );
END;
$$ LANGUAGE plpgsql;
