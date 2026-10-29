/* Circuit data: generic closed-loop hydrostatic drive, v1. Data only, no logic.
   Topology ids (comps, lines, ports) match the data-comp / data-line ids in the page SVG.
   Line ends are "comp.port"; dir +1 means flow from ends[0] toward the other ends.
   Values are relative (0 to 1). Real pressures and flows come from the manufacturer manual.
   Simplified model: no momentum; the motors follow the swashplate.
   "facts" fields point at rows of the internal fact base (A, B, F rows) or at source locators. */
(function (root) {
  "use strict";
  var ALL = ["charge_pump_worn", "charge_relief_stuck_open", "hprv_leak_A", "bypass_open", "motor_worn"];
  /* one test menu for the three scenarios that share the both-ways symptom, so the menu names no cause */
  var BOTH_WAYS_PORTS = ["A", "B", "CHARGE", "CHARGE_FLOW", "MOTOR_CASE_FLOW"], BOTH_WAYS_STEPS = ["defeatFlushing"];
  var def = {
    id: "hst-drive",
    v: 1,
    solver: "closedLoopHST",
    params: {
      swashRate: 2.0,          /* full stroke per second, servo rate limit (B7) */
      deadband: 0.02,          /* swashplate band treated as neutral */
      chargeLevel: 0.12,       /* charge relief setting, relative (A6) */
      strokeChargeDrop: 0.92,  /* charge reads slightly lower in stroke (B4) */
      reliefLevel: 0.95,       /* crossport high-pressure relief setting (A9, B9) */
      loadDp: 0.25,            /* loop pressure difference for the drive load in low range (A18) */
      rangeRatio: 2,           /* max / min motor displacement (A17, B11) */
      baseSpeed: 0.5,          /* motor speed at full stroke in low range */
      controlUse: 0.1,         /* charge flow used by the control (A4, A5) */
      leakHealthy: 0.08,       /* motor rotating-group leakage when stroked, healthy */
      flushUse: 0.2,           /* charge flow taken by loop flushing (A16) */
      chargeNeed: 0.6,         /* heuristic: spare charge flow needed to hold the relief setting; the charge pump flow reading is taken at charge pressure */
      chargeFloor: 0.3,
      strokePerCharge: 0.9,    /* low charge limits servo force, pump moves toward neutral (A5, A15, F4) */
      bypassRise: 1.1,         /* open bypass: loop stays near charge (A21, F9; S3 pp.27-28) */
      brakeLevel: 0.3,         /* display level only, not a pressure claim; release supply not modelled and never derived from charge (B13 is U) */
      drainLevel: 0.03,
      caseBase: 0.1,
      flowScale: 0.8,
      readTol: 0.01,
      lowRatio: 0.75,          /* reading vs a healthy circuit in the same condition */
      highRatio: 1.3,
      pressureLimiter: false,  /* data toggle, off by default (A10, A11) */
      limiterLevel: 0.88,
      limiterStroke: 0.05,
      loopFlushing: false,     /* data toggle, off by default (A16) */
      flushChargeDrop: 0.85
    },
    motors: ["motor1", "motor2"],
    comps: [
      { id: "reservoir", type: "reservoir", ports: ["out", "in"] },
      { id: "chargePump", type: "fixedPump", ports: ["in", "out"], facts: ["A4"] },
      { id: "chargeFilter", type: "filter", hasBypassValve: true, ports: ["in", "out"], facts: ["A7"] },
      { id: "chargeRelief", type: "reliefValve", ports: ["in", "out"], facts: ["A6"] },
      { id: "pump", type: "overCentrePump", ports: ["A", "B", "case"], facts: ["A1", "A2", "A3"] },
      { id: "controlValve", type: "propControl", ports: ["P", "F", "R"], facts: ["A14", "A15"] },
      { id: "solFwd", type: "solenoid", dir: "fwd", ports: [], facts: ["A14"] },
      { id: "solRev", type: "solenoid", dir: "rev", ports: [], facts: ["A14"] },
      { id: "servo", type: "servo", ports: ["F", "R"], facts: ["A1", "A5"] },
      { id: "mfvA", type: "multiFunction", side: "A", ports: ["charge", "loop", "cross"], facts: ["A8", "A9", "A10", "A21"] },
      { id: "mfvB", type: "multiFunction", side: "B", ports: ["charge", "loop", "cross"], facts: ["A8", "A9", "A10", "A21"] },
      { id: "motor1", type: "motor2spd", ports: ["A", "B", "case"], facts: ["A17", "A18"] },
      { id: "motor2", type: "motor2spd", ports: ["A", "B", "case"], facts: ["A17", "A18"] },
      { id: "brakeValve", type: "solenoidValve", ports: ["out"], facts: ["A19"] },
      { id: "brake", type: "sahrBrake", ports: ["port"], facts: ["A19", "B12"] },
      { id: "cooler", type: "cooler", ports: ["in", "out"], facts: ["A13"] },
      { id: "flushValve", type: "flushShuttle", toggle: "loopFlushing", ports: ["A", "B", "out"], facts: ["A16"] }
    ],
    lines: [
      { id: "suction", role: "suction", ends: ["reservoir.out", "chargePump.in"] },
      { id: "chargeOut", role: "chargeOut", ends: ["chargePump.out", "chargeFilter.in"] },
      { id: "chargeGallery", role: "chargeGallery", ends: ["chargeFilter.out", "mfvA.charge", "mfvB.charge", "chargeRelief.in", "controlValve.P"] },
      { id: "chargeDump", role: "chargeDump", ends: ["chargeRelief.out", "pump.case"] },
      { id: "servoFwd", role: "servoFwd", ends: ["controlValve.F", "servo.F"] },
      { id: "servoRev", role: "servoRev", ends: ["controlValve.R", "servo.R"] },
      { id: "loopA", role: "loopA", ends: ["pump.A", "mfvA.loop", "flushValve.A", "motor1.A", "motor2.A"] },
      { id: "loopB", role: "loopB", ends: ["pump.B", "mfvB.loop", "flushValve.B", "motor1.B", "motor2.B"] },
      { id: "crossport", role: "crossport", ends: ["mfvA.cross", "mfvB.cross"] },
      { id: "brakePort", role: "brakePort", ends: ["brakeValve.out", "brake.port"] },
      { id: "caseDrain", role: "caseDrain", ends: ["pump.case", "cooler.in"] },
      { id: "motorCaseDrain", role: "motorCaseDrain", ends: ["motor1.case", "motor2.case", "cooler.in"] },
      { id: "coolerReturn", role: "coolerReturn", ends: ["cooler.out", "reservoir.in"] },
      { id: "flushOut", role: "flushOut", toggle: "loopFlushing", ends: ["flushValve.out", "motor1.case"] }
    ],
    /* SERVO reads the commanded servo side (gauge on both servo lines).
       CHARGE_FLOW is charge pump outlet flow, before the charge relief.
       MOTOR_CASE_FLOW is one meter on the motor case drain: both motor cases combined, before the drain
       joins the pump case drain. Charge relief flow goes to the pump case, so it is not in that reading;
       flushing oil is, when flushing is on and not defeated. */
    ports: [
      { id: "A", measure: "pressureA", lines: ["loopA"], kind: "pressure" },
      { id: "B", measure: "pressureB", lines: ["loopB"], kind: "pressure" },
      { id: "CHARGE", measure: "charge", lines: ["chargeGallery"], kind: "pressure" },
      { id: "SERVO", measure: "servo", lines: ["servoFwd", "servoRev"], kind: "pressure" },
      { id: "CHARGE_FLOW", measure: "chargeFlow", lines: ["chargeOut"], kind: "flow" },
      { id: "MOTOR_CASE_FLOW", measure: "motorCaseFlow", lines: ["motorCaseDrain"], kind: "flow" }
    ],
    faults: [
      { id: "charge_pump_worn", facts: ["F1", "F4", "A4", "S1 p.27"], effect: { chargePumpFlow: 0.45, heat: "stroke" } },
      { id: "charge_relief_stuck_open", facts: ["F2", "F4", "A6", "S1 p.27"], effect: { chargeCap: 0.4, heat: "stroke" } },
      { id: "hprv_leak_A", facts: ["F6", "A9", "A10", "S3 p.27"], effect: { leakSide: "A", sideCap: 0.65, sideVolEff: 0.6, heat: "leakSide" } },
      { id: "bypass_open", facts: ["F9", "A21", "S2 p.24", "S3 pp.27-28"], effect: { bypass: true } },
      { id: "motor_worn", facts: ["F8", "A13", "S1 p.27", "S4 pp.31-32"], effect: { leak: 0.8, volEff: 0.6, cap: 0.65, heat: "stroke" } }
    ],
    /* test conditions for scenarios; base is engine on, brake released, low range */
    setups: {
      neutral: { joystick: 0 },
      forward: { joystick: 1 },
      reverse: { joystick: -1 },
      stallForward: { joystick: 1, stall: true },
      stallReverse: { joystick: -1, stall: true }
    },
    /* checks: expected readings of the correct cause. mustView: readings the student must take
       before a cause pick counts; they separate the correct cause from every other cause. */
    scenarios: [
      {
        id: "s_charge_pump", correct: "charge_pump_worn", symptom: "bothWaysMayRunHot",
        ports: BOTH_WAYS_PORTS.slice(), steps: BOTH_WAYS_STEPS.slice(), causes: ALL.slice(),
        mustView: [{ setup: "neutral", port: "CHARGE" }, { setup: "neutral", port: "CHARGE_FLOW" }],
        checks: [
          { setup: "neutral", port: "CHARGE", level: "low" },
          { setup: "forward", port: "CHARGE", level: "low" },
          { setup: "reverse", port: "CHARGE", level: "low" },
          { setup: "neutral", port: "CHARGE_FLOW", level: "low" },
          { setup: "forward", port: "CHARGE_FLOW", level: "low" }
        ]
      },
      {
        id: "s_charge_relief", correct: "charge_relief_stuck_open", symptom: "bothWaysMayRunHot",
        ports: BOTH_WAYS_PORTS.slice(), steps: BOTH_WAYS_STEPS.slice(), causes: ALL.slice(),
        mustView: [{ setup: "neutral", port: "CHARGE" }, { setup: "neutral", port: "CHARGE_FLOW" }],
        checks: [
          { setup: "neutral", port: "CHARGE", level: "low" },
          { setup: "forward", port: "CHARGE", level: "low" },
          { setup: "neutral", port: "CHARGE_FLOW", level: "normal" },
          { setup: "forward", port: "CHARGE_FLOW", level: "normal" }
        ]
      },
      {
        id: "s_hprv_leak", correct: "hprv_leak_A", symptom: "weakOneWay",
        ports: ["A", "B"], steps: ["swapCartridges"], causes: ALL.slice(),
        mustView: [{ setup: "stallForward", port: "A" }, { setup: "stallReverse", port: "B" }],
        checks: [
          { setup: "stallForward", port: "A", level: "low" },
          { setup: "stallReverse", port: "B", level: "normal" },
          { setup: "stallForward", swap: true, port: "A", level: "normal" },
          { setup: "stallReverse", swap: true, port: "B", level: "low" }
        ]
      },
      {
        id: "s_bypass", correct: "bypass_open", symptom: "noDrive",
        ports: ["A", "B", "CHARGE", "SERVO"], causes: ALL.slice(),
        mustView: [{ setup: "forward", port: "A" }, { setup: "forward", port: "SERVO" }],
        checks: [
          { setup: "neutral", port: "CHARGE", level: "normal" },
          { setup: "forward", port: "A", level: "low" },
          { setup: "reverse", port: "B", level: "low" },
          { setup: "stallForward", port: "A", level: "low" },
          { setup: "forward", port: "SERVO", level: "normal" },
          { setup: "reverse", port: "SERVO", level: "normal" }
        ]
      },
      {
        id: "s_motor_worn", correct: "motor_worn", symptom: "bothWaysMayRunHot",
        ports: BOTH_WAYS_PORTS.slice(), steps: BOTH_WAYS_STEPS.slice(), causes: ALL.slice(),
        mustView: [{ setup: "forward", port: "MOTOR_CASE_FLOW" }],
        checks: [
          { setup: "forward", port: "MOTOR_CASE_FLOW", level: "high" },
          { setup: "reverse", port: "MOTOR_CASE_FLOW", level: "high" },
          { setup: "forward", port: "CHARGE", level: "low" },
          { setup: "neutral", port: "CHARGE", level: "normal" },
          { setup: "stallForward", port: "A", level: "low" },
          { setup: "stallReverse", port: "B", level: "low" }
        ]
      }
    ],
    /* every sentence below is reviewed against the fact base before release */
    text: {
      status: {
        off: "The engine is off, so the pumps are stopped and the loop is at rest. In this model the brake is applied whenever the engine is off.",
        brakeHeld: "The brake release is off, so this model returns the pump to neutral and then applies the brake. Switch the brake release on to drive.",
        neutral: "Neutral: the swashplate is centred and the motors are stopped. Charge oil fills both loop sides through both make-up checks.",
        reversing: "Reversing: the swashplate is moving back through neutral. In this simplified model, momentum is not modelled; the pressure sides swap as the swashplate passes centre.",
        slowing: "Slowing: the swashplate is moving back toward neutral. In this simplified model, momentum is not modelled, so the motors simply follow the swashplate.",
        forward: "Forward: side A carries high-pressure oil to the motors. Side B returns oil to the pump, and charge oil tops it up through its make-up check.",
        reverse: "Reverse: side B carries high-pressure oil to the motors. Side A returns oil to the pump, and charge oil tops it up through its make-up check.",
        noPressure: "The pump is stroked, but the loop cannot build pressure. The motors do not turn.",
        stall: "Stall: the motors are held, so side {hi} rises to the relief setting. Oil crosses through the relief to side {lo}, and that energy becomes heat.",
        stallLimiter: "Stall: the motors are held, and the pressure limiter moves the pump toward neutral. Side {hi} holds at the limiter setting with no relief flow.",
        stallLow: "Stall: the motors are held, but side {hi} stays below the relief setting."
      },
      diagnose: {
        off: "Test condition: engine off.",
        neutral: "Test condition: engine running, joystick in neutral.",
        forward: "Test condition: forward command.",
        reverse: "Test condition: reverse command.",
        forwardHeld: "Test condition: forward command with the motors held.",
        reverseHeld: "Test condition: reverse command with the motors held."
      },
      trace: {
        /* brakeHeld: neutral first, then the brake, is a simulator rule (SPEC), not the A19 valve,
           which drains the brake and neutralizes the pump together */
        off: ["A4", "A19", "B12"], brakeHeld: ["A19", "SPEC:3-2"], neutral: ["B1", "B2", "B3"], reversing: ["B7", "A3"],
        slowing: ["B5"], forward: ["B5", "B6", "A8"], reverse: ["B5", "B6", "A8"], noPressure: ["A21", "F9"],
        stall: ["B8", "B9", "B10", "A12"], stallLimiter: ["A11", "B9"], stallLow: ["F6", "F8"],
        heat: ["B10", "A12", "F1", "F2", "F8", "S3 p.27"], brakeDrive: ["A19"]
      },
      warnings: {
        heat: "Heat warning: this condition makes the oil run hot.",
        brakeDrive: "The drive is commanded while the brake release is off."
      },
      symptoms: {
        bothWaysMayRunHot: "The machine is sluggish in both directions and may run hot.",
        weakOneWay: "The machine drives normally in reverse but is weak in forward.",
        noDrive: "The machine will not drive in either direction."
      },
      steps: {
        swapCartridges: "Swap the side A and side B relief / make-up valves, if they are the same part with the same setting, then test again. If the weak direction moves to the other side, the valve is the cause.",
        defeatFlushing: "If the circuit has loop flushing, defeat it before measuring motor case drain flow."
      },
      faults: {
        charge_pump_worn: "Worn charge pump",
        charge_relief_stuck_open: "Charge relief valve stuck open",
        hprv_leak_A: "Leaking relief / make-up valve, side A",
        bypass_open: "Bypass valve left open",
        motor_worn: "Worn drive motor (internal leakage)"
      },
      ports: {
        A: "Loop A pressure",
        B: "Loop B pressure",
        CHARGE: "Charge pressure",
        SERVO: "Servo pressure (commanded side)",
        CHARGE_FLOW: "Charge pump flow (pump outlet, before the charge relief)",
        MOTOR_CASE_FLOW: "Motor case drain flow (both motors combined, before it joins the pump case drain)"
      },
      readingNote: "Example value \u2014 real values: manufacturer manual"
    }
  };
  try {
    if (root.SimCircuits && root.SimCircuits.register) root.SimCircuits.register(def);
    else (root.SimCircuitQueue = root.SimCircuitQueue || []).push(def);
  } catch (err) {
    (root.SimCircuitErrors = root.SimCircuitErrors || []).push(String(err && err.message));
    if (root.console && root.console.error) root.console.error(err);
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
