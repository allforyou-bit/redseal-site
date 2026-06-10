# -*- coding: utf-8 -*-
import io, re, sys
sys.stdout.reconfigure(encoding='utf-8')
ROOT = r'C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io'
for t in ['index', '306a', '421a', '310t', 'practice-quizzes', '404']:
    c = io.open(rf'{ROOT}\{t}.html', encoding='utf-8').read()
    m = re.search(r'(?<![\w-])body\s*\{([^}]*)\}', c)
    body = m.group(1)[:200] if m else '(body 룰 없음)'
    print(f'--- {t} ---')
    print(f'  body{{{body}}}')
