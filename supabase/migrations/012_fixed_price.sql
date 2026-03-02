-- Migration: 012_fixed_price.sql
-- 고정가격 상품 지원을 위한 products 테이블 컬럼 추가
-- is_fixed_price: true이면 고정가격 상품 (바로 구매 가능)
-- fixed_price: 원 단위 정수 (예: 150000 = 150,000원), NULL이면 견적 상품

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_fixed_price BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fixed_price     BIGINT  DEFAULT NULL;

COMMENT ON COLUMN products.is_fixed_price IS '고정가격 여부: true이면 바로 구매 가능, false이면 견적 문의';
COMMENT ON COLUMN products.fixed_price IS '고정 판매가 (원 단위 정수). is_fixed_price=true일 때 사용. NULL이면 견적 상품';
