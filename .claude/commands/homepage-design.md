# Homepage Design System Setup

Phase 1: 디자인 시스템 셋업 + 레이아웃 스켈레톤

## 목표
`homepage/` 프로젝트의 디자인 토큰, 공용 컴포넌트, 커스텀 훅, 정적 데이터를 구성한다.

## 작업 내용

### 1. tailwind.config.js 확장
- `hp` 색상 팔레트 (cream, indigo, violet, blue, cyan, emerald, amber, rose, footer)
- `serif` 폰트 패밀리 (Playfair Display)
- 애니메이션 키프레임 (float, fade-in-up, count-up, scroll-hint)

### 2. 공용 컴포넌트 (3개)
- `src/components/AnimatedCounter.tsx` - 카운터 애니메이션
- `src/components/BentoCard.tsx` - 벤토 카드
- `src/components/GradientBlob.tsx` - 장식 블롭

### 3. 커스텀 훅 (2개)
- `src/hooks/useScrollAnimation.ts` - IntersectionObserver 스크롤 트리거
- `src/hooks/useMediaQuery.ts` - 반응형 미디어쿼리

### 4. 정적 데이터
- `src/lib/homepage-data.ts` - STATS, FEATURES, COMMUNITY_CARDS, LEADERBOARD_DATA, TESTIMONIALS, FOOTER_LINKS

### 5. 페이지 스켈레톤
- `src/app/page.tsx` - 섹션 구성 스켈레톤
- `src/app/layout.tsx` - 레이아웃 + Playfair Display 폰트

## 검증
```bash
cd homepage && npx tsc --noEmit
```

## 주의사항
- 작업 범위: `homepage/` 폴더 내에서만
- `frontend/` 변경 금지
