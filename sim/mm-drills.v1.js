/* Multimeter practice drills, v1: the drill half of mm-render.v1.js, loaded before it.
   Each drill of the board data becomes a shell scenario { id, symptom, correct, causes }: the task text is
   the symptom, the drill causes are the cause buttons. A drill starts from its preset, offers its own
   controls beside the meter keys, and a cause pick counts only once the need in the data is met, one step
   after the other (MmEngine.fits). Each reading taken goes in a log with its setup, the board controls and
   the example-value label. A fuse the visitor opens in a drill can be replaced there, so a drill never
   locks; where a step of the need is the lead check, the new test leads appear only after it.
   Owner phone check and a cold-read test (2026-11-20): the drill text is split into the task (#dg-symptom,
   board text.drills) and what the visitor sees (#dg-see, text.see); a status line (#dg-step) and a dock mark
   (#mm-done) say when the task reading is counted, and the log marks the reading that counted. On a phone the
   pick result scrolls to the middle of the screen, since it sits below the cause buttons and the dock.
   Also the category exercise (#cat-drill, page markup that stays hidden without this file): items with
   data-ok, buttons with data-v, and page feedback paragraphs [data-fb="ok"] and [data-fb="no"]. */
(function (root) {
  "use strict";

  var UI = { scenario: "Drill", report: "Your task", causeHead: "Pick what went wrong", cause: "What went wrong",
    more: "The task reading is not counted yet: put the setup right and take it, then pick what went wrong.", solved: "Right:",
    notIt: "Not what went wrong in this drill.", ifIt: "%s: if that were it, this example meter would show:",
    reveal: "Show what went wrong", revealed: "What went wrong in this drill:", pick: "Pick a drill to start." };
  var L = { reads: "Readings", jack: "red lead in the %s jack", range: "range", beep: "beeping", see: "What you see:",
    dial: "Not counted yet: this task reading is taken on %s.", dialOk: "Not counted yet: the dial is right; check the jack, the leads and the board buttons.",
    part: "%s of %t task readings counted.", or: " or ",
    done: "\u2713 Task reading counted. Now pick what went wrong below.", ok: "\u2713 Counted for the task", badge: "\u2713 Task done" };

  function sl(x) { return Array.prototype.slice.call(x); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /* the first step of a need met with the broken lead: the new test leads wait until it is met */
  function leadStep(d) {
    var k = -1;
    d.need.forEach(function (st, i) {
      if (k < 0 && st.some(function (e) { return !!e.when && e.when.leadBroken === true; })) k = i;
    });
    return k;
  }

  /* x: the renderer context (def, E, ID, fresh, inputs, probeOf, state, after, leadsText, shown, noteOf, mk,
     grp, ctlRow, cond); hooks: the shell hooks object, filled here with scenario and ready */
  function attach(x, hooks) {
    var def = x.def, E = x.E, T = def.text, ui = {};
    var scens = def.drills.map(function (d) { return { id: d.id, symptom: d.id, correct: d.correct, causes: d.causes.slice() }; });
    function drill(id) { var r = null; def.drills.forEach(function (d) { if (d.id === id) r = d; }); return r; }
    function leadsOk(d, s) { var k = leadStep(d); return k < 0 || s.step > k; }

    function setupText(s) {
      var m = s.meter, a = [T.dialNames[m.dial] + ", " + L.jack.replace("%s", T.jacks[m.jack])];
      if (m.dial === "dcv" && m.range !== "auto") a.push(T.ranges[m.range] + " " + L.range);
      return a.join(", ") + ". " + x.leadsText(s);
    }
    function condText(s) {
      var a = s.d.controls.filter(function (k) { return !!x.cond[k]; }).map(function (k) { return x.cond[k][s.ctl[k] ? 0 : 1]; });
      return a.length ? cap(a.join(", ")) + "." : "";
    }
    /* one log line per setup and board state; the same test again updates its line and moves it up */
    function record(s, r, ok) {
      var h = setupText(s), c = condText(s), key = h + "|" + c, it = s.items[key];
      if (!it) {
        it = s.items[key] = { li: x.mk("li", "sim-rd") };
        [["h", "sim-rd-h"], ["c", "sim-rd-c"], ["v", "sim-rd-v"], ["n", "sim-rd-note"]].forEach(function (q) {
          it[q[0]] = x.mk("p", q[1], null, null, it.li);
        });
      }
      it.h.textContent = h;
      it.c.textContent = c;
      it.v.textContent = x.shown(r, s) + (r.beep ? ", " + L.beep : "");
      it.n.textContent = x.noteOf(r, s);
      if (ok && !it.k) {
        it.k = x.mk("p", "sim-rd-k", L.ok);
        it.li.insertBefore(it.k, it.li.firstChild);
        it.li.className += " sim-rd-ok";
      }
      if (ui.reads.firstChild !== it.li) ui.reads.insertBefore(it.li, ui.reads.firstChild);
    }
    function seen(s, r) {
      var ok = false;
      if (r.cls !== "idle" && r.cls !== "off") {
        if (s.step < s.d.need.length && E.fits(x.ID, s.d.id, s.step, { inputs: x.inputs(s), meter: s.meter, probe: x.probeOf(s) }, r)) { s.step++; ok = true; }
        record(s, r, ok);
      }
      status(s);
    }
    /* how far the task is: a line under the task and, once it is counted, a mark in the dock. Until then the
       line names the dial the next task reading is taken on, or says the dial is right (second cold read,
       2026-11-20: a beginner could not tell what was still wrong); it never names the drill cause */
    function lc(w) { return /^[A-Z][a-z]/.test(w) ? w.charAt(0).toLowerCase() + w.slice(1) : w; }
    function hint(s, k) {
      var ds = [];
      s.d.need[k].forEach(function (e) { e.dial.forEach(function (v) { if (ds.indexOf(v) < 0) ds.push(v); }); });
      if (ds.indexOf(s.meter.dial) >= 0) return L.dialOk;
      return L.dial.replace("%s", ds.map(function (v) { return lc(T.dialNames[v]); }).join(L.or));
    }
    function status(s) {
      var n = s.d ? s.d.need.length : 0, k = Math.min(s.step || 0, n), done = n > 0 && k >= n;
      if (ui.step) {
        ui.step.textContent = !n ? "" : done ? L.done : (n > 1 ? L.part.replace("%s", k).replace("%t", n) + " " : "") + hint(s, k);
        ui.step.className = "sim-step" + (done ? " ok" : "");
      }
      if (ui.done) ui.done.hidden = !done;
    }

    hooks.scenario = function (sc) {
      var d = drill(sc.id), s = x.fresh(d), keys = d.controls.slice();
      ["replaceFuse", "replaceMeterFuse"].forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); });
      x.state(s);
      ui.ctl.textContent = "";
      x.ctlRow(ui.ctl, keys, null);
      ui.reads.textContent = "";
      if (ui.see) {
        var sv = T.see && T.see[d.id];
        ui.see.textContent = "";
        if (sv) { x.mk("strong", null, L.see, null, ui.see); ui.see.appendChild(root.document.createTextNode(" " + sv)); }
        ui.see.hidden = !sv;
      }
      x.after("");
      status(s);
    };
    hooks.ready = function () { var s = x.state(); return !!s.d && s.step >= s.d.need.length; };

    function bind(S) {
      var wk = S.el.work, doc = root.document;
      ui.ctl = doc.getElementById("dg-ctl") || x.mk("div", "mm-dctl", null, null, wk, "dg-ctl");
      if (!doc.getElementById("dg-reads")) {
        x.mk("h3", "sim-h3", L.reads, null, wk);
        x.mk("ul", "sim-reads", null, null, wk, "dg-reads");
      }
      ui.reads = doc.getElementById("dg-reads");
      var sym = doc.getElementById("dg-symptom"), disp = doc.querySelector("#mm-read .mm-disp"), cz = doc.getElementById("dg-causes");
      if (sym && !doc.getElementById("dg-see")) {
        sym.parentNode.insertBefore(x.mk("p", "sim-step", null, { "aria-live": "polite" }, null, "dg-step"), sym.nextSibling);
        sym.parentNode.insertBefore(x.mk("p", "sim-see", null, { hidden: "" }, null, "dg-see"), sym.nextSibling);
      }
      ui.see = doc.getElementById("dg-see");
      ui.step = doc.getElementById("dg-step");
      if (disp && !doc.getElementById("mm-done")) x.mk("p", "mm-done", L.badge, { hidden: "" }, disp, "mm-done");
      ui.done = doc.getElementById("mm-done");
      /* the pick result sits below the cause buttons: bring it into view; on a narrow screen (the width at which
         mm-std.css can fix the dock to the bottom edge) to the middle, so the dock never covers it */
      if (cz) cz.addEventListener("click", function () {
        var r = doc.getElementById("dg-result"), mq = root.matchMedia && root.matchMedia("(max-width: 899px)");
        if (r && !r.hidden && r.scrollIntoView) r.scrollIntoView({ block: mq && mq.matches ? "center" : "nearest" });
      });
      cat(doc);
    }
    return { scenarios: scens, ui: UI, seen: seen, leadsOk: leadsOk, bind: bind };
  }

  /* the category exercise: a pick presses its button and shows the matching page feedback */
  function cat(doc) {
    var box = doc.getElementById("cat-drill");
    if (!box) return;
    box.hidden = false;
    sl(box.querySelectorAll("[data-ok]")).forEach(function (q) {
      var bs = sl(q.querySelectorAll("button[data-v]"));
      bs.forEach(function (b) {
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", function () {
          var ok = b.getAttribute("data-v") === q.getAttribute("data-ok");
          bs.forEach(function (o) { o.setAttribute("aria-pressed", o === b ? "true" : "false"); });
          sl(q.querySelectorAll("[data-fb]")).forEach(function (p) { p.hidden = p.getAttribute("data-fb") !== (ok ? "ok" : "no"); });
        });
      });
    });
  }

  root.MmDrills = { version: 1, attach: attach, leadStep: leadStep, ui: UI, words: L };
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
