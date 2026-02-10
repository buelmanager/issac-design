# Plan 1-2: ShopHero Premium Enhancement

## Context
plan1-1 완료 후 ShopHero가 Landing Hero 대비 애니메이션/인터랙션 품질이 크게 떨어지는 문제를 해결.
Landing Hero는 20+ 애니메이션(split-text, 파티클, 기하학 도형, 마우스 추적, 패럴랙스 등)을 사용하는 반면, ShopHero는 단 2개(title fade, stats stagger)만 적용되어 있었음.

## 리서치 결과
- **트렌디 기업 홈페이지**: 오버사이즈 타이포, GSAP ScrollTrigger, 다크 테마, 패럴랙스, 마우스 효과, 노이즈 텍스처
- **디자인 업계 (인테리어/건축/시각)**: Split-text reveal, 글라스모피즘 스탯, 스크롤 인디케이터, 기하학 장식, 마그네틱 인터랙션
- **간판 업계**: 대부분 기본적인 히어로 → 차별화 기회

## 수정 파일
1. `src/components/shop/ShopHero.astro` — HTML + CSS 전면 개편
2. `src/components/shop/ShopAnimations.astro` — `animateShopHero()` 함수 교체

---

## Step 1: ShopHero HTML 구조 개편 `[x]`
- Noise 텍스처 (SVG feTurbulence)
- 기하학 도형 3개 (원+원, 다이아몬드, 삼각형)
- 파티클 12개
- 마우스 라이트 (cursor tracking radial gradient)
- Badge 좌측 라인 데코
- Title split-text 구조 (캐릭터별 리빌)
- Subtitle 워드 단위 래핑
- CTA data-magnetic + btn-shine
- Stats data-counter-target + 글라스모피즘
- Scroll Indicator (바운싱 dot)

## Step 2: ShopHero CSS 전면 교체 `[x]`
- 100vh 풀스크린
- Noise (mix-blend-mode: overlay, opacity: 0.03)
- 기하학 도형 회전 (@keyframes shop-geo-rotate)
- 파티클 위치 + 크기 variation
- 마우스 라이트 (400px radial-gradient)
- Badge 라인 데코 스타일
- Split-text .char (opacity:0 초기)
- Subtitle .shop-hero-word (opacity:0, translateY:10px 초기)
- Button shine (@keyframes shop-btn-shine)
- Stats 글라스모피즘 (backdrop-filter: blur(12px))
- Scroll indicator (바운싱 애니메이션)
- Responsive (1023px: 도형 숨김/파티클 6개, 719px: 모두 숨김)
- Reduced motion (모든 요소 즉시 표시)

## Step 3: ShopAnimations animateShopHero() 교체 `[x]`
**오케스트레이션 타임라인**:
1. `t=0.0`: 배경 이미지 (scale:1.1→1, opacity:0→0.35)
2. `t=0.2`: Noise 페이드인
3. `t=0.3`: 기하학 도형 stagger (back.out)
4. `t=0.4`: 파티클 stagger + 개별 floating loop
5. `t=0.5`: Badge 슬라이드인
6. `t=0.6`: Split-text 캐릭터별 reveal (stagger:0.03)
7. `t=1.0`: Subtitle 워드별 reveal
8. `t=1.2`: Description 페이드
9. `t=1.4`: CTA 버튼 페이드
10. `t=1.8`: Stats 카드 슬라이드업
11. `t=2.0`: 카운터 애니메이션 (0→target)
12. `t=2.5`: Scroll indicator 페이드

**추가 기능**:
- 마우스 추적 (requestAnimationFrame + lerp 0.08)
- 마그네틱 버튼 (elastic.out 리셋)
- 패럴랙스 스크롤 (ScrollTrigger scrub)
- 콘텐츠 스크롤 페이드 (y:0→-50, opacity:1→0)
- 스크롤 인디케이터 페이드아웃

## Step 4: 반응형 & 퍼포먼스 폴리시 `[x]`
- 태블릿(1023px): 도형 숨김, 파티클 6개, 마우스 라이트 축소
- 모바일(719px): 파티클/도형 전부 숨김, 100vh→auto
- `prefers-reduced-motion`: 모든 요소 즉시 표시, 애니메이션 비활성
- `will-change: transform` 최적화
- `fetchpriority="high"` 이미지

## Step 5: 검증 `[x]`
- `npm run build` → 31 pages, 0 errors
- ShopAnimations.astro → 6.73 kB (gzip: 2.02 kB)

---

## v2 보완 (plan1-2 v2) `[x]`

### 추가 리서치
- 2025-2026 프리미엄 히어로 트렌드: 비디오 배경, 대형 타이포, 비대칭 레이아웃, 절제된 애니메이션
- 간판 업계 대비 차별화 포인트: 비디오 + 오버사이즈 타이포 + 글리치

### v2 변경 사항

**ShopHero.astro**:
- 비디오 배경 교체 (`hero-bg-combined.mp4` + `hero-poster.jpg` 폴백)
- 타이틀 카피: "간판 / 쇼핑몰" → "빛으로 완성하는 / Brand Signage"
- 폰트: `clamp(3rem, 9vw, 6xl)` 오버사이즈
- 서브타이틀: "Hanging Banner" → "Neon Sign"
- Description 제거 (중복)
- CTA 2개 → 1개 ("제품 둘러보기")
- Stats: 4개→3개 (Categories 제거), 우하단 절대 배치 (`x:30→0` 슬라이드인)
- `data-counter-suffix="+"` 명시적 속성
- 글리치 CSS (`[data-glitch]::before/after`, `shop-glitch-1/2` keyframes)
- 스크롤 인디케이터: `role="button"`, `aria-label`, `tabindex="0"`, cursor pointer
- 모바일: `video { display:none }`, `fallback { display:block }`
- Reduced motion: 비디오 숨김, 글리치 숨김

**ShopAnimations.astro**:
- 셀렉터: `[data-hero-image]` → `[data-shop-hero-bg-wrapper]`
- `desc` 애니메이션 제거 (요소 삭제됨)
- 글리치 트리거: `data-text` + `data-glitch` 속성 at t≈1.0
- 카운터: `data-counter-suffix` 속성 사용 (regex 제거)
- Stats: `y:30→0` → `x:30→0` (우측 슬라이드인)
- 타임라인 압축: t=1.2 CTA, t=1.5 Stats, t=1.8 Counters, t=2.2 Scroll
- 스크롤 인디케이터: 클릭 → `.featured-bento` smooth scroll + 키보드 핸들러
- 이벤트 리스너 클린업: `cleanupFns` 배열 + `astro:before-preparation` 해제
- 마우스/마그네틱 리스너: 명명된 함수로 교체하여 클린업 가능

### v2 검증 `[x]`
- `npm run build` → 31 pages, 0 errors
- ShopAnimations.astro → 7.53 kB (gzip: 2.28 kB)
