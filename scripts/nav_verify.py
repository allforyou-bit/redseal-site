# -*- coding: utf-8 -*-
"""Phase 2 — Playwright nav verification: link count/order vs index.html standard."""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

ROOT = r'C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io'

GRAB = """() => {
  const nav = [...document.querySelectorAll('nav')].find(n => !n.getAttribute('aria-label'));
  if (!nav) return null;
  const top = [...nav.querySelectorAll('.nav-links > a')].map(a => a.getAttribute('href'));
  const dd  = [...nav.querySelectorAll('.nav-drop-menu a')].map(a => a.getAttribute('href'));
  const st  = getComputedStyle(nav);
  return {top, dd, css: [st.backgroundColor, st.position, st.display].join('|'),
          navCount: [...document.querySelectorAll('nav')].filter(n => !n.getAttribute('aria-label')).length};
}"""

def grab(page, name):
    page.goto('file:///' + os.path.join(ROOT, name + '.html').replace('\\', '/'), wait_until='load')
    page.wait_for_timeout(400)
    return page.evaluate(GRAB)

def main():
    targets = sys.argv[1:]
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 1280, 'height': 900})
        ctx.route('http://**', lambda r: r.abort())
        ctx.route('https://**', lambda r: r.abort())
        page = ctx.new_page()
        std = grab(page, 'index')
        print(f"표준(index): 상단링크 {len(std['top'])}개 / 드롭다운 {len(std['dd'])}개 / CSS {std['css']}")
        print()
        print('| 파일 | nav 1개 | 상단링크 | 드롭다운 11개 | 순서 일치 | CSS 일치 |')
        print('|---|---|---|---|---|---|')
        ok_all = True
        for t in targets:
            r = grab(page, t)
            if not r:
                print(f'| {t}.html | ❌ nav 없음 | - | - | - | - |'); ok_all = False; continue
            one = r['navCount'] == 1
            top_ok = r['top'] == std['top']
            dd_ok = r['dd'] == std['dd']
            css_ok = r['css'] == std['css']
            ok = one and top_ok and dd_ok and css_ok
            ok_all = ok_all and ok
            print(f"| {t}.html | {'✅' if one else '❌ ' + str(r['navCount'])} "
                  f"| {'✅ ' + str(len(r['top'])) if top_ok else '❌ ' + str(r['top'])} "
                  f"| {'✅' if dd_ok and len(r['dd']) == 11 else '❌ ' + str(len(r['dd'])) + '개 ' + str(r['dd'])} "
                  f"| {'✅' if top_ok and dd_ok else '❌'} | {'✅' if css_ok else '❌ ' + r['css']} |")
        b.close()
        print()
        print('RESULT:', 'ALL PASS' if ok_all else 'FAIL')

if __name__ == '__main__':
    main()
