/* Circuit data: example 12 V board for the multimeter practice simulator, v1. Data only, no logic.
   One loop: battery, fuse holder (the fuse can be pulled), switch, a connector that can be parted, one lamp
   and chassis ground. FB is the circuit fuse out of its holder, lying on the bench: its ends touch nothing
   else, it carries current only when the meter is across it, and the engine opens it whenever F1 has opened
   (bench: "F1"). Points with a bench input exist only while that input is true.
   Element ends are node ids; current is positive from a to b. Values are example-circuit values, not
   specifications or service limits for any real equipment. The lamp cold resistance (rCold), the params
   and the meter block are model values only: no text string states them.
   Registers with DcCircuits (dc-engine.v1.js), which validates the circuit part unchanged; the meter,
   drills and text blocks are checked by MmEngine.check (mm-engine.v1.js). */
(function (root) {
  "use strict";
  var ON = { power: true, s1: true, fuseOut: false, parted: false };
  function set(o) { var r = {}, k; for (k in ON) r[k] = ON[k]; for (k in o) r[k] = o[k]; return r; }
  var BAT_PAIRS = [["TP_BP", "TP_BN"], ["TP_BP", "TP_CH"]];
  var def = {
    id: "mm-12v",
    v: 1,
    solver: "dcNodal",
    defaultView: "v12",
    ref: "bn",       /* battery negative post: 0 V for the solver */
    ground: "ch",    /* chassis: where a short to ground lands */
    params: {
      rOpen: 1e12, gMin: 1e-12, rShort: 0.01, rMeter: 1e7, ohmTestI: 1e-3, olOhms: 2e7, rLeads: 0.2,
      brightAt: 0.6, dimAt: 0.03,   /* display bands, fraction of rated lamp power */
      flowMin: 1e-3                 /* amps below this draw no moving arrows */
    },
    /* the A jack path: params.rLeads + rShunt; a fuse-type element rated fuseRating, above the circuit fuse,
       so a short through F1 opens F1 first. contBeep: the continuity beep, at or below. ranges: DC volts
       manual ranges of this example meter (auto is the default). W1 and the other healthy parts are
       sized so that no reading between two points lands on 0.10, 0.20, 0.30 or 0.50 V */
    meter: { rShunt: 0.01, fuseRating: 10, contBeep: 30, ranges: { r6: 6, r60: 60 } },
    /* inputs: true = closed / connected for ctl elements, true = removed / parted for cut elements */
    inputs: { power: true, s1: true, fuseOut: false, parted: false },
    nodes: ["bn", "bp", "fi", "fo", "so", "cw", "lp", "ln", "ch", "fa", "fb"],
    elements: [
      { id: "BAT", type: "source", a: "bn", b: "bp", emf: 12.6, rint: 0.02 },
      { id: "CPOS", type: "wire", a: "bp", b: "fi", r: 0.004 },
      { id: "F1", type: "fuse", a: "fi", b: "fo", r: 0.006, rating: 7.5, cut: "fuseOut" },
      { id: "S1", type: "switch", a: "fo", b: "so", r: 0.004, ctl: "s1" },
      { id: "W1", type: "wire", a: "so", b: "cw", r: 0.009 },
      { id: "CN", type: "connector", a: "cw", b: "lp", r: 0.004, cut: "parted" },
      { id: "L1", type: "lamp", a: "lp", b: "ln", r: 3.0, rCold: 0.42 },
      { id: "WG", type: "wire", a: "ln", b: "ch", r: 0.008 },
      { id: "CNEG", type: "wire", a: "bn", b: "ch", r: 0.004, ctl: "power" },
      { id: "FB", type: "fuse", a: "fa", b: "fb", r: 0.006, rating: 7.5, ctl: "fuseOut", bench: "F1" }
    ],
    views: { v12: { label: "12 V", nominal: 12.6 } },
    points: [
      { id: "TP_BP", node: "bp" },
      { id: "TP_BN", node: "bn" },
      { id: "TP_FI", node: "fi" },
      { id: "TP_FO", node: "fo" },
      { id: "TP_SO", node: "so" },
      { id: "TP_CW", node: "cw" },
      { id: "TP_LP", node: "lp" },
      { id: "TP_CH", node: "ch" },
      { id: "TP_FA", node: "fa", bench: "fuseOut" },
      { id: "TP_FB", node: "fb", bench: "fuseOut" }
    ],
    /* DC fault kinds, never drill causes: fb_open lets the DC engine read a pulled fuse that has opened;
       the other three model the decoys lamp_failed, short_to_chassis and battery_flat in the drill tests */
    faults: [
      { id: "fb_open", kind: "open", el: "FB" },
      { id: "l1_open", kind: "open", el: "L1" },
      { id: "cw_short_gnd", kind: "shortGnd", node: "cw" },
      { id: "bat_weak", kind: "weakSource", el: "BAT", k: 15 }
    ],
    scenarios: [],
    /* drills: a wrongly set up start (preset), the controls offered beside the meter keys, and the reading
       the visitor must take before a cause pick counts (need: steps in order, each met by any one entry) */
    drills: [
      { id: "d1", correct: "ac_on_dc", causes: ["ac_on_dc", "leads_reversed", "a_jack_volts", "battery_flat"],
        preset: { meter: { dial: "acv", jack: "vo" }, red: "TP_BP", black: "TP_BN", inputs: set({}) },
        controls: ["power", "s1"],
        need: [[{ dial: ["dcv"], jack: "vo", pairs: BAT_PAIRS, when: { power: true }, cls: ["value"] }]] },
      { id: "d2", correct: "switch_closed", causes: ["switch_closed", "vo_jack_amps", "meter_fuse_open", "leads_reversed"],
        preset: { meter: { dial: "dca", jack: "a" }, red: "TP_FO", black: "TP_SO", inputs: set({}) },
        controls: ["s1", "fuseOut", "parted", "power"],
        need: [[{ dial: ["dca"], jack: "a", inSeries: true, cls: ["value"] }]] },
      { id: "d3", correct: "a_jack_volts", causes: ["a_jack_volts", "ac_on_dc", "leads_reversed", "battery_flat"],
        preset: { meter: { dial: "dcv", jack: "a" }, meterBlown: true, red: "TP_BP", black: "TP_BN", inputs: set({}) },
        controls: ["power", "s1", "replaceMeterFuse"],
        need: [[{ dial: ["dcv"], jack: "vo", pairs: BAT_PAIRS, when: { power: true }, cls: ["value"] }]] },
      { id: "d4", correct: "volts_in_series", causes: ["volts_in_series", "lamp_failed", "a_jack_volts", "leads_reversed"],
        preset: { meter: { dial: "dcv", jack: "vo" }, red: "TP_FI", black: "TP_FO", inputs: set({ fuseOut: true }) },
        controls: ["s1", "fuseOut", "parted", "power"],
        need: [[{ dial: ["dca"], jack: "a", inSeries: true, cls: ["value"] }]] },
      { id: "d5", correct: "fuse_open", causes: ["fuse_open", "lamp_failed", "battery_flat", "lead_broken"],
        preset: { meter: { dial: "dcv", jack: "vo" }, red: null, black: null, inputs: set({}), blown: { F1: true } },
        controls: ["power", "s1", "fuseOut"],
        need: [[{ dial: ["ohm", "cont"], jack: "vo", pairs: [["TP_FA", "TP_FB"]], cls: ["ol"] },
          { dial: ["ohm", "cont"], jack: "vo", pairs: [["TP_FI", "TP_FO"]], when: { power: false, fuseOut: false }, cls: ["ol"] }]] },
      { id: "d6", correct: "ohms_powered", causes: ["ohms_powered", "lamp_failed", "cont_not_ohms", "lead_broken"],
        preset: { meter: { dial: "ohm", jack: "vo" }, red: "TP_LP", black: "TP_CH", inputs: set({}) },
        controls: ["power", "s1", "parted"],
        need: [[{ dial: ["ohm", "cont"], jack: "vo", pairs: [["TP_LP", "TP_CH"]], when: { power: false }, cls: ["value"] }]] },
      { id: "d7", correct: "lead_broken", causes: ["lead_broken", "battery_flat", "ac_on_dc", "meter_fuse_open"],
        preset: { meter: { dial: "dcv", jack: "vo" }, leadBroken: true, red: "TP_BP", black: "TP_BN", inputs: set({}) },
        controls: ["power", "s1", "together", "newLeads"],
        need: [[{ dial: ["ohm", "cont"], jack: "vo", together: true, when: { leadBroken: true }, cls: ["ol"] }],
          [{ dial: ["dcv"], jack: "vo", pairs: BAT_PAIRS, when: { power: true, leadBroken: false }, cls: ["value"] }]] },
      { id: "d8", correct: "path_through_lamp", causes: ["path_through_lamp", "short_to_chassis", "ohms_powered", "fuse_open"],
        preset: { meter: { dial: "cont", jack: "vo" }, red: "TP_CW", black: "TP_CH", inputs: set({ power: false }) },
        controls: ["power", "s1", "parted", "fuseOut"],
        need: [[{ dial: ["cont", "ohm"], jack: "vo", pairs: [["TP_CW", "TP_CH"]], when: { parted: true }, cls: ["ol"] }]] },
      { id: "d9", correct: "range_low", causes: ["range_low", "lead_broken", "lamp_failed", "leads_reversed"],
        preset: { meter: { dial: "dcv", jack: "vo", range: "r6" }, red: "TP_BP", black: "TP_BN", inputs: set({}) },
        controls: ["power", "range"],
        need: [[{ dial: ["dcv"], jack: "vo", range: ["auto", "r60"], pairs: BAT_PAIRS, when: { power: true }, cls: ["value"] }]] }
    ],
    /* every string below is shown on the page; reviewed against the fact base before release */
    text: {
      points: {
        TP_BP: "Battery positive post", TP_BN: "Battery negative post", TP_FI: "Fuse holder input",
        TP_FO: "Fuse holder output (switch input)", TP_SO: "Switch output", TP_CW: "Connector, wire side",
        TP_LP: "Lamp positive terminal", TP_CH: "Chassis ground",
        TP_FA: "Removed fuse, left end", TP_FB: "Removed fuse, right end"
      },
      faults: {
        fb_open: "Removed fuse open", l1_open: "Lamp burned out", cw_short_gnd: "Feed wire shorted to chassis",
        bat_weak: "Battery cannot hold its voltage under load"
      },
      symptoms: {},
      controls: {
        power: "Battery connected", s1: "Switch", fuseOut: "Fuse out of holder", parted: "Connector parted",
        replaceFuse: "Replace circuit fuse", replaceMeterFuse: "Replace meter fuse", together: "Touch probes together",
        newLeads: "New test leads", range: "Range (this example meter)"
      },
      dials: { off: "OFF", dcv: "DC V", acv: "AC V", ohm: "\u03A9", cont: "Cont", dca: "DC A" },
      dialNames: { off: "Off", dcv: "DC volts", acv: "AC volts", ohm: "Resistance", cont: "Continuity", dca: "DC amps" },
      jacks: { vo: "V\u03A9", a: "A" },
      ranges: { auto: "Auto", r6: "6 V", r60: "60 V" },
      /* shown in place of a reading (MmEngine.read cls), and the status lines */
      cards: {
        idle: "Place both leads.",
        olOhms: "More resistance than this example meter can show, as with an open path.",
        olRange: "The voltage is above the selected range of this example meter.",
        powered: "Not a resistance: the circuit is powered. Disconnect the battery first.",
        source: "The battery is in the path between the leads, so resistance cannot be measured here.",
        noAc: "No AC source on this board.",
        jackA: "The red lead is in the A jack. This example meter reads volts, resistance and continuity through the V\u03A9 jack.",
        jackV: "The red lead is in the V\u03A9 jack. This example meter reads current only through the A jack.",
        meterFuse: "This example meter\u2019s fuse has opened. Current readings need a new fuse of the type and rating the meter maker specifies.",
        meterFuseOpened: "This example meter\u2019s fuse opened: with the red lead in the A jack the meter was a short across the battery.",
        circuitFuseOpened: "The circuit fuse opened: with the red lead in the A jack the meter was a low-resistance path around the lamp.",
        lamp: "Lamp", bright: "bright", dim: "dim", off: "off"
      },
      drills: {
        d1: "Read the battery voltage. On AC volts this example meter shows that there is no AC source on this board.",
        d2: "Read the lamp current. On DC amps across the switch, with the switch on, the meter shows a small current and the lamp stays bright.",
        d3: "The meter was set to DC volts and put across the battery. Now this example meter\u2019s fuse has opened.",
        d4: "Read the lamp current. With the fuse pulled and the meter across the empty holder, the lamp stays off and the meter shows nearly the battery voltage.",
        d5: "The lamp does not light. Check the fuse with the meter.",
        d6: "Check the lamp. On resistance across the lamp with the switch on, this example meter shows a card, not a resistance.",
        d7: "Across the battery the meter shows 0.00 V, but the lamp is lit.",
        d8: "Checking the feed wire for a short to chassis: continuity from the connector\u2019s wire side to chassis beeps.",
        d9: "On a manual range this example meter shows OL across the battery."
      },
      /* the 16 drill causes; neutral ids, so the GA placement sim_<id> names no drill */
      causes: {
        ac_on_dc: "Dial on AC volts for a DC battery",
        leads_reversed: "Test leads reversed",
        a_jack_volts: "Red lead left in the A jack for a voltage reading",
        battery_flat: "Battery cannot hold its voltage under load",
        switch_closed: "Meter on DC amps across a closed switch",
        vo_jack_amps: "Red lead in the V\u03A9 jack for a current reading",
        meter_fuse_open: "Meter fuse already open",
        volts_in_series: "Meter on DC volts connected in series",
        lamp_failed: "Lamp burned out",
        fuse_open: "Circuit fuse open",
        lead_broken: "Broken test lead",
        ohms_powered: "Resistance measured with the circuit powered",
        cont_not_ohms: "Continuity used where a resistance value was needed",
        path_through_lamp: "Continuity path through the lamp to chassis",
        short_to_chassis: "Feed wire shorted to chassis",
        range_low: "Manual range set below the voltage"
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
