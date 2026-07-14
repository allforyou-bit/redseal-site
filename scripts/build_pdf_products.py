# -*- coding: utf-8 -*-
"""W2/W5 product pipeline — build lead-magnet & paid question-bank PDFs from a trade quiz page.

Extracts the live `questions` array via Playwright (real Chromium eval, no fragile regex),
renders a print-styled HTML, and prints to PDF with Chromium.

Outputs go OUTSIDE the public repo (paid content must never be committed):
  C:\\Users\\kayky\\Desktop\\RedSeal-Project\\PRODUCTS\\{trade}\\

Usage:
  python scripts/build_pdf_products.py 421a            # both PDFs
  python scripts/build_pdf_products.py 421a sample     # lead magnet only (50 Q)
  python scripts/build_pdf_products.py 421a full       # paid product only
"""
import sys, os, json, html, random
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

ROOT = r"C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io"
OUT_ROOT = r"C:\Users\kayky\Desktop\RedSeal-Project\PRODUCTS"
SITE = "https://allforyou-bit.github.io"  # regenerate PDFs after custom-domain migration

TRADE_NAMES = {
    '421a': '421A Heavy Equipment Technician', '310t': '310T Truck & Transport Mechanic',
    '309a': '309A Construction Electrician', '310s': '310S Automotive Service Technician',
    '308a': '308A Refrigeration & AC Mechanic', '276a': '276A Welder',
    '447a': '447A Plumber', '313a': '313A Industrial Electrician',
    '442a': '442A Ironworker', '403a': '403A Gas Fitter', '306a': '306A Sheet Metal Worker',
}
SAMPLE_N = 50
SEED = 20260711  # deterministic sample selection


def extract_questions(trade):
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page()
        page.goto('file:///' + os.path.join(ROOT, trade + '.html').replace('\\', '/'),
                  wait_until='load', timeout=30000)
        page.wait_for_timeout(800)
        data = page.evaluate("() => JSON.stringify(questions)")
        b.close()
    return json.loads(data)


def pick_sample(qs, n=SAMPLE_N):
    """Topic-proportional deterministic sample."""
    by_topic = {}
    for q in qs:
        by_topic.setdefault(q.get('topicLabel', q.get('topic', 'General')), []).append(q)
    total = len(qs)
    rng = random.Random(SEED)
    sample = []
    for topic, items in sorted(by_topic.items()):
        k = max(1, round(n * len(items) / total))
        sample += rng.sample(items, min(k, len(items)))
    rng.shuffle(sample)
    return sample[:n]


def esc(s):
    return html.escape(str(s), quote=False)


CSS = """
@page { size: Letter; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a2233; font-size: 10.5pt; line-height: 1.5; margin: 0; }
.cover { text-align: center; padding-top: 220px; page-break-after: always; }
.cover .brand { color: #b91c1c; font-weight: 800; letter-spacing: 2px; font-size: 12pt; }
.cover h1 { font-size: 26pt; margin: 18px 0 6px; }
.cover .sub { font-size: 13pt; color: #475569; }
.cover .meta { margin-top: 60px; color: #64748b; font-size: 9.5pt; }
h2.section { font-size: 15pt; border-bottom: 3px solid #b91c1c; padding-bottom: 4px; margin: 26px 0 12px; page-break-after: avoid; }
.topic-head { background: #f1f5f9; border-left: 4px solid #b91c1c; padding: 6px 10px; font-weight: 700; margin: 18px 0 8px; page-break-after: avoid; }
.q { margin: 0 0 12px; page-break-inside: avoid; }
.q .qt { font-weight: 600; }
.q .num { color: #b91c1c; font-weight: 800; }
.opts { margin: 4px 0 0 14px; padding: 0; list-style: none; }
.opts li { margin: 2px 0; }
.ans { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 6px 10px; margin: 6px 0 0 14px; font-size: 9.5pt; }
.ans .a { color: #15803d; font-weight: 700; }
.kc { color: #475569; font-size: 9pt; margin: 4px 0 0 14px; }
.key-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
.key-table td, .key-table th { border: 1px solid #cbd5e1; padding: 3px 8px; text-align: center; }
.guide p { margin: 6px 0; }
.cta { background: #fef2f2; border: 2px solid #b91c1c; border-radius: 8px; padding: 14px 18px; margin: 24px 0; page-break-inside: avoid; }
.cta h3 { margin: 0 0 6px; color: #b91c1c; }
.footer-note { color: #94a3b8; font-size: 8.5pt; margin-top: 30px; text-align: center; }
"""

LEGAL_PAGE = """
<div style="page-break-after: always; padding-top: 60px;">
<h2 class="section">About This Material</h2>
<div class="guide" style="font-size: 9.5pt; color: #475569;">
<p><strong>Independent, unofficial study resource.</strong> This publication is not affiliated with, endorsed by, or approved by the Canadian Council of Directors of Apprenticeship (CCDA), Employment and Social Development Canada, the Red Seal Program, Skilled Trades Ontario, or any provincial or territorial apprenticeship authority. &ldquo;Red Seal&rdquo; is used solely to describe the examination for which this material provides practice.</p>
<p><strong>Originality.</strong> All questions and explanations in this publication are original works created by the author. This material references only publicly available occupational standards (Red Seal Occupational Standard) for topic alignment and reproduces no content from any actual examination.</p>
<p><strong>No guarantee of results.</strong> This study material is provided for educational and informational purposes only. Success on any certification examination depends on many factors, and no representation is made that using this material will result in passing any exam. Exam content, structure, and weightings are set by certification authorities and may change without notice.</p>
<p><strong>Technical accuracy.</strong> Code values and technical specifications cited in explanations reflect commonly referenced Canadian standards at the time of writing. Always defer to the current edition of the applicable code or the manufacturer's documentation in real work.</p>
<p>&copy; 2026 the author. All rights reserved. For personal study use by the purchaser only &mdash; redistribution, resale, or file sharing is prohibited.</p>
</div>
</div>
"""

EXAM_DAY_GUIDE = """
<h2 class="section">Exam-Day Strategy Guide</h2>
<div class="guide">
<p><strong>Before the exam:</strong> The Red Seal exam is 100&ndash;150 multiple-choice questions, pass mark 70%. Book your seat early, bring government ID, and confirm whether your province allows a basic calculator. Sleep beats last-minute cramming &mdash; your recall drops measurably after a short night.</p>
<p><strong>Time budget:</strong> You get roughly 2&ndash;2.5 minutes per question. First pass: answer everything you know cold. Second pass: work the flagged ones. Never leave a blank &mdash; there is no penalty for guessing.</p>
<p><strong>Reading the question:</strong> Watch for absolutes (&ldquo;always&rdquo;, &ldquo;never&rdquo;), for &ldquo;EXCEPT&rdquo; and &ldquo;most likely&rdquo;, and for two answers that are both true &mdash; pick the one that answers <em>this</em> question. Canadian codes only: if a number looks like a US NEC/OSHA value, treat it with suspicion.</p>
<p><strong>Elimination:</strong> Cross out the one obviously wrong option first. Your odds go from 25% to 33% instantly; eliminate two and a coin flip becomes 50/50 in your favour.</p>
<p><strong>The night before:</strong> Review your wrong-answer bank and the Key Concept lines in this book &mdash; not new material.</p>
</div>
"""


def build_html(trade, qs, mode):
    name = TRADE_NAMES.get(trade, trade.upper())
    n = len(qs)
    title = (f"Free {n}-Question Mock Exam" if mode == 'sample'
             else f"Complete Question Bank &mdash; {n} Questions with Full Explanations")
    subtitle2 = "Practice for the Red Seal / Certificate of Qualification exam"
    parts = [f"<style>{CSS}</style>"]
    # Cover
    parts.append(f"""<div class="cover">
<div class="brand">RED SEAL EXAM PREP</div>
<h1>{name}</h1>
<div class="sub">{title}</div>
<div class="sub" style="font-size:10.5pt; margin-top:6px;">{subtitle2}</div>
<div class="meta">Pass mark: 70% &middot; Aligned to the published occupational standard topic weightings<br>{SITE} &middot; Edition 2026-07</div>
</div>""")
    parts.append(LEGAL_PAGE)

    if mode == 'sample':
        # Questions only, then answer key with explanations
        parts.append('<h2 class="section">Mock Exam &mdash; answer all questions, then check the key</h2>')
        for i, q in enumerate(qs, 1):
            opts = ''.join(f"<li>{esc(o)}</li>" for o in q['options'])
            parts.append(f'<div class="q"><div class="qt"><span class="num">Q{i}.</span> {esc(q["text"])}</div><ul class="opts">{opts}</ul></div>')
        parts.append('<h2 class="section" style="page-break-before:always">Answer Key &amp; Explanations</h2>')
        for i, q in enumerate(qs, 1):
            letter = 'ABCD'[q['answer']]
            expl = q.get('explanation', '')
            parts.append(f'<div class="q"><div class="qt"><span class="num">Q{i}.</span> <span class="a" style="color:#15803d">Answer: {letter}</span></div><div class="ans">{expl}</div></div>')
        parts.append(f"""<div class="cta"><h3>Scored under 70%?</h3>
<p>The real exam draws from a much wider pool. The <strong>{name} Complete Question Bank</strong> gives you every question on our platform with full explanations and key-concept summaries &mdash; built to close exactly the gaps this mock exposed.</p>
<p><strong>{SITE}</strong></p></div>""")
    else:
        # Full bank: grouped by topic, answer+explanation inline (study format)
        parts.append(EXAM_DAY_GUIDE)
        parts.append('<h2 class="section" style="page-break-before:always">Question Bank by Topic</h2>')
        by_topic = {}
        for q in qs:
            by_topic.setdefault(q.get('topicLabel', 'General'), []).append(q)
        i = 0
        for topic in sorted(by_topic):
            parts.append(f'<div class="topic-head">{esc(topic)} &mdash; {len(by_topic[topic])} questions</div>')
            for q in by_topic[topic]:
                i += 1
                letter = 'ABCD'[q['answer']]
                opts = ''.join(f"<li>{esc(o)}</li>" for o in q['options'])
                kc = f'<div class="kc"><strong>Key concept:</strong> {esc(q["keyConcept"])}</div>' if q.get('keyConcept') else ''
                diff = q.get('diff', '')
                parts.append(f"""<div class="q">
<div class="qt"><span class="num">Q{i}.</span> {esc(q['text'])} <span style="color:#94a3b8;font-size:8.5pt">[{diff}]</span></div>
<ul class="opts">{opts}</ul>
<div class="ans"><span class="a">Answer: {letter}</span> &mdash; {q.get('explanation','')}</div>
{kc}</div>""")
        # quick answer key table
        parts.append('<h2 class="section" style="page-break-before:always">Quick Answer Key</h2>')
        rows, cells = [], []
        flat = [q for topic in sorted(by_topic) for q in by_topic[topic]]
        for idx, q in enumerate(flat, 1):
            cells.append(f"<td><b>{idx}</b>: {'ABCD'[q['answer']]}</td>")
            if len(cells) == 10:
                rows.append('<tr>' + ''.join(cells) + '</tr>'); cells = []
        if cells:
            rows.append('<tr>' + ''.join(cells) + '</tr>')
        parts.append(f'<table class="key-table">{"".join(rows)}</table>')

    parts.append(f'<div class="footer-note">&copy; 2026 &middot; {SITE} &middot; For personal study use only. Independent, unofficial study resource &mdash; not affiliated with or endorsed by the CCDA, the Red Seal Program, or any apprenticeship authority. See "About This Material".</div>')
    return ''.join(parts)


def render_pdf(html_str, out_pdf):
    tmp = out_pdf.replace('.pdf', '.tmp.html')
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write(html_str)
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page()
        page.goto('file:///' + tmp.replace('\\', '/'), wait_until='load')
        page.pdf(path=out_pdf, format='Letter', print_background=True,
                 display_header_footer=True,
                 header_template='<span></span>',
                 footer_template='<div style="font-size:8px;color:#94a3b8;width:100%;text-align:center;">Red Seal Exam Prep — <span class="pageNumber"></span>/<span class="totalPages"></span></div>')
        b.close()
    os.remove(tmp)


def main():
    trade = sys.argv[1] if len(sys.argv) > 1 else '421a'
    mode = sys.argv[2] if len(sys.argv) > 2 else 'both'
    out_dir = os.path.join(OUT_ROOT, trade)
    os.makedirs(out_dir, exist_ok=True)
    qs = extract_questions(trade)
    print(f"{trade}: {len(qs)} questions extracted")
    if mode in ('sample', 'both'):
        sample = pick_sample(qs)
        out = os.path.join(out_dir, f"{trade}_free_50_question_mock_exam.pdf")
        render_pdf(build_html(trade, sample, 'sample'), out)
        print(f"  lead magnet -> {out} ({len(sample)} Q)")
    if mode in ('full', 'both'):
        out = os.path.join(out_dir, f"{trade}_complete_question_bank.pdf")
        render_pdf(build_html(trade, qs, 'full'), out)
        print(f"  paid product -> {out} ({len(qs)} Q)")


if __name__ == '__main__':
    main()
