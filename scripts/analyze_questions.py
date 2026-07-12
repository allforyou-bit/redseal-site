# -*- coding: utf-8 -*-
"""Phase 6-2 — full question format & type analysis (read-only).

형식: 보기 4개 / 정답 인덱스 유효 / 해설 존재 / 중복 문항
유형: 암기형(recall) / 절차형(procedural) / 분석형(critical thinking) 휴리스틱 분류
토픽: 사이트 토픽 분포 출력 (공식 MWA와 비교용)
"""
import io, re, sys, json, collections
sys.stdout.reconfigure(encoding='utf-8')
ROOT = r'C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io'
TRADES = ['276a','306a','308a','309a','310s','310t','313a','403a','421a','442a','447a']

# official per-trade bands: (recall_lo, recall_hi, proc_lo, proc_hi, crit_lo, crit_hi)
OFFICIAL = {
    '421a': (5,15,45,55,35,45), '310t': (0,10,50,60,35,45), '310s': (5,15,40,50,40,50),
    '309a': (5,15,60,70,20,30), '308a': (20,30,50,60,10,20), '276a': (40,50,35,45,10,20),
    '447a': (15,25,60,70,10,20), '313a': (10,20,35,45,40,50), '442a': (50,60,35,45,0,10),
    '403a': (10,20,50,60,25,35), '306a': (20,30,60,70,5,15),
}

QSPLIT = re.compile(r'\{\s*id\s*:\s*(\d+)\s*,')

def parse_questions(c):
    m = re.search(r'const questions\s*=\s*\[', c)
    start = m.end()
    # find array end: '];' at line start after start
    em = re.search(r'\n\];', c[start:])
    body = c[start:start + em.start()]
    chunks = QSPLIT.split(body)
    qs = []
    for i in range(1, len(chunks), 2):
        qid = int(chunks[i]); chunk = chunks[i + 1]
        topic = re.search(r"topic\s*:\s*'([^']+)'", chunk)
        diff = re.search(r"diff\s*:\s*'([^']+)'", chunk)
        text = re.search(r"text\s*:\s*(['\"])((?:[^\\]|\\.)*?)\1\s*,\s*\n?\s*options", chunk, re.S)
        opts_m = re.search(r"options\s*:\s*\[(.*?)\]\s*,\s*\n?\s*answer", chunk, re.S)
        ans = re.search(r"answer\s*:\s*(\d+)", chunk)
        expl = re.search(r"explanation\s*:\s*(['\"])((?:[^\\]|\\.)*?)\1", chunk, re.S)
        opts = re.findall(r"(['\"])((?:[^\\]|\\.)*?)\1", opts_m.group(1)) if opts_m else []
        qs.append({
            'id': qid,
            'topic': topic.group(1) if topic else '?',
            'diff': diff.group(1) if diff else '?',
            'text': text.group(2) if text else '',
            'n_opts': len(opts),
            'answer': int(ans.group(1)) if ans else -1,
            'expl': bool(expl and expl.group(2).strip()),
        })
    return qs

SCEN = re.compile(r'\b[Aa]n? [^.?]{0,60}?\b(technician|apprentice|mechanic|electrician|welder|plumber|fitter|ironworker|worker|journeyperson|customer|operator|rigger|installer)\b'
                  r'|\b(finds|notices|discovers|measures|reads|reports|complains|inspect\w*)\b', re.I)
DIAG = re.compile(r'\b(most likely|likely cause|probable cause|diagnos|what is wrong|root cause|caused by|conclude|indicat\w+|what (?:error|fault|problem|condition)|symptom|why (?:does|is|would))\b', re.I)
CALC = re.compile(r'\b(calculate|what is the (?:total|minimum|maximum|required|line|resulting|net|effective) [\w /-]{0,30}?'
                  r'(?:size|load|capacity|pressure|voltage|current|resistance|length|weight|volume|flow|temperature|wll|sag|tension|force|output|value)'
                  r'|how (?:much|many) [\w ]+ (?:is|are) (?:required|needed))\b', re.I)
NUMS = re.compile(r'\d+(?:\.\d+)?\s*(?:%|kpa|psi|volts?|v\b|amps?|a\b|ohms?|ω|mm|cm|m\b|kg|lbs?|ft|in\b|°|deg|hz|kw|hp|l/s|cfm|gpm|rpm|ma\b)', re.I)
PROC = re.compile(r'\b(first|next step|before|after|during|sequence|procedure|how should|what action|should (?:the \w+ )?(?:do|take|be taken)'
                  r'|correct (?:action|way|method|order|procedure)|proper(?:ly)?|when (?:install|test|remov|adjust|servic|perform|measur|weld|cutt|rigg|enter|us)\w*'
                  r'|what should)\b', re.I)

def classify(q):
    t = q['text']
    scen = bool(SCEN.search(t))
    nums = bool(NUMS.search(t))
    if CALC.search(t):
        return 'analysis'
    if DIAG.search(t) and (scen or nums or 'most likely' in t.lower() or 'cause' in t.lower()):
        return 'analysis'
    if scen and nums:
        return 'analysis'      # 측정값 해석 시나리오
    if PROC.search(t) or scen:
        return 'procedural'
    if DIAG.search(t):
        return 'analysis'
    return 'recall'

def band_check(pct, lo, hi, tol=5):
    return lo - tol <= pct <= hi + tol

report = {}
for t in TRADES:
    c = io.open(rf'{ROOT}\{t}.html', encoding='utf-8').read()
    qs = parse_questions(c)
    fmt_issues = []
    for q in qs:
        probs = []
        if q['n_opts'] != 4: probs.append(f"보기 {q['n_opts']}개")
        if not (0 <= q['answer'] <= 3): probs.append(f"정답 인덱스 {q['answer']}")
        if not q['expl']: probs.append('해설 없음')
        if not q['text']: probs.append('질문 텍스트 파싱 실패')
        if probs:
            fmt_issues.append((q['id'], ', '.join(probs)))
    # duplicates (normalized text)
    seen = {}
    dups = []
    for q in qs:
        key = re.sub(r'\W+', '', q['text'].lower())[:120]
        if key and key in seen:
            dups.append((seen[key], q['id']))
        else:
            seen[key] = q['id']
    # type classification
    cnt = collections.Counter(classify(q) for q in qs)
    n = len(qs)
    rec, proc, ana = (round(cnt[k] / n * 100) for k in ('recall', 'procedural', 'analysis'))
    lo1, hi1, lo2, hi2, lo3, hi3 = OFFICIAL[t]
    ok = band_check(rec, lo1, hi1) and band_check(proc, lo2, hi2) and band_check(ana, lo3, hi3)
    # topic distribution
    topics = collections.Counter(q['topic'] for q in qs)
    report[t] = {'n': n, 'fmt': fmt_issues, 'dups': dups,
                 'types': (rec, proc, ana), 'bands': OFFICIAL[t], 'type_ok': ok,
                 'topics': {k: round(v / n * 100) for k, v in topics.most_common()}}

io.open(rf'{ROOT}\docs\question-analysis-raw.json', 'w', encoding='utf-8').write(
    json.dumps(report, ensure_ascii=False, indent=1))

print('| 트레이드 | 문항 | 형식문제 | 중복 | 암기% (기준) | 절차% (기준) | 분석% (기준) | 유형판정 |')
print('|---|---|---|---|---|---|---|---|')
for t in TRADES:
    r = report[t]
    b = r['bands']
    rec, proc, ana = r['types']
    print(f"| {t} | {r['n']} | {len(r['fmt'])} | {len(r['dups'])} "
          f"| {rec} ({b[0]}–{b[1]}) | {proc} ({b[2]}–{b[3]}) | {ana} ({b[4]}–{b[5]}) "
          f"| {'✅' if r['type_ok'] else '⚠️'} |")
print()
for t in TRADES:
    r = report[t]
    if r['fmt']:
        print(f"{t} 형식 문제: {r['fmt'][:10]}")
    if r['dups']:
        print(f"{t} 중복: {r['dups'][:10]}")
print()
for t in TRADES:
    print(f"{t} 토픽 분포: {report[t]['topics']}")
