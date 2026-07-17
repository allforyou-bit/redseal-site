# -*- coding: utf-8 -*-
"""Fix 2 applier — patch de-telled options/explanations into 421a.html.

Reads scratchpad fix2/out_chunk*.json (id, answer, options[4], explanation),
locates each question object in the raw HTML, and replaces the options array and
explanation string using escape-aware scanning (no fragile full-object regex).
"""
import sys, os, json, re, glob
sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCRATCH = r'C:\Users\kayky\AppData\Local\Temp\claude\C--Users-kayky-Desktop-BRAINVSMATH\430ce4b2-f606-4068-8dd1-d6f36928abf0\scratchpad\fix2'
TARGET = os.path.join(ROOT, '421a.html')


def js_escape(s):
    s = s.replace('\\', '\\\\').replace("'", "\\'")
    s = s.replace('</script', '<\\/script')
    s = s.replace('\n', ' ').replace('\r', ' ')
    return s


def find_matching_bracket(s, i):
    """i points at '['. Return index just after matching ']' (escape/quote aware)."""
    depth = 0
    quote = None
    while i < len(s):
        c = s[i]
        if quote:
            if c == '\\':
                i += 2
                continue
            if c == quote:
                quote = None
        elif c in ('"', "'", '`'):
            quote = c
        elif c == '[':
            depth += 1
        elif c == ']':
            depth -= 1
            if depth == 0:
                return i + 1
        i += 1
    raise ValueError('unbalanced bracket')


def find_string_end(s, i):
    """i points at opening quote. Return index just after closing quote."""
    q = s[i]
    i += 1
    while i < len(s):
        if s[i] == '\\':
            i += 2
            continue
        if s[i] == q:
            return i + 1
        i += 1
    raise ValueError('unterminated string')


def patch(html, item):
    qid = item['id']
    m = re.search(r'\{\s*\n?\s*id:\s*%d\s*,' % qid, html)
    if not m:
        m = re.search(r'\{id:%d,' % qid, html)
    if not m:
        return html, 'NOT_FOUND'
    start = m.start()
    # options array
    om = re.compile(r'options\s*:\s*\[').search(html, start)
    if not om or om.start() - start > 4000:
        return html, 'NO_OPTIONS'
    obr = om.end() - 1
    oend = find_matching_bracket(html, obr)
    new_opts = '[' + ','.join("'" + js_escape(o) + "'" for o in item['options']) + ']'
    html = html[:obr] + new_opts + html[oend:]
    # explanation string (re-search from start since offsets shifted)
    em = re.compile(r'explanation\s*:\s*').search(html, start)
    if not em or em.start() - start > 6000:
        return html, 'NO_EXPL'
    eq = em.end()
    if html[eq] not in ('"', "'"):
        return html, 'EXPL_NOT_STRING'
    eend = find_string_end(html, eq)
    html = html[:eq] + "'" + js_escape(item['explanation']) + "'" + html[eend:]
    return html, 'OK'


def main():
    items = []
    for f in sorted(glob.glob(os.path.join(SCRATCH, 'out_chunk*.json'))):
        items += json.load(open(f, encoding='utf-8'))
    print('loaded', len(items), 'revised questions')
    html = open(TARGET, encoding='utf-8').read()
    # sanity: verify answer index unchanged by comparing against live values later (qc gate)
    ok = fail = 0
    failures = []
    for it in items:
        html, status = patch(html, it)
        if status == 'OK':
            ok += 1
        else:
            fail += 1
            failures.append((it['id'], status))
    open(TARGET, 'w', encoding='utf-8').write(html)
    print(f'patched OK: {ok}, failed: {fail}')
    if failures:
        print('failures:', failures)
    sys.exit(1 if fail else 0)


if __name__ == '__main__':
    main()
