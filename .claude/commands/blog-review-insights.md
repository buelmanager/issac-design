---
description: 블로그 워크플로우 Step 3 + 4 + 5 - 인사이트 검토 후 리서치와 개요 작성까지 자동 실행
allowed-tools: Read, Write, Bash(python3:*), Task
---

## Task

인사이트를 검토하여 블로그 주제를 선택(Step 3)한 후, 리서치(Step 4)와 개요 작성(Step 5)을 자동으로 체이닝하여 실행한다.

### Step 3: 인사이트 검토 (Human Checkpoint)

1. 최신 run 디렉토리 확인:
   ```bash
   python3 blog/scripts/latest_run.py
   ```

2. `{run_dir}/insights/insights.yaml` 파일을 읽는다

3. 각 인사이트를 다음 형식으로 번호와 함께 표시한다:

   ```
   ### [번호] INS-{id}: {title}
   {summary}

   **출처 영상**: {sources 목록}
   **가능한 관점**:
   - {angle 1}
   - {angle 2}
   **태그**: {tags}
   ```

4. 사용자에게 선택을 요청한다:
   - 어떤 인사이트로 블로그 글을 쓸지 번호로 선택
   - 각 선택한 인사이트에 대해 선호하는 angle 지정 가능
   - 추가 메모가 있으면 입력

5. 사용자의 선택을 `{run_dir}/selected/selected.yaml`에 저장한다:

   ```yaml
   selected_at: "ISO 8601 timestamp"
   topics:
     - insight_id: "INS-001"
       slug: "제목-기반-slug"
       title: "선택된 인사이트 제목"
       angle: "사용자가 선택한 관점"
       user_note: "사용자 추가 메모"
   ```

   slug는 제목을 영문 소문자 kebab-case로 변환하여 생성한다.

6. 상태 업데이트 + 토픽 등록:
   ```bash
   python3 blog/scripts/update_status.py --run-dir {run_dir} --phase review_insights --status completed
   python3 blog/scripts/update_status.py --run-dir {run_dir} --add-topic {slug} --topic-title "{title}"
   ```

### Step 4: 리서치 (선택 완료 후 자동 실행)

7. 상태 업데이트:
   ```bash
   python3 blog/scripts/update_status.py --run-dir {run_dir} --phase research --status in_progress
   ```

8. `selected.yaml`의 각 토픽에 대해 `topic-researcher` 서브에이전트를 **병렬** 호출:
   ```
   # 토픽이 여러 개면 하나의 메시지에서 동시에 Task 호출
   Task(subagent_type="topic-researcher", prompt="topic_slug: {slug1}, run_dir: {run_dir}")
   Task(subagent_type="topic-researcher", prompt="topic_slug: {slug2}, run_dir: {run_dir}")
   ```

9. 모든 리서치 완료 후 상태 업데이트:
   ```bash
   python3 blog/scripts/update_status.py --run-dir {run_dir} --phase research --status completed
   ```

### Step 5: 개요 작성 (리서치 완료 후 자동 실행)

10. 상태 업데이트:
    ```bash
    python3 blog/scripts/update_status.py --run-dir {run_dir} --phase outline --status in_progress
    ```

11. 리서치 완료된 각 토픽에 대해 `outline-writer` 서브에이전트를 호출:
    ```
    Task(subagent_type="outline-writer", prompt="topic_slug: {slug}, run_dir: {run_dir}")
    ```

12. 모든 개요 완료 후 상태 업데이트:
    ```bash
    python3 blog/scripts/update_status.py --run-dir {run_dir} --phase outline --status completed
    ```

13. 결과 요약:
    - 리서치 및 개요 작성이 완료된 토픽 수
    - 다음 단계 안내: **`/blog-review-outlines` 를 실행하여 개요를 검토하고 피드백을 주세요.**
