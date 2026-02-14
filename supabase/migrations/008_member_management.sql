-- =============================================
-- 008: Member Management (회원 관리 기능 강화)
-- =============================================
-- profiles 테이블에 상태 관리 및 관리자 메모 컬럼 추가
-- 기존 데이터는 모두 'active' 상태로 자동 설정

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active' NOT NULL
    CHECK (status IN ('active', 'suspended', 'withdrawn')),
  ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT '';

-- 상태별 조회 인덱스
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
