# -*- coding: utf-8 -*-
import io, re, sys, hashlib
sys.stdout.reconfigure(encoding='utf-8')
ROOT = r'C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io'

def nav_css(c):
    m = re.search(r'/\* ── NAV ── \*/(.*?)/\* ──', c, re.S)
    return m.group(1) if m else None

std = io.open(rf'{ROOT}\index.html', encoding='utf-8').read()
std_css = nav_css(std)
print('표준 nav CSS hash:', hashlib.md5(std_css.encode()).hexdigest()[:8], f'({len(std_css)}자)')

for t in ['306a', '404', '421a', '310t', 'practice-quizzes']:
    c = io.open(rf'{ROOT}\{t}.html', encoding='utf-8').read()
    nav = re.search(r'<nav[\s>].*?</nav>', c, re.S)
    css = nav_css(c)
    css_same = (css == std_css) if css else False
    has_js = bool(re.search(r"getElementById\('navToggle'\)", c))
    active = re.findall(r'<a href="([^"]+)" class="active"', c)
    n_navs = len(re.findall(r'<nav[\s>]', c))
    media = bool(re.search(r'@media\(max-width:820px\)\{\s*\n?\s*\.nav-toggle', c))
    print(f'{t}: nav블록={n_navs}개 | navCSS={"동일" if css_same else ("있음(다름)" if css else "없음")} '
          f'| navJS={"Y" if has_js else "N"} | active={active} | media820 nav={"Y" if media else "N"}')
