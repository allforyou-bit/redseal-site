/* Multimeter practice engine, v1. Pure functions: no DOM access, no hidden state.
   Reads circuits registered with DcCircuits (dc-engine.v1.js, loaded first and unchanged) and puts an
   example meter on them. The solver is a copy of the DC one: nodal analysis, sources in Norton form, an
   open as params.rOpen, a params.gMin leak on every node. V-ohm jack: reads as the DC meter does. A jack,
   whatever the dial: a fuse-type element between the probes (params.rLeads + meter.rShunt, rated
   meter.fuseRating). Circuit and meter fuses settle together, the most over its rating first (a model
   rule, not a fuse curve), and stay open until the caller clears them. Every value is an example value
   computed from the data file, never a service limit. */
(function (root) {
  "use strict";

  var DIALS = ["off", "dcv", "acv", "ohm", "cont", "dca"];
  var JACKS = ["vo", "a"];
  var CLASSES = ["off", "idle", "jackA", "jackV", "meterFuse", "value", "noAc", "ol", "powered", "source"];
  var RANGES = ["auto", "r6", "r60"];
  var RANGE_DEC = { r6: 3, r60: 2 };
  var UNIT = { off: "", dcv: "V", acv: "V", ohm: "\u03A9", cont: "\u03A9", dca: "A" };
  /* drill controls that are actions, not engine inputs */
  var ACTIONS = ["replaceFuse", "replaceMeterFuse", "together", "newLeads", "range"];
  /* meter states a need entry may name beside the circuit inputs */
  var STATES = ["leadBroken", "meterBlown"];
  var NEED_KEYS = ["dial", "jack", "range", "pairs", "together", "when", "cls", "inSeries"];
  var CARDS = ["idle", "olOhms", "olRange", "powered", "source", "noAc", "jackA", "jackV", "meterFuse",
    "meterFuseOpened", "circuitFuseOpened", "lamp", "bright", "dim", "off"];
  /* ohms is refused when the leads see a voltage the meter would show (half of its 0.01 V step) */
  var OHMS_SEES_V = 0.005;
  var MID = "_m";

  function num(x, d) { x = +x; return x === x && isFinite(x) ? x : d; }
  function isArr(a) { return Object.prototype.toString.call(a) === "[object Array]"; }
  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function copy(o) { var r = {}, k; for (k in o) if (has(o, k)) r[k] = o[k]; return r; }
  function r6(x) { return Math.round(x * 1e6) / 1e6; }

  function getDef(id) {
    var C = root.DcCircuits, d = typeof id === "string" && C && C.get ? C.get(id) : null;
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
    n.meterBlown = inp.meterBlown === true;
    n.leadBroken = inp.leadBroken === true;
    return n;
  }
  function normMeter(def, m) {
    m = m || {};
    var R = def.meter && def.meter.ranges;
    return { dial: DIALS.indexOf(m.dial) >= 0 ? m.dial : "off", jack: m.jack === "a" ? "a" : "vo",
      range: m.range !== "auto" && has(R, m.range) ? m.range : "auto" };
  }

  /* the elements of one view with inputs, fuse states and the fault applied; a bench element (a fuse out of
     its holder) is open whenever the fuse it stands for has opened */
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
      el.open = ctlOpen || (!!el.cut && n.inp[el.cut]) || (el.type === "fuse" && !!n.blown[el.id]) || (hit && f.kind === "open") ||
        (!!el.bench && !!n.blown[el.bench]);
      el.removed = !!el.cut && n.inp[el.cut];
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

  /* the A jack: a fuse-type element from the red probe node to the black one */
  function meterEl(def, n, a, b) {
    var P = def.params, M = def.meter, r = P.rLeads + M.rShunt + (n.leadBroken ? P.rOpen : 0);
    return { id: MID, type: "fuse", a: a, b: b, r: r, rating: M.fuseRating, open: n.meterBlown, removed: false,
      g: n.meterBlown ? 1 / P.rOpen : 1 / r };
  }

  /* ---------- nodal solve (as dc-engine.v1.js) ---------- */
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

  /* extra: { meter: [nodeA, nodeB] }, { inject: [nodeIn, nodeOut, amps] } or { leak: siemens from every node
     to the reference }; zeroEmf: ohmmeter */
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
    if (extra && extra.leak) for (i = 0; i < nn; i++) A[i][i] += extra.leak;
    if (extra && extra.inject) { inject(extra.inject[0], extra.inject[2]); inject(extra.inject[1], -extra.inject[2]); }
    var x = gauss(A, b), v = {}, cur = {};
    v[ref] = 0;
    list.forEach(function (nd, k) { v[nd] = x[k]; });
    els.forEach(function (el) {
      var d = v[el.a] - v[el.b];
      cur[el.id] = el.type === "source" ? (zeroEmf ? 0 : el.emf) * el.g + d * el.g : d * el.g;
    });
    return { v: v, i: cur };
  }

  /* solve, open the fuse most over its rating (circuit fuses and the A jack alike), repeat. mel: the probe
     nodes of the A jack, or null. trace: the fuses opened, in order, with q = current / rating */
  function settle(def, n, mel) {
    var blown = copy(n.blown), mb = n.meterBlown, els, sol, guard = 0, trace = [];
    for (;;) {
      var m = copy(n); m.blown = blown; m.meterBlown = mb;
      els = elementsFor(def, m);
      if (mel) els.push(meterEl(def, m, mel[0], mel[1]));
      sol = solveNet(def, els, null, false);
      var worst = null, wr = 1, wi = 0;
      els.forEach(function (el) {
        if (el.type !== "fuse" || el.open) return;
        var q = Math.abs(sol.i[el.id]) / el.rating;
        if (q > wr) { wr = q; worst = el.id; wi = sol.i[el.id]; }
      });
      if (!worst || ++guard > 20) break;
      trace.push({ fuse: worst, q: r6(wr), current: r6(wi) });
      if (worst === MID) mb = true;
      else { blown = copy(blown); blown[worst] = true; }
    }
    return { els: els, sol: sol, blown: blown, meterBlown: mb, trace: trace };
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
      if (el.type === "fuse" && el.id !== MID) out[el.id] = el.removed ? "removed" : s.blown[el.id] ? "blown" : "ok";
    });
    return out;
  }
  function nodeState(v, nom) { var q = v / nom; return q >= 0.9 ? "pos" : q <= 0.1 ? "gnd" : "mid"; }

  /* whole-circuit picture, as DcEngine.derive: line states drawn as a meter to the reference reads them */
  function picture(def, n, s) {
    var P = def.params, nom = def.views[n.view].nominal, nodes = {}, elements = {};
    var vd = solveNet(def, s.els, { leak: 1 / P.rMeter }, false).v;
    Object.keys(vd).forEach(function (nd) { nodes[nd] = nodeState(vd[nd], nom); });
    s.els.forEach(function (el) {
      if (el.id === "_fault" || el.id === MID) return;
      var i = s.sol.i[el.id], mid = (vd[el.a] + vd[el.b]) / 2;
      elements[el.id] = { state: nodeState(mid, nom), flow: Math.abs(i) > P.flowMin, dir: i > 0 ? 1 : i < 0 ? -1 : 0 };
    });
    return { nodes: nodes, elements: elements, lamps: lampLevels(def, n, s), fuses: fuseStates(s) };
  }

  /* fixed decimals with halves rounded up (toFixed alone turns 2.55 into 2.5 but 0.45 into 0.5) */
  function fixed(x, d) { var p = Math.pow(10, d); return (Math.round(x * p + 1e-7) / p).toFixed(d); }
  function signed(x, d, unit) { var t = fixed(Math.abs(x), d); return (x < 0 && +t !== 0 ? "\u2212" : "") + t + " " + unit; }
  /* text of a value reading: dial, value, nominal voltage of the view, range key (DC volts only) */
  function fmt(dial, x, nom, range) {
    if (dial === "ohm" || dial === "cont") {
      if (x == null) return "OL";
      if (x < 200) return fixed(x, 1) + " \u03A9";
      if (x < 2e5) return fixed(x / 1000, 2) + " k\u03A9";
      return fixed(x / 1e6, 2) + " M\u03A9";
    }
    if (dial === "dca") return signed(x, 2, "A");
    return signed(x, has(RANGE_DEC, range) ? RANGE_DEC[range] : nom > 60 ? 1 : 2, "V");
  }

  function pointOf(def, id) { var p = null; def.points.forEach(function (q) { if (q.id === id) p = q; }); return p; }
  /* a point the lead can be on now: in the view and, for a bench point, while its bench input is true */
  function pointNode(def, n, id) {
    var p = pointOf(def, id);
    if (!p || (p.views && p.views.indexOf(n.view) < 0) || (p.bench && !n.inp[p.bench])) return null;
    return p.node;
  }
  function firstLamp(def) { var id = null; def.elements.forEach(function (el) { if (!id && el.type === "lamp") id = el.id; }); return id; }

  /* ---------- public ---------- */
  function defaults(id) {
    var def = getDef(id), out = { view: def.defaultView, fault: null, blown: {}, meterBlown: false, leadBroken: false }, k;
    for (k in def.inputs) if (has(def.inputs, k)) out[k] = !!def.inputs[k];
    return out;
  }

  /* inputs: circuit inputs plus blown, meterBlown, leadBroken (and fault, view);
     meter: { dial, jack, range }; probe: { red, black } point ids, or { together: true } */
  function read(id, inputs, meter, probe) {
    var def = getDef(id), P = def.params, M = def.meter, n = norm(def, inputs), mt = normMeter(def, meter);
    var nom = def.views[n.view].nominal, dial = mt.dial, aJack = mt.jack === "a";
    if (aJack && !M) throw new Error("circuit " + id + " has no meter block: no A jack");
    probe = probe || {};
    var tog = probe.together === true, ra = tog ? null : pointNode(def, n, probe.red), bk = tog ? null : pointNode(def, n, probe.black);
    var placed = tog || (!!ra && !!bk), bridge = !tog && placed && ra !== bk;
    var s = settle(def, n, aJack && bridge ? [ra, bk] : null), m = copy(n);
    m.blown = s.blown; m.meterBlown = s.meterBlown;
    var lamp = firstLamp(def), lampI = lamp && s.sol.i[lamp] != null ? r6(s.sol.i[lamp]) : 0;
    var out = { cls: "", text: "", value: null, unit: UNIT[dial], beep: false,
      events: { meterFuse: s.meterBlown && !n.meterBlown, circuitFuse: Object.keys(s.blown).some(function (k) { return !n.blown[k]; }) },
      latch: { blown: copy(s.blown), meterBlown: s.meterBlown }, circuit: picture(def, n, s),
      meterI: aJack && bridge ? r6(s.sol.i[MID]) : 0, lampI: lampI, inSeries: false, trace: s.trace };

    /* the V-ohm jack on DC volts, AC volts or DC amps: params.rMeter between the probes (with a broken lead,
       params.rOpen in series: the display shows the current through the meter times params.rMeter) */
    function voltmeter() {
      if (!bridge) return 0;
      var d;
      if (!n.leadBroken) {
        var sv = solveNet(def, elementsFor(def, m), { meter: [ra, bk] }, false);
        d = sv.v[ra] - sv.v[bk];
        out.meterI = r6(d / P.rMeter);
        return d;
      }
      var els = elementsFor(def, m), g = 1 / (P.rMeter + P.rOpen);
      els.push({ id: "_v", type: "wire", a: ra, b: bk, g: g });
      var sb = solveNet(def, els, null, false), cur = sb.i._v;
      out.meterI = r6(cur);
      return cur * P.rMeter;
    }

    if (dial === "off") out.cls = "off";
    else if (!placed) out.cls = "idle";
    else if (aJack && dial !== "dca") out.cls = "jackA";
    else if (!aJack && dial === "dca") { voltmeter(); out.cls = "jackV"; }
    else if (aJack) {
      if (s.meterBlown) out.cls = "meterFuse";
      else { out.cls = "value"; out.value = bridge ? r6(s.sol.i[MID]) : 0; }
    } else if (dial === "acv") { voltmeter(); out.cls = "noAc"; }
    else if (dial === "dcv") {
      var v = r6(voltmeter()), lim = mt.range === "auto" ? null : M.ranges[mt.range];
      if (lim != null && Math.abs(v) > lim) out.cls = "ol";
      else { out.cls = "value"; out.value = v; }
    } else ohms();

    function ohms() {
      var R;
      if (tog) { out.cls = n.leadBroken ? "ol" : "value"; R = P.rLeads; }
      else if (n.inp.power && (!pointOf(def, probe.red).bench || !pointOf(def, probe.black).bench)) { out.cls = "powered"; return; }
      else {
        var els = elementsFor(def, m), across = els.some(function (el) {
          return el.type === "source" && ((el.a === ra && el.b === bk) || (el.a === bk && el.b === ra));
        });
        /* a source further along the path: with the meter between the leads, they still see its voltage */
        if (!across && ra !== bk) {
          var sv = solveNet(def, els, { meter: [ra, bk] }, false);
          across = Math.abs(sv.v[ra] - sv.v[bk]) >= OHMS_SEES_V;
        }
        if (across) { out.cls = "source"; return; }
        var cold = copy(m); cold.ohms = true;
        els = elementsFor(def, cold);
        R = ra === bk ? 0 : (function () {
          var so = solveNet(def, els, { inject: [ra, bk, P.ohmTestI] }, true);
          return (so.v[ra] - so.v[bk]) / P.ohmTestI;
        })();
        out.cls = n.leadBroken || R > P.olOhms ? "ol" : "value";
        if (out.cls === "value") R = Math.max(0, R) + P.rLeads;
      }
      if (out.cls === "value") {
        out.value = r6(R);
        out.beep = dial === "cont" && !!M && out.value <= M.contBeep;
      }
    }

    if (out.cls === "value") out.text = fmt(dial, out.value, nom, mt.range);
    else if (out.cls === "ol") out.text = "OL";
    var L = out.circuit.lamps[lamp];
    out.inSeries = !!L && L !== "off" && Math.abs(Math.abs(out.meterI) - Math.abs(lampI)) <= 0.01 * Math.abs(lampI);
    return out;
  }

  /* one need entry of a drill against a reading: st = { inputs, meter, probe } as passed to read() */
  function meets(def, e, st, res) {
    var mt = normMeter(def, st.meter), n = norm(def, st.inputs), p = st.probe || {}, k, w = e.when || {};
    if (e.dial && e.dial.indexOf(mt.dial) < 0) return false;
    if (e.jack && e.jack !== mt.jack) return false;
    if (e.range && e.range.indexOf(mt.range) < 0) return false;
    if (e.together && p.together !== true) return false;
    if (e.pairs && (p.together === true || !e.pairs.some(function (q) {
      return (q[0] === p.red && q[1] === p.black) || (q[0] === p.black && q[1] === p.red);
    }))) return false;
    for (k in w) if (has(w, k) && (STATES.indexOf(k) >= 0 ? n[k] : n.inp[k]) !== !!w[k]) return false;
    if (e.cls && e.cls.indexOf(res.cls) < 0) return false;
    if (e.inSeries && !res.inSeries) return false;
    return true;
  }
  function drillOf(def, drillId) { var d = null; (def.drills || []).forEach(function (x) { if (x.id === drillId) d = x; }); return d; }
  /* does this reading meet step k of the drill need (any one of its entries)? */
  function fits(id, drillId, k, st, res) {
    var def = getDef(id), d = drillOf(def, drillId);
    if (!d || !isArr(d.need) || !isArr(d.need[k])) return false;
    return d.need[k].some(function (e) { return meets(def, e, st, res); });
  }

  /* the meter block, the drills and the text keys they use; returns a list of errors */
  function check(id) {
    var def, e = [];
    try { def = getDef(id); } catch (err) { return [String(err.message)]; }
    var M = def.meter, T = def.text || {}, pts = {}, used = {}, seen = {};
    function no(c, s) { if (c) e.push(s); }
    function str(o, k, w) { no(!o || typeof o[k] !== "string" || !o[k], w + " has no text: " + k); }
    function rng(v) { return v === "auto" || has(M.ranges, v); }
    if (!M || typeof M !== "object") return ["missing meter block"];
    ["rShunt", "fuseRating", "contBeep"].forEach(function (k) { no(!(num(M[k], 0) > 0), "meter " + k + " must be > 0"); });
    if (!M.ranges || typeof M.ranges !== "object") e.push("meter ranges missing");
    else Object.keys(M.ranges).forEach(function (k) { no(RANGES.indexOf(k) < 1 || !(num(M.ranges[k], 0) > 0), "meter range invalid: " + k); });
    def.points.forEach(function (p) { pts[p.id] = 1; no(p.bench != null && !has(def.inputs, p.bench), "point bench is not an input: " + p.id); });
    def.elements.forEach(function (el) {
      no(el.bench != null && !def.elements.some(function (x) { return x.id === el.bench && x.type === "fuse" && x !== el; }), "element bench is not a fuse: " + el.id);
    });
    no(!firstLamp(def), "no lamp");
    CARDS.forEach(function (k) { str(T.cards, k, "card"); });
    DIALS.forEach(function (k) { str(T.dials, k, "dial"); str(T.dialNames, k, "dial name"); });
    JACKS.forEach(function (k) { str(T.jacks, k, "jack"); });
    RANGES.forEach(function (k) { if (rng(k)) str(T.ranges, k, "range"); });
    str(T, "readingNote", "reading");
    if (!isArr(def.drills) || !def.drills.length) return e.concat("missing drills");
    def.drills.forEach(function (d) {
      var D = "drill " + d.id + ": ", pr = d.preset || {}, pm = pr.meter || {}, pin = pr.inputs || {}, ctl = isArr(d.controls) ? d.controls : [];
      if (typeof d.id !== "string" || !/^[a-z][a-z0-9_]*$/.test(d.id) || seen[d.id]) { e.push("drill id invalid or repeated: " + d.id); return; }
      seen[d.id] = 1;
      str(T.drills, d.id, "drill");
      no(!isArr(d.causes) || d.causes.length < 2 || d.causes.indexOf(d.correct) < 0, D + "causes must include the correct cause");
      (d.causes || []).forEach(function (c, i) { no(d.causes.indexOf(c) !== i, D + "repeats " + c); str(T.causes, c, "cause"); used[c] = 1; });
      no(DIALS.indexOf(pm.dial) < 0 || JACKS.indexOf(pm.jack) < 0 || (pm.range != null && !rng(pm.range)), D + "preset meter invalid");
      ["red", "black"].forEach(function (k) { no(pr[k] != null && !pts[pr[k]], D + "preset point unknown"); });
      Object.keys(pin).forEach(function (k) { no(!has(def.inputs, k), D + "preset input unknown: " + k); });
      Object.keys(pr.blown || {}).forEach(function (k) {
        no(!def.elements.some(function (el) { return el.id === k && el.type === "fuse" && !el.bench; }), D + "preset blown is not a fuse: " + k);
      });
      no(!isArr(d.controls), D + "missing controls");
      ctl.forEach(function (k) { no(!has(def.inputs, k) && ACTIONS.indexOf(k) < 0, D + "control unknown: " + k); str(T.controls, k, "control"); });
      if (!isArr(d.need) || !d.need.length) { e.push(D + "missing need"); return; }
      d.need.forEach(function (step) {
        if (!isArr(step) || !step.length) { e.push(D + "empty need step"); return; }
        step.forEach(function (x) {
          Object.keys(x).forEach(function (k) { no(NEED_KEYS.indexOf(k) < 0, D + "need key unknown: " + k); });
          no(!isArr(x.dial) || !x.dial.length || x.dial.some(function (v) { return DIALS.indexOf(v) < 1; }), D + "need dial invalid");
          no(JACKS.indexOf(x.jack) < 0, D + "need jack invalid");
          no(x.range != null && (!isArr(x.range) || !x.range.every(rng)), D + "need range invalid");
          no(!!x.range && ctl.indexOf("range") < 0 && x.range.indexOf(pm.range || "auto") < 0, D + "need range is not offered");
          no(!isArr(x.cls) || !x.cls.length || x.cls.some(function (v) { return CLASSES.indexOf(v) < 0; }), D + "need class invalid");
          no(x.together != null && (x.together !== true || !!x.pairs || ctl.indexOf("together") < 0), D + "need together invalid");
          no(x.inSeries != null && x.inSeries !== true, D + "need inSeries must be true");
          (x.pairs || []).forEach(function (q) { no(!isArr(q) || q.length !== 2 || q[0] === q[1] || !pts[q[0]] || !pts[q[1]], D + "need pair invalid"); });
          Object.keys(x.when || {}).forEach(function (k) {
            var st = STATES.indexOf(k) >= 0, start = st ? pr[k] === true : has(pin, k) ? !!pin[k] : !!def.inputs[k];
            if (!st && !has(def.inputs, k)) { e.push(D + "need condition is not an input: " + k); return; }
            no(x.when[k] !== start && ctl.indexOf(st ? (k === "leadBroken" ? "newLeads" : "replaceMeterFuse") : k) < 0, D + "need condition is not reachable: " + k);
          });
        });
      });
    });
    Object.keys(T.causes || {}).forEach(function (c) { no(!used[c], "cause text not used by any drill: " + c); });
    return e;
  }

  var MmEngine = {
    version: 1, defaults: defaults, read: read, fits: fits, check: check, format: fmt,
    dials: DIALS.slice(), jacks: JACKS.slice(), classes: CLASSES.slice(), ranges: RANGES.slice()
  };
  root.MmEngine = MmEngine;
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
