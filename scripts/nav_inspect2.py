# -*- coding: utf-8 -*-
import io, re, sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = r'C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io'

for t in ['306a', '404', '421a', '310t', 'practice-quizzes']:
    c = io.open(rf'{ROOT}\{t}.html', encoding='utf-8').read()
    print(f'=== {t} ===')
    for m in re.finditer(r'<nav[^>]*>', c):
        line = c.count('\n', 0, m.start()) + 1
        print(f'  nav태그 줄{line}: {m.group(0)}')
    # nav css selectors anywhere
    sels = []
    for sm in re.finditer(r'(?:^|\}|\{|\s)(nav\s*\{|\.nav-[\w-]+[^{}]*\{)', c):
        line = c.count('\n', 0, sm.start()) + 1
        sels.append((line, sm.group(1)[:50].strip()))
    print(f'  nav CSS 룰 {len(sels)}개:', sels[:6], '...' if len(sels) > 6 else '')
    # where is the media query with nav rules?
    for mm in re.finditer(r'@media[^{]*\{', c):
        seg_start = mm.end()
        depth = 1; i = seg_start
        while depth and i < len(c):
            if c[i] == '{': depth += 1
            elif c[i] == '}': depth -= 1
            i += 1
        seg = c[seg_start:i]
        if '.nav-' in seg or 'nav{' in seg:
            line = c.count('\n', 0, mm.start()) + 1
            print(f'  nav 포함 @media 줄{line}: {mm.group(0).strip()[:50]}')
