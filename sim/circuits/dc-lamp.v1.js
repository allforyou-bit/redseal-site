/* Circuit data: example DC lamp circuit, v1. Data only, no logic.
   One drawing, two views: 12 V (one battery) and 24 V (two 12 V batteries in series, joined by a link cable).
   Parts: battery, fuse block with fuse 1 and fuse 2, a switch, the lamp 1 connector, lamps 1 and 2 on a
   shared ground connection, one other circuit (the circuit 2 lamp) and chassis ground.
   Element ends are node ids; current is positive from a to b. A view overrides element fields (set) or
   leaves elements out (omit). Point ids match the data-tp ids planned for the page drawing.
   Values are example-circuit values, not specifications or service limits for any real equipment.
   The lamp cold resistance (rCold) and the meter values in params are model values only: no text string
   states them. "facts" fields point at rows of the internal fact base (M, R, F, B, V rows). */
(function (root) {
  "use strict";
  /* one test menu per shared symptom, so the menu names no cause */
  var ONE_OUT = ["c1_open", "wg1_open", "l1_failed", "s1_open"];
  var BOTH_DIM = ["g1_highR", "s1_highR", "c1_highR", "bat_weak"];
  var ALL_DIM = ["link_highR", "neg_highR", "pos_highR", "g1_highR"];
  var ONE_OUT_PTS = ["TP_S1B", "TP_C1W", "TP_L1P", "TP_L1N", "TP_CH"];
  var BOTH_DIM_PTS = ["TP_DIST", "TP_F1B", "TP_S1B", "TP_L1P", "TP_G1", "TP_CH"];
  var BOTH_DIM_CTL = ["s1", "power", "removeF1"];
  var ALL_DIM_PTS = ["TP_BN", "TP_B1P", "TP_B2N", "TP_BP", "TP_DIST", "TP_G1", "TP_CH"];
  var def = {
    id: "dc-lamp",
    v: 1,
    solver: "dcNodal",
    defaultView: "v12",
    ref: "b1n",        /* battery negative post: 0 V for the solver */
    ground: "chassis", /* where a short to ground lands */
    params: {
      rOpen: 1e12, gMin: 1e-12, rShort: 0.01, rMeter: 1e7, ohmTestI: 1e-3, olOhms: 2e7, rLeads: 0.2,
      brightAt: 0.6, dimAt: 0.03,   /* display bands, fraction of rated lamp power */
      flowMin: 1e-3                 /* amps below this draw no moving arrows */
    },
    /* inputs: true = closed / connected for ctl elements, true = removed / unplugged for cut elements */
    inputs: { power: true, s1: true, removeF1: false, unplugC1: false, unplugC2: false },
    nodes: ["b1n", "b1p", "b2n", "sysP", "dist", "f1o", "s1o", "c1w", "l1p", "l1n", "c2w", "l2p", "l2n", "gs",
      "f2o", "l3p", "l3n", "chassis"],
    elements: [
      { id: "BAT1", type: "source", a: "b1n", b: "sysP", emf: 12.6, rint: 0.02 },
      { id: "LINK", type: "wire", a: "b1p", b: "b2n", r: 0.003 },
      { id: "BAT2", type: "source", a: "b2n", b: "sysP", emf: 12.6, rint: 0.02 },
      { id: "CABLE_POS", type: "wire", a: "sysP", b: "dist", r: 0.004 },
      { id: "CABLE_NEG", type: "wire", a: "b1n", b: "chassis", r: 0.004, ctl: "power" },
      { id: "F1", type: "fuse", a: "dist", b: "f1o", r: 0.005, rating: 20, cut: "removeF1" },
      { id: "S1", type: "switch", a: "f1o", b: "s1o", r: 0.004, ctl: "s1" },
      { id: "W1", type: "wire", a: "s1o", b: "c1w", r: 0.012 },
      { id: "C1", type: "connector", a: "c1w", b: "l1p", r: 0.003, cut: "unplugC1" },
      { id: "L1", type: "lamp", a: "l1p", b: "l1n", r: 2.4, rCold: 0.24 },
      { id: "WG1", type: "wire", a: "l1n", b: "gs", r: 0.008 },
      { id: "W2", type: "wire", a: "s1o", b: "c2w", r: 0.012 },
      { id: "C2", type: "connector", a: "c2w", b: "l2p", r: 0.003, cut: "unplugC2" },
      { id: "L2", type: "lamp", a: "l2p", b: "l2n", r: 2.4, rCold: 0.24 },
      { id: "WG2", type: "wire", a: "l2n", b: "gs", r: 0.008 },
      { id: "G1", type: "connector", a: "gs", b: "chassis", r: 0.005 },
      { id: "F2", type: "fuse", a: "dist", b: "f2o", r: 0.005, rating: 20 },
      { id: "W3", type: "wire", a: "f2o", b: "l3p", r: 0.012 },
      { id: "L3", type: "lamp", a: "l3p", b: "l3n", r: 2.4, rCold: 0.24 },
      { id: "G3", type: "connector", a: "l3n", b: "chassis", r: 0.005 }
    ],
    views: {
      v12: { label: "12 V", nominal: 12.6, omit: ["LINK", "BAT2"] },
      /* two 12 V batteries in series; lamps re-rated for the same power at twice the voltage (R x 4);
         rCold stays one tenth of the hot value, a model value only */
      v24: { label: "24 V", nominal: 25.2, set: { BAT1: { b: "b1p" }, L1: { r: 9.6, rCold: 0.96 }, L2: { r: 9.6, rCold: 0.96 },
        L3: { r: 9.6, rCold: 0.96 }, F1: { rating: 10 }, F2: { rating: 10 } } }
    },
    points: [
      { id: "TP_BN", node: "b1n" },
      { id: "TP_B1P", node: "b1p", views: ["v24"] },
      { id: "TP_B2N", node: "b2n", views: ["v24"] },
      { id: "TP_BP", node: "sysP" },
      { id: "TP_DIST", node: "dist" },
      { id: "TP_F1B", node: "f1o" },
      { id: "TP_S1B", node: "s1o" },
      { id: "TP_C1W", node: "c1w" },
      { id: "TP_L1P", node: "l1p" },
      { id: "TP_L1N", node: "l1n" },
      { id: "TP_L2P", node: "l2p" },
      { id: "TP_G1", node: "gs" },
      { id: "TP_L3P", node: "l3p" },
      { id: "TP_CH", node: "chassis" }
    ],
    /* 16 entries: the 8 scenario causes, then the 8 decoys. Magnitudes keep each faulty drop at volts,
       while a healthy wire, contact or fuse drops hundredths of a volt. */
    faults: [
      { id: "c1_open", kind: "open", el: "C1", facts: ["F2", "F8", "F21", "R8"] },
      { id: "wg1_open", kind: "open", el: "WG1", facts: ["F3", "F8", "F21"] },
      { id: "g1_highR", kind: "highR", el: "G1", k: 80, facts: ["F18", "F23", "R7", "R9", "V1"] },        /* 0.4 ohm */
      { id: "s1_highR", kind: "highR", el: "S1", k: 100, facts: ["F16", "F23", "R7", "R9", "V1", "M14"] }, /* 0.4 ohm */
      { id: "w1_short_gnd", kind: "shortGnd", node: "c1w", facts: ["F9", "F12", "F14", "R13", "M8", "M9"] },
      /* F15 (short to power) has no accepted source: the explanation rests on the computed readings */
      { id: "w1_short_pwr", kind: "shortPwr", node: "c1w", to: "f2o", facts: ["R2", "R8", "R9"] },
      { id: "link_highR", kind: "highR", el: "LINK", k: 500, facts: ["B2", "B3", "F23", "R6", "R7", "V1"] }, /* 1.5 ohm */
      { id: "neg_highR", kind: "highR", el: "CABLE_NEG", k: 375, facts: ["F18", "F23", "R7", "V1"] },     /* 1.5 ohm */
      { id: "l1_failed", kind: "open", el: "L1", facts: ["F5", "F7", "F21"] },
      { id: "s1_open", kind: "open", el: "S1", facts: ["F2", "F4", "F6"] },
      { id: "c1_highR", kind: "highR", el: "C1", k: 300, facts: ["F16", "R7", "R9"] },                    /* 0.9 ohm */
      { id: "bat_weak", kind: "weakSource", el: "BAT1", k: 15, facts: ["B5", "B6", "B7"] },              /* 0.3 ohm internal */
      { id: "l1_short_gnd", kind: "shortGnd", node: "l1p", facts: ["F9", "F14", "R13"] },
      { id: "f1_low", kind: "lowRating", el: "F1", k: 0.3, facts: ["R11", "R12"] },
      { id: "s1_stuck", kind: "stuckClosed", el: "S1", facts: ["R2", "R5"] },
      { id: "pos_highR", kind: "highR", el: "CABLE_POS", k: 375, facts: ["F16", "F23", "R7", "V1"] }      /* 1.5 ohm */
    ],
    /* mustView: readings the visitor must take before a cause pick counts; together they separate the
       correct cause from every other cause on the menu. when: inputs set for that reading. */
    scenarios: [
      { id: "sc_feed_open", view: "v12", symptom: "oneOut", correct: "c1_open", causes: ONE_OUT, points: ONE_OUT_PTS,
        modes: ["volts"], controls: ["s1"],
        mustView: [{ mode: "volts", red: "TP_L1P", black: "TP_CH" }, { mode: "volts", red: "TP_L1N", black: "TP_CH" },
          { mode: "volts", red: "TP_C1W", black: "TP_L1P" }] },
      { id: "sc_ground_open", view: "v12", symptom: "oneOut", correct: "wg1_open", causes: ONE_OUT, points: ONE_OUT_PTS,
        modes: ["volts"], controls: ["s1"],
        mustView: [{ mode: "volts", red: "TP_L1P", black: "TP_CH" }, { mode: "volts", red: "TP_L1N", black: "TP_CH" },
          { mode: "volts", red: "TP_C1W", black: "TP_L1P" }] },
      { id: "sc_ground_hr", view: "v12", symptom: "bothDim", correct: "g1_highR", causes: BOTH_DIM, points: BOTH_DIM_PTS,
        modes: ["volts", "ohms"], controls: BOTH_DIM_CTL,
        mustView: [{ mode: "volts", red: "TP_F1B", black: "TP_S1B" }, { mode: "volts", red: "TP_G1", black: "TP_CH" }] },
      { id: "sc_switch_hr", view: "v12", symptom: "bothDim", correct: "s1_highR", causes: BOTH_DIM, points: BOTH_DIM_PTS,
        modes: ["volts", "ohms"], controls: BOTH_DIM_CTL,
        mustView: [{ mode: "volts", red: "TP_F1B", black: "TP_S1B" }, { mode: "volts", red: "TP_G1", black: "TP_CH" }] },
      { id: "sc_short_gnd", view: "v12", symptom: "fuseOpens", correct: "w1_short_gnd",
        causes: ["w1_short_gnd", "l1_short_gnd", "f1_low"], points: ["TP_DIST", "TP_F1B", "TP_S1B", "TP_C1W", "TP_CH"],
        modes: ["volts", "ohms"], controls: ["s1", "power", "removeF1", "unplugC1", "unplugC2", "replaceFuse"],
        mustView: [{ mode: "ohms", red: "TP_C1W", black: "TP_CH", when: { power: false, removeF1: true, unplugC1: true, unplugC2: true } }] },
      { id: "sc_short_pwr", view: "v12", symptom: "stayOn", correct: "w1_short_pwr", base: { s1: false },
        causes: ["w1_short_pwr", "s1_stuck", "w1_short_gnd"], points: ["TP_DIST", "TP_F1B", "TP_S1B", "TP_L1P", "TP_CH"],
        modes: ["volts"], controls: ["s1", "removeF1"],
        mustView: [{ mode: "volts", red: "TP_L1P", black: "TP_CH", when: { s1: false, removeF1: true } }] },
      { id: "sc_link_hr", view: "v24", symptom: "allDim", correct: "link_highR", causes: ALL_DIM, points: ALL_DIM_PTS,
        modes: ["volts"], controls: ["s1"],
        mustView: [{ mode: "volts", red: "TP_B1P", black: "TP_B2N" }, { mode: "volts", red: "TP_CH", black: "TP_BN" },
          { mode: "volts", red: "TP_BP", black: "TP_DIST" }, { mode: "volts", red: "TP_G1", black: "TP_CH" }] },
      { id: "sc_neg_hr", view: "v24", symptom: "allDim", correct: "neg_highR", causes: ALL_DIM, points: ALL_DIM_PTS,
        modes: ["volts"], controls: ["s1"],
        mustView: [{ mode: "volts", red: "TP_B1P", black: "TP_B2N" }, { mode: "volts", red: "TP_CH", black: "TP_BN" },
          { mode: "volts", red: "TP_BP", black: "TP_DIST" }, { mode: "volts", red: "TP_G1", black: "TP_CH" }] }
    ],
    /* every string below is shown on the page; plain English, no numbers except part numbers and the
       12 V / 24 V view names, and reviewed against the fact base before release */
    text: {
      points: {
        TP_BN: "Battery negative post", TP_B1P: "Battery 1 positive post", TP_B2N: "Battery 2 negative post",
        TP_BP: "Battery positive post", TP_DIST: "Fuse block input", TP_F1B: "Fuse 1 output",
        TP_S1B: "Switch output", TP_C1W: "Lamp 1 connector, wire side", TP_L1P: "Lamp 1 positive terminal",
        TP_L1N: "Lamp 1 ground terminal", TP_L2P: "Lamp 2 positive terminal", TP_G1: "Lamp ground connection",
        TP_L3P: "Circuit 2 lamp positive terminal", TP_CH: "Chassis ground"
      },
      faults: {
        c1_open: "Open at the lamp 1 connector", wg1_open: "Open in the lamp 1 ground wire",
        l1_failed: "Lamp 1 burned out", s1_open: "Switch does not close",
        g1_highR: "High resistance at the lamp ground connection", s1_highR: "High resistance across the switch contacts",
        c1_highR: "High resistance at the lamp 1 connector", bat_weak: "Battery cannot hold its voltage under load",
        w1_short_gnd: "Lamp 1 feed wire shorted to ground", l1_short_gnd: "Short to ground on the lamp side of the lamp 1 connector",
        f1_low: "Fuse rating too low for the circuit", w1_short_pwr: "Lamp 1 feed wire touching a powered wire",
        s1_stuck: "Switch contacts stuck closed", link_highR: "High resistance in the cable between the batteries",
        neg_highR: "High resistance in the battery negative cable", pos_highR: "High resistance in the battery positive cable"
      },
      symptoms: {
        oneOut: "Lamp 1 does not light. Lamp 2 works.",
        bothDim: "Lamps 1 and 2 are both dim. The circuit 2 lamp is normal.",
        fuseOpens: "Fuse 1 opens as soon as the switch is turned on.",
        stayOn: "Lamps 1 and 2 stay on with the switch off.",
        allDim: "Every lamp is dim, the circuit 2 lamp too."
      },
      /* labels for the inputs; replaceFuse is the scenario action that clears a blown fuse */
      controls: {
        power: "Battery connected", s1: "Switch", removeF1: "Remove fuse 1", unplugC1: "Unplug lamp 1",
        unplugC2: "Unplug lamp 2", replaceFuse: "Replace fuse 1"
      },
      /* shown instead of a resistance reading (measure().blocked) */
      blocked: {
        power: "Power is connected. Disconnect the battery to measure resistance.",
        source: "The battery is in the path between the leads, so resistance cannot be measured here."
      },
      /* shown beside every reading */
      readingNote: "Computed value for this example circuit, not a service limit."
    }
  };
  try {
    if (root.DcCircuits && root.DcCircuits.register) root.DcCircuits.register(def);
    else (root.DcCircuitQueue = root.DcCircuitQueue || []).push(def);
  } catch (err) {
    (root.DcCircuitErrors = root.DcCircuitErrors || []).push(String(err && err.message));
    if (root.console && root.console.error) root.console.error(err);
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
