# -*- coding: utf-8 -*-
"""Phase 6-3 — seeded random sample for factual review (8 per trade)."""
import io, re, sys, random
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, r'C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io\scripts')
ROOT = r'C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io'
TRADES = ['276a','306a','308a','309a','310s','310t','313a','403a','421a','442a','447a']
QSPLIT = re.compile(r'\{\s*id\s*:\s*(\d+)\s*,')

def parse_full(c):
    m = re.search(r'const questions\s*=\s*\[', c)
    body = c[m.end():]
    body = body[:re.search(r'\n\];', body).start()]
    chunks = QSPLIT.split(body)
    qs = []
    for i in range(1, len(chunks), 2):
        qid = int(chunks[i]); chunk = chunks[i+1]
        text = re.search(r"text\s*:\s*(['\"])((?:[^\\]|\\.)*?)\1\s*,\s*\n?\s*options", chunk, re.S)
        opts_m = re.search(r"options\s*:\s*\[(.*?)\]\s*,\s*\n?\s*answer", chunk, re.S)
        ans = re.search(r"answer\s*:\s*(\d+)", chunk)
        expl = re.search(r"explanation\s*:\s*(['\"])((?:[^\\]|\\.)*?)\1", chunk, re.S)
        opts = [o[1] for o in re.findall(r"(['\"])((?:[^\\]|\\.)*?)\1", opts_m.group(1))] if opts_m else []
        qs.append({'id': qid, 'text': text.group(2) if text else '',
                   'opts': opts, 'ans': int(ans.group(1)) if ans else -1,
                   'expl': (expl.group(2) if expl else '')})
    return qs

random.seed(20260611)
for t in TRADES:
    c = io.open(rf'{ROOT}\{t}.html', encoding='utf-8').read()
    qs = parse_full(c)
    sample = random.sample(qs, 8)
    print(f'########## {t} ##########')
    for q in sample:
        txt = re.sub(r'\s+', ' ', q['text'].replace("\\'", "'"))[:280]
        print(f"[{t}-{q['id']}] {txt}")
        for j, o in enumerate(q['opts']):
            o2 = re.sub(r'\s+', ' ', o.replace("\\'", "'"))[:110]
            mark = '*' if j == q['ans'] else ' '
            print(f'   {mark}{chr(65+j)}) {o2}')
        ex = re.sub(r'<[^>]+>', '', q['expl'].replace("\\'", "'"))
        print(f'   해설: {re.sub(chr(92)+"s+", " ", ex)[:220]}')
    print()
