# -*- coding: utf-8 -*-
"""W6 weekly ops report — deterministic site health check + Telegram.

Run weekly (Wednesday, HQ reporting rhythm) by the scheduled session or manually:
    python scripts/weekly_report.py
Checks are pure-stdlib+curl so any session/model gets identical results.
"""
import subprocess, sys, re, os, datetime
sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
SITE = 'https://redsealquiz.ca'
KEY_PAGES = ['/', '/421a.html', '/309a.html', '/practice-quizzes.html', '/red-seal-trades.html']

def curl_status(url):
    try:
        out = subprocess.run(['curl', '-sI', '--max-time', '20', url],
                             capture_output=True, text=True, timeout=30).stdout
        m = re.search(r'HTTP/[\d.]+\s+(\d+)', out)
        return m.group(1) if m else 'ERR'
    except Exception:
        return 'ERR'

lines = [f"주간 헬스체크 {datetime.date.today().isoformat()}"]
fails = 0

# 1. page availability
for p in KEY_PAGES:
    code = curl_status(SITE + p)
    ok = code == '200'
    fails += 0 if ok else 1
    lines.append(f"{'✅' if ok else '⚠️'} {p} → {code}")

# 2. old-domain redirect
code = curl_status('https://allforyou-bit.github.io/')
lines.append(f"{'✅' if code == '301' else '⚠️'} github.io 301 redirect → {code}")
fails += 0 if code == '301' else 1

# 3. sitemap URL count
try:
    sm = open('sitemap.xml', encoding='utf-8').read()
    n = sm.count('<loc>')
    stale = sm.count('allforyou-bit.github.io')
    lines.append(f"✅ sitemap {n} URLs" + (f" ⚠️ 구도메인 잔존 {stale}" if stale else ''))
    fails += 1 if stale else 0
except Exception as e:
    lines.append(f"⚠️ sitemap read fail: {e}")
    fails += 1

# 4. git recency
try:
    last = subprocess.run(['git', 'log', '-1', '--format=%ci %s'], capture_output=True,
                          text=True).stdout.strip()[:60]
    lines.append(f"ℹ️ last commit: {last}")
except Exception:
    pass

lines.append(f"판정: {'⚠️ ' + str(fails) + '건 이상 — 조치 필요' if fails else '✅ 전 항목 정상'}")
report = '\n'.join(lines)
print(report)

# Telegram (best effort)
try:
    sys.path.insert(0, os.path.join(ROOT, 'scripts'))
    from notify_telegram import notify
    notify('W6 주간 헬스체크', 'weekly_report.py', '-', report)
except Exception as e:
    print(f'[telegram fail: {e}]')

sys.exit(1 if fails else 0)
