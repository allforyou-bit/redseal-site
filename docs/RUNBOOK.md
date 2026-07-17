# 웹사업부 운영 RUNBOOK (정본) — 모델 불문 품질 고정 체계

> 제정 2026-07-17 (사장 지시: "나중에 Opus 등 다른 모델로 운영해도 모든 작업이 현재(Fable 5) 수준으로 진행되도록").
> **원칙: 품질은 모델의 지능이 아니라 이 문서의 게이트·스크립트·체크리스트가 보장한다.**
> 어떤 세션이든(모델 무관) 여기 적힌 절차를 그대로 따르면 같은 결과가 나오도록 모든 판단 기준을 명문화한다.
> 조직·전략 = `COMPANY_WEB.md` / 실행 큐 = `priorities.md` / 이 문서 = "어떻게"의 정본.

## 0. 세션 시작 프로토콜 (모든 모델 공통, 순서 고정)
1. `CLAUDE.md` 읽기 (경로·계정·상비 규칙)
2. `docs/priorities.md` 읽기 (현재 큐) → 지시받은 작업이 큐와 충돌하면 사장에게 보고 후 진행
3. 해당 작업의 SOP(아래 §2)를 읽고 **그대로** 수행 — SOP에 없는 새 유형의 작업이면: 작게 시도 → 검증 게이트 통과 확인 → SOP에 추가(문서화가 곧 채용/인수인계)
4. 완료 후: §3 배포 게이트 → Telegram 보고 → 관련 정본 문서 갱신

## 1. 불변 게이트 (스크립트가 판정 — 모델 재량 없음)
| 게이트 | 명령 | 통과 기준 |
|---|---|---|
| 퀴즈 기능 | `python verify_quiz.py [trades]` | ALL PASS (JS에러 0·렌더·클릭·Mock) |
| 문항 품질 | `python scripts/qc_metrics.py [trades]` | ALL PASS (정답분포 ≤35%·텔 ≤5%·접두사·중복 0·구조) |
| 주간 헬스 | `python scripts/weekly_report.py` | exit 0 (핵심 페이지 200·301·sitemap 정합) |
| 제품 PDF | `python scripts/build_pdf_products.py <trade> both` | 생성 후 페이지 수·법적 고지 페이지 육안 1회 확인 |

**퀴즈 HTML을 수정한 세션은 예외 없이 게이트 1·2를 배포 전에 실행한다.** FAIL이면 배포 금지, 원인 수정 후 재실행.
- ⚠️ 한시 예외(2026-07-17 기록): 게이트 2의 tell 항목은 **421a 외 10개 트레이드에서 기왕증으로 FAIL** (Fix 2가 421A만 수행됨). 이 기왕증 FAIL은 신규 결함이 아니므로 배포를 막지 않되, **해당 10개 트레이드 de-tell 배치가 P2 큐에 있으며 완료 시 이 예외 조항을 삭제할 것.** 단 tell 수치가 현재 기록보다 악화되는 변경은 금지.

## 2. 작업별 SOP
### 2-1. 문항 수정/신규 출제 (W2·W3)
- 사실 검증: 모든 수치·코드 인용은 **웹 출처 URL 확보** 후 반영. 확신 없으면 수정하지 말고 UNRESOLVED 보류 목록(`question-audit-phase7-verification.md` 방식)에 기록
- 캐나다 기준만: CEC/B149/NPC/CSA — 미국 NEC/OSHA 수치 혼입 금지 (역대 최다 결함 패턴)
- 보기 4개 병렬 길이·스타일, **정답 보기에 근거 서술 금지**(근거는 explanation으로) — 텔 방지
- JS 문자열 규칙: `'` → `\'` 이스케이프, `</script>` 문자열 금지, 함수 재선언 금지(할당식만)
- **Phase 8 셔플 스니펫(각 트레이드 `questions` 배열 직후) 절대 제거 금지** — 제거 시 정답 B편향 복원됨
- 신규 문항 id는 기존 최대+1부터, topic은 파일 내 기존 값 사용(신규 topic이면 topic-tabs 버튼도 추가)
- ⚠️ **런타임 추출 함정(2026-07-17 실전 사례)**: Playwright `page.evaluate`로 뽑은 questions는 **셔플 적용 후** 순서다. 이 데이터로 소스 HTML의 options를 패치하면 소스의 answer 인덱스와 어긋난다 — options를 교체하면 **반드시 answer도 같은 데이터 기준으로 동기화**할 것. 배열에 객체 추가 시 직전 객체의 **트레일링 콤마** 확인(없으면 페이지 전체 JS 사망).
- 완료 → 게이트 1·2 → sitemap lastmod 갱신 → 배포

### 2-2. 배포 (공통)
```
cd C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io
git add <files> && git commit -m "<설명적 메시지, AI 표기 금지>" && git push origin master
python scripts/notify_telegram.py "<작업명>" "<파일들>" "<커밋해시>" "<다음단계>"
```
- 일회성 벌크 스크립트는 실행 후 같은 커밋에서 삭제. `PRODUCTS\` 폴더(유료 PDF)와 `secrets.txt`는 절대 커밋 금지(.gitignore 확인)
- push 거부 시: `git pull --rebase origin master` 후 재push (GitHub이 CNAME 자동 커밋을 만들 수 있음)

### 2-3. 제품 갱신 (W5)
- 421a.html 문항 변경 시 **반드시 PDF 재생성** (판매본과 사이트 불일치 금지)
- 상품 문안 정본 = `PRODUCTS\421a\KOFI_LISTING_COPY.md` — 수치(문항 수 등) 변경 시 함께 갱신
- **판매 게이트**: `qc-benchmark-421a-*.md` 최신판이 GO일 때만 등록. FIX-FIRST 상태에서 판매 금지

### 2-4. 인프라 (도메인·DNS·Pages)
- 도메인 redsealquiz.ca @ Porkbun(계정 kyeong515) / DNS: GitHub Pages A×4(185.199.108~111.153)+www CNAME
- 인증서 발급 멈춤(>1h) 시: Pages API로 cname 제거→재등록이 표준 해법 (2026-07-16 검증됨)
- 계정 로그인·비밀번호·결제는 사장 전용. 브라우저 위임 작업 시에도 비밀번호/캡차는 사장이 입력

### 2-5. 법무·마케팅 문안 (W5)
- 정본 = `legal-compliance-report-20260712.md`. 금지: "Pass on First Attempt"/합격률 수치/"guaranteed", 씰 그래픽·공식 로고, "Red Seal"의 브랜드적 사용(서술적 사용만)
- 필수 3종 고지(비제휴·무보장·환불)는 사이트 푸터·상품 페이지·PDF에 항상 유지

## 3. 배포 전 최종 체크리스트 (복붙용)
- [ ] 게이트 1: verify_quiz ALL PASS
- [ ] 게이트 2: qc_metrics ALL PASS (문항 변경 시)
- [ ] sitemap lastmod 갱신 (페이지 수정 시)
- [ ] 신규 사실 출처 URL 기록 (docs/ 감사 문서)
- [ ] 421a 변경 시 PDF 재생성
- [ ] 커밋 메시지 설명적·AI 표기 없음
- [ ] Telegram 보고 발송

## 4. 자동화 운영 (총괄본부장 대행 체계)
- **주간(수요일)**: 예약 세션이 `weekly_report.py` 실행 → 이상 시 원인 조사 후 조치·보고, 정상 시 Telegram 확인만
- **월간**: W1 게이트 판정문 작성(`COMPANY_WEB.md` §0 게이트표 기준) → 사장 보고
- 예약 작업의 원칙: 실패해도 사이트를 건드리지 않는 **읽기 전용 진단**이 기본. 수정이 필요하면 진단 보고 후 별도 작업으로

## 5. 에스컬레이션 (사장 결재 필요 — 모델 재량 금지)
가격 변경 / 신규 유료 상품 / 도메인·계정·결제 / 법적 문구 완화 / 무료 문항 축소 / 브랜드명 변경 / 외부 서비스 신규 가입

## 6. 지식 이관 규칙
- 세션에서 새로 배운 것(함정·해법·표준)은 **그 세션이 끝나기 전에** 이 RUNBOOK 또는 해당 SOP에 추가한다. "기억"은 세션과 함께 사라진다 — 문서만 남는다.
- 정본 문서 지도: 전략=`OPERATIONS_MONETIZATION_PLAN_20260711.md` / 조직·게이트=`COMPANY_WEB.md` / 실행 큐=`priorities.md` / 법무=`legal-compliance-report-20260712.md` / 품질 기준=`qc-benchmark-421a-20260712.md` + `question-audit*.md` / 절차=이 문서
