# Phase 7 — 문제 품질 검증 보고서 (QC 부서, 2026-07-12)

기준: Phase 6 감사(`question-audit.md`) 잔여 항목 웹 검증 + 309a/313a 전수 코드 인용 스캔.
**검증만 수행 — 수정은 이 보고서 기반으로 별도 적용.** answer 필드는 0-기반 인덱스, 보기 문자열은 `'A) '` 접두 규약.

## Section 1 — MED 항목 판정 (9건)

### 1.1 309a id:94 (line 930) — CONFIRMED-WRONG (NEC 값)
- 현재: 분기회로 전압강하 "2% (총 5%)… CEC recommends" 프레임.
- 사실: CEC Rule 8-102 = 피더/분기 **3%**, 총 **5%**, **의무규정("shall")**. 2%/권고 프레임은 NEC식.
- 수정: options[1] → 'B) 3% for the branch circuit, with a maximum of 5% total from the supply side of the consumer's service to the point of utilization — CEC Rule 8-102 makes this a mandatory requirement' / explanation·keyConcept에서 2%·"recommends(not mandates)" 제거, 3%/3%/5% 의무로.
- 출처: dakotaprep.com voltage-drop-guide-for-red-seal-exam-cec-2024 · electricalindustry.ca guide-ce-code-section-8

### 1.2 309a id:119 (line 1080) — CONFIRMED-WRONG (NEC 값)
- 현재: 작업공간 900mm(3ft) — NEC 110.26 값.
- 사실: CEC Rule 2-308 = **1 m** (1200A 이상 또는 750V 초과 = 1.5 m, 노출 충전부 헤드룸 2.2 m).
- 수정: options[1] → 'B) A minimum working space of 1 m with secure footing must be maintained about electrical equipment such as panelboards (CEC Rule 2-308); 1.5 m applies to equipment rated 1200 A or more or over 750 V. Top clearance requirements vary by equipment.' / explanation·keyConcept 900mm→1m, 1.5m 티어·2.2m 헤드룸 추가.
- 출처: iaeimagazine.org working-space-about-electrical-equipment · electriciantalk.com cec-2-308 스레드

### 1.3 309a id:126 (line 1122) — CONFIRMED-AMBIGUOUS
- 현재: 계산부하 180A·200A 주차단기, 정답 C(4/0 Cu 230A). 연속부하 미명시라 A(3/0=200A)도 성립.
- 수정: text에 "calculated **continuous** load of 180A" 삽입 (8-104 80% 규칙 ⇒ ≥225A ⇒ 4/0 유일정답) / options[1]에 CEC Rule 8-104(연속부하 ≤80% ⇒ 도체 ≥125%) 인용 / keyConcept: "THWN-2"(NEC 절연형) → "RW90 (75°C termination)", "12AWG=20A, 10AWG=30A"는 Table 2 암페어시티가 아니라 **최대 OCPD 상한(Rule 14-104(2)/Table 13)**으로 재표기.
- 출처: electriciantalk.com rule-14-104-and-table-13 · sparkshift.app cec-rule-14-104

### 1.4 308a id:114 (line 1045) — CONFIRMED-WRONG (증상 조합)
- 현재: 비응축가스 증상을 "high suction, high discharge, low superheat, **low subcooling**"으로 제시.
- 사실: 비응축가스 = 고토출압 + 흡입압 대체로 정상 + **겉보기 과냉각 증가**(측정 응축온도가 P-T 포화온도보다 낮게 읽힘).
- 수정: text → 'A refrigeration system shows higher-than-normal discharge pressure, normal suction pressure, and higher-than-normal apparent subcooling. The measured condensing temperature is several degrees LOWER than the P-T chart saturation temperature for the measured discharge pressure. What does this MOST likely indicate?' / options[1] → 'B) Non-condensable gases (air, nitrogen) in the system — they add partial pressure in the condenser, raising discharge pressure above what the refrigerant temperature accounts for and inflating the apparent subcooling reading' / 오버차지 distractor(D)는 "응축온도가 P-T와 일치"로 차별화 / explanation 첫 문장 교정.
- 출처: hvacknowitall.com non-condensables-in-a-refrigeration-circuit · achrnews.com 142802

### 1.5 308a id:102 (line 973) — CONFIRMED-WRONG (용어만; 정답 유지)
- 수정: text의 "(a drop-in substitute)" → '(a common R-22 retrofit blend — NOT a drop-in: it requires conversion to POE oil)' / explanation에 "R-407C is not a drop-in — mineral oil must be replaced with POE." 한 문장 추가.
- 출처: hvacptcharts.com r-22-vs-r-407c · arkema.com forane407c

### 1.6 313a id:132 (line 715) — CONFIRMED-WRONG (수치 비일관)
- 현재: RTD −40°C 표시인데 측정값 50Ω (50Ω ≈ −127°C, 자기모순).
- 사실: IEC 60751 Pt100: −40°C = **84.27Ω**.
- 수정: text "measures 50 Ω resistance" → 'measures approximately 84 Ω at the RTD terminals at the DCS' / explanation 마지막 문장 → 'Pt100 at 22°C ≈ 108.6 Ω, but at −40°C it is 84.27 Ω (IEC 60751) — the ~84 Ω measured means a partial short in the leads is bypassing ~25 Ω of the element's true resistance, so the DCS computes −40°C.' / answer 유지(1).
- 출처: fluke.com pt100-calculator · sterlingsensors.co.uk pt100-resistance-table

### 1.7 421a id:181 (line 2145) — CONFIRMED-WRONG (PC/LS 혼동, 정답 키 변경)
- 현재: 정답 B가 "PC 펌프는 대기 시 200–300 PSI로 저압 대기, 풀압 유지=보상기 고장" — 이는 로드센싱 설명.
- 사실: 순수 PC 펌프 = 무유량 시 최소 배제용적으로 디스트로크하되 **보상기 설정압(3,500 PSI) 유지가 정상**. 저압 대기(마진압)는 LS 펌프.
- 수정: **answer → 0** / options[0] → 'A) This is normal for a purely pressure-compensated pump — at zero flow demand the pump de-strokes to near-zero displacement but holds the compensator setting pressure, ready for instant response' / options[1] → 'B) The pump should drop to a low standby pressure of 200–300 PSI — full pressure at standby always means a stuck compensator' (LS 동작 = 오답) / explanation → '<strong>PC pump standby: full compensator pressure at near-zero flow is normal.</strong> The compensator strokes the pump to minimum displacement while maintaining the set pressure (deadhead). Energy loss at standby is small because flow is near zero, though standby pressure is high. A LOAD-SENSING pump, by contrast, drops to a low standby (margin) pressure — typically 200–400 PSI — when no function is active. Confusing the two leads to false "compensator failure" diagnoses.' / keyConcept → 'PC pump: standby = compensator setting pressure, ~zero flow (normal). LS pump: standby = margin pressure (200–400 PSI). To test a PC compensator: watch swash-plate de-stroke/case-drain flow at deadhead — continuous full flow over relief = compensator not de-stroking.'
- 출처: eng-tips.com 131086 · panagonsystems.com load-sensing-vs-pressure-compensated · machinerylubrication.com 31666

### 1.8 276a id:71 (line 554) — CONFIRMED-WRONG (C25로는 스프레이 불가)
- 수정: text → 'What is the approximate spray transition current for ER70S-6 wire (0.9 mm / 0.035") with 98% argon / 2% oxygen shielding gas?' / options → ['A) Approximately 80–100 A','B) Approximately 165 A','C) Approximately 230–250 A','D) Spray transfer is possible with any gas above 200 A'], answer:1 / explanation → 'Spray transfer requires an argon-rich gas (at least ~80% Ar). With 98Ar/2O₂, 0.9 mm ER70S-6 transitions from globular to spray at roughly 165 A; with 90Ar/10CO₂ the transition rises to about 200 A. With C25 (75/25) true axial spray cannot be achieved — the high CO₂ content disrupts the arc column.' / keyConcept → 'Spray transfer: ≥80% Ar required. 0.9 mm wire: ~165 A (98/2), ~200 A (90/10). Larger wire = higher transition current. C25 = short-circuit/globular only.'
- 출처: yeswelder.com gmaw-metal-transfer-modes · weldingweb.com 715605

### 1.9 447a id:117 (line 610) — CONFIRMED-WRONG (과도한 단정; 롱스윕 90° 허용)
- 수정: text → 스택 기부 수평전환부 "what fitting arrangement is acceptable…" / options → ['A) A short-pattern (short-radius) 90° elbow is permitted at the base of the stack','B) No 90° fittings of any kind — only two 45° elbows may be used','C) A long-sweep 90° elbow (centreline radius ≥ pipe size) or two 45° elbows may be used — a short-pattern 90° is not permitted for vertical-to-horizontal flow','D) Any fitting is acceptable if the stack serves 3 storeys or less'], answer:2 / explanation·keyConcept: 롱스윕 90° 또는 2×45° 허용, 쇼트패턴 90°는 수평→수직 방향만.
- 출처: BC BCAB #1895 · pressbooks.tru.ca d-1-10-requirements-and-prohibitions-for-dwv-systems

## Section 2 — 확인필요 항목 판정 (7건)

- **306a id:17 (line 385)** PARTIAL: text "the maximum support spacing" → 'the typical maximum support spacing per SMACNA Table 4-1' / explanation: "Table 4-1 permits 4–10 ft depending on duct size, gauge and hanger; 8 ft (2.4 m) is the common specified maximum for mid-size low-pressure rectangular duct." answer 유지. (출처: mepacademy.com sheet-metal-duct-hangers)
- **403a id:48** CORRECT-AS-IS (Manitoba ITS 21-014가 1.8m 확인). 무수정.
- **403a id:49** UNRESOLVED: 25mm 이격 수치 공개 출처 없음 → 검증 가능한 요구로 재작성: 배관은 전기배선과 접촉 금지 + 접지전극으로 사용 금지 중심으로 문항 재구성 (수치 주장 제거).
- **447a id:81** CORRECT-AS-IS (6L 연방 기준선). explanation 끝에 'Ontario (residential Group C) and British Columbia limit new water closets to 4.8 L/flush.' 추가.
- **310t id:143 (line 1225)** CONFIRMED-WRONG (법령명): text "under Canadian Highway Traffic Act" → 'under provincial weight regulations (e.g., Ontario's Highway Traffic Act, harmonized nationally through the federal-provincial MOU on vehicle weights and dimensions)'. 수치(17,000kg) 유지. (출처: comt.ca MOU Summary 2025)
- **276a id:8 (line 488)** CONFIRMED-WRONG (출처 표기): explanation "AWS D1.1 and CSA standards recommend" → 'ANSI Z49.1 (Safety in Welding and Cutting) and OSHA 1910.252(c)(2) specify' + 발동조건(<10,000 ft³/welder, 천장<16ft, 통풍 차단) / keyConcept에 '(source: ANSI Z49.1 / OSHA 1910.252, not AWS D1.1)' 추가.
- **421a id:77 (line 1358)** 문항-보기 정합: options[1] → 'B) Actual output flow (measured with a flow meter) at rated test pressure, and pump shaft speed (RPM) — actual flow is compared with theoretical flow (displacement × RPM) to calculate volumetric efficiency'. answer 유지(1).

## Section 3 — 309a/313a 전수 코드 인용 스캔

### 3.1 🔴 신규 NEC 혼입 (§1의 94·119 외 8건)
1. **313a id:15 (line 466)**: "Rule 26-302, 900mm" → **answer를 2(옵션 C '1.0 m (39 in)')로 변경**, Rule 2-308 인용, explanation에 1.5m 티어.
2. **309a id:95 (line 936)**: 가공 인입 이격 "3m 보행/5.5m 차량"(NEC 230.24(B)) → **CEC 6-112(3): 보행전용 3.5m / 주거 진입로 4m / 상업 진입로 5m / 도로 5.5m**. options[1]·explanation·keyConcept 재작성, keyConcept "Table 52" → Rule 6-112.
3. **309a id:97 (line 948)**: "슬래브 아래 외장케이블 150mm(Table 53)" → 무근거(NEC 300.5식). Table 53: 외장 ≤750V = **450mm**(비차량)/600mm(차량), 기계적 보호 시 150mm 감축 가능. 정답 = 450mm(보호 시 300mm)로 재작성.
4. **309a id:125 (line 1116)**: 옵션 B·explanation의 "슬래브 150mm" → "외장 450mm; 보호 시 150mm 감축"으로. 600mm 경작지·900mm(TECK 600) 표현은 유지.
5. **313a id:7 (line 458)**: "차량 통행 구역 600mm" → Table 53: 비외장 직매 600mm는 **비차량**, 차량 = 900mm. text를 'non-vehicular industrial area'로 수정(answer B 유지).
6. **309a id:129 (line 1140)**: "욕실 **전체** 리셉터클 GFCI (26-712)" → CEC는 **싱크·욕조·샤워 1.5m 이내** 리셉터클 Class A GFCI (26-700(11)/26-704). 옵션 B·인용 재작성.
7. **309a id:96 (line 942)**: AFCI "(26-700) 침실·거실·식당"(NEC 210.12식 방 목록) → CEC 26-724(f): 실질 **전 주거 125V ≤20A 리셉터클**(세면기 1m 이내 등 예외). 옵션 B·인용 재작성.
8. **309a id:59 (line 714)**: "Rule 14-100이 침실 AFCI 요구" → Rule 26-724(f) + 전 주거 리셉터클 범위로 교정.

### 3.2 ⚠️ 인용만 교정 (내용 유지)
- 309a id:29 (line 522): fill 인용 14-304 → **12-910/Tables 8–10**
- 309a id:58 (line 708): "Table D16" → **Table 5A**
- 309a id:98 (line 954): "Table 46"+"28-200" → **Section 42, Rule 42-006, Table 42A** (배수 0.78/0.71/0.63/0.55 확인됨)
- 309a id:135 (line 1176): text "14-010" → **14-104**. "800A 상한"은 UNRESOLVED — 수치 건드리지 말 것
- 309a id:122 (line 1098): "4-022" → **14-104(2)/Table 13**
- 309a id:47 (line 638)·id:92 (line 918): "26-700" → **26-724**
- 309a id:38 (line 580)·id:60 (line 720): "Table 12A/12"(지지 간격 표) → CEC에 해당 표 없음. Rules **12-1010/12-1404** "securely fastened" + 3m 관행으로 표기 교정
- 309a id:64 (line 744): "separately derived system…26-256" → CEC **Section 10** 일반 인용으로 (정확 규칙번호 UNRESOLVED)
- 309a id:50 (line 656): "Rule 2-100" → "CEC Section 2 (General Rules)" 일반 인용
- 309a id:57 (line 702): "Rule 12-100" → "CEC Section 12" 일반 인용
- 309a id:63 (line 738): "THHN" → CEC 타입 **T90 Nylon/RW90**
- 309a id:111 (line 1032): Class I Div 2 "EMT 불가·RMC만" → 313a id:6와 모순. **313a-6 기준(TECK90 or RMC 허용)으로 정렬**
- 313a id:87 (line 542): "14-012" → **14-102** (1200A 수치 정확)
- 313a id:4 (line 455): "14-100" → **14-104(2)/Table 13**

### 3.3 ✅ 이상 없음
309a id:25·26·27·43·73·89·93·99·113 / 313a id:2·3·5·8·10·19·20 등 (보고서 원문 참조)

## Section 4 — 중복 4쌍 대체 (모두 교체 대상 id의 전체 오브젝트 교체)
- **310s id:129** → CVT 벨트식 변속비 원리 문항 (transmission, easy) — 초안 확정
- **310s id:87** → 습식/건식 압축시험 진단 문항 (engine, hard) — 초안 확정
- **310t id:26** → 5th wheel 커플링 확인 절차 문항 (drivetrain, easy) — 초안 확정
- **310t id:63** → EV/하이브리드 고전압 오렌지 케이블·PPE 문항 (electrical, medium) — 초안 확정
(대체 문항 전문은 Phase 7 구현 커밋의 diff가 정본)

## 기타
- ~~secrets.txt 공개 노출~~ → 오탐: .gitignore 등록·미추적·이력 없음 확인 (2026-07-12)
- 403a-49 (25mm), 309a-135 (800A 상한), 309a-64·50·57 정확 규칙번호 = **UNRESOLVED 보류 목록** — CEC/B149.1 원문 확보 시 재검
