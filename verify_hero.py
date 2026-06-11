# -*- coding: utf-8 -*-
"""Phase 3 — hero verification (Playwright 1920x1080).

Per page:
  1. .hero-std geometry: full width, paddings/h1/sub font sizes vs standard (≤2px)
  2. colors: background top-left pixel ≈ #0f2540, h1 color #fff, pill/kicker via computedStyle
  3. screenshot -> docs/screenshots/hero_<page>.png
Usage: python verify_hero.py <page...>
"""
import sys, os, io
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright
from PIL import Image

ROOT = r'C:\Users\kayky\Desktop\RedSeal-Project\allforyou-bit.github.io'
SHOTS = os.path.join(ROOT, 'docs', 'screenshots')
os.makedirs(SHOTS, exist_ok=True)

STD = {'padTop': 48.0, 'padBottom': 42.0, 'padLeft': 24.0,
       'h1Size': 29.6, 'subSize': 15.68, 'pillSize': 11.84}
BG_TL = (15, 37, 64)  # #0f2540

GRAB = """() => {
  const hero = document.querySelector('.hero-std');
  if (!hero) return null;
  const cs = getComputedStyle(hero);
  const px = v => parseFloat(v);
  const r = hero.getBoundingClientRect();
  const h1 = hero.querySelector('h1');
  const sub = hero.querySelector('.hero-sub');
  const pill = hero.querySelector('.hero-pill');
  return {
    rect: [r.x, r.y, r.width, r.height],
    padTop: px(cs.paddingTop), padBottom: px(cs.paddingBottom), padLeft: px(cs.paddingLeft),
    h1Size: h1 ? px(getComputedStyle(h1).fontSize) : -1,
    h1Color: h1 ? getComputedStyle(h1).color : '',
    subSize: sub ? px(getComputedStyle(sub).fontSize) : -1,
    pillSize: pill ? px(getComputedStyle(pill).fontSize) : -1,
    pillCount: hero.querySelectorAll('.hero-pill').length,
    textAlign: cs.textAlign,
    emoji: /[\\u2600-\\u27BF\\u{1F000}-\\u{1FAFF}]/u.test(hero.innerText),
  };
}"""

def main():
    targets = sys.argv[1:]
    results = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': 1920, 'height': 1080})
        ctx.route('http://**', lambda r: r.abort())
        ctx.route('https://**', lambda r: r.abort())
        page = ctx.new_page()
        print('| 페이지 | hero-std | 좌표/크기 편차 | h1 색 | 배경픽셀 | 배지 | 이모지 0 | 판정 |')
        print('|---|---|---|---|---|---|---|---|')
        all_ok = True
        for t in targets:
            page.goto('file:///' + os.path.join(ROOT, t + '.html').replace('\\', '/'), wait_until='load')
            page.wait_for_timeout(400)
            r = page.evaluate(GRAB)
            if not r:
                print(f'| {t} | ❌ 없음 | - | - | - | - | - | ❌ |'); all_ok = False; continue
            # geometry deviation vs standard
            dev = max(abs(r['padTop'] - STD['padTop']), abs(r['padBottom'] - STD['padBottom']),
                      abs(r['padLeft'] - STD['padLeft']), abs(r['h1Size'] - STD['h1Size']),
                      abs(r['subSize'] - STD['subSize']), abs(r['pillSize'] - STD['pillSize']),
                      abs(r['rect'][0] - 0), abs(r['rect'][2] - 1920))
            # screenshot hero
            shot = os.path.join(SHOTS, f'hero_{t}.png')
            clip = {'x': 0, 'y': max(0, r['rect'][1]), 'width': 1920, 'height': min(400, r['rect'][3] + 20)}
            page.screenshot(path=shot, clip=clip)
            im = Image.open(shot).convert('RGB')
            pxl = im.getpixel((6, 6))
            bg_ok = all(abs(a - b) <= 8 for a, b in zip(pxl, BG_TL))
            h1_ok = r['h1Color'] == 'rgb(255, 255, 255)'
            geo_ok = dev <= 2.0
            badge_ok = r['pillCount'] >= 1
            emoji_ok = not r['emoji']
            ok = geo_ok and bg_ok and h1_ok and badge_ok and emoji_ok and r['textAlign'] == 'center'
            all_ok = all_ok and ok
            hexpx = '#%02x%02x%02x' % pxl
            print(f"| {t} | ✅ | {dev:.1f}px {'✅' if geo_ok else '❌'} | {'✅' if h1_ok else '❌ ' + r['h1Color']} "
                  f"| {hexpx} {'✅' if bg_ok else '❌'} | {r['pillCount']}개 {'✅' if badge_ok else '❌'} "
                  f"| {'✅' if emoji_ok else '❌'} | {'✅' if ok else '❌'} |")
        b.close()
        print()
        print('스크린샷:', SHOTS + r'\hero_*.png')
        print('RESULT:', 'ALL PASS' if all_ok else 'FAIL')

if __name__ == '__main__':
    main()
