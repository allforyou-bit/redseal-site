/* DC circuit fault lab board, v1.
   The DC markup a page does not ship yet, built from the circuit data so dc-render.v1.js can run on a
   bare simulator section (the generated page can ship the same markup itself and leave this file out):
   - build(): a plain drawing. The parts (batteries, fuses, the switch, lamps) on top, 4 a row, and every
     test point below, 2 a row. Each target is 50 units in a 360-unit drawing, so 44 px or more on a
     phone. Items in every view come first, so a view-only item never leaves a gap in the middle.
     [data-el] parts with .dc-nm and .dc-st text, [data-tp] points with data-cx and data-cy, [data-view]
     on view-only items.
   - controls(): the dock (#dc-read with the live reading and its label; the meter setting, the leads,
     the switch and the battery), the Meter panel rows (#dc-views, #dc-mctl) and the Find the fault work
     area (#dg-ctl, #dg-cond, #dg-pts, #dg-reads). Only the ids a page lacks are built.
   layout() is pure and exported for the node tests; the others take the document they build in. */
(function (root) {
  "use strict";

  var BOX = 50, W = 360, NS = "http://www.w3.org/2000/svg";
  var PART_TYPES = ["source", "fuse", "switch", "lamp"];
  var DOCK_CTL = ["s1", "power"], METER_CTL = ["unplugC1", "removeF1"], SHORT = { power: "Battery" };
  var L = {
    meterGroup: "Meter setting", leadGroup: "Lead to place", viewGroup: "System voltage", ctlGroup: "Circuit controls",
    tpGroup: "Test points", readsHead: "Readings", volts: "DC volts", ohms: "Resistance",
    ptsHint: "A tap on a test point places the selected lead. The meter reads as soon as both leads are on."
  };
  var CSS = ".dcb .hit{fill:rgba(0,0,0,0);stroke:none}.dcb .sym{fill:none;stroke:#2c3e50;stroke-width:1.6}" +
    ".dcb .sym.body{fill:#fff}.dcb .lbl{font:11px Segoe UI,Arial,sans-serif;fill:#2c3e50}.dcb .dc-st{font-weight:700}" +
    ".dcb .lv-dim .bulb{fill:#f7e3a1}.dcb .lv-bright .bulb{fill:#f2b705}" +
    ".dcb .fz-blown .fz-link{stroke:#b45f14;stroke-dasharray:5 6}.dcb .fz-removed .sym{stroke-dasharray:3 3;opacity:.6}" +
    ".dcb .tpl{fill:#fff;stroke:#1a3a5c;stroke-width:2}.dcb .tp.dim{opacity:.3}" +
    ".dcb .tp.pick .hit{stroke:#9e6d00;stroke-width:2;stroke-dasharray:4 3}" +
    ".dcb .lead circle{stroke:#fff;stroke-width:2}.dcb .lead-red circle{fill:#D55E00}.dcb .lead-black circle{fill:#1f1f1f}" +
    ".dcb .lead text{fill:#fff;font:700 15px Arial,sans-serif}" +
    ".dcb [role=button]{cursor:pointer}.dcb [role=button]:focus-visible .hit{stroke:#f0a500;stroke-width:3}";

  function wrap(s, n) {
    var out = [], line = "";
    String(s).split(" ").forEach(function (w) {
      if (line && (line + " " + w).length > n) { out.push(line); line = w; }
      else line = line ? line + " " + w : w;
    });
    if (line) out.push(line);
    return out;
  }

  function layout(def) {
    var vk = Object.keys(def.views), T = def.text || {}, parts = [], points = [], y = 8;
    function onlyIn(list) { return list.length < vk.length ? list : null; }
    function late(a) {
      return a.filter(function (x) { return !x.views; }).concat(a.filter(function (x) { return x.views; }));
    }
    late(def.elements.filter(function (e) { return PART_TYPES.indexOf(e.type) >= 0; }).map(function (e) {
      return { id: e.id, type: e.type, views: onlyIn(vk.filter(function (v) { return (def.views[v].omit || []).indexOf(e.id) < 0; })) };
    })).forEach(function (p, i) {
      p.x = (i % 4) * 90 + 20; p.y = y + Math.floor(i / 4) * 78; p.w = BOX; p.h = BOX;
      parts.push(p);
    });
    y += Math.ceil(parts.length / 4) * 78 + 6;
    late(def.points.map(function (p) { return { id: p.id, views: p.views ? onlyIn(p.views.slice()) : null }; })).forEach(function (p, i) {
      p.x = (i % 2) * 180 + 6; p.y = y + Math.floor(i / 2) * 62; p.w = BOX; p.h = BOX;
      p.cx = p.x + BOX / 2; p.cy = p.y + BOX / 2;
      p.label = wrap((T.points || {})[p.id] || p.id, 19);
      points.push(p);
    });
    y += Math.ceil(points.length / 2) * 62;
    return { w: W, h: y + 4, box: BOX, parts: parts, points: points };
  }

  function build(def, doc, title) {
    var L = layout(def);
    function sv(tag, a, parent, s) {
      var n = doc.createElementNS(NS, tag), k;
      for (k in a) n.setAttribute(k, a[k]);
      if (s != null) n.textContent = s;
      if (parent) parent.appendChild(n);
      return n;
    }
    function rect(x, y, w, hh) { return "M" + x + " " + y + "h" + w + "v" + hh + "h" + (-w) + "z"; }
    function glyph(g, t, x, y) {
      if (t === "lamp") {
        sv("circle", { "class": "sym body bulb", cx: x, cy: y, r: 13 }, g);
        sv("path", { "class": "sym", d: "M" + (x - 9) + " " + (y - 9) + "l18 18m0 -18l-18 18" }, g);
      } else if (t === "fuse") {
        sv("path", { "class": "sym body", d: rect(x - 17, y - 7, 34, 14) }, g);
        sv("path", { "class": "sym fz-link", d: "M" + (x - 17) + " " + y + "h34" }, g);
      } else if (t === "switch") {
        sv("path", { "class": "sym", d: "M" + (x - 20) + " " + (y + 6) + "h8l20 -14m0 14h12" }, g);
      } else {
        sv("path", { "class": "sym", d: "M" + (x - 4) + " " + (y - 14) + "v28m8 -20v12m-20 -4h8m8 0h8" }, g);
      }
    }
    var s = sv("svg", { "class": "sim-svg dcb", viewBox: "0 0 " + L.w + " " + L.h, role: "group", "aria-labelledby": "dcb-t" });
    sv("title", { id: "dcb-t" }, s, title || "");
    sv("style", {}, s, CSS);
    L.parts.forEach(function (p) {
      var g = sv("g", { "class": "dc-part k-" + p.type, "data-el": p.id, "data-info": p.id }, s), cx = p.x + p.w / 2;
      if (p.views) g.setAttribute("data-view", p.views.join(" "));
      sv("path", { "class": "hit", d: rect(p.x, p.y, p.w, p.h) }, g);
      glyph(g, p.type, cx, p.y + p.h / 2);
      sv("text", { "class": "lbl dc-nm", x: cx, y: p.y + p.h + 12, "text-anchor": "middle" }, g);
      sv("text", { "class": "lbl dc-st", x: cx, y: p.y + p.h + 24, "text-anchor": "middle" }, g);
    });
    L.points.forEach(function (p) {
      var g = sv("g", { "class": "tp", "data-tp": p.id, "data-cx": p.cx, "data-cy": p.cy }, s);
      if (p.views) g.setAttribute("data-view", p.views.join(" "));
      sv("circle", { "class": "hit", cx: p.cx, cy: p.cy, r: p.w / 2 }, g);
      sv("circle", { "class": "tpl", cx: p.cx, cy: p.cy, r: 7 }, g);
      p.label.forEach(function (t, i) {
        sv("text", { "class": "lbl", x: p.x + p.w + 8, y: p.cy + 4 + (i - (p.label.length - 1) / 2) * 12 }, g, t);
      });
    });
    return s;
  }

  /* el: the shell elements (side, panels, work) */
  function controls(def, doc, el) {
    var T = def.text, C = T.controls || {}, side = el.side, P = el.panels.meter, Wk = el.work, k;
    function mk(tag, cls, s, a, parent, id) {
      var n = doc.createElement(tag), j;
      if (cls) n.className = cls;
      if (s != null) n.textContent = s;
      for (j in a || {}) n.setAttribute(j, a[j]);
      if (tag === "button") n.type = "button";
      if (id) n.id = id;
      if (parent) parent.appendChild(n);
      return n;
    }
    function grp(label, parent, id, cls) { return mk("div", cls || "sim-row", null, { role: "group", "aria-label": label }, parent, id); }
    function tog(s, a, parent) { a["aria-pressed"] = "false"; return mk("button", "sim-tog", s, a, parent); }
    if (!doc.getElementById("sim-dock")) {
      var dock = mk("div", "sim-dock dc-dock", null, null, null, "sim-dock"), read = mk("div", "dc-read", null, null, dock, "dc-read");
      var live = mk("div", "dc-meter", null, { "aria-live": "polite", "aria-atomic": "true" }, read, "dc-meter");
      mk("p", "dc-val", null, { "aria-describedby": "dc-note" }, live, "dc-val");
      mk("p", "dc-leads", null, null, live, "dc-leads");
      mk("p", "dc-ref", null, { hidden: "" }, read, "dc-ref");
      mk("p", "dc-note sim-rd-note", T.readingNote, null, read, "dc-note");
      var keys = mk("div", "sim-row dc-keys", null, null, dock, "dc-keys");
      var gm = grp(L.meterGroup, keys, null, "dc-kg"), gl = grp(L.leadGroup, keys, null, "dc-kg");
      tog("V", { "data-meter": "volts", "aria-label": L.volts }, gm);
      tog("\u03A9", { "data-meter": "ohms", "aria-label": L.ohms }, gm);
      tog("Red", { "data-lead": "red", "aria-label": "Red lead" }, gl).className += " dc-red";
      tog("Black", { "data-lead": "black", "aria-label": "Black lead" }, gl).className += " dc-black";
      DOCK_CTL.forEach(function (j) { if (C[j]) tog(SHORT[j] || C[j], { "data-ctl": j, "aria-label": C[j] }, keys); });
      var fp = side.querySelector("[data-panel]");
      side.insertBefore(dock, fp && fp.parentNode === side ? fp : null);
    }
    if (P && !doc.getElementById("dc-views")) {
      var vw = grp(L.viewGroup, P, "dc-views");
      for (k in def.views) tog(def.views[k].label, { "data-pick-view": k }, vw);
    }
    if (P && !doc.getElementById("dc-mctl")) {
      var mc = grp(L.ctlGroup, P, "dc-mctl");
      METER_CTL.forEach(function (j) { if (C[j]) tog(C[j], { "data-ctl": j }, mc); });
    }
    if (Wk && !doc.getElementById("dg-reads")) {
      grp(L.ctlGroup, Wk, "dg-ctl");
      mk("p", "sim-cond", null, null, Wk, "dg-cond");
      mk("h3", "sim-h3", L.tpGroup, null, Wk);
      mk("p", "sim-hint", L.ptsHint, null, Wk);
      grp(L.tpGroup, Wk, "dg-pts");
      mk("h3", "sim-h3", L.readsHead, null, Wk);
      mk("ul", "sim-reads", null, null, Wk, "dg-reads");
    }
  }

  root.DcBoard = { version: 1, box: BOX, layout: layout, wrap: wrap, build: build, controls: controls };
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
