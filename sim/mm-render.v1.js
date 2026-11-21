/* Multimeter practice simulator renderer, v1.
   The meter on top of sim-shell.v1.js: dial, jacks, red and black leads, display and circuit controls of an
   example meter on the 12 V example board. Every reading comes from MmEngine.read with the inputs the
   visitor sees; the fuse states it hands back (latch) go into the next read. Drills: mm-drills.v1.js.
   Rules kept here:
   - Every number shown is an engine reading with the example-value label in the same block. Other text
     carries no figures (range names come from the data).
   - Drills draw the circuit neutral (no line states, no current marks) and never draw the circuit fuse
     blown: the lamp and the display are the symptoms.
   - No state is colour alone: parts carry a word, leads a sign, toggles aria-pressed.
   Drawing contract (the page SVG): svg.sim-svg; [data-el] groups (element ids) with an optional .mm-st
   text; [data-tp] groups with data-cx and data-cy (or a circle.hit); [data-bench] on items shown only while
   that input is true (the pulled fuse and its ends); g#lead-red and g#lead-black (built when missing);
   optional #mm-bridge (a line between the leads), #mm-park (data-cx, data-cy: where touching probe tips
   rest) and the face: #mm-face-val, #mm-pointer (data-cx, data-cy), #mm-face-fuse, #mm-face-beep (a speaker with
   sound waves beside the screen while the meter beeps; the dock shows the word with a speaker mark), [data-jack-mark].
   The dock and the Measure rows are built when the page lacks them. */
(function (root) {
  "use strict";

  /* one tap with the active lead (as dc-render.v1.js): s = { red, black, active } */
  function placeLead(s, pt) {
    var o = { red: s.red || null, black: s.black || null, active: s.active === "black" ? "black" : "red" };
    if (!pt || o.red === pt || o.black === pt) return o;
    var other = o.active === "red" ? "black" : "red", was = o[o.active];
    o[o.active] = pt;
    if (!o[other]) o.active = other;
    else if (!was && o.active === "black") o.active = "red";
    return o;
  }
  /* the dial pointer: OFF at the left, one step per dial position */
  function angle(i) { return -75 + 30 * i; }
  var R = root.MmRender = { version: 1, placeLead: placeLead, angle: angle };

  var doc = root.document;
  if (!doc || !doc.getElementById) return;

  var DG = "diagnose", MODES = ["explore", "meter", DG], CTL = ["power", "s1", "fuseOut", "parted"], LAND = ["TP_BP", "TP_BN"];
  var MODE_NAME = { explore: "Explore", meter: "Measure", diagnose: "Drills" };
  var PANEL = { explore: "Explore the parts", meter: "Measure the board", diagnose: "Drills" };
  var HINT = {
    explore: "Tap a part of the drawing or of the meter, or move to it with the Tab key and press Enter, to read what it is.",
    meter: "Set the dial and the jack for the red lead, then tap two test points to place the leads. The display reads as soon as both leads are on.",
    diagnose: "Pick a drill. Each one starts with something set up wrongly: put it right, take the reading the task asks for, then pick what went wrong."
  };
  var U = {
    tp: "Test point", places: "Places the %s lead.", on: "The %s lead is on it.", already: "The %s lead is already on",
    leadOn: "lead on", next: "Next, place the %s lead.", nextTap: "The next tap places the %s lead.",
    red: "Red", black: "Black", none: "not placed", tog: "Red and black: probe tips touching each other",
    dial: "Dial", jacks: "Jacks and leads", com: "COM: black lead", inJack: "Red lead in the %s jack", lead: "lead",
    beep: "Beeping", ctl: "Board controls", fresh: "New circuit fuse in place.", meterFresh: "New meter fuse in place.",
    leadsFresh: "New test leads in place.", again: "The circuit fuse opened again as soon as it went in.",
    closed: "closed", open: "open", conn: "connected", disc: "disconnected", inPlace: "in place", blown: "blown",
    removed: "out of the holder", joined: "joined", parted: "parted", range: "range", pick: "Pick a drill to start."
  };
  var COND = { power: ["battery connected", "battery disconnected"], s1: ["switch on", "switch off"],
    fuseOut: ["fuse out of the holder", "fuse in the holder"], parted: ["connector parted", "connector joined"] };
  var ACTS = ["together", "replaceFuse", "replaceMeterFuse", "newLeads"];

  var Sh, E, S, def, T, C, P, ID, svg, has, copy, all, flag, press, text, make, closest, D = null;
  var byEl = {}, els = {}, tps = {}, leadG = {}, ui = {}, face = {}, ms = null, dg = null;

  function byId(id) { return doc.getElementById(id); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function line() { return Array.prototype.slice.call(arguments).filter(Boolean).join(" "); }
  function sentence(a) { return a.length ? cap(a.join(", ")) + "." : ""; }
  function show(g, on) { if (on) g.removeAttribute("display"); else if (g.getAttribute("display") !== "none") g.setAttribute("display", "none"); }
  function pt(id) { var q = null; def.points.forEach(function (x) { if (x.id === id) q = x; }); return q; }
  function cur() { return S.mode() === DG ? dg : ms; }

  /* a meter and board state: the Measure start, or the preset of a drill */
  function fresh(d) {
    var p = d && d.preset, s = { meter: { dial: "dcv", jack: "vo", range: "auto" }, red: LAND[0], black: LAND[1], together: false,
      active: "red", ctl: {}, blown: {}, meterBlown: false, leadBroken: false, d: d || null, step: 0, own: {}, items: {} }, k;
    for (k in def.inputs) if (has(def.inputs, k)) s.ctl[k] = !!def.inputs[k];
    if (p) {
      s.meter = { dial: p.meter.dial, jack: p.meter.jack, range: p.meter.range || "auto" };
      s.red = p.red || null; s.black = p.black || null;
      for (k in p.inputs || {}) if (has(p.inputs, k)) s.ctl[k] = !!p.inputs[k];
      s.blown = copy(p.blown || {}); s.meterBlown = !!p.meterBlown; s.leadBroken = !!p.leadBroken;
    }
    return s;
  }
  function inputs(s) {
    var o = { blown: copy(s.blown), meterBlown: s.meterBlown, leadBroken: s.leadBroken }, k;
    for (k in s.ctl) if (has(s.ctl, k)) o[k] = s.ctl[k];
    return o;
  }
  function probeOf(s) { return s.together ? { together: true } : { red: s.red, black: s.black }; }
  /* a reading, with the latch handed back into the state */
  function read(s) {
    var r = E.read(ID, inputs(s), s.meter, probeOf(s));
    if (r.events.circuitFuse) s.own.F1 = true;
    if (r.events.meterFuse) s.own.meter = true;
    s.blown = copy(r.latch.blown);
    s.meterBlown = r.latch.meterBlown;
    return r;
  }
  function usable(p) {
    var q = pt(p), m = S.mode();
    return m !== "explore" && !!q && (!q.bench || !!cur().ctl[q.bench]) && (m !== DG || !!dg.d);
  }
  function heldBy(s, p) { return s.together ? "" : s.red === p ? "red" : s.black === p ? "black" : ""; }
  function leadsText(s) {
    if (s.together) return U.tog;
    return U.red + ": " + (s.red ? T.points[s.red] : U.none) + " \u00B7 " + U.black + ": " + (s.black ? T.points[s.black] : U.none);
  }
  function tpLabel(p) {
    var s = cur(), held = heldBy(s, p);
    return U.tp + ": " + T.points[p] + ". " + (held ? U.on.replace("%s", held) : U.places.replace("%s", s.active));
  }
  /* what the display shows for a reading: the value, OL, or the card that replaces a reading */
  function shown(r, s) {
    if (!r || r.cls === "off") return "";
    if (r.cls === "value") return r.text;
    if (r.cls === "ol") return "OL";
    return C[r.cls] || "";
  }
  function noteOf(r, s) {
    if (!r) return "";
    if (r.cls === "value") return T.readingNote;
    if (r.cls === "ol") return s.meter.dial === "ohm" || s.meter.dial === "cont" ? C.olOhms : C.olRange;
    return "";
  }
  function lampText(r) { var l = r && r.circuit.lamps.L1; return l ? C.lamp + ": " + C[l] + "." : ""; }
  function eventText(r) {
    return r ? line(r.events.meterFuse ? C.meterFuseOpened : "", r.events.circuitFuse ? C.circuitFuseOpened : "") : "";
  }

  /* ---------- painting ---------- */
  function paintEls(r, s) {
    var st = r && S.mode() !== DG ? r.circuit.elements : null, inp = s.ctl;
    Object.keys(els).forEach(function (id) {
      var x = els[id], e = byEl[id], v = st && st[id], w = "", c, f;
      c = Sh.lineClass(x.base, v ? { state: v.state, dir: v.flow ? v.dir : 0 } : null, ["pos", "mid", "gnd"]);
      if (e.type === "lamp" && r) { w = r.circuit.lamps[id] || "off"; c += " lv-" + w; w = C[w]; }
      else if (e.type === "fuse" && r && r.circuit.fuses[id] && !e.bench) {
        f = r.circuit.fuses[id];
        if (f === "blown" && S.mode() === DG) f = "ok";
        c += " fz-" + f; w = f === "ok" ? U.inPlace : f === "blown" ? U.blown : U.removed;
      } else if (e.type === "switch" && e.ctl) { c += inp[e.ctl] ? " sw-closed" : " sw-open"; w = inp[e.ctl] ? U.closed : U.open; }
      else if (e.type === "source") { c += inp.power ? " pw-on" : " pw-off"; w = inp.power ? U.conn : U.disc; }
      else if (e.type === "connector" && e.cut) w = inp[e.cut] ? U.parted : U.joined;
      if ((e.cut && inp[e.cut] && e.type !== "fuse") || (e.ctl && e.type === "wire" && !inp[e.ctl])) c += " cut";
      if (x.cls !== c) { x.g.setAttribute("class", c); x.cls = c; }
      if (x.word) text(x.word, w);
    });
    all(svg, "[data-bench]").forEach(function (g) { show(g, !!inp[g.getAttribute("data-bench")]); });
  }

  function paintPoints(r, s) {
    var m = S.mode(), on = m !== "explore" && (m !== DG || !!dg.d), park = byId("mm-park"), xy = {};
    Object.keys(tps).forEach(function (p) {
      flag(tps[p].g, "has-red", on && heldBy(s, p) === "red");
      flag(tps[p].g, "has-black", on && heldBy(s, p) === "black");
    });
    ["red", "black"].forEach(function (k) {
      var g = leadG[k], d = k === "red" ? -15 : 15, t = s.together ? null : tps[s[k]], cx, cy, tr;
      if (s.together && park) { cx = +park.getAttribute("data-cx") + d * 0.7; cy = +park.getAttribute("data-cy"); }
      else if (t && usable(s[k])) { cx = t.cx + d; cy = t.cy + d; }
      show(g, on && cx != null);
      if (cx == null) return;
      xy[k] = [cx, cy];
      tr = "translate(" + cx + " " + cy + ")";
      if (g.getAttribute("transform") !== tr) g.setAttribute("transform", tr);
    });
    var b = byId("mm-bridge");
    if (b) {
      show(b, on && !s.together && !!xy.red && !!xy.black);
      if (xy.red && xy.black) {
        b.setAttribute("x1", xy.red[0]); b.setAttribute("y1", xy.red[1]); b.setAttribute("x2", xy.black[0]); b.setAttribute("y2", xy.black[1]);
      }
      flag(b, "mv", !!r && m === "meter" && s.meter.jack === "a" && Math.abs(r.meterI) > P.flowMin);
    }
  }

  function paintFace(r, s) {
    if (face.val) text(face.val, r && (r.cls === "value" || r.cls === "ol") ? shown(r, s) : "");
    if (face.ptr) {
      var tr = "rotate(" + angle(E.dials.indexOf(s.meter.dial)) + " " + face.ptr.getAttribute("data-cx") + " " + face.ptr.getAttribute("data-cy") + ")";
      if (face.ptr.getAttribute("transform") !== tr) face.ptr.setAttribute("transform", tr);
    }
    if (face.fuse) show(face.fuse, s.meterBlown);
    if (face.beep) show(face.beep, !!(r && r.beep));
    all(svg, "[data-jack-mark]").forEach(function (j) { flag(j, "on", j.getAttribute("data-jack-mark") === s.meter.jack); });
  }

  function showReading(r, s) {
    var c = r ? r.cls : "", v = shown(r, s);
    if (S.mode() === DG && !dg.d) v = U.pick;
    else if (c === "idle") v = C.idle;
    text(ui.val, v);
    text(ui.note, noteOf(r, s));
    ui.beep.hidden = !(r && r.beep);
    text(ui.leads, S.mode() === DG && !dg.d ? "" : leadsText(s));
    flag(ui.read, "mm-msg", c !== "value" && c !== "ol");
  }

  /* one reading of the state shown now; null before a drill is picked */
  function paint() {
    var s = cur(), r = S.mode() === DG && !dg.d ? null : read(s);
    paintEls(r, s);
    paintPoints(r, s);
    paintFace(r, s);
    showReading(r, s);
    return r;
  }

  function pressAll() {
    var s = cur(), m = S.mode(), dcv = s.meter.dial === "dcv", dd = m === DG ? dg.d : null;
    all(ui.dock, "[data-dial]").forEach(function (b) { press(b, s.meter.dial === b.getAttribute("data-dial")); });
    all(ui.dock, "[data-jack]").forEach(function (b) { press(b, s.meter.jack === b.getAttribute("data-jack")); });
    all(ui.dock, "[data-lead]").forEach(function (b) { press(b, !s.together && s.active === b.getAttribute("data-lead")); });
    all(S.el.side, "[data-ctl]").forEach(function (b) { press(b, !!s.ctl[b.getAttribute("data-ctl")]); });
    all(S.el.side, "[data-range]").forEach(function (b) { press(b, s.meter.range === b.getAttribute("data-range")); });
    all(S.el.side, "[data-rg]").forEach(function (g) { g.hidden = !dcv; });
    all(S.el.side, "[data-act]").forEach(function (b) {
      var k = b.getAttribute("data-act"), listed = !dd || dd.controls.indexOf(k) >= 0;
      if (k === "together") press(b, s.together);
      else if (k === "replaceFuse") b.hidden = !s.blown.F1 || (!!dd && !s.own.F1);
      else if (k === "replaceMeterFuse") b.hidden = !s.meterBlown || (!!dd && !s.own.meter && !listed);
      else if (k === "newLeads") b.hidden = !s.leadBroken || (!!dd && D && !D.leadsOk(dd, s));
    });
  }

  /* after every change: buttons, one reading, roles, the drill step, the status line */
  function after(msg) {
    var r = paint();
    if (D && S.mode() === DG && dg.d && r) D.seen(dg, r);
    pressAll();
    S.setRoles();
    S.say(line(msg, eventText(r), lampText(r)), []);
    return r;
  }

  /* ---------- actions ---------- */
  function tap(p) {
    var s = cur(), held = heldBy(s, p), lead = s.active, n;
    if (!usable(p)) return;
    if (held) { S.say(U.already.replace("%s", held) + " " + T.points[p] + ".", []); return; }
    n = placeLead(s, p);
    s.red = n.red; s.black = n.black; s.active = n.active;
    after(line(cap(lead) + " " + U.leadOn + " " + T.points[p] + ".", s.red && s.black ? "" : U.next.replace("%s", s.active)));
  }
  function act(b) {
    var s = cur(), k, v, msg = "";
    if (S.mode() === DG && !dg.d) return;
    if ((v = b.getAttribute("data-dial"))) s.meter = { dial: v, jack: s.meter.jack, range: s.meter.range };
    else if ((v = b.getAttribute("data-jack"))) s.meter = { dial: s.meter.dial, jack: v, range: s.meter.range };
    else if ((v = b.getAttribute("data-range"))) s.meter = { dial: s.meter.dial, jack: s.meter.jack, range: v };
    else if ((v = b.getAttribute("data-lead"))) { s.active = v; s.together = false; msg = U.nextTap.replace("%s", v); }
    else if ((k = b.getAttribute("data-ctl"))) {
      s.ctl[k] = !s.ctl[k];
      ["red", "black"].forEach(function (x) { var q = pt(s[x]); if (q && q.bench && !s.ctl[q.bench]) s[x] = null; });
      msg = sentence([COND[k] ? COND[k][s.ctl[k] ? 0 : 1] : T.controls[k]]);
    } else if ((k = b.getAttribute("data-act"))) {
      if (k === "together") { s.together = !s.together; if (s.together) { s.red = s.black = null; s.active = "red"; } }
      else if (k === "replaceFuse") { delete s.blown.F1; s.own.F1 = false; msg = U.fresh; }
      else if (k === "replaceMeterFuse") { s.meterBlown = false; s.own.meter = false; msg = U.meterFresh; }
      else if (k === "newLeads") { s.leadBroken = false; msg = U.leadsFresh; }
    }
    var r = after(msg);
    if (k === "replaceFuse" && r && r.events.circuitFuse) S.say(line(U.again, lampText(r)), []);
  }

  /* ---------- markup ---------- */
  function mk(tag, cls, s, a, parent, id) {
    var n = make(tag, cls, s), j;
    for (j in a || {}) if (has(a, j)) n.setAttribute(j, a[j]);
    if (tag === "button") n.type = "button";
    if (id) n.id = id;
    if (parent) parent.appendChild(n);
    return n;
  }
  function grp(label, parent, id, cls) { return mk("div", cls || "sim-row", null, { role: "group", "aria-label": label }, parent, id); }
  function tog(s, a, parent) { a["aria-pressed"] = "false"; return mk("button", "sim-tog", s, a, parent); }
  /* the board controls of a panel; keys: inputs and actions (a drill offers its own list) */
  function ctlRow(parent, keys, id) {
    var g = grp(U.ctl, parent, id);
    keys.forEach(function (k) {
      if (k === "range") {
        var rg = grp(T.controls.range, parent, null, "sim-row mm-range");
        rg.setAttribute("data-rg", "");
        E.ranges.forEach(function (x) { if (T.ranges[x]) tog(T.ranges[x], { "data-range": x }, rg); });
      } else if (CTL.indexOf(k) >= 0 || k === "together") tog(T.controls[k], k === "together" ? { "data-act": k } : { "data-ctl": k }, g);
      else if (ACTS.indexOf(k) >= 0) mk("button", "sim-btn", T.controls[k], { "data-act": k, hidden: "" }, g);
    });
    return g;
  }
  function controls() {
    var side = S.el.side, mp = S.el.panels.meter, k;
    if (!byId("sim-dock")) {
      var dock = mk("div", "sim-dock mm-dock", null, null, null, "sim-dock"), rd = mk("div", "mm-read", null, null, dock, "mm-read");
      var disp = mk("div", "mm-disp", null, null, rd);
      mk("p", "mm-val", null, { "aria-live": "polite", "aria-atomic": "true", "aria-describedby": "mm-note" }, disp, "mm-val");
      mk("p", "mm-beep", U.beep, { hidden: "" }, disp, "mm-beep");
      mk("p", "mm-leads", null, null, rd, "mm-leads");
      mk("p", "mm-note sim-rd-note", null, null, rd, "mm-note");
      var gd = grp(U.dial, dock, null, "sim-row mm-dial");
      E.dials.forEach(function (d) { tog(T.dials[d], { "data-dial": d, "aria-label": T.dialNames[d] }, gd); });
      var gj = grp(U.jacks, dock, null, "sim-row mm-jacks");
      mk("span", "mm-com", U.com, null, gj);
      E.jacks.forEach(function (j) { tog(T.jacks[j], { "data-jack": j, "aria-label": U.inJack.replace("%s", T.jacks[j]) }, gj); });
      tog(U.red, { "data-lead": "red", "aria-label": U.red + " " + U.lead }, gj).className += " mm-red";
      tog(U.black, { "data-lead": "black", "aria-label": U.black + " " + U.lead }, gj).className += " mm-black";
      var fp = side.querySelector("[data-panel]");
      side.insertBefore(dock, fp && fp.parentNode === side ? fp : null);
    }
    if (mp && !byId("mm-mctl")) ctlRow(mp, CTL.concat(["together", "replaceFuse", "replaceMeterFuse", "range"]), "mm-mctl");
    ["dock:sim-dock", "read:mm-read", "val:mm-val", "beep:mm-beep", "leads:mm-leads", "note:mm-note"].forEach(function (x) {
      x = x.split(":"); ui[x[0]] = byId(x[1]);
      if (!ui[x[0]]) throw new Error("missing #" + x[1]);
    });
    face.val = byId("mm-face-val"); face.ptr = byId("mm-pointer"); face.fuse = byId("mm-face-fuse"); face.beep = byId("mm-face-beep");
    byId("sim-app").addEventListener("click", function (ev) {
      var b = closest(ev.target, "[data-dial],[data-jack],[data-range],[data-lead],[data-ctl],[data-act]");
      if (b && !b.disabled) act(b);
    });
  }
  function collect() {
    def.elements.forEach(function (e) { byEl[e.id] = e; });
    all(svg, "[data-el]").forEach(function (g) {
      var id = g.getAttribute("data-el");
      if (byEl[id]) els[id] = { g: g, base: g.getAttribute("class") || "", cls: null, word: g.querySelector(".mm-st") };
    });
    all(svg, "[data-tp]").forEach(function (g) {
      var p = g.getAttribute("data-tp"), c = g.querySelector("circle.hit") || g.querySelector("circle");
      tps[p] = { g: g, cx: +(g.getAttribute("data-cx") || (c && c.getAttribute("cx")) || 0), cy: +(g.getAttribute("data-cy") || (c && c.getAttribute("cy")) || 0) };
      if (T.points[p] && !g.getAttribute("data-name")) g.setAttribute("data-name", U.tp + ": " + T.points[p]);
    });
    ["red", "black"].forEach(function (k) {
      var g = svg.querySelector("#lead-" + k);
      if (!g) {
        g = doc.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("id", "lead-" + k); g.setAttribute("class", "lead lead-" + k); g.setAttribute("aria-hidden", "true");
        g.setAttribute("pointer-events", "none"); g.setAttribute("display", "none");
        var c = doc.createElementNS("http://www.w3.org/2000/svg", "circle"), t = doc.createElementNS("http://www.w3.org/2000/svg", "text");
        c.setAttribute("r", 11); t.setAttribute("y", 5); t.setAttribute("text-anchor", "middle");
        t.textContent = k === "red" ? "+" : "\u2212";
        g.appendChild(c); g.appendChild(t); svg.appendChild(g);
      }
      leadG[k] = g;
    });
  }

  /* ---------- shell hooks ---------- */
  function onMode(m) {
    ui.dock.hidden = m === "explore";
    after("");
  }
  function roleLabel(g) { var p = g.getAttribute("data-tp"); return p && usable(p) ? tpLabel(p) : null; }
  function activate(g) { var p = g.getAttribute("data-tp"); if (p) tap(p); }

  function fail(app, err) {
    if (Sh && Sh.fail) { Sh.fail(app, err); return; }
    var f = byId("sim-fail");
    if (f) f.hidden = false;
    app.setAttribute("data-sim", "failed");
  }

  function init() {
    var app = byId("sim-app"), M = root.MmDrills;
    if (!app) return;
    Sh = root.SimShell;
    try {
      E = root.MmEngine;
      ID = app.getAttribute("data-circuit") || "mm-12v";
      def = E && root.DcCircuits && root.DcCircuits.get ? root.DcCircuits.get(ID) : null;
      if (!def || !Sh || !Sh.create || typeof E.read !== "function" || E.check(ID).length) { fail(app, null); return; }
      has = Sh.dom.has; copy = Sh.dom.copy; all = Sh.dom.all; flag = Sh.dom.flag; press = Sh.dom.press;
      text = Sh.dom.text; make = Sh.dom.make; closest = Sh.dom.closest;
      T = def.text; C = T.cards; P = def.params;
      ms = fresh(null); dg = fresh(null);
      var hooks = { mode: onMode, label: roleLabel, activate: activate };
      if (M && M.attach) D = M.attach({ def: def, E: E, ID: ID, R: R, fresh: fresh, inputs: inputs, probeOf: probeOf,
        state: function (s) { if (s) dg = s; return dg; }, after: after, leadsText: leadsText, shown: shown, noteOf: noteOf,
        mk: mk, grp: grp, ctlRow: ctlRow, cond: COND }, hooks);
      S = Sh.create({
        app: app, modes: D ? MODES : MODES.slice(0, 2), start: "meter", scenarioMode: DG, trade: app.getAttribute("data-trade") || "multi",
        scenarios: D ? D.scenarios : [], targets: "[data-info], [data-tp]",
        names: { modes: MODE_NAME, panels: PANEL, hints: HINT, faults: T.causes, symptoms: T.drills },
        ui: D ? D.ui : {}, hooks: hooks
      });
      svg = S.el.fig.querySelector("svg.sim-svg");
      if (!svg || !svg.querySelector("[data-tp]")) { fail(app, null); return; }
      S.setSvg(svg);
      collect();
      controls();
      if (D) D.bind(S);
      S.start();
    } catch (err) {
      fail(app, err);
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
