# -*- coding: utf-8 -*-
"""Print sample questions per classified type to validate the heuristic."""
import io, re, sys, random
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, r'C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io\scripts')
from analyze_questions import parse_questions, classify, ROOT

random.seed(42)
for t in ['421a', '276a', '313a']:
    c = io.open(rf'{ROOT}\{t}.html', encoding='utf-8').read()
    qs = parse_questions(c)
    by = {'recall': [], 'procedural': [], 'analysis': []}
    for q in qs:
        by[classify(q)].append(q)
    print(f'===== {t} =====')
    for k in by:
        print(f'--- {k} ({len(by[k])}) ---')
        for q in random.sample(by[k], min(3, len(by[k]))):
            print(f"  id{q['id']} [{q['diff']}]: {q['text'][:170]}")
    print()
