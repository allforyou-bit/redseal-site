# -*- coding: utf-8 -*-
"""Trace browser-style script blocks and locate parse errors precisely."""
import io, re, sys, subprocess, tempfile, os
sys.stdout.reconfigure(encoding='utf-8')

ROOT = r'C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io'
t = sys.argv[1] if len(sys.argv) > 1 else '421a'
c = io.open(rf'{ROOT}\{t}.html', encoding='utf-8').read()

def line_of(i): return c.count('\n', 0, i) + 1

# browser tokenizer: script element ends at first literal </script
pos = 0
n = 0
while True:
    m = re.compile(r'<script([^>]*)>', re.I).search(c, pos)
    if not m: break
    attrs = m.group(1)
    start = m.end()
    end = c.find('</script', start)
    if end == -1:
        print(f'!! 블록 열림(줄{line_of(m.start())})인데 닫는 태그 없음 — 파일 끝까지 소비')
        break
    content = c[start:end]
    n += 1
    kind = 'src' if 'src=' in attrs else ('ldjson' if 'ld+json' in attrs else 'inline')
    status = ''
    if kind == 'inline' and content.strip():
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as tf:
            tf.write(content); tmp = tf.name
        r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
        os.unlink(tmp)
        if r.returncode != 0:
            err = [l for l in r.stderr.splitlines() if 'SyntaxError' in l]
            status = 'PARSE-FAIL: ' + (err[-1][:90] if err else '?')
        else:
            status = 'parse ok'
    print(f'블록{n} [{kind}] 줄{line_of(m.start())}~{line_of(end)} attrs="{attrs.strip()[:40]}" {status}')
    if 'PARSE-FAIL' in status:
        head = content.strip()[:100].replace(chr(10), '⏎')
        print(f'    내용 시작: {head}')
    pos = end + 1
