# -*- coding: utf-8 -*-
"""Phase 2 — apply standard nav (docs/nav-standard.md) to target pages.

Replaces ONLY: top <nav> block, old top-nav CSS rules, (404: adds nav JS).
Never touches: page body content, .nav-row/.nav-btn (quiz buttons),
breadcrumb <nav aria-label="Breadcrumb">.
Usage: python apply_nav_standard.py 306a 404 421a ...
"""
import io, re, sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = r'C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io'

NAV_HTML = '''<nav>
  <a href="/" class="nav-brand">\U0001F527 Red Seal Prep</a>
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
</nav>'''

NAV_CSS = '''<style id="nav-std">
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
</style>'''

NAV_JS = '''<script id="nav-std-js">
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
</script>'''

# selectors belonging to the TOP nav (never .nav-row / .nav-btn)
SEL_RE = re.compile(r'^(nav|\.site-nav|\.nav-(brand|toggle|links|dropdown|drop-btn|drop-menu))(?![\w-])')

def selector_is_topnav(sel):
    parts = [p.strip() for p in sel.split(',')]
    return all(SEL_RE.match(p) for p in parts if p)

def strip_topnav_rules(css):
    """Remove top-nav rules from a CSS string (handles one @media nesting level)."""
    out, i, removed = [], 0, 0
    n = len(css)
    while i < n:
        b = css.find('{', i)
        if b == -1:
            out.append(css[i:]); break
        sel = css[i:b]
        if sel.strip().startswith('@media'):
            # find matching close of media block
            depth, j = 1, b + 1
            while depth and j < n:
                if css[j] == '{': depth += 1
                elif css[j] == '}': depth -= 1
                j += 1
            inner, r = strip_topnav_rules(css[b + 1:j - 1])
            removed += r
            out.append(sel + '{' + inner + '}')
            i = j
        else:
            j = css.find('}', b)
            if j == -1:
                out.append(css[i:]); break
            if selector_is_topnav(sel.strip().split('}')[-1]):
                removed += 1  # drop this rule
            else:
                out.append(css[i:j + 1])
            i = j + 1
    return ''.join(out), removed

ACTIVE_HREF = {
    '306a': '/306a.html', '421a': '/421a.html', '310t': '/310t.html',
    'practice-quizzes': '/practice-quizzes.html',
    'red-seal-trades': '/red-seal-trades.html', 'about': '/about.html',
}
# all quiz/article pages: active on own link if present in nav
for tr in ['276a','306a','308a','309a','310s','310t','313a','403a','421a','442a','447a']:
    ACTIVE_HREF.setdefault(tr, f'/{tr}.html')

for t in sys.argv[1:]:
    path = rf'{ROOT}\{t}.html'
    c = io.open(path, encoding='utf-8').read()
    report = []

    # 1. nav HTML (skip breadcrumb navs)
    nav_html = NAV_HTML
    if t in ACTIVE_HREF:
        nav_html = nav_html.replace(f'<a href="{ACTIVE_HREF[t]}">',
                                    f'<a href="{ACTIVE_HREF[t]}" class="active">')
    m = re.search(r'<nav(?![^>]*[Bb]readcrumb)[^>]*>.*?</nav>', c, re.S)
    if m:
        c = c[:m.start()] + nav_html + c[m.end():]
        report.append('nav 교체')
    else:
        bm = re.search(r'<body[^>]*>', c)
        c = c[:bm.end()] + '\n' + nav_html + c[bm.end():]
        report.append('nav 신규 삽입')

    # 2. remove old top-nav CSS from every <style> (except our nav-std block)
    total_removed = 0
    def style_repl(sm):
        global total_removed
        if 'id="nav-std"' in sm.group(1):
            return sm.group(0)
        inner, r = strip_topnav_rules(sm.group(2))
        total_removed += r
        return f'<style{sm.group(1)}>{inner}</style>'
    c = re.sub(r'<style([^>]*)>(.*?)</style>', style_repl, c, flags=re.S)
    report.append(f'구 nav CSS {total_removed}룰 제거')

    # 3. insert (or refresh) standard nav CSS before </head>
    if 'id="nav-std"' in c:
        c = re.sub(r'<style id="nav-std">.*?</style>', lambda _: NAV_CSS, c, flags=re.S)
        report.append('표준 nav CSS 갱신')
    else:
        c = c.replace('</head>', NAV_CSS + '\n</head>', 1)
        report.append('표준 nav CSS 삽입')

    # 4. nav JS: only if page has none
    if "getElementById('navToggle')" not in c:
        c = c.replace('</body>', NAV_JS + '\n</body>', 1)
        report.append('표준 nav JS 삽입')

    io.open(path, 'w', encoding='utf-8').write(c)
    print(f'{t}: ' + ' | '.join(report))
