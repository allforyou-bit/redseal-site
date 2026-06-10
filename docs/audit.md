# Site Audit — Phase 1 (2026-06-10)

- 검사 파일: 72 HTML / 퀴즈 페이지: 11
- 실제 총 질문 수: **1560** / 실제 트레이드 수: **11**
- 발견 문제: 59건 (HIGH 3, MED 43, LOW 13)

## 퀴즈 페이지 현황

| 페이지 | 질문 수 | 토픽 수 | JS문법오류 | 문제 |
|---|---|---|---|---|
| 276a.html | 120 | 7 | 2 | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500'; ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |
| 306a.html | 100 | 6 | 2 | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500'; ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |
| 308a.html | 115 | 5 | 2 | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500'; ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |
| 309a.html | 135 | 6 | 2 | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500'; ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |
| 310s.html | 135 | 5 | 2 | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500'; ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |
| 310t.html | 165 | 5 | 2 | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500'; ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |
| 313a.html | 135 | 6 | 2 | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500'; ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |
| 403a.html | 100 | 6 | 1 | JS 파싱 실패 — SyntaxError: Unexpected identifier '#f0a500' [문자열 내 </script>로 조기종료(브라우저 동일)] |
| 421a.html | 300 | 6 | 2 | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500'; ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |
| 442a.html | 120 | 7 | 2 | Mock Exam 함수 없음; JS 파싱 실패 —   window.open('mailto:lidbil515@gmail.com?subject='+encodeURIComponent('Question Error Rep | SyntaxError: Unexpected identifier '#f0a500' [문자열 내 </script>로 조기종료(브라우저 동일)] |
| 447a.html | 135 | 6 | 2 | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500'; ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |

## 전체 문제 목록

| 파일명 | 문제 유형 | 심각도 | 상세 |
|---|---|---|---|
| 306a.html | NAV | HIGH | 중복: 306a / 누락: 308a |
| 404.html | NAV | HIGH | nav 블록 없음 |
| 442a.html | QUIZ | HIGH | Mock Exam 함수 없음 / JS 파싱 실패 —   window.open('mailto:lidbil515@gmail.com?subject='+encodeURIComponent('Question Error Rep | SyntaxError: Unexpected identifier '#f0a500' [문자열 내 </script>로 조기종료(브라우저 동일)] |
| 276a.html | QUIZ | MED | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500' / ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |
| 276a.html | NUMBERS | MED | 표기 트레이드 수 8 ≠ 실제 11 |
| 306a.html | QUIZ | MED | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500' / ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |
| 306a.html | NUMBERS | MED | 표기 트레이드 수 8 ≠ 실제 11 |
| 308a.html | QUIZ | MED | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500' / ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |
| 308a.html | NUMBERS | MED | 표기 트레이드 수 8 ≠ 실제 11 |
| 309a.html | QUIZ | MED | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500' / ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |
| 309a.html | NUMBERS | MED | 표기 트레이드 수 8 ≠ 실제 11 |
| 310s.html | QUIZ | MED | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500' / ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |
| 310s.html | NUMBERS | MED | 표기 트레이드 수 8 ≠ 실제 11 |
| 310t.html | QUIZ | MED | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500' / ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |
| 310t.html | NUMBERS | MED | 표기 트레이드 수 8 ≠ 실제 11 |
| 313a.html | QUIZ | MED | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500' / ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |
| 313a.html | NUMBERS | MED | 표기 트레이드 수 8 ≠ 실제 11 |
| 313a.html | NUMBERS | MED | 페이지 내 표기 [110, 135] vs 실제 135문항 |
| 403a.html | QUIZ | MED | JS 파싱 실패 — SyntaxError: Unexpected identifier '#f0a500' [문자열 내 </script>로 조기종료(브라우저 동일)] |
| 404.html | HERO | MED | hero 클래스 섹션 없음 |
| 421a.html | QUIZ | MED | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500' / ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |
| 421a.html | NUMBERS | MED | 표기 트레이드 수 8 ≠ 실제 11 |
| 421a.html | NUMBERS | MED | 페이지 내 표기 [220, 300] vs 실제 300문항 |
| 442a.html | NUMBERS | MED | 표기 트레이드 수 9 ≠ 실제 11 |
| 442a.html | NUMBERS | MED | 페이지 내 표기 [100, 120] vs 실제 120문항 |
| 447a.html | QUIZ | MED | JS 파싱 실패 — SyntaxError: Unexpected end of input [문자열 내 </script>로 조기종료(브라우저 동일), questions 포함 블록→퀴즈 전체 사망] | SyntaxError: Unexpected identifier '#f0a500' / ★퀴즈 비작동 확정 (questions 블록 파싱 실패) |
| 447a.html | NUMBERS | MED | 표기 트레이드 수 8 ≠ 실제 11 |
| 447a.html | NUMBERS | MED | 페이지 내 표기 [110, 135] vs 실제 135문항 |
| about.html | NUMBERS | MED | 표기 질문 수 1,110 ≠ 실제 1560 |
| about.html | NUMBERS | MED | 표기 트레이드 수 8 ≠ 실제 11 |
| disclaimer.html | HERO | MED | hero 클래스 섹션 없음 |
| exam-guide.html | HERO | MED | hero 클래스 섹션 없음 |
| exam-guide.html | NUMBERS | MED | 표기 트레이드 수 8 ≠ 실제 11 |
| how-long-red-seal-apprenticeship-canada.html | NUMBERS | MED | 표기 트레이드 수 5 ≠ 실제 11 |
| index.html | NUMBERS | MED | 표기 트레이드 수 9 ≠ 실제 11 |
| practice-quizzes.html | NUMBERS | MED | 표기 질문 수 1,110 ≠ 실제 1560 |
| practice-quizzes.html | NUMBERS | MED | 표기 트레이드 수 8 ≠ 실제 11 |
| privacy.html | HERO | MED | hero 클래스 섹션 없음 |
| red-seal-exam-format-guide.html | NUMBERS | MED | 표기 트레이드 수 8 ≠ 실제 11 |
| red-seal-trades.html | NUMBERS | MED | 표기 트레이드 수 8 ≠ 실제 11 |
| study-guide.html | NUMBERS | MED | 표기 트레이드 수 8 ≠ 실제 11 |
| terms.html | HERO | MED | hero 클래스 섹션 없음 |
| trades-in-demand-canada-2026.html | NUMBERS | MED | 표기 질문 수 1,110 ≠ 실제 1560 |
| trades-in-demand-canada-2026.html | NUMBERS | MED | 표기 트레이드 수 10 ≠ 실제 11 |
| what-is-red-seal-certification-canada.html | NUMBERS | MED | 표기 트레이드 수 8 ≠ 실제 11 |
| which-red-seal-trade-should-i-choose.html | NUMBERS | MED | 표기 트레이드 수 8 ≠ 실제 11 |
| 276a.html | HERO | LOW | h1 2개 (중복) / hero 이모지 1개 |
| 306a.html | HERO | LOW | h1 2개 (중복) |
| 308a.html | HERO | LOW | h1 2개 (중복) / hero 이모지 1개 |
| 309a.html | HERO | LOW | h1 2개 (중복) / hero 이모지 1개 |
| 310s.html | HERO | LOW | h1 2개 (중복) / hero 이모지 1개 |
| 310t.html | HERO | LOW | h1 2개 (중복) / hero 이모지 1개 |
| 313a.html | HERO | LOW | h1 2개 (중복) / hero 이모지 1개 |
| 421a.html | HERO | LOW | h1 2개 (중복) / hero 이모지 1개 |
| 442a.html | HERO | LOW | hero 이모지 1개 |
| 447a.html | HERO | LOW | h1 2개 (중복) / hero 이모지 1개 |
| how-long-red-seal-apprenticeship-canada.html | HERO | LOW | hero 이모지 1개 |
| red-seal-exam-format-guide.html | HERO | LOW | hero 이모지 1개 |
| trades-in-demand-canada-2026.html | HERO | LOW | hero 이모지 1개 |

## 네비 정상 파일 수
- OK: 70 / 문제: 2

## Hero 정상 파일 수
- OK: 54 / 문제: 18