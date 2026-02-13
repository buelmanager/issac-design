# Homepage Features Bento Grid

Phase 3: 기능 벤토 그리드 구현

## 목표
EnPeak의 5가지 핵심 기능을 벤토 그리드 레이아웃으로 쇼케이스한다.

## 작업 내용

### 1. FeaturesBento.tsx
- 섹션 타이틀: "Everything You Need to Speak English Confidently"
- CSS Grid: 4열(데스크탑) -> 2열(태블릿) -> 1열(모바일)
- 스크롤 트리거 fade-in (useScrollAnimation)
- 카드별 stagger delay (100ms 간격)

### 2. 카드 5개 (homepage-data.ts의 FEATURES)
| 카드 | span | 그라데이션 |
|------|------|-----------|
| AI 자유 대화 | 2열 | blue -> cyan |
| 단어 카드 | 1열 | emerald |
| 오늘의 표현 | 1열 | amber |
| 롤플레이 시나리오 | 2열 | indigo -> violet |
| 문법 피드백 | 전체 폭 | rose |

### 3. BentoCard 완성
- 인라인 SVG 아이콘
- 제목 (EN + KO)
- 설명 (EN + KO)
- 호버: scale(1.02) + shadow-xl
- 링크: NEXT_PUBLIC_APP_URL 기반

## 검증
```bash
cd homepage && npx tsc --noEmit
```

## 주의사항
- Phase 2와 병렬 실행 가능
- 작업 범위: `homepage/` 폴더 내에서만
