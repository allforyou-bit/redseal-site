/* Hydraulic circuit simulator renderer, v1.
   Paints the inline SVG of 421a-hydrostatic-drive-simulator.html from SimEngine output and runs
   the three modes: Explore (part descriptions), Operate (live derive()) and Find the fault
   (fault scenarios through diagnoseView()).
   Rules kept here:
   - Only existing nodes change during animation: classes, transform attributes and one CSS
     variable. Motion is CSS only, off under prefers-reduced-motion and behind the pause button.
   - Fault scenarios draw the circuit pressure-neutral: no line states, no flow arrows, no valve,
     heat or brake states. The only evidence is the relative bar of each reading the user takes.
   - Readings are relative bars, never numbers or units.
   - Text shown to the reader comes from the page (content sentences) or the circuit data.
   - GA4 events only through an existing gtag, with the registered parameters only. */
(function (root) {
  "use strict";

  /* ---------- pure helpers, also exported for the node tests ---------- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* display order of n scenarios for one seed (Fisher-Yates) */
  function order(n, seed) {
    var r = rng(seed), out = [], i, j, x;
    for (i = 0; i < n; i++) out.push(i);
    for (i = n - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); x = out[i]; out[i] = out[j]; out[j] = x; }
    return out;
  }
  /* class of one line group; a null view (fault scenarios) keeps only the fixed line kind */
  function lineClass(base, l) {
    var c = base;
    if (l) {
      c += " st-" + l.state;
      if (l.dir) c += " mv" + (l.dir < 0 ? " rev" : "");
      if (l.state === "pilot" && l.p > 0) c += " pr";
    }
    return c;
  }
  root.SimRender = { version: 1, order: order, lineClass: lineClass };

  var doc = root.document;
  if (!doc || !doc.getElementById) return;

  var ID = "hst-drive", TRADE = "421a";
  var MODES = ["explore", "operate", "diagnose"];
  var NOTE = "example value \u2014 real values: manufacturer manual";
  var PROMPT_MORE = "Check more test ports before choosing a cause.";
  var STEP_LABEL = { swapCartridges: "Valves swapped", defeatFlushing: "Loop flushing defeated" };
  var LEVEL_TEXT = {
    low: "Reads low, below the normal mark.",
    normal: "Reads normal, at the normal mark.",
    high: "Reads high, above the normal mark."
  };

  var E, def, T, app, svg, el = {}, stepInputs = [];
  var lines = {}, comps = {}, ports = {}, spin = {}, piston = { x: null };
  var mode = "explore", reduce = false, paused = false, started = false;
  var op = { inp: null, st: null, raf: 0, last: 0 };
  var dg = { sc: null, setup: null, steps: {}, taken: {}, items: {}, solved: {}, done: false, num: {} };

  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function copy(o) { var r = {}, k; for (k in o) if (has(o, k)) r[k] = o[k]; return r; }
  function byId(id) { return doc.getElementById(id); }
  function all(scope, sel) { return Array.prototype.slice.call(scope.querySelectorAll(sel)); }
  function closest(node, sel) {
    while (node && node.nodeType === 1) {
      if (node.matches && node.matches(sel)) return node;
      node = node.parentNode;
    }
    return null;
  }
  function flag(e, name, on) { if (e && e.classList.contains(name) !== !!on) e.classList.toggle(name, !!on); }
  function press(b, on) { if (b) b.setAttribute("aria-pressed", on ? "true" : "false"); }
  function ga(name, params) {
    try { if (typeof root.gtag === "function") root.gtag("event", name, params); } catch (e) { /* never break the page */ }
  }
  function text(node, s) { if (node && node.textContent !== s) node.textContent = s; }
  function make(tag, cls, s) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (s != null) n.textContent = s;
    return n;
  }
  /* a <p> holding copies of the sentence spans of a page element */
  function para(src) {
    var p = make("p");
    if (src) for (var c = src.firstChild; c; c = c.nextSibling) p.appendChild(c.cloneNode(true));
    return p;
  }

  /* ---------- engine helpers (states always come from init() and step()) ---------- */
  function settle(st, inp) {
    for (var i = 0; i < 600; i++) {
      var nx = E.step(st, inp, 1 / 60);
      if (Math.abs(nx.swash - st.swash) < 1e-9 && Math.abs(nx.healthySwash - st.healthySwash) < 1e-9) return nx;
      st = nx;
    }
    return st;
  }

  /* ---------- painting ---------- */
  function paintLines(view) {
    var id, rec, l, c;
    for (id in lines) if (has(lines, id)) {
      rec = lines[id];
      l = view && view[id];
      c = lineClass(rec.base, l || null);
      if (rec.cls !== c) { rec.g.setAttribute("class", c); rec.cls = c; }
    }
  }

  function setPiston(pos) {
    var x = Math.round((+pos || 0) * 280) / 10;
    if (el.piston && piston.x !== x) { el.piston.setAttribute("transform", "translate(" + x + " 0)"); piston.x = x; }
  }

  function setSpin(id, g, speed) {
    var d = Math.round(Math.max(0.35, Math.min(4, 0.6 / Math.max(+speed || 0, 0.05))) * 20) / 20;
    if (spin[id] !== d) { g.style.setProperty("--spin", d + "s"); spin[id] = d; }
  }

  function paintComps(cs) {
    var c = cs || {};
    setPiston(c.servo ? c.servo.pos : 0);
    flag(comps.solFwd, "on", c.solFwd && c.solFwd.energized);
    flag(comps.solRev, "on", c.solRev && c.solRev.energized);
    flag(comps.chargeRelief, "open", c.chargeRelief && c.chargeRelief.open);
    ["mfvA", "mfvB"].forEach(function (m) {
      var g = comps[m], o = c[m] || {};
      if (!g) return;
      flag(g.querySelector(".mf-chk"), "open", o.checkOpen);
      flag(g.querySelector(".mf-rv"), "open", o.reliefOpen);
    });
    (def.motors || []).forEach(function (m) {
      var g = comps[m], o = c[m] || {};
      if (!g) return;
      flag(g, "turn", !!o.turning);
      flag(g, "rev", o.turning && o.dir < 0);
      flag(g, "dmin", o.disp === "min");
      if (o.turning) setSpin(m, g, o.speed);
    });
    flag(comps.brakeValve, "on", c.brakeValve && c.brakeValve.energized);
    flag(comps.brake, "rel", c.brake && c.brake.applied === false);
    flag(comps.flushValve, "on", c.flushValve && c.flushValve.active);
  }

  function say(status, warnings) {
    text(el.status, status || "");
    var w = (warnings || []).map(function (x) { return x.text; }).join(" ");
    text(el.warn, w);
    el.warn.hidden = !w;
  }

  /* ---------- Explore and Operate: one live circuit ---------- */
  function paintOp() {
    var v = E.derive(op.st, op.inp);
    paintLines(v.lines);
    paintComps(v.comps);
    say(v.status, v.warnings);
  }

  function frame(ts) {
    op.raf = 0;
    if (mode === "diagnose") return;
    var dt = op.last ? Math.min((ts - op.last) / 1000, 0.1) : 1 / 60;
    op.last = ts;
    var nx = E.step(op.st, op.inp, dt);
    var moving = Math.abs(nx.swash - op.st.swash) > 1e-9;
    op.st = nx;
    paintOp();
    if (moving) op.raf = root.requestAnimationFrame(frame);
    else op.last = 0;
  }

  function kick() {
    if (mode === "diagnose") return;
    if (reduce || typeof root.requestAnimationFrame !== "function") {
      op.st = settle(op.st, op.inp);
      paintOp();
      return;
    }
    paintOp();
    if (!op.raf) { op.last = 0; op.raf = root.requestAnimationFrame(frame); }
  }

  function stopLoop() {
    if (op.raf && typeof root.cancelAnimationFrame === "function") root.cancelAnimationFrame(op.raf);
    op.raf = 0; op.last = 0;
  }

  function leverText(v) {
    if (!v) return "Neutral";
    return (v > 0 ? "Forward " : "Reverse ") + Math.abs(v) + "%";
  }
  /* visible lever position: words only, no figures */
  function leverWord(v) {
    if (!v) return "Neutral";
    if (Math.abs(v) >= 100) return v > 0 ? "Full forward" : "Full reverse";
    return v > 0 ? "Forward" : "Reverse";
  }
  function setLever(v) {
    v = Math.max(-100, Math.min(100, Math.round(+v || 0)));
    if (+el.joy.value !== v) el.joy.value = String(v);
    el.joy.setAttribute("aria-valuetext", leverText(v));
    text(el.joyOut, leverWord(v));
    op.inp.joystick = v / 100;
    kick();
  }

  function bindOperate() {
    var eng = byId("op-engine"), brk = byId("op-brake"), stl = byId("op-stall");
    var lim = byId("op-limiter"), fls = byId("op-flush");
    el.joy = byId("op-joy");
    el.joyOut = byId("op-joy-out");
    eng.addEventListener("click", function () { op.inp.engine = !op.inp.engine; press(eng, op.inp.engine); kick(); });
    brk.addEventListener("click", function () { op.inp.brakeRelease = !op.inp.brakeRelease; press(brk, op.inp.brakeRelease); kick(); });
    stl.addEventListener("click", function () { op.inp.stall = !op.inp.stall; press(stl, op.inp.stall); kick(); });
    lim.addEventListener("click", function () {
      op.inp.toggles.pressureLimiter = !op.inp.toggles.pressureLimiter; press(lim, op.inp.toggles.pressureLimiter); kick();
    });
    fls.addEventListener("click", function () {
      op.inp.toggles.loopFlushing = !op.inp.toggles.loopFlushing; press(fls, op.inp.toggles.loopFlushing); kick();
    });
    el.joy.addEventListener("input", function () { setLever(el.joy.value); });
    el.joy.addEventListener("change", function () { setLever(el.joy.value); });
    byId("op-neutral").addEventListener("click", function () { setLever(0); });
    all(app, "[data-range]").forEach(function (b) {
      b.addEventListener("click", function () {
        op.inp.range = b.getAttribute("data-range") === "high" ? "high" : "low";
        all(app, "[data-range]").forEach(function (x) { press(x, x === b); });
        kick();
      });
    });
    setLever(0);
  }

  /* ---------- Explore ---------- */
  function partCopy(id) {
    var src = doc.querySelector(".sim-parts [data-part=\"" + id + "\"]");
    if (!src) return null;
    var c = src.cloneNode(true);
    c.removeAttribute("id");
    c.removeAttribute("data-part");
    return c;
  }

  function selectPart(g) {
    all(svg, ".sel").forEach(function (x) { x.classList.remove("sel"); });
    g.classList.add("sel");
    var body = el.infoBody, name = g.getAttribute("data-name") || "";
    body.textContent = "";
    var ids = (g.getAttribute("data-info") || "").split(/\s+/), shown = 0;
    ids.forEach(function (id) {
      var c = id && partCopy(id);
      if (c) { body.appendChild(c); shown++; }
    });
    var refs = (g.getAttribute("data-info-ref") || "").split(/\s+/).filter(Boolean);
    if (!shown) {
      var art = make("div", "sim-part");
      art.appendChild(make("h3", null, name));
      var p = make("p");
      refs.forEach(function (ref, i) {
        var s = doc.querySelector(".sim-sec [data-ref=\"" + ref + "\"]");
        if (!s) return;
        if (i) p.appendChild(doc.createTextNode(" "));
        p.appendChild(s.cloneNode(true));
      });
      art.appendChild(p);
      body.appendChild(art);
    }
    el.info.hidden = false;
    text(el.status, name + ": details shown in the panel.");
    el.warn.hidden = true;
  }

  /* ---------- Find the fault ---------- */
  function setupLabel(k) {
    var b = app.querySelector("[data-setup=\"" + k + "\"]");
    return b ? b.textContent : k;
  }
  function stepKey(steps) {
    return stepInputs.filter(function (k) { return steps[k]; }).join("+");
  }
  function stepSuffix(steps) {
    return stepInputs.filter(function (k) { return steps[k]; })
      .map(function (k) { return ", " + (STEP_LABEL[k] || k).toLowerCase(); }).join("");
  }

  function dgInputs(withFault) {
    var inp = E.defaults(), s = def.setups[dg.setup] || {}, k;
    for (k in s) if (has(s, k)) inp[k] = s[k];
    inp.fault = withFault ? dg.sc.correct : null;
    inp.scenario = dg.sc.id;
    (dg.sc.steps || []).forEach(function (st) { if (stepInputs.indexOf(st) >= 0) inp[st] = !!dg.steps[st]; });
    return inp;
  }

  function offered(p) { return !!dg.sc && (dg.sc.ports || []).indexOf(p) >= 0; }

  function setRoles() {
    all(svg, "[data-info]").forEach(function (g) {
      var p = g.getAttribute("data-port"), label = null;
      if (mode === "explore") label = g.getAttribute("data-name");
      else if (mode === "diagnose" && p && offered(p)) label = "Take a reading: " + (T.ports[p] || p);
      if (label) {
        g.setAttribute("role", "button");
        g.setAttribute("tabindex", "0");
        g.setAttribute("aria-label", label);
      } else {
        g.removeAttribute("role");
        g.removeAttribute("tabindex");
        g.removeAttribute("aria-label");
      }
    });
  }

  function paintDiagnose() {
    paintLines(null);
    paintComps(null);
    var got = {}, k;
    for (k in dg.taken) if (has(dg.taken, k)) got[dg.taken[k].port] = true;
    Object.keys(ports).forEach(function (p) {
      var g = ports[p], on = offered(p);
      flag(g, "pick", on && !got[p]);
      flag(g, "got", on && !!got[p]);
      flag(g, "dim", !on);
    });
  }

  function paintPlainPorts() {
    Object.keys(ports).forEach(function (p) {
      flag(ports[p], "pick", false); flag(ports[p], "got", false); flag(ports[p], "dim", false);
    });
  }

  function condition() {
    var inp = dgInputs(true);
    var v = E.diagnoseView(settle(E.init(ID), inp), inp, []);
    return v.status;
  }

  function updateCond() {
    var done = stepInputs.filter(function (k) { return dg.steps[k]; })
      .map(function (k) { return STEP_LABEL[k] || k; }).join(", ");
    var s = condition() + (done ? " " + done + "." : "");
    text(el.cond, s);
    return s;
  }

  function readingItem(key) {
    var it = dg.items[key];
    if (it) return it;
    it = { li: make("li", "sim-rd") };
    it.head = make("p", "sim-rd-h");
    it.port = make("strong");
    it.cond = make("span");
    it.head.appendChild(it.port);
    it.head.appendChild(doc.createTextNode(" \u2014 "));
    it.head.appendChild(it.cond);
    it.gauge = make("div", "sim-gauge");
    it.gauge.setAttribute("aria-hidden", "true");
    it.fill = make("span", "sim-gauge-f");
    it.mark = make("span", "sim-gauge-n");
    it.gauge.appendChild(it.fill);
    it.gauge.appendChild(it.mark);
    it.level = make("p", "sim-rd-v");
    it.note = make("p", "sim-rd-note", NOTE);
    it.li.appendChild(it.head);
    it.li.appendChild(it.gauge);
    it.li.appendChild(it.level);
    it.li.appendChild(it.note);
    dg.items[key] = it;
    return it;
  }

  function takeReading(p) {
    if (!offered(p) || dg.done) return;
    var inp = dgInputs(true), st = settle(E.init(ID), inp);
    var v = E.diagnoseView(st, inp, [p]);
    var r = v.readings && v.readings[p];
    if (!r) return;
    var hin = dgInputs(false), ref = E.derive(settle(E.init(ID), hin), hin).readings[p];
    var steps = copy(dg.steps), key = dg.setup + "|" + stepKey(steps) + "|" + p;
    dg.taken[key] = { setup: dg.setup, steps: steps, port: p, level: r.level };
    var it = readingItem(key), lab = T.ports[p] || p, cond = setupLabel(dg.setup) + stepSuffix(steps);
    text(it.port, lab);
    text(it.cond, cond);
    it.fill.style.width = Math.max(2, Math.round(Math.max(0, Math.min(1, r.value)) * 100)) + "%";
    it.mark.style.left = Math.round(Math.max(0, Math.min(1, ref ? ref.value : 0)) * 100) + "%";
    text(it.level, LEVEL_TEXT[r.level] || "");
    it.li.hidden = false;
    if (el.reads.firstChild !== it.li) el.reads.insertBefore(it.li, el.reads.firstChild);
    paintDiagnose();
    say(lab + ", " + cond + ": " + (LEVEL_TEXT[r.level] || "").toLowerCase(), []);
  }

  function viewed(m) {
    var k, t;
    for (k in dg.taken) if (has(dg.taken, k)) {
      t = dg.taken[k];
      if (t.setup !== m.setup || t.port !== m.port) continue;
      if (!!t.steps.swapCartridges !== !!m.swap) continue;
      if (stepInputs.some(function (s) { return m[s] === true && !t.steps[s]; })) continue;
      return true;
    }
    return false;
  }
  function allViewed() { return (dg.sc.mustView || []).every(viewed); }

  function resultBox(kind, verdict) {
    el.result.className = "sim-result" + (kind ? " " + kind : "");
    text(el.verdict, verdict);
    el.more.textContent = "";
    el.result.hidden = false;
  }
  function addBlock(title, src) {
    if (!src) return;
    if (title) el.more.appendChild(make("h4", null, title));
    el.more.appendChild(para(src));
  }
  function faultCell(id, k) { return doc.querySelector("#tbl-faults tr[data-fault=\"" + id + "\"] td[data-k=\"" + k + "\"]"); }
  function faultText(id, k) { return doc.querySelector(".sim-why details[data-fault=\"" + id + "\"] p[data-k=\"" + k + "\"]"); }

  function explain(id) {
    addBlock(null, faultCell(id, "cause"));
    addBlock("Why", faultText(id, "why"));
    addBlock("How to tell it apart", faultText(id, "distinguish"));
  }

  function lockCauses() { all(el.causes, "[data-fault]").forEach(function (b) { b.disabled = true; }); }

  function pickCause(f, b) {
    if (!dg.sc || dg.done) return;
    if (!allViewed()) {
      resultBox("", PROMPT_MORE);
      el.reveal.hidden = true;
      say(PROMPT_MORE, []);
      return;
    }
    if (f === dg.sc.correct) {
      dg.done = true;
      lockCauses();
      resultBox("ok", "Solved: " + (T.faults[f] || f) + ".");
      explain(f);
      el.reveal.hidden = true;
      el.offer.hidden = false;
      if (!dg.solved[dg.sc.id]) {
        dg.solved[dg.sc.id] = true;
        ga("fault_solved", { placement: "sim_" + f, trade: TRADE });
      }
      say("Solved: " + (T.faults[f] || f) + ".", []);
      return;
    }
    b.classList.add("tried");
    b.disabled = true;
    resultBox("no", "Not the cause in this scenario.");
    addBlock("If it were " + (T.faults[f] || f) + ", the readings would show:", faultCell(f, "see"));
    el.reveal.hidden = false;
    say("Not the cause in this scenario.", []);
  }

  function reveal() {
    if (!dg.sc || dg.done) return;
    dg.done = true;
    lockCauses();
    var f = dg.sc.correct;
    resultBox("", "The cause in this scenario: " + (T.faults[f] || f) + ".");
    explain(f);
    el.reveal.hidden = true;
    say("The cause in this scenario: " + (T.faults[f] || f) + ".", []);
  }

  function buildSteps(sc) {
    el.steps.textContent = "";
    (sc.steps || []).forEach(function (k) {
      if (stepInputs.indexOf(k) < 0 || typeof T.steps[k] !== "string") return;
      var box = make("div", "sim-stepbox");
      box.appendChild(make("p", "sim-step", T.steps[k]));
      var row = make("div", "sim-row");
      var b = make("button", "sim-tog", STEP_LABEL[k] || "Step done");
      b.type = "button";
      press(b, false);
      b.addEventListener("click", function () {
        if (dg.done) return;
        dg.steps[k] = !dg.steps[k];
        press(b, dg.steps[k]);
        say(updateCond(), []);
      });
      row.appendChild(b);
      box.appendChild(row);
      el.steps.appendChild(box);
    });
  }

  function pickScenario(sc, btn) {
    dg.sc = sc; dg.steps = {}; dg.taken = {}; dg.done = false;
    var keys = Object.keys(def.setups);
    dg.setup = keys.indexOf("neutral") >= 0 ? "neutral" : keys[0];
    all(el.scen, "button").forEach(function (b) { press(b, b === btn); });
    text(el.symptom, T.symptoms[sc.symptom] || "");
    buildSteps(sc);
    all(el.setups, "[data-setup]").forEach(function (b) { press(b, b.getAttribute("data-setup") === dg.setup); });
    all(el.portBtns, "[data-port]").forEach(function (b) { b.hidden = !offered(b.getAttribute("data-port")); });
    Object.keys(dg.items).forEach(function (k) { dg.items[k].li.hidden = true; });
    all(el.causes, "[data-fault]").forEach(function (b) {
      var f = b.getAttribute("data-fault");
      b.hidden = (sc.causes || []).indexOf(f) < 0;
      b.disabled = false;
      b.classList.remove("tried");
    });
    el.result.hidden = true;
    el.offer.hidden = true;
    el.reveal.hidden = true;
    el.caseBox.hidden = false;
    setRoles();
    paintDiagnose();
    updateCond();
    say("Scenario " + dg.num[sc.id] + ". Operator report: " + (T.symptoms[sc.symptom] || ""), []);
  }

  /* ?seed=N fixes the scenario order for tests; otherwise a new order on every load */
  function pageSeed() {
    var m = /[?&]seed=(\d{1,9})(?:&|$)/.exec((root.location && root.location.search) || "");
    if (m) return +m[1];
    try {
      if (root.crypto && root.crypto.getRandomValues) {
        var u = new Uint32Array(1);
        root.crypto.getRandomValues(u);
        return u[0];
      }
    } catch (e) { /* fall back below */ }
    return Math.floor(Math.random() * 4294967296);
  }

  function bindDiagnose() {
    el.scen = byId("dg-scen");
    el.caseBox = byId("dg-case");
    el.symptom = byId("dg-symptom");
    el.steps = byId("dg-steps");
    el.setups = byId("dg-setups");
    el.cond = byId("dg-cond");
    el.portBtns = byId("dg-ports");
    el.reads = byId("dg-reads");
    el.causes = byId("dg-causes");
    el.result = byId("dg-result");
    el.verdict = byId("dg-verdict");
    el.more = byId("dg-more");
    el.reveal = byId("dg-reveal");
    el.offer = byId("sim-offer");
    var note = byId("legend-dg"), dn = byId("dg-note");
    if (note && dn) { dn.textContent = ""; for (var c = note.firstChild; c; c = c.nextSibling) dn.appendChild(c.cloneNode(true)); }

    /* shuffled on every page load; the scenario stays in this closure and never reaches the page */
    order(def.scenarios.length, pageSeed()).forEach(function (k, i) {
      var sc = def.scenarios[k];
      var b = make("button", "sim-tog", "Scenario " + (i + 1));
      b.type = "button";
      press(b, false);
      dg.num[sc.id] = i + 1;
      b.addEventListener("click", function () { pickScenario(sc, b); });
      el.scen.appendChild(b);
    });
    all(el.setups, "[data-setup]").forEach(function (b) {
      var k = b.getAttribute("data-setup");
      b.hidden = !has(def.setups, k);
      b.addEventListener("click", function () {
        if (!dg.sc) return;
        dg.setup = k;
        all(el.setups, "[data-setup]").forEach(function (x) { press(x, x === b); });
        say(updateCond(), []);
      });
    });
    all(el.portBtns, "[data-port]").forEach(function (b) {
      var p = b.getAttribute("data-port");
      if (T.ports[p]) text(b, T.ports[p]);
      b.addEventListener("click", function () { takeReading(p); });
    });
    all(el.causes, "[data-fault]").forEach(function (b) {
      var f = b.getAttribute("data-fault");
      if (T.faults[f]) text(b, T.faults[f]);
      b.addEventListener("click", function () { pickCause(f, b); });
    });
    el.reveal.addEventListener("click", reveal);
  }

  /* ---------- modes, motion, first use ---------- */
  function setMode(m, user) {
    if (MODES.indexOf(m) < 0) return;
    mode = m;
    app.setAttribute("data-mode", m);
    all(app, ".sim-mode").forEach(function (b) { press(b, b.getAttribute("data-mode") === m); });
    all(app, "[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== m; });
    if (m !== "explore") all(svg, ".sel").forEach(function (x) { x.classList.remove("sel"); });
    setRoles();
    if (m === "diagnose") {
      stopLoop();
      paintDiagnose();
      if (dg.sc) say(updateCond(), []);
      else say("Pick a scenario to start.", []);
    } else {
      paintPlainPorts();
      kick();
    }
    if (user) ga("mode_change", { placement: m, trade: TRADE });
  }

  function applyMotion() {
    reduce = !!(el.mq && el.mq.matches);
    el.pause.disabled = reduce;
    text(el.pause, reduce ? "Animation off (reduced motion)" : paused ? "Play animation" : "Pause animation");
    if (reduce && mode !== "diagnose") { stopLoop(); kick(); }
  }

  function firstUse() {
    if (started) return;
    started = true;
    ga("sim_start", { placement: mode, trade: TRADE });
  }

  function bindShell() {
    all(app, ".sim-mode").forEach(function (b) {
      b.addEventListener("click", function () { var m = b.getAttribute("data-mode"); if (m !== mode) setMode(m, true); });
    });
    el.pause.addEventListener("click", function () {
      if (reduce) return;
      paused = !paused;
      flag(app, "sim-still", paused);
      text(el.pause, paused ? "Play animation" : "Pause animation");
    });
    el.mq = typeof root.matchMedia === "function" ? root.matchMedia("(prefers-reduced-motion: reduce)") : null;
    if (el.mq) {
      if (el.mq.addEventListener) el.mq.addEventListener("change", applyMotion);
      else if (el.mq.addListener) el.mq.addListener(applyMotion);
    }
    svg.addEventListener("click", function (ev) {
      var g = closest(ev.target, "[data-info]");
      if (g && g.getAttribute("role") === "button") activate(g);
    });
    svg.addEventListener("keydown", function (ev) {
      if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
      var g = closest(ev.target, "[data-info]");
      if (!g || g.getAttribute("role") !== "button") return;
      ev.preventDefault();
      activate(g);
    });
    app.addEventListener("click", firstUse, true);
    app.addEventListener("input", firstUse, true);
    app.addEventListener("keydown", function (ev) {
      if (/^(Enter| |Spacebar|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Home|End|PageUp|PageDown)$/.test(ev.key)) firstUse();
    }, true);
  }

  function activate(g) {
    if (mode === "explore") selectPart(g);
    else if (mode === "diagnose") { var p = g.getAttribute("data-port"); if (p) takeReading(p); }
  }

  function collect() {
    all(svg, "[data-line]").forEach(function (g) {
      var c = g.getAttribute("class") || "ln";
      lines[g.getAttribute("data-line")] = { g: g, base: c, cls: c };
    });
    all(svg, "[data-comp]").forEach(function (g) { comps[g.getAttribute("data-comp")] = g; });
    all(svg, "[data-port]").forEach(function (g) {
      var p = g.getAttribute("data-port");
      ports[p] = g;
      if (T.ports[p]) g.setAttribute("data-name", "Test port: " + T.ports[p]);
    });
    el.piston = svg.querySelector(".sv-pis");
    el.status = byId("sim-status");
    el.warn = byId("sim-warn");
    el.info = byId("sim-info");
    el.infoBody = byId("sim-info-body");
    el.pause = byId("sim-pause");
  }

  function fail(err) {
    var f = byId("sim-fail");
    if (f) f.hidden = false;
    if (app) app.setAttribute("data-sim", "failed");
    if (err && root.console && root.console.error) root.console.error(err);
  }

  function init() {
    app = byId("sim-app");
    if (!app) return;
    try {
      E = root.SimEngine;
      def = E && root.SimCircuits && root.SimCircuits.get ? root.SimCircuits.get(ID) : null;
      svg = app.querySelector("svg.sim-svg");
      if (!def || !svg || typeof E.diagnoseView !== "function") { fail(null); return; }
      T = def.text;
      stepInputs = (E.stepInputs || []).slice();
      collect();
      op.inp = E.defaults();
      op.inp.toggles = { pressureLimiter: false, loopFlushing: false };
      op.st = settle(E.init(ID), op.inp);
      bindShell();
      bindOperate();
      bindDiagnose();
      applyMotion();
      setMode("explore", false);
      app.setAttribute("data-sim", "ready");
    } catch (err) {
      fail(err);
    }
  }

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
