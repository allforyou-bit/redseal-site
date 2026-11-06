/* Planetary gear set simulator renderer, v1 (planetary-design-v1-20261105.md sections 1 and 3 to 6), on
   sim-shell.v1.js and PgsEngine as ctl-render.v1.js is on CtlEngine.
   - Operate: input member, held member (the input key is off under Hold, with the reason shown) and the
     locked pair. The member strip, the readings and the device states follow PgsEngine.state and
     PgsEngine.describe; every number shown is computed there, with the example note beside it.
   - Find the fault: range, load and four tests on the example unit; each reading comes with the same test
     on a healthy unit. The drawing turns as the unit would, and the devices are drawn neutral: the visitor
     reads the tests, not the drawing.
   - Animation: group rotations only (transform attributes), after Play under reduced motion, and paused
     off screen. Nothing moves while the set is in neutral or cannot turn.
   Page contract: g[data-rot] (S, R, C), g.pgs-spin per planet, [data-dv] device groups with a .pgs-st word,
   [data-hov] hatch overlays, #pgs-strip li[data-m], #sim-dock (#pgs-opkeys, #pgs-dgkeys), #pgs-read, #pgs-why,
   #dg-cond, #dg-reads. */
(function (root) {
  "use strict";

  var TX = {
    modes: { explore: "Explore", operate: "Operate", diagnose: "Find the fault" },
    panels: { explore: "Explore the parts", operate: "Drive, hold and lock", diagnose: "Fault scenarios" },
    hints: {
      explore: "Tap a part of the drawing, or move to it with the Tab key and press Enter, to read what it is.",
      operate: "Pick the input member, then hold one member or lock two together. The strip under the drawing shows how each member turns.",
      diagnose: "Pick a scenario and read the symptom. Set the range and the load, take the tests, then pick the cause."
    },
    groups: { input: "Input member", hold: "Held member", lock: "Lock two members", range: "Range", load: "Load", tests: "Tests" },
    keys: { S: "Sun", R: "Ring", C: "Carrier", none: "None", SR: "Sun + ring", SC: "Sun + carrier", RC: "Ring + carrier",
      N: "Neutral", L: "Low", D: "Direct", light: "Light load", heavy: "Heavy load",
      speed: "Speed check", band: "Band apply port", clutch: "Clutch apply port", line: "Line pressure" },
    roles: { input: "input", held: "held", output: "output", locked: "locked", free: "free", set: "turns with the set" },
    note: "Computed for this example gearset (sun 30, ring 72, planets 21 teeth), ignoring friction losses. Not a figure for any real transmission.",
    readNote: "Computed for this example unit, not a figure for any real transmission.",
    devices: { band: "Band", holdS: "Sun holding clutch", holdC: "Carrier holding clutch", lock: "Locking clutch" },
    dv: { on: "applied", off: "released" },
    applies: { N: "Neutral: nothing applies.", L: "Low: the band applies to hold the ring.", D: "Direct: the locking clutch applies to lock the sun to the ring." }
  };
  /* the readings that settle each fault (design section 6): a test, in a range, under a load */
  function t(test, range, load) { return { test: test, range: range || null, load: load || null }; }
  var MUST = {
    f_band_worn: [t("speed", "L", "heavy"), t("band", "L"), t("line")],
    f_band_leak: [t("band", "L"), t("line")],
    f_band_none: [t("speed", "L"), t("band", "L")],
    f_clutch_worn: [t("speed", "D", "heavy"), t("clutch", "D"), t("line")],
    f_clutch_leak: [t("clutch", "D"), t("line")],
    f_clutch_none: [t("speed", "D"), t("clutch", "D")],
    f_supply_low: [t("line"), { any: [t("band", "L"), t("clutch", "D")] }]
  };
  root.PgsRender = { version: 1, text: TX, must: MUST };

  var doc = root.document;
  if (!doc || !doc.getElementById) return;

  var DG = "diagnose", MODES = ["explore", "operate", DG], ID, E, Sh, S, def, N;
  var all, flag, press, text, make;
  var U = {
    healthy: "Same test on a healthy unit", noHold: "{x} is the input, so it cannot be held.",
    cleared: "The {x} is now the input, so it is no longer held.",
    more: "Take more readings before choosing a cause. Read each port in the range that applies it, and compare a light and a heavy load.",
    load: { light: "light load", heavy: "heavy load" }, notDriven: "not driven", still: "cannot turn", rev: " opposite"
  };
  var op = { input: "S", hold: "R", lock: null }, dg = { sc: null, range: "L", load: "light", taken: [], items: {} };
  var ui = {}, rot = {}, spins = [], dvs = {}, hov = {}, rows = {};
  var ang = { S: 0, R: 0, C: 0, Prel: 0 }, spd = null, raf = 0, last = 0, app;

  function byId(id) { return doc.getElementById(id); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function sub(s, x) { return s.split("{x}").join(x); }

  /* ---------- animation ---------- */
  function paintAngles() {
    ["S", "R", "C"].forEach(function (m) { if (rot[m]) rot[m].setAttribute("transform", "rotate(" + ang[m].toFixed(2) + ")"); });
    var p = "rotate(" + ang.Prel.toFixed(2) + ")";
    spins.forEach(function (g) { g.setAttribute("transform", p); });
  }
  function frame(ts) {
    raf = 0;
    var dt = last ? ts - last : 0;
    last = ts;
    if (spd && S.moving() && !app.classList.contains("sim-away")) {
      ang = E.step(ang, spd, dt, def.model.rate);
      paintAngles();
    }
    loop();
  }
  function loop() {
    if (spd && S.moving() && typeof root.requestAnimationFrame === "function") { if (!raf) raf = root.requestAnimationFrame(frame); }
    else last = 0;
  }
  function setSpeeds(sp) { spd = sp || null; loop(); }

  /* ---------- painting ---------- */
  function cls(el, base, extra) { var c = base + (extra ? " " + extra : ""); if (el.getAttribute("class") !== c) el.setAttribute("class", c); }
  /* devices: on true or false; null draws them neutral (Find the fault) */
  function paintDevices(on, lockWord) {
    Object.keys(dvs).forEach(function (k) {
      var d = dvs[k], st = on ? (on[k] ? "dv-on" : "dv-off") : "dv-unk";
      cls(d.g, d.base, st);
      text(d.word, on ? (on[k] ? TX.dv.on + (k === "lock" && lockWord ? ": " + lockWord : "") : TX.dv.off) : "");
    });
  }
  function paintHatch(m) { Object.keys(hov).forEach(function (k) { flag(hov[k], "on", k === m); }); }
  function stripRow(m, role, val, v) {
    var r = rows[m];
    if (!r) return;
    text(r.role, role);
    text(r.val, val);
    r.li.setAttribute("data-role", role.split(" ")[0]);
    r.fill.style.setProperty("--v", (Math.max(-1, Math.min(1, v / 3.4))).toFixed(3));
  }
  function paintStrip(st) {
    ["S", "C", "R"].forEach(function (m) {
      var role, val, v = 0;
      if (st.cls === "ratio") {
        v = st.speeds[m];
        role = m === st.input ? TX.roles.input : m === st.hold ? TX.roles.held : TX.roles.output;
        val = E.format(v) + (v < -1e-9 ? U.rev : "");
      } else if (st.cls === "direct") {
        v = 1;
        role = m === st.input ? TX.roles.input : st.lock.indexOf(m) >= 0 ? TX.roles.locked : TX.roles.set;
        val = E.format(1);
      } else if (st.cls === "neutral") {
        role = m === st.input ? TX.roles.input : TX.roles.free;
        val = m === st.input ? E.format(1) : U.notDriven;
        v = m === st.input ? 1 : 0;
      } else {
        role = m === st.hold ? TX.roles.held : st.lock && st.lock.indexOf(m) >= 0 ? TX.roles.locked : m === st.input ? TX.roles.input : TX.roles.free;
        val = U.still;
      }
      stripRow(m, role, val, v);
    });
  }
  function line(el, s) { text(el, s); el.hidden = !s; }
  function paintOperate(msg) {
    var st = E.state(ID, op), d = E.describe(ID, st);
    paintStrip(st);
    paintDevices({ band: op.hold === "R", holdS: op.hold === "S", holdC: op.hold === "C", lock: !!op.lock },
      op.lock ? N[op.lock.charAt(0)] + " + " + N[op.lock.charAt(1)] : "");
    paintHatch(op.hold);
    line(ui.out, d.out); line(ui.ratio, d.ratio); line(ui.formula, d.formula); line(ui.torque, d.torque); line(ui.planets, d.planets);
    ui.extra.textContent = "";
    d.extra.forEach(function (s) { ui.extra.appendChild(make("li", null, s)); });
    ui.extra.hidden = !d.extra.length;
    text(ui.why, sub(U.noHold, cap(N[op.input])));
    setSpeeds(st.cls === "ratio" || st.cls === "direct" ? st.speeds : null);
    pressAll();
    S.say((msg ? msg + " " : "") + d.status, []);
  }
  function cond() { return TX.applies[dg.range] + " " + cap(U.load[dg.load]) + "."; }
  function paintDiagnose() {
    paintDevices(null);
    paintHatch(null);
    if (!dg.sc) { setSpeeds(null); text(ui.cond, ""); pressAll(); return; }
    setSpeeds(E.diagnose(ID, { range: dg.range, load: dg.load, fault: dg.sc.correct }).speeds);
    text(ui.cond, cond());
    pressAll();
  }
  function pressAll() {
    all(ui.dock, "[data-in]").forEach(function (b) { press(b, b.getAttribute("data-in") === op.input); });
    all(ui.dock, "[data-hold]").forEach(function (b) {
      var k = b.getAttribute("data-hold");
      press(b, (op.hold || "none") === k);
      b.disabled = k === op.input;
    });
    all(ui.dock, "[data-lock]").forEach(function (b) { press(b, (op.lock || "none") === b.getAttribute("data-lock")); });
    all(ui.dock, "[data-range]").forEach(function (b) { press(b, b.getAttribute("data-range") === dg.range); b.disabled = !dg.sc; });
    all(ui.dock, "[data-load]").forEach(function (b) { press(b, b.getAttribute("data-load") === dg.load); b.disabled = !dg.sc; });
    all(ui.dock, "[data-test]").forEach(function (b) { b.disabled = !dg.sc; });
    ui.opk.hidden = S.mode() !== "operate";
    ui.dgk.hidden = S.mode() !== DG;
  }

  /* ---------- Find the fault readings ---------- */
  function fits(m, x) {
    if (m.any) return m.any.some(function (y) { return fits(y, x); });
    return m.test === x.test && (!m.range || m.range === x.range) && (!m.load || m.load === x.load);
  }
  function ready() {
    return (MUST[dg.sc.correct] || []).every(function (m) { return dg.taken.some(function (x) { return fits(m, x); }); });
  }
  function runTest(k) {
    if (!dg.sc) return;
    var x = { range: dg.range, load: dg.load }, r, ref, key, it, c;
    r = E.reading(ID, { range: x.range, load: x.load, fault: dg.sc.correct }, k);
    ref = E.reading(ID, { range: x.range, load: x.load, fault: null }, k);
    dg.taken.push({ test: k, range: x.range, load: x.load });
    c = TX.keys[x.range] + (k === "speed" ? ", " + U.load[x.load] : "");
    key = [k, x.range, k === "speed" ? x.load : ""].join("|");
    it = dg.items[key];
    if (!it) {
      it = dg.items[key] = { li: make("li", "sim-rd") };
      [["head", "sim-rd-h"], ["cond", "sim-rd-c"], ["val", "sim-rd-v"], ["ref", "sim-rd-r"], ["note", "sim-rd-note"]].forEach(function (y) {
        it[y[0]] = it.li.appendChild(make("p", y[1]));
      });
      text(it.note, TX.readNote);
    }
    text(it.head, TX.keys[k]);
    text(it.cond, c);
    text(it.val, r.text);
    text(it.ref, U.healthy + ": " + ref.text);
    if (ui.reads.firstChild !== it.li) ui.reads.insertBefore(it.li, ui.reads.firstChild);
    S.say(TX.keys[k] + ", " + c + ": " + r.text, []);
  }

  /* ---------- actions ---------- */
  function setInput(m) {
    var msg = "";
    if (op.input === m) return;
    if (op.hold === m) { op.hold = null; msg = sub(U.cleared, N[m]); }
    op.input = m;
    paintOperate(msg);
  }
  function setHold(h) {
    h = h === "none" ? null : h;
    if (h && h === op.input) return;
    op.hold = h;
    paintOperate("");
  }
  function setLock(l) { op.lock = l === "none" ? null : l; paintOperate(""); }
  function setRange(r) { if (!dg.sc || dg.range === r) return; dg.range = r; paintDiagnose(); S.say(cond(), []); }
  function setLoad(l) { if (!dg.sc || dg.load === l) return; dg.load = l; paintDiagnose(); S.say(cond(), []); }

  /* ---------- shell hooks ---------- */
  function onMode(m) {
    ui.dock.hidden = m === "explore";
    if (m === DG) paintDiagnose();
    else paintOperate("");
    if (m === "explore") S.say("", []);
    else if (m === DG && dg.sc) S.say(cond(), []);
  }
  function onScenario(sc) {
    dg.sc = sc; dg.range = def.unit.start.range; dg.load = def.unit.start.load; dg.taken = []; dg.items = {};
    ui.reads.textContent = "";
    paintDiagnose();
  }

  /* ---------- markup ---------- */
  function collect(svg) {
    all(svg, "[data-rot]").forEach(function (g) { rot[g.getAttribute("data-rot")] = g; });
    spins = all(svg, ".pgs-spin");
    all(svg, "[data-dv]").forEach(function (g) {
      dvs[g.getAttribute("data-dv")] = { g: g, base: (g.getAttribute("class") || "").replace(/\s*dv-(on|off|unk)\b/g, ""), word: g.querySelector(".pgs-st") };
    });
    all(svg, "[data-hov]").forEach(function (g) { hov[g.getAttribute("data-hov")] = g; });
    all(byId("pgs-strip"), "li[data-m]").forEach(function (li) {
      rows[li.getAttribute("data-m")] = { li: li, role: li.querySelector(".pgs-role"), val: li.querySelector(".pgs-v"), fill: li.querySelector(".pgs-sf") };
    });
    if (!rot.S || !rot.R || !rot.C || spins.length !== def.planets || !rows.S || !rows.C || !rows.R) throw new Error("drawing");
  }
  function bindAll(attr, fn) {
    all(ui.dock, "[" + attr + "]").forEach(function (b) { b.addEventListener("click", function () { fn(b.getAttribute(attr)); }); });
  }
  function bindControls() {
    ["dock:sim-dock", "opk:pgs-opkeys", "dgk:pgs-dgkeys", "out:pgs-out", "ratio:pgs-ratio", "formula:pgs-formula",
      "torque:pgs-torque", "planets:pgs-planets", "extra:pgs-extra", "why:pgs-why", "note:pgs-note", "cond:dg-cond",
      "reads:dg-reads"].forEach(function (x) {
      x = x.split(":");
      ui[x[0]] = byId(x[1]);
      if (!ui[x[0]]) throw new Error("missing #" + x[1]);
    });
    text(ui.note, TX.note);
    bindAll("data-in", setInput);
    bindAll("data-hold", setHold);
    bindAll("data-lock", setLock);
    bindAll("data-range", setRange);
    bindAll("data-load", setLoad);
    bindAll("data-test", runTest);
  }
  function fail(a, err) {
    if (Sh && Sh.fail) { Sh.fail(a, err); return; }
    var f = byId("sim-fail");
    if (f) f.hidden = false;
    a.setAttribute("data-sim", "failed");
  }

  function init() {
    var svg, dt;
    app = byId("sim-app");
    if (!app) return;
    Sh = root.SimShell;
    try {
      E = root.PgsEngine;
      ID = app.getAttribute("data-set") || "pgs-simple";
      def = E && E.get ? E.get(ID) : null;
      if (!def || !Sh || !Sh.create || typeof E.reading !== "function") { fail(app, null); return; }
      all = Sh.dom.all; flag = Sh.dom.flag; press = Sh.dom.press; text = Sh.dom.text; make = Sh.dom.make;
      dt = def.text;
      N = dt.short;
      op.input = def.defaults.input; op.hold = def.defaults.hold || null; op.lock = def.defaults.lock || null;
      S = Sh.create({
        app: app, modes: MODES, start: "operate", scenarioMode: DG, trade: app.getAttribute("data-trade") || "multi",
        scenarios: def.scenarios, targets: "[data-info]",
        names: { modes: TX.modes, panels: TX.panels, hints: TX.hints, faults: dt.faults, symptoms: dt.symptoms },
        ui: { more: U.more },
        hooks: { mode: onMode, scenario: onScenario, ready: ready, motion: function (on) { if (on) loop(); else last = 0; } }
      });
      svg = S.el.fig.querySelector("svg.sim-svg");
      if (!svg || !svg.querySelector("[data-rot]")) { fail(app, null); return; }
      S.setSvg(svg);
      collect(svg);
      bindControls();
      paintAngles();
      S.start();
    } catch (err) {
      fail(app, err);
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
