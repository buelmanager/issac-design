---
description: 블로그 워크플로우 Step 6 + 7 - 개요 검토 후 글 작성까지 자동 실행
allowed-tools: Read, Write, Bash(python3:*), Task
---

## Task

개요를 검토하여 피드백(Step 6)한 후, 최종 글 작성(Step 7)을 자동으로 실행한다.

### Step 6: 개요 검토 (Human Checkpoint)

1. 최신 run 디렉토리 확인:
   ```bash
   python3 blog/scripts/latest_run.py
   ```

2. `{run_dir}/outlines/` 디렉토리의 모든 `*.yaml` 파일을 읽는다

3. 각 개요를 다음 형식으로 표시한다:

   ```
   ---
   ## [{slug}] {title}

   **훅**: {hook}

   ### 구조
   - 섹션 제목
     - 핵심 포인트 (근거)
     - 소섹션...

   ### 결론
   - 요약: {summary}
   - CTA: {call_to_action}

   ### SEO
   - 제안 제목: {suggested_title}
   - 메타 설명: {meta_description}
   - 키워드: {keywords}

   **예상 길이**: {estimated_length}
   ---
   ```

4. 각 개요에 대해 사용자에게 피드백을 요청한다:
   - **승인** (approved): 이대로 글 작성 진행
   - **수정 요청** (revision_requested): 특정 섹션 수정 필요
   - **삭제** (rejected): 이 주제는 제외

5. 각 개요에 대한 피드백을 `{run_dir}/feedback/{slug}.yaml`에 저장한다:

   ```yaml
   topic: "{slug}"
   reviewed_at: "ISO 8601 timestamp"
   decision: "approved"
   feedback: |
     사용자 피드백 텍스트
   revision_notes:
     - section: "수정 필요한 섹션"
       note: "수정 내용"
   ```

6. 상태 업데이트:
   ```bash
   python3 blog/scripts/update_status.py --run-dir {run_dir} --phase review_outlines --status completed
   ```

### Step 7: 글 작성 (피드백 완료 후 자동 실행)

7. 상태 업데이트:
   ```bash
   python3 blog/scripts/update_status.py --run-dir {run_dir} --phase write --status in_progress
   ```

8. `{run_dir}/feedback/` 에서 `decision: "approved"` 또는 `decision: "revision_requested"` 인 토픽만 대상으로, 각 토픽에 대해 `article-writer` 서브에이전트를 호출 (opus 모델):
   ```
   Task(subagent_type="article-writer", prompt="topic_slug: {slug}, run_dir: {run_dir}", model="opus")
   ```

9. 모든 글 작성 완료 후 상태 업데이트:
   ```bash
   python3 blog/scripts/update_status.py --run-dir {run_dir} --phase write --status completed
   ```

10. 최종 결과:
    - 작성된 글 목록과 파일 경로
    - 각 글의 제목과 예상 길이
    - 글 파일 위치: `src/content/blog/{slug}.md`
