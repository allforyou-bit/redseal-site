/* Refrigeration cycle simulator renderer, v1 (design v1 sections 1, 3-6, with v2 and v2.1), on sim-shell.v1.js,
   RfcEngine and RfcDraw (loaded first).
   - Operate: system and knob rows in the dock; readouts, coil zones, outlet marks, needles and tags all come
     from RfcEngine.operate. Find the fault: shuffled scenes, one symptom, six tests (dock keys, or the clamps,
     gauges and fans), a log with the same test at set-up, seven shuffled causes; the drawing stays at set-up
     and shows only the tags of the tests taken.
   - Every text is a content sid (RfcContent): a missing one shows as [sid] and is listed in RfcRender.missing.
   - No state by colour alone; aria-pressed on keys. Motion: dash phase and fan turns, after Play under reduced
     motion, paused off screen. */
(function (root) {
  "use strict";

  var Dw = root.RfcDraw || {}, has = Dw.has, fill = Dw.fill, ZONES = Dw.zones, GAUGES = Dw.gauges, SWING = Dw.swing;
  /* every sid this file uses beside those of the engine and the drawing */
  var USED = ["mode.explore", "mode.operate", "mode.fault", "panel.explore", "panel.operate", "panel.fault", "hint.explore",
    "hint.operate", "hint.fault", "ui.mode_group", "ui.pause", "ui.play", "ui.rm", "ui.fail", "ui.details", "ctl.md", "ctl.charge",
    "ctl.evap_air", "ctl.cond_air", "key.FX", "key.TX", "key.less", "key.more", "key.cooler", "key.warmer", "key.setup",
    "note.example", "note.model", "note.band", "note.setup_ref", "note.same_test", "note.example_input", "note.relative",
    "fault.scenes", "fault.scene", "fault.system", "fault.symptom_head", "fault.tests_head", "fault.reads_head",
    "fault.causes_head", "fault.causes_group", "fault.not_every", "fault.pick", "fault.reveal", "fault.why_head",
    "fault.out_mark", "fault.open_mark", "fault.drawing"];
  var R = root.RfcRender = { version: 1, sids: function () { return USED.slice().sort(); }, missing: [] };

  var doc = root.document;
  if (!doc || !doc.getElementById) return;

  var MODES = ["explore", "operate", "fault"], FX = "fault", RATE = 0.012;
  var KEYS = { charge: ["key.less", "key.setup", "key.more"], evapAir: ["key.cooler", "key.setup", "key.warmer"], condAir: ["key.cooler", "key.setup", "key.warmer"] };
  var ROW = { charge: "ctl.charge", evapAir: "ctl.evap_air", condAir: "ctl.cond_air" };
  var Sh, E, S, app, sv, C = {}, ui = {}, rows = {}, op, prevOp = null, fs = null, seed = 0, num = {}, solved = {};
  var anim = { dots: 0, fanC: 0, fanE: 0 }, motion = null, raf = 0, last = 0, started = false;
  var all, flag, press, text, make, closest;

  function t(sid) {
    var s = C[sid];
    if (typeof s === "string") return s;
    if (R.missing.indexOf(sid) < 0) R.missing.push(sid);
    return "[" + sid + "]";
  }
  function ft(sid, slots) { return fill(t, sid, slots); }
  function byId(id) { return doc.getElementById(id); }
  function mk(tag, cls, s, a, parent, id) {
    var n = make(tag, cls, s), j;
    for (j in a || {}) if (has(a, j)) n.setAttribute(j, a[j]);
    if (tag === "button") n.type = "button";
    if (id) n.id = id;
    if (parent) parent.appendChild(n);
    return n;
  }
  function grp(label, parent, cls, id) { return mk("div", cls || "sim-row", null, { role: "group", "aria-label": label }, parent, id); }
  function key(s, a, parent) { a["aria-pressed"] = "false"; return mk("button", "sim-tog", s, a, parent); }
  function unit(it) { return it.unit ? " " + it.unit : ""; }

  /* ---------- the drawing ---------- */
  function paintSvg(v, md) {
    flag(sv, "md-FX", md === "FX"); flag(sv, "md-TX", md !== "FX");
    flag(sv, "zoned", !!v.zones); flag(sv, "neutral", !v.zones);
    flag(sv, "flash", v.flags.flash); flag(sv, "wet", v.flags.wet);
    if (v.zones) ["cond", "evap"].forEach(function (c) {
      var at = 0;
      ZONES[c].forEach(function (q) {
        var len = Math.max(0, v.zones[q[0]] * 100), a = (len.toFixed(2) + " 200"), o = (-at).toFixed(2);
        all(sv, "[data-z=\"" + q[0] + "\"]").forEach(function (n) {
          if (n.getAttribute("stroke-dasharray") !== a) n.setAttribute("stroke-dasharray", a);
          if (n.getAttribute("stroke-dashoffset") !== o) n.setAttribute("stroke-dashoffset", o);
        });
        at += len;
      });
    });
    ["Te", "Tc", "T1", "T3", "ai", "aeo", "amb", "aco"].forEach(function (k) {
      var n = byId("rfc-tag-" + k);
      if (n) text(n, v.tags[k] == null ? "" : v.tags[k] + " " + E.units.deg);
    });
    Object.keys(GAUGES).forEach(function (id) {
      var g = GAUGES[id], n = byId("rfc-n-" + g.k), x = v.tags["n" + g.k], tr;
      if (!n) return;
      flag(n, "unk", x == null);
      tr = "rotate(" + ((x || 0) * SWING).toFixed(2) + " " + g.cx + " " + g.cy + ")";
      if (n.getAttribute("transform") !== tr) n.setAttribute("transform", tr);
    });
    motion = v.motion;
    loop();
  }
  function paintAnim() {
    sv.style.setProperty("--ph", (-(anim.dots % 14)).toFixed(2));
    [["fanC", 46, 40], ["fanE", 350, 372]].forEach(function (f) {
      var b = byId("rfc-b-" + f[0]);
      if (b) b.setAttribute("transform", "rotate(" + anim[f[0]].toFixed(1) + " " + f[1] + " " + f[2] + ")");
    });
  }
  function frame(ts) {
    raf = 0;
    var dt = last ? ts - last : 0;
    last = ts;
    if (motion && S.moving() && !app.classList.contains("sim-away")) { anim = E.step(anim, motion, dt, RATE); paintAnim(); }
    loop();
  }
  function loop() {
    if (motion && S && S.moving() && typeof root.requestAnimationFrame === "function") { if (!raf) raf = root.requestAnimationFrame(frame); }
    else last = 0;
  }

  /* ---------- Operate ---------- */
  /* a value with its shown subtraction; a relative reading (amps, cooling) is a bar and a word, no figure */
  function valText(it) { return it.bar != null ? "" : (it.calc ? calcText(it.calc) : "") + it.text + unit(it); }
  function setText(it) { return it.bar != null ? "" : (it.setupCalc ? calcText(it.setupCalc) : "") + it.setup + unit(it); }
  function bar(it, parent) {
    var g = mk("div", "sim-gauge", null, { "aria-hidden": "true" }, parent);
    mk("div", "sim-gauge-f", null, null, g).style.width = (Math.min(1, it.bar) * 100).toFixed(1) + "%";
    mk("div", "sim-gauge-n", null, null, g).style.left = (Math.min(1, it.barSetup) * 100).toFixed(1) + "%";
  }
  /* the shown subtraction; a negative second term goes in brackets */
  function calcText(c) { var m = E.units.minus, b = c[1].charAt(0) === m ? "(" + c[1] + ")" : c[1]; return c[0] + " " + m + " " + b + " = "; }
  function paintRow(it) {
    var r = rows[it.id];
    if (!r) return;
    text(r.v, valText(it));
    text(r.w, it.wordSid ? t(it.wordSid) : it.input ? t("note.example_input") : "");
    r.w.className = "rfc-w" + (it.word ? " w" + (it.word === "+" ? "p" : it.word === "-" ? "m" : "0") : "");
    text(r.s, it.bar != null ? "" : t("note.setup_ref") + " " + setText(it));
    if (r.bar) {
      r.bar.f.style.width = (Math.min(1, it.bar) * 100).toFixed(1) + "%";
      r.bar.n.style.left = (Math.min(1, it.barSetup) * 100).toFixed(1) + "%";
    }
  }
  /* the live region, and its copy at the top of the dock (aria-hidden, shown on phones only) */
  function say(s, w, m) { S.say(s, w); text(ui.mt, m == null ? s : m); text(ui.mw, w.join(" ")); ui.mw.hidden = !w.length; }
  /* the dock copy leaves out the state line, which the pressed keys under it already show */
  function sayStatus(list, msg) {
    var main = [], warn = [], short = [];
    list.forEach(function (x) { var s = ft(x.sid, x.slots); (x.warn ? warn : main).push(s); if (!x.warn && x.sid !== "status.op") short.push(s); });
    say((msg ? msg + " " : "") + main.join(" "), warn, short.join(" "));
  }
  function paintOp(quiet) {
    var v = E.operate(op, prevOp);
    paintSvg(v, op.md);
    v.items.forEach(function (it) { paintRow(it); });
    pressAll();
    if (!quiet) sayStatus(v.status, "");
    prevOp = E.normOp(op);
    return v;
  }
  function setOp(k, x) {
    if (k === "md") op.md = x; else op[k] = +x;
    paintOp(false);
  }

  /* ---------- Find the fault ---------- */
  function paintFault() {
    if (!fs) { paintSvg(E.faultView(E.start(E.scenes()[0])), "TX"); pressAll(); return; }
    paintSvg(E.faultView(fs), "TX");
    pressAll();
  }
  function logReading(rd) {
    var id = "rfc-log-" + rd.test, li = byId(id);
    if (!li) li = mk("li", "sim-rd", null, null, null, id);
    li.textContent = "";
    mk("p", "sim-rd-h", t(rd.name), null, li);
    rd.items.forEach(function (it) {
      var q = mk("p", "sim-rd-v", null, null, li);
      q.appendChild(doc.createTextNode(t(it.name) + (it.bar != null ? "" : ": " + valText(it))));
      if (it.wordSid || it.input) mk("span", "rfc-w" + (it.wordSid ? " w" + (it.word === "+" ? "p" : it.word === "-" ? "m" : "0") : ""), t(it.wordSid || "note.example_input"), null, q);
      if (it.bar != null) bar(it, li);
      else mk("p", "sim-rd-r", t("note.same_test") + " " + setText(it), null, li);
    });
    if (ui.reads.firstChild !== li) ui.reads.insertBefore(li, ui.reads.firstChild);
    return t(rd.name) + ": " + rd.items.map(function (it) { return t(it.name) + (it.bar != null ? "" : " " + valText(it)) + (it.wordSid ? ", " + t(it.wordSid) : ""); }).join("; ");
  }
  function runTest(k) {
    if (!fs || S.mode() !== FX) return;
    var r = E.test(fs, k);
    fs = r.fs;
    var s = logReading(r.reading), w = r.reading.warn.map(function (x) { return t(x.sid); });
    w.forEach(function (x) { mk("p", "sim-warn", x, null, byId("rfc-log-" + k)); });
    if (ui.need && E.canPick(fs)) { ui.result.hidden = ui.reveal.hidden = true; ui.need = false; }
    paintFault();
    say(s, w);
  }
  function result(kind, verdict, reply, why) {
    ui.need = false;
    ui.result.className = "sim-result" + (kind ? " " + kind : "");
    text(ui.verdict, verdict);
    ui.more.textContent = "";
    if (why && reply.length) mk("h4", null, t("fault.why_head"), null, ui.more);
    reply.forEach(function (x) { mk("p", null, ft(x.sid, x.slots), null, ui.more); });
    ui.result.hidden = false;
  }
  function mark(b, cls, sid) {
    flag(b, cls, true);
    if (!b.querySelector(".rfc-mk")) mk("span", "rfc-mk", " " + t(sid), null, b);
  }
  function lockCauses() { all(ui.causes, "[data-cause]").forEach(function (b) { b.disabled = true; }); }
  function pickCause(c, b) {
    if (!fs) return;
    var r = E.pick(fs, c), v = r.verdict ? ft(r.verdict.sid, r.verdict.slots) : "";
    fs = r.fs;
    if (r.kind === "done") return;
    if (r.kind === "need") { result("", v, [], false); ui.reveal.hidden = false; ui.need = true; say(v, []); keep(); return; }
    if (r.kind === "solve") {
      lockCauses();
      result("ok", v, r.reply, true);
      ui.reveal.hidden = true;
      if (ui.offer) ui.offer.hidden = !ui.offer.firstChild;
      if (!solved[r.solved]) { solved[r.solved] = true; Sh.dom.ga("fault_solved", { placement: "sim_" + r.solved, trade: app.getAttribute("data-trade") || "multi" }); }
    } else if (r.kind === "not_ruled_out") {
      mark(b, "rfc-open", "fault.open_mark");
      result("", v, r.reply, false);
    } else {
      b.disabled = true;
      mark(b, "rfc-out", "fault.out_mark");
      result("no", v, r.reply, false);
      ui.reveal.hidden = false;
    }
    say(v, []);
    keep();
  }
  /* after say() (the status above resizes; WebKit has no scroll anchoring): a pick that disables the focused
     button or hides Show the cause moves focus to the result; then the result, its verdict below the site menu */
  function keep() {
    var a = doc.activeElement;
    if (!a || a === doc.body || a.disabled || a.hidden) ui.result.focus({ preventScroll: true });
    if (ui.result.scrollIntoView) { ui.result.scrollIntoView({ block: "nearest" }); var q = ui.verdict.getBoundingClientRect(); if (q.top < 64) root.scrollBy(0, q.top - 64); }
  }
  function reveal() {
    if (!fs) return;
    var r = E.reveal(fs);
    fs = r.fs;
    if (r.kind === "done") return;
    lockCauses();
    var v = ft(r.verdict.sid, r.verdict.slots);
    result("", v, r.reply, true);
    ui.reveal.hidden = true;
    say(v, []);
    keep();
  }
  function pickScene(id, btn) {
    fs = E.start(id);
    all(ui.scen, "button").forEach(function (b) { press(b, b === btn); });
    ui.reads.textContent = "";
    ui.result.hidden = true; ui.reveal.hidden = true;
    if (ui.offer) ui.offer.hidden = true;
    /* the causes in a new shuffled order for every pick, so the place of a button tells nothing */
    var bs = all(ui.causes, "[data-cause]");
    Sh.order(bs.length, (seed + num[id] * 7919) >>> 0).forEach(function (j) { ui.causes.appendChild(bs[j]); });
    bs.forEach(function (b) {
      b.disabled = false; flag(b, "rfc-out", false); flag(b, "rfc-open", false);
      var m = b.querySelector(".rfc-mk"); if (m) b.removeChild(m);
    });
    text(byId("dg-symptom"), t(fs.symptom));
    ui.caseBox.hidden = false;
    paintFault();
    S.setRoles();
    say(t("fault.scene") + " " + num[id] + ". " + t("fault.symptom_head") + ": " + t(fs.symptom), []);
  }

  /* ---------- keys and panels ---------- */
  function pressAll() {
    var m = S ? S.mode() : "operate";
    all(ui.dock, "[data-md]").forEach(function (b) { press(b, b.getAttribute("data-md") === op.md); });
    all(ui.dock, "[data-knob]").forEach(function (b) { press(b, +b.getAttribute("data-v") === op[b.getAttribute("data-knob")]); });
    all(ui.dock, "[data-test]").forEach(function (b) { press(b, !!fs && fs.taken.indexOf(b.getAttribute("data-test")) >= 0); b.disabled = !fs; });
    flag(ui.dock, "rfc-nofs", !fs);
    ui.opk.hidden = m !== "operate";
    ui.fxk.hidden = m !== FX;
  }
  /* the Find the fault panel, unless the page has it */
  function buildFault(pf) {
    ui.scen = byId("dg-scen") || grp(t("fault.scenes"), pf, "sim-row", "dg-scen");
    ui.caseBox = byId("dg-case");
    if (!ui.caseBox) {
      ui.caseBox = mk("div", null, null, { hidden: "" }, pf, "dg-case");
      mk("p", "sim-dgnote", t("fault.system"), null, ui.caseBox);
      mk("p", "sim-dgnote", t("fault.drawing"), null, ui.caseBox);
      mk("h3", "sim-h3", t("fault.symptom_head"), null, ui.caseBox);
      mk("p", "sim-symptom", null, null, ui.caseBox, "dg-symptom");
      mk("h3", "sim-h3", t("fault.reads_head"), null, ui.caseBox);
      mk("ul", "sim-reads", null, null, ui.caseBox, "dg-reads");
      mk("p", "sim-rd-note", t("note.example"), null, ui.caseBox);
      mk("h3", "sim-h3", t("fault.causes_head"), null, ui.caseBox);
      mk("p", "sim-dgnote", t("fault.not_every"), null, ui.caseBox);
      var cz = grp(t("fault.causes_group"), ui.caseBox, "sim-col", "dg-causes");
      E.causes.forEach(function (c) { mk("button", "sim-cause", t("cause." + c), { "data-cause": c }, cz); });
      var rs = mk("div", "sim-result", null, { hidden: "" }, ui.caseBox, "dg-result");
      mk("p", "sim-verdict", null, null, rs, "dg-verdict"); mk("div", null, null, null, rs, "dg-more");
      mk("button", "sim-btn", t("fault.reveal"), { hidden: "" }, rs, "dg-reveal");
    }
    ["reads:dg-reads", "causes:dg-causes", "result:dg-result", "verdict:dg-verdict", "more:dg-more", "reveal:dg-reveal"].forEach(function (x) {
      x = x.split(":"); ui[x[0]] = byId(x[1]);
      if (!ui[x[0]]) throw new Error("missing #" + x[1]);
    });
    ui.result.setAttribute("tabindex", "-1");
    ui.offer = byId("sim-offer");
    if (ui.offer && ui.offer.parentNode !== ui.caseBox) ui.caseBox.appendChild(ui.offer);
    Sh.order(E.scenes().length, seed).forEach(function (j, i) {
      var id = E.scenes()[j], b = key(t("fault.scene") + " " + (i + 1), {}, ui.scen);
      num[id] = i + 1;
      b.addEventListener("click", function () { pickScene(id, b); });
    });
  }
  function build() {
    var side = S.el.side, P = S.el.panels;
    /* no sim-dock class: the shared sheet fixes a .sim-dock inside an Operate panel (another page) */
    ui.dock = byId("sim-dock") || mk("div", "rfc-dock", null, null, null, "sim-dock");
    if (!ui.dock.parentNode) { var fp = side.querySelector("[data-panel]"); side.insertBefore(ui.dock, fp && fp.parentNode === side ? fp : null); }
    var mir = mk("div", "rfc-mirror", null, { "aria-hidden": "true" });
    ui.dock.insertBefore(mir, ui.dock.firstChild);
    ui.mt = mk("p", null, null, null, mir); ui.mw = mk("p", "sim-warn", null, { hidden: "" }, mir);
    /* --rfc-dh: the tallest the dock has been, for the space kept for it on phones (rfc-std.css); rfc-tall: a dock
       over 45 % of the screen (large text) stays in the page. Both only grow, so the dock never moves itself */
    var dh = 0;
    if (root.ResizeObserver) new root.ResizeObserver(function () {
      var h = ui.dock.offsetHeight;
      if (h > dh) doc.documentElement.style.setProperty("--rfc-dh", (dh = h) + "px");
      if (h > root.innerHeight * 0.45) flag(app, "rfc-tall", true);
    }).observe(ui.dock);
    ui.opk = byId("rfc-opkeys") || grp(t("panel.operate"), ui.dock, "rfc-keys", "rfc-opkeys");
    if (!ui.opk.firstChild) {
      var g = grp(t("ctl.md"), ui.opk, "rfc-krow");
      mk("span", "rfc-kl", t("ctl.md"), { "aria-hidden": "true" }, g);
      E.mds.forEach(function (md) { key(t("key." + md), { "data-md": md }, g); });
      E.knobs.forEach(function (k) {
        var r = grp(t(ROW[k]), ui.opk, "rfc-krow");
        mk("span", "rfc-kl", t(ROW[k]), { "aria-hidden": "true" }, r);
        E.levels.forEach(function (v, i) { key(t(KEYS[k][i]), { "data-knob": k, "data-v": String(v) }, r); });
      });
    }
    ui.fxk = byId("rfc-fxkeys") || grp(t("fault.tests_head"), ui.dock, "rfc-keys rfc-tests", "rfc-fxkeys");
    if (!ui.fxk.firstChild) E.tests.forEach(function (k) { key(t("test." + k), { "data-test": k }, ui.fxk); });
    var po = P.operate;
    if (!byId("rfc-reads")) {
      var ul = mk("ul", "rfc-reads", null, null, po, "rfc-reads");
      E.operateReadouts.forEach(function (id) {
        var li = mk("li", "rfc-rd", null, { "data-rd": id }, ul);
        mk("p", "rfc-rd-n", t(E.rdName(id)), null, li);
        var v = mk("p", "rfc-rd-v", null, null, li);
        mk("span", "v", null, null, v); mk("span", "rfc-w", null, null, v);
        mk("p", "rfc-rd-s", null, null, li);
        if (id === "amps" || id === "cap") {
          var gg = mk("div", "sim-gauge", null, { "aria-hidden": "true" }, li);
          mk("div", "sim-gauge-f", null, null, gg); mk("div", "sim-gauge-n", null, null, gg);
        }
      });
      ["note.relative", "note.band", "note.example", "note.model"].forEach(function (s) { mk("p", "sim-rd-note", t(s), null, po); });
    }
    all(byId("rfc-reads"), "li[data-rd]").forEach(function (li) {
      var q = li.querySelector(".sim-gauge");
      rows[li.getAttribute("data-rd")] = { v: li.querySelector(".v"), w: li.querySelector(".rfc-w"), s: li.querySelector(".rfc-rd-s"),
        bar: q ? { f: q.querySelector(".sim-gauge-f"), n: q.querySelector(".sim-gauge-n") } : null };
    });
    if (P[FX]) buildFault(P[FX]);
    if (!S.el.fig.querySelector(".sim-key")) {
      var lg = mk("ul", "sim-key rfc-key", null, { "aria-label": t("legend.group") }, S.el.fig);
      Dw.legend.forEach(function (x) {
        var li = mk("li", null, null, null, lg);
        mk("span", "rfc-sw " + x[0], null, { "aria-hidden": "true" }, li);
        li.appendChild(doc.createTextNode(t(x[1])));
      });
    }
    if (!doc.querySelector(".sim-parts")) {
      var pc = mk("div", "sim-parts", null, { hidden: "" }, app.parentNode || doc.body, "rfc-parts");
      Dw.parts.forEach(function (id) {
        var a = mk("article", "sim-part", null, { "data-part": id }, pc);
        mk("h3", null, t("part." + id + ".name"), null, a);
        mk("p", null, t("part.head.does") + " " + t("part." + id + ".does"), null, a);
        mk("p", null, t("part.head.fails") + " " + t("part." + id + ".fails"), null, a);
      });
    }
    app.addEventListener("click", function (ev) {
      var b = closest(ev.target, "[data-md],[data-knob],[data-cause],#dg-reveal,.sim-tog[data-test]");
      if (!b || b.disabled) return;
      if (b.hasAttribute("data-md")) setOp("md", b.getAttribute("data-md"));
      else if (b.hasAttribute("data-knob")) setOp(b.getAttribute("data-knob"), b.getAttribute("data-v"));
      else if (b.hasAttribute("data-cause")) pickCause(b.getAttribute("data-cause"), b);
      else if (b.id === "dg-reveal") reveal();
      else runTest(b.getAttribute("data-test"));
    });
  }

  /* ---------- shell hooks ---------- */
  function onMode(m) {
    var at = m === FX ? ui.scen : S.el.panels[m].querySelector(".sim-hint");
    ui.dock.hidden = m === "explore";
    if (at && at.nextSibling !== ui.dock) at.parentNode.insertBefore(ui.dock, at.nextSibling);
    if (m === FX) { paintFault(); say(fs ? "" : t("fault.pick"), []); }
    else { paintOp(m === "explore"); if (m === "explore") say("", []); }
  }
  function roleLabel(g, m) { var k = g.getAttribute("data-test"); return k && m === FX && fs ? t("test." + k) : null; }
  function activate(g, m) { var k = g.getAttribute("data-test"); if (k && m === FX) runTest(k); }

  function fail(err) {
    if (Sh && Sh.fail) { Sh.fail(app, err); return; }
    var f = byId("sim-fail");
    if (f) f.hidden = false;
    if (app) app.setAttribute("data-sim", "failed");
  }
  function pageSeed() {
    var s = Sh.seedOf(root.location && root.location.search);
    if (s != null) return s;
    try { if (root.crypto && root.crypto.getRandomValues) { var u = new Uint32Array(1); root.crypto.getRandomValues(u); return u[0]; } } catch (e) { /* below */ }
    return Math.floor(Math.random() * 4294967296);
  }

  /* start once the table and the content are in: by itself on a page whose data files load first, or
     through RfcRender.init({ content }) from a page that fetches them */
  function init(o) {
    if (started) return;
    app = byId("sim-app");
    if (!app) return;
    Sh = root.SimShell; E = root.RfcEngine;
    var c = (o && o.content) || root.RfcContent;
    if (!c || !E || !E.ready() || !Sh || !Sh.create || !Dw.svg) { if (o) fail(null); return; }
    started = true;
    C = c.sentences || c;
    try {
      all = Sh.dom.all; flag = Sh.dom.flag; press = Sh.dom.press; text = Sh.dom.text; make = Sh.dom.make; closest = Sh.dom.closest;
      seed = pageSeed();
      op = E.normOp({});
      var names = { modes: {}, panels: {}, hints: {} };
      MODES.forEach(function (m) { names.modes[m] = t("mode." + m); names.panels[m] = t("panel." + m); names.hints[m] = t("hint." + m); });
      S = Sh.create({
        app: app, modes: E.hasFault() ? MODES : MODES.slice(0, 2), start: "operate", scenarioMode: "rfc-own",
        trade: app.getAttribute("data-trade") || "multi", targets: "[data-info], [data-test]", names: names,
        ui: { modeGroup: t("ui.mode_group"), pause: t("ui.pause"), play: t("ui.play"), rm: t("ui.rm"), fail: t("ui.fail"), details: t("ui.details") },
        hooks: { mode: onMode, label: roleLabel, activate: activate, motion: function (on) { if (on) loop(); else last = 0; } }
      });
      /* a bare page: the drawing goes in from the markup of rfc-draw.v1.js */
      if (!S.el.fig.querySelector("svg.sim-svg")) {
        var parsed = new root.DOMParser().parseFromString(Dw.svg(t).replace("<svg ", "<svg xmlns=\"http://www.w3.org/2000/svg\" "), "image/svg+xml");
        S.el.fig.insertBefore(doc.importNode(parsed.documentElement, true), S.el.fig.firstChild);
      }
      sv = S.el.fig.querySelector("svg.sim-svg");
      if (!sv || !sv.querySelector("[data-z]")) { fail(null); return; }
      S.setSvg(sv);
      build();
      S.start();
    } catch (err) {
      fail(err);
    }
  }
  R.init = init;
  R.state = function () { return { op: op ? E.normOp(op) : null, fs: fs ? JSON.parse(JSON.stringify(fs)) : null, mode: S ? S.mode() : null }; };

  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", function () { init(null); });
  else init(null);
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
