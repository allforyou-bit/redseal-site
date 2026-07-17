# Current Priorities — updated 2026-07-17 (P0 발생)

> 정본 전략 = OPERATIONS_MONETIZATION_PLAN / 조직 = COMPANY_WEB.md / 절차 = RUNBOOK.md

## 🚨 P0 — 트레이드 코드 오배정 시정 (정본 = P0-trade-code-remediation-plan.md)
11개 중 5개 코드가 타 직종, 276A는 부존재 코드, 403A 가스는 ON 트레이드 아님 (421A 주력상품은 정확).
**사장 결정 2건(403a/447a 처리 옵션) + 실행 승인 후 전용 세션에서 일괄 실행.**

## 🔴 Priority 1 — 사용자 액션 (차단기 2개)
1. **커스텀 도메인 구매** (~US$12/yr, Porkbun/Cloudflare, .ca 추천) → 구매 즉시 Claude에게 알리면 DNS/canonical/sitemap/GA4/Search Console 이전 전부 처리. AdSense가 github.io 서브도메인을 구조적으로 거절하므로 이것 없이는 광고 수익화 불가.
2. ~~AdSense 승인 메일 확인~~ → **확인 완료(7/12): 거절** — 예상대로(github.io 서브도메인 구조적 거절 + Low Value 가능성). 대응 경로 확정: 도메인 이전 → 콘텐츠 보강(얇은 페이지·E-E-A-T) → 6~10주 후 재신청. 광고는 어차피 4층(보너스) — 제품·이메일 우선.

## 🔴 Priority 2 — Claude 즉시 가능 (품질 마감)
1. Phase 6 감사 잔여: MED 9건 검증·수정 (`question-audit.md` §4-2)
2. 실질 중복 4쌍 교체 (310s 115≈129·52≈87, 310t 1≈26·27≈63)
3. 309a·313a 전수 코드 인용 검증 (NEC 혼입 패턴 — 감사 §5-1)

## 🟡 Priority 3 — 수익 엔진 (Week 2~3)
1. ~~리드마그넷 생성~~ ✅ 7/12 (`PRODUCTS\421a\`, `build_pdf_products.py`)
2. MailerLite 가입(사용자 5분) → 임베드 폼 교체 + 웰컴 시퀀스 5통
3. **유료 v1 판매 게이트**: ~~Fix1 정답편향~~ ✅7/12 → ~~Fix2 텔 제거(239건)~~ ✅7/17 → ~~Fix3 공백 57문항(HVAC 20·구조물 20·하이브리드 9·섀시 8, 총 357문항)~~ ✅7/17 → ~~PDF 재생성~~ ✅ → **W3 GO 재판정 진행 중** → GO 시 Ko-fi 등록(사장, 문안=`PRODUCTS\421a\KOFI_LISTING_COPY.md`). 정답 키 추가 교정 2건(id125, id225) 포함. 잔여 소소: 의미 중복 5쌍(69/110·78/183·14/129·98/163·100/166) 교체 — 비차단.
4. 취소선 정가 표시 OK / 🚫 성능 주장 금지("Pass on First Attempt"·합격률·guaranteed — Competition Act, 정본=`legal-compliance-report-20260712.md`)

## 🟢 Priority 4 — 트래픽·권위 (Week 4~12)
1. 얇은 페이지 보강 or noindex (2026 scaled-content 단속 대응)
2. About E-E-A-T 강화 (현직 421A 견습생 스토리)
3. 도구 페이지: 주별 시험비 조회 / 견습시간 계산기 / Challenge 자격 체커
4. YouTube 문제풀이 쇼츠·롱폼 + Reddit 진성 참여
5. 절차·적용형 신규 출제 + MWA 미커버 보강
