/* Motor starter control lab renderer, v1. View C24 of the relay control fault lab, on sim-shell.v1.js
   and CtlEngine as dc-render.v1.js is on DcEngine: leads, meter (ohms only with the supply off), START and
   STOP (tap, or hold while the meter reads), supply, overload contact (Operate and meter only), contactor,
   motor block and the Find the fault readings.
   - The contactor state is history: apply() and tap() hand it back in inputs.contactors and the next
     action starts from it. Find the fault goes through diagnose(); the same actions on a sound circuit give
     the healthy line.
   - Every number shown is an engine reading with the example-value label beside it.
   - Find the fault draws the wires neutral and shows only what a visitor would see: buttons, supply,
     contactor, motor. No state is colour alone.
   Page contract: [data-el] (.ctl-st word), [data-node] wires with data-flow, [data-ct], [data-tp],
   g#lead-red, g#lead-black; #sim-dock, #ctl-mctl, #dg-ctl, #dg-cond, #dg-pts, #dg-reads. */
(function (root) {
  "use strict";

  /* one tap with the active lead, the dc-render.v1.js rule: s = { red, black, active } */
  function placeLead(s, pt) {
    var o = { red: s.red || null, black: s.black || null, active: s.active === "black" ? "black" : "red" };
    if (!pt || o.red === pt || o.black === pt) return o;
    var other = o.active === "red" ? "black" : "red", was = o[o.active];
    o[o.active] = pt;
    if (!o[other]) o.active = other;
    else if (!was && o.active === "black") o.active = "red";
    return o;
  }

  /* page and runtime text (circuit data text wins); gen_ctl_page.py builds the page markup from it */
  var TX = {
    modes: { explore: "Explore", meter: "Operate and meter", diagnose: "Find the fault" },
    panels: { explore: "Explore the parts", meter: "Operate and measure", diagnose: "Fault scenarios" },
    hints: {
      explore: "Tap a part of the drawing, or move to it with the Tab key and press Enter, to read what it is.",
      meter: "Tap START or STOP, or hold one, to operate the circuit. Tap a test point ring, or move to it with the Tab key and press Enter, to place the selected lead. The meter reads as soon as both leads are on.",
      diagnose: "Pick a scenario, read the symptom, operate the circuit, take readings, then choose the cause."
    },
    faults: {
      f_fuse: "Control fuse open", f_ol: "Overload contact open (tripped)", f_stop: "STOP contacts open",
      f_start: "START contacts do not close", f_seal: "Seal-in contact does not close", f_coil: "Contactor coil open",
      f_start_stuck: "START contacts stuck closed"
    },
    symptoms: {
      noStart: "The motor does not start: when START is pressed, the contactor does not pull in.",
      dropsOut: "The motor runs only while START is held: when START is released, the contactor drops out.",
      selfStart: "The contactor pulls in as soon as the supply comes on, with no button pressed. STOP holds it out only while STOP is held."
    },
    symptomOf: { f_fuse: "noStart", f_ol: "noStart", f_stop: "noStart", f_start: "noStart", f_coil: "noStart",
      f_seal: "dropsOut", f_start_stuck: "selfStart" },
    controls: { tapStart: "Tap START", start: "Hold START", tapStop: "Tap STOP", stop: "Hold STOP", power: "Supply on",
      tripOL: "Overload contact (reset)" },
    blocked: {
      power: "The supply is on. Switch the supply off to measure resistance.",
      source: "The supply is in the path between the leads, so resistance cannot be measured here.",
      point: "No reading at these points.", menu: "That test point is not offered in this scenario.",
      mode: "This scenario does not offer that meter setting."
    },
    readingNote: "Computed value for this example circuit, not a service limit.",
    meter: { volts: "DC volts", ohms: "Resistance" }
  };
  /* the readings that settle each fault (design section 3), for a scenario with no mustView */
  function mv(r, b, w) { return { mode: "volts", red: r, black: b, when: w }; }
  var HELD = { power: true, stop: false, start: true }, FREE = { power: true, stop: false, start: false };
  var MUST = {
    f_fuse: [mv("TP_P", "TP_F", HELD)], f_ol: [mv("TP_F", "TP_O", HELD)], f_stop: [mv("TP_O", "TP_S", HELD)],
    f_start: [mv("TP_S", "TP_C", HELD)], f_coil: [mv("TP_C", "TP_0", HELD)], f_seal: [mv("TP_C", "TP_0", HELD)],
    f_start_stuck: [mv("TP_S", "TP_C", FREE)]
  };
  root.CtlRender = { version: 1, placeLead: placeLead, text: TX, must: MUST };

  var doc = root.document;
  if (!doc || !doc.getElementById) return;

  var DG = "diagnose", MODES = ["explore", "meter", DG], LAND = ["TP_C", "TP_0"], DG_CTL = ["start", "stop", "power"];
  var BTN = { start: "START", stop: "STOP" };
  var U = {
    tp: "Test point", places: "Places the %s lead.", on: "The %s lead is on it.", already: "The %s lead is already on",
    leadOn: "lead on", next: "Next, place the %s lead.", nextTap: "The next tap places the %s lead.",
    red: "Red", black: "Black", none: "not placed", place: "Place the red and black leads on two test points.",
    pick: "Pick a scenario to start.", healthy: "Same test on a healthy circuit", meter: "Meter",
    more: "Take more readings before choosing a cause. Most tests need START held while the meter reads; the What to test column of the fault table lists them.",
    tapped: "%s tapped: pressed, then released.", held: "%s held.", released: "%s released.",
    pin: "The contactor pulled in.", pout: "The contactor dropped out.", stayIn: "The contactor stays pulled in.",
    stayOut: "The contactor stays dropped out.", inOut: "The contactor pulled in, then dropped out when %s was released.",
    outIn: "The contactor dropped out, then pulled in again when %s was released.",
    lvp: "Supply off, then on: the contactor does not restart in this example circuit.",
    ctOn: "Contactor pulled in, motor running.", ctOff: "Contactor dropped out, motor stopped.",
    supOn: "Supply on.", supOff: "Supply off.", olOpen: "Overload contact open (tripped).", olShut: "Overload contact closed (reset)."
  };
  var W = { on: "on", off: "off", pressed: "pressed", released: "released", closed: "closed", open: "open",
    tripped: "open (tripped)", pulled: "pulled in", dropped: "dropped out", run: "running", stop: "stopped" };
  var COND = { power: ["supply on", "supply off"], start: ["START held", "START released"], stop: ["STOP held", "STOP released"] };

  var Sh, E, S, def, T, ID, CT, svg, has, copy, all, flag, press, text, make, button;
  var byEl = {}, els = {}, nds = [], cts = [], tps = {}, leadG = {}, ui = {};
  var mt = { ctl: {}, on: {}, mode: "volts", red: null, black: null, active: "red", lvp: false };
  var dg = { sc: null, ctl: {}, on: {}, hon: {}, mode: "volts", red: null, black: null, active: "red", lvp: false,
    seen: {}, items: {} };

  function byId(id) { return doc.getElementById(id); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function sentence(a) { return a.length ? cap(a.join(", ")) + "." : ""; }
  function line() { return Array.prototype.slice.call(arguments).filter(Boolean).join(" "); }
  function cur() { return S.mode() === DG ? dg : mt; }
  function idle() { return S.mode() === DG && !dg.sc; }
  function offered(p) { return !!dg.sc && dg.sc.points.indexOf(p) >= 0; }
  function usable(p) { var m = S.mode(); return m !== "explore" && !!T.points[p] && (m !== DG || offered(p)); }
  function heldBy(s, p) { return s.red === p ? "red" : s.black === p ? "black" : ""; }
  /* controls and contactor history of a state (h: the healthy one) */
  function inputs(s, h) { var o = copy(s.ctl); o.contactors = copy(h ? s.hon : s.on); return o; }
  function probe(s) { return s.red && s.black ? { mode: s.mode, red: s.red, black: s.black } : null; }
  function leadsText(s) {
    return U.red + ": " + (s.red ? T.points[s.red] : U.none) + " \u00B7 " + U.black + ": " + (s.black ? T.points[s.black] : U.none);
  }
  function tpLabel(p) {
    var s = cur(), held = heldBy(s, p);
    return U.tp + ": " + T.points[p] + ". " + (held ? U.on.replace("%s", held) : U.places.replace("%s", s.active));
  }
  function status() {
    var s = cur(), a;
    if (idle()) return "";
    a = [s.on[CT] ? U.ctOn : U.ctOff];
    ["start", "stop"].forEach(function (k) { if (s.ctl[k]) a.push(U.held.replace("%s", BTN[k])); });
    if (!s.ctl.power) a.push(U.supOff);
    if (s.ctl.tripOL) a.push(U.olOpen);
    return a.join(" ");
  }
  /* what the contactor did: m0 before, m1 after the press (or the change), m2 after the release */
  function change(m0, m1, m2, k) {
    if (m1 !== m2) return (m1 ? U.inOut : U.outIn).replace("%s", BTN[k]);
    if (m0 === m1) return m1 ? U.stayIn : U.stayOut;
    return m1 ? U.pin : U.pout;
  }
  function cond(c) {
    return sentence(["power", "start", "stop"].filter(function (k) { return has(c, k); }).map(function (k) { return COND[k][c[k] ? 0 : 1]; }));
  }

  /* settle a state and keep the contactor states the engine hands back */
  function settle(s) {
    if (s === dg) {
      dg.on = copy(E.diagnose(ID, inputs(dg), dg.sc.id, null).contactors);
      dg.hon = copy(E.apply(ID, inputs(dg, true)).inputs.contactors);
    } else mt.on = copy(E.apply(ID, inputs(mt)).inputs.contactors);
    return !!s.on[CT];
  }

  /* ---------- painting ---------- */
  /* d: CtlEngine.derive (Operate and meter, Explore) or null (Find the fault: neutral wires) */
  function paintEls(d, inp, on) {
    var blank = !has(inp, "power");
    nds.forEach(function (n) {
      var st = d && d.nodes[n.node], f = d && n.flow && d.elements[n.flow];
      var c = Sh.lineClass(n.base, st ? { state: st, dir: f && f.flow ? f.dir : 0 } : null, E.nodeStates);
      if (n.cls !== c) { n.g.setAttribute("class", c); n.cls = c; }
    });
    Object.keys(els).forEach(function (id) {
      var r = els[id], e = byEl[id], x = d && d.elements[id], c = r.base, w = "", shut, k;
      if (!e || blank) { /* the drawing as printed */ }
      else if (e.type === "source") { c += inp.power ? " pw-on" : " pw-off"; w = inp.power ? W.on : W.off; }
      else if (e.type === "switch" || e.type === "contact") {
        /* Operate and meter: the engine state; Find the fault: the buttons and the contactor only */
        shut = x ? !x.open : e.type === "contact" ? (e.form === "no") === !!on[e.of] : (!e.ctl || !!inp[e.ctl]) && !(e.cut && inp[e.cut]);
        c += shut ? " sw-closed" : " sw-open";
        k = e.ctl || e.cut;
        if (BTN[k]) { if (inp[k]) c += " pressed"; w = inp[k] ? W.pressed : W.released; }
        else if (x) w = shut ? W.closed : e.cut ? W.tripped : W.open;
      } else if (e.type === "coil") { if (on[e.contactor]) c += " co-on"; w = on[e.contactor] ? W.pulled : W.dropped; }
      if (r.cls !== c) { r.g.setAttribute("class", c); r.cls = c; }
      text(r.word, w);
    });
    cts.forEach(function (m) {
      var c = m.base + (!blank && on[m.ct] ? " ct-on" : "");
      if (m.cls !== c) { m.g.setAttribute("class", c); m.cls = c; }
      text(m.word, blank ? "" : on[m.ct] ? W.run : W.stop);
    });
  }

  function show(g, on) { if (on) g.removeAttribute("display"); else if (g.getAttribute("display") !== "none") g.setAttribute("display", "none"); }
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
      show(g, !!t);
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
    if (idle()) v = U.pick;
    else if (!s.red || !s.black) v = U.place;
    else if (!r) v = "";
    else if (r.blocked) v = T.blocked[r.blocked] || T.blocked.point;
    else v = r.text;
    text(ui.val, v);
    text(ui.leads, s.red || s.black ? leadsText(s) : "");
    text(ui.ref, rf ? U.healthy + ": " + ref.text : "");
    ui.ref.hidden = !rf;
    flag(ui.read, "ctl-blocked", !!(r && r.blocked));
    flag(ui.read, "ctl-msg", !(r && !r.blocked && v === r.text) && !(r && r.blocked));
  }

  function paint() {
    var m = S.mode(), r = null, ref = null, d;
    if (idle()) paintEls(null, {}, {});
    else if (m === DG) {
      d = E.diagnose(ID, inputs(dg), dg.sc.id, probe(dg));
      dg.on = copy(d.contactors);
      paintEls(null, dg.ctl, dg.on);
      r = d.reading;
      if (r && !r.blocked) {
        ref = E.measure(ID, inputs(dg, true), probe(dg));
        record(r, ref);
      }
      text(ui.cond, cond(dg.ctl));
    } else {
      d = E.derive(ID, inputs(mt));
      mt.on = copy(d.contactors);
      paintEls(d, mt.ctl, mt.on);
      if (m !== "explore" && probe(mt)) r = E.measure(ID, inputs(mt), probe(mt));
    }
    paintPoints();
    showReading(r, ref);
  }

  function pressAll() {
    var s = cur(), m = S.mode(), sc = m === DG ? dg.sc : null, off = idle();
    all(ui.dock, "[data-meter]").forEach(function (b) {
      var k = b.getAttribute("data-meter");
      press(b, s.mode === k);
      b.hidden = off || (!!sc && (sc.modes || ["volts"]).indexOf(k) < 0);
    });
    all(ui.dock, "[data-lead]").forEach(function (b) { press(b, s.active === b.getAttribute("data-lead")); b.hidden = off; });
    all(ui.dock, "[data-tap], [data-ctl]").forEach(function (b) { b.hidden = off; });
    /* a tap needs the button up: it is off while the same button is held */
    all(ui.dock, "[data-tap]").forEach(function (b) { b.disabled = !!s.ctl[b.getAttribute("data-tap")]; });
    /* the overload contact control is pressed while the contact is reset (closed) */
    all(S.el.side, "[data-ctl]").forEach(function (b) {
      var k = b.getAttribute("data-ctl"), v = !!s.ctl[k];
      press(b, k === "tripOL" ? !v : v);
    });
  }
  function after() { pressAll(); paint(); S.setRoles(); }

  /* ---------- Find the fault readings ---------- */
  function must() { return dg.sc.mustView || MUST[dg.sc.correct] || []; }
  /* the same test (leads either way round) under the inputs the entry names */
  function fits(m, r) {
    var k, w = m.when || {};
    if (m.mode !== r.mode) return false;
    if (!((m.red === dg.red && m.black === dg.black) || (m.red === dg.black && m.black === dg.red))) return false;
    for (k in w) if (has(w, k) && !!dg.ctl[k] !== !!w[k]) return false;
    return true;
  }
  function ready() { return must().every(function (m, i) { return !!dg.seen[i]; }); }

  function record(r, ref) {
    var c = cond(dg.ctl), key = [r.mode, dg.red, dg.black, c].join("|"), it = dg.items[key], rf = !!(ref && !ref.blocked);
    must().forEach(function (m, i) { if (!dg.seen[i] && fits(m, r)) dg.seen[i] = true; });
    if (!it) {
      it = dg.items[key] = { li: make("li", "sim-rd") };
      [["head", "sim-rd-h"], ["cond", "sim-rd-c"], ["val", "sim-rd-v"], ["ref", "sim-rd-r"], ["note", "sim-rd-note"]].forEach(function (x) {
        it[x[0]] = it.li.appendChild(make("p", x[1]));
      });
      text(it.note, T.readingNote);
    }
    text(it.head, leadsText(dg));
    text(it.cond, TX.meter[r.mode] + ". " + c);
    text(it.val, r.text);
    text(it.ref, rf ? U.healthy + ": " + ref.text : "");
    it.ref.hidden = !rf;
    if (ui.reads.firstChild !== it.li) ui.reads.insertBefore(it.li, ui.reads.firstChild);
  }

  /* ---------- actions ---------- */
  function place(p) {
    var s = cur(), held = heldBy(s, p), lead = s.active, n;
    if (!usable(p)) return;
    if (held) { S.say(U.already.replace("%s", held) + " " + T.points[p] + ".", []); return; }
    n = placeLead(s, p);
    s.red = n.red; s.black = n.black; s.active = n.active;
    after();
    S.say(line(cap(lead) + " " + U.leadOn + " " + T.points[p] + ".", s.red && s.black ? "" : U.next.replace("%s", s.active)), []);
  }
  /* a held button, the supply, the overload contact */
  function toggle(k) {
    var s = cur(), m0, m1, msg;
    if (idle()) return;
    m0 = !!s.on[CT];
    s.ctl[k] = !s.ctl[k];
    m1 = settle(s);
    if (BTN[k]) msg = line((s.ctl[k] ? U.held : U.released).replace("%s", BTN[k]), change(m0, m1, m1, k));
    else if (k === "power") {
      if (!s.ctl.power && m0) s.lvp = true;
      msg = line(s.ctl.power ? U.supOn : U.supOff, s.ctl.power && s.lvp && !m1 ? U.lvp : change(m0, m1, m1, k));
      if (s.ctl.power) s.lvp = false;
    } else msg = line(s.ctl[k] ? U.olOpen : U.olShut, change(m0, m1, m1, k));
    after();
    S.say(msg, []);
  }
  /* a momentary press: Operate and meter through CtlEngine.tap, Find the fault through diagnose */
  function tapBtn(k) {
    var s = cur(), m0, m1, m2, before, down;
    if (idle() || s.ctl[k]) return;
    m0 = !!s.on[CT];
    if (s === mt) {
      before = inputs(mt);
      down = copy(before); down[k] = true;
      m1 = !!E.apply(ID, down).inputs.contactors[CT];
      mt.on = copy(E.tap(ID, before, k).inputs.contactors);
      m2 = !!mt.on[CT];
    } else {
      dg.ctl[k] = true; m1 = settle(dg);
      dg.ctl[k] = false; m2 = settle(dg);
    }
    after();
    S.say(line(U.tapped.replace("%s", BTN[k]), change(m0, m1, m2, k)), []);
  }
  function setMeter(k) {
    var s = cur();
    if (s.mode === k) return;
    s.mode = k;
    after();
    S.say(U.meter + ": " + TX.meter[k] + ".", []);
  }
  function setLead(k) {
    cur().active = k;
    pressAll();
    S.setRoles();
    S.say(U.nextTap.replace("%s", k), []);
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
    dg.ctl.tripOL = false;
    dg.on = {}; dg.hon = {}; dg.lvp = false;
    dg.mode = (sc.modes || ["volts"])[0];
    dg.red = null; dg.black = null; dg.active = "red"; dg.seen = {}; dg.items = {};
    ui.reads.textContent = "";
    settle(dg);
    ui.dctl.textContent = "";
    DG_CTL.forEach(function (k) {
      if (ui.dock.querySelector("[data-ctl=\"" + k + "\"]")) return;
      var b = button("sim-tog", T.controls[k], { "data-ctl": k, "aria-pressed": "false" });
      b.addEventListener("click", function () { toggle(k); });
      ui.dctl.appendChild(b);
    });
    ui.dctl.hidden = !ui.dctl.firstChild;
    ui.pts.textContent = "";
    sc.points.forEach(function (p) {
      var b = button("sim-tog ctl-pt", T.points[p], { "data-pt": p });
      b.addEventListener("click", function () { place(p); });
      ui.pts.appendChild(b);
    });
    after();
  }
  function roleLabel(g) { var p = g.getAttribute("data-tp"); return p && usable(p) ? tpLabel(p) : null; }
  function activate(g) { var p = g.getAttribute("data-tp"); if (p) place(p); }

  /* ---------- markup ---------- */
  function collect() {
    function rec(g) { var c = g.getAttribute("class") || ""; return { g: g, base: c, cls: c, word: g.querySelector(".ctl-st") }; }
    all(svg, "[data-el]").forEach(function (g) { els[g.getAttribute("data-el")] = rec(g); });
    all(svg, "[data-node]").forEach(function (g) {
      var r = rec(g);
      r.node = g.getAttribute("data-node"); r.flow = g.getAttribute("data-flow");
      nds.push(r);
    });
    all(svg, "[data-ct]").forEach(function (g) { var r = rec(g); r.ct = g.getAttribute("data-ct"); cts.push(r); });
    all(svg, "[data-tp]").forEach(function (g) {
      var p = g.getAttribute("data-tp"), c = g.querySelector("circle.hit") || g.querySelector("circle");
      tps[p] = { g: g, cx: +(g.getAttribute("data-cx") || (c && c.getAttribute("cx")) || 0),
        cy: +(g.getAttribute("data-cy") || (c && c.getAttribute("cy")) || 0) };
      if (T.points[p] && !g.getAttribute("data-name")) g.setAttribute("data-name", U.tp + ": " + T.points[p]);
    });
    ["red", "black"].forEach(function (k) {
      leadG[k] = svg.querySelector("#lead-" + k);
      if (!leadG[k]) throw new Error("missing #lead-" + k);
    });
  }
  function bindAll(scope, attr, fn) {
    all(scope, "[" + attr + "]").forEach(function (b) { b.addEventListener("click", function () { fn(b.getAttribute(attr)); }); });
  }
  function bindControls() {
    ["dock:sim-dock", "read:ctl-read", "val:ctl-val", "leads:ctl-leads", "ref:ctl-ref", "note:ctl-note", "mctl:ctl-mctl",
      "dctl:dg-ctl", "cond:dg-cond", "pts:dg-pts", "reads:dg-reads"].forEach(function (x) {
      x = x.split(":");
      ui[x[0]] = byId(x[1]);
      if (!ui[x[0]]) throw new Error("missing #" + x[1]);
    });
    text(ui.note, T.readingNote);
    bindAll(ui.dock, "data-meter", setMeter);
    bindAll(ui.dock, "data-lead", setLead);
    bindAll(ui.dock, "data-ctl", toggle);
    bindAll(ui.dock, "data-tap", tapBtn);
    bindAll(ui.mctl, "data-ctl", toggle);
  }

  function fail(app, err) {
    if (Sh && Sh.fail) { Sh.fail(app, err); return; }
    var f = byId("sim-fail");
    if (f) f.hidden = false;
    app.setAttribute("data-sim", "failed");
  }

  function init() {
    var app = byId("sim-app"), k, dt, scens;
    if (!app) return;
    Sh = root.SimShell;
    try {
      E = root.CtlEngine;
      ID = app.getAttribute("data-circuit") || "ctl-24";
      def = E && root.CtlCircuits && root.CtlCircuits.get ? root.CtlCircuits.get(ID) : null;
      if (!def || !Sh || !Sh.create || typeof E.diagnose !== "function" || typeof E.tap !== "function") { fail(app, null); return; }
      has = Sh.dom.has; copy = Sh.dom.copy; all = Sh.dom.all; flag = Sh.dom.flag; press = Sh.dom.press;
      text = Sh.dom.text; make = Sh.dom.make; button = Sh.dom.button;
      dt = def.text || {};
      T = { points: dt.points || {}, elements: dt.elements || {} };
      ["faults", "symptoms", "controls", "blocked", "readingNote"].forEach(function (x) { T[x] = dt[x] || TX[x]; });
      def.elements.forEach(function (e) { byEl[e.id] = e; if (e.type === "coil" && !CT) CT = e.contactor; });
      /* the data scenarios name no symptom yet: the cause decides it */
      scens = def.scenarios.map(function (s) { var c = copy(s); if (!c.symptom) c.symptom = TX.symptomOf[s.correct]; return c; });
      S = Sh.create({
        app: app, modes: MODES, start: "meter", scenarioMode: DG, trade: app.getAttribute("data-trade") || "multi",
        scenarios: scens, targets: "[data-info], [data-tp]",
        names: { modes: TX.modes, panels: TX.panels, hints: TX.hints, faults: T.faults, symptoms: T.symptoms },
        ui: { more: U.more },
        hooks: { mode: onMode, scenario: onScenario, ready: ready, label: roleLabel, activate: activate }
      });
      svg = S.el.fig.querySelector("svg.sim-svg");
      if (!svg || !svg.querySelector("[data-tp]")) { fail(app, null); return; }
      S.setSvg(svg);
      collect();
      bindControls();
      for (k in def.inputs) if (has(def.inputs, k)) mt.ctl[k] = !!def.inputs[k];
      settle(mt);
      mt.red = LAND[0]; mt.black = LAND[1];
      S.start();
    } catch (err) {
      fail(app, err);
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
