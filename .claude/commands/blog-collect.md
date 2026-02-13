---
description: 블로그 워크플로우 Step 1 + 2 - 웹 리서치로 소스 수집 후 인사이트 추출까지 자동 실행
allowed-tools: Bash(python3:*), Task
---

## Task

블로그 워크플로우를 시작한다. 웹 리서치 소스 수집(Step 1)과 인사이트 추출(Step 2)을 자동으로 체이닝하여 실행한다.

### Step 1: 실행 초기화 + 웹 리서치 소스 수집

1. 실행 디렉토리 초기화:
   ```bash
   python3 blog/scripts/init_run.py
   ```

2. 출력된 JSON에서 `run_path` 확인

3. `web-source-collector` 서브에이전트를 Task 도구로 호출하여 웹 리서치 수행:
   ```
   Task(subagent_type="web-source-collector", prompt="run_dir: {run_path}")
   ```
   이 에이전트가 간판 디자인, LED 사이니지, 옥외 광고 등 관련 전문 자료를 웹에서 검색하고 수집하여 `{run_path}/sources/source-index.yaml`에 저장한다.

4. 상태 업데이트:
   ```bash
   python3 blog/scripts/update_status.py --run-dir {run_path} --phase collect --status completed
   ```

5. 수집 결과 요약을 사용자에게 표시 (수집된 소스 수)

### Step 2: 인사이트 추출 (자동 이어서 실행)

6. 상태 업데이트:
   ```bash
   python3 blog/scripts/update_status.py --run-dir {run_path} --phase insight --status in_progress
   ```

7. `insight-extractor` 서브에이전트를 Task 도구로 호출:
   ```
   Task(subagent_type="insight-extractor", prompt="run_dir: {run_path}")
   ```

8. 서브에이전트 완료 후 상태 업데이트:
   ```bash
   python3 blog/scripts/update_status.py --run-dir {run_path} --phase insight --status completed
   ```

9. 결과 요약:
   - 추출된 인사이트 수
   - 다음 단계 안내: **`/blog-review-insights` 를 실행하여 인사이트를 검토하고 블로그 주제를 선택하세요.**
