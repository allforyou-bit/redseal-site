# P0 — 트레이드 코드 오배정 시정 계획 (2026-07-17 확정, 실행 대기)

> 발견: 주별 데이터 조사 중 W3 전수 검증(STO 공식 Quick Facts Chart Feb 2026 + 개별 트레이드 페이지 + red-seal.ca)으로 확정.
> **사이트 11개 코드 중 4개만 정확. 5개는 다른 직종의 코드, 1개(276A)는 온타리오에 존재하지 않는 코드, 1개(403A 가스)는 온타리오 견습 트레이드가 아님.**
> 검증 상세·출처 = 이 문서 하단 표. 실행은 전용 세션에서 일괄(부분 배포 금지).

## 영향 평가
- 🔴 신뢰: "313A 연습시험" 검색자(냉동공조 기대)가 산업전기 문제를 받음 — 오배정 5개 코드 전부 동일 구조
- 🔴 법무: "Red Seal 403A Gas Fitter"는 이중 허위(403A=목수, 가스는 ON에서 TSSA 자격) — redsealquiz.ca 이름으로는 특히 위험
- 🟢 **주력 상품 421A는 정확** (판매 GO 유지). 310T/309A/310S도 정확(라벨 보강만)

## 확정 시정 매핑 (URL 유지, 콘텐츠 이동)
| URL | 시정 후 콘텐츠 | 현재 위치 |
|---|---|---|
| 306a.html | Plumber (306A, 9,000h) | 447a.html |
| 308a.html | Sheet Metal Worker (308A, 9,000h) | 306a.html |
| 313a.html | Refrigeration & AC (313A, 9,000h) | 308a.html |
| 442a.html | Industrial Electrician (442A, 9,000h) | 313a.html |
| **신규 456a.html** | Welder (456A, 6,000h) | 276a.html |
| **신규 420b.html** | Ironworker – Generalist (420B, 8,000h) | 442a.html |
| 421a/310t/309a/310s | 유지 (라벨: 421A→"Heavy **Duty** Equipment Technician", 310T/309A는 ON명+RS명 병기) | 제자리 |
| 276a.html | 폐기 → meta-refresh+canonical → 456a.html | — |
| 403a.html | 옵션 결정 필요(사장): (a) 403A 진짜 주인 General Carpenter 콘텐츠 신규 (b) 가스 콘텐츠는 코드 없는 URL(/gas-technician-ontario)로 이전+TSSA G1/G2/G3 체계로 재구성+"ON은 Red Seal 가스 미인정" 명시 | — |
| 447a.html | 옵션: (a) 진짜 주인 Instrumentation & Control Technician 신규 (b) 임시 redirect | — |

## 실행 절차 (전용 세션, 1커밋 원칙)
1. 위성 페이지 전수 목록화 (how-to-pass-*, common-mistakes-*, 슬러그에 라벨 박힌 salary/career 페이지들 — 슬러그 교정판 신규 + 구슬러그 meta-refresh/canonical)
2. 콘텐츠 스왑(퀴즈+위성) → 전 페이지 nav/내부링크/counts → sitemap 재작성 → Schema/메타/FAQ JSON-LD(306a "100문항", 421a 구 블록표 잔존분 포함) 일괄 교정
3. 게이트: verify_quiz 전체 + qc_metrics 전체 + 링크 무결성 grep
4. 배포 → Search Console 재색인 요청(사장) → Telegram
- ⚠ GitHub Pages는 서버 리다이렉트 불가 → 이동 슬러그는 meta-refresh+canonical 페이지로
- 문항 은행 자체는 트레이드 **이름** 기준으로 제작돼 있어 내용 이동만으로 정합 (Phase 6/7 검증 유지)

## 사장 결정 필요 (실행 전)
1. 403a.html 처리 옵션 (a)/(b)
2. 447a.html 처리 옵션 (a)/(b)
3. 실행 시점 승인 (콘텐츠 스왑은 검색 순위 일시 변동 가능 — 이르면 이를수록 피해 적음)

## 검증 근거 (W3, 2026-07-17)
| 우리 페이지 | 우리 라벨 | 판정 | 실제 ON 코드 소유자 |
|---|---|---|---|
| 421a | Heavy Equipment Technician | ✅ (이름에 Duty 추가) | 421A = Heavy Duty Equipment Technician, 7,000h |
| 310t | Truck & Transport Mechanic | ✅ (ON명 Truck and Coach Technician 병기) | 310T, 6,720h |
| 309a | Construction Electrician | ✅ (ON명 Electrician–C&M 병기) | 309A, 9,000h |
| 310s | Automotive Service Technician | ✅ | 310S, 7,220h |
| 308a | Refrigeration & AC | ❌ | 308A = Sheet Metal Worker |
| 276a | Welder | ❌ 코드 부존재 | ON Welder = 456A, 6,000h |
| 447a | Plumber | ❌ | 447A = Instrumentation & Control Technician |
| 313a | Industrial Electrician | ❌ | 313A = Refrigeration & AC |
| 442a | Ironworker | ❌ | 442A = Industrial Electrician; Ironworker = 420B/420A |
| 403a | Gas Fitter | ❌ 트레이드 부존재(ON) | 403A = General Carpenter; 가스 = TSSA G1/G2/G3 |
| 306a | Sheet Metal Worker | ❌ | 306A = Plumber |
출처: skilledtradesontario.ca Quick Facts Chart(2026-02) + 개별 trade 페이지, red-seal.ca trades-list. (개별 URL은 W3 보고 원문 참조)
