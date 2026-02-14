-- 011: 견적 요청에 가격/견적 관련 컬럼 추가
-- quoted_items: 관리자가 입력한 제품별 견적 금액 (JSONB)
-- quoted_price: 총 견적 금액
-- quoted_at: 견적 발송 시점
-- user_id: 로그인 사용자와 연결 (마이페이지에서 조회용)

ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS quoted_items JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS quoted_price BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quoted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_quote_requests_user ON quote_requests(user_id);

-- RLS: 로그인 사용자가 자기 견적만 조회
CREATE POLICY user_read_own_quotes ON quote_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
