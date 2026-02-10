# issac.design 쇼핑몰 구현 로드맵

> 작성일: 2026-02-10
> 현재 상태: 프론트엔드 완성 (정적 사이트), 백엔드 없음

---

## 현재 프로젝트 진단

### 완성된 부분 (프론트엔드)

| 영역 | 상태 | 설명 |
|------|------|------|
| 랜딩 페이지 | ✅ 완성 | Hero, 서비스, 포트폴리오, FAQ, 연락처 등 10개 섹션 |
| 쇼핑몰 메인 | ✅ 완성 | 카테고리 쇼케이스, 신상품, 전체 상품 그리드 |
| 상품 상세 페이지 | ✅ 완성 | 17개 상품, 이미지 갤러리, 옵션 선택, 견적 추가 |
| 견적함 (장바구니) | ✅ 완성 | localStorage 기반 추가/삭제/수량 변경 |
| 견적 요청 (체크아웃) | ✅ 완성 | 3단계 폼 (항목확인 → 고객정보 → 확인) |
| 검색 & 필터 | ✅ 완성 | 카테고리 필터, 정렬, 검색 오버레이 |
| 3D 시뮬레이터 | ✅ 완성 | PNG → 3D 변환 (Three.js) |
| 반응형 디자인 | ✅ 완성 | 모바일/태블릿/데스크톱 |
| 애니메이션 | ✅ 완성 | GSAP, Lenis 스무스 스크롤 |

### 미구현 부분 (핵심 문제점)

| 영역 | 상태 | 영향도 |
|------|------|--------|
| 백엔드 API | ❌ 없음 | **치명적** - 견적 요청이 실제로 전송되지 않음 |
| 데이터베이스 | ❌ 없음 | **치명적** - 모든 데이터가 JSON 파일, 주문/견적 저장 불가 |
| 이메일 발송 | ❌ 없음 | **치명적** - 고객/관리자에게 알림 없음 |
| 관리자 패널 | ❌ 없음 | **높음** - 상품/견적/고객 관리 불가 |
| 사용자 인증 | ❌ 없음 | 중간 - 고객 계정, 견적 이력 관리 불가 |
| 결제 시스템 | ❌ 없음 | 중간 - 현재 견적 기반이므로 당장 필수는 아님 |
| 연락처/문의 폼 처리 | ❌ 없음 | **높음** - 문의 폼이 실제로 전송되지 않음 |
| 카카오 채팅 연동 | ⚠️ 미완성 | 낮음 - 위젯만 있고 실제 연동 미완성 |

### 핵심 진단

현재 사이트는 **아름다운 카탈로그/쇼케이스**이지만, **실제 비즈니스가 동작하지 않는** 상태입니다.
고객이 견적 요청을 해도 데이터가 어디에도 저장/전송되지 않고, 관리자가 확인할 방법이 없습니다.

---

## 구현 로드맵

### Phase 1: 견적 요청이 실제로 동작하게 만들기 (최우선)

> **목표**: 고객이 견적을 넣으면 관리자에게 이메일이 가고, 데이터가 저장되는 최소 흐름 완성

**왜 이게 첫 번째인가?**
현재 프론트엔드가 이미 완성되어 있어서 백엔드만 연결하면 바로 비즈니스 운영이 가능합니다. 고객이 견적 요청을 할 수 있어야 매출이 발생합니다.

#### 1-1. 기술 스택 결정

**권장 구성:**
- **Astro SSR 전환**: `astro.config.mjs`에서 `output: 'server'` 또는 `output: 'hybrid'`로 변경
- **런타임**: Node.js (Astro의 Node adapter 사용)
- **데이터베이스**: Supabase (PostgreSQL) 또는 PlanetScale (MySQL)
  - 이유: 무료 티어 있음, 호스팅 불필요, Astro와 쉽게 연동
- **이메일**: Resend 또는 Nodemailer + Gmail SMTP
  - 이유: Resend는 개발자 친화적이고 무료 100통/일
- **배포**: Vercel (이미 설정되어 있음, SSR 지원)

**대안 구성 (서버리스):**
- SSG 유지 + Vercel Serverless Functions (`/api/*`)
- 장점: 기존 구조 최소 변경
- 단점: Astro API Routes보다 분리됨

#### 1-2. 데이터베이스 스키마 설계

```
quotes (견적 요청)
├── id (PK)
├── quote_number (고유 견적번호, 예: QT-20260210-001)
├── customer_name
├── customer_phone
├── customer_email (optional)
├── customer_address (optional)
├── customer_notes (optional)
├── status (pending / contacted / in_progress / completed / cancelled)
├── items (JSON - 견적 항목 배열)
├── created_at
└── updated_at

contacts (문의)
├── id (PK)
├── name
├── email
├── phone
├── company (optional)
├── message
├── status (new / read / replied)
├── created_at
└── updated_at
```

#### 1-3. 구현 항목

1. **Astro SSR 또는 API 엔드포인트 설정**
   - `POST /api/quotes` - 견적 요청 접수
   - `POST /api/contacts` - 문의 접수
   - 서버사이드 폼 검증 (XSS, injection 방지)

2. **견적 요청 프로세스 연결**
   - `quote-checkout.astro`의 3단계 제출 시 → API 호출
   - 성공 시: 견적번호 발급 + 확인 화면 표시
   - 실패 시: 에러 메시지 + 재시도

3. **이메일 알림 시스템**
   - 관리자에게: 새 견적 요청 알림 (항목 요약 포함)
   - 고객에게: 견적 접수 확인 이메일 (견적번호 포함)

4. **연락처/문의 폼 연결**
   - `contact.astro` 폼 제출 → API 호출
   - 관리자 이메일 알림

#### 1-4. 프론트엔드 수정사항

- `quote-checkout.astro`: fetch API 호출 추가 (현재는 localStorage만 비움)
- `contact.astro`: fetch API 호출 추가
- 에러 핸들링 UI (네트워크 오류, 서버 오류)
- 로딩 상태 표시 (스피너, 버튼 비활성화)

---

### Phase 2: 관리자 패널 (Admin Dashboard)

> **목표**: 관리자가 견적, 문의, 상품을 웹에서 관리할 수 있는 대시보드

**왜 두 번째인가?**
Phase 1에서 견적이 들어오기 시작하면, 관리자가 이를 체계적으로 관리할 도구가 필요합니다. 이메일만으로는 규모가 커지면 한계가 있습니다.

#### 2-1. 기술 선택지

**Option A: 별도 Admin 앱 (권장)**
- React + Vite로 별도 SPA
- 같은 DB/API 공유
- 장점: 쇼핑몰과 독립적 개발/배포
- URL: `admin.issac.design` 또는 `issac.design/admin`

**Option B: Astro 내 Admin 라우트**
- `/admin/*` 라우트에 React 컴포넌트로 구성
- 장점: 단일 프로젝트 관리
- 단점: 쇼핑몰 빌드에 영향

**Option C: 헤드리스 CMS 도입**
- Strapi, Payload CMS, Sanity 등
- 장점: Admin UI 구축 불필요, 상품 관리 바로 사용 가능
- 단점: 학습 곡선, 추가 호스팅 비용

#### 2-2. 핵심 기능

1. **대시보드 홈**
   - 오늘의 견적 요청 수, 미처리 건수
   - 최근 문의 목록
   - 월별 요약 차트

2. **견적 관리**
   - 견적 목록 (필터: 상태별, 날짜별)
   - 견적 상세 보기 (고객 정보 + 항목)
   - 상태 변경 (대기 → 연락완료 → 진행중 → 완료)
   - 메모 추가 (내부 관리용)

3. **문의 관리**
   - 문의 목록 + 읽음/안읽음 표시
   - 답변 상태 관리

4. **상품 관리 (JSON → DB 전환)**
   - 상품 CRUD (추가/수정/삭제)
   - 이미지 업로드 (현재 Unsplash URL → 자체 이미지 호스팅)
   - 카테고리 관리
   - 옵션 관리 (사이즈, 소재, 마감, 조명)
   - 노출 순서/추천 상품 설정

5. **관리자 인증**
   - 간단한 로그인 (ID/PW)
   - 세션 또는 JWT 기반
   - 초기에는 단일 관리자 계정으로 충분

#### 2-3. 상품 데이터 마이그레이션

현재 `products.json` (17개 상품)의 데이터를 DB로 이전:

```
products 테이블
├── id, slug, name, category
├── price_range, description, full_description
├── features (JSON), specs (JSON)
├── production_time, included_services (JSON)
├── tags (JSON), options (JSON)
├── production_steps (JSON)
├── popularity, is_new, is_featured
├── related_products (JSON)
└── created_at, updated_at

product_images 테이블
├── id, product_id (FK)
├── url, alt_text, sort_order
├── type (thumbnail / gallery / installation_before / installation_after)
└── created_at
```

---

### Phase 3: 이미지 자산 자체 호스팅

> **목표**: Unsplash 의존을 제거하고 실제 상품 이미지를 사용

**왜 세 번째인가?**
현재 모든 상품 이미지가 Unsplash의 스톡 사진입니다. 실제 쇼핑몰로 운영하려면 자체 상품 사진이 필수입니다.

#### 3-1. 구현 항목

1. **이미지 스토리지 설정**
   - Cloudflare R2 또는 AWS S3 + CloudFront
   - Supabase Storage (DB와 같은 서비스 사용 시)
   - Vercel Blob Storage

2. **이미지 최적화 파이프라인**
   - 업로드 시 자동 리사이즈 (thumbnail: 400px, gallery: 800px, full: 1600px)
   - WebP/AVIF 자동 변환
   - Lazy loading (이미 `loading="lazy"` 적용 중)

3. **실제 상품 사진 촬영/수집**
   - 각 상품별 최소 4-6장
   - 시공 전/후 사진 (installationGallery)
   - 카테고리 대표 이미지

4. **비디오 자산 정리**
   - 현재 4개의 hero 영상 (28MB) → 실제 시공 영상으로 교체 가능
   - 영상 압축 최적화 (현재 파일 크기가 큼)

---

### Phase 4: 고객 계정 & 견적 이력

> **목표**: 고객이 회원가입 후 자신의 견적 요청 이력을 관리

**왜 네 번째인가?**
Phase 1-3으로 기본 운영이 가능한 상태에서, 재방문 고객의 편의성을 높이기 위함입니다.

#### 4-1. 인증 시스템

**권장: 소셜 로그인 우선**
- 카카오 로그인 (한국 사용자 대상이므로 최우선)
- 네이버 로그인
- 이메일/비밀번호 (선택)

**구현 방법:**
- Supabase Auth (DB로 Supabase 사용 시 자연스럽게 연동)
- 또는 NextAuth (Auth.js) 패턴 참고

#### 4-2. 고객 기능

1. **마이 페이지**
   - 견적 요청 이력 조회
   - 견적 상태 확인 (대기 → 진행중 → 완료)
   - 연락처 정보 관리

2. **견적 재요청**
   - 이전 견적을 기반으로 재요청
   - 자주 주문하는 상품 "즐겨찾기"

3. **알림**
   - 견적 상태 변경 시 이메일/SMS 알림
   - 카카오 알림톡 연동 (선택)

#### 4-3. DB 스키마 추가

```
users (고객)
├── id (PK)
├── email
├── name
├── phone
├── company (optional)
├── auth_provider (kakao / naver / email)
├── auth_provider_id
├── created_at
└── updated_at

// quotes 테이블에 user_id (FK, nullable) 추가
```

---

### Phase 5: 결제 시스템 (선택적)

> **목표**: 견적 기반이 아닌, 직접 온라인 결제가 필요한 상품에 대한 결제 연동

**왜 다섯 번째인가?**
간판은 기본적으로 맞춤 제작 상품이라 견적 기반이 자연스럽습니다. 하지만 표준화된 소형 상품(미니 네온사인, X-배너 등)은 직접 결제가 가능할 수 있습니다.

#### 5-1. PG(Payment Gateway) 선택

| PG사 | 특징 | 수수료 |
|------|------|--------|
| **Toss Payments** | 개발자 친화적 API, 쉬운 연동 | 카드 3.3% |
| **NHN KCP** | 안정성, 많은 결제수단 | 카드 3.3% |
| **PortOne (구 아임포트)** | 여러 PG 통합 API | PG사별 상이 |
| **Stripe** | 글로벌 지원, 깔끔한 API | 3.4% + ₩400 |

**권장: Toss Payments 또는 PortOne**
- 국내 사용자 대상이므로 카카오페이, 네이버페이 등 간편결제 지원 필수
- PortOne 사용 시 여러 PG를 하나의 API로 관리 가능

#### 5-2. 결제 가능 상품 분류

```
결제 가능 (표준화 상품)        견적 전용 (맞춤 제작)
├── 미니 네온 사인              ├── 프리미엄 LED 채널 간판
├── X-배너                     ├── 대형 배너
├── 소형 아크릴 간판            ├── 옥상 간판
└── 스탠다드 네온 사인           ├── 돌출 간판
                               └── 커스텀 네온 사인
```

#### 5-3. 구현 항목

1. **결제 플로우**
   - 상품 선택 → 옵션 선택 → 결제 정보 입력 → PG 결제창 → 완료
   - 결제 완료 후 주문 확인 이메일

2. **주문 관리**
   - 주문 테이블 (orders) 추가
   - 주문 상태: 결제완료 → 제작중 → 배송/설치중 → 완료
   - Admin에서 주문 관리 기능

3. **영수증/세금계산서**
   - 현금영수증 자동 발행 연동
   - 세금계산서 발행 (사업자 대상)

---

### Phase 6: 운영 고도화

> **목표**: 사이트 운영을 위한 부가 기능들

#### 6-1. 분석 & 모니터링

- **Google Analytics 4** 또는 **Plausible** (프라이버시 친화적) 연동
- 주요 추적 이벤트:
  - 상품 상세 페이지 조회
  - 견적함에 추가
  - 견적 요청 완료 (전환율)
  - 검색어 분석
- **에러 모니터링**: Sentry 연동 (런타임 에러 추적)

#### 6-2. SEO 강화

- 구조화 데이터(JSON-LD) 추가: Product, LocalBusiness, FAQ 스키마
- 사이트맵 자동 생성 (`@astrojs/sitemap`)
- robots.txt 최적화
- Google Search Console 등록
- 네이버 웹마스터 도구 등록

#### 6-3. 성능 최적화

- 이미지 CDN 활용 (Cloudflare, imgix 등)
- 비디오 스트리밍 (현재 28MB MP4 직접 서빙 → CDN 또는 경량화)
- Core Web Vitals 최적화 (LCP, CLS, INP)
- 서비스 워커 도입 (오프라인 카탈로그 브라우징)

#### 6-4. 카카오 연동 강화

- 카카오톡 채널 정식 연동 (현재 플로팅 위젯만 존재)
- 카카오 알림톡 (견적 상태 변경 알림)
- 카카오 비즈니스 채널 등록

#### 6-5. 테스트 도입

- **단위 테스트**: Vitest (Astro 공식 권장)
  - API 엔드포인트 테스트
  - 유틸리티 함수 테스트
  - quoteCartStore 로직 테스트
- **E2E 테스트**: Playwright
  - 견적 요청 전체 플로우
  - 상품 검색/필터
  - 반응형 레이아웃

---

## 우선순위 요약

```
긴급도/중요도 매트릭스

          높은 중요도                    낮은 중요도
  ┌──────────────────────┬──────────────────────┐
  │                      │                      │
높│  Phase 1: 견적 연동   │  Phase 3: 이미지     │
은│  Phase 2: 관리자패널  │  Phase 6-2: SEO      │
긴│                      │                      │
급│                      │                      │
도├──────────────────────┼──────────────────────┤
  │                      │                      │
낮│  Phase 4: 고객 계정   │  Phase 6-5: 테스트    │
은│  Phase 5: 결제 연동   │  Phase 6-1: 분석     │
긴│                      │  Phase 6-3: 성능     │
급│                      │  Phase 6-4: 카카오   │
도│                      │                      │
  └──────────────────────┴──────────────────────┘
```

### 권장 실행 순서

| 순서 | Phase | 내용 | 선행 조건 |
|------|-------|------|-----------|
| 1 | **Phase 1** | 견적/문의 API + 이메일 | 없음 |
| 2 | **Phase 2** | 관리자 패널 (기본) | Phase 1 |
| 3 | **Phase 3** | 실제 이미지 교체 | Phase 2 (상품 관리 필요) |
| 4 | **Phase 6-2** | SEO 강화 | Phase 1 |
| 5 | **Phase 6-1** | 분석 도구 연동 | Phase 1 |
| 6 | **Phase 4** | 고객 계정 | Phase 1, 2 |
| 7 | **Phase 5** | 결제 연동 | Phase 2, 4 |
| 8 | **Phase 6 나머지** | 운영 고도화 | Phase 1-4 |

---

## Phase 1 상세 실행 계획 (가장 먼저 해야 할 것)

Phase 1을 더 세부적으로 나누면:

### Step 1: 프로젝트 설정 변경
- [ ] `astro.config.mjs`에 `output: 'hybrid'` 설정 (일부 페이지만 SSR)
- [ ] `@astrojs/vercel` 어댑터 설치 및 설정
- [ ] 환경변수 설정 (`.env` 파일: DB URL, 이메일 API 키)

### Step 2: 데이터베이스 연결
- [ ] Supabase 프로젝트 생성
- [ ] `quotes` 테이블 생성
- [ ] `contacts` 테이블 생성
- [ ] Supabase JS 클라이언트 설치 및 설정

### Step 3: API 엔드포인트 구현
- [ ] `src/pages/api/quotes.ts` - POST: 견적 접수
- [ ] `src/pages/api/contacts.ts` - POST: 문의 접수
- [ ] 입력값 검증 (서버사이드)
- [ ] 에러 핸들링

### Step 4: 이메일 발송 연동
- [ ] Resend 계정 생성 및 API 키 발급
- [ ] 관리자 알림 이메일 템플릿 작성
- [ ] 고객 확인 이메일 템플릿 작성
- [ ] 이메일 발송 유틸리티 함수 구현

### Step 5: 프론트엔드 연결
- [ ] `quote-checkout.astro` → API 호출로 변경 (현재 localStorage만 비움)
- [ ] `contact.astro` → API 호출로 변경
- [ ] 로딩 상태, 에러 상태 UI 추가
- [ ] 성공 시 견적번호 표시

### Step 6: 배포 및 테스트
- [ ] Vercel 환경변수 설정
- [ ] 스테이징 배포 후 전체 플로우 테스트
- [ ] 이메일 수신 확인
- [ ] 모바일 테스트

---

## 기술 스택 최종 권장안

```
프론트엔드 (기존 유지)          백엔드 (신규)
├── Astro 5.x (hybrid SSR)    ├── Astro API Routes
├── React (시뮬레이터)          ├── Supabase (PostgreSQL)
├── GSAP + Lenis              ├── Supabase Auth
├── Three.js                  ├── Resend (이메일)
└── TypeScript                └── Vercel (배포+서버리스)

추후 추가
├── Toss Payments / PortOne (결제)
├── Cloudflare R2 (이미지 저장소)
├── Vitest + Playwright (테스트)
├── Sentry (에러 모니터링)
└── GA4 또는 Plausible (분석)
```

---

## 비용 예측 (월간)

| 서비스 | 무료 티어 | 유료 전환 시점 |
|--------|----------|---------------|
| Vercel | 100GB 대역폭, 서버리스 함수 | 트래픽 증가 시 ~$20/월 |
| Supabase | 500MB DB, 50K 요청/월 | 데이터 증가 시 ~$25/월 |
| Resend | 100통/일 | 일 100건 초과 시 ~$20/월 |
| Cloudflare R2 | 10GB 스토리지 | 이미지 대량 시 ~$5/월 |
| 도메인 (issac.design) | - | ~₩20,000/년 |

**초기 운영비**: 도메인 비용만 발생 (무료 티어 활용)
**성장 후**: 월 $50-70 수준

---

## 주의사항

1. **개인정보보호**: 고객 이름, 전화번호, 이메일을 수집하므로 개인정보처리방침 페이지 필수
2. **전자상거래법**: 사업자 정보 표시 의무 (상호, 대표자, 주소, 사업자등록번호, 통신판매업 신고번호)
3. **SSL**: HTTPS 필수 (Vercel 자동 적용)
4. **데이터 백업**: DB 정기 백업 설정 (Supabase 자동 백업 있음)
5. **CORS 설정**: API 엔드포인트 보안 (같은 도메인이면 문제없음)
