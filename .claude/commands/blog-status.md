---
description: 블로그 워크플로우 진행 상태 확인
allowed-tools: Read, Bash(python3:*)
---

## Task

1. 최신 run 디렉토리 확인:
   ```bash
   python3 blog/scripts/latest_run.py
   ```

2. `{run_dir}/run.yaml`을 읽는다

3. 다음 형식의 대시보드를 표시한다:

   ```
   # Blog Workflow Status: {date}

   | Phase | Status |
   |-------|--------|
   | 1. 수집 (collect) | {상태} |
   | 2. 인사이트 (insight) | {상태} |
   | 3. 인사이트 검토 (review_insights) | {상태} |
   | 4. 리서치 (research) | {상태} |
   | 5. 개요 (outline) | {상태} |
   | 6. 개요 검토 (review_outlines) | {상태} |
   | 7. 글 작성 (write) | {상태} |

   ## Topics
   {topics 목록과 각 토픽의 산출물 존재 여부}

   ## Next Action
   {다음 단계의 slash command 안내}
   ```

   Status 표시: pending -> "대기", in_progress -> "진행중", completed -> "완료", skipped -> "건너뜀"

4. 다음에 할 일(Next Action) 판단:
   - collect 완료 + insight 미완료: `/blog-collect` (인사이트 추출부터 재개)
   - insight 완료 + review_insights 미완료: `/blog-review-insights`
   - outline 완료 + review_outlines 미완료: `/blog-review-outlines`
   - write 완료: "워크플로우 완료! 글 파일: {run_dir}/articles/"

5. run이 없으면 `python3 blog/scripts/list_runs.py`로 전체 실행 목록 표시하고, 새로 시작하려면 `/blog-collect` 안내
