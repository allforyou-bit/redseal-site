/* Refrigeration cycle simulator drawing, v1 (refrigeration-design-v1-20261107.md section 1, as changed by
   design v2 and v2.1): the static SVG of the cycle, as markup, with no DOM access. The page generator calls
   svg() through node to write the drawing into the page; rfc-render.v1.js parses it into a bare page.
   - Parts: compressor, condenser and its fan, the two metering devices (fixed orifice, TXV with its sensing
     bulb and capillary; the svg class md-FX or md-TX shows one), evaporator and its fan, the discharge,
     liquid and suction lines, the two gauges, two line clamps and the amp clamp. No maker marks.
   - Text: part names and labels only, all from the content file through t(sid). Every figure on the
     drawing is a live readout that rfc-render.v1.js writes into an empty tag; the tests check that the
     static markup carries no digit in any text or label.
   - Contract with the renderer: [data-info] part groups with data-name; [data-test] groups (gauges, clamps,
     fans) that take a test in Find the fault; [data-z] zone overlays (pathLength 100) along each coil;
     #rfc-tag-* tags; #rfc-n-Ps and #rfc-n-Pd needles; #rfc-b-fanC and #rfc-b-fanE blades; .rfc-dots, the
     refrigerant dots along the loop; .rfc-flash and .rfc-wet marks. */
(function (root) {
  "use strict";

  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function el(n, a, inner) {
    var s = "<" + n, k;
    for (k in a) if (has(a, k) && a[k] != null) s += " " + k + "=\"" + esc(a[k]) + "\"";
    return s + (inner == null ? "/>" : ">" + inner + "</" + n + ">");
  }
  function p(d, c, x) { var a = { d: d, "class": c }, k; for (k in x || {}) if (has(x, k)) a[k] = x[k]; return el("path", a); }
  function box(x0, y0, x1, y1) { return "M" + x0 + " " + y0 + " H" + x1 + " V" + y1 + " H" + x0 + " Z"; }

  /* ---------- the static drawing (viewBox 380 x 400) ---------- */
  var G = {
    cond: "M270 56 H90 A8 8 0 0 0 90 72 H270 A8 8 0 0 1 270 88 H90",
    evap: "M90 288 H270 A8 8 0 0 1 270 304 H90 A8 8 0 0 0 90 320 H270",
    dl: "M300 180 V56 H270", ll: "M90 88 H60 V200", ei: "M60 228 V288 H90", sl: "M270 320 H300 V224",
    cap: "M38 214 V350 H286 V332", capHit: "M38 244 V350 H286 V332"   /* the capillary band starts below the TXV tap area */
  };
  G.loop = "M300 180 V56 H270 H90 A8 8 0 0 0 90 72 H270 A8 8 0 0 1 270 88 H90 H60 V288 H90 H270 A8 8 0 0 1 270 304 H90 A8 8 0 0 0 90 320 H270 H300 V224";
  /* zone overlays in coil order; hollow ones (mixture) have an inner line */
  var ZONES = { cond: [["cond_desuperheat", "z-v"], ["cond_condensing", "z-mh"], ["cond_subcooling", "z-l"]],
    evap: [["evap_two_phase", "z-ml"], ["evap_superheat", "z-lv"]] };
  var GAUGES = { gH: { cx: 344, cy: 118, k: "Pd", tag: "Tc", lbl: "draw.gauge_head" }, gS: { cx: 344, cy: 252, k: "Ps", tag: "Te", lbl: "draw.gauge_suction" } };
  var SWING = 100;   /* needle degrees at the widest change in the table */
  /* meters: the two line clamps and the amp clamp, one part card (content v3) */
  var PARTS = ["comp", "cond", "fanC", "md", "txv", "bulb", "evap", "fanE", "dl", "ll", "sl", "gS", "gH", "meters"];
  /* the tap areas of every target, [x0, y0, x1, y1] each: invisible box paths, first in their group, so the
     drawing does not move. rfc-std.css gives pointer events to the tap areas of the targets of the mode only;
     where two overlap, the later group in the markup takes the overlap. Each target keeps a square of 54 units
     or more of its own in every mode (44 px on a 360 px screen; the browser checks measure it): the line
     clamps take the stretch of line they sit on, so the liquid and suction lines keep a square beside it */
  var TAP = { cond: [[78, 44, 282, 100]], evap: [[78, 276, 282, 332]], dl: [[272, 28, 328, 174]],
    ll: [[58, 88, 122, 142], [32, 150, 86, 190]], sl: [[248, 230, 302, 284], [262, 310, 296, 330]],
    comp: [[208, 174, 328, 230]], md: [[32, 190, 86, 244]], txv: [[26, 190, 86, 244]], bulb: [[242, 322, 296, 376]],
    gH: [[318, 90, 372, 144]], gS: [[318, 226, 372, 280]], fanC: [[18, 12, 74, 68]], fanE: [[322, 344, 378, 400]],
    liquid_line: [[4, 95, 68, 149]], suction_line: [[296, 284, 350, 338]], amps: [[326, 170, 380, 224]] };
  function tap(id) { return (TAP[id] || []).map(function (b) { return p(box(b[0], b[1], b[2], b[3]), "tap"); }).join(""); }

  function svg(t) {
    function txt(x, y, s, c, a) { var o = { x: x, y: y, "class": c || "lbl" }, k; for (k in a || {}) if (has(a, k)) o[k] = a[k]; return el("text", o, esc(s)); }
    function tagT(id, x, y, anchor) { return el("text", { id: "rfc-tag-" + id, "class": "rfc-tag", x: x, y: y, "text-anchor": anchor || "middle" }, ""); }
    function part(id, cls, inner, x) {
      var a = { "class": "rfc-part" + (cls ? " " + cls : ""), "data-info": id, "data-name": t("part." + id + ".name") }, k;
      for (k in x || {}) if (has(x, k)) a[k] = x[k];
      return el("g", a, tap(id) + inner);
    }
    function line(id, k, d) { return part(id, "rfc-ln " + k, p(d, "hit-ln") + p(d, "lo") + p(d, "lm")); }
    function coil(id, d, lbl, lx, ly, b) {
      var z = ZONES[id].map(function (q) {
        var a = { "data-z": q[0], pathLength: 100 };
        return p(d, "rfc-zone " + q[1], a) + (/^z-m/.test(q[1]) ? p(d, "rfc-zone zi " + q[1], a) : "");
      }).join("");
      return part(id, "rfc-coil", p(box(b[0], b[1], b[2], b[3]), "hit rfc-box") + p(d, "rfc-tube") + z + txt(lx, ly, t(lbl)));
    }
    function fan(id, cx, cy, test, arrows, tagIn, tagOut) {
      var bl = "", i, a;
      for (i = 0; i < 3; i++) { a = i * 2 * Math.PI / 3; bl += p("M" + cx + " " + cy + " L" + (cx + 13 * Math.sin(a)).toFixed(1) + " " + (cy - 13 * Math.cos(a)).toFixed(1), "blade"); }
      return part(id, "rfc-fan", el("circle", { "class": "hit", cx: cx, cy: cy, r: 22 }) + el("circle", { "class": "sym body", cx: cx, cy: cy, r: 16 }) +
        el("g", { id: "rfc-b-" + id }, bl), { "data-test": test }) +
        el("g", { "class": "rfc-air", "aria-hidden": "true" }, arrows.map(function (x) { return p(x, "air"); }).join("")) + tagIn + tagOut;
    }
    function gauge(id) {
      var g = GAUGES[id], cx = g.cx, cy = g.cy, arc = "M" + (cx - 12.2) + " " + (cy + 4.4) + " A13 13 0 1 1 " + (cx + 12.2) + " " + (cy + 4.4);
      return p("M300 " + cy + " H" + (cx - 18), "hose") + part(id, "rfc-gauge", el("circle", { "class": "hit", cx: cx, cy: cy, r: 24 }) +
        el("circle", { "class": "sym body", cx: cx, cy: cy, r: 18 }) + p(arc, "arc") + p("M" + cx + " " + (cy - 16) + " V" + (cy - 10), "tick") +
        el("g", { id: "rfc-n-" + g.k, "class": "needle" }, p("M" + cx + " " + (cy + 3) + " V" + (cy - 13), "nd") + el("circle", { cx: cx, cy: cy, r: 2.2, "class": "hub" })) +
        txt(cx, cy + 33, t(g.lbl), "lbl sm", { "text-anchor": "middle" }), { "data-test": "gauges" }) + tagT(g.tag, cx, cy + 46);
    }
    function clamp(test, x, y, tagId, tx, ty, anchor) {
      return el("g", { "class": "rfc-clamp", "data-info": "meters", "data-name": t("part.meters.name"), "data-test": test },
        tap(test) + el("circle", { "class": "hit", cx: x, cy: y, r: 16 }) + p(box(x - 7, y - 4, x + 7, y + 4), "clamp")) + (tagId ? tagT(tagId, tx, ty, anchor) : "");
    }
    var aC = [116, 156, 196, 236].map(function (x) { return "M" + x + " 112 V34 M" + (x - 4) + " 40 L" + x + " 32 L" + (x + 4) + " 40"; });
    var aE = [130, 190, 250].map(function (x) { return "M" + x + " 368 V268 M" + (x - 4) + " 274 L" + x + " 266 L" + (x + 4) + " 274"; });
    var bubbles = [140, 158, 176].map(function (y) { return el("circle", { cx: 60, cy: y, r: 2.6 }); }).join("");
    var drops = [262, 280].map(function (y) { return p("M292 " + (y - 5) + " Q288 " + y + " 292 " + (y + 3) + " Q296 " + y + " 292 " + (y - 5) + " Z", "drop"); }).join("");
    var body = [
      el("title", { id: "rfc-svg-t" }, esc(t("draw.title"))), el("desc", { id: "rfc-svg-d" }, esc(t("draw.desc"))),
      coil("cond", G.cond, "draw.condenser", 84, 110, [78, 44, 282, 100]),
      coil("evap", G.evap, "draw.evaporator", 84, 344, [78, 276, 282, 332]),
      line("dl", "k-hv", G.dl), line("ll", "k-hl", G.ll), el("g", { "class": "rfc-ln k-ml", "aria-hidden": "true" }, p(G.ei, "lo") + p(G.ei, "lm") + p(G.ei, "lm zi")),
      line("sl", "k-lv", G.sl),
      el("g", { "class": "rfc-flash", "aria-hidden": "true" }, bubbles), el("g", { "class": "rfc-wet", "aria-hidden": "true" }, drops),
      p(G.loop, "rfc-dots", { "aria-hidden": "true" }),
      txt(292, 140, t("draw.discharge"), "lbl sm", { "text-anchor": "end" }), txt(68, 168, t("draw.liquid"), "lbl sm"),
      txt(292, 238, t("draw.suction"), "lbl sm", { "text-anchor": "end" }),
      part("comp", "", p(box(272, 174, 328, 230), "hit") + el("circle", { "class": "sym body", cx: 300, cy: 202, r: 22 }) +
        p("M284 190 L318 196 M284 214 L318 208", "sym") + txt(272, 206, t("draw.compressor"), "lbl", { "text-anchor": "end" })),
      part("md", "rfc-fx", p(box(44, 198, 76, 230), "hit") + p("M52 200 L58 214 L52 228 M68 200 L62 214 L68 228", "sym") + txt(78, 218, t("draw.orifice"))),
      part("txv", "rfc-tx", p(box(30, 198, 76, 230), "hit") + p("M50 202 H70 L60 214 Z M50 226 H70 L60 214 Z", "sym body") +
        p("M60 214 H46 M46 207 A7 7 0 0 0 46 221 Z", "sym body") + txt(78, 218, t("draw.txv"))),
      part("bulb", "rfc-tx", p(G.capHit, "hit-ln") + p(G.cap, "capil") + p(box(278, 323, 294, 333), "sym body") + txt(298, 344, t("draw.bulb"), "lbl sm")),
      clamp("liquid_line", 60, 122, "T3", 70, 126, "start"), clamp("suction_line", 300, 306, "T1", 310, 318, "start"),
      clamp("amps", 358, 202, null) + p("M322 202 H374", "lead") + txt(358, 182, t("draw.amps"), "lbl sm", { "text-anchor": "middle" }),
      gauge("gH"), gauge("gS"),
      fan("fanC", 46, 40, "cond_air", aC, txt(176, 126, t("draw.air_in"), "lbl sm", { "text-anchor": "end" }) + tagT("amb", 180, 126, "start"),
        txt(176, 22, t("draw.air_out"), "lbl sm", { "text-anchor": "end" }) + tagT("aco", 180, 22, "start")),
      fan("fanE", 350, 372, "evap_air", aE, txt(186, 386, t("draw.air_in"), "lbl sm", { "text-anchor": "end" }) + tagT("ai", 190, 386, "start"),
        txt(186, 262, t("draw.air_out"), "lbl sm", { "text-anchor": "end" }) + tagT("aeo", 190, 262, "start"))
    ];
    /* role group, as the other simulator drawings: WebKit can expose a titled svg as one image and hide its buttons */
    return el("svg", { "class": "sim-svg rfc-svg md-TX", viewBox: "0 0 380 400", role: "group", "aria-labelledby": "rfc-svg-t rfc-svg-d" }, body.join(""));
  }
  var LEGEND = [["k-hv", "legend.hv"], ["k-hl", "legend.hl"], ["k-mh", "legend.mh"], ["k-ml", "legend.ml"], ["k-lv", "legend.lv"],
    ["mk-flash", "legend.flash"], ["mk-wet", "legend.wet"]];
  /* a template with {slot} marks; slots the text lacks follow it, so the stub still shows them */
  function fill(t, sid, slots) {
    var s = t(sid), k, rest = [];
    for (k in slots || {}) {
      if (!has(slots, k)) continue;
      if (s.indexOf("{" + k + "}") >= 0) s = s.split("{" + k + "}").join(t(slots[k]));
      else rest.push(t(slots[k]));
    }
    return rest.length ? s + " " + rest.join(" ") : s;
  }
  /* every sid the drawing, its legend and the part cards use */
  var USED = ["draw.title", "draw.desc", "draw.condenser", "draw.evaporator", "draw.compressor", "draw.orifice", "draw.txv",
    "draw.bulb", "draw.discharge", "draw.liquid", "draw.suction", "draw.gauge_suction", "draw.gauge_head", "draw.air_in",
    "draw.air_out", "draw.amps", "legend.group", "part.head.does", "part.head.fails"];
  function sids() {
    var out = USED.slice();
    LEGEND.forEach(function (x) { out.push(x[1]); });
    PARTS.forEach(function (id) { ["name", "does", "fails"].forEach(function (f) { out.push("part." + id + "." + f); }); });
    return out.sort();
  }
  root.RfcDraw = { version: 1, svg: svg, fill: fill, sids: sids, parts: PARTS.slice(), zones: ZONES, gauges: GAUGES, swing: SWING,
    legend: LEGEND.map(function (x) { return x.slice(); }), has: has };
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
