# Homepage Hero + Navigation

Phase 2: 히어로 섹션 + 상단 네비게이션 구현

## 목표
홈페이지의 첫인상을 결정하는 히어로 섹션과 상단 네비게이션을 구현한다.

## 작업 내용

### 1. HomepageNav.tsx
- 고정 상단 바 (position: fixed, z-50)
- 스크롤 시 배경: transparent -> white/90 backdrop-blur 전환
- 좌: "EnPeak" 로고
- 중: Features / Community / Challenge (스무스 스크롤 앵커)
- 우: "Start Learning" CTA (NEXT_PUBLIC_APP_URL/talk 링크)
- 모바일: 햄버거 메뉴

### 2. HeroSection.tsx
- 100vh 높이, 가운데 정렬
- 배경: GradientBlob 2개 (인디고+바이올렛, 로즈+앰버)
- 헤드라인: "Master English Through Real Conversations" (font-serif)
- 서브헤드 EN: "Practice real English with AI-powered conversations"
- 서브헤드 KO: "AI와 함께하는 영어 회화..."
- CTA 2개: [Start Free - 그라데이션] [Explore Features - 아웃라인]
- 카운터: 5,375+ / 14 / 2,648+ (AnimatedCounter 사용)
- 하단: 스크롤 인디케이터 화살표

### 3. Playfair Display 폰트
- layout.tsx의 `<head>`에서 Google Fonts link 태그로 로드

## 검증
```bash
cd homepage && npx tsc --noEmit && npm run build
```

## 주의사항
- 작업 범위: `homepage/` 폴더 내에서만
- 링크는 `NEXT_PUBLIC_APP_URL` 기반 절대 URL
