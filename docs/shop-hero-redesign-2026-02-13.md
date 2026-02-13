# ShopHero 종합 리디자인 계획 v1

> 작성일: 2026-02-13

## Context

현재 ShopHero.astro는 파티클, 기하학 도형, 마우스 추적, 글래스모피즘 배지 등 장식 요소가 과밀하고, 콘텐츠(카피)가 추상적이며 차별화가 부족함. 타겟 고객(신규 창업/오픈 예정자)에게 효과적으로 어필하지 못하고 있음.

**리디자인 방향**: Apple/Tesla 스타일의 타이포그래피 중심 미니멀 디자인으로 전환. 캐러셀은 유지하되 카테고리별이 아닌 브랜드 가치 제안(Value Proposition) 슬라이드로 변경.

**핵심 메시지**: 디자인 품질 + 다양한 제품군
**타겟**: 신규 창업/오픈 예정자 (간판이 처음인 사람들)
**무드**: 프리미엄/럭셔리

---

## 변경 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/components/shop/ShopHero.astro` | HTML/CSS/Script 전면 리라이트 |
| `src/pages/shop/index.astro` | Hero → ShopHero import 변경 (2줄) |

---

## Step 1: shop/index.astro에서 ShopHero 사용 [x]

`src/pages/shop/index.astro`에서:
- `import Hero` → `import ShopHero`
- `<Hero />` → `<ShopHero />`

---

## Step 2: ShopHero.astro HTML 구조 리라이트 [x]

### 제거한 요소
- 기하학 도형 (3개 SVG), 파티클 (12개), 마우스 추적 라이트
- 그리드 패턴, 노이즈 텍스처, 방사형 그라디언트 오버레이
- 글래스모피즘 Stats 배지 → 슬라이드 2 헤드라인에 숫자 통합
- 뱃지 필 (라인 데코레이션) → 심플 eyebrow 텍스트
- 슬라이드별 CTA → 단일 퍼시스턴트 CTA
- "Scroll" 텍스트 → 라인+도트만

### 새 구조: 3개 레이어 (배경 + 콘텐츠 + 스크롤)

---

## Step 3: 슬라이드 콘텐츠 [x]

| Slide | Eyebrow | Headline | Desc | Video |
|-------|---------|----------|------|-------|
| 0 | DESIGN EXCELLENCE | 간판은 / 디자인입니다 | 브랜드의 첫인상을 결정하는 간판, 디자인부터 다릅니다 | hero1.mp4 |
| 1 | FULL LINEUP | LED부터 네온까지 / 모든 간판, 한곳에서 | 채널간판, 네온사인, 현수막, 돌출간판 등 16종 이상 | hero2.mp4 |
| 2 | SINCE 2010 | 15년, 1,000건 / 신뢰가 만든 품질 | 천 건 이상의 시공 경험으로 완성한 최고의 기술력 | hero3.mp4 |
| 3 | ONE-STOP SERVICE | 견적부터 시공까지 / 간편하게, 한번에 | 온라인 견적 문의, 디자인 시안, 제작, 설치까지 원스톱 | hero4.mp4 |

---

## Step 4: CSS 스타일링 [x]

- Headline: `clamp(4rem, 10vw, 7rem)`, weight 800
- 비디오: `brightness(0.4) saturate(1.15)`, 오버레이 강화
- CTA: 아웃라인 pill 버튼 (transparent + border)
- CSS: 기존 ~999줄 → ~400줄 (BEM 네이밍)

---

## Step 5: GSAP 애니메이션 [x]

- 초기 로딩: 배경줌 → Eyebrow → Headline chars → Desc → CTA → 인디케이터 → 오토플레이
- 슬라이드 전환: Out(desc→chars→eyebrow) → 비디오 크로스페이드(1.2s) → In(eyebrow→chars→desc)
- 오토플레이: 5초 간격
- 스크롤 패럴랙스: 배경 yPercent 25, 콘텐츠 opacity 감소

---

## Step 6: 접근성 [x]

- aria-label 인디케이터 버튼
- 스크롤 인디케이터: role="button", tabindex="0", Enter/Space 핸들러
- prefers-reduced-motion: 비디오 숨김, 포스터 표시, 모든 애니메이션 비활성
- 시맨틱 HTML 유지

---

## 검증 [x]

1. `npm run build` — 31 pages, 에러 0 ✓
2. ShopAnimations.astro 충돌 없음 확인 ✓
3. 미사용 변수(heroContent) 제거 완료 ✓

---

## 시니어 리뷰 로그

### v1 리뷰 (2026-02-13)

**평가: B+**

**잘된 점:**
1. HTML 구조 3레이어로 깔끔하게 정리 (기존 7+레이어)
2. CSS 60% 축소, BEM 네이밍 일관성
3. 접근성 완벽 구현 (ARIA, keyboard, reduced-motion)
4. 브랜드 가치 슬라이드 카피가 타겟에 적절
5. 빌드 에러 0

**발견된 이슈 (수정 완료):**
- 미사용 변수 `heroContent` 제거

---

### v2 리뷰 (2026-02-13) — 반복 루프 실행

**평가: B+ → A- (P1/P2 수정 후)**

**발견된 이슈 5건:**

| ID | 우선순위 | 내용 | 상태 |
|-----|---------|------|------|
| P1-A | 🔴 필수 | CSS `will-change` 남용 — `.char` 요소 초기 렌더링 시 불필요한 컴포지트 레이어 | [x] 수정 완료 |
| P1-B | 🔴 필수 | 이벤트 리스너 미정리 — 인디케이터, 마그네틱, hero hover, 스크롤 클릭 | [x] AbortController 적용 |
| P1-C | 🔴 필수 | `video.play().catch(() => {})` 에러 무시 — 디버깅 불가 | [x] console.debug 추가 |
| P2-D | ⚠️ 권장 | 스크롤 인디케이터 `<div role="button">` → `<button>` 시맨틱 개선 | [x] button으로 변경 + focus-visible 스타일 |
| P2-E | ⚠️ 권장 | 포스터 이미지 `alt=""` → 설명 텍스트 추가 | [x] alt 텍스트 추가 |

**v2 수정 후 빌드 검증:** 31 pages, 에러 0 ✓

**향후 개선 후보 (P3):**
- 비디오 에셋 품질/내용이 브랜드 가치 슬라이드와 매칭되는지 실제 확인 필요
- CTA → #products 앵커 타겟 검토 (FeaturedBento와의 관계)
- CSS 필터값(brightness/saturate) 변수화
- 헤드라인 font-weight/letter-spacing 디자인 시스템 변수 사용

---

### v3 리뷰 (2026-02-13) — 최종 검증

**평가: A-**

**검증 결과:**
- P1 3건 + P2 2건 모두 정상 수정 확인 ✓
- AbortController 패턴 적용으로 메모리 누수 해소 ✓
- 변수 호이스팅, 타입 안정성 문제 없음 ✓
- 빌드: 31 pages, 에러 0 ✓

**추가 발견 이슈: 없음**

**최종 판정:** ✅ 승인 — 프로덕션 배포 가능
