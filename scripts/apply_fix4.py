# -*- coding: utf-8 -*-
"""Fix 4 applier — duplicate replacements (full object), electrical additions, 2 polishes.

Inputs (scratchpad fix4/): replacements.json (5, keyed by id), new_electrical.json (10, ids
assigned here), polish.json (2, options+explanation only).
"""
import sys, os, json, re
sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRATCH = r'C:\Users\kayky\AppData\Local\Temp\claude\C--Users-kayky-Desktop-BRAINVSMATH\430ce4b2-f606-4068-8dd1-d6f36928abf0\scratchpad\fix4'
TARGET = os.path.join(ROOT, '421a.html')


def js(s):
    s = str(s).replace('\\', '\\\\').replace("'", "\\'")
    return s.replace('</script', '<\\/script').replace('\n', ' ').replace('\r', ' ')


def obj(q, qid):
    opts = ','.join("'" + js(o) + "'" for o in q['options'])
    return ("{id:%d,topic:'%s',topicLabel:'%s',diff:'%s',text:'%s',options:[%s],answer:%d,"
            "explanation:'%s',keyConcept:'%s'}") % (
        qid, q['topic'], js(q['topicLabel']), q['diff'], js(q['text']), opts,
        q['answer'], js(q['explanation']), js(q.get('keyConcept', '')))


def object_span(html, qid):
    m = re.search(r'(\{\s*\n?\s*id:\s*%d\s*,|\{id:%d,)' % (qid, qid), html)
    if not m:
        raise ValueError('id %d not found' % qid)
    start = m.start()
    i = start
    depth = 0
    quote = None
    while i < len(html):
        c = html[i]
        if quote:
            if c == '\\':
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in ('"', "'", '`'):
            quote = c
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1
    raise ValueError('unbalanced object for id %d' % qid)


def main():
    html = open(TARGET, encoding='utf-8').read()

    reps = json.load(open(os.path.join(SCRATCH, 'replacements.json'), encoding='utf-8'))
    for q in reps:
        s, e = object_span(html, q['id'])
        html = html[:s] + obj(q, q['id']) + html[e:]
    print('replaced:', sorted(q['id'] for q in reps))

    pol = json.load(open(os.path.join(SCRATCH, 'polish.json'), encoding='utf-8'))
    for p in pol:
        s, e = object_span(html, p['id'])
        seg = html[s:e]
        cur = re.search(r'answer\s*:\s*(\d)', seg)
        assert int(cur.group(1)) == p['answer'], 'answer mismatch id %d' % p['id']
        # options
        om = re.search(r'options\s*:\s*\[', seg)
        i = om.end() - 1
        depth = 0; quote = None
        while True:
            c = seg[i]
            if quote:
                if c == '\\': i += 2; continue
                if c == quote: quote = None
            elif c in ('"', "'"): quote = c
            elif c == '[': depth += 1
            elif c == ']':
                depth -= 1
                if depth == 0: break
            i += 1
        seg = seg[:om.end()-1] + '[' + ','.join("'"+js(o)+"'" for o in p['options']) + ']' + seg[i+1:]
        # explanation
        em = re.search(r'explanation\s*:\s*', seg)
        q0 = em.end()
        qc = seg[q0]
        j = q0 + 1
        while True:
            if seg[j] == '\\': j += 2; continue
            if seg[j] == qc: break
            j += 1
        seg = seg[:q0] + "'" + js(p['explanation']) + "'" + seg[j+1:]
        html = html[:s] + seg + html[e:]
    print('polished:', sorted(p['id'] for p in pol))

    news = json.load(open(os.path.join(SCRATCH, 'new_electrical.json'), encoding='utf-8'))
    max_id = max(int(m) for m in re.findall(r'\bid:\s*(\d+)\s*,', html))
    decl = html.find('const questions')
    m = re.search(r'\n\];', html[decl:])
    ins = decl + m.start()
    lines = []
    qid = max_id
    sources = []
    for q in news:
        qid += 1
        lines.append(obj(q, qid) + ',')
        sources.append((qid, q['topic'], q.get('source', '')))
    block = '\n// Fix 4 (2026-07-17): electrical coverage additions\n' + '\n'.join(lines)
    html = html[:ins] + block + html[ins:]
    print('appended electrical ids %d-%d' % (max_id + 1, qid))

    open(TARGET, 'w', encoding='utf-8').write(html)

    with open(os.path.join(ROOT, 'docs', 'question-sources-fix3.md'), 'a', encoding='utf-8') as f:
        f.write('\n## Fix 4 추가분 (2026-07-17)\n\n| id | topic | source |\n|---|---|---|\n')
        for q in reps:
            f.write('| %d(교체) | %s | %s |\n' % (q['id'], q['topic'], q.get('source', '')))
        for qid_, t, s in sources:
            f.write('| %d | %s | %s |\n' % (qid_, t, s))
    print('sources appended')


if __name__ == '__main__':
    main()
