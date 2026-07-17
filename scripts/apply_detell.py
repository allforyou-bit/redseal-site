# -*- coding: utf-8 -*-
"""De-tell applier — patch options/explanation AND sync answer index (runtime-extract lesson).

Usage: python scripts/apply_detell.py 308a [more trades...]
Reads scratchpad detell/out_<trade>.json, patches <trade>.html per id.
"""
import sys, os, json, re
sys.stdout.reconfigure(encoding='utf-8')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
SCRATCH = r'C:\Users\kayky\AppData\Local\Temp\claude\C--Users-kayky-Desktop-BRAINVSMATH\430ce4b2-f606-4068-8dd1-d6f36928abf0\scratchpad\detell'


def js(s):
    s = str(s).replace('\\', '\\\\').replace("'", "\\'")
    return s.replace('</script', '<\\/script').replace('\n', ' ').replace('\r', ' ')


M32 = 0xFFFFFFFF


def _imul(a, b):
    r = (a & M32) * (b & M32) & M32
    return r - (1 << 32) if r >= (1 << 31) else r


def _i32(v):
    v &= M32
    return v - (1 << 32) if v >= (1 << 31) else v


def shuffle_perm(qid):
    """Replicates the page's mulberry32+Fisher-Yates: returns idx where runtime[pos]=source[idx[pos]]."""
    seed = _i32(0x5EA1 + (qid * 2654435761) % 2147483647)
    def rnd():
        nonlocal seed
        seed = _i32(seed + 0x6D2B79F5)
        t = _imul(seed ^ ((seed & M32) >> 15), 1 | seed)
        t = _i32(t + _imul(t ^ ((t & M32) >> 7), 61 | t)) ^ t
        return ((t ^ ((t & M32) >> 14)) & M32) / 4294967296
    idx = [0, 1, 2, 3]
    for i in (3, 2, 1):
        j = int(rnd() * (i + 1))
        idx[i], idx[j] = idx[j], idx[i]
    return idx


def invert_to_source(it):
    """Agent output is the RUNTIME arrangement; write back the source arrangement so the
    page's shuffle reproduces exactly what the agent validated (no double-shuffle skew)."""
    idx = shuffle_perm(it['id'])
    stripped = [re.sub(r'^[A-D]\)\s*', '', o) for o in it['options']]
    src_opts = [None] * 4
    for pos in range(4):
        src_opts[idx[pos]] = stripped[pos]
    src_opts = ['ABCD'[k] + ') ' + src_opts[k] for k in range(4)]
    src_ans = idx[it['answer']]
    return {'id': it['id'], 'options': src_opts, 'answer': src_ans,
            'explanation': it['explanation']}


def find_bracket_end(s, i):
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
    raise ValueError('unbalanced')


def find_string_end(s, i):
    q = s[i]
    i += 1
    while i < len(s):
        if s[i] == '\\':
            i += 2
            continue
        if s[i] == q:
            return i + 1
        i += 1
    raise ValueError('unterminated')


def patch(html, it):
    qid = it['id']
    m = re.search(r'(\{\s*\n?\s*id:\s*%d\s*,|\{id:%d,)' % (qid, qid), html)
    if not m:
        return html, 'NOT_FOUND'
    start = m.start()
    om = re.compile(r'options\s*:\s*\[').search(html, start)
    if not om or om.start() - start > 4000:
        return html, 'NO_OPTIONS'
    obr = om.end() - 1
    oend = find_bracket_end(html, obr)
    html = html[:obr] + '[' + ','.join("'" + js(o) + "'" for o in it['options']) + ']' + html[oend:]
    am = re.compile(r'answer\s*:\s*(\d)').search(html, start)
    if not am or am.start() - start > 6000:
        return html, 'NO_ANSWER'
    html = html[:am.start(1)] + str(it['answer']) + html[am.end(1):]
    em = re.compile(r'explanation\s*:\s*').search(html, start)
    if not em or em.start() - start > 8000:
        return html, 'NO_EXPL'
    eq = em.end()
    if html[eq] not in ('"', "'"):
        return html, 'EXPL_NOT_STRING'
    eend = find_string_end(html, eq)
    html = html[:eq] + "'" + js(it['explanation']) + "'" + html[eend:]
    return html, 'OK'


def main():
    for trade in sys.argv[1:]:
        items = json.load(open(os.path.join(SCRATCH, f'out_{trade}.json'), encoding='utf-8'))
        f = trade + '.html'
        html = open(f, encoding='utf-8').read()
        ok = 0
        fails = []
        for it in items:
            html, st = patch(html, invert_to_source(it))
            if st == 'OK':
                ok += 1
            else:
                fails.append((it['id'], st))
        open(f, 'w', encoding='utf-8').write(html)
        print(f'{trade}: {ok}/{len(items)} patched', ('FAILS: ' + str(fails)) if fails else '')
        if fails:
            sys.exit(1)


if __name__ == '__main__':
    main()
