# Homepage Polish

Phase 5: 애니메이션, 반응형, 접근성, 빌드 검증

## 목표
모든 섹션에 애니메이션을 적용하고, 반응형/접근성을 검증하고, 빌드가 통과하는지 확인한다.

## 작업 내용

### 1. 스크롤 트리거 애니메이션
- 모든 섹션에 useScrollAnimation 적용 확인
- fade-in-up, stagger delay 일관성 검증
- AnimatedCounter 동작 확인

### 2. 반응형 검증
| 브레이크포인트 | 대상 |
|--------------|------|
| 375px | iPhone SE |
| 390px | iPhone 14 |
| 768px | iPad |
| 1024px | iPad Pro / 소형 데스크탑 |
| 1280px | 데스크탑 |

확인 사항:
- 벤토 그리드: 4열 -> 2열 -> 1열
- 네비게이션: 데스크탑 메뉴 -> 햄버거
- 히어로: 텍스트 크기 스케일링
- 캐러셀: 수평 스크롤 동작
- 풋터: 4열 -> 2열

### 3. 접근성
- 모든 아이콘 버튼에 aria-label
- 색상 대비 WCAG AA 이상
- 키보드 네비게이션 (Tab, Enter)
- 스크린 리더 호환 (시맨틱 HTML)

### 4. reduced-motion
- `globals.css`의 `@media (prefers-reduced-motion: reduce)` 확인
- `useScrollAnimation`에서 reduced-motion 시 즉시 visible

### 5. 빌드 검증
```bash
cd homepage
npx tsc --noEmit
npm run build
```

## 주의사항
- 작업 범위: `homepage/` 폴더 내에서만
