/* Planetary gear set simulator engine, v1 (planetary-design-v1-20261105.md section 2).
   Pure functions: no DOM access, no hidden state. Gearsets are data files that call PgsEngine.register()
   (or queue themselves in PgsSetQueue when they load first). A classic IIFE with a globalThis fallback,
   like ctl-engine.v1.js.
   Model: one ideal simple planetary set (rigid gears of one module, massless planets, no friction
   losses, steady state). Speeds follow the Willis relation Zs ws + Zr wr = (Zs + Zr) wc, with every speed
   given per turn of the input member. Torques come from the mesh force on a massless planet: the sun, ring
   and carrier take Zs, Zr and -(Zs + Zr) times one mesh force.
   - state(): Operate, from the input member, the held member (or none) and the locked pair (or none):
     ratio, direct, neutral or blocked.
   - describe(): the status sentence and the panel lines of a state, every figure computed here.
   - diagnose() and reading(): Find the fault on the example two-range unit of the data file. Capacities,
     load torques and slip speeds are model values that are never printed.
   - step(): advances the drawing angles for the animation, at a model display rate. */
(function (root) {
  "use strict";

  var M = ["S", "R", "C"];
  var LOCKS = ["SR", "SC", "RC"];
  var RANGES = ["N", "L", "D"];
  var LOADS = ["light", "heavy"];
  var TESTS = ["speed", "band", "clutch", "line"];
  var DEVICES = ["band", "clutch", "supply"];
  var KINDS = { band: ["worn", "leak", "none"], clutch: ["worn", "leak", "none"], supply: ["low"] };
  var RANGE_NAME = { N: "Neutral", L: "Low", D: "Direct" };
  var DT_MAX = 50;
  var sets = {};

  function isArr(a) { return Object.prototype.toString.call(a) === "[object Array]"; }
  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function copy(o) { var r = {}, k; for (k in o) if (has(o, k)) r[k] = o[k]; return r; }
  function pos(x) { x = +x; return x === x && isFinite(x) && x > 0; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  /* a magnitude to two decimals; the sign is said in words */
  function fmt(x) { return Math.abs(x).toFixed(2); }
  function other(a, b) { for (var i = 0; i < M.length; i++) if (M[i] !== a && M[i] !== b) return M[i]; return null; }

  /* ---------- gearset data ---------- */
  function validate(def) {
    var e = [], t = def && def.teeth, fs = {}, md = def && def.model;
    if (!def || !/^[a-z][a-z0-9-]*$/.test(def.id || "")) e.push("id");
    if (!t || !(t.S > 0 && t.R > t.S && t.P > 0) || t.R !== t.S + 2 * t.P) e.push("teeth: R = S + 2P");
    if (!(def && def.planets >= 2) || (t && (t.S + t.R) % def.planets)) e.push("planets: (S + R) / N whole");
    if (!def || !def.defaults || M.indexOf(def.defaults.input) < 0) e.push("defaults");
    if (!md || !md.load || !pos(md.load.light) || !pos(md.load.heavy) || !(md.load.light < md.load.heavy)) e.push("model.load");
    if (!md || !md.capacity || !pos(md.capacity.band) || !pos(md.capacity.clutch)) e.push("model.capacity");
    if (!md || !(md.worn > 0 && md.worn < 1) || !md.pressure || md.pressure.normal !== 1 || !(md.pressure.low > 0 && md.pressure.low < 1) || md.pressure.none !== 0) e.push("model.worn/pressure");
    if (!md || !(md.slipRing < 0) || !(md.slipLag > 0 && md.slipLag < 1) || !pos(md.rate)) e.push("model.slip/rate");
    var u = def && def.unit;
    if (!u || u.input !== "S" || u.output !== "C" || !u.ranges || !u.ranges.L || u.ranges.L.hold !== "R" || !u.ranges.D || LOCKS.indexOf(u.ranges.D.lock) < 0) e.push("unit");
    ((def && def.faults) || []).forEach(function (f) {
      if (!/^f_[a-z_]+$/.test(f.id || "") || fs[f.id]) e.push("fault id: " + f.id);
      fs[f.id] = true;
      if (DEVICES.indexOf(f.device) < 0 || (KINDS[f.device] || []).indexOf(f.kind) < 0) e.push(f.id + ": device or kind");
    });
    ((def && def.scenarios) || []).forEach(function (s) {
      if (!fs[s.correct]) e.push("scenario " + s.id + ": correct");
      (s.causes || []).forEach(function (c) { if (!fs[c]) e.push("scenario " + s.id + ": cause " + c); });
      if (!def.text || !def.text.symptoms || !has(def.text.symptoms, s.symptom)) e.push("scenario " + s.id + ": symptom");
    });
    return e;
  }
  function register(def) {
    var errs = validate(def);
    if (errs.length) throw new Error("gearset " + (def && def.id) + ": " + errs.join("; "));
    sets[def.id] = def;
  }
  function getDef(id) {
    var d = sets[id];
    if (!d) throw new Error("unknown gearset " + id);
    return d;
  }

  /* ---------- kinematics and torque ---------- */
  function kc(t) { return { S: t.S, R: t.R, C: -(t.S + t.R) }; }
  /* the third speed from the Willis relation, given two members and their speeds */
  function willis(t, a, va, b, vb) {
    var k = kc(t), m = other(a, b);
    return -(k[a] * va + k[b] * vb) / k[m];
  }
  /* every speed, with the planet: absolute (P) and on its pin, relative to the carrier (Prel) */
  function full(t, sp) {
    var rel = -(t.S / t.P) * (sp.S - sp.C);
    return { S: sp.S, R: sp.R, C: sp.C, P: sp.C + rel, Prel: rel };
  }
  /* two known members give all speeds */
  function speedsFrom(t, a, va, b, vb) {
    var sp = {}, m = other(a, b);
    sp[a] = va; sp[b] = vb; sp[m] = willis(t, a, va, b, vb);
    return full(t, sp);
  }
  function kindOf(ratio) {
    if (Math.abs(ratio - 1) < 1e-12) return "direct";
    if (ratio > 0) return ratio > 1 ? "reduction" : "overdrive";
    return ratio < -1 ? "reverse reduction" : "reverse overdrive";
  }
  /* a 3 by 3 linear system by Gauss elimination with partial pivots */
  function solve3(A, b) {
    var a = A.map(function (r, i) { return r.concat([b[i]]); }), i, j, c, p, f, x = [0, 0, 0];
    for (c = 0; c < 3; c++) {
      p = c;
      for (i = c + 1; i < 3; i++) if (Math.abs(a[i][c]) > Math.abs(a[p][c])) p = i;
      if (Math.abs(a[p][c]) < 1e-15) return null;
      f = a[c]; a[c] = a[p]; a[p] = f;
      for (i = c + 1; i < 3; i++) {
        f = a[i][c] / a[c][c];
        for (j = c; j < 4; j++) a[i][j] -= f * a[c][j];
      }
    }
    for (i = 2; i >= 0; i--) {
      f = a[i][3];
      for (j = i + 1; j < 3; j++) f -= a[i][j] * x[j];
      x[i] = f / a[i][i];
    }
    return x;
  }
  /* two members locked by a clutch, input torque 1 on inp, the load on out: the torque the clutch
     carries (unknowns: mesh force, clutch torque, load torque) */
  function clutchShare(t, inp, pair, out) {
    var k = kc(t), A = [], b = [];
    M.forEach(function (m) {
      A.push([-k[m], m === pair.charAt(0) ? 1 : m === pair.charAt(1) ? -1 : 0, m === out ? 1 : 0]);
      b.push(m === inp ? -1 : 0);
    });
    var x = solve3(A, b);
    return x ? Math.abs(x[1]) : NaN;
  }

  /* Operate: x = { input, hold: null or a member, lock: null or a pair } */
  function state(id, x) {
    var def = getDef(id), t = def.teeth, inp = x.input, hold = x.hold || null, lock = x.lock || null, out, sp, ratio, k, f;
    if (M.indexOf(inp) < 0 || (hold && M.indexOf(hold) < 0) || (lock && LOCKS.indexOf(lock) < 0)) throw new Error("state");
    if (hold === inp) return { cls: "blocked", why: "input held", input: inp, hold: hold, lock: lock, speeds: null };
    if (hold && lock) return { cls: "blocked", why: "hold plus lock", input: inp, hold: hold, lock: lock, speeds: null };
    if (lock) {
      return { cls: "direct", kind: "direct", input: inp, hold: null, lock: lock, out: null, ratio: 1,
        speeds: full(t, { S: 1, R: 1, C: 1 }), torque: { out: 1, held: 0 } };
    }
    if (!hold) {
      var stopped = {};
      M.forEach(function (m) {
        if (m === inp) return;
        var fr = other(inp, m);
        stopped[m] = { free: fr, speed: willis(t, inp, 1, m, 0) };
      });
      return { cls: "neutral", input: inp, hold: null, lock: null, speeds: null, stopped: stopped };
    }
    out = other(inp, hold);
    sp = speedsFrom(t, inp, 1, hold, 0);
    ratio = 1 / sp[out];
    k = kc(t); f = 1 / k[inp];
    return { cls: "ratio", kind: kindOf(ratio), input: inp, hold: hold, lock: null, out: out, ratio: ratio, speeds: sp,
      torque: { out: -k[out] * f, held: k[hold] * f } };
  }

  /* the formula line of a ratio state, with this gearset tooth counts; v: the value it gives */
  function formula(t, st) {
    var n = { S: "sun", R: "ring" }, z = { S: t.S, R: t.R }, D = " \u00F7 ", h = st.hold, i = st.input, a, b, v, s;
    if (h === "C") {
      a = i; b = other(i, "C");
      v = z[b] / z[a];
      return { v: v, text: "Carrier held" + (i === "S" ? "" : ", " + n[i] + " input") + ": " + n[b] + " teeth" + D + n[a] + " teeth = " +
        z[b] + D + z[a] + " = " + fmt(v) + ", opposite direction" };
    }
    a = h; b = other(h, "C");
    v = 1 + z[a] / z[b];
    s = "1 + " + z[a] + D + z[b];
    if (i === "C") {
      return { v: 1 / v, text: cap(n[h]) + " held, carrier input: 1" + D + "(" + s + ") = 1" + D + fmt(v) + " = " + fmt(1 / v) };
    }
    return { v: v, text: cap(n[h]) + " held: 1 + " + n[a] + " teeth" + D + n[b] + " teeth = " + s + " = " + fmt(v) };
  }

  var KIND_WORD = { reduction: "Reduction", overdrive: "Overdrive", "reverse reduction": "Reverse reduction",
    "reverse overdrive": "Reverse overdrive", direct: "Direct" };
  /* the status sentence and the panel lines of a state */
  function describe(id, st) {
    var def = getDef(id), t = def.teeth, N = def.text.short, d = { status: "", out: "", ratio: "", formula: "", torque: "", planets: "", extra: [] }, v, fo;
    if (st.cls === "blocked") {
      d.status = st.why === "input held" ? "The input member is held: the set cannot turn." :
        "A member is held and two are locked together: the set cannot turn.";
      d.planets = "Nothing turns.";
      return d;
    }
    if (st.cls === "direct") {
      d.status = cap(N[st.lock.charAt(0)]) + " and " + N[st.lock.charAt(1)] + " locked together: all three members turn as one, 1.00:1.";
      d.out = "Every member turns with the input, same direction.";
      d.ratio = "Ratio 1.00:1, direct.";
      d.torque = "Ignoring friction losses, output torque equals input torque. The locking clutch carries torque between the locked members.";
      d.planets = "The planets do not turn on their pins.";
      return d;
    }
    if (st.cls === "neutral") {
      d.status = "Nothing held: neither of the other members is driven.";
      d.out = "No output: nothing is held.";
      d.torque = "No torque passes.";
      d.planets = "The planets are free to turn.";
      M.forEach(function (m) {
        var s = st.stopped[m];
        if (!s) return;
        d.extra.push("If the " + N[m] + " is stopped by a load, the " + N[s.free] + " turns " + fmt(s.speed) +
          " times per input turn, " + (s.speed > 0 ? "same" : "opposite") + " direction.");
      });
      return d;
    }
    v = st.speeds[st.out];
    fo = formula(t, st);
    d.status = cap(N[st.hold]) + " held, " + N[st.input] + " input: the " + N[st.out] + " turns " + fmt(v) +
      " times per input turn, " + (v > 0 ? "same" : "opposite") + " direction. " + KIND_WORD[st.kind] + ", " + fmt(st.ratio) + ":1.";
    d.out = "Output: " + def.text.members[st.out] + ".";
    d.ratio = "Ratio " + fmt(st.ratio) + ":1, " + st.kind + ".";
    d.formula = fo.text + ".";
    d.torque = "Output torque " + fmt(st.torque.out) + " \u00D7 input torque" + (st.torque.out < 0 ? ", in the reverse direction" : "") +
      ". The holding device on the " + N[st.hold] + " takes " + fmt(st.torque.held) + " \u00D7 input torque.";
    d.planets = "The planets turn on their pins.";
    return d;
  }

  /* ---------- Find the fault: the example two-range unit ---------- */
  function faultOf(def, id) {
    if (!id) return null;
    for (var i = 0; i < def.faults.length; i++) if (def.faults[i].id === id) return def.faults[i];
    throw new Error("unknown fault " + id);
  }
  /* x = { range: N, L or D, load: light or heavy, fault: null or a fault id } */
  function diagnose(id, x) {
    var def = getDef(id), t = def.teeth, u = def.unit, md = def.model, f = faultOf(def, x.fault), r = u.ranges[x.range], T = md.load[x.load];
    if (!r || RANGES.indexOf(x.range) < 0 || LOADS.indexOf(x.load) < 0) throw new Error("diagnose");
    var sup = f && f.device === "supply" ? md.pressure.low : md.pressure.normal;
    function pf(dev) {
      if (f && f.device === dev) { if (f.kind === "leak") return md.pressure.low; if (f.kind === "none") return md.pressure.none; }
      return sup;
    }
    function capOf(dev) { return md.capacity[dev] * (f && f.device === dev && f.kind === "worn" ? md.worn : 1) * pf(dev); }
    function word(p) { return p === md.pressure.normal ? "normal" : p === md.pressure.none ? "none" : "low"; }
    var on = { band: !!r.hold, clutch: !!r.lock }, res = {
      range: x.range, load: x.load, outcome: "neutral", need: 0, capacity: 0, speeds: null,
      ports: { band: on.band ? word(pf("band")) : "released", clutch: on.clutch ? word(pf("clutch")) : "released" },
      line: sup === md.pressure.normal ? "normal" : "low", applied: on
    };
    var dev = r.device;
    if (dev === "band") res.need = Math.abs(state(id, { input: u.input, hold: r.hold }).torque.held) * T;
    if (dev === "clutch") res.need = clutchShare(t, u.input, r.lock, u.output) * T;
    if (dev) {
      res.capacity = capOf(dev);
      res.outcome = res.capacity === 0 ? "none" : res.need > res.capacity ? "slip" : "hold";
    }
    if (res.outcome === "hold" && dev === "band") res.speeds = speedsFrom(t, u.input, 1, r.hold, 0);
    else if (res.outcome === "hold") res.speeds = full(t, { S: 1, R: 1, C: 1 });
    else if (res.outcome === "slip" && dev === "band") res.speeds = speedsFrom(t, u.input, 1, "R", md.slipRing);
    else if (res.outcome === "slip") res.speeds = speedsFrom(t, u.input, 1, "R", md.slipLag);
    else res.speeds = speedsFrom(t, u.input, 1, u.output, 0);
    return res;
  }

  /* one test on the unit, as the visitor reads it */
  function reading(id, x, test) {
    var def = getDef(id), t = def.teeth, u = def.unit, d = diagnose(id, x), rn = RANGE_NAME[x.range], low, stop, s;
    if (TESTS.indexOf(test) < 0) throw new Error("test");
    if (test === "speed") {
      low = state(id, { input: u.input, hold: "R" });
      stop = willis(t, u.input, 1, u.output, 0);
      s = "the ring turns " + fmt(stop) + " times per input turn, opposite direction.";
      if (d.outcome === "neutral") return { test: test, word: "neutral", text: "Not driven: nothing is applied in Neutral. With the output shaft stopped, " + s };
      if (d.outcome === "none") {
        return { test: test, word: "none", text: "Not driven: the output shaft does not turn. With it stopped by the load, " + s +
          (x.range === "D" ? " The band is released in Direct, so nothing holds the ring." : "") };
      }
      if (d.outcome === "hold" && x.range === "L") {
        return { test: test, word: "drives", text: "Drives: the output shaft turns " + fmt(low.speeds.C) + " times per input turn, the " +
          fmt(low.ratio) + ":1 ratio. The ring stays still." };
      }
      if (d.outcome === "hold") return { test: test, word: "drives", text: "Drives: the output shaft turns with the input shaft, 1.00:1. The sun and ring turn together." };
      if (x.range === "L") {
        return { test: test, word: "slips", text: "Slips: the output shaft turns less than " + fmt(low.speeds.C) +
          " times per input turn, the ring creeps the opposite way, and the input speed rises." };
      }
      return { test: test, word: "slips", text: "Slips: the output shaft turns slower than the input shaft, the sun and ring turn at different speeds, and the input speed rises." };
    }
    if (test === "line") return { test: test, word: d.line, text: "Line pressure: " + (d.line === "low" ? "below normal" : d.line) + "." };
    var name = test === "band" ? "Band" : "Locking clutch", w = d.ports[test];
    if (w === "released") return { test: test, word: "none", text: name + " apply pressure: none. The " + name.toLowerCase() + " is released in " + rn + "." };
    return { test: test, word: w, text: name + " apply pressure: " + (w === "low" ? "below normal" : w) + "." };
  }

  /* ---------- animation ---------- */
  function wrap(a) { a = a % 360; return a < 0 ? a + 360 : a; }
  /* a: { S, R, C, Prel } in degrees; sp: speeds per input turn; dt in ms (capped); rate: input degrees per ms */
  function step(a, sp, dt, rate) {
    var o = { S: a.S || 0, R: a.R || 0, C: a.C || 0, Prel: a.Prel || 0 }, d = Math.min(Math.max(+dt || 0, 0), DT_MAX) * rate;
    if (!sp) return o;
    o.S = wrap(o.S + sp.S * d); o.R = wrap(o.R + sp.R * d); o.C = wrap(o.C + sp.C * d); o.Prel = wrap(o.Prel + sp.Prel * d);
    return o;
  }

  var PgsEngine = {
    version: 1, register: register, validate: validate,
    get: function (id) { return sets[id] || null; },
    list: function () { return Object.keys(sets); },
    state: state, describe: describe, formula: formula, clutchShare: clutchShare, diagnose: diagnose, reading: reading,
    step: step, willis: willis, format: fmt, members: M.slice(), locks: LOCKS.slice(), ranges: RANGES.slice(),
    loads: LOADS.slice(), tests: TESTS.slice(), rangeName: copy(RANGE_NAME), dtMax: DT_MAX
  };
  root.PgsEngine = PgsEngine;

  var q = root.PgsSetQueue;
  if (isArr(q)) {
    q.forEach(function (def) {
      try { register(def); } catch (err) { (root.PgsSetErrors = root.PgsSetErrors || []).push(String(err && err.message)); }
    });
    q.length = 0;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
