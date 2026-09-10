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

  /* Where on the page the reader was standing when they decided. A click on
     the sticky bar and a click on the end-of-bank panel mean opposite things;
     until now they arrived as the same event. Runtime-injected CTAs have no
     markup to annotate, so this reads the containers they are appended into. */
  function placement(a) {
    /* Static CTAs carry data-cta, written once by tools/tag_cta.py and emitted
       by the generators, so they never depend on a class name surviving a
       rebuild. The walk below is for the three CTAs that are injected at
       runtime and have no markup to annotate. */
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

  document.addEventListener("click", function (ev) {
    var a = closestAnchor(ev.target);
    if (!a) return;
    var href = a.getAttribute("href") || "";
    var page = location.pathname;

    if (href.indexOf("ko-fi.com/") !== -1) {
      var where = placement(a);
      /* The donation button and the shop share one URL, so the URL cannot tell
         them apart - the label does. Tips are worth counting, but never as
         purchase intent. */
      var img = a.querySelector && a.querySelector("img");
      var label = (a.textContent || "") + " " + ((img && img.getAttribute("alt")) || "");
      var isTip = href.indexOf("ko-fi.com/s/") === -1 &&
                  (/buy me a coffee/i.test(label) || where === "footer_tip");
      if (isTip) {
        send("donate_click", { source_page: page,
                               placement: where === "unattributed" ? "footer_tip" : where });
        return;
      }
      /* price is rendered in the button text, e.g. "… — CA$13 →" */
      var priceMatch = (a.textContent || "").match(/CA\$\s*(\d+(?:\.\d{2})?)/);
      send("buy_click", {
        trade: tradeFromPath(page),
        /* a /s/ link is one product; the bare page is the whole shop */
        link_type: href.indexOf("ko-fi.com/s/") !== -1 ? "product" : "shop",
        placement: where,
        price_cad: priceMatch ? parseFloat(priceMatch[1]) : null,
        source_page: page,
        product_url: href
      });
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
    if (document.getElementById("qNumber") || document.querySelector(".q-text")) {
      var tr = tradeFromPath(location.pathname);
      var at = parseInt(localStorage.getItem("progress_" + tr) || "0", 10);
      if (tr !== "unknown" && at > 0) send("quiz_resumed", { trade: tr, resumed_at: at });
    }
  } catch (e) { /* private mode, blocked storage - never break the quiz */ }
})();
