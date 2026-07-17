# -*- coding: utf-8 -*-
"""W3 QC gate — deterministic quality metrics for quiz question banks.

Any session/model MUST run this before deploying question changes and get ALL PASS.
Encodes the Phase 7/8 quality standards so quality does not depend on which model runs it.

Checks per trade:
  1. answer-position balance  : max option share <= 35% (fail = position bias tell)
  2. longest-option tell      : correct/avg-distractor length ratio > 1.4 in <= 5% of questions
  3. option prefix integrity  : options[i] starts with 'A) '/'B) '/'C) '/'D) ' in order
  4. exact duplicate stems    : 0 identical question texts
  5. structure                : 4 options, valid answer index, non-empty explanation

Usage:  python scripts/qc_metrics.py            # all 11 trades
        python scripts/qc_metrics.py 421a 310t  # specific trades
Runs the page in real Chromium (post-shuffle state = what users/PDF see).
"""
import sys, os, json
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ALL = ['276a', '306a', '308a', '309a', '310s', '310t', '313a', '403a', '421a', '442a', '447a']

def check(qs):
    n = len(qs)
    dist = [0, 0, 0, 0]
    tell = 0
    prefix_bad = 0
    struct_bad = 0
    texts = {}
    for q in qs:
        opts = q.get('options', [])
        ans = q.get('answer', -1)
        if len(opts) != 4 or not (0 <= ans <= 3) or not q.get('explanation'):
            struct_bad += 1
            continue
        dist[ans] += 1
        for i, o in enumerate(opts):
            if not o.startswith('ABCD'[i] + ') '):
                prefix_bad += 1
                break
        lens = [len(o) for o in opts]
        d = [l for i, l in enumerate(lens) if i != ans]
        if lens[ans] / (sum(d) / 3) > 1.4:
            tell += 1
        texts.setdefault(q['text'].strip(), []).append(q['id'])
    dups = {t: ids for t, ids in texts.items() if len(ids) > 1}
    max_share = max(dist) / n if n else 1
    results = {
        'n': n,
        'answer_dist': dist,
        'balance': ('PASS' if max_share <= 0.35 else 'FAIL', f'max {max_share:.0%}'),
        'tell': ('PASS' if tell <= n * 0.05 else 'FAIL', f'{tell} over-ratio ({tell/n:.0%})'),
        'prefix': ('PASS' if prefix_bad == 0 else 'FAIL', f'{prefix_bad} bad'),
        'dups': ('PASS' if not dups else 'FAIL', f'{len(dups)} duplicate stems {list(dups.values())[:3]}'),
        'struct': ('PASS' if struct_bad == 0 else 'FAIL', f'{struct_bad} malformed'),
    }
    return results

def main():
    trades = sys.argv[1:] or ALL
    overall_fail = False
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page()
        print('| trade | n | A/B/C/D | balance | tell | prefix | dups | struct |')
        print('|---|---|---|---|---|---|---|---|')
        for t in trades:
            page.goto('file:///' + os.path.join(ROOT, t + '.html').replace('\\', '/'),
                      wait_until='load', timeout=30000)
            page.wait_for_timeout(500)
            qs = json.loads(page.evaluate('() => JSON.stringify(questions)'))
            r = check(qs)
            row_fail = any(v[0] == 'FAIL' for k, v in r.items() if isinstance(v, tuple))
            overall_fail |= row_fail
            print(f"| {t} | {r['n']} | {'/'.join(map(str, r['answer_dist']))} | "
                  f"{r['balance'][0]} {r['balance'][1]} | {r['tell'][0]} {r['tell'][1]} | "
                  f"{r['prefix'][0]} | {r['dups'][0]} {r['dups'][1] if r['dups'][0]=='FAIL' else ''} | {r['struct'][0]} |")
        b.close()
    print()
    print('RESULT:', 'FAIL — do not deploy' if overall_fail else 'ALL PASS')
    sys.exit(1 if overall_fail else 0)

if __name__ == '__main__':
    main()
