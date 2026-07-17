# -*- coding: utf-8 -*-
"""P0 one-off: trade-code remediation migration (docs/P0-trade-code-remediation-plan.md).

1. Move quiz-page content along the swap chain (via in-memory temps)
2. Single-pass simultaneous replacement of display codes + trade-home hrefs across all HTML + sitemap
3. Write redirect stubs for retired URLs (276a/403a/447a)
4. Sitemap lastmod bump
"""
import sys, os, re, glob
sys.stdout.reconfigure(encoding='utf-8')
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 1 — file moves (source -> destination), read all sources first (chain-safe)
MOVES = [
    ('447a.html', '306a.html'),   # Plumber
    ('306a.html', '308a.html'),   # Sheet Metal Worker
    ('308a.html', '313a.html'),   # Refrigeration & AC
    ('313a.html', '442a.html'),   # Industrial Electrician
    ('442a.html', '420b.html'),   # Ironworker (Generalist) - new URL
    ('276a.html', '456a.html'),   # Welder - new URL
    ('403a.html', 'gasfitter-class-a.html'),  # Gasfitter Class A - new URL
]
srcs = {s: open(s, encoding='utf-8').read() for s, d in MOVES}
for s, d in MOVES:
    open(d, 'w', encoding='utf-8').write(srcs[s])
print('moved:', ', '.join(f'{s}->{d}' for s, d in MOVES))

# 2 — global single-pass replacement (longest-first alternation; leftmost-first-alternative)
MAP = [
    ('/447a.html', '/306a.html'),
    ('/306a.html', '/308a.html'),
    ('/308a.html', '/313a.html'),
    ('/313a.html', '/442a.html'),
    ('/442a.html', '/420b.html'),
    ('/276a.html', '/456a.html'),
    ('/403a.html', '/gasfitter-class-a.html'),
    ('403A Gas Fitter (Class A)', 'Gasfitter (Class A)'),
    ('403A Gas Fitter', 'Gasfitter (Class A)'),
    ('Red Seal 403A', 'Red Seal Gasfitter (Class A)'),
    ('403A', 'Gasfitter Class A'),
    ('447A', '306A'),
    ('306A', '308A'),
    ('308A', '313A'),
    ('313A', '442A'),
    ('442A', '420B'),
    ('276A', '456A'),
    ('421A Heavy Equipment Tech', '421A Heavy Duty Equipment Tech'),
    ('Heavy Equipment Technician', 'Heavy Duty Equipment Technician'),
]
pat = re.compile('|'.join(re.escape(a) for a, b in MAP))
lut = dict(MAP)

targets = sorted(glob.glob('*.html')) + ['sitemap.xml']
tot_files = tot_hits = 0
for f in targets:
    t = open(f, encoding='utf-8').read()
    t2, n = pat.subn(lambda m: lut[m.group(0)], t)
    if n:
        open(f, 'w', encoding='utf-8').write(t2)
        tot_files += 1
        tot_hits += n
print(f'global pass: {tot_files} files, {tot_hits} replacements')

# 3 — redirect stubs for retired URLs
STUB = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>{title} — page moved</title>
<meta name="robots" content="noindex, follow">
<link rel="canonical" href="https://redsealquiz.ca{target}">
<meta http-equiv="refresh" content="0; url={target}">
</head>
<body style="font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:60px 20px">
<p>This page has moved to reflect the correct trade code.</p>
<p><a href="{target}">Continue to {title} &rarr;</a></p>
</body>
</html>
'''
STUBS = [
    ('447a.html', '/306a.html', '306A Plumber practice exam'),
    ('276a.html', '/456a.html', '456A Welder practice exam'),
    ('403a.html', '/gasfitter-class-a.html', 'Gasfitter (Class A) practice exam'),
]
for f, target, title in STUBS:
    open(f, 'w', encoding='utf-8').write(STUB.format(target=target, title=title))
print('stubs written:', ', '.join(f for f, _, _ in STUBS))

# 4 — sitemap: drop stub URLs if still present, bump all lastmod
s = open('sitemap.xml', encoding='utf-8').read()
for stub_url in ['https://redsealquiz.ca/447a.html', 'https://redsealquiz.ca/276a.html',
                 'https://redsealquiz.ca/403a.html']:
    s = re.sub(r'\s*<url>\s*<loc>' + re.escape(stub_url) + r'</loc>.*?</url>', '', s, flags=re.S)
s, k = re.subn(r'<lastmod>[0-9-]+</lastmod>', '<lastmod>2026-07-17</lastmod>', s)
open('sitemap.xml', 'w', encoding='utf-8').write(s)
print(f'sitemap: lastmod bumped x{k}')
print('DONE')
