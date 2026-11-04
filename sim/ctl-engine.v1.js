/* Motor starter control circuit lab engine, v1 (relay control fault lab, view C24).
   Pure functions: no DOM access, no hidden state. Circuits are data files that call CtlCircuits.register()
   (or queue themselves in CtlCircuitQueue when they load first). A classic IIFE with a globalThis
   fallback, like dc-engine.v1.js.
   Model: the DC lab's linear network, solved by nodal analysis with every source in its Norton form; an
   open is params.rOpen and every node has a tiny leak (params.gMin) to the reference. The MNA core
   (gauss, solveNet) is a copy of dc-engine.v1.js so the live DC page is not touched
   (relay-design-c24-20261104.md section 7, the fallback path).
   New here: a contactor. Its coil is a resistor; its state is history: it picks up when the coil current
   reaches params.pickUp of the current it draws at the view's nominal voltage, drops out at
   params.dropOut or below, and keeps its last state in between (an open coil draws nothing). Contacts that follow it (normally open or normally closed) are switches
   whose state comes from the contactor. settle() solves, updates the contactors, and solves again until
   nothing changes, at most params.maxPass times; hitting the cap is reported as chatter. The caller
   carries the contactor states in inputs.contactors between actions (a latch, like the DC lab's
   blown fuses), which is what makes a seal-in circuit hold and a power cut drop it.
   Pushbuttons are momentary: tap() runs a press and the release and returns the state after both.
   Every value is an example-circuit value computed from the parts in the data file, never a service
   limit; pickUp and dropOut are model fractions and the page never prints them. */
(function (root) {
  "use strict";

  var TYPES = ["source", "wire", "fuse", "switch", "contact", "coil"];
  var FAULT_KINDS = ["open", "stuckClosed"];
  var MODES = ["volts", "ohms"];
  var NODE_STATES = ["pos", "mid", "gnd"];
  var OHMS_SEES_V = 0.005;
  var ID_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
  var circuits = {};

  function num(x, d) { x = +x; return x === x && isFinite(x) ? x : d; }
  function isArr(a) { return Object.prototype.toString.call(a) === "[object Array]"; }
  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function copy(o) { var r = {}, k; for (k in o) if (has(o, k)) r[k] = o[k]; return r; }
  function r6(x) { return Math.round(x * 1e6) / 1e6; }

  /* ---------- circuit data ---------- */
  function validate(def) {
    var e = [], seen = {}, nodes = {}, els = {}, faults = {}, pts = {}, contactors = {};
    if (!def || !/^[a-z][a-z0-9-]*$/.test(def.id || "")) e.push("id");   /* circuit ids are slugs, like dc-lamp */
    (def.nodes || []).forEach(function (nd) { if (nodes[nd]) e.push("node twice: " + nd); nodes[nd] = true; });
    if (!nodes[def.ref]) e.push("ref node");
    ["gMin", "rOpen", "rMeter", "rLeads", "ohmTestI", "olOhms", "pickUp", "dropOut", "maxPass", "flowMin"].forEach(function (k) {
      if (!(num((def.params || {})[k], NaN) > 0)) e.push("params." + k);
    });
    if (def.params && !(def.params.dropOut < def.params.pickUp && def.params.pickUp < 1)) e.push("dropOut < pickUp < 1");
    if (!def.views || !def.views[def.defaultView]) e.push("defaultView");
    (def.elements || []).forEach(function (el) {
      if (!ID_RE.test(el.id || "") || seen[el.id]) e.push("element id: " + el.id);
      seen[el.id] = true; els[el.id] = el;
      if (TYPES.indexOf(el.type) < 0) e.push(el.id + ": type " + el.type);
      if (!nodes[el.a] || !nodes[el.b]) e.push(el.id + ": nodes");
      if (el.type === "source" ? !(el.emf > 0 && el.rint > 0) : !(el.r > 0)) e.push(el.id + ": value");
      if (el.type === "coil") { if (!ID_RE.test(el.contactor || "")) e.push(el.id + ": contactor"); contactors[el.contactor] = true; }
      if ((el.ctl && !has(def.inputs, el.ctl)) || (el.cut && !has(def.inputs, el.cut))) e.push(el.id + ": input");
    });
    (def.elements || []).forEach(function (el) {
      if (el.type === "contact" && (!contactors[el.of] || (el.form !== "no" && el.form !== "nc"))) e.push(el.id + ": contact of/form");
    });
    (def.faults || []).forEach(function (f) {
      if (!ID_RE.test(f.id || "") || faults[f.id]) e.push("fault id: " + f.id);
      faults[f.id] = true;
      if (FAULT_KINDS.indexOf(f.kind) < 0 || !els[f.el]) e.push(f.id + ": kind or element");
      if (f.kind === "stuckClosed" && !(els[f.el] && els[f.el].type === "switch")) e.push(f.id + ": stuckClosed needs a switch");
    });
    (def.points || []).forEach(function (p) {
      if (!ID_RE.test(p.id || "") || pts[p.id] || !nodes[p.node]) e.push("point: " + p.id);
      pts[p.id] = true;
    });
    (def.scenarios || []).forEach(function (s) {
      if (!faults[s.correct]) e.push("scenario " + s.id + ": correct");
      (s.causes || []).forEach(function (c) { if (!faults[c]) e.push("scenario " + s.id + ": cause " + c); });
      (s.points || []).forEach(function (p) { if (!pts[p]) e.push("scenario " + s.id + ": point " + p); });
    });
    return e;
  }
  function register(def) {
    var errs = validate(def);
    if (errs.length) throw new Error("circuit " + (def && def.id) + ": " + errs.join("; "));
    circuits[def.id] = def;
  }
  function getDef(id) {
    var d = typeof id === "string" ? circuits[id] : null;
    if (!d) throw new Error("unknown circuit: " + id);
    return d;
  }
  function contactorIds(def) {
    var out = [];
    def.elements.forEach(function (el) { if (el.type === "coil" && out.indexOf(el.contactor) < 0) out.push(el.contactor); });
    return out;
  }

  /* ---------- inputs ---------- */
  function norm(def, inp) {
    inp = inp || {};
    var n = { view: has(def.views, inp.view) ? inp.view : def.defaultView, inp: {}, fault: null, on: {} }, k;
    for (k in def.inputs) if (has(def.inputs, k)) n.inp[k] = inp[k] == null ? !!def.inputs[k] : !!inp[k];
    def.faults.forEach(function (f) { if (f.id === inp.fault) n.fault = f; });
    var c = inp.contactors || {};
    contactorIds(def).forEach(function (id) { n.on[id] = c[id] === true; });
    return n;
  }

  /* the elements with inputs, contactor states and the fault applied */
  function elementsFor(def, n) {
    var P = def.params, f = n.fault, out = [];
    def.elements.forEach(function (el0) {
      var el = copy(el0), hit = !!f && f.el === el0.id, closed;
      if (el.type === "switch") {
        closed = (el.ctl ? n.inp[el.ctl] : true) && !(el.cut && n.inp[el.cut]);
        if (hit && f.kind === "stuckClosed") closed = true;
      } else if (el.type === "contact") {
        closed = el.form === "no" ? !!n.on[el.of] : !n.on[el.of];
      } else if (el.type === "source") {
        closed = el.ctl ? !!n.inp[el.ctl] : true;
      } else closed = true;
      el.open = !closed || (hit && f.kind === "open");
      if (el.type === "source") { el.dead = el.open; el.g = el.open ? 1 / P.rOpen : 1 / el.rint; }
      else el.g = el.open ? 1 / P.rOpen : 1 / el.r;
      out.push(el);
    });
    return out;
  }

  /* ---------- nodal solve (copy of dc-engine.v1.js) ---------- */
  function gauss(A, b) {
    var n = b.length, i, j, k, p, t, m, x = new Array(n);
    for (k = 0; k < n; k++) {
      p = k;
      for (i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
      if (p !== k) { t = A[p]; A[p] = A[k]; A[k] = t; t = b[p]; b[p] = b[k]; b[k] = t; }
      for (i = k + 1; i < n; i++) {
        m = A[i][k] / A[k][k];
        if (!m) continue;
        for (j = k; j < n; j++) A[i][j] -= m * A[k][j];
        b[i] -= m * b[k];
      }
    }
    for (i = n - 1; i >= 0; i--) {
      t = b[i];
      for (j = i + 1; j < n; j++) t -= A[i][j] * x[j];
      x[i] = t / A[i][i];
    }
    return x;
  }
  function present(els, node) { return els.some(function (el) { return el.a === node || el.b === node; }); }
  function solveNet(def, els, extra, zeroEmf) {
    var P = def.params, ref = def.ref, idx = {}, list = [], A = [], b = [], i, j;
    def.nodes.forEach(function (nd) { if (nd !== ref && present(els, nd)) { idx[nd] = list.length; list.push(nd); } });
    var nn = list.length;
    for (i = 0; i < nn; i++) { A.push([]); b.push(0); for (j = 0; j < nn; j++) A[i].push(0); A[i][i] = P.gMin; }
    function ix(nd) { return has(idx, nd) ? idx[nd] : -1; }
    function stamp(a, c, g) {
      var ia = ix(a), ic = ix(c);
      if (ia >= 0) A[ia][ia] += g;
      if (ic >= 0) A[ic][ic] += g;
      if (ia >= 0 && ic >= 0) { A[ia][ic] -= g; A[ic][ia] -= g; }
    }
    function inject(nd, I) { var k = ix(nd); if (k >= 0) b[k] += I; }
    els.forEach(function (el) {
      stamp(el.a, el.b, el.g);
      if (el.type === "source" && !zeroEmf && !el.dead) { inject(el.b, el.emf * el.g); inject(el.a, -el.emf * el.g); }
    });
    if (extra && extra.meter) stamp(extra.meter[0], extra.meter[1], 1 / P.rMeter);
    if (extra && extra.leak) for (i = 0; i < nn; i++) A[i][i] += extra.leak;
    if (extra && extra.inject) { inject(extra.inject[0], extra.inject[2]); inject(extra.inject[1], -extra.inject[2]); }
    var x = gauss(A, b), v = {}, cur = {};
    v[ref] = 0;
    list.forEach(function (nd, k) { v[nd] = x[k]; });
    els.forEach(function (el) {
      var d = v[el.a] - v[el.b];
      cur[el.id] = el.type === "source" ? (zeroEmf || el.dead ? 0 : el.emf) * el.g + d * el.g : d * el.g;
    });
    return { v: v, i: cur };
  }

  /* ---------- contactor state loop ---------- */
  function settle(def, n) {
    var P = def.params, nom = def.views[n.view].nominal, on = copy(n.on), pass = 0, els, sol, changed;
    for (;;) {
      var m = copy(n); m.on = on;
      els = elementsFor(def, m);
      sol = solveNet(def, els, null, false);
      changed = false;
      var next = copy(on);
      /* the pull on the armature follows the coil current, not the voltage at its terminals: an open coil
         has the full supply across it and pulls nothing. Thresholds are fractions of the current the coil
         draws at the nominal voltage (its data resistance, not a fault's open value). */
      els.forEach(function (el) {
        if (el.type !== "coil") return;
        var ic = Math.abs(sol.i[el.id]), inom = nom / el.r;
        if (on[el.contactor] && ic <= P.dropOut * inom) next[el.contactor] = false;
        else if (!on[el.contactor] && ic >= P.pickUp * inom) next[el.contactor] = true;
      });
      Object.keys(next).forEach(function (k) { if (next[k] !== on[k]) changed = true; });
      pass++;
      if (!changed || pass >= P.maxPass) { on = next; break; }
      on = next;
    }
    return { els: els, sol: sol, on: on, passes: pass, chatter: changed && pass >= P.maxPass };
  }

  /* ---------- outputs ---------- */
  function nodeState(v, nom) { var q = v / nom; return q >= 0.9 ? "pos" : q <= 0.1 ? "gnd" : "mid"; }
  function fixed(x, d) { var p = Math.pow(10, d); return (Math.round(x * p + 1e-7) / p).toFixed(d); }
  function fmt(mode, x, nom) {
    if (mode === "ohms") {
      if (x == null) return "OL";
      if (x < 200) return fixed(x, 1) + " Ω";
      if (x < 2e5) return fixed(x / 1000, 2) + " kΩ";
      return fixed(x / 1e6, 2) + " MΩ";
    }
    var d = nom > 60 ? 1 : 2, t = fixed(Math.abs(x), d);
    return (x < 0 && +t !== 0 ? "−" : "") + t + " V";
  }
  function pointNode(def, id) {
    var p = null;
    def.points.forEach(function (q) { if (q.id === id) p = q; });
    return p ? p.node : null;
  }

  /* ---------- public ---------- */
  function defaults(id) {
    var def = getDef(id), out = { view: def.defaultView, fault: null, contactors: {} }, k;
    for (k in def.inputs) if (has(def.inputs, k)) out[k] = !!def.inputs[k];
    contactorIds(def).forEach(function (c) { out.contactors[c] = false; });
    return out;
  }

  /* settle the inputs as given and hand the contactor states back (the caller keeps them) */
  function apply(id, inputs) {
    var def = getDef(id), n = norm(def, inputs), s = settle(def, n), out = copy(inputs || {});
    out.contactors = copy(s.on);
    return { inputs: out, chatter: s.chatter, passes: s.passes };
  }

  /* momentary pushbutton: press (input true), settle, release (input false), settle */
  function tap(id, inputs, button) {
    var def = getDef(id);
    if (!has(def.inputs, button)) throw new Error("unknown input: " + button);
    var down = copy(inputs || {}); down[button] = true;
    var a = apply(id, down);
    var up = copy(a.inputs); up[button] = false;
    var b = apply(id, up);
    return { inputs: b.inputs, chatter: a.chatter || b.chatter };
  }

  /* whole-circuit picture: node and element states, flow, contactors */
  function derive(id, inputs) {
    var def = getDef(id), n = norm(def, inputs), s = settle(def, n), nom = def.views[n.view].nominal, P = def.params;
    var nodes = {}, elements = {};
    var vd = solveNet(def, s.els, { leak: 1 / P.rMeter }, false).v;
    Object.keys(vd).forEach(function (nd) { nodes[nd] = nodeState(vd[nd], nom); });
    s.els.forEach(function (el) {
      var i = s.sol.i[el.id], mid = (vd[el.a] + vd[el.b]) / 2;
      elements[el.id] = { state: nodeState(mid, nom), flow: Math.abs(i) > P.flowMin, dir: i > 0 ? 1 : i < 0 ? -1 : 0, open: !!el.open };
    });
    return { view: n.view, nodes: nodes, elements: elements, contactors: copy(s.on), chatter: s.chatter };
  }

  /* probe = { mode: "volts" | "ohms", red: pointId, black: pointId }; contactor states settle first */
  function measure(id, inputs, probe) {
    var def = getDef(id), P = def.params, n = norm(def, inputs), nom = def.views[n.view].nominal;
    probe = probe || {};
    var mode = MODES.indexOf(probe.mode) >= 0 ? probe.mode : "volts";
    var ra = pointNode(def, probe.red), bk = pointNode(def, probe.black);
    var out = { mode: mode, value: null, text: "", blocked: null };
    if (!ra || !bk) { out.blocked = "point"; return out; }
    var s = settle(def, n), m = copy(n);
    m.on = s.on;
    var els = elementsFor(def, m);
    if (mode === "volts") {
      var sol = ra === bk ? { v: {} } : solveNet(def, els, { meter: [ra, bk] }, false);
      out.value = ra === bk ? 0 : r6(sol.v[ra] - sol.v[bk]);
      out.text = fmt("volts", out.value, nom);
      return out;
    }
    var live = def.elements.some(function (el) { return el.type === "source" && (!el.ctl || n.inp[el.ctl]); });
    if (live) { out.blocked = "power"; return out; }
    if (ra !== bk) {
      var sv = solveNet(def, els, { meter: [ra, bk] }, false);
      if (Math.abs(sv.v[ra] - sv.v[bk]) >= OHMS_SEES_V) { out.blocked = "source"; return out; }
    }
    var R = ra === bk ? 0 : (function () {
      var so = solveNet(def, els, { inject: [ra, bk, P.ohmTestI] }, true);
      return (so.v[ra] - so.v[bk]) / P.ohmTestI;
    })();
    out.value = R > P.olOhms ? null : r6(Math.max(0, R) + P.rLeads);
    out.text = fmt("ohms", out.value);
    return out;
  }

  /* Diagnose: the scenario fixes the fault; probes off the scenario menu read nothing. The result carries
     the symptom picture (contactor states) and the reading. */
  function diagnose(id, inputs, scenarioId, probe) {
    var def = getDef(id), sc = null;
    def.scenarios.forEach(function (s) { if (s.id === scenarioId) sc = s; });
    if (!sc) return { blocked: "scenario" };
    var inp = copy(inputs || {}), k;
    for (k in (sc.base || {})) if (has(sc.base, k) && inp[k] == null) inp[k] = sc.base[k];
    inp.fault = sc.correct;
    var n = norm(def, inp), s = settle(def, n);
    var res = { contactors: copy(s.on), reading: null };
    if (probe) {
      if (sc.points.indexOf(probe.red) < 0 || sc.points.indexOf(probe.black) < 0) res.reading = { blocked: "menu" };
      else if ((sc.modes || ["volts"]).indexOf(probe.mode) < 0) res.reading = { blocked: "mode" };
      else { inp.contactors = s.on; res.reading = measure(id, inp, probe); }
    }
    return res;
  }

  var CtlCircuits = {
    register: register, validate: validate,
    get: function (id) { return circuits[id] || null; },
    list: function () { return Object.keys(circuits); }
  };
  var CtlEngine = {
    version: 1, defaults: defaults, apply: apply, tap: tap, derive: derive, measure: measure, diagnose: diagnose,
    format: fmt, types: TYPES.slice(), faultKinds: FAULT_KINDS.slice(), modes: MODES.slice(), nodeStates: NODE_STATES.slice()
  };
  root.CtlCircuits = CtlCircuits;
  root.CtlEngine = CtlEngine;

  var q = root.CtlCircuitQueue;
  if (isArr(q)) {
    q.forEach(function (def) {
      try { register(def); } catch (err) { (root.CtlCircuitErrors = root.CtlCircuitErrors || []).push(String(err && err.message)); }
    });
    q.length = 0;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
