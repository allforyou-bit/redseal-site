/* Hydraulic circuit simulator engine, v1.
   Pure state logic: no DOM access. Circuits are data files that call SimCircuits.register().
   step() advances the only time-dependent quantities: the swashplate angle and the swashplate
   of the same circuit with no fault (healthySwash), both rate-limited.
   derive() is a pure function of (state, inputs): same inputs, same output.
   diagnoseView() is the Diagnose-mode contract: only the chosen test ports that are on the
   scenario menu show the faulted readings; the renderer draws the picture pressure-neutral.
   Each scenario step id is also the boolean input it sets (swapCartridges, defeatFlushing).
   All pressures and flows are relative values from 0 to 1, never real figures.
   Simplified model: no momentum, so the motors follow the swashplate. */
(function (root) {
  "use strict";

  var STATES = ["high", "low", "charge", "pilot", "drain", "suction", "idle"];
  var ROLES = ["suction", "chargeOut", "chargeGallery", "chargeDump", "servoFwd", "servoRev",
    "loopA", "loopB", "crossport", "brakePort", "caseDrain", "motorCaseDrain", "coolerReturn", "flushOut"];
  var MEASURES = ["pressureA", "pressureB", "charge", "servo", "chargeFlow", "motorCaseFlow"];
  var STATUS_KEYS = ["off", "brakeHeld", "neutral", "reversing", "slowing", "forward", "reverse",
    "noPressure", "stall", "stallLimiter", "stallLow"];
  var DIAGNOSE_KEYS = ["off", "neutral", "forward", "reverse", "forwardHeld", "reverseHeld"];
  var WARNING_KEYS = ["heat", "brakeDrive"];
  var TOGGLES = ["pressureLimiter", "loopFlushing"];
  var STEP_INPUTS = ["swapCartridges", "defeatFlushing"];
  /* what diagnoseView() replaces or drops, for the renderer and the page gate */
  var DIAGNOSE_HIDES = ["status", "statusKey", "warnings.heat", "lines (the renderer draws them pressure-neutral)",
    "comps (the renderer draws no valve, heat or brake state)", "comps.pump.swash and comps.servo.pos (healthy display swash, rate-limited)",
    "motor turning, speed and torqueCapacity", "readings for ports not chosen",
    "readings for ports off the scenario menu (see menuOf)"];
  var ID_RE = /^[A-Za-z][A-Za-z0-9_]*$/;
  var circuits = {};

  function num(x, d) { x = +x; return x === x && isFinite(x) ? x : d; }
  function clamp(x, a, b) { x = num(x, a); return x < a ? a : x > b ? b : x; }
  function r6(x) { return Math.round(x * 1e6) / 1e6; }
  function approach(cur, target, maxStep) {
    var d = target - cur;
    return Math.abs(d) <= maxStep ? target : cur + (d > 0 ? maxStep : -maxStep);
  }
  function isArr(a) { return Object.prototype.toString.call(a) === "[object Array]"; }
  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }

  /* ---------- circuit registry ---------- */
  function validate(def) {
    var e = [], comps = {}, lines = {}, faults = {}, ports = {}, seen = {};
    if (!def || typeof def !== "object") return ["definition is not an object"];
    if (typeof def.id !== "string" || !def.id) e.push("missing id");
    if (!def.params || typeof def.params !== "object") e.push("missing params");
    ["comps", "lines", "ports", "faults", "scenarios"].forEach(function (k) {
      if (!isArr(def[k])) e.push("missing " + k);
    });
    if (!def.setups || typeof def.setups !== "object") e.push("missing setups");
    if (e.length) return e;
    var text = def.text || {};
    function uniq(kind, id) {
      if (typeof id !== "string" || !ID_RE.test(id)) e.push(kind + " id invalid: " + id);
      else if (seen[id]) e.push("duplicate id: " + id);
      seen[id] = 1;
    }
    def.comps.forEach(function (c) {
      uniq("comp", c.id); comps[c.id] = c;
      if (!isArr(c.ports)) e.push("comp " + c.id + " has no ports list");
      if (c.toggle && TOGGLES.indexOf(c.toggle) < 0) e.push("comp " + c.id + " unknown toggle " + c.toggle);
    });
    def.lines.forEach(function (l) {
      uniq("line", l.id); lines[l.id] = l;
      if (ROLES.indexOf(l.role) < 0) e.push("line " + l.id + " unknown role " + l.role);
      if (l.toggle && TOGGLES.indexOf(l.toggle) < 0) e.push("line " + l.id + " unknown toggle " + l.toggle);
      if (!isArr(l.ends) || l.ends.length < 2) { e.push("line " + l.id + " needs 2+ ends"); return; }
      l.ends.forEach(function (end) {
        var p = String(end).split("."), c = comps[p[0]];
        if (p.length !== 2 || !c) e.push("line " + l.id + " unknown comp in " + end);
        else if (!isArr(c.ports) || c.ports.indexOf(p[1]) < 0) e.push("line " + l.id + " unknown port " + end);
      });
    });
    function onRole(end, role) {
      return def.lines.some(function (l) { return l.role === role && isArr(l.ends) && l.ends.indexOf(end) >= 0; });
    }
    def.comps.forEach(function (c) {
      if (c.type === "motor2spd") {
        if (!onRole(c.id + ".A", "loopA")) e.push("motor " + c.id + " A port not on a loopA line");
        if (!onRole(c.id + ".B", "loopB")) e.push("motor " + c.id + " B port not on a loopB line");
        if (!onRole(c.id + ".case", "motorCaseDrain")) e.push("motor " + c.id + " case port not on a motorCaseDrain line");
      }
      if (c.type === "multiFunction" && c.side !== "A" && c.side !== "B") e.push("comp " + c.id + " side must be A or B");
      if (c.type === "solenoid" && c.dir !== "fwd" && c.dir !== "rev") e.push("comp " + c.id + " dir must be fwd or rev");
    });
    if (def.motors != null) {
      var mc = def.comps.filter(function (c) { return c.type === "motor2spd"; }).map(function (c) { return c.id; });
      if (!isArr(def.motors) || def.motors.length !== mc.length ||
          !def.motors.every(function (m) { return mc.indexOf(m) >= 0; })) e.push("motors list does not match motor comps: " + mc.join(","));
    }
    def.ports.forEach(function (p) {
      uniq("port", p.id); ports[p.id] = p;
      if (MEASURES.indexOf(p.measure) < 0) e.push("port " + p.id + " unknown measure " + p.measure);
      if (!isArr(p.lines) || !p.lines.length) e.push("port " + p.id + " has no lines");
      else p.lines.forEach(function (l) { if (!lines[l]) e.push("port " + p.id + " unknown line " + l); });
    });
    def.faults.forEach(function (f) {
      uniq("fault", f.id); faults[f.id] = f;
      if (!f.effect || typeof f.effect !== "object") e.push("fault " + f.id + " has no effect");
    });
    Object.keys(def.setups).forEach(function (k) {
      if (!def.setups[k] || typeof def.setups[k] !== "object") e.push("setup " + k + " is not an object");
    });
    STATUS_KEYS.forEach(function (k) { if (!text.status || typeof text.status[k] !== "string") e.push("missing status text " + k); });
    DIAGNOSE_KEYS.forEach(function (k) { if (!text.diagnose || typeof text.diagnose[k] !== "string") e.push("missing diagnose text " + k); });
    WARNING_KEYS.forEach(function (k) { if (!text.warnings || typeof text.warnings[k] !== "string") e.push("missing warning text " + k); });
    function checkList(s, list, what) {
      if (!isArr(list)) { e.push("scenario " + s.id + " " + what + " must be a list"); return; }
      list.forEach(function (ch) {
        if (!ch || !has(def.setups, ch.setup)) e.push("scenario " + s.id + " " + what + " unknown setup " + (ch && ch.setup));
        if (!ch || (s.ports || []).indexOf(ch.port) < 0) e.push("scenario " + s.id + " " + what + " port not offered: " + (ch && ch.port));
        if (ch && ch.level != null && ["low", "normal", "high"].indexOf(ch.level) < 0) e.push("scenario " + s.id + " bad level " + ch.level);
        if (ch && ch.swap && (s.steps || []).indexOf("swapCartridges") < 0) e.push("scenario " + s.id + " swap check without the swap step");
      });
    }
    def.scenarios.forEach(function (s) {
      uniq("scenario", s.id);
      if (!faults[s.correct]) e.push("scenario " + s.id + " unknown correct fault " + s.correct);
      if (!isArr(s.causes) || s.causes.indexOf(s.correct) < 0) e.push("scenario " + s.id + " causes must include the correct fault");
      (s.causes || []).forEach(function (c) { if (!faults[c]) e.push("scenario " + s.id + " unknown cause " + c); });
      (s.ports || []).forEach(function (p) { if (!ports[p]) e.push("scenario " + s.id + " unknown port " + p); });
      (s.steps || []).forEach(function (k) {
        if (!text.steps || typeof text.steps[k] !== "string") e.push("scenario " + s.id + " unknown step " + k);
        if (STEP_INPUTS.indexOf(k) < 0) e.push("scenario " + s.id + " step has no engine input: " + k);
      });
      checkList(s, s.checks, "check");
      checkList(s, s.mustView, "mustView");
      if (!text.symptoms || typeof text.symptoms[s.symptom] !== "string") e.push("scenario " + s.id + " unknown symptom key " + s.symptom);
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
    var d = circuits[id];
    if (!d) throw new Error("unknown circuit: " + id);
    return d;
  }

  /* ---------- inputs ---------- */
  function norm(def, inp) {
    inp = inp || {};
    var P = def.params, tg = inp.toggles || {}, fault = null;
    def.faults.forEach(function (f) { if (f.id === inp.fault) fault = f; });
    return {
      engine: !!inp.engine,
      joy: clamp(inp.joystick, -1, 1),
      high: inp.range === "high",
      brakeRelease: !!inp.brakeRelease,
      stall: !!inp.stall,
      fault: fault,
      swap: !!inp.swapCartridges,
      limiter: tg.pressureLimiter != null ? !!tg.pressureLimiter : !!P.pressureLimiter,
      /* defeatFlushing: the flushing defeat used before reading motor case flow (S1 p.27, S4 p.31) */
      flushing: (tg.loopFlushing != null ? !!tg.loopFlushing : !!P.loopFlushing) && !inp.defeatFlushing
    };
  }
  function healthyOf(n) {
    var h = {}, k;
    for (k in n) if (has(n, k)) h[k] = n[k];
    h.fault = null; h.swap = false;
    return h;
  }
  /* drive command reaching the solenoids; with the brake release off the simulator returns the pump to neutral */
  function driveCmd(n) { return n.engine && n.brakeRelease ? n.joy : 0; }
  function effectOf(n) { return n.fault ? n.fault.effect : {}; }

  /* ---------- operating condition at a given swashplate angle ---------- */
  function cond(def, n, e, s) {
    var P = def.params, c = {};
    c.on = n.engine;
    c.sgn = s > 0 ? 1 : s < 0 ? -1 : 0;
    c.stroked = c.on && Math.abs(s) > P.deadband;
    c.hi = c.stroked ? (c.sgn > 0 ? "A" : "B") : null;
    c.lo = c.hi ? (c.hi === "A" ? "B" : "A") : null;
    c.leakSide = e.leakSide ? (n.swap ? (e.leakSide === "A" ? "B" : "A") : e.leakSide) : null;
    c.hit = !!c.hi && c.leakSide === c.hi;
    c.cap = Math.min(num(e.cap, 1), c.hit ? num(e.sideCap, 1) : 1);
    c.volEff = num(e.volEff, 1) * (c.hit ? num(e.sideVolEff, 1) : 1);
    c.bypass = !!e.bypass;
    c.held = c.stroked && n.stall && !c.bypass;
    c.loadDp = P.loadDp * (n.high ? P.rangeRatio : 1);
    var dpFrac = !c.stroked || c.bypass ? 0 : c.held ? c.cap : Math.min(1, c.loadDp / (P.reliefLevel - P.chargeLevel));
    c.leak = c.stroked ? num(e.leak, P.leakHealthy) * (0.5 + 0.5 * dpFrac) : 0;
    c.flushing = n.flushing && c.stroked && !c.bypass;
    c.cpFlow = c.on ? num(e.chargePumpFlow, 1) : 0;
    /* relative heuristic, not a flow balance: charge pressure falls as spare charge flow shrinks */
    c.excess = c.cpFlow - (c.on ? P.controlUse : 0) - c.leak - (c.flushing ? P.flushUse : 0);
    c.f = c.on ? clamp(c.excess / P.chargeNeed, P.chargeFloor, 1) : 0;
    if (c.on && e.chargeCap != null) c.f = Math.min(c.f, e.chargeCap);
    c.chargeP = P.chargeLevel * c.f * (c.stroked ? (c.flushing ? P.flushChargeDrop : P.strokeChargeDrop) : 1);
    c.chargeReliefOpen = c.on && (e.chargeCap != null || (c.f >= 1 && !c.flushing));
    /* stall pressure without a limiter; the limiter acts only if this reaches its setting */
    c.stallP = c.chargeP + (P.reliefLevel - c.chargeP) * c.cap;
    c.limiting = c.held && n.limiter && c.stallP >= P.limiterLevel;
    return c;
  }

  /* swashplate target for the current inputs */
  function targetOf(def, n, e) {
    var P = def.params, cmd = driveCmd(n);
    if (Math.abs(cmd) <= P.deadband) return 0;
    var c = cond(def, n, e, cmd), sg = cmd > 0 ? 1 : -1;
    var maxStroke = clamp(c.f / P.strokePerCharge, 0, 1); /* servo pressure comes from charge */
    var t = Math.min(Math.abs(cmd), maxStroke);
    if (c.limiting) t = Math.min(t, P.limiterStroke);
    return sg * t;
  }

  /* ---------- public: init / step ---------- */
  function init(id) { getDef(id); return { circuit: id, t: 0, swash: 0, healthySwash: 0 }; }

  /* healthySwash: same inputs, no fault; the Diagnose picture uses it */
  function step(state, inputs, dt) {
    var def = getDef(state && state.circuit), P = def.params, n = norm(def, inputs);
    dt = clamp(dt, 0, 1);
    var s0 = clamp(state.swash, -1, 1), h0 = clamp(num(state.healthySwash, s0), -1, 1);
    var s = approach(s0, targetOf(def, n, effectOf(n)), P.swashRate * dt);
    var hs = approach(h0, targetOf(def, healthyOf(n), {}), P.swashRate * dt);
    return { circuit: state.circuit, t: num(state.t, 0) + dt, swash: clamp(s, -1, 1), healthySwash: clamp(hs, -1, 1) };
  }

  /* ---------- picture of the circuit for one condition ---------- */
  function L(st, dir, p) { return { state: st, dir: dir, p: r6(clamp(p, 0, 1)) }; }

  function build(def, n, e, s) {
    var P = def.params, c = cond(def, n, e, s), on = c.on, lowP = c.chargeP, highP = lowP;
    var reliefOpen = false, moving = false;
    /* brake release solenoid: follows the switch, and the simulator holds it on until the pump is back in neutral */
    var brakeSol = n.brakeRelease || c.stroked;
    var released = on && brakeSol;
    if (c.stroked) {
      if (c.bypass) highP = lowP * P.bypassRise;
      else if (c.held) {
        highP = c.limiting ? P.limiterLevel : c.stallP;
        reliefOpen = !c.limiting && c.cap >= 1;
      } else { highP = lowP + c.loadDp; moving = true; }
    }
    var pA = !on ? 0 : c.hi === "A" ? highP : lowP;
    var pB = !on ? 0 : c.hi === "B" ? highP : lowP;
    var cmd = driveCmd(n);
    var solF = cmd > P.deadband ? cmd : 0, solR = cmd < -P.deadband ? -cmd : 0;
    var servoP = (solF || solR) ? lowP : 0;
    var ratio = n.high ? P.rangeRatio : 1;
    var speed = moving ? clamp(P.baseSpeed * Math.abs(s) * c.volEff * ratio, 0, 1) : 0;
    var leakFlowing = c.hit && !c.bypass; /* the leaking valve passes oil from the high side to the low side */
    var idle = L("idle", 0, 0);

    function loopLine(side) {
      if (!on) return idle;
      if (!c.stroked) return L("charge", 0, lowP);
      var p = side === "A" ? pA : pB;
      if (c.bypass) return L("low", 0, p);
      var dir = moving ? (side === "A" ? c.sgn : -c.sgn) : 0;
      return L(c.hi === side ? "high" : "low", dir, p);
    }
    var byRole = {
      suction: function () { return on ? L("suction", 1, 0) : idle; },
      chargeOut: function () { return on ? L("charge", 1, lowP) : idle; },
      chargeGallery: function () { return on ? L("charge", 1, lowP) : idle; },
      chargeDump: function () { return c.chargeReliefOpen ? L("drain", 1, P.drainLevel) : idle; },
      servoFwd: function () { return solF ? L("pilot", 1, servoP) : idle; },
      servoRev: function () { return solR ? L("pilot", 1, servoP) : idle; },
      loopA: function () { return loopLine("A"); },
      loopB: function () { return loopLine("B"); },
      crossport: function () {
        if (reliefOpen || leakFlowing) return L("high", c.hi === "A" ? 1 : -1, highP);
        if (c.bypass && c.stroked) return L("low", c.sgn, lowP);
        return idle;
      },
      brakePort: function () { return !on ? idle : released ? L("pilot", 0, P.brakeLevel) : L("drain", 0, 0); },
      caseDrain: function () { return on ? L("drain", 1, P.drainLevel) : idle; },
      motorCaseDrain: function () { return on ? L("drain", 1, P.drainLevel) : idle; },
      coolerReturn: function () { return on ? L("drain", 1, P.drainLevel) : idle; },
      flushOut: function () { return c.flushing ? L("drain", 1, P.drainLevel) : idle; }
    };
    var lines = {};
    def.lines.forEach(function (l) { lines[l.id] = byRole[l.role](); });

    var comps = {};
    def.comps.forEach(function (cp) {
      var o;
      switch (cp.type) {
        case "reservoir": o = { active: on }; break;
        case "fixedPump": o = { running: on, flow: c.cpFlow }; break;
        case "filter": o = { flow: c.cpFlow }; break;
        case "reliefValve": o = { open: c.chargeReliefOpen }; break;
        case "overCentrePump": o = { swash: s, dir: c.stroked ? c.sgn : 0, limiting: c.limiting }; break;
        case "propControl": o = { fwd: solF, rev: solR }; break;
        case "solenoid": var lv = cp.dir === "fwd" ? solF : solR; o = { energized: lv > 0, level: lv }; break;
        case "servo": o = { pos: s }; break;
        case "multiFunction": o = {
          checkOpen: on && (!c.stroked || c.lo === cp.side),
          reliefOpen: reliefOpen && c.hi === cp.side,
          bypassOpen: c.bypass,
          leaking: c.leakSide === cp.side
        }; break;
        case "motor2spd": o = {
          turning: moving && speed > 0, dir: moving ? c.sgn : 0, speed: speed,
          disp: n.high ? "min" : "max",
          torqueCapacity: on && !c.bypass ? r6(c.cap / ratio) : 0
        }; break;
        case "solenoidValve": o = { energized: !!brakeSol }; break;
        case "sahrBrake": o = { applied: !released }; break;
        case "cooler": o = { active: on }; break;
        case "flushShuttle": o = { active: c.flushing, shifted: c.flushing ? c.lo : null }; break;
        default: o = {};
      }
      comps[cp.id] = o;
    });

    var raw = {
      pressureA: pA, pressureB: pB, charge: lowP, servo: servoP,
      chargeFlow: c.cpFlow * P.flowScale,
      motorCaseFlow: on ? P.caseBase + c.leak + (c.flushing ? P.flushUse : 0) : 0
    };
    var target = targetOf(def, n, e), key;
    if (!on) key = "off";
    else if (!n.brakeRelease && Math.abs(n.joy) > P.deadband) key = "brakeHeld";
    else if (!c.stroked) key = "neutral";
    else if (c.bypass) key = "noPressure";
    else if (c.held) key = c.limiting ? "stallLimiter" : reliefOpen ? "stall" : "stallLow";
    else if (target * c.sgn < 0 && n.joy * c.sgn < 0) key = "reversing";
    else if (target * c.sgn <= 0 || Math.abs(target) < Math.abs(s) - 1e-9) key = "slowing";
    else key = c.sgn > 0 ? "forward" : "reverse";

    var warn = [];
    if (reliefOpen || (e.heat === "stroke" && c.stroked) || (e.heat === "leakSide" && leakFlowing)) warn.push("heat");
    if (on && !n.brakeRelease && Math.abs(n.joy) > P.deadband) warn.push("brakeDrive");
    return { lines: lines, comps: comps, raw: raw, key: key, warn: warn, hi: c.hi, lo: c.lo };
  }

  function levelOf(v, r, P) {
    if (Math.abs(v - r) <= P.readTol) return "normal";
    if (r <= P.readTol) return v > r ? "high" : "normal";
    var q = v / r;
    return q < P.lowRatio ? "low" : q > P.highRatio ? "high" : "normal";
  }
  function fill(t, b) { return String(t).replace(/\{hi\}/g, b.hi || "").replace(/\{lo\}/g, b.lo || ""); }

  function readingsOf(def, b, ref, only) {
    var out = {};
    def.ports.forEach(function (p) {
      if (only && only.indexOf(p.id) < 0) return;
      var v = clamp(b.raw[p.measure], 0, 1);
      out[p.id] = { level: levelOf(v, clamp(ref.raw[p.measure], 0, 1), def.params), value: r6(v) };
    });
    return out;
  }

  /* ---------- public: derive ---------- */
  function derive(state, inputs) {
    var def = getDef(state && state.circuit), n = norm(def, inputs);
    var s = clamp(state.swash, -1, 1);
    var b = build(def, n, effectOf(n), s);
    var ref = n.fault ? build(def, n, {}, s) : b; /* healthy circuit, same condition */
    var T = def.text;
    return {
      lines: b.lines, comps: b.comps, readings: readingsOf(def, b, ref, null),
      status: fill(T.status[b.key], b), statusKey: b.key,
      warnings: b.warn.map(function (k) { return { id: k, text: T.warnings[k] }; })
    };
  }

  /* scenario menu: inputs.scenario if given (unknown id: no ports), else the scenarios whose
     correct cause is inputs.fault (none: no ports), else no limit */
  function menuOf(def, inp, n) {
    var sid = inp && inp.scenario, out = [];
    if (sid != null) {
      def.scenarios.forEach(function (s) { if (s.id === sid) out = s.ports.slice(); });
      return out;
    }
    if (!n.fault) return null;
    def.scenarios.forEach(function (s) {
      if (s.correct === n.fault.id) s.ports.forEach(function (p) { if (out.indexOf(p) < 0) out.push(p); });
    });
    return out;
  }

  /* ---------- public: Diagnose-mode view ----------
     state, inputs: the faulted simulation (inputs.scenario: optional scenario id).
     ports: the test ports chosen; ports off the scenario menu return no reading.
     displayState: optional healthy shadow state (fault null); else state.healthySwash. */
  function diagnoseView(state, inputs, ports, displayState) {
    var def = getDef(state && state.circuit), P = def.params, n = norm(def, inputs), k;
    var hn = healthyOf(n), hs;
    if (displayState && displayState.circuit === state.circuit) hs = clamp(displayState.swash, -1, 1);
    else if (typeof state.healthySwash === "number" && isFinite(state.healthySwash)) hs = clamp(state.healthySwash, -1, 1);
    else throw new Error("diagnoseView: state has no healthySwash; make states with init() and step()");
    var h = build(def, hn, {}, hs);
    var s = clamp(state.swash, -1, 1);
    var fb = build(def, n, effectOf(n), s), fr = n.fault ? build(def, n, {}, s) : fb;
    var comps = {};
    def.comps.forEach(function (cp) {
      var o = h.comps[cp.id], q = {};
      for (k in o) if (has(o, k)) q[k] = o[k];
      if (cp.type === "motor2spd") { delete q.turning; delete q.speed; delete q.torqueCapacity; }
      comps[cp.id] = q;
    });
    var dk;
    if (!n.engine) dk = "off";
    else if (Math.abs(n.joy) <= P.deadband) dk = "neutral";
    else dk = (n.joy > 0 ? "forward" : "reverse") + (n.stall ? "Held" : "");
    var held = n.engine && !n.brakeRelease && Math.abs(n.joy) > P.deadband;
    var T = def.text, menu = menuOf(def, inputs, n);
    var list = (isArr(ports) ? ports : []).filter(function (p) { return !menu || menu.indexOf(p) >= 0; });
    return {
      lines: h.lines, comps: comps, readings: readingsOf(def, fb, fr, list),
      status: held ? T.status.brakeHeld : T.diagnose[dk],
      statusKey: held ? "diagnose.brakeHeld" : "diagnose." + dk,
      warnings: held ? [{ id: "brakeDrive", text: T.warnings.brakeDrive }] : []
    };
  }

  function defaults() {
    return { engine: true, joystick: 0, range: "low", brakeRelease: true, stall: false,
      fault: null, swapCartridges: false, defeatFlushing: false, toggles: {} };
  }

  var SimCircuits = {
    register: register, validate: validate,
    get: function (id) { return circuits[id] || null; },
    list: function () { return Object.keys(circuits); }
  };
  var SimEngine = {
    version: 1, init: init, step: step, derive: derive, diagnoseView: diagnoseView, defaults: defaults,
    lineStates: STATES.slice(), roles: ROLES.slice(), measures: MEASURES.slice(),
    statusKeys: STATUS_KEYS.slice(), diagnoseKeys: DIAGNOSE_KEYS.slice(),
    warningKeys: WARNING_KEYS.slice(), diagnoseHides: DIAGNOSE_HIDES.slice(), stepInputs: STEP_INPUTS.slice()
  };
  root.SimCircuits = SimCircuits;
  root.SimEngine = SimEngine;

  /* circuits that loaded before the engine */
  var q = root.SimCircuitQueue;
  if (isArr(q)) {
    q.forEach(function (def) {
      try { register(def); } catch (err) {
        (root.SimCircuitErrors = root.SimCircuitErrors || []).push(String(err && err.message));
      }
    });
    q.length = 0;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
