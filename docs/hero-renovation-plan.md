# ShopHero 개편 계획서

> [hero-research-analysis.md](./hero-research-analysis.md) 리서치 결과를 기반으로 한 단계별 개편 계획
> 작성일: 2026-02-13

---

## 목차

1. [Phase 1: 즉시 개선 (Quick Wins)](#phase-1-즉시-개선-quick-wins--1~2일)
2. [Phase 2: 성능 최적화](#phase-2-성능-최적화--2~3일)
3. [Phase 3: 전략적 개선](#phase-3-전략적-개선--3~5일)
4. [우선순위 매트릭스](#우선순위-매트릭스)
5. [수정 대상 파일](#수정-대상-파일)
6. [검증 방법](#검증-방법)

---

## Phase 1: 즉시 개선 (Quick Wins) — 1~2일

코드 변경 최소, 전환율 개선 최대화에 초점을 맞춘 빠른 개선 사항들.

### 1A. 슬라이드 카피 전면 교체

**파일**: `src/components/shop/ShopHero.astro` (lines 77-131)

**변경 내용**:

| 슬라이드 | Before (아이브로 / 헤드라인) | After (아이브로 / 헤드라인) |
|---|---|---|
| 0 | DESIGN EXCELLENCE / "간판은 · 디자인입니다" | 프리미엄 간판 전문 / "내 가게에 딱 맞는 · 간판을 찾아보세요" |
| 1 | FULL LINEUP / "LED부터 네온까지 · 모든 간판, 한곳에서" | LED부터 네온까지 / "모든 간판, 한곳에서 · 비교하고 견적받기" |
| 2 | SINCE 2010 / "15년, 1,000건 · 신뢰가 만든 품질" | 15년 · 1,000건+ / "경험이 증명하는 · 신뢰의 품질" |
| 3 | ONE-STOP SERVICE / "견적부터 시공까지 · 간편하게, 한번에" | 원스톱 서비스 / "견적부터 시공까지 · 한번에 해결" |

> `·` 는 줄바꿈 위치 표시

**변경 근거**:
- 아이브로: 영어 → 한국어 전환 (B2B 타겟 고객 이해도 향상)
- 슬라이드 0: "디자인입니다" (브랜드 메시지) → "찾아보세요" (행동 유도형)
- 전체: 고객 혜택 중심 메시지로 전환

**구체적 코드 변경**:

```html
<!-- Slide 0: Before -->
<span class="shop-hero__eyebrow">DESIGN EXCELLENCE</span>
<span data-split-text>간판은</span>
<span data-split-text>디자인입니다</span>
<p>브랜드의 첫인상을 결정하는 간판, 디자인부터 다릅니다</p>

<!-- Slide 0: After -->
<span class="shop-hero__eyebrow">프리미엄 간판 전문</span>
<span data-split-text>내 가게에 딱 맞는</span>
<span data-split-text>간판을 찾아보세요</span>
<p>LED 채널간판, 네온사인, 현수막, 돌출간판 등 16종 이상 제품 라인업</p>
```

```html
<!-- Slide 1: Before -->
<span class="shop-hero__eyebrow">FULL LINEUP</span>
<span data-split-text>LED부터 네온까지</span>
<span data-split-text>모든 간판, 한곳에서</span>
<p>채널간판, 네온사인, 현수막, 돌출간판 등 16종 이상의 제품 라인업</p>

<!-- Slide 1: After -->
<span class="shop-hero__eyebrow">LED부터 네온까지</span>
<span data-split-text>모든 간판, 한곳에서</span>
<span data-split-text>비교하고 견적받기</span>
<p>채널간판, 네온사인, 현수막, 돌출간판 등 원하는 간판을 바로 비교하세요</p>
```

```html
<!-- Slide 2: Before -->
<span class="shop-hero__eyebrow">SINCE 2010</span>
<span data-split-text>15년, 1,000건</span>
<span data-split-text>신뢰가 만든 품질</span>
<p>천 건 이상의 시공 경험으로 완성한 최고의 기술력</p>

<!-- Slide 2: After -->
<span class="shop-hero__eyebrow">15년 · 1,000건+</span>
<span data-split-text>경험이 증명하는</span>
<span data-split-text>신뢰의 품질</span>
<p>천 건 이상의 시공 경험과 1년 무상 A/S로 완성한 기술력</p>
```

```html
<!-- Slide 3: Before -->
<span class="shop-hero__eyebrow">ONE-STOP SERVICE</span>
<span data-split-text>견적부터 시공까지</span>
<span data-split-text>간편하게, 한번에</span>
<p>온라인 견적 문의, 디자인 시안, 제작, 설치까지 원스톱으로</p>

<!-- Slide 3: After -->
<span class="shop-hero__eyebrow">원스톱 서비스</span>
<span data-split-text>견적부터 시공까지</span>
<span data-split-text>한번에 해결</span>
<p>온라인 견적, 디자인 시안, 제작, 설치까지 한곳에서 해결하세요</p>
```

---

### 1B. 듀얼 CTA 추가

**파일**: `src/components/shop/ShopHero.astro` (lines 134-142)

**Before**: 단일 고스트 버튼

```html
<div class="shop-hero__cta" data-shop-hero-cta>
  <a href="#products" class="shop-hero__cta-btn" data-magnetic>
    <span>제품 둘러보기</span>
    <svg>...</svg>
  </a>
</div>
```

**After**: Primary(고대비) + Secondary(아웃라인) 듀얼 CTA

```html
<div class="shop-hero__cta" data-shop-hero-cta>
  <a href="#products" class="shop-hero__cta-btn shop-hero__cta-btn--primary" data-magnetic>
    <span>제품 둘러보기</span>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </a>
  <a href="#quote" class="shop-hero__cta-btn shop-hero__cta-btn--secondary" data-magnetic>
    <span>무료 견적 문의</span>
  </a>
</div>
```

**새 CSS 스타일**:

```css
/* Primary CTA — 고대비 초록 배경 */
.shop-hero__cta-btn--primary {
  color: #fff;
  background: var(--primary-light, #4caf50);
  border: 1px solid var(--primary-light, #4caf50);
}

.shop-hero__cta-btn--primary:hover {
  background: #43a047;
  border-color: #43a047;
}

/* Secondary CTA — 아웃라인 */
.shop-hero__cta-btn--secondary {
  color: var(--text-primary);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.25);
}

.shop-hero__cta-btn--secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.5);
}
```

**참고 패턴**: `src/components/sections/Hero.astro` (lines 149-159) — `button--primary` + `button--outline` 듀얼 CTA 패턴

---

### 1C. 상시 노출 신뢰 배지 추가

**위치**: CTA 아래, 슬라이드 외부 (모든 슬라이드에서 지속 표시)

**HTML 추가** (CTA div 다음):

```html
<!-- Trust Badge — 항상 노출 -->
<div class="shop-hero__trust" data-shop-hero-trust>
  <div class="shop-hero__trust-item">
    <span class="shop-hero__trust-number">15+</span>
    <span class="shop-hero__trust-label">년 경력</span>
  </div>
  <div class="shop-hero__trust-divider"></div>
  <div class="shop-hero__trust-item">
    <span class="shop-hero__trust-number">1,000+</span>
    <span class="shop-hero__trust-label">시공 실적</span>
  </div>
  <div class="shop-hero__trust-divider"></div>
  <div class="shop-hero__trust-item">
    <span class="shop-hero__trust-number">1년</span>
    <span class="shop-hero__trust-label">무상 A/S</span>
  </div>
</div>
```

**CSS**:

```css
.shop-hero__trust {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-lg);
  margin-top: var(--space-xl);
  padding: var(--space-md) var(--space-xl);
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-lg);
  opacity: 0;
}

.shop-hero__trust-item {
  text-align: center;
}

.shop-hero__trust-number {
  display: block;
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--primary-light, #4caf50);
  line-height: 1;
}

.shop-hero__trust-label {
  display: block;
  font-size: var(--font-size-xs);
  font-weight: 400;
  color: var(--text-secondary);
  margin-top: var(--space-xs);
}

.shop-hero__trust-divider {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
}
```

**참고 패턴**: `Hero.astro` (lines 284-295) — `hero-stats` 배지

---

### 1D. 애니메이션 속도 개선

**파일**: `src/components/shop/ShopHero.astro` JS 섹션

**변경 내용**:

| 파라미터 | Before | After | 효과 |
|---|---|---|---|
| 초기 지연 | `delay: 0.5` | `delay: 0.2` | 첫 표시 0.3초 단축 |
| 글자 스태거 amount | `0.6` | `0.35` | 전체 분산 시간 42% 단축 |
| 글자 duration | `0.5s` | `0.4s` | 개별 글자 전환 20% 빨라짐 |
| 전환 슬라이드 지연 | `delay: 0.15` | `delay: 0.1` | 슬라이드 전환 0.05초 빨라짐 |

**결과**: 메시지 완전 표시 ~2초 → **~1초**

**코드 변경 (animateSlideIn 함수)**:

```javascript
// Before
const tl = gsap.timeline({
  delay: isInitial ? 0.5 : 0.15,
  ...
});

tl.to(chars, {
  opacity: 1, y: 0,
  duration: 0.5,
  stagger: { amount: 0.6, from: 'start' },
  ease: 'power4.out',
}, 0.3);

// After
const tl = gsap.timeline({
  delay: isInitial ? 0.2 : 0.1,
  ...
});

tl.to(chars, {
  opacity: 1, y: 0,
  duration: 0.4,
  stagger: { amount: 0.35, from: 'start' },
  ease: 'power4.out',
}, 0.15);
```

---

## Phase 2: 성능 최적화 — 2~3일

### 2A. 영상 수 및 용량 감소

**목표**: 26.8MB → 4~6MB

**방법**:
1. 4개 → 2개 영상으로 축소
   - 유지: `hero2.mp4` (4.6MB), `hero4.mp4` (4.6MB) — 또는 더 적합한 영상으로 교체
   - 삭제: `hero1.mp4`, `hero3.mp4` (각 8.8MB — 가장 큰 파일)
2. ffmpeg 압축 적용:

```bash
# CRF 28, 1280px 스케일, 오디오 제거
ffmpeg -i hero2.mp4 -vcodec libx264 -crf 28 -vf "scale=1280:-2" -an -movflags +faststart hero2-opt.mp4
ffmpeg -i hero4.mp4 -vcodec libx264 -crf 28 -vf "scale=1280:-2" -an -movflags +faststart hero4-opt.mp4
```

**예상 결과**: 각 영상 ~1.5~2MB → 합계 3~4MB

### 2B. 비활성 영상 Lazy Load

**현재**: 모든 영상 `preload="metadata"` (첫 영상만 `preload="auto"`)

**개선**:
- 활성 영상: `preload="auto"` (즉시 재생)
- 비활성 영상: `preload="none"` (완전히 로드하지 않음)
- 다음 슬라이드 전환 **2초 전**에 미리 로드 시작

```javascript
// 다음 영상 프리로드 (전환 2초 전)
function preloadNextVideo(nextIndex) {
  const nextVideo = heroVideos[nextIndex];
  if (nextVideo && nextVideo.preload === 'none') {
    nextVideo.preload = 'auto';
    nextVideo.load();
  }
}

// AUTO_PLAY_INTERVAL에서 2초 전에 호출
setTimeout(() => preloadNextVideo(nextSlideIndex), AUTO_PLAY_INTERVAL - 2000);
```

### 2C. 모바일 Ken Burns 효과

**현재**: 영상 숨김 → 정적 포스터 이미지

**개선**: 포스터 이미지에 CSS Ken Burns 애니메이션 적용

```css
@media (max-width: 719px) {
  .shop-hero__poster {
    display: block;
    animation: kenBurns 20s ease-in-out infinite alternate;
  }

  @keyframes kenBurns {
    0% {
      transform: scale(1) translate(0, 0);
    }
    100% {
      transform: scale(1.08) translate(-2%, -1%);
    }
  }
}
```

- 20초 주기 미세 확대/이동으로 동적 느낌 유지
- 추가 네트워크 비용 없음 (이미 로드된 포스터 활용)

### 2D. WebM 포맷 지원

**현재**: MP4만 지원

**개선**: MP4 + WebM 이중 소스

```html
<video ...>
  <source src="/videos/hero2.webm" type="video/webm" />
  <source src="/videos/hero2.mp4" type="video/mp4" />
</video>
```

**생성 명령**:

```bash
ffmpeg -i hero2-opt.mp4 -c:v libvpx-vp9 -crf 35 -b:v 0 -vf "scale=1280:-2" -an hero2.webm
```

- WebM은 MP4 대비 **30~50% 용량 절감**
- Chrome, Firefox, Edge에서 지원 (Safari는 MP4 폴백)

---

## Phase 3: 전략적 개선 — 3~5일

### 3A. 단일 슬라이드 히어로 전환 검토

현재 4슬라이드 캐러셀을 단일 포커스 히어로로 전환하는 방안.

**제안 레이아웃**:

```
┌────────────────────────────────────────────────┐
│  [영상 배경 — 단일 고품질 영상/이미지]           │
│                                                │
│        프리미엄 간판 전문 · 15년 1,000건+        │  ← 아이브로
│                                                │
│         내 가게에 딱 맞는                        │  ← 헤드라인 L1
│         간판을 찾아보세요                         │  ← 헤드라인 L2 (accent)
│                                                │
│   LED 채널간판, 네온사인, 현수막, 돌출간판 등...    │  ← 서브헤드라인
│                                                │
│      [제품 둘러보기]  [무료 견적 문의]             │  ← 듀얼 CTA
│                                                │
│    15+ 년 경력 │ 1,000+ 실적 │ 1년 A/S           │  ← 신뢰 배지
│                                                │
│   LED채널 │ 네온사인 │ 아크릴 │ 현수막 │ 돌출 │ 옥상│  ← 카테고리 퀵 네비
│                                                │
└────────────────────────────────────────────────┘
```

**장점**:

| 항목 | 캐러셀 (현재) | 단일 히어로 (제안) |
|---|---|---|
| 메시지 노출 | 75% 항상 숨겨짐 | 100% 항상 노출 |
| 코드 줄 수 | ~985줄 | ~300줄 |
| 영상 용량 | 26.8MB (4개) | ~3MB (1개) |
| 유지보수 | 4개 메시지 동기화 | 단일 메시지 관리 |
| 전환 성과 | 캐러셀 < 단일 포커스 (리서치) | 단일 가치 제안 집중 |

**주의**: Phase 1 결과 확인 후 사용자 승인 필요. A/B 테스트 가능 시 데이터 기반 결정 권장.

### 3B. 컴포넌트 분리

**현재**: `ShopHero.astro` 985줄 모놀리식 (HTML + CSS + JS 단일 파일)

**제안 분리 구조**:

```
src/components/shop/
├── ShopHero.astro              # 메인 컴포넌트 (조합)
├── ShopHeroBackground.astro    # 영상/이미지 배경 레이어
├── ShopHeroContent.astro       # 슬라이드 콘텐츠 (또는 단일 콘텐츠)
├── ShopHeroTrustBadge.astro    # 신뢰 배지
└── shop-hero-animations.ts     # GSAP 애니메이션 로직
```

**장점**:
- 각 파일 200~300줄 이내
- 독립적 테스트 및 수정 가능
- 애니메이션 로직 분리로 가독성 향상

---

## 우선순위 매트릭스

| 변경 | 임팩트 | 노력 | 우선순위 | 근거 |
|---|---|---|---|---|
| **1A. 카피 교체** | 매우 높음 | 낮음 | **P0** | 텍스트만 변경, 전환율 직접 영향 |
| **1B. 듀얼 CTA** | 높음 | 낮음 | **P0** | HTML+CSS 추가, CTA 161% 전환율 증가 |
| **1C. 신뢰 배지** | 높음 | 낮음 | **P0** | HTML+CSS 추가, 신뢰 지표 상시 노출 |
| **1D. 애니메이션 속도** | 중간 | 낮음 | **P1** | JS 파라미터 변경, 메시지 전달 속도 2배 |
| **2A. 영상 축소** | 매우 높음 | 중간 | **P1** | ffmpeg 작업, 이탈률 대폭 감소 |
| **2B. Lazy Load** | 높음 | 중간 | **P1** | JS 로직 수정, 초기 로딩 최적화 |
| **2C. 모바일 효과** | 중간 | 낮음 | **P1** | CSS만 추가, 모바일 경험 개선 |
| **2D. WebM 포맷** | 중간 | 중간 | **P1** | ffmpeg + HTML 수정, 용량 30~50% 절감 |
| **3A. 단일 히어로** | 매우 높음 | 높음 | **P2 (전략)** | 전면 리팩토링, 리서치 기반 최적 구조 |
| **3B. 컴포넌트 분리** | 중간 | 높음 | **P2** | 코드 품질 향상, 장기 유지보수성 |

---

## 실행 순서

```
Phase 1 (Quick Wins) ─────────────────────────────
│
├─ 1A. 카피 교체 ────────── P0 (가장 먼저)
├─ 1B. 듀얼 CTA ─────────── P0
├─ 1C. 신뢰 배지 ────────── P0
└─ 1D. 애니메이션 속도 ──── P1
│
▼ 사용자 확인 후
│
Phase 2 (성능 최적화) ────────────────────────────
│
├─ 2A. 영상 축소 ────────── P1
├─ 2B. Lazy Load ────────── P1
├─ 2C. 모바일 Ken Burns ─── P1
└─ 2D. WebM 포맷 ────────── P1
│
▼ 사용자 확인 + Phase 1 결과 데이터 기반 결정
│
Phase 3 (전략적 개선) ────────────────────────────
│
├─ 3A. 단일 히어로 전환 ─── P2 (전략적 결정)
└─ 3B. 컴포넌트 분리 ────── P2
```

---

## 수정 대상 파일

| 파일 | 역할 | Phase |
|---|---|---|
| `src/components/shop/ShopHero.astro` | 핵심 수정 대상 (카피, CTA, 신뢰 배지, 애니메이션) | 1, 2, 3 |
| `src/components/sections/Hero.astro` | 참고 패턴 (듀얼 CTA, 신뢰 배지 구현 레퍼런스) | — |
| `src/styles/global.css` | 디자인 토큰, 버튼 스타일 참조 | 1 |
| `src/pages/shop/index.astro` | 페이지 구조, CTA 링크 대상 (#products, #quote) | 1 |
| `public/videos/` | 영상 파일 최적화/삭제 | 2 |

---

## 검증 방법

### Phase 1 검증

1. `npm run dev`로 로컬 서버 실행 후 ShopHero 시각적 확인
2. 4개 슬라이드 카피 변경 확인 (아이브로 한국어, 헤드라인 행동 유도)
3. 듀얼 CTA 확인 (Primary 초록 배경 + Secondary 아웃라인)
4. CTA 클릭 시 올바른 섹션으로 스크롤 확인 (`#products`, `#quote`)
5. 신뢰 배지가 모든 슬라이드에서 항상 표시되는지 확인
6. 애니메이션 속도: 첫 슬라이드 메시지 ~1초 내 완전 표시 확인
7. 모바일 반응형 확인 (Chrome DevTools 모바일 모드)

### Phase 2 검증

1. Chrome DevTools Network 탭에서 영상 로딩 시간 측정
2. Lighthouse Performance 점수 비교 (변경 전/후)
3. 영상 총 용량 26.8MB → 4~6MB 달성 확인
4. 비활성 영상이 초기 로딩에 포함되지 않는지 확인
5. 모바일에서 Ken Burns 효과 작동 확인
6. WebM 지원 브라우저에서 WebM 로드 확인

### Phase 3 검증

1. 단일 히어로 전환 시 메시지 100% 노출 확인
2. 코드 줄 수 ~300줄 이내 확인
3. 컴포넌트 분리 후 각 파일 독립 동작 확인
4. 전체 기능 리그레션 테스트

---

> 이 계획서는 사용자 검토 후 피드백을 반영하여 수정될 수 있습니다.
> Phase 1부터 순차적으로 구현하며, 각 Phase 완료 후 결과를 확인합니다.
