/* DC circuit fault lab engine, v1.
   Pure functions: no DOM access, no hidden state. Circuits are data files that call DcCircuits.register()
   (or queue themselves in DcCircuitQueue when they load first). A classic IIFE with a globalThis
   fallback, like sim-engine.v1.js.
   Model: a linear DC network solved by nodal analysis (modified nodal analysis with every source in its
   Norton form, so no extra unknowns). A source is an ideal EMF plus internal resistance. Wires, fuses,
   switches, connectors and lamps are resistors. An open is a very large resistance (params.rOpen) and
   every node has a tiny leak to the reference (params.gMin), so the matrix is never singular.
   Faults: open (R = rOpen), high resistance (R x k), short to ground or to power (a small R from a node
   to the ground node or to another node), stuck-closed switch, weak source (Rint x k), low fuse rating.
   Fuses: a fuse opens when its steady current exceeds its rating (a model rule, not a fuse curve) and
   stays open until the caller clears it (inputs.blown is passed in and handed back: latching).
   The meter: DC volts puts params.rMeter between the probes, so a reading across an open is real.
   Ohms is refused while the power is connected, and also when a source is in the path between the
   leads (the leads would see its voltage). Otherwise it injects a test current with every EMF set to 0,
   sees lamps at their cold resistance (rCold) and adds the meter lead resistance (params.rLeads).
   Lamps are fixed resistors when lit (no cold-filament change); their level is a display band of rated
   power. Every value is an example-circuit value computed from the parts in the data file, never a
   service limit. */
(function (root) {
  "use strict";

  var TYPES = ["source", "wire", "fuse", "switch", "connector", "lamp"];
  var FAULT_KINDS = ["open", "highR", "shortGnd", "shortPwr", "stuckClosed", "weakSource", "lowRating"];
  var MODES = ["volts", "ohms"];
  var LAMP_LEVELS = ["off", "dim", "bright"];
  var NODE_STATES = ["pos", "mid", "gnd"];
  /* ohms is refused when the leads see a voltage the meter would show (half of its 0.01 V step) */
  var OHMS_SEES_V = 0.005;
  var ID_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
  var circuits = {};

  function num(x, d) { x = +x; return x === x && isFinite(x) ? x : d; }
  function isArr(a) { return Object.prototype.toString.call(a) === "[object Array]"; }
  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function copy(o) { var r = {}, k; for (k in o) if (has(o, k)) r[k] = o[k]; return r; }
  function r6(x) { return Math.round(x * 1e6) / 1e6; }

  /* ---------- registry ---------- */
  function validate(def) {
    var e = [], seen = {}, nodes = {}, els = {}, faults = {}, pts = {}, inputs = {};
    if (!def || typeof def !== "object") return ["definition is not an object"];
    if (typeof def.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(def.id)) e.push("missing id");
    ["nodes", "elements", "points", "faults", "scenarios"].forEach(function (k) { if (!isArr(def[k])) e.push("missing " + k); });
    if (!def.views || typeof def.views !== "object" || !Object.keys(def.views).length) e.push("missing views");
    if (!def.params || typeof def.params !== "object") e.push("missing params");
    if (!def.inputs || typeof def.inputs !== "object") e.push("missing inputs");
    if (e.length) return e;
    var T = def.text || {};
    function uniq(kind, id) {
      if (typeof id !== "string" || !ID_RE.test(id)) e.push(kind + " id invalid: " + id);
      else if (seen[id]) e.push("duplicate id: " + id);
      seen[id] = 1;
    }
    def.nodes.forEach(function (n) { uniq("node", n); nodes[n] = 1; });
    if (!nodes[def.ref]) e.push("ref node unknown: " + def.ref);
    if (!nodes[def.ground]) e.push("ground node unknown: " + def.ground);
    Object.keys(def.inputs).forEach(function (k) { inputs[k] = 1; });
    def.elements.forEach(function (el) {
      uniq("element", el.id); els[el.id] = el;
      if (TYPES.indexOf(el.type) < 0) e.push("element " + el.id + " unknown type " + el.type);
      if (!nodes[el.a] || !nodes[el.b]) e.push("element " + el.id + " unknown node");
      if (el.a === el.b) e.push("element " + el.id + " has both ends on one node");
      if (el.type === "source") { if (!(el.emf >= 0) || !(el.rint > 0)) e.push("source " + el.id + " needs emf and rint"); }
      else if (!(el.r > 0)) e.push("element " + el.id + " needs r > 0");
      if (el.rCold != null && !(el.rCold > 0)) e.push("element " + el.id + " rCold must be > 0");
      if (el.type === "fuse" && !(el.rating > 0)) e.push("fuse " + el.id + " needs a rating");
      if (el.ctl && !inputs[el.ctl]) e.push("element " + el.id + " ctl is not an input: " + el.ctl);
      if (el.cut && !inputs[el.cut]) e.push("element " + el.id + " cut is not an input: " + el.cut);
    });
    Object.keys(def.views).forEach(function (vk) {
      var v = def.views[vk];
      if (!(v.nominal > 0)) e.push("view " + vk + " needs a nominal voltage");
      Object.keys(v.set || {}).forEach(function (id) {
        if (!els[id]) { e.push("view " + vk + " sets unknown element " + id); return; }
        ["a", "b"].forEach(function (k) { if (v.set[id][k] != null && !nodes[v.set[id][k]]) e.push("view " + vk + " unknown node on " + id); });
      });
      (v.omit || []).forEach(function (id) { if (!els[id]) e.push("view " + vk + " omits unknown element " + id); });
    });
    def.points.forEach(function (p) {
      uniq("point", p.id); pts[p.id] = p;
      if (!nodes[p.node]) e.push("point " + p.id + " unknown node " + p.node);
      (p.views || []).forEach(function (v) { if (!def.views[v]) e.push("point " + p.id + " unknown view " + v); });
      if (!T.points || typeof T.points[p.id] !== "string") e.push("point " + p.id + " has no label");
    });
    var NEED = { highR: null, open: null, stuckClosed: "switch", weakSource: "source", lowRating: "fuse" };
    def.faults.forEach(function (f) {
      uniq("fault", f.id); faults[f.id] = f;
      if (FAULT_KINDS.indexOf(f.kind) < 0) { e.push("fault " + f.id + " unknown kind " + f.kind); return; }
      if (f.kind === "shortGnd" || f.kind === "shortPwr") {
        if (!nodes[f.node]) e.push("fault " + f.id + " unknown node " + f.node);
        if (f.kind === "shortPwr" && !nodes[f.to]) e.push("fault " + f.id + " unknown target node " + f.to);
      } else if (!els[f.el]) e.push("fault " + f.id + " unknown element " + f.el);
      else if (NEED[f.kind] && els[f.el].type !== NEED[f.kind]) e.push("fault " + f.id + " needs a " + NEED[f.kind]);
      if (/^(highR|weakSource|lowRating)$/.test(f.kind) && !(f.k > 0)) e.push("fault " + f.id + " needs k > 0");
      if (!T.faults || typeof T.faults[f.id] !== "string") e.push("fault " + f.id + " has no name");
    });
    def.scenarios.forEach(function (s) {
      uniq("scenario", s.id);
      var vw = def.views[s.view];
      if (!vw) e.push("scenario " + s.id + " unknown view " + s.view);
      if (!faults[s.correct]) e.push("scenario " + s.id + " unknown correct fault " + s.correct);
      if (!isArr(s.causes) || s.causes.indexOf(s.correct) < 0) e.push("scenario " + s.id + " causes must include the correct fault");
      (s.causes || []).forEach(function (c) { if (!faults[c]) e.push("scenario " + s.id + " unknown cause " + c); });
      (s.points || []).forEach(function (p) {
        if (!pts[p]) e.push("scenario " + s.id + " unknown point " + p);
        else if (pts[p].views && pts[p].views.indexOf(s.view) < 0) e.push("scenario " + s.id + " point not in its view: " + p);
      });
      (s.controls || []).forEach(function (k) { if (!inputs[k] && k !== "replaceFuse") e.push("scenario " + s.id + " control has no engine input: " + k); });
      (s.modes || []).forEach(function (m) { if (MODES.indexOf(m) < 0) e.push("scenario " + s.id + " unknown mode " + m); });
      (s.mustView || []).forEach(function (m) {
        if ((s.modes || []).indexOf(m.mode) < 0) e.push("scenario " + s.id + " mustView mode not offered: " + m.mode);
        if ((s.points || []).indexOf(m.red) < 0 || (s.points || []).indexOf(m.black) < 0) e.push("scenario " + s.id + " mustView point not offered");
        Object.keys(m.when || {}).forEach(function (k) {
          if (!inputs[k]) e.push("scenario " + s.id + " mustView condition is not an input: " + k);
          else if ((s.controls || []).indexOf(k) < 0 && m.when[k] !== (has(s.base, k) ? s.base[k] : !!def.inputs[k])) e.push("scenario " + s.id + " mustView needs a control not offered: " + k);
        });
      });
      if (!T.symptoms || typeof T.symptoms[s.symptom] !== "string") e.push("scenario " + s.id + " unknown symptom key " + s.symptom);
    });
    return e;
  }
  function register(def) {
    var errs = validate(def);
    if (errs.length) throw new Error("circuit " + (def && def.id) + ": " + errs.join("; "));
    circuits[def.id] = def;
    return def;
  }
  function getDef(id) {
    var d = typeof id === "string" ? circuits[id] : null;
    if (!d) throw new Error("unknown circuit: " + id);
    return d;
  }

  /* ---------- inputs ---------- */
  function norm(def, inp) {
    inp = inp || {};
    var n = { view: has(def.views, inp.view) ? inp.view : def.defaultView, inp: {}, fault: null, blown: {} }, k;
    for (k in def.inputs) if (has(def.inputs, k)) n.inp[k] = inp[k] == null ? !!def.inputs[k] : !!inp[k];
    def.faults.forEach(function (f) { if (f.id === inp.fault) n.fault = f; });
    var b = inp.blown || {};
    def.elements.forEach(function (el) { if (el.type === "fuse" && b[el.id] === true) n.blown[el.id] = true; });
    return n;
  }

  /* the elements of one view with inputs, fuse states and the fault applied */
  function elementsFor(def, n) {
    var P = def.params, V = def.views[n.view], set = V.set || {}, omit = V.omit || [], f = n.fault, out = [];
    def.elements.forEach(function (el0) {
      if (omit.indexOf(el0.id) >= 0) return;
      var el = copy(el0), s = set[el0.id], k, hit = !!f && f.el === el0.id;
      if (s) for (k in s) if (has(s, k)) el[k] = s[k];
      var ctlOpen = !!el.ctl && !n.inp[el.ctl];
      if (hit && f.kind === "stuckClosed") ctlOpen = false;
      if (hit && f.kind === "highR") el.r = el.r * f.k;
      if (hit && f.kind === "weakSource") el.rint = el.rint * f.k;
      if (hit && f.kind === "lowRating") el.rating = el.rating * f.k;
      el.open = ctlOpen || (!!el.cut && n.inp[el.cut]) || (el.type === "fuse" && !!n.blown[el.id]) || (hit && f.kind === "open");
      el.removed = !!el.cut && n.inp[el.cut];
      /* the ohmmeter sees a lamp cold: its cold resistance, when the data gives one */
      var r = n.ohms && el.type === "lamp" && el.rCold > 0 ? el.rCold : el.r;
      el.g = el.type === "source" ? 1 / el.rint : el.open ? 1 / P.rOpen : 1 / r;
      out.push(el);
    });
    if (f && (f.kind === "shortGnd" || f.kind === "shortPwr")) {
      var to = f.kind === "shortGnd" ? def.ground : f.to;
      if (present(out, f.node) && present(out, to)) out.push({ id: "_fault", type: "wire", a: f.node, b: to, r: P.rShort, g: 1 / P.rShort, open: false });
    }
    return out;
  }
  function present(els, node) { return els.some(function (el) { return el.a === node || el.b === node; }); }

  /* ---------- nodal solve ---------- */
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

  /* extra: { meter: [nodeA, nodeB] } or { inject: [nodeIn, nodeOut, amps] }; zeroEmf: ohmmeter */
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
      if (el.type === "source" && !zeroEmf) { inject(el.b, el.emf * el.g); inject(el.a, -el.emf * el.g); }
    });
    if (extra && extra.meter) stamp(extra.meter[0], extra.meter[1], 1 / P.rMeter);
    if (extra && extra.inject) { inject(extra.inject[0], extra.inject[2]); inject(extra.inject[1], -extra.inject[2]); }
    var x = gauss(A, b), v = {}, cur = {};
    v[ref] = 0;
    list.forEach(function (nd, k) { v[nd] = x[k]; });
    els.forEach(function (el) {
      var d = v[el.a] - v[el.b];
      /* a source reports the current it delivers out of its + terminal (b); others: current from a to b */
      cur[el.id] = el.type === "source" ? (zeroEmf ? 0 : el.emf) * el.g + d * el.g : d * el.g;
    });
    return { v: v, i: cur };
  }

  /* solve, open the fuse most over its rating, repeat; returns the settled solution and fuse states */
  function settle(def, n) {
    var blown = copy(n.blown), els, sol, guard = 0;
    for (;;) {
      var m = copy(n); m.blown = blown;
      els = elementsFor(def, m);
      sol = solveNet(def, els, null, false);
      var worst = null, wr = 1;
      els.forEach(function (el) {
        if (el.type !== "fuse" || el.open) return;
        var q = Math.abs(sol.i[el.id]) / el.rating;
        if (q > wr) { wr = q; worst = el.id; }
      });
      if (!worst || ++guard > 20) break;
      blown = copy(blown); blown[worst] = true;
    }
    return { els: els, sol: sol, blown: blown };
  }

  /* ---------- outputs ---------- */
  function lampLevels(def, n, s) {
    var P = def.params, V = def.views[n.view], out = {};
    s.els.forEach(function (el) {
      if (el.type !== "lamp") return;
      var i = s.sol.i[el.id], ratio = (i * i * el.r) / (V.nominal * V.nominal / el.r);
      out[el.id] = ratio >= P.brightAt ? "bright" : ratio >= P.dimAt ? "dim" : "off";
    });
    return out;
  }
  function fuseStates(s) {
    var out = {};
    s.els.forEach(function (el) {
      if (el.type === "fuse") out[el.id] = el.removed ? "removed" : s.blown[el.id] ? "blown" : "ok";
    });
    return out;
  }
  function nodeState(v, nom) { var q = v / nom; return q >= 0.9 ? "pos" : q <= 0.1 ? "gnd" : "mid"; }

  function fmt(mode, x, nom) {
    if (mode === "ohms") {
      if (x == null) return "OL";
      if (x < 200) return x.toFixed(1) + " \u03A9";
      if (x < 2e5) return (x / 1000).toFixed(2) + " k\u03A9";
      return (x / 1e6).toFixed(2) + " M\u03A9";
    }
    var d = nom > 60 ? 1 : 2, t = Math.abs(x).toFixed(d);
    return (x < 0 && +t !== 0 ? "\u2212" : "") + t + " V";
  }

  function pointNode(def, n, id) {
    var p = null;
    def.points.forEach(function (q) { if (q.id === id) p = q; });
    if (!p || (p.views && p.views.indexOf(n.view) < 0)) return null;
    return p.node;
  }

  /* ---------- public ---------- */
  function defaults(id) {
    var def = getDef(id), out = { view: def.defaultView, fault: null, blown: {} }, k;
    for (k in def.inputs) if (has(def.inputs, k)) out[k] = !!def.inputs[k];
    return out;
  }

  /* whole-circuit picture for the free modes: node and element states, flow, lamps, fuses */
  function derive(id, inputs) {
    var def = getDef(id), n = norm(def, inputs), s = settle(def, n), nom = def.views[n.view].nominal, P = def.params;
    var nodes = {}, elements = {};
    Object.keys(s.sol.v).forEach(function (nd) { nodes[nd] = nodeState(s.sol.v[nd], nom); });
    s.els.forEach(function (el) {
      if (el.id === "_fault") return;
      var i = s.sol.i[el.id], mid = (s.sol.v[el.a] + s.sol.v[el.b]) / 2;
      elements[el.id] = { state: nodeState(mid, nom), flow: Math.abs(i) > P.flowMin, dir: i > 0 ? 1 : i < 0 ? -1 : 0 };
    });
    return { view: n.view, nodes: nodes, elements: elements, lamps: lampLevels(def, n, s), fuses: fuseStates(s), blown: s.blown };
  }

  /* probe = { mode: "volts" | "ohms", red: pointId, black: pointId } */
  function measure(id, inputs, probe) {
    var def = getDef(id), P = def.params, n = norm(def, inputs), nom = def.views[n.view].nominal;
    probe = probe || {};
    var mode = MODES.indexOf(probe.mode) >= 0 ? probe.mode : "volts";
    var ra = pointNode(def, n, probe.red), bk = pointNode(def, n, probe.black);
    var out = { mode: mode, value: null, text: "", blocked: null, blown: copy(n.blown) };
    if (!ra || !bk) { out.blocked = "point"; return out; }
    if (mode === "volts") {
      var s = settle(def, n), m = copy(n);
      m.blown = s.blown;
      var sol = ra === bk ? { v: {} } : solveNet(def, elementsFor(def, m), { meter: [ra, bk] }, false);
      out.value = ra === bk ? 0 : r6(sol.v[ra] - sol.v[bk]);
      out.text = fmt("volts", out.value, nom);
      out.blown = s.blown;
      return out;
    }
    if (n.inp.power) { out.blocked = "power"; return out; }
    var els = elementsFor(def, n), across = els.some(function (el) {
      return el.type === "source" && ((el.a === ra && el.b === bk) || (el.a === bk && el.b === ra));
    });
    /* a source further along the path (a battery plus a cable, or both batteries of the 24 V pair):
       with the meter between the leads, they still see its voltage */
    if (!across && ra !== bk) {
      var sv = solveNet(def, els, { meter: [ra, bk] }, false);
      across = Math.abs(sv.v[ra] - sv.v[bk]) >= OHMS_SEES_V;
    }
    if (across) { out.blocked = "source"; return out; }
    var cold = copy(n); cold.ohms = true;
    els = elementsFor(def, cold);
    /* the reading includes the meter leads (params.rLeads), as a real meter does before it is zeroed */
    var R = ra === bk ? 0 : (function () {
      var so = solveNet(def, els, { inject: [ra, bk, P.ohmTestI] }, true);
      return (so.v[ra] - so.v[bk]) / P.ohmTestI;
    })();
    out.value = R > P.olOhms ? null : r6(Math.max(0, R) + P.rLeads);
    out.text = fmt("ohms", out.value);
    return out;
  }

  /* Diagnose: the scenario fixes the view and the fault; probes off the scenario menu read nothing.
     The result carries the symptom picture (lamps, fuses) and nothing else about the circuit. */
  function diagnose(id, inputs, scenarioId, probe) {
    var def = getDef(id), sc = null;
    def.scenarios.forEach(function (s) { if (s.id === scenarioId) sc = s; });
    if (!sc) return { blocked: "scenario" };
    var inp = copy(inputs || {}), k;
    for (k in (sc.base || {})) if (has(sc.base, k) && inp[k] == null) inp[k] = sc.base[k];
    inp.view = sc.view; inp.fault = sc.correct;
    var n = norm(def, inp), s = settle(def, n);
    var res = { lamps: lampLevels(def, n, s), fuses: fuseStates(s), blown: s.blown, reading: null };
    if (probe) {
      if (sc.points.indexOf(probe.red) < 0 || sc.points.indexOf(probe.black) < 0) res.reading = { blocked: "menu" };
      else if ((sc.modes || ["volts"]).indexOf(probe.mode) < 0) res.reading = { blocked: "mode" };
      else { inp.blown = s.blown; res.reading = measure(id, inp, probe); }
    }
    return res;
  }

  var DcCircuits = {
    register: register, validate: validate,
    get: function (id) { return circuits[id] || null; },
    list: function () { return Object.keys(circuits); }
  };
  var DcEngine = {
    version: 1, defaults: defaults, derive: derive, measure: measure, diagnose: diagnose, format: fmt,
    types: TYPES.slice(), faultKinds: FAULT_KINDS.slice(), modes: MODES.slice(),
    lampLevels: LAMP_LEVELS.slice(), nodeStates: NODE_STATES.slice()
  };
  root.DcCircuits = DcCircuits;
  root.DcEngine = DcEngine;

  var q = root.DcCircuitQueue;
  if (isArr(q)) {
    q.forEach(function (def) {
      try { register(def); } catch (err) { (root.DcCircuitErrors = root.DcCircuitErrors || []).push(String(err && err.message)); }
    });
    q.length = 0;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
