/* Conversion tracking for redsealquiz.ca
   -------------------------------------------------------------------------
   Added 2026-08-30. GA4 was recording 916 sessions in 28 days with ZERO key
   events, so no sale or funnel step could ever be attributed. This sends the
   three events that matter and nothing else.

   Events
     buy_click          outbound click to a Ko-fi product page (purchase intent)
     generate_lead      free 50-question mock exam PDF downloaded
     quiz_engaged       visitor answered 5 questions in the on-page quiz

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
      /* price is rendered in the button text, e.g. "… — CA$13 →" */
      var priceMatch = (a.textContent || "").match(/CA\$\s*(\d+(?:\.\d{2})?)/);
      send("buy_click", {
        trade: tradeFromPath(page),
        /* a /s/ link is one product; the bare page is the whole shop */
        link_type: href.indexOf("ko-fi.com/s/") !== -1 ? "product" : "shop",
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
})();
