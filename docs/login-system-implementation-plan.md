# ISSAC Design 로그인 시스템 구현 계획

> **프로젝트**: issac.design 관리자 로그인 시스템
> **우선순위**: 안정성 > 보안 > 성능 > 편의성
> **스택**: Astro 5 SSR + Supabase Auth + @supabase/ssr + React 19
> **최종 검수**: 시니어 개발자 검수 완료 (2026-02-14)

---

## 진행 상태

| Phase | 내용 | 상태 | 완료일 |
|-------|------|------|--------|
| Phase 0 | 즉시 보안 조치 | `✅ 완료` | 2026-02-14 |
| Phase 1 | 보안 기반 (SSR + 미들웨어 + 쿠키 세션) | `✅ 완료` | 2026-02-14 |
| Phase 2 | 인증 안정성 (AuthContext + 버그 수정) | `✅ 완료` | 2026-02-14 |
| Phase 3 | 보안 강화 (헤더 + 감사 로깅) | `✅ 완료` | 2026-02-14 |

---

## 발견된 취약점 (시니어 개발자 검수)

### CRITICAL-1: 하드코딩된 관리자 비밀번호
- **파일**: `scripts/create-admin.mjs:22`
- **내용**: `PASSWORD = '12344321'`이 소스코드에 하드코딩
- **위험도**: Git 이력에 비밀번호 노출
- **조치**: 환경변수(`ADMIN_INITIAL_PASSWORD`)로 교체

### CRITICAL-2: 서버사이드 미들웨어 부재
- **파일**: `src/middleware.ts` (존재하지 않음)
- **내용**: `/admin/*` 페이지가 서버에서 인증 체크 없이 모든 방문자에게 전달됨
- **위험도**: 미인증 사용자가 관리자 SPA 코드를 모두 다운로드 가능
- **조치**: Astro 미들웨어에서 서버사이드 인증 가드 구현

### CRITICAL-3: localStorage 기반 세션
- **파일**: `src/lib/supabase.ts`
- **내용**: 일반 `createClient` 사용 → 토큰이 localStorage에 저장
- **위험도**: XSS 공격 시 세션 탈취 가능
- **조치**: `@supabase/ssr`의 `createServerClient` + `createBrowserClient`로 쿠키 기반 전환

### CRITICAL-4: `getSession()` 사용
- **파일**: `src/components/admin/contexts/AuthContext.tsx:21`
- **내용**: `getSession()`은 localStorage만 읽고 서버 검증 없음
- **위험도**: 만료/무효화된 토큰으로도 UI 접근 가능
- **조치**: 초기 인증 시 `getUser()` 사용 (서버 검증)

### BUG: PaymentsPage Authorization 헤더 누락
- **파일**: `src/components/admin/pages/PaymentsPage.tsx:273,309,321`
- **내용**: `/api/payment/logs` 호출 시 Authorization 헤더 없음 → 항상 401
- **조치**: Phase 2에서 수정

---

## Phase 0: 즉시 보안 조치

**목표**: 소스코드에 노출된 자격증명 제거

### 0-1. 하드코딩 비밀번호 제거
- `scripts/create-admin.mjs`에서 `PASSWORD` 상수를 환경변수로 교체
- `ADMIN_INITIAL_PASSWORD` 환경변수 미설정 시 에러 + 안내 메시지 출력
- `.env.example`에 해당 변수 추가 (값은 비워둠)

---

## Phase 1: 보안 기반

**목표**: 서버사이드 인증 인프라 구축

### 1-1. Supabase SSR 클라이언트 생성
- `src/lib/supabase-server.ts` 생성
  - `createServerClient()` — Astro Request/Response 쿠키로 세션 관리
  - httpOnly, secure, sameSite=lax, path=/ 쿠키 설정
- `src/lib/supabase-browser.ts` 생성
  - `createBrowserClient()` — 클라이언트 측 인증 (쿠키 기반)
- 기존 `src/lib/supabase.ts`의 `supabase` export는 점진적 교체

### 1-2. Astro 미들웨어 구현
- `src/middleware.ts` 생성
- `sequence()`로 미들웨어 체인:
  1. **authMiddleware**: 모든 요청에서 쿠키 → 세션 파싱, `Astro.locals.user` 설정
  2. **adminGuard**: `/admin/*` 경로 (login 제외)에서 세션 없으면 `/admin/login`으로 리다이렉트
  3. **securityHeaders**: 보안 관련 HTTP 헤더 추가
- `src/env.d.ts` 생성 — `App.Locals` 타입에 `user`, `session` 추가

### 1-3. 관리자 페이지 서버사이드 가드
- `src/pages/admin/[...path].astro` 수정
  - 미들웨어에서 설정한 `Astro.locals.user` 확인
  - 미인증 시 로그인 페이지로 리다이렉트 (React SPA 코드 전송 차단)

---

## Phase 2: 인증 안정성

**목표**: 클라이언트 인증 로직 개선 + 기존 버그 수정

### 2-1. AuthContext 개선
- `supabase.auth.getSession()` → `supabase.auth.getUser()` 교체 (초기 로드 시)
- `onAuthStateChange`는 유지 (실시간 상태 동기화)
- `supabase` import를 `supabase-browser.ts`의 쿠키 기반 클라이언트로 교체
- `session.access_token` getter 추가 (API 호출용)

### 2-2. PaymentsPage Authorization 버그 수정
- 3곳의 `fetch('/api/payment/logs?...')` 호출에 Authorization 헤더 추가
- `useAuth()`에서 session 가져와서 `Bearer ${session.access_token}` 전달

### 2-3. AuthGuard 강화
- 기존 클라이언트 가드 유지 (미들웨어가 1차 방어, 클라이언트가 2차 방어)
- 토큰 만료 감지 시 자동 로그아웃 + 리다이렉트

---

## Phase 3: 보안 강화

**목표**: 보안 헤더, 감사 로깅, Rate Limiting

### 3-1. 보안 HTTP 헤더
미들웨어의 securityHeaders에서 설정:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `/admin/*` 경로: `Cache-Control: no-store, no-cache, must-revalidate`

### 3-2. 로그인 감사 로깅
- PaymentLogger 활용하여 인증 이벤트 로깅:
  - `AUTH_LOGIN_SUCCESS`: 로그인 성공 (user_id, ip, user_agent)
  - `AUTH_LOGIN_FAILED`: 로그인 실패 (email, ip, reason)
  - `AUTH_LOGOUT`: 로그아웃 (user_id)
  - `AUTH_SESSION_EXPIRED`: 세션 만료 (user_id)
  - `AUTH_ADMIN_ACCESS`: 관리자 페이지 접근 (user_id, path)

### 3-3. 로그인 Rate Limiting
- 메모리 기반 IP별 로그인 시도 제한 (5회/분)
- 실패 시 429 Too Many Requests 응답
- 로그인 API 엔드포인트에 적용

---

## 기술 결정 사항

### 쿠키 기반 세션 선택 이유
| 항목 | localStorage | Cookie (httpOnly) |
|------|-------------|-------------------|
| XSS 방어 | ❌ JS로 접근 가능 | ✅ JS 접근 불가 |
| SSR 호환 | ❌ 서버에서 읽기 불가 | ✅ Request 헤더에 포함 |
| CSRF | ✅ 자동 전송 안됨 | ⚠️ SameSite=Lax로 방어 |
| **결론** | | **✅ 쿠키 기반 채택** |

### getUser() vs getSession()
| 메서드 | 서버 검증 | 속도 | 용도 |
|--------|----------|------|------|
| `getSession()` | ❌ | 빠름 | ~~사용 금지~~ |
| `getUser()` | ✅ | 느림 | 초기 인증, 민감한 작업 |
| `onAuthStateChange` | ✅ (이벤트) | 실시간 | 상태 동기화 |

### 미들웨어 인증 흐름
```
Request → authMiddleware (쿠키→세션 파싱)
        → adminGuard (/admin/* 보호)
        → securityHeaders (보안 헤더)
        → Page/API Handler
```

---

## 파일 변경 목록

### 신규 생성
- `src/lib/supabase-server.ts` — SSR 서버 클라이언트
- `src/lib/supabase-browser.ts` — 브라우저 클라이언트 (쿠키 기반)
- `src/middleware.ts` — Astro 미들웨어 (auth + guard + headers)
- `src/env.d.ts` — App.Locals 타입 정의

### 수정
- `scripts/create-admin.mjs` — 하드코딩 비밀번호 → 환경변수
- `src/pages/admin/[...path].astro` — 서버사이드 인증 가드 추가
- `src/components/admin/contexts/AuthContext.tsx` — getUser() + 쿠키 클라이언트
- `src/components/admin/pages/PaymentsPage.tsx` — Authorization 헤더 추가
- `src/lib/payment/auth-guard.ts` — 쿠키 기반 세션 지원 추가
