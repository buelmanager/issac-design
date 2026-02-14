-- ============================================================
-- 006_system_logs.sql
-- 시스템 로그 테이블 (결제 시스템 로그 영구 저장)
--
-- PaymentLogger가 fire-and-forget 방식으로 배치 저장.
-- 인메모리 캐시(최근 1000건)와 병행하여 영구 보관.
-- ============================================================

-- ────────────────────────────────────────────────
-- 1. system_logs 테이블
-- ────────────────────────────────────────────────
CREATE TABLE system_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp      TIMESTAMPTZ NOT NULL DEFAULT now(),
  level          TEXT NOT NULL CHECK (level IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')),
  action         TEXT NOT NULL,
  payment_id     UUID REFERENCES payments(id),
  order_id       UUID REFERENCES orders(id),
  request_id     UUID,
  details        JSONB DEFAULT '{}',
  error_message  TEXT,
  error_stack    TEXT,
  duration_ms    INT,
  actor_ip       TEXT,
  http_method    TEXT,
  http_path      TEXT,
  http_status    SMALLINT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ────────────────────────────────────────────────
-- 2. 인덱스 (조회 성능 최적화)
-- ────────────────────────────────────────────────
CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_action ON system_logs(action);
CREATE INDEX idx_system_logs_payment ON system_logs(payment_id);
CREATE INDEX idx_system_logs_order ON system_logs(order_id);
CREATE INDEX idx_system_logs_request ON system_logs(request_id);
CREATE INDEX idx_system_logs_level_timestamp ON system_logs(level, timestamp DESC);

-- ────────────────────────────────────────────────
-- 3. RLS 정책 (관리자만 접근)
-- ────────────────────────────────────────────────
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

-- 관리자 읽기
CREATE POLICY admin_read ON system_logs FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT id FROM admin_users));

-- service_role은 RLS 우회 가능 (로거가 service_role로 삽입)

-- ────────────────────────────────────────────────
-- 4. 오래된 로그 자동 정리 (90일 이상)
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_old_system_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM system_logs
  WHERE timestamp < now() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
