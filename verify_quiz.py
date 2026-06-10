# -*- coding: utf-8 -*-
"""Phase 1.5 quiz verification — real Chromium rendering via Playwright.

Per page (file://):
  1. pageerror count must be 0
  2. question area shows real text (not "Loading...")
  3. questions array length via JS evaluation
  4. click first answer option -> explanation element becomes visible
  5. click Mock Exam button -> modal opens
Usage: python verify_quiz.py [pages...]   (default: all 11)
"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

ROOT = r"C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io"
ALL = ['276a','306a','308a','309a','310s','310t','313a','403a','421a','442a','447a']

def check_page(page, trade):
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e).splitlines()[0][:90]))
    page.goto('file:///' + os.path.join(ROOT, trade + '.html').replace('\\', '/'),
              wait_until='load', timeout=30000)
    page.wait_for_timeout(1200)  # let init JS run

    r = {'errors': errors}

    # 2. question text rendered
    qtext = page.evaluate("""() => {
        const el = document.getElementById('questionCard') || document.querySelector('.question-card');
        return el ? el.innerText.trim() : '';
    }""")
    r['q_rendered'] = len(qtext) > 20 and 'Loading' not in qtext

    # 3. questions array length
    r['q_len'] = page.evaluate(
        "() => { try { return questions.length; } catch(e) { return -1; } }")

    # 4. click first option -> explanation visible
    r['click_ok'] = page.evaluate("""() => {
        const opt = document.querySelector("[onclick*='selectAnswer']")
                 || document.querySelector('#optionsContainer button, #optionsContainer [onclick]')
                 || document.querySelector('#questionCard .option, #questionCard button.opt');
        if (!opt) return false;
        opt.click();
        const ex = document.getElementById('explanation') || document.getElementById('explanationBox')
                || document.querySelector('.explanation.show') || document.querySelector('#questionCard .explanation');
        if (!ex) return false;
        const vis = ex.offsetParent !== null && getComputedStyle(ex).display !== 'none';
        return vis && ex.innerText.trim().length > 10;
    }""")

    # 5. mock button -> modal opens
    r['mock_ok'] = page.evaluate("""() => {
        const btn = document.querySelector("[onclick*='openMockSetup'],[onclick*='openMockLaunch']")
                 || document.querySelector("[onclick*='startMockExam']");
        if (!btn) return false;
        btn.click();
        return ['mockOverlay', 'mockLaunch'].some(id => {
            const el = document.getElementById(id);
            if (!el) return false;
            const st = getComputedStyle(el);
            return st.display !== 'none' && st.visibility !== 'hidden';
        });
    }""")

    page.wait_for_timeout(300)
    r['err_n'] = len(errors)
    return r

def main():
    targets = sys.argv[1:] or ALL
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for t in targets:
            ctx = browser.new_context()
            # block external network -> deterministic, local-only test
            ctx.route('http://**', lambda route: route.abort())
            ctx.route('https://**', lambda route: route.abort())
            page = ctx.new_page()
            try:
                results[t] = check_page(page, t)
            except Exception as e:
                results[t] = {'errors': [f'CRASH: {e}'], 'err_n': 1,
                              'q_rendered': False, 'q_len': -1,
                              'click_ok': False, 'mock_ok': False}
            ctx.close()
        browser.close()

    total = 0
    print()
    print('| 파일 | JS에러 0건 | 질문 표시 | questions 개수 | 보기 클릭 | Mock 작동 |')
    print('|---|---|---|---|---|---|')
    all_pass = True
    for t in targets:
        r = results[t]
        ok_err = r['err_n'] == 0
        qn = r['q_len']
        total += max(qn, 0)
        row_pass = ok_err and r['q_rendered'] and qn > 0 and r['click_ok'] and r['mock_ok']
        all_pass = all_pass and row_pass
        print(f"| {t}.html | {'✅' if ok_err else '❌ ' + str(r['err_n']) + '건'} "
              f"| {'✅' if r['q_rendered'] else '❌'} | {qn} "
              f"| {'✅' if r['click_ok'] else '❌'} | {'✅' if r['mock_ok'] else '❌'} |")
        for e in r['errors'][:3]:
            print(f'    !! {e}')
    print()
    print(f'questions 합계: {total}' + (' (전체 11개 기준 목표 1560)' if len(targets) == 11 else ''))
    print('RESULT:', 'ALL PASS' if all_pass else 'FAIL')

if __name__ == '__main__':
    main()
