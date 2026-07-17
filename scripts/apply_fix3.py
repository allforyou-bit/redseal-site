# -*- coding: utf-8 -*-
"""Fix 3 applier — insert new blueprint-gap questions into 421a.html.

Reads scratchpad fix3/out_*.json, assigns ids after the current max, appends
compact JS objects before the questions array close, adds new topic-tab buttons,
and records source URLs in docs/question-sources-fix3.md (sources never ship in HTML).
"""
import sys, os, json, re
sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRATCH = r'C:\Users\kayky\AppData\Local\Temp\claude\C--Users-kayky-Desktop-BRAINVSMATH\430ce4b2-f606-4068-8dd1-d6f36928abf0\scratchpad\fix3'
TARGET = os.path.join(ROOT, '421a.html')
FILES = ['out_hvac.json', 'out_structures.json', 'out_hybrid_chassis.json']
NEW_TABS = [
    ("switchTopic('hvac', this)", 'G — HVAC & Cab Comfort', 'hvac'),
    ("switchTopic('structures', this)", 'H — Structures & Attachments', 'structures'),
    ("switchTopic('hybrid', this)", 'I — Hybrid & Electric', 'hybrid'),
]


def js(s):
    s = str(s).replace('\\', '\\\\').replace("'", "\\'")
    s = s.replace('</script', '<\\/script').replace('\n', ' ').replace('\r', ' ')
    return s


def obj(q, qid):
    opts = ','.join("'" + js(o) + "'" for o in q['options'])
    return ("{id:%d,topic:'%s',topicLabel:'%s',diff:'%s',text:'%s',options:[%s],answer:%d,"
            "explanation:'%s',keyConcept:'%s'}") % (
        qid, q['topic'], js(q['topicLabel']), q['diff'], js(q['text']), opts,
        q['answer'], js(q['explanation']), js(q.get('keyConcept', '')))


def main():
    html = open(TARGET, encoding='utf-8').read()
    max_id = max(int(m) for m in re.findall(r'\bid:\s*(\d+)\s*,', html))
    print('current max id:', max_id)

    items = []
    for f in FILES:
        items += json.load(open(os.path.join(SCRATCH, f), encoding='utf-8'))
    print('new questions:', len(items))

    qid = max_id
    lines, sources = [], []
    for q in items:
        qid += 1
        lines.append(obj(q, qid) + ',')
        sources.append((qid, q['topic'], q.get('source', '')))

    decl = html.find('const questions')
    m = re.search(r'\n\];', html[decl:])
    ins = decl + m.start()
    block = '\n// Fix 3 (2026-07-17): blueprint-gap questions — MWA F/H/I + chassis\n' + '\n'.join(lines)
    html = html[:ins] + block + html[ins:]

    # topic tab buttons after the Brakes & Steering tab
    anchor = re.search(r'(<button class="tab-btn" onclick="switchTopic\(\'brakes\', this\)">[^<]*</button>)', html)
    if not anchor:
        print('TAB ANCHOR NOT FOUND'); sys.exit(1)
    tabs = ''.join('\n    <button class="tab-btn" onclick="%s">%s</button>' % (fn, label)
                   for fn, label, key in NEW_TABS
                   if 'switchTopic(\'%s\'' % key not in html)
    html = html[:anchor.end()] + tabs + html[anchor.end():]

    open(TARGET, 'w', encoding='utf-8').write(html)

    with open(os.path.join(ROOT, 'docs', 'question-sources-fix3.md'), 'w', encoding='utf-8') as f:
        f.write('# Fix 3 신규 문항 출처 기록 (W3 QC, 2026-07-17)\n\n| id | topic | source |\n|---|---|---|\n')
        for qid, t, s in sources:
            f.write('| %d | %s | %s |\n' % (qid, t, s))
    print('inserted ids %d-%d, tabs added, sources recorded' % (max_id + 1, qid))


if __name__ == '__main__':
    main()
