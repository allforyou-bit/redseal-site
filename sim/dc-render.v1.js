/* DC circuit fault lab renderer, v1.
   The DC view on top of sim-shell.v1.js: the red and black meter leads, the meter (DC volts, and
   resistance only with the battery disconnected), lamp, fuse, switch and battery states, the controls
   and the Find the fault readings. The drawing is the page SVG, or the dc-board.v1.js board when the
   page has none. Rules kept here:
   - Every reading comes from DcEngine with the full set of inputs the visitor sees. A scenario starts
     from the circuit inputs plus its own base (the switch-off scenario starts with the switch off), so
     diagnose() never fills in a value the screen does not show.
   - Every number shown is a computed reading, with the example-value label of the circuit data in the
     same block. Other text carries no figures: part numbers and view names only.
   - Find the fault draws the circuit neutral: no line states and no current arrows, only the symptom
     picture (lamps and fuses) and the readings the visitor takes.
   - Leads and parts change by class, transform and display only, and no state is colour alone: lamps,
     fuses, the switch and the battery carry a word, the leads a sign and a label.
   - A lead is placed by a tap, by Enter or Space on a focused test point, or (Find the fault) from the
     test point list.
   Drawing contract: [data-el] groups (element ids, optional .dc-nm and .dc-st text, optional data-name:
   kept, except where the name changes with the view), [data-tp] groups
   with data-cx and data-cy (or a circle.hit), [data-view] on view-only groups, g#lead-red, g#lead-black. */
(function (root) {
  "use strict";

  /* one tap with the active lead: s = { red, black, active }. A tap on a point a lead already holds does
     nothing. The first red lead hands over to black; the black lead that completes the pair hands back
     to red, so the black lead can stay on a ground point while the red lead moves. */
  function placeLead(s, pt) {
    var o = { red: s.red || null, black: s.black || null, active: s.active === "black" ? "black" : "red" };
    if (!pt || o.red === pt || o.black === pt) return o;
    var other = o.active === "red" ? "black" : "red", was = o[o.active];
    o[o.active] = pt;
    if (!o[other]) o.active = other;
    else if (!was && o.active === "black") o.active = "red";
    return o;
  }
  root.DcRender = { version: 1, placeLead: placeLead };

  var doc = root.document;
  if (!doc || !doc.getElementById) return;

  var DG = "diagnose", MODES = ["explore", "meter", DG];
  var MODE_NAME = { explore: "Explore", meter: "Meter", diagnose: "Find the fault" };
  var PANEL = { explore: "Explore the parts", meter: "Measure the circuit", diagnose: "Fault scenarios" };
  var HINT = {
    explore: "Tap a part of the drawing, or move to it with the Tab key and press Enter, to read what it is.",
    meter: "Tap a test point, or move to it with the Tab key and press Enter, to place the selected lead. The meter reads as soon as both leads are on.",
    diagnose: "Pick a scenario, read the symptom, set the controls, take readings, then choose the cause."
  };
  var LAND = ["TP_L1P", "TP_CH"];      /* Meter lands on a reading: lamp 1 positive to chassis ground */
  var METER = { volts: "DC volts", ohms: "Resistance" };
  var NAMES = { BAT1: "Battery", BAT2: "Battery 2", F1: "Fuse 1", F2: "Fuse 2", S1: "Switch", L1: "Lamp 1",
    L2: "Lamp 2", L3: "Circuit 2 lamp" }, NAMES24 = { BAT1: "Battery 1" };
  var LEVEL = { off: "off", dim: "dim", bright: "bright" }, FUSE = { ok: "in place", blown: "blown", removed: "removed" };
  var COND = { s1: ["switch on", "switch off"], power: ["battery connected", "battery disconnected"],
    removeF1: ["fuse 1 removed", "fuse 1 in place"], unplugC1: ["lamp 1 unplugged", "lamp 1 plugged in"],
    unplugC2: ["lamp 2 unplugged", "lamp 2 plugged in"] };
  var U = {
    tp: "Test point", places: "Places the %s lead.", on: "The %s lead is on it.", already: "The %s lead is already on",
    leadOn: "lead on", next: "Next, place the %s lead.", nextTap: "The next tap places the %s lead.",
    red: "Red", black: "Black", none: "not placed", place: "Place the red and black leads on two test points.",
    pick: "Pick a scenario to start.", noRead: "No reading at these points.", healthy: "Same test on a healthy circuit",
    meter: "Meter",
    view: "view.", offView: "lead taken off: that test point is not in this view.", fresh: "New fuse in place.",
    again: "%s opened again as soon as it went in.", closed: "closed", open: "open", conn: "connected",
    disc: "disconnected", board: "Parts and test points of the example circuit",
    more: "Check more test points before choosing a cause."
  };

  var Sh, E, S, def, T, ID, svg, has, copy, all, flag, press, text, make, button;
  var byEl = {}, els = {}, tps = {}, vgs = [], leadG = {}, ui = {}, last = { lamps: null, fuses: {} };
  var mt = { view: null, ctl: {}, blown: {}, mode: "volts", red: null, black: null, active: "red" };
  var dg = { sc: null, ctl: {}, start: {}, blown: {}, blown0: {}, mode: "volts", red: null, black: null,
    active: "red", seen: {}, items: {} };

  function byId(id) { return doc.getElementById(id); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function sentence(a) { return a.length ? cap(a.join(", ")) + "." : ""; }
  /* words joined by single spaces, empty parts left out */
  function line() { return Array.prototype.slice.call(arguments).filter(Boolean).join(" "); }
  function cur() { return S.mode() === DG ? dg : mt; }
  function viewNow() { return S.mode() === DG && dg.sc ? dg.sc.view : mt.view; }
  function inView(p) {
    var q = null;
    def.points.forEach(function (x) { if (x.id === p) q = x; });
    return !!q && (!q.views || q.views.indexOf(viewNow()) >= 0);
  }
  function offered(p) { return !!dg.sc && dg.sc.points.indexOf(p) >= 0; }
  function usable(p) { var m = S.mode(); return m !== "explore" && inView(p) && (m !== DG || offered(p)); }
  function heldBy(s, p) { return s.red === p ? "red" : s.black === p ? "black" : ""; }
  function nameOf(id) { var r = els[id]; return (r && r.fixed) || (viewNow() === "v24" && NAMES24[id]) || NAMES[id] || id; }
  function inputs(s, view) {
    var o = { view: view, blown: copy(s.blown) }, k;
    for (k in s.ctl) if (has(s.ctl, k)) o[k] = s.ctl[k];
    return o;
  }
  function probe(s) { return s.red && s.black ? { mode: s.mode, red: s.red, black: s.black } : null; }
  function ctlWord(k, on) { return COND[k] ? COND[k][on ? 0 : 1] : (T.controls[k] || k) + (on ? " on" : " off"); }
  function show(g, on) { if (on) g.removeAttribute("display"); else if (g.getAttribute("display") !== "none") g.setAttribute("display", "none"); }
  function leadsText(s) {
    return U.red + ": " + (s.red ? T.points[s.red] : U.none) + " \u00B7 " + U.black + ": " + (s.black ? T.points[s.black] : U.none);
  }
  function tpLabel(p) {
    var s = cur(), held = heldBy(s, p);
    return U.tp + ": " + T.points[p] + ". " + (held ? U.on.replace("%s", held) : U.places.replace("%s", s.active));
  }
  /* lamp levels and any blown fuse, in words */
  function status() {
    var a = [];
    def.elements.forEach(function (e) {
      if (e.type === "lamp" && last.lamps && last.lamps[e.id]) a.push(nameOf(e.id) + " " + LEVEL[last.lamps[e.id]]);
      if (e.type === "fuse" && last.fuses[e.id] === "blown") a.push(nameOf(e.id) + " " + FUSE.blown);
    });
    return sentence(a);
  }
  /* the test condition of a Find the fault reading: the scenario controls; a blown fuse is named in
     place of its own control word */
  function cond(inp, fuses) {
    var blown = {}, a;
    def.elements.forEach(function (e) {
      if (e.type === "fuse" && (fuses || {})[e.id] === "blown") blown[e.cut || e.id] = nameOf(e.id).toLowerCase() + " " + FUSE.blown;
    });
    a = (dg.sc.controls || []).filter(function (k) { return has(inp, k); }).map(function (k) {
      var w = blown[k] || ctlWord(k, inp[k]);
      delete blown[k];
      return w;
    });
    return sentence(a.concat(Object.keys(blown).map(function (k) { return blown[k]; })));
  }

  /* ---------- painting ---------- */
  function paintEls(st, lamps, fuses, inp) {
    Object.keys(els).forEach(function (id) {
      var r = els[id], e = byEl[id], x = st && st[id], w = "", c;
      if (!e) return;
      c = Sh.lineClass(r.base, x ? { state: x.state, dir: x.flow ? x.dir : 0 } : null, E.nodeStates);
      if (e.type === "lamp" && lamps) { w = lamps[id] || "off"; c += " lv-" + w; w = LEVEL[w]; }
      else if (e.type === "fuse" && fuses[id]) { c += " fz-" + fuses[id]; w = FUSE[fuses[id]]; }
      else if (e.type === "switch" && e.ctl && has(inp, e.ctl)) { c += inp[e.ctl] ? " sw-closed" : " sw-open"; w = inp[e.ctl] ? U.closed : U.open; }
      else if (e.type === "source" && has(inp, "power")) { c += inp.power ? " pw-on" : " pw-off"; w = inp.power ? U.conn : U.disc; }
      if (e.cut && inp[e.cut] && e.type !== "fuse") c += " cut";
      if (r.cls !== c) { r.g.setAttribute("class", c); r.cls = c; }
      text(r.word, w);
      if (!r.fixed) { text(r.nm, nameOf(id)); if (r.g.getAttribute("data-name") !== nameOf(id)) r.g.setAttribute("data-name", nameOf(id)); }
    });
  }

  function paintPoints() {
    var s = cur(), m = S.mode(), on = m !== "explore";
    Object.keys(tps).forEach(function (p) {
      var g = tps[p].g, menu = m !== DG || offered(p);
      flag(g, "dim", m === DG && !menu);
      flag(g, "pick", m === DG && menu);
      flag(g, "has-red", on && s.red === p);
      flag(g, "has-black", on && s.black === p);
    });
    ["red", "black"].forEach(function (k) {
      var g = leadG[k], p = on ? s[k] : null, t = p && tps[p], d = k === "red" ? -15 : 15, tr;
      show(g, !!t && inView(p));
      if (!t) return;
      tr = "translate(" + (t.cx + d) + " " + (t.cy + d) + ")";
      if (g.getAttribute("transform") !== tr) g.setAttribute("transform", tr);
    });
    all(ui.pts, "[data-pt]").forEach(function (b) {
      var p = b.getAttribute("data-pt"), held = heldBy(s, p);
      text(b, T.points[p] + (held ? " \u00B7 " + held + " lead" : ""));
    });
  }

  function showReading(r, ref) {
    var s = cur(), v, rf = !!(r && !r.blocked && ref && !ref.blocked);
    if (S.mode() === DG && !dg.sc) v = U.pick;
    else if (!s.red || !s.black) v = U.place;
    else if (!r) v = "";
    else if (r.blocked) v = T.blocked[r.blocked] || U.noRead;
    else v = r.text;
    text(ui.val, v);
    text(ui.leads, s.red || s.black ? leadsText(s) : "");
    text(ui.ref, rf ? U.healthy + ": " + ref.text : "");
    ui.ref.hidden = !rf;
    flag(ui.read, "dc-blocked", !!(r && r.blocked));
  }

  function paint() {
    var m = S.mode(), v = viewNow(), r = null, ref = null, d = null, inp, hi;
    vgs.forEach(function (x) { show(x.g, x.v.indexOf(v) >= 0); });
    if (m === DG && !dg.sc) {
      paintEls(null, null, {}, {});
      last = { lamps: null, fuses: {} };
    } else if (m === DG) {
      inp = inputs(dg, v);
      d = E.diagnose(ID, inp, dg.sc.id, probe(dg));
      dg.blown = copy(d.blown);
      paintEls(null, d.lamps, d.fuses, inp);
      r = d.reading;
      if (r && !r.blocked) {
        hi = copy(inp);
        hi.fault = null; hi.blown = {};
        ref = E.measure(ID, hi, probe(dg));
        record(r, inp, ref, d.fuses);
      }
      text(ui.cond, cond(inp, d.fuses));
    } else {
      inp = inputs(mt, v);
      d = E.derive(ID, inp);
      mt.blown = copy(d.blown);
      inp.blown = copy(d.blown);
      paintEls(d.elements, d.lamps, d.fuses, inp);
      if (m !== "explore" && probe(mt)) r = E.measure(ID, inp, probe(mt));
    }
    if (d) last = { lamps: d.lamps, fuses: d.fuses };
    paintPoints();
    showReading(r, ref);
  }

  function pressAll() {
    var s = cur(), m = S.mode(), sc = m === DG ? dg.sc : null;
    all(ui.dock, "[data-meter]").forEach(function (b) {
      var k = b.getAttribute("data-meter");
      press(b, s.mode === k);
      b.hidden = m === DG && !(sc && (sc.modes || ["volts"]).indexOf(k) >= 0);
    });
    all(ui.dock, "[data-lead]").forEach(function (b) { press(b, s.active === b.getAttribute("data-lead")); b.hidden = m === DG && !sc; });
    all(ui.dock, "[data-ctl]").forEach(function (b) {
      b.hidden = m === DG && !(sc && (sc.controls || []).indexOf(b.getAttribute("data-ctl")) >= 0);
    });
    all(S.el.side, "[data-ctl]").forEach(function (b) { press(b, !!s.ctl[b.getAttribute("data-ctl")]); });
    all(ui.views, "[data-pick-view]").forEach(function (b) { press(b, mt.view === b.getAttribute("data-pick-view")); });
  }
  function after() { pressAll(); paint(); S.setRoles(); }

  /* ---------- Find the fault readings ---------- */
  /* a reading counts for a mustView entry when it is the same test (leads either way round, the same
     conditions where the entry names them) and shows what that test shows from the scenario start */
  function fits(m, r, inp) {
    var k, w = m.when || {}, c;
    if (m.mode !== r.mode) return false;
    if (!((m.red === dg.red && m.black === dg.black) || (m.red === dg.black && m.black === dg.red))) return false;
    for (k in w) if (has(w, k) && !!inp[k] !== !!w[k]) return false;
    c = copy(dg.start);
    for (k in w) if (has(w, k)) c[k] = w[k];
    c.view = dg.sc.view;
    c.blown = copy(dg.blown0);
    c = E.diagnose(ID, c, dg.sc.id, { mode: r.mode, red: dg.red, black: dg.black }).reading;
    return !!c && !c.blocked && c.text === r.text;
  }
  function ready() { return (dg.sc.mustView || []).every(function (m, i) { return !!dg.seen[i]; }); }

  function record(r, inp, ref, fuses) {
    var c = cond(inp, fuses), key = [r.mode, dg.red, dg.black, c].join("|"), it = dg.items[key], rf = !!(ref && !ref.blocked);
    (dg.sc.mustView || []).forEach(function (m, i) { if (!dg.seen[i] && fits(m, r, inp)) dg.seen[i] = true; });
    if (!it) {
      it = dg.items[key] = { li: make("li", "sim-rd") };
      [["head", "sim-rd-h"], ["cond", "sim-rd-c"], ["val", "sim-rd-v"], ["ref", "sim-rd-r"], ["note", "sim-rd-note"]].forEach(function (x) {
        it[x[0]] = it.li.appendChild(make("p", x[1]));
      });
      text(it.note, T.readingNote);
    }
    text(it.head, leadsText(dg));
    text(it.cond, METER[r.mode] + ". " + c);
    text(it.val, r.text);
    text(it.ref, rf ? U.healthy + ": " + ref.text : "");
    it.ref.hidden = !rf;
    if (ui.reads.firstChild !== it.li) ui.reads.insertBefore(it.li, ui.reads.firstChild);
  }

  /* ---------- actions ---------- */
  function tap(p) {
    var s = cur(), held = heldBy(s, p), lead = s.active, n;
    if (!usable(p)) return;
    if (held) { S.say(U.already.replace("%s", held) + " " + T.points[p] + ".", []); return; }
    n = placeLead(s, p);
    s.red = n.red; s.black = n.black; s.active = n.active;
    after();
    S.say(line(cap(lead) + " " + U.leadOn + " " + T.points[p] + ".", s.red && s.black ? "" : U.next.replace("%s", s.active)), []);
  }
  function toggle(k) {
    var s = cur();
    if (S.mode() === DG && !dg.sc) return;
    s.ctl[k] = !s.ctl[k];
    after();
    S.say(line(sentence([ctlWord(k, s.ctl[k])]), status()), []);
  }
  function setMeter(k) {
    var s = cur();
    if (s.mode === k) return;
    s.mode = k;
    after();
    S.say(U.meter + ": " + METER[k] + ".", []);
  }
  function setLead(k) {
    cur().active = k;
    pressAll();
    S.setRoles();
    S.say(U.nextTap.replace("%s", k), []);
  }
  function setView(v) {
    var off = [];
    if (mt.view === v || !def.views[v]) return;
    mt.view = v;
    ["red", "black"].forEach(function (k) { if (mt[k] && !inView(mt[k])) { mt[k] = null; off.push(k); } });
    if (off.length) mt.active = off[0];
    after();
    S.say(line(def.views[v].label, U.view, off.length ? cap(off.join(" and ")) + " " + U.offView : "", status()), []);
  }
  function replaceFuse() {
    var s = cur(), was = [], again;
    def.elements.forEach(function (e) {
      if (e.type !== "fuse") return;
      if (s.blown[e.id] || (e.cut && s.ctl[e.cut])) was.push(e.id);
      delete s.blown[e.id];
      if (e.cut && has(s.ctl, e.cut)) s.ctl[e.cut] = false;
    });
    after();
    again = was.filter(function (f) { return last.fuses[f] === "blown"; });
    if (again.length) S.say(status(), [U.again.replace("%s", again.map(nameOf).join(", "))]);
    else S.say(line(U.fresh, status()), []);
  }

  /* ---------- shell hooks ---------- */
  function onMode(m) {
    ui.dock.hidden = m === "explore";
    pressAll();
    paint();
    if (m !== DG) S.say(status(), []);
    else if (dg.sc) S.say(line(ui.cond.textContent, status()), []);
  }
  function onScenario(sc) {
    var k;
    dg.sc = sc;
    dg.ctl = {};
    for (k in def.inputs) if (has(def.inputs, k)) dg.ctl[k] = !!def.inputs[k];
    for (k in sc.base || {}) if (has(sc.base, k)) dg.ctl[k] = !!sc.base[k];
    dg.start = copy(dg.ctl);
    dg.blown = {};
    dg.mode = (sc.modes || ["volts"])[0];
    dg.red = null; dg.black = null; dg.active = "red"; dg.seen = {}; dg.items = {};
    ui.reads.textContent = "";
    /* the first look: the symptom with the starting inputs; a fuse that opens at once stays open */
    dg.blown = copy(E.diagnose(ID, inputs(dg, sc.view), sc.id, null).blown);
    dg.blown0 = copy(dg.blown);
    ui.dctl.textContent = "";
    (sc.controls || []).forEach(function (k) {
      if (ui.dock.querySelector("[data-ctl=\"" + k + "\"]") || !T.controls[k]) return;
      var b = k === "replaceFuse" ? button("sim-btn", T.controls[k], { "data-act": k })
        : button("sim-tog", T.controls[k], { "data-ctl": k, "aria-pressed": "false" });
      b.addEventListener("click", k === "replaceFuse" ? replaceFuse : function () { toggle(k); });
      ui.dctl.appendChild(b);
    });
    ui.dctl.hidden = !ui.dctl.firstChild;
    ui.pts.textContent = "";
    sc.points.forEach(function (p) {
      var b = button("sim-tog dc-pt", T.points[p], { "data-pt": p });
      b.addEventListener("click", function () { tap(p); });
      ui.pts.appendChild(b);
    });
    after();
  }
  function roleLabel(g) { var p = g.getAttribute("data-tp"); return p && usable(p) ? tpLabel(p) : null; }
  function activate(g) { var p = g.getAttribute("data-tp"); if (p) tap(p); }

  /* ---------- markup ---------- */
  function sv(tag, a, parent, s) {
    var n = doc.createElementNS("http://www.w3.org/2000/svg", tag), k;
    for (k in a) if (has(a, k)) n.setAttribute(k, a[k]);
    if (s != null) n.textContent = s;
    return parent.appendChild(n);
  }
  function marker(k) {
    var g = sv("g", { id: "lead-" + k, "class": "lead lead-" + k, "pointer-events": "none", "aria-hidden": "true", display: "none" }, svg);
    sv("circle", { r: 11 }, g);
    sv("text", { y: 5, "text-anchor": "middle" }, g, k === "red" ? "+" : "\u2212");
    return g;
  }
  function collect() {
    all(svg, "[data-el]").forEach(function (g) {
      var id = g.getAttribute("data-el"), c = g.getAttribute("class") || "";
      /* a page data-name is kept, except for a name that changes with the view (Battery, Battery 1) */
      els[id] = { g: g, base: c, cls: c, word: g.querySelector(".dc-st"), nm: g.querySelector(".dc-nm"),
        fixed: NAMES24[id] ? null : g.getAttribute("data-name") };
    });
    all(svg, "[data-tp]").forEach(function (g) {
      var p = g.getAttribute("data-tp"), c = g.querySelector("circle.hit") || g.querySelector("circle");
      tps[p] = { g: g, cx: +(g.getAttribute("data-cx") || (c && c.getAttribute("cx")) || 0),
        cy: +(g.getAttribute("data-cy") || (c && c.getAttribute("cy")) || 0) };
      if (T.points[p] && !g.getAttribute("data-name")) g.setAttribute("data-name", U.tp + ": " + T.points[p]);
    });
    all(svg, "[data-view]").forEach(function (g) { vgs.push({ g: g, v: g.getAttribute("data-view").split(/\s+/) }); });
    ["red", "black"].forEach(function (k) { leadG[k] = svg.querySelector("#lead-" + k) || marker(k); });
  }

  function bindAll(scope, attr, fn) {
    all(scope, "[" + attr + "]").forEach(function (b) { b.addEventListener("click", function () { fn(b.getAttribute(attr)); }); });
  }
  /* the dock, the Meter panel rows and the Find the fault work area: page markup, or dc-board.v1.js */
  function bindControls() {
    ["dock:sim-dock", "read:dc-read", "val:dc-val", "leads:dc-leads", "ref:dc-ref", "note:dc-note", "views:dc-views",
      "mctl:dc-mctl", "dctl:dg-ctl", "cond:dg-cond", "pts:dg-pts", "reads:dg-reads"].forEach(function (x) {
      x = x.split(":");
      ui[x[0]] = byId(x[1]);
      if (!ui[x[0]]) throw new Error("missing #" + x[1]);
    });
    text(ui.note, T.readingNote);
    bindAll(ui.dock, "data-meter", setMeter);
    bindAll(ui.dock, "data-lead", setLead);
    bindAll(ui.dock, "data-ctl", toggle);
    bindAll(ui.views, "data-pick-view", setView);
    bindAll(ui.mctl, "data-ctl", toggle);
  }

  function fail(app, err) {
    if (Sh && Sh.fail) { Sh.fail(app, err); return; }
    var f = byId("sim-fail");
    if (f) f.hidden = false;
    app.setAttribute("data-sim", "failed");
  }

  function init() {
    var app = byId("sim-app"), k, pts, B = root.DcBoard;
    if (!app) return;
    Sh = root.SimShell;
    try {
      E = root.DcEngine;
      ID = app.getAttribute("data-circuit") || "dc-lamp";
      def = E && root.DcCircuits && root.DcCircuits.get ? root.DcCircuits.get(ID) : null;
      if (!def || !Sh || !Sh.create || typeof E.diagnose !== "function") { fail(app, null); return; }
      has = Sh.dom.has; copy = Sh.dom.copy; all = Sh.dom.all; flag = Sh.dom.flag; press = Sh.dom.press;
      text = Sh.dom.text; make = Sh.dom.make; button = Sh.dom.button;
      T = def.text;
      def.elements.forEach(function (e) { byEl[e.id] = e; });
      S = Sh.create({
        app: app, modes: MODES, start: "meter", scenarioMode: DG, trade: app.getAttribute("data-trade") || "multi",
        scenarios: def.scenarios, targets: "[data-info], [data-tp]",
        names: { modes: MODE_NAME, panels: PANEL, hints: HINT, faults: T.faults, symptoms: T.symptoms },
        ui: { more: U.more },
        hooks: { mode: onMode, scenario: onScenario, ready: ready, label: roleLabel, activate: activate }
      });
      svg = S.el.fig.querySelector("svg.sim-svg");
      if (B && B.build && (!svg || !svg.querySelector("[data-tp]"))) {
        if (svg) svg.parentNode.removeChild(svg);
        svg = S.el.fig.insertBefore(B.build(def, doc, U.board), S.el.fig.firstChild);
      }
      if (!svg) { fail(app, null); return; }
      if (B && B.controls) B.controls(def, doc, S.el);
      S.setSvg(svg);
      collect();
      bindControls();
      mt.view = def.defaultView;
      for (k in def.inputs) if (has(def.inputs, k)) mt.ctl[k] = !!def.inputs[k];
      pts = def.points.map(function (p) { return p.id; }).filter(inView);
      mt.red = inView(LAND[0]) ? LAND[0] : pts[0];
      mt.black = inView(LAND[1]) && LAND[1] !== mt.red ? LAND[1] : pts[pts[0] === mt.red ? 1 : 0];
      S.start();
    } catch (err) {
      fail(app, err);
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
