/* Example circuit for the motor starter control lab (relay-design-c24-20261104.md section 1).
   A 24 V DC control supply, a control fuse, the overload contact (normally closed), STOP (normally
   closed), START (normally open) with the seal-in contact across it, and the contactor coil to 0 V.
   Every switching contact is on the + side and the coil is on the 0 V side, as bank 309a#34 places them.
   The motor and its power circuit are a drawing only: line voltage, not measured here.
   Values are model values for this example circuit, not typical figures or limits; pickUp and dropOut
   are fractions of the 24 V nominal and are never printed. */
(function (root) {
  var def = {
    id: "ctl-24",
    nodes: ["n0", "nP", "nF", "nO", "nS", "nC"],
    ref: "n0",
    /* gMin and rOpen are smaller than the DC lab's so a node cut off from the supply reads 0.00 V on the
       10 Mohm meter (Basic Motor Control ch.48: "nothing when it is released"), not a leak divider */
    params: {
      gMin: 1e-12, rOpen: 1e12, rMeter: 1e7, rLeads: 0.2, ohmTestI: 0.001, olOhms: 4e7,
      pickUp: 0.75, dropOut: 0.4, maxPass: 6, flowMin: 1e-4
    },
    defaultView: "v24",
    views: { v24: { label: "24 V DC control", nominal: 24.0 } },
    inputs: { power: true, start: false, stop: false, tripOL: false },
    elements: [
      { id: "PSU", type: "source", a: "n0", b: "nP", emf: 24.0, rint: 0.05, ctl: "power" },
      { id: "FU1", type: "fuse", a: "nP", b: "nF", r: 0.01 },
      { id: "OL", type: "switch", a: "nF", b: "nO", r: 0.005, cut: "tripOL" },
      { id: "STOP", type: "switch", a: "nO", b: "nS", r: 0.005, cut: "stop" },
      { id: "START", type: "switch", a: "nS", b: "nC", r: 0.005, ctl: "start" },
      { id: "SEAL", type: "contact", a: "nS", b: "nC", r: 0.005, of: "M", form: "no" },
      { id: "MCOIL", type: "coil", a: "nC", b: "n0", r: 60, contactor: "M" }
    ],
    faults: [
      { id: "f_fuse", el: "FU1", kind: "open" },
      { id: "f_ol", el: "OL", kind: "open" },
      { id: "f_stop", el: "STOP", kind: "open" },
      { id: "f_start", el: "START", kind: "open" },
      { id: "f_seal", el: "SEAL", kind: "open" },
      { id: "f_coil", el: "MCOIL", kind: "open" },
      { id: "f_start_stuck", el: "START", kind: "stuckClosed" }
    ],
    points: [
      { id: "TP_P", node: "nP" }, { id: "TP_F", node: "nF" }, { id: "TP_O", node: "nO" },
      { id: "TP_S", node: "nS" }, { id: "TP_C", node: "nC" }, { id: "TP_0", node: "n0" }
    ],
    scenarios: [],
    text: {
      points: { TP_P: "Supply +24 V", TP_F: "Fuse output", TP_O: "After the overload contact", TP_S: "After STOP",
                TP_C: "Coil, + side", TP_0: "0 V (control common)" },
      elements: { PSU: "24 V DC control supply", FU1: "Control fuse", OL: "Overload contact (normally closed)",
                  STOP: "STOP pushbutton (normally closed)", START: "START pushbutton (normally open)",
                  SEAL: "Seal-in contact (normally open)", MCOIL: "Contactor coil" }
    }
  };
  var all = ["f_fuse", "f_ol", "f_stop", "f_start", "f_seal", "f_coil", "f_start_stuck"];
  var pts = ["TP_P", "TP_F", "TP_O", "TP_S", "TP_C", "TP_0"];
  all.forEach(function (f) { def.scenarios.push({ id: "sc_" + f.slice(2), correct: f, causes: all.slice(), points: pts.slice(), modes: ["volts", "ohms"], base: {} }); });
  if (root.CtlCircuits) root.CtlCircuits.register(def);
  else (root.CtlCircuitQueue = root.CtlCircuitQueue || []).push(def);
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
