---
name: blog-workflow
description: 웹사이트 수집한 컨텐츠를 기반으로 블로그 글을 생성하는 워크플로우. 사용자가 (1) 블로그 주제 찾기/글 쓰기를 요청하거나, (2) 수집된 웹사이트에서 인사이트를 추출하거나, (3) 블로그 워크플로우를 진행할 때 사용. "블로그 글 쓸 주제 찾아줘", "블로그 글 작성해줘", "인사이트 추출해줘" 등의 요청에 트리거됨.
---

# Blog Workflow

유튜브 컨텐츠 기반 블로그 글 생성 7단계 파이프라인.
3번의 사용자 액션으로 전체 워크플로우가 완료된다.

## 데이터 경로

```
blog/runs/{YYYY-MM-DD}/     # 실행별 디렉토리
├── run.yaml                          # 상태 추적
├── sources/source-index.yaml
├── insights/insights.yaml
├── selected/selected.yaml
├── research/{slug}.yaml
├── outlines/{slug}.yaml
└── feedback/{slug}.yaml

src/content/blog/{slug}.md            # 최종 완성된 글 (Astro Content Collections)
```

소스 데이터: `.reference/contents/` (youtube-collector가 수집)
스크립트: `blog/scripts/`
참조 문서: `blog/references/`

## 사용자 액션 3개

### 1. `/blog-collect` → Step 1 + Step 2 자동 체이닝

1. **초기화**: `scripts/init_run.py` → `scripts/index_sources.py` 순서로 실행
2. **인사이트 추출**: `insight-extractor` 서브에이전트를 Task 도구로 호출
   ```
   Task(subagent_type="insight-extractor", prompt="run_dir: blog/runs/{date}")
   ```
3. 완료 후 사용자에게 안내: `/blog-review-insights` 실행 요청

### 2. `/blog-review-insights` → Step 3 + Step 4 + Step 5 자동 체이닝

사용자가 인사이트를 선택하면:

4. **리서치**: `selected.yaml`에서 토픽별로 `topic-researcher` 서브에이전트 **병렬** 호출
   ```
   Task(subagent_type="topic-researcher", prompt="topic_slug: {slug}, run_dir: blog/runs/{date}")
   ```
5. **개요 작성**: 리서치 완료 후 `outline-writer` 서브에이전트 호출 (토픽별)
   ```
   Task(subagent_type="outline-writer", prompt="topic_slug: {slug}, run_dir: blog/runs/{date}")
   ```
6. 완료 후 사용자에게 안내: `/blog-review-outlines` 실행 요청

### 3. `/blog-review-outlines` → Step 6 + Step 7 자동 체이닝

사용자가 피드백을 주면:

7. **글 작성**: 승인된 토픽별로 `article-writer` 서브에이전트 호출 (opus 모델)
   ```
   Task(subagent_type="article-writer", prompt="topic_slug: {slug}, run_dir: blog/runs/{date}", model="opus")
   ```

## 상태 관리

각 단계 전후로 `blog/scripts/update_status.py`로 `run.yaml` 업데이트:

```bash
python3 blog/scripts/update_status.py --run-dir blog/runs/{date} --phase {phase} --status {in_progress|completed}
```

토픽 등록:
```bash
python3 blog/scripts/update_status.py --run-dir blog/runs/{date} --add-topic {slug} --topic-title "제목"
```

## 세션 복원

새 세션에서 이어가기: `/blog-status`로 상태 확인 후 `run.yaml`의 마지막 완료 phase 다음부터 재개.

## 참고 자료

- **데이터 스키마**: [blog/references/data-schema.md] - 모든 YAML 파일 형식
- **단계별 가이드**: [blog/references/workflow-guide.md] - 상세 실행 지침
- **글 템플릿**: [blog/references/article-template.md] - 최종 글 마크다운 형식
