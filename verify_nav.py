# -*- coding: utf-8 -*-
"""Phase 2 — nav visual verification (Playwright, 1920x1080).

Per page:
  1. nav container + all menu item getBoundingClientRect vs index.html standard
  2. max deviation in px reported per page
  3. top strip screenshot (0,0~1920x200) -> docs/screenshots/<page>.png
Usage: python verify_nav.py 306a 404 421a ...
"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

ROOT = r'C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io'
SHOTS = os.path.join(ROOT, 'docs', 'screenshots')
os.makedirs(SHOTS, exist_ok=True)

GRAB = """() => {
  const nav = [...document.querySelectorAll('nav')].find(n => !n.getAttribute('aria-label'));
  if (!nav) return null;
  const rect = el => { const r = el.getBoundingClientRect();
                       return [r.x, r.y, r.width, r.height].map(v => Math.round(v * 10) / 10); };
  const items = [['nav', rect(nav)]];
  const brand = nav.querySelector('.nav-brand');
  if (brand) items.push(['brand', rect(brand)]);
  [...nav.querySelectorAll('.nav-links > a, .nav-links > .nav-dropdown > .nav-drop-btn')]
    .forEach((el, i) => items.push([el.textContent.trim().slice(0, 12), rect(el)]));
  return items;
}"""

def grab(page, name):
    page.goto('file:///' + os.path.join(ROOT, name + '.html').replace('\\', '/'),
              wait_until='load')
    page.wait_for_timeout(400)
    return page.evaluate(GRAB)

def main():
    targets = sys.argv[1:]
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 1920, 'height': 1080})
        ctx.route('http://**', lambda r: r.abort())
        ctx.route('https://**', lambda r: r.abort())
        page = ctx.new_page()

        std = grab(page, 'index')
        page.screenshot(path=os.path.join(SHOTS, 'index-standard.png'),
                        clip={'x': 0, 'y': 0, 'width': 1920, 'height': 200})
        std_map = dict(std)
        print(f'표준(index): nav 항목 {len(std)}개 — {[k for k, _ in std]}')
        print()
        print('| 페이지 | 항목 수 | 표준과 편차 px | 판정 |')
        print('|---|---|---|---|')
        all_pass = True
        for t in targets:
            r = grab(page, t)
            page.screenshot(path=os.path.join(SHOTS, f'{t}.png'),
                            clip={'x': 0, 'y': 0, 'width': 1920, 'height': 200})
            if not r:
                print(f'| {t}.html | nav 없음 | - | ❌ |'); all_pass = False; continue
            r_map = dict(r)
            if set(r_map) != set(std_map):
                print(f'| {t}.html | {len(r)} (구성 다름: {sorted(set(r_map) ^ set(std_map))}) | - | ❌ |')
                all_pass = False; continue
            dev = max(abs(a - b) for k in std_map
                      for a, b in zip(r_map[k], std_map[k]))
            ok = dev <= 1.0  # sub-pixel rounding tolerance
            all_pass = all_pass and ok
            print(f"| {t}.html | {len(r)} | {dev:.1f} | {'✅' if ok else '❌'} |")
        b.close()
        print()
        print('스크린샷 저장 위치:', SHOTS)
        print('RESULT:', 'ALL PASS' if all_pass else 'FAIL — 편차 발견, 중단')

if __name__ == '__main__':
    main()
