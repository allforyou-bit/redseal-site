/* fold.js (2026-11-17): on a phone, long guide pages collapse each h2 section after the first
   into a tap-to-open block, so the page reads as a short list of headings. The HTML is not
   changed (search engines and AI assistants read the full text); desktops are untouched.
   Kept visible: the first section, anything holding a priced offer or quiz link (data-cta),
   FAQ blocks (already <details>), navigation, hero and footer. A #hash link opens its section. */
(function () {
  if (!window.matchMedia || !window.matchMedia("(max-width: 820px)").matches) return;
  var heads = [].slice.call(document.querySelectorAll("h2")).filter(function (h) {
    return !h.closest("nav, footer, header, details, .hero-std, .foot-v2, #bank-offer, [id^=faq], .faq, .quiz-grid");
  });
  if (heads.length < 3) return;
  var css = document.createElement("style");
  css.textContent =
    ".fold-h{cursor:pointer;position:relative;padding-right:64px!important;min-height:44px}" +
    ".fold-h::after{content:'Show \\25BE';position:absolute;right:0;top:50%;transform:translateY(-50%);font-size:.78rem;font-weight:700;color:#1a3a5c;background:#eef3f8;border-radius:999px;padding:4px 10px}" +
    ".fold-h.open::after{content:'Hide \\25B4'}.fold-body[hidden]{display:none!important}";
  document.head.appendChild(css);
  var bodies = [];
  heads.slice(1).forEach(function (h) {
    var parent = h.parentNode, items = [], n = h.nextElementSibling;
    while (n && !/^H[12]$/.test(n.tagName) && !(n.querySelector && n.querySelector("h2"))) {
      if (n.matches("[data-cta], #bank-offer, details") || (n.querySelector && n.querySelector("[data-cta], #bank-offer"))) break;
      items.push(n); n = n.nextElementSibling;
    }
    var size = items.reduce(function (s, e) { return s + e.getBoundingClientRect().height; }, 0);
    if (!items.length || size < window.innerHeight * 0.5) return;   // short sections stay open
    var body = document.createElement("div");
    body.className = "fold-body"; body.hidden = true;
    parent.insertBefore(body, items[0]);
    items.forEach(function (e) { body.appendChild(e); });
    h.classList.add("fold-h");
    h.setAttribute("role", "button"); h.setAttribute("tabindex", "0"); h.setAttribute("aria-expanded", "false");
    function toggle(open) {
      body.hidden = !open; h.classList.toggle("open", open); h.setAttribute("aria-expanded", open ? "true" : "false");
    }
    h.addEventListener("click", function () { toggle(body.hidden); });
    h.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); toggle(body.hidden); } });
    bodies.push([body, toggle]);
  });
  function openHash() {
    if (!location.hash) return;
    var t = document.getElementById(location.hash.slice(1)); if (!t) return;
    bodies.forEach(function (b) { if (b[0].contains(t)) b[1](true); });
  }
  openHash(); window.addEventListener("hashchange", openHash);
})();
