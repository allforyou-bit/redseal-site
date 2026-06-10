# -*- coding: utf-8 -*-
"""Phase 1 full-site audit — READ ONLY, writes docs/audit.md only."""
import os, re, json, subprocess, tempfile

ROOT = r"C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io"
QUIZ_PAGES = ['276a','306a','308a','309a','310s','310t','313a','403a','421a','442a','447a']
STANDARD_TRADES = [
    ('276a','276A'),('306a','306A'),('308a','308A'),('309a','309A'),
    ('310s','310S'),('310t','310T'),('313a','313A'),('403a','403A'),
    ('421a','421A'),('442a','442A'),('447a','447A'),
]

findings = []  # (file, category, severity, detail)

def add(f, cat, sev, detail):
    findings.append((f, cat, sev, detail))

html_files = sorted(f for f in os.listdir(ROOT) if f.endswith('.html'))

def read(fn):
    with open(os.path.join(ROOT, fn), encoding='utf-8') as fh:
        return fh.read()

# ── 1. NAV AUDIT ─────────────────────────────────────────────
def extract_nav(c):
    m = re.search(r'<nav[\s>].*?</nav>', c, re.S)
    return m.group(0) if m else None

def dropdown_links(nav):
    m = re.search(r'nav-drop-menu.*?</div>', nav, re.S)
    if not m: return None
    return re.findall(r'<a href="([^"]+)"[^>]*>(.*?)</a>', m.group(0))

std_nav = extract_nav(read('index.html'))
std_dd = dropdown_links(std_nav)
std_dd_hrefs = [h for h, _ in std_dd]

nav_report = {}
for fn in html_files:
    c = read(fn)
    nav = extract_nav(c)
    if not nav:
        add(fn, 'NAV', 'HIGH', 'nav 블록 없음')
        nav_report[fn] = 'MISSING'
        continue
    dd = dropdown_links(nav)
    issues = []
    if dd is None:
        issues.append('드롭다운 없음')
    else:
        hrefs = [h for h, _ in dd]
        # normalize hrefs (strip leading / and .html variations)
        def norm(h): return h.lstrip('/').replace('.html','').lower()
        nh = [norm(h) for h in hrefs]
        std_nh = [norm(h) for h in std_dd_hrefs]
        dupes = sorted(set(x for x in nh if nh.count(x) > 1))
        missing = [x for x in std_nh if x not in nh]
        extra = [x for x in nh if x not in std_nh]
        if dupes: issues.append(f'중복: {",".join(dupes)}')
        if missing: issues.append(f'누락: {",".join(missing)}')
        if extra: issues.append(f'표준외 항목: {",".join(extra)}')
        if not dupes and not missing and not extra and nh != std_nh:
            issues.append('순서 다름')
    # top-level link comparison
    def top_links(n):
        body = re.sub(r'<div class="nav-drop-menu".*?</div>', '', n, flags=re.S)
        return re.findall(r'<a href="([^"]+)"[^>]*>', body)
    if top_links(nav) != top_links(std_nav):
        issues.append('상단 링크 구성 다름')
    if issues:
        sev = 'HIGH' if any('중복' in i or '누락' in i or '없음' in i for i in issues) else 'MED'
        add(fn, 'NAV', sev, ' / '.join(issues))
        nav_report[fn] = issues
    else:
        nav_report[fn] = 'OK'

# ── 2. HERO AUDIT ────────────────────────────────────────────
hero_report = {}
for fn in html_files:
    c = read(fn)
    has_hero_class = re.search(r'class="[^"]*\bhero\b[^"]*"', c)
    # h1 inside first 40% of file
    h1s = re.findall(r'<h1[^>]*>(.*?)</h1>', c, re.S)
    issues = []
    if not has_hero_class:
        issues.append('hero 클래스 섹션 없음')
    if not h1s:
        issues.append('h1 없음')
    elif len(h1s) > 1:
        issues.append(f'h1 {len(h1s)}개 (중복)')
    if has_hero_class:
        m = re.search(r'<(section|div|header)[^>]*class="[^"]*\bhero\b[^"]*"[^>]*>(.*?)</\1>', c, re.S)
        if m:
            inner = m.group(2)
            if not re.search(r'<p[\s>]', inner):
                issues.append('hero에 설명문(p) 없음')
            emoji = re.findall(r'[\U0001F000-\U0001FAFF☀-➿]', inner)
            if emoji:
                issues.append(f'hero 이모지 {len(emoji)}개')
    if issues:
        add(fn, 'HERO', 'MED' if '없음' in ' '.join(issues) else 'LOW', ' / '.join(issues))
        hero_report[fn] = issues
    else:
        hero_report[fn] = 'OK'

# ── 3. QUIZ JS AUDIT ─────────────────────────────────────────
quiz_report = {}
node_results = {}
for t in QUIZ_PAGES:
    fn = t + '.html'
    c = read(fn)
    issues = []
    # TOPIC_DEFS
    td_m = re.search(r'const TOPIC_DEFS\w*\s*=\s*\[(.*?)\];', c, re.S)
    topic_keys = []
    if not td_m:
        issues.append('TOPIC_DEFS 없음')
    else:
        topic_keys = re.findall(r"key:'([^']+)'", td_m.group(1))
        if len(topic_keys) != len(set(topic_keys)):
            issues.append('TOPIC_DEFS key 중복')
    # questions array (formats vary: compact / spaced)
    q_m = re.search(r'const questions\s*=\s*\[', c)
    QPAT = r'\{\s*id\s*:\s*(\d+)\s*,\s*topic\s*:\s*\'([^\']+)\''
    qmatches = re.findall(QPAT, c)
    qcount = len(qmatches)
    if not q_m:
        issues.append('questions 배열 없음')
    if qcount == 0:
        issues.append('질문 데이터 0개')
    # question topics vs TOPIC_DEFS
    qtopics = set(t for _, t in qmatches)
    if topic_keys:
        orphan = qtopics - set(topic_keys)
        unused = set(topic_keys) - qtopics
        if orphan: issues.append(f'TOPIC_DEFS에 없는 topic 사용: {",".join(sorted(orphan))}')
        if unused: issues.append(f'질문 0개인 topic: {",".join(sorted(unused))}')
    # duplicate question ids
    ids = [int(i) for i, _ in qmatches]
    if len(ids) != len(set(ids)):
        issues.append(f'질문 id 중복 ({len(ids)-len(set(ids))}건)')
    # click binding
    if not re.search(r'selectAnswer|checkAnswer', c):
        issues.append('답변 클릭 핸들러(selectAnswer) 없음')
    if not re.search(r'onclick=|addEventListener', c):
        issues.append('클릭 이벤트 바인딩 전혀 없음')
    # mock exam
    if not re.search(r'buildMockQs|startMock|openMockLaunch', c):
        issues.append('Mock Exam 함수 없음')
    # JS syntax check via node on each <script> block (skip src= externals and JSON-LD)
    # NOTE: regex split on </script> mirrors browser behavior — a literal </script>
    # inside a JS string ALSO terminates the script element in real browsers.
    syntax_errs = []
    quiz_block_dead = False
    for sm in re.finditer(r'<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>(.*?)</script>', c, re.S):
        s = sm.group(1)
        if not s.strip(): continue
        i = len(syntax_errs)
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as tf:
            tf.write(s); tmp = tf.name
        r = subprocess.run(['node', '--check', tmp], capture_output=True, text=True)
        os.unlink(tmp)
        if r.returncode != 0:
            first = (r.stderr.strip().splitlines() or ['?'])
            errline = next((l for l in first if 'Error' in l), first[-1])
            # premature termination check: does content right after </script> look like JS?
            tail_pos = sm.end()
            gap = c[tail_pos:tail_pos + 3000]
            truncated = bool(re.search(r'(function\s+\w+\(|localStorage|document\.getElementById|w\.document\.write)', gap))
            has_questions = 'const questions' in s
            if has_questions: quiz_block_dead = True
            tag = []
            if truncated: tag.append('문자열 내 </script>로 조기종료(브라우저 동일)')
            if has_questions: tag.append('questions 포함 블록→퀴즈 전체 사망')
            syntax_errs.append(f'{errline[:90]}{" [" + ", ".join(tag) + "]" if tag else ""}')
    if syntax_errs:
        issues.append('JS 파싱 실패 — ' + ' | '.join(syntax_errs))
    if quiz_block_dead:
        issues.append('★퀴즈 비작동 확정 (questions 블록 파싱 실패)')
    node_results[t] = len(syntax_errs)
    quiz_report[t] = {'questions': qcount, 'topics': len(topic_keys), 'issues': issues}
    if issues:
        sev = 'HIGH' if any(k in ' '.join(issues) for k in ['문법 오류','없음','0개']) else 'MED'
        add(fn, 'QUIZ', sev, ' / '.join(issues))

# ── 4. NUMBERS AUDIT ─────────────────────────────────────────
total_q = sum(v['questions'] for v in quiz_report.values())
n_trades = len(QUIZ_PAGES)
num_issues = []
for fn in html_files:
    c = read(fn)
    # claimed totals like "1,210+" "1,560" near 'question'
    for m in re.finditer(r'([\d,]{3,6})\+?\s*(?:practice\s+)?[Qq]uestions', c):
        val = int(m.group(1).replace(',', ''))
        if 500 < val < 5000 and val not in (total_q,):
            add(fn, 'NUMBERS', 'MED', f'표기 질문 수 {m.group(1)} ≠ 실제 {total_q}')
            break
    for m in re.finditer(r'(\d{1,2})\s*(?:Red Seal\s*)?[Tt]rades', c):
        v = int(m.group(1))
        if 3 <= v <= 20 and v != n_trades:
            add(fn, 'NUMBERS', 'MED', f'표기 트레이드 수 {v} ≠ 실제 {n_trades}')
            break

# per-quiz-page claimed count vs actual
for t in QUIZ_PAGES:
    c = read(t + '.html')
    actual = quiz_report[t]['questions']
    claims = set()
    for m in re.finditer(r'(\d{2,4})\+?\s*(?:practice\s+|free\s+)?[Qq]uestions', c):
        v = int(m.group(1))
        if 30 <= v <= 1000:
            claims.add(v)
    wrong = [v for v in claims if abs(v - actual) > 5 and v != actual]
    if wrong:
        add(t + '.html', 'NUMBERS', 'MED', f'페이지 내 표기 {sorted(claims)} vs 실제 {actual}문항')

# ── WRITE audit.md ───────────────────────────────────────────
sev_order = {'HIGH': 0, 'MED': 1, 'LOW': 2}
findings.sort(key=lambda x: (sev_order[x[2]], x[0]))

lines = ['# Site Audit — Phase 1 (2026-06-10)', '',
         f'- 검사 파일: {len(html_files)} HTML / 퀴즈 페이지: {len(QUIZ_PAGES)}',
         f'- 실제 총 질문 수: **{total_q}** / 실제 트레이드 수: **{n_trades}**',
         f'- 발견 문제: {len(findings)}건 (HIGH {sum(1 for f in findings if f[2]=="HIGH")}, MED {sum(1 for f in findings if f[2]=="MED")}, LOW {sum(1 for f in findings if f[2]=="LOW")})',
         '', '## 퀴즈 페이지 현황', '',
         '| 페이지 | 질문 수 | 토픽 수 | JS문법오류 | 문제 |', '|---|---|---|---|---|']
for t in QUIZ_PAGES:
    r = quiz_report[t]
    lines.append(f"| {t}.html | {r['questions']} | {r['topics']} | {node_results[t]} | {'; '.join(r['issues']) if r['issues'] else '✅'} |")

lines += ['', '## 전체 문제 목록', '', '| 파일명 | 문제 유형 | 심각도 | 상세 |', '|---|---|---|---|']
for f, cat, sev, d in findings:
    lines.append(f'| {f} | {cat} | {sev} | {d} |')

lines += ['', '## 네비 정상 파일 수',
          f'- OK: {sum(1 for v in nav_report.values() if v=="OK")} / 문제: {sum(1 for v in nav_report.values() if v!="OK")}',
          '', '## Hero 정상 파일 수',
          f'- OK: {sum(1 for v in hero_report.values() if v=="OK")} / 문제: {sum(1 for v in hero_report.values() if v!="OK")}']

with open(os.path.join(ROOT, 'docs', 'audit.md'), 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(lines))

print(f'TOTAL_Q={total_q} TRADES={n_trades} FINDINGS={len(findings)}')
print(f'NAV issues: {sum(1 for v in nav_report.values() if v!="OK")}/{len(html_files)}')
print(f'HERO issues: {sum(1 for v in hero_report.values() if v!="OK")}/{len(html_files)}')
for t in QUIZ_PAGES:
    r = quiz_report[t]
    print(f"{t}: q={r['questions']} syntaxErr={node_results[t]} issues={len(r['issues'])}")
