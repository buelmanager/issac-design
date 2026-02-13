# Homepage Community Sections

Phase 4: 커뮤니티/챌린지/리더보드/추천평/풋터 구현

## 목표
홈페이지 하단의 5개 섹션을 구현한다.

## 작업 내용

### 1. CommunityHighlights.tsx
- 타이틀: "Learn Together"
- 3열 카드: Q&A 포럼 | 스터디 그룹 | 커뮤니티 시나리오
- Q&A, 스터디 그룹: "Coming Soon" 뱃지 (hp-amber)
- 커뮤니티 시나리오: NEXT_PUBLIC_APP_URL/create 링크

### 2. DailyChallengePreview.tsx
- 그라데이션 배경 (indigo -> violet -> rose)
- 오늘의 표현: "Break the ice"
- 의미 블러 처리 (hover로 reveal)
- CTA: NEXT_PUBLIC_APP_URL/talk?mode=expression

### 3. LeaderboardTeaser.tsx
- "Top Learners This Week" 타이틀
- 플레이스홀더 데이터 5명 (LEADERBOARD_DATA)
- 순위, 아바타, 이름, 스트릭, 단어 수
- stagger 애니메이션 (translateX)
- "Join the Community" CTA

### 4. TestimonialsCarousel.tsx
- CSS scroll-snap 수평 스크롤
- 5개 정적 추천평 (TESTIMONIALS)
- 인용문 (EN + KO), 이름, 레벨
- scrollbar-hide 클래스

### 5. HomepageFooter.tsx
- 다크 배경 (#111827)
- 4열: Logo | Product | Community | Support
- Copyright 2026 EnPeak
- Coming Soon 링크에는 "Soon" 뱃지

## 검증
```bash
cd homepage && npx tsc --noEmit
```

## 주의사항
- Phase 2, 3과 병렬 실행 가능
- 작업 범위: `homepage/` 폴더 내에서만
