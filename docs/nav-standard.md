# Navigation Standard (Phase 2 — 2026-06-10)

**유일한 표준 = index.html의 네비.** 모든 페이지는 아래 3개 블록과 동일해야 한다.
트레이드 11개, 코드 순서 고정: 276A→306A→308A→309A→310S→310T→313A→403A→421A→442A→447A (중복 금지)

## 규칙
- 상단 네비 `<nav>`는 페이지당 정확히 1개. (breadcrumb `<nav aria-label="Breadcrumb">`는 별개 — 건드리지 않음)
- `.nav-row` / `.nav-btn`은 퀴즈 이전·다음 버튼 CSS — 상단 네비와 무관하므로 절대 수정 금지
- active 표시: 페이지 자신의 링크에만 `class="active"` (index→Home, 퀴즈 페이지→드롭다운 내 자기 트레이드, practice-quizzes→Quizzes, red-seal-trades→Guides, about→About, 그 외→없음)
- 네비 CSS는 `<style id="nav-std">` 블록으로 `</head>` 직전에 둔다 (페이지 고유 CSS보다 뒤 → 충돌 시 표준이 이김)

## 1. 표준 NAV HTML

```html
<nav>
  <a href="/" class="nav-brand">🔧 Red Seal Prep</a>
  <button class="nav-toggle" aria-label="Menu" id="navToggle">☰</button>
  <div class="nav-links" id="navLinks">
    <a href="/">Home</a>
    <div class="nav-dropdown" id="tradesDrop">
      <button class="nav-drop-btn" id="tradesBtn" aria-haspopup="true">Trades ▾</button>
      <div class="nav-drop-menu">
        <a href="/276a.html">276A Welder</a>
        <a href="/306a.html">306A Sheet Metal Worker</a>
        <a href="/308a.html">308A HVAC/Refrigeration</a>
        <a href="/309a.html">309A Construction Electrician</a>
        <a href="/310s.html">310S Automotive Service Tech</a>
        <a href="/310t.html">310T Truck &amp; Transport Mechanic</a>
        <a href="/313a.html">313A Industrial Electrician</a>
        <a href="/403a.html">403A Gas Fitter (Class A)</a>
        <a href="/421a.html">421A Heavy Equipment Tech</a>
        <a href="/442a.html">442A Ironworker</a>
        <a href="/447a.html">447A Plumber</a>
      </div>
    </div>
    <a href="/practice-quizzes.html">Quizzes</a>
    <a href="/red-seal-trades.html">Guides</a>
    <a href="/about.html">About</a>
  </div>
</nav>
```

## 2. 표준 NAV CSS (index.html 줄 46-70 기반 + 상속 차단용 font-family/line-height/width 명시 — 렌더링은 index와 동일)

```css
nav{background:#1a3a5c;padding:0 24px;display:flex;align-items:center;position:sticky;top:0;z-index:200;box-shadow:0 2px 8px rgba(0,0,0,.2);min-height:52px;font-family:'Segoe UI',Arial,sans-serif;line-height:1.7;width:100%}
.nav-brand{color:white;text-decoration:none;font-weight:800;font-size:.92rem;white-space:nowrap;margin-right:auto;display:flex;align-items:center;gap:6px}
.nav-links{display:flex;align-items:center;gap:4px;margin-left:auto}
.nav-links>a{color:rgba(255,255,255,.85);text-decoration:none;font-weight:600;font-size:.85rem;padding:8px 12px;border-radius:6px;transition:all .2s;white-space:nowrap}
.nav-links>a:hover,.nav-links>a.active{color:#f0a500;background:rgba(255,255,255,.08)}
.nav-dropdown{position:relative}
.nav-drop-btn{background:none;border:none;color:rgba(255,255,255,.85);font-weight:600;font-size:.85rem;cursor:pointer;font-family:inherit;padding:8px 12px;border-radius:6px;display:inline-flex;align-items:center;gap:4px;transition:all .2s;white-space:nowrap}
.nav-drop-btn:hover{color:#f0a500;background:rgba(255,255,255,.08)}
.nav-drop-menu{display:none;position:absolute;top:calc(100% + 6px);left:0;background:#1a3a5c;border-radius:10px;box-shadow:0 10px 32px rgba(0,0,0,.35);min-width:230px;z-index:300;border:1px solid rgba(255,255,255,.12);padding:6px 0}
.nav-dropdown.open .nav-drop-menu{display:block}
.nav-drop-menu a{display:block;padding:9px 18px;color:rgba(255,255,255,.85);text-decoration:none;font-size:.84rem;font-weight:600;transition:all .15s}
.nav-drop-menu a:hover{background:rgba(255,255,255,.1);color:#f0a500;padding-left:22px}
.nav-toggle{display:none;background:none;border:none;color:white;font-size:1.4rem;cursor:pointer;padding:8px;margin-left:12px;flex-shrink:0}
@media(max-width:820px){
  .nav-toggle{display:flex;align-items:center;justify-content:center}
  .nav-links{display:none;position:absolute;top:52px;left:0;right:0;background:#1a3a5c;flex-direction:column;align-items:stretch;z-index:201;box-shadow:0 8px 24px rgba(0,0,0,.35);border-top:1px solid rgba(255,255,255,.1);max-height:80vh;overflow-y:auto;padding:6px 0}
  .nav-links.open{display:flex}
  .nav-links>a{padding:12px 20px!important;border-bottom:1px solid rgba(255,255,255,.07)!important;border-radius:0!important;font-size:.9rem!important}
  .nav-dropdown{width:100%}
  .nav-drop-btn{width:100%;padding:12px 20px!important;border-bottom:1px solid rgba(255,255,255,.07);border-radius:0;font-size:.9rem!important;justify-content:space-between}
  .nav-drop-menu{position:static;background:#0d2440;box-shadow:none;border-radius:0;border:none;border-top:none;padding:0}
  .nav-drop-menu a{padding:10px 20px 10px 34px!important;border-bottom:1px solid rgba(255,255,255,.04)!important;font-size:.86rem!important}
}
```

## 3. 표준 NAV JS (index.html 줄 368-381과 동일, null 가드 포함판)

```js
(function(){
  var navToggle = document.getElementById('navToggle');
  var navLinks  = document.getElementById('navLinks');
  if(navToggle && navLinks){
    navToggle.addEventListener('click', function(){
      var open = navLinks.classList.toggle('open');
      navToggle.textContent = open ? '✕' : '☰';
    });
  }
  var tradesDrop = document.getElementById('tradesDrop');
  var tradesBtn  = document.getElementById('tradesBtn');
  if(tradesDrop && tradesBtn){
    tradesBtn.addEventListener('click', function(e){
      e.stopPropagation();
      tradesDrop.classList.toggle('open');
    });
    document.addEventListener('click', function(){ tradesDrop.classList.remove('open'); });
  }
})();
```

## 적용 & 검증 도구
- 적용: `python scripts/apply_nav_standard.py <page...>` — nav 블록 교체 + 구 CSS 제거 + 표준 CSS 삽입
- 검증: `python verify_nav.py <page...>` — Playwright 1920×1080, nav+메뉴 좌표를 index와 비교 (편차 ≤1px 통과) + docs/screenshots/ 스크린샷
