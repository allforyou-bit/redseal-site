/* Example gearset for the planetary gear set simulator, v1 (planetary-design-v1-20261105.md sections 1 and 6).
   One simple planetary gear set: a sun gear of 30 teeth, a ring gear of 72 teeth and three equally spaced
   planet gears of 21 teeth on one carrier. These are example tooth counts, not the gears of any real
   transmission.
   Find the fault uses an example two-range unit built on the same set: the input shaft drives the sun and
   the output shaft is the carrier. In Low a band holds the ring; in Direct a locking clutch locks the sun
   to the ring; in Neutral nothing is applied. Every model value below (load torques, capacities, the worn
   factor, the pressure factors and the slip speeds of the animation) is a model value for this example
   only and is never printed. */
(function (root) {
  "use strict";
  var all = ["f_band_worn", "f_band_leak", "f_band_none", "f_clutch_worn", "f_clutch_leak", "f_clutch_none", "f_supply_low"];
  var def = {
    id: "pgs-simple",
    teeth: { S: 30, R: 72, P: 21 },
    planets: 3,
    defaults: { input: "S", hold: "R", lock: null },
    unit: {
      input: "S", output: "C",
      ranges: { N: {}, L: { hold: "R", device: "band" }, D: { lock: "SR", device: "clutch" } },
      start: { range: "L", load: "light" }
    },
    model: {
      load: { light: 0.4, heavy: 1.0 },
      capacity: { band: 3.0, clutch: 1.0 },
      worn: 0.55,
      pressure: { normal: 1, low: 0.6, none: 0 },
      slipRing: -0.15,
      slipLag: 0.8,
      rate: 0.06
    },
    faults: [
      { id: "f_band_worn", device: "band", kind: "worn" },
      { id: "f_band_leak", device: "band", kind: "leak" },
      { id: "f_band_none", device: "band", kind: "none" },
      { id: "f_clutch_worn", device: "clutch", kind: "worn" },
      { id: "f_clutch_leak", device: "clutch", kind: "leak" },
      { id: "f_clutch_none", device: "clutch", kind: "none" },
      { id: "f_supply_low", device: "supply", kind: "low" }
    ],
    scenarios: [],
    text: {
      members: { S: "sun gear", R: "ring gear", C: "planet carrier" },
      short: { S: "sun", R: "ring", C: "carrier" },
      faults: {
        f_band_worn: "Band lining worn",
        f_band_leak: "Band apply piston seal leaking",
        f_band_none: "Band not applying (no apply pressure reaches it)",
        f_clutch_worn: "Locking clutch friction worn",
        f_clutch_leak: "Locking clutch piston seal leaking",
        f_clutch_none: "Locking clutch not applying (no apply pressure reaches it)",
        f_supply_low: "Low line pressure from the supply (pump or main regulator)"
      },
      symptoms: {
        lowSlips: "Direct is normal; in Low the unit drives a light load but slips under a heavy load.",
        lowNone: "No drive in Low; Direct is normal.",
        directSlips: "Low is normal; in Direct the unit drives a light load but slips under a heavy load.",
        directNone: "No drive in Direct; Low is normal.",
        bothSlip: "Under a heavy load the unit slips in both Low and Direct; with a light load both ranges drive."
      },
      symptomOf: {
        f_band_worn: "lowSlips", f_band_leak: "lowSlips", f_band_none: "lowNone",
        f_clutch_worn: "directSlips", f_clutch_leak: "directSlips", f_clutch_none: "directNone",
        f_supply_low: "bothSlip"
      }
    }
  };
  all.forEach(function (f) {
    def.scenarios.push({ id: "sc_" + f.slice(2), correct: f, causes: all.slice(), symptom: def.text.symptomOf[f] });
  });
  if (root.PgsEngine) root.PgsEngine.register(def);
  else (root.PgsSetQueue = root.PgsSetQueue || []).push(def);
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
