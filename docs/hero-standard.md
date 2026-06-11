# Hero Standard (Phase 3 — 2026-06-11)

모든 페이지 상단 Hero는 아래 구조·팔레트를 따른다. 본문 콘텐츠(글/퀴즈/표)는 건드리지 않는다.

## 1. 표준 구조 (3요소: 제목 + 한 줄 설명 + 메타 배지)

```html
<section class="hero-std">
  <span class="hero-kicker">421A</span>                  <!-- 선택: 트레이드 코드/카테고리 (없으면 생략) -->
  <h1>421A Red Seal — Heavy Equipment Technician</h1>     <!-- 필수: 페이지당 정확히 1개 -->
  <p class="hero-sub">Free Canada Certification Exam Practice Questions | 2026</p>  <!-- 필수: 한 줄 설명 -->
  <div class="hero-meta">                                 <!-- 필수: 메타 배지 1개 이상 -->
    <span class="hero-pill">Updated June 2026</span>
    <span class="hero-pill">300 Practice Questions</span>
  </div>
</section>
```

- index.html만 예외적으로 hero-meta 아래 CTA 버튼(.hero-btns)과 통계(.hero-stats)를 추가로 가질 수 있다 (기능 요소).
- 이모지/장식 문자(✓ 포함) 금지 — 배지는 순수 텍스트.

## 2. 표준 CSS (자급자족형 — `<style id="hero-std">`로 `</head>` 직전 삽입)

```css
.hero-std{background:linear-gradient(135deg,#0f2540 0%,#1a3a5c 45%,#2d6a9f 100%);color:#fff;padding:48px 24px 42px;text-align:center;font-family:'Segoe UI',Arial,sans-serif;line-height:1.6}
.hero-std .hero-kicker{display:inline-block;background:#f0a500;color:#fff;font-size:.78rem;font-weight:800;letter-spacing:2px;padding:4px 14px;border-radius:14px;margin-bottom:14px;text-transform:uppercase}
.hero-std h1{font-size:1.85rem;font-weight:800;color:#fff;margin:0 auto 10px;max-width:760px;line-height:1.3}
.hero-std .hero-sub{font-size:.98rem;color:rgba(255,255,255,.88);max-width:620px;margin:0 auto 18px}
.hero-std .hero-meta{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.hero-std .hero-pill{background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.22);color:#fff;font-size:.74rem;font-weight:600;padding:4px 12px;border-radius:14px}
@media(max-width:600px){.hero-std h1{font-size:1.4rem}.hero-std .hero-sub{font-size:.88rem}}
```

## 3. 단일 팔레트 (확정 hex)

| 용도 | hex |
|---|---|
| Hero 그라데이션 시작 (진네이비) | `#0f2540` |
| 메인 네이비 (nav와 동일) | `#1a3a5c` |
| Hero 그라데이션 끝 (블루) | `#2d6a9f` |
| 강조 (앰버 — kicker/링크/액션) | `#f0a500` |
| Hero 텍스트 | `#ffffff` / 설명 `rgba(255,255,255,.88)` |
| 본문 배경 | `#f0f4f9` |
| 본문 텍스트 | `#2c3e50` / 보조 `#7f8c8d` |
| 성공/통과 | `#27ae60` |
| 경고/오답 | `#e74c3c` |

- 기존 기사별 컬러 그라데이션(`#c0392b` 적색, `#8b0000` 암적색 등)은 전부 위 네이비 그라데이션으로 교체.

## 4. 이모지 정책
- Hero와 본문 카드의 이모지 아이콘은 텍스트(또는 SVG)로 대체.
- 퀴즈 기능 JS 내부 문자열(🔥 streak, 📕 Mistakes 등)은 퀴즈 영역이므로 Phase 3 범위 밖 — 별도 승인 필요.

## 5. 적용·검증 도구
- 적용: `python scripts/apply_hero_standard.py <page...>`
- 검증: `python verify_hero.py <page...>` — Playwright 좌표(≤2px) + 배경/제목 색상 픽셀 추출 일치 + 스크린샷 docs/screenshots/hero_*.png
