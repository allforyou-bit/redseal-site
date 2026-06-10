# Red Seal Exam Prep - Project Index

## Quick Facts
- Site: https://allforyou-bit.github.io (GitHub Pages, static HTML)
- Repo: https://github.com/allforyou-bit/allforyou-bit.github.io
- Files: 46 HTML, 8 trades, 1,110 Qs, 29 articles
- Stack: Vanilla HTML/CSS/JS, no framework
- Deploy: `cd "C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io" && git add -A && git commit -m "msg" && git push origin master`

## User
- 421A Heavy Equipment Technician apprentice (intermediate level)
- Korean speaker, non-developer
- Prefers Claude to act autonomously without asking permission each time

## Key Paths
- Quiz pages: `{trade}.html` (421a, 310t, 309a, 310s, 308a, 276a, 447a, 313a)
- Salary guides: `{trade-name}-salary-canada.html`
- Career guides: `{trade-name}-career-canada.html` or `how-to-become-{trade}-canada.html`
- Exam tips: `how-to-pass-red-seal-{code}-exam.html`
- Utility: index, exam-guide, study-guide, about, contact, privacy, terms, disclaimer, 404

## Credentials
- AdSense ID: `ca-pub-6709396576574623`
- Search Console tag: `AySEYGsNWhilNyl3EpVTQu6a3p0l6E1ZCe7P0EUN8O8`
- IndexNow key: `c81bf78677cc427dbdd74c107c12d22b`
- Ko-fi: `redsealexamprep`
- Email: `lidbil515@gmail.com`

## Standing Rules
1. Read `docs/progress.md` for full site state, schema status, and feature checklist
2. Read `docs/priorities.md` for current task queue before starting new work
3. All commits: descriptive message, no AI attribution
4. For bulk file updates: write Python script → run → delete script in same commit
5. Nav order: Home | 421A | 310T | 309A | 310S | 308A | 276A | 447A | 313A | Exam Guide | Study Guide | About
6. sitemap.xml: update lastmod when modifying pages, currently 45 URLs (no 404.html)
7. JS 문자열 안에 HTML을 넣을 때 닫는 script 태그는 반드시 `<\/script>`로 이스케이프할 것 (브라우저는 문자열 안이라도 `</script>`에서 스크립트를 강제 종료함). 팝업/Study Sheet 생성 시 필수 검증 — 수정 후 `python verify_quiz.py <trade>`로 실제 브라우저 검증.
8. 같은 스크립트 블록에서 기존 함수를 감쌀 때 `function 같은이름(){}` 재선언 금지 (호이스팅 때문에 무한 재귀 발생) — 반드시 `같은이름=function(){}` 할당식으로.

## Telegram Notification Rules (REDSEAL_BOT_TOKEN)
- Bot: @redsealtest_bot / Chat ID: 7836949810 / Token: secrets.txt
- **모든 메시지 한국어로 작성**
- 파일명, 경로, 커밋 해시, 에러 메시지, 기술 용어(Schema, deploy, commit 등)는 영어 그대로
- 보고 형식: 서론 없이 결과부터 / 이모지 최소화 (✅ ⚠️ 정도) / 체크리스트·표 형식 활용
- secrets.txt 없으면 작업 중단하고 Kay에게 토큰 추가 요청
- **모든 작업(커밋 포함) 완료 후 반드시 `scripts/notify_telegram.py`로 결과를 Telegram에 전송한다. 전송 실패 시 터미널에 에러 로그 출력.**
- CLI: `python scripts/notify_telegram.py "작업명" "file1,file2" "커밋해시" "다음단계"`
- 모듈: `from scripts.notify_telegram import notify` → `notify(task_name, files, commit, next_steps)`

## Monetization Status
- Ko-fi `redsealexamprep`: installed on all content pages ✅
- AdSense: pending approval ⏸
- Amazon Associates: waiting for user tracking ID ⏸
- GA4: waiting for user Measurement ID (G-XXXXXXXXXX) ⏸

## Current Priorities
See `docs/priorities.md`
