# -*- coding: utf-8 -*-
"""Phase 3 — apply standard hero (docs/hero-standard.md).

Page-family transforms (markup + standard CSS injection only; body content untouched):
  quiz    : <section class="page-hero"> -> .hero-std (kicker/h1/sub/pills, ✓ 제거)
  article : <div class="hero"><h1/><p/></div> -> .hero-std
  index   : .hero -> .hero-std + hero-meta pill (btns/stats 유지)
  special : exam-guide(<header>), privacy/terms/disclaimer(h1 in article)
Old page CSS rules are left in place (made inert by new class names).
Usage: python apply_hero_standard.py <page...>
"""
import io, re, sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = r'C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io'

HERO_CSS = '''<style id="hero-std">
.hero-std{background:linear-gradient(135deg,#0f2540 0%,#1a3a5c 45%,#2d6a9f 100%);color:#fff;padding:48px 24px 42px;text-align:center;font-family:'Segoe UI',Arial,sans-serif;line-height:1.6}
.hero-std .hero-kicker{display:inline-block;background:#f0a500;color:#fff;font-size:.78rem;font-weight:800;letter-spacing:2px;padding:4px 14px;border-radius:14px;margin-bottom:14px;text-transform:uppercase}
.hero-std h1{font-size:1.85rem;font-weight:800;color:#fff;margin:0 auto 10px;max-width:760px;line-height:1.3}
.hero-std h1 span{color:#f0a500}
.hero-std .hero-sub{font-size:.98rem;color:rgba(255,255,255,.88);max-width:620px;margin:0 auto 18px}
.hero-std .hero-meta{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.hero-std .hero-pill{background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.22);color:#fff;font-size:.74rem;font-weight:600;padding:4px 12px;border-radius:14px}
@media(max-width:600px){.hero-std h1{font-size:1.4rem}.hero-std .hero-sub{font-size:.88rem}}
</style>'''

TRADES = ['276a','306a','308a','309a','310s','310t','313a','403a','421a','442a','447a']
EMOJI = re.compile(r'[\U0001F000-\U0001FAFF☀-➿]\s*')

def build_hero(kicker, h1, sub, pills):
    parts = ['<section class="hero-std">']
    if kicker: parts.append(f'  <span class="hero-kicker">{kicker}</span>')
    parts.append(f'  <h1>{h1}</h1>')
    parts.append(f'  <p class="hero-sub">{sub}</p>')
    parts.append('  <div class="hero-meta">')
    for p in pills:
        parts.append(f'    <span class="hero-pill">{p}</span>')
    parts.append('  </div>')
    parts.append('</section>')
    return '\n'.join(parts)

def clean(txt):
    txt = re.sub(r'&#x?(2713|2714|10003|10004);?\s*', '', txt)  # ✓ entities
    return EMOJI.sub('', txt).strip()

def transform(t, c):
    # ---- quiz family ----
    if t in TRADES:
        m = re.search(r'<section class="page-hero">(.*?)</section>', c, re.S)
        if not m: return None, 'page-hero 블록 없음'
        inner = m.group(1)
        kicker = (re.search(r'<span class="trade-badge">(.*?)</span>', inner) or [None, t.upper()])[1]
        h1 = re.search(r'<h1[^>]*>(.*?)</h1>', inner, re.S).group(1).strip()
        sub = re.search(r'<p class="subtitle">(.*?)</p>', inner, re.S).group(1).strip()
        pills = [clean(p) for p in re.findall(r'<span class="(?:badge|update-pill|rsos-pill)">(.*?)</span>', inner, re.S)]
        return c[:m.start()] + build_hero(clean(kicker), clean(h1), clean(sub), pills) + c[m.end():], 'quiz형 변환'

    # ---- index ----
    if t == 'index':
        m = re.search(r'<div class="hero">(.*?)</div>\s*\n\s*<div class="container">', c, re.S)
        if not m: return None, 'index hero 블록 없음'
        inner = m.group(0)[len('<div class="hero">'):]
        # keep h1/sub/btns/stats, add meta pill, swap wrapper class
        block = '<section class="hero-std">' + inner.rsplit('</div>', 1)[0]
        block = block.replace('<div class="hero-btns">',
                              '<div class="hero-meta" style="margin-bottom:24px">\n'
                              '    <span class="hero-pill">Updated June 2026</span>\n'
                              '  </div>\n  <div class="hero-btns">', 1)
        block += '</section>\n\n<div class="container">'
        return c[:m.start()] + block + c[m.end():], 'index형 변환'

    # ---- exam-guide (header형) ----
    if t == 'exam-guide':
        m = re.search(r'<header>(.*?)</header>', c, re.S)
        if not m: return None, 'header 블록 없음'
        new = build_hero(None, 'Red Seal Exam Registration Guide',
                         'How to register for your Red Seal exam in every province — fees, steps, and contacts.',
                         ['Updated June 2026'])
        return c[:m.start()] + new + c[m.end():], 'header형 변환'

    # ---- privacy / terms / disclaimer (article 내 h1형) ----
    if t in ('privacy', 'terms', 'disclaimer'):
        WORD = {
            'privacy': ('Privacy Policy', 'How we collect, use, and protect your information on this site.'),
            'terms': ('Terms of Use', 'The rules and conditions for using Red Seal Prep.'),
            'disclaimer': ('Disclaimer', 'What our practice materials are — and what they are not.'),
        }
        h1m = re.search(r'<h1[^>]*>(.*?)</h1>\s*', c, re.S)
        if not h1m: return None, 'h1 없음'
        # capture & remove "last updated" line if right after h1
        upm = re.match(r'<p class="updated">(.*?)</p>\s*', c[h1m.end():], re.S)
        badge = 'Last updated June 2026'
        rest_cut = h1m.end()
        if upm:
            badge = re.sub(r'<[^>]+>', '', upm.group(1)).strip()
            rest_cut = h1m.end() + upm.end()
        c2 = c[:h1m.start()] + c[rest_cut:]
        h1, sub = WORD[t]
        new = build_hero(None, h1, sub, [badge])
        nav_end = c2.find('</nav>') + 6
        # insert after breadcrumb if present
        bc = re.search(r'<nav[^>]*[Bb]readcrumb.*?</nav>', c2, re.S)
        ins = bc.end() if bc else nav_end
        return c2[:ins] + '\n' + new + c2[ins:], 'article-h1형 변환 (h1 이동)'

    # ---- article family ----
    m = re.search(r'<div class="(?:hero|hero-bar)"[^>]*>\s*<h1[^>]*>(.*?)</h1>\s*<p[^>]*>(.*?)</p>\s*'
                  r'(?:<div class="freshness"[^>]*>(.*?)</div>\s*)?</div>', c, re.S)
    if not m: return None, 'article hero 패턴 불일치'
    h1, sub = m.group(1).strip(), m.group(2).strip()
    pill = clean(re.sub(r'<[^>]+>', '', m.group(3))) if m.group(3) else 'Updated June 2026'
    kicker = next((tr.upper() for tr in TRADES if tr in t.lower()), None)
    new = build_hero(kicker, clean(h1), clean(sub), [pill])
    return c[:m.start()] + new + c[m.end():], 'article형 변환'

for t in sys.argv[1:]:
    path = rf'{ROOT}\{t}.html'
    c = io.open(path, encoding='utf-8').read()
    out, msg = transform(t, c)
    if out is None:
        print(f'{t}: !! 실패 — {msg}')
        continue
    if 'id="hero-std"' not in out:
        out = out.replace('</head>', HERO_CSS + '\n</head>', 1)
    io.open(path, 'w', encoding='utf-8').write(out)
    print(f'{t}: {msg} + 표준 CSS 삽입')
