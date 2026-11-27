/* Refrigeration cycle simulator engine, v1 (refrigeration-design-v1-20261107.md section 2, as changed by
   design v2 and v2.1). Pure functions over one table: no DOM access, no physics, no sentence text.
   - The table comes from the model script (--table) through load(), or from RfcTableQueue. Every reading,
     band, zone share, flag and fault outcome is in it; a table that disagrees with itself does not load.
   - Every text is a sid of the content file, with slots; units are the only literal strings.
   - Operate: FX (fixed orifice) or TX (thermostatic expansion valve), three knobs at -1, 0, +1: 54 states.
   - Find the fault: the table scenes on the TX example, one neutral symptom. A wrong pick gets the tell
     of the cause and the one reading that rules it out; a cause not ruled out gets its tell, no penalty.
     The comparison sentences come after the solve only (they name the scene cause).
   - step(): the animation phases, at a display rate that is never printed. */
(function (root) {
  "use strict";

  var MDS = ["FX", "TX"], KNOBS = ["charge", "evapAir", "condAir"], LV = [-1, 0, 1];
  var TESTS = ["gauges", "suction_line", "liquid_line", "amps", "evap_air", "cond_air"];
  /* the test names of the table (tests.order); its required and shown-only lists use them (v2.1 2.4) */
  var TEST_NAME = { gauges: "Gauges", suction_line: "Suction line", liquid_line: "Liquid line", amps: "Amps",
    evap_air: "Evaporator air", cond_air: "Condenser air" };
  var CAUSES = ["f_under", "f_over", "f_txv", "f_cond", "f_evap", "f_drier", "f_air"];
  var RESULTS = ["solve", "ruled_out", "not_ruled_out"];
  var READ_KEYS = ["Ps", "Pd", "Te_C", "Tc_C", "T1_C", "T3_C", "SH", "SC", "split_e", "rise_c", "amps", "cap",
    "T_ai_C", "T_ae_out_C", "T_amb_C", "T_ac_out_C"];
  var WORD_KEYS = ["Ps", "Pd", "SH", "SC", "amps", "split_e", "cap", "rise_c"];
  var READ_OF = { T2: "T2_C" };
  var DEG = "\u00B0C", K = "K", MINUS = "\u2212", DT_MAX = 50;

  /* ---------- sids ---------- */
  var WORD = { "-": "word.lower", "0": "word.same", "+": "word.higher" };
  /* design v2.1 section 2.3: the D07 word carries its own preposition */
  var CMP = { "-": "word.cmp.lower", "0": "word.cmp.same", "+": "word.cmp.higher" };
  var TERM = { Ps: "term.suction", Pd: "term.head", SH: "term.superheat", SC: "term.subcooling" };
  /* the design sentence ids a table button names (v2 4.3, v2.1 3.2) and their sids; D07 takes slots */
  var DID = { D01: "tell.f_under", D02: "tell.f_over", D03: "tell.f_txv", D04: "tell.f_cond", D05: "tell.f_evap",
    D06: "tell.f_air", D09: "tell.f_drier", D07: "reply.ruled_out", D08: "reply.air_open", D25: "reply.drier_open",
    D26: "reply.drier_ruled_out", D10: "explain.under_subcooling", D11: "explain.under_scene", D12: "explain.under_flash",
    D13: "explain.under_vs_valve", D14: "explain.over_condenser", D16: "explain.over_vs_cond", D17: "explain.valve_starved",
    D18: "explain.valve_head", D19: "explain.valve_subcooling", D24: "explain.valve_vs_evap", D27: "explain.over_split" };
  var SLOTS = { D07: ["reading", "word", "cause"] };
  /* after the solve only: comparison sentences, and the line of a cause left open (last) */
  var AFTER = ["D13", "D16", "D24", "D25", "D08"], OPEN = { f_air: "D08", f_drier: "D25" };
  var FAULT = { symptom: "fault.symptom", more: "fault.need_more", solved: "fault.solved", notIt: "fault.not_it",
    open: "fault.open", revealed: "fault.revealed" };
  var STATUS = { same: "status.setup_same", op: "status.op", words: "status.words", sh0: "status.sh_zero",
    sc0: "status.sc_zero" };
  var LVL = { charge: ["lvl.charge.less", "lvl.charge.setup", "lvl.charge.more"],
    evapAir: ["lvl.evap.cooler", "lvl.evap.setup", "lvl.evap.warmer"],
    condAir: ["lvl.cond.cooler", "lvl.cond.setup", "lvl.cond.warmer"] };
  var SYS = { FX: "sys.FX", TX: "sys.TX" };

  /* readouts: t read from the record, d a difference of two rounded temperatures (shown as a subtraction),
     r relative (needle or bar) */
  var RD = {
    Ps: { name: "rd.suction_gauge", t: "Te_C", u: DEG, w: "Ps", r: "Ps" },
    Pd: { name: "rd.head_gauge", t: "Tc_C", u: DEG, w: "Pd", r: "Pd" },
    T1: { name: "rd.suction_line", t: "T1_C", u: DEG },
    SH: { name: "rd.superheat", d: ["T1_C", "Te_C"], u: K, w: "SH" },
    T3: { name: "rd.liquid_line", t: "T3_C", u: DEG },
    SC: { name: "rd.subcooling", d: ["Tc_C", "T3_C"], u: K, w: "SC" },
    ai: { name: "rd.evap_air_in", t: "T_ai_C", u: DEG, input: true },
    aeo: { name: "rd.evap_air_out", t: "T_ae_out_C", u: DEG },
    split_e: { name: "rd.evap_drop", t: "split_e", u: K, w: "split_e" },
    amb: { name: "rd.cond_air_in", t: "T_amb_C", u: DEG, input: true },
    aco: { name: "rd.cond_air_out", t: "T_ac_out_C", u: DEG },
    rise_c: { name: "rd.cond_rise", t: "rise_c", u: K, w: "rise_c" },
    split_c: { name: "rd.cond_split", d: ["Tc_C", "T_amb_C"], u: K },
    amps: { name: "rd.amps", r: "amps", w: "amps" },
    cap: { name: "rd.cooling", r: "cap", w: "cap" }
  };
  var OPERATE_RD = ["Ps", "Pd", "T1", "SH", "T3", "SC", "split_e", "rise_c", "split_c", "amps", "cap", "ai", "amb"];
  /* the readouts of each test, and the drawing tags a test uncovers in Find the fault */
  var TEST_RD = { gauges: ["Ps", "Pd"], suction_line: ["T1", "SH"], liquid_line: ["T3", "SC"], amps: ["amps"],
    evap_air: ["ai", "aeo", "split_e"], cond_air: ["amb", "aco", "rise_c"] };
  /* the table key of each test readout, checked against tests.readings */
  var TKEY = { Ps: "Ps", Pd: "Pd", T1: "T1_C", SH: "SH", T3: "T3_C", SC: "SC", amps: "amps", ai: "T_ai_C", aeo: "T_ae_out_C",
    split_e: "split_e", amb: "T_amb_C", aco: "T_ac_out_C", rise_c: "rise_c" };
  var TEST_TAGS = { gauges: ["Te", "Tc", "nPs", "nPd"], suction_line: ["T1"], liquid_line: ["T3"], amps: [],
    evap_air: ["ai", "aeo"], cond_air: ["amb", "aco"] };

  var T = null;   /* the loaded table, normalised */

  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function isArr(a) { return Object.prototype.toString.call(a) === "[object Array]"; }
  function num(x) { return typeof x === "number" && x === x && isFinite(x); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function opKey(md, c, e, a) { return md + "|" + c + "|" + e + "|" + a; }

  /* ---------- display numbers: one decimal, halves away from zero, no signed zero ---------- */
  function r1(x) { var s = x < 0 ? -1 : 1; return s * Math.round(Math.abs(x) * 10 + 1e-7) / 10; }
  function fmt(x) {
    var v = r1(x), s = Math.abs(v).toFixed(1);
    return (v < 0 && s !== "0.0" ? MINUS : "") + s;
  }
  /* a difference of two rounded temperatures (critic section 5: the shown subtraction adds up) */
  function diff(a, b) { return r1(r1(a) - r1(b)); }

  /* ---------- words: the model script direction() with the bands of the table ---------- */
  function word(k, base, val, bands) {
    var B = bands || T.bands, d = val - base;
    if (has(B.rel, k)) { if (Math.abs(d) <= B.rel[k] * Math.abs(base)) return "0"; }
    else if (has(B.abs, k)) { if (Math.abs(d) <= B.abs[k]) return "0"; }
    else if (has(B.shown_only, k)) { if (Math.abs(d) <= B.shown_only[k]) return "0"; }
    else throw new Error("no band for " + k);
    return d > 0 ? "+" : "-";
  }
  function rv(rec, k) { return rec.readings[has(READ_OF, k) ? READ_OF[k] : k]; }

  /* ---------- the table ---------- */
  function testId(name) { for (var k in TEST_NAME) if (has(TEST_NAME, k) && TEST_NAME[k] === name) return k; return null; }
  /* the buttons of one scene: result, deciding reading and scene word, replies by design id, tell id */
  function normClass(s) {
    if (!isArr(s.buttons)) return null;
    var out = {};
    s.buttons.forEach(function (x) {
      out[x.cause] = { result: x.result, reading: x.reading, word: x.scene_word, reply: x.reply,
        replies: isArr(x.replies) ? x.replies.slice() : [], tell: x.tell_printed_in || null };
    });
    return out;
  }

  /* every check the engine relies on; [] when the table can be loaded */
  function validate(t) {
    var e = [], seen = {}, setup = {};
    function no(c, s) { if (c) e.push(s); }
    if (!t || !isArr(t.operate) || !t.bands) return ["not a table"];
    ["rel", "abs", "shown_only"].forEach(function (k) { no(!t.bands[k], "bands." + k); });
    if (e.length) return e;
    t.operate.forEach(function (r, i) {
      var s = r.state || {}, key = opKey(s.md, s.charge, s.evapAir, s.condAir);
      no(MDS.indexOf(s.md) < 0 || r.md !== s.md, "operate " + i + ": md");
      KNOBS.forEach(function (k) { no(LV.indexOf(s[k]) < 0, "operate " + i + ": " + k); });
      no(has(seen, key), "operate state repeated: " + key);
      seen[key] = r;
      if (s.charge === 0 && s.evapAir === 0 && s.condAir === 0) setup[s.md] = r;
    });
    MDS.forEach(function (md) { LV.forEach(function (c) { LV.forEach(function (ea) { LV.forEach(function (ca) {
      no(!has(seen, opKey(md, c, ea, ca)), "operate state missing: " + opKey(md, c, ea, ca));
    }); }); }); });
    no(!setup.FX || !setup.TX, "set-up records");
    if (e.length) return e;
    function rec(r, tag, base) {
      no(!r.readings || !r.words || !r.zones || !r.flags || !num(r.flow_rel), tag + ": fields");
      if (e.length) return;
      READ_KEYS.forEach(function (k) { no(!num(r.readings[k]), tag + ": reading " + k); });
      WORD_KEYS.forEach(function (k) {
        if (!num(r.readings[k]) || !num(base.readings[k])) return;
        var w = word(k, rv(base, k), rv(r, k), t.bands);
        no(r.words[k] !== w, tag + ": word " + k + " is " + r.words[k] + ", the bands give " + w);
      });
      ["cond_desuperheat", "cond_condensing", "cond_subcooling", "evap_two_phase", "evap_superheat"].forEach(function (k) {
        no(!num(r.zones[k]) || r.zones[k] < -1e-9 || r.zones[k] > 1 + 1e-9, tag + ": zone " + k);
      });
      no(typeof r.flags.evap_outlet_wet !== "boolean" || typeof r.flags.cond_outlet_two_phase !== "boolean", tag + ": flags");
    }
    t.operate.forEach(function (r) { var s = r.state; rec(r, "operate " + opKey(s.md, s.charge, s.evapAir, s.condAir), setup[s.md]); });
    var ids = {}, tt = t.tests || {};
    if ((t.scenes || []).length) {
      no(!isArr(tt.order) || tt.order.join() !== TESTS.map(function (k) { return TEST_NAME[k]; }).join(), "tests.order");
      no(!isArr(tt.required) || !isArr(tt.shown_only) || tt.required.concat(tt.shown_only).some(function (n) { return !testId(n); }), "tests.required, tests.shown_only");
      TESTS.forEach(function (k) {
        no(!tt.readings || (tt.readings[TEST_NAME[k]] || []).join() !== TEST_RD[k].map(function (i) { return TKEY[i]; }).join(), "tests.readings " + k);
      });
      no(!isArr(t.causes) || t.causes.map(function (c) { return c.id; }).sort().join() !== CAUSES.slice().sort().join(), "causes");
    }
    (t.scenes || []).forEach(function (s, i) {
      var tag = "scene " + (s.id || i), cl, solves = 0;
      no(!/^f_[a-z_]+$/.test(s.id || "") || has(ids, s.id), tag + ": id");
      ids[s.id] = 1;
      no(s.md !== "TX", tag + ": the scenes are on the TX example");
      no(s.symptom !== t.symptom, tag + ": one symptom for every scene");
      rec(s, tag, setup.TX);
      cl = normClass(s);
      if (!cl) { e.push(tag + ": no buttons"); return; }
      var open = CAUSES.filter(function (c) { return cl[c] && cl[c].result === "not_ruled_out"; }).map(function (c) { return OPEN[c]; });
      CAUSES.forEach(function (c) {
        var p = cl[c], m = tag + " " + c;
        if (!p) { e.push(m + ": no outcome"); return; }
        no(RESULTS.indexOf(p.result) < 0, m + ": result " + p.result);
        no(!p.replies.length || p.replies.some(function (d) { return !has(DID, d); }), m + ": replies");
        if (p.result === "solve") {
          solves++;
          no(c !== s.id || p.replies.join() !== p.replies.filter(function (d) { return /^explain/.test(DID[d]); }).concat(open).join(), m + ": solve");
        } else no(p.replies.some(function (d) { return AFTER.indexOf(d) >= 0; }), m + ": a comparison sentence on a wrong pick");
        if (p.result === "not_ruled_out") no(!has(OPEN, c) || p.replies.join() !== p.tell || DID[p.tell] !== "tell." + c, m + ": the tell only");
        if (p.result === "ruled_out") {
          no(p.replies.join() !== p.reply || (p.reply !== "D07" && p.reply !== "D26"), m + ": D07 or D26 alone");
          no(DID[p.tell] !== "tell." + c, m + ": tell");
          if (p.reply === "D07") {
            no(!has(TERM, p.reading), m + ": deciding reading " + p.reading);
            no(p.word !== s.words[p.reading], m + ": scene word");
          } else no(s.words.SC !== "-" || s.words.Pd !== "-", m + ": D26 needs subcooling and head both lower");
        }
      });
      Object.keys(cl).forEach(function (c) { no(CAUSES.indexOf(c) < 0, tag + ": unknown cause " + c); });
      no(solves !== 1, tag + ": one solve");
    });
    return e;
  }

  function load(t) {
    var e = validate(t);
    if (e.length) throw new Error("table: " + e.join("; "));
    var n = { bands: t.bands, setup: {}, op: {}, scenes: [], byScene: {}, span: {}, max: {}, meta: t.setup || {},
      required: [], shown: [], schema: t.schema || "" };
    if (t.tests) { n.required = t.tests.required.map(testId); n.shown = t.tests.shown_only.map(testId); }
    t.operate.forEach(function (r) {
      var s = r.state;
      n.op[opKey(s.md, s.charge, s.evapAir, s.condAir)] = r;
      if (!s.charge && !s.evapAir && !s.condAir) n.setup[s.md] = r;
    });
    (t.scenes || []).forEach(function (s) {
      var cl = normClass(s);
      n.byScene[s.id] = { rec: s, cl: cl };
      if (cl) n.scenes.push(s.id);
    });
    /* display scales from the table itself: the needle span and the bar ends */
    var all = t.operate.concat(t.scenes || []);
    ["Ps", "Pd"].forEach(function (k) {
      n.span[k] = all.reduce(function (m, r) { return Math.max(m, Math.abs(r.readings[k] / n.setup[r.md].readings[k] - 1)); }, 0) || 1;
    });
    ["amps", "cap"].forEach(function (k) { n.max[k] = all.reduce(function (m, r) { return Math.max(m, r.readings[k]); }, 0); });
    T = n;
    return api;
  }
  function need() { if (!T) throw new Error("no table loaded"); }

  /* ---------- one record as the page shows it ---------- */
  function item(id, rec, base) {
    var d = RD[id], o = { id: id, name: d.name, unit: d.u || "" }, R = rec.readings, B = base.readings;
    if (d.t) { o.text = fmt(R[d.t]); o.setup = fmt(B[d.t]); }
    if (d.d) {
      o.text = fmt(diff(R[d.d[0]], R[d.d[1]])); o.setup = fmt(diff(B[d.d[0]], B[d.d[1]]));
      o.calc = [fmt(R[d.d[0]]), fmt(R[d.d[1]])]; o.setupCalc = [fmt(B[d.d[0]]), fmt(B[d.d[1]])];
    }
    if (d.r === "Ps" || d.r === "Pd") o.needle = needle(d.r, rec, base);
    else if (d.r) { o.bar = R[d.r] / T.max[d.r]; o.barSetup = B[d.r] / T.max[d.r]; }
    if (d.w) { o.word = rec.words[d.w]; o.wordSid = WORD[o.word]; }
    if (d.input) o.input = true;
    return o;
  }
  /* -1 to 1 against the set-up tick, scaled by the widest change in the table */
  function needle(k, rec, base) { var v = (rec.readings[k] / base.readings[k] - 1) / T.span[k]; return Math.max(-1, Math.min(1, v)); }
  function view(rec, base, ids) {
    var R = rec.readings, z = {}, k, out;
    for (k in rec.zones) if (has(rec.zones, k)) z[k] = Math.max(0, rec.zones[k]);
    out = { items: (ids || OPERATE_RD).map(function (id) { return item(id, rec, base); }), zones: z,
      flags: { wet: !!rec.flags.evap_outlet_wet, flash: !!rec.flags.cond_outlet_two_phase },
      motion: { flow: rec.flow_rel, airC: num(rec.cond_air_rel) ? rec.cond_air_rel : 1, airE: num(rec.evap_air_rel) ? rec.evap_air_rel : 1 },
      tags: { Te: fmt(R.Te_C), Tc: fmt(R.Tc_C), T1: fmt(R.T1_C), T3: fmt(R.T3_C), ai: fmt(R.T_ai_C), aeo: fmt(R.T_ae_out_C),
        amb: fmt(R.T_amb_C), aco: fmt(R.T_ac_out_C), nPs: needle("Ps", rec, base), nPd: needle("Pd", rec, base) } };
    return out;
  }

  /* ---------- Operate ---------- */
  function normOp(x) {
    x = x || {};
    var o = { md: MDS.indexOf(x.md) >= 0 ? x.md : "TX" };
    KNOBS.forEach(function (k) { o[k] = LV.indexOf(x[k]) >= 0 ? x[k] : 0; });
    return o;
  }
  function record(op) { need(); op = normOp(op); return T.op[opKey(op.md, op.charge, op.evapAir, op.condAir)]; }
  function atSetup(op) { return !op.charge && !op.evapAir && !op.condAir; }
  /* the status sentences of a state: sids with slots, in reading order. prev: the state before the change */
  function status(op, prev) {
    op = normOp(op);
    var r = record(op), out = [], w = r.words;
    if (prev && atSetup(op) && atSetup(normOp(prev)) && normOp(prev).md !== op.md) out.push({ sid: STATUS.same });
    out.push({ sid: STATUS.op, slots: { system: SYS[op.md], charge: LVL.charge[op.charge + 1],
      evap: LVL.evapAir[op.evapAir + 1], cond: LVL.condAir[op.condAir + 1] } });
    out.push({ sid: STATUS.words, slots: { suction: WORD[w.Ps], head: WORD[w.Pd], superheat: WORD[w.SH], subcooling: WORD[w.SC] } });
    warn(r).forEach(function (x) { out.push(x); });
    return out;
  }
  /* D50 and D51, from the outlet flags of the record (the tests check that a flag goes with a zero reading) */
  function warn(r) {
    var out = [];
    if (r.flags.evap_outlet_wet) out.push({ sid: STATUS.sh0, warn: true });
    if (r.flags.cond_outlet_two_phase) out.push({ sid: STATUS.sc0, warn: true });
    return out;
  }
  function operate(op, prev) {
    op = normOp(op);
    var r = record(op), base = T.setup[op.md], v = view(r, base, OPERATE_RD);
    v.op = op; v.status = status(op, prev); v.inputs = { ai: fmt(r.readings.T_ai_C), amb: fmt(r.readings.T_amb_C) };
    return v;
  }

  /* ---------- Find the fault ---------- */
  function scenes() { need(); return T.scenes.slice(); }
  function scene(id) { need(); var s = T.byScene[id]; if (!s || !s.cl) throw new Error("unknown scene " + id); return s; }
  /* a new case; the renderer keeps it out of the page */
  function start(id) { scene(id); return { scene: id, symptom: FAULT.symptom, taken: [], out: {}, open: {}, done: false, how: null }; }
  function canPick(fs) { return !!fs && T.required.length > 0 && T.required.every(function (k) { return fs.taken.indexOf(k) >= 0; }); }
  /* one test on the scene, with the same test on the example at set-up beside it */
  function test(fs, k) {
    if (TESTS.indexOf(k) < 0) throw new Error("test " + k);
    var s = scene(fs.scene), n = clone(fs), v = view(s.rec, T.setup.TX, TEST_RD[k]);
    if (n.taken.indexOf(k) < 0) n.taken.push(k);
    /* D50 and D51 go with the line test that shows the zero reading */
    var w = warn(s.rec).filter(function (x) { return x.sid === (k === "suction_line" ? STATUS.sh0 : k === "liquid_line" ? STATUS.sc0 : ""); });
    return { fs: n, reading: { test: k, name: "test." + k, shownOnly: T.shown.indexOf(k) >= 0, items: v.items,
      tags: TEST_TAGS[k].slice(), warn: w } };
  }
  /* the drawing in Find the fault: the tags of the tests taken; zones, flags and motion stay at set-up */
  function faultView(fs) {
    var s = scene(fs.scene), v = view(s.rec, T.setup.TX), base = view(T.setup.TX, T.setup.TX), show = {};
    fs.taken.forEach(function (k) { TEST_TAGS[k].forEach(function (t) { show[t] = true; }); });
    Object.keys(v.tags).forEach(function (t) { if (!show[t]) v.tags[t] = null; });
    v.zones = null; v.flags = { wet: false, flash: false }; v.motion = base.motion;
    return v;
  }
  /* a cause pick. kind: need (required readings missing; nothing changes), solve, ruled_out, not_ruled_out,
     done (the case is over). reply: sentences as { sid, slots } */
  function pick(fs, c) {
    if (CAUSES.indexOf(c) < 0) throw new Error("cause " + c);
    var s = scene(fs.scene), n = clone(fs), p = s.cl[c], reply = [];
    if (fs.done) return { fs: n, kind: "done", reply: [] };
    if (!canPick(fs)) return { fs: n, kind: "need", verdict: { sid: FAULT.more }, reply: [] };
    if (p.result === "solve") {
      n.done = true; n.how = "solve";
      return { fs: n, kind: "solve", verdict: { sid: FAULT.solved, slots: { cause: "cause." + c } }, reply: p.replies.map(sent), solved: s.rec.id };
    }
    if (p.result === "not_ruled_out") {
      n.open[c] = true;
      return { fs: n, kind: "not_ruled_out", verdict: { sid: FAULT.open, slots: { cause: "cause." + c } }, reply: p.replies.map(sent) };
    }
    /* ruled out: the tell of the cause, then D07 filled with the deciding reading and the scene word, or D26 */
    n.out[c] = true;
    reply.push({ sid: DID[p.tell] });
    p.replies.forEach(function (d) {
      reply.push(d === "D07" ? { sid: DID.D07, slots: { reading: TERM[p.reading], word: CMP[s.rec.words[p.reading]], cause: "cause." + c + ".inline" } } : sent(d));
    });
    return { fs: n, kind: "ruled_out", verdict: { sid: FAULT.notIt }, reply: reply, reading: p.reading };
  }
  function sent(d) { return { sid: DID[d] }; }
  /* the way out after a refusal or a wrong pick: the cause and its explanation, no solve */
  function reveal(fs) {
    var s = scene(fs.scene), n = clone(fs);
    if (fs.done) return { fs: n, kind: "done", reply: [] };
    n.done = true; n.how = "reveal";
    return { fs: n, kind: "revealed", verdict: { sid: FAULT.revealed, slots: { cause: "cause." + s.rec.id } },
      reply: s.cl[s.rec.id].replies.map(sent) };
  }
  /* the outcome the table gives one (scene, cause) pair, for the tests and the gates */
  function outcome(id, c) { var p = scene(id).cl[c]; return p ? clone(p) : null; }

  /* ---------- animation ---------- */
  function wrap(a, m) { a = a % m; return a < 0 ? a + m : a; }
  /* a: { dots, fanC, fanE } phases; m: view motion; dt in ms (capped); rate: display units per ms */
  function step(a, m, dt, rate) {
    var d = Math.min(Math.max(+dt || 0, 0), DT_MAX) * (rate || 0);
    a = a || {};
    m = m || { flow: 0, airC: 0, airE: 0 };
    return { dots: wrap((a.dots || 0) + m.flow * d, 1000), fanC: wrap((a.fanC || 0) + m.airC * d * 6, 360),
      fanE: wrap((a.fanE || 0) + m.airE * d * 6, 360) };
  }

  /* ---------- every sid this file can hand back ---------- */
  function sids() {
    var s = {}, k;
    function add(x) { s[x] = 1; }
    [WORD, CMP, TERM, DID, FAULT, STATUS, SYS].forEach(function (o) { for (k in o) if (has(o, k)) add(o[k]); });
    for (k in LVL) if (has(LVL, k)) LVL[k].forEach(add);
    for (k in RD) if (has(RD, k)) add(RD[k].name);
    CAUSES.forEach(function (c) { add("cause." + c); add("cause." + c + ".inline"); });
    TESTS.forEach(function (t) { add("test." + t); });
    return Object.keys(s).sort();
  }

  var api = {
    version: 1, load: load, validate: validate, ready: function () { return !!T; },
    hasFault: function () { return !!T && T.scenes.length > 0; },
    schema: function () { return T ? T.schema : ""; },
    operate: operate, record: record, status: status, normOp: normOp, view: view, warn: warn,
    scenes: scenes, start: start, test: test, canPick: canPick, pick: pick, reveal: reveal, faultView: faultView,
    outcome: outcome, required: function () { need(); return T.required.slice(); },
    sceneRecord: function (id) { return scene(id).rec; }, setupRecord: function (md) { need(); return T.setup[md]; },
    step: step, fmt: fmt, diff: diff, word: word, sids: sids,
    mds: MDS.slice(), knobs: KNOBS.slice(), levels: LV.slice(), tests: TESTS.slice(), shownOnly: function () { need(); return T.shown.slice(); },
    causes: CAUSES.slice(), operateReadouts: OPERATE_RD.slice(), testReadouts: clone(TEST_RD), testTags: clone(TEST_TAGS),
    slots: clone(SLOTS), designIds: clone(DID), dtMax: DT_MAX, units: { deg: DEG, k: K, minus: MINUS },
    rdName: function (id) { return RD[id].name; }
  };
  root.RfcEngine = api;

  var q = root.RfcTableQueue;
  if (isArr(q) && q.length) {
    try { load(q[q.length - 1]); } catch (err) { root.RfcTableErrors = [String(err && err.message)]; }
    q.length = 0;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
