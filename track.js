/* Conversion tracking for redsealquiz.ca
   -------------------------------------------------------------------------
   Added 2026-08-30. GA4 was recording 916 sessions in 28 days with ZERO key
   events, so no sale or funnel step could ever be attributed. This sends the
   three events that matter and nothing else.

   Events
     buy_click          outbound click to a Ko-fi PRODUCT page (purchase intent)
     donate_click       the footer "Buy Me a Coffee" button - a tip, not a sale
     generate_lead      free 50-question mock exam PDF downloaded
     quiz_engaged       visitor answered 5 questions in the on-page quiz
     quiz_resumed       a returning visitor landed on a quiz with saved progress
     quiz_cta           hero "start practising" button, salary/career quiz links
     offer_view         a priced offer was at least half on screen for 1 second
                        (once per placement per page view)
     mock_finished      the mock exam result screen was shown

   Parameters worth reporting on (register as GA4 event-scoped custom
   dimensions - GA4 only keeps them from the day they are registered):
     placement, trade, link_type, source_page, price_cad

   Revised 2026-09-29. Three blind spots. (1) There was no impression event,
   so "nobody saw the offer" and "saw it and passed" were the same zero and
   no placement had a click-through rate. offer_view is the denominator for
   buy_click, placement by placement. (2) buy_click took its trade from the
   page path, and the 44 salary/career/guide pages carry the code in the
   middle of the name (/truck-transport-mechanic-310t-salary-canada.html), so
   every click there logged trade "unknown". The trade now comes from the
   Ko-fi product id first. (3) Nothing marked a finished mock exam, so
   mock_result clicks had no denominator either.

   Revised 2026-09-10. Two things were wrong. Every ko-fi.com link counted as
   buy_click, and 64 of the 154 ko-fi anchors on this site are the footer
   donation button - so "purchase intent" silently included people offering a
   tip. And buy_click carried no placement, so five different CTAs (sticky bar,
   end-of-bank panel, mock result, interstitial, static panel) were one
   indistinguishable number and none of them could be judged.

   Everything is wrapped so a missing gtag, a blocked script or an unexpected
   DOM can never break the page or the quiz. */
(function () {
  "use strict";

  function send(name, params) {
    try {
      if (typeof window.gtag === "function") window.gtag("event", name, params || {});
    } catch (e) { /* analytics must never break the page */ }
  }

  /* Trade code from a path like /310t.html, /310t-all-questions.html,
     /free-310t-mock-exam.html, /dl/310t-free-50-question-mock-exam.pdf */
  function tradeFromPath(path) {
    if (!path) return "unknown";
    var p = path.toLowerCase();
    var m = p.match(/(?:^|\/)(?:free-)?(gasfitter-class-a|\d{3}[a-z])(?:[-.\/]|$)/);
    return m ? m[1] : "unknown";
  }

  /* Ko-fi product id -> trade. The link itself says which bank the visitor
     wanted, wherever it sits - on home, on a guide page, in the sticky bar.
     Same eleven ids as PRODUCT in tools/rebuild_all_questions.py;
     scripts/acceptance_check.py fails if the site links a product id that is
     missing here or mapped to a different trade, so a new listing cannot
     silently fall back to "unknown". */
  var PRODUCT_TRADE = {
    "e1fa90dc7a": "306a", "1320877d42": "308a", "8ea5d0cd61": "309a",
    "1584a81d22": "310s", "823f281042": "310t", "bd62e0f1ae": "313a",
    "a87e57e4db": "420b", "bd6ed3d51f": "421a", "53b9fe7161": "442a",
    "e8e2006b00": "456a", "6bdf8876ff": "gasfitter-class-a"
  };

  function tradeFromProduct(href) {
    var m = (href || "").toLowerCase().match(/ko-fi\.com\/s\/([0-9a-z]+)/);
    return m && Object.prototype.hasOwnProperty.call(PRODUCT_TRADE, m[1])
      ? PRODUCT_TRADE[m[1]] : "unknown";
  }

  /* Where on the page the reader was standing when they decided. A click on
     the sticky bar and a click on the end-of-bank panel mean opposite things;
     until now they arrived as the same event. Runtime-injected CTAs have no
     markup to annotate, so this reads the containers they are appended into. */
  function placement(a) {
    /* Static CTAs carry data-cta, emitted by the generators so they never depend
       on a class name surviving a rebuild. (An earlier tools/tag_cta.py wrote the
       first of these; it no longer exists, so the generators and the pages are the
       only source now - do not go looking for it.)

       On the all-questions pages three placements are tagged separately, because
       they answer different questions: top_bank is the offer above the questions,
       interstitial is the one repeated every 60 questions, and interstitial_notes
       is the cheaper revision-notes line under it. They shared one tag until
       2026-09-11, which made it impossible to tell which position sold anything.

       The walk below is for the three CTAs that are injected at runtime and have
       no markup to annotate. */
    var tag = a.getAttribute && a.getAttribute("data-cta");
    if (tag) return tag;
    var n = a, hops = 0;
    while (n && n.nodeType === 1 && n !== document.body && hops++ < 14) {
      var id = n.id || "";
      if (id === "uxBar") return "sticky_bar";
      if (id === "studyDone") return "bank_finished";
      if (id === "mockOverlay" || id === "mockBody") return "mock_result";
      var c = " " + ((n.className && n.className.toString()) || "") + " ";
      if (c.indexOf(" kofi-btn ") > -1) return "footer_tip";
      if (c.indexOf(" cta ") > -1) return "interstitial";
      if (c.indexOf("cta-box") > -1 || c.indexOf("buy-btn") > -1) return "offer_panel";
      if (n.tagName === "FOOTER") return "footer";
      n = n.parentNode;
    }
    return "unattributed";
  }

  function closestAnchor(el) {
    while (el && el.nodeType === 1) {
      if (el.tagName === "A" && el.getAttribute("href")) return el;
      el = el.parentNode;
    }
    return null;
  }

  /* Everything buy_click and offer_view say about one Ko-fi anchor. Both
     events read it from here, so a view and a click on the same button can
     never disagree about its placement or trade - the CTR per placement is
     only meaningful if they cannot. Returns null for a non-Ko-fi link. */
  function offerInfo(a) {
    var href = (a && a.getAttribute && a.getAttribute("href")) || "";
    if (href.indexOf("ko-fi.com/") === -1) return null;
    var where = placement(a);
    /* a /s/ link is one product; the bare page is the whole shop */
    var isProduct = href.indexOf("ko-fi.com/s/") !== -1;
    /* The donation button and the shop share one URL, so the URL cannot tell
       them apart - the label does. Tips are worth counting, but never as
       purchase intent. */
    var img = a.querySelector && a.querySelector("img");
    var text = a.textContent || "";
    var label = text + " " + ((img && img.getAttribute("alt")) || "");
    var isTip = !isProduct && (/buy me a coffee/i.test(label) || where === "footer_tip");
    /* The product decides the trade; the page path is only the fallback. A
       bare shop link on a page with no trade code sells every trade. */
    var trade = isProduct ? tradeFromProduct(href) : "unknown";
    if (trade === "unknown") trade = tradeFromPath(location.pathname);
    if (trade === "unknown" && !isProduct) trade = "all";
    /* price is rendered in the button text, e.g. "… — CA$24 →". A range
       ("CA$19 to CA$29") is not one price, so it reports none. */
    var prices = text.match(/CA\$\s*\d+(?:\.\d{2})?/g) || [];
    var price = null;
    for (var i = 0; i < prices.length; i++) {
      var v = parseFloat(prices[i].replace(/[^\d.]/g, ""));
      if (price === null) price = v;
      else if (v !== price) { price = null; break; }
    }
    return {
      tip: isTip,
      placement: isTip && where === "unattributed" ? "footer_tip" : where,
      trade: trade,
      link_type: isProduct ? "product" : "shop",
      price_cad: price,
      href: href
    };
  }

  document.addEventListener("click", function (ev) {
    var a = closestAnchor(ev.target);
    if (!a) return;
    var href = a.getAttribute("href") || "";
    var page = location.pathname;

    if (href.indexOf("ko-fi.com/") !== -1) {
      var o = offerInfo(a);
      if (!o) return;
      if (o.tip) {
        send("donate_click", { source_page: page, placement: o.placement });
        return;
      }
      send("buy_click", {
        trade: o.trade,
        link_type: o.link_type,
        placement: o.placement,
        price_cad: o.price_cad,
        source_page: page,
        product_url: href
      });
      return;
    }

    /* The hero's own "start practising" button, added 2026-09-10. The first
       question sits about six phone screens below the fold and the hero had no
       interactive element at all, so this is the first thing an arriving
       visitor can press. Worth its own event: it is the only measure of
       whether the top of the page sends anyone into the quiz. */
    if (a.getAttribute("data-cta") === "hero_start") {
      send("quiz_cta", { trade: tradeFromPath(page), placement: "hero", source_page: page });
      return;
    }

    /* The salary and career pages link into the free quiz from two places,
       tagged career_bridge (the line above the first section) and career_quiz
       (the box further down). They were tagged on 2026-09-12 so the two could be
       told apart, but they are plain internal links - not Ko-fi, not the hero,
       not a PDF - so no branch here ever sent them and both counted zero. The
       page's own name does not start with the trade code, so the trade comes
       from the quiz page the link points at. */
    var cta = a.getAttribute("data-cta") || "";
    if (cta === "career_bridge" || cta === "career_quiz") {
      send("quiz_cta", { trade: tradeFromPath(href), placement: cta, source_page: page });
      return;
    }

    if (/\.pdf($|\?)/i.test(href)) {
      send("generate_lead", {
        trade: tradeFromPath(href) !== "unknown" ? tradeFromPath(href) : tradeFromPath(page),
        source_page: page,
        file_name: href.split("/").pop()
      });
    }
  }, true);

  /* One engagement signal from the quiz itself: fires once, at the fifth
     answered question. Distinguishes a real study session from a bounce. */
  var answered = 0, fired = false;
  document.addEventListener("click", function (ev) {
    if (fired) return;
    var el = ev.target;
    while (el && el.nodeType === 1 && el !== document.body) {
      var cls = (el.className && el.className.toString()) || "";
      if (/\b(option|opt|answer|choice)\b/.test(cls)) {
        answered++;
        if (answered >= 5) {
          fired = true;
          send("quiz_engaged", { trade: tradeFromPath(location.pathname), answered: answered });
        }
        return;
      }
      el = el.parentNode;
    }
  }, true);

  /* A returning studier. Until 2026-09-10 the position was saved on one of the
     eleven quiz pages, so this was structurally impossible on the other ten -
     any non-zero count is proof the path now exists. Same condition the page
     itself uses to decide whether to show the resume toast. */
  try {
    /* #questionCard is static markup on exactly the eleven quiz pages and on
       nothing else. The first version of this guard also accepted .q-text,
       which the -all-questions pages carry once per question - 421 times on
       421A - so a returning studier who opened the read-everything page fired
       quiz_resumed on a page with no quiz and no resume. */
    if (document.getElementById("questionCard")) {
      var tr = tradeFromPath(location.pathname);
      var at = parseInt(localStorage.getItem("progress_" + tr) || "0", 10);
      if (tr !== "unknown" && at > 0) send("quiz_resumed", { trade: tr, resumed_at: at });
    }
  } catch (e) { /* private mode, blocked storage - never break the quiz */ }

  /* offer_view - the denominator buy_click never had (2026-09-29).
     Watches every Ko-fi anchor that offerInfo() calls an offer (tips are
     excluded), including the three the quiz pages inject later: #uxBuy in the
     sticky bar, the end-of-bank link in #studyDone and the result link in
     #mockBody. Fires once per placement per page view, when an anchor of that
     placement has been at least half on screen for DWELL_MS while the tab is
     in front. "Once per placement" is deliberate: the eleven-row product list
     on home is one placement, and counting it eleven times would make its
     click-through rate incomparable with a single button's. When one
     placement links several trades, trade is "multi" and no price is sent. */
  var DWELL_MS = 1000;
  var viewed = {};    /* placement -> true once offer_view has fired */
  var tradesAt = {};  /* placement -> { trade: true } over the anchors seen */
  var io = null, infoOf = null, timers = null, onScreen = null;

  function viewFire(a) {
    var o = infoOf.get(a);
    if (!o || viewed[o.placement]) return;
    if (!document.documentElement.contains(a)) return; /* re-rendered away */
    viewed[o.placement] = true;
    var multi = Object.keys(tradesAt[o.placement] || {}).length > 1;
    send("offer_view", {
      placement: o.placement,
      trade: multi ? "multi" : o.trade,
      link_type: o.link_type,
      price_cad: multi ? null : o.price_cad,
      source_page: location.pathname
    });
  }

  function arm(a) {
    if (timers.has(a) || document.hidden) return;
    timers.set(a, setTimeout(function () {
      timers.delete(a);
      try { if (!document.hidden && onScreen.has(a)) viewFire(a); } catch (e) { /* never break the page */ }
    }, DWELL_MS));
  }

  function disarm(a) {
    if (timers.has(a)) { clearTimeout(timers.get(a)); timers.delete(a); }
  }

  function onIntersect(entries) {
    try {
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i], a = e.target, o = infoOf.get(a);
        if (!o || viewed[o.placement]) { io.unobserve(a); onScreen.delete(a); disarm(a); continue; }
        if (e.isIntersecting && e.intersectionRatio >= 0.5) { onScreen.add(a); arm(a); }
        else { onScreen.delete(a); disarm(a); }
      }
    } catch (err) { /* never break the page */ }
  }

  /* A tab in the background is not a view: hold the clock while it is hidden
     and restart it for whatever is still on screen when it comes back. */
  function onVisibility() {
    try {
      if (document.hidden) {
        timers.forEach(function (t) { clearTimeout(t); });
        timers.clear();
      } else {
        onScreen.forEach(function (a) { arm(a); });
      }
    } catch (e) { /* never break the page */ }
  }

  function registerOffers() {
    var list = document.querySelectorAll('a[href*="ko-fi.com/"]');
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (infoOf.has(a)) continue;
      var o = offerInfo(a);
      infoOf.set(a, o && !o.tip ? o : null);
      if (!o || o.tip) continue;
      (tradesAt[o.placement] = tradesAt[o.placement] || {})[o.trade] = true;
      if (!viewed[o.placement]) io.observe(a);
    }
  }

  /* mock_finished - fires when #mockBody turns into the result screen. Read
     from the rendered text rather than by wrapping showMockResults(): the
     eleven pages come from two generations with different variable names,
     but both print "N / M correct" (or "N/M correct") on the result screen
     and nowhere in a question. The previous state is kept so a re-render of
     the same result (the timer running out on a finished exam) does not
     count twice, and starting a new mock resets it. */
  var mockShowing = false;
  function checkMock() {
    var mb = document.getElementById("mockBody");
    if (!mb) return;
    var t = mb.textContent || "";
    var m = /Question\s+\d+\s+of\s+\d+/i.test(t) ? null : t.match(/(\d+)\s*\/\s*(\d+)\s+correct/i);
    var right = m ? parseInt(m[1], 10) : 0, total = m ? parseInt(m[2], 10) : 0;
    var showing = total > 0 && right <= total;
    if (showing && !mockShowing) {
      send("mock_finished", {
        trade: tradeFromPath(location.pathname),
        pct: Math.round(right / total * 100),
        total: total
      });
    }
    mockShowing = showing;
  }

  var refreshTimer = 0;
  function refresh() {
    refreshTimer = 0;
    try { if (io) registerOffers(); } catch (e) { /* never break the page */ }
    try { checkMock(); } catch (e) { /* never break the page */ }
  }

  try {
    if (typeof window.IntersectionObserver === "function" && typeof window.WeakMap === "function" &&
        typeof window.Map === "function" && typeof window.Set === "function") {
      infoOf = new WeakMap(); timers = new Map(); onScreen = new Set();
      io = new IntersectionObserver(onIntersect, { threshold: [0.5] });
      document.addEventListener("visibilitychange", onVisibility);
    }
  } catch (e) { io = null; }

  /* The runtime CTAs and the mock result appear long after load. Rescan when
     elements are added - never on text-only changes such as the mock timer
     ticking every second - and at most every 250 ms. */
  try {
    if (typeof window.MutationObserver === "function") {
      new MutationObserver(function (records) {
        try {
          for (var i = 0; i < records.length; i++) {
            var added = records[i].addedNodes;
            for (var j = 0; j < added.length; j++) {
              if (added[j].nodeType === 1) {
                if (!refreshTimer) refreshTimer = setTimeout(refresh, 250);
                return;
              }
            }
          }
        } catch (e) { /* never break the page */ }
      }).observe(document.body || document.documentElement, { childList: true, subtree: true });
    }
  } catch (e) { /* never break the page */ }
  refresh();
})();
