/* Simulator shell, v1.
   The generic half of a simulator page, driven by a config object: the mode bar, the dock on narrow
   screens, Pause and Play, Explore part details, the shuffled scenario picker, the cause buttons, the
   verdict and the offer card. No circuit, engine or drawing code: the renderer passes names and hooks
   and paints the drawing itself. dc-render.v1.js is the first user; the hydrostatic drive page keeps
   sim-render.v1.js, which holds its own copy of these parts. Rules (as in sim-render.v1.js):
   - Animation changes classes, transforms and CSS variables only. Under prefers-reduced-motion motion
     waits for Play, and the Play button never goes grey.
   - The scenario and its cause never reach the page: "Scenario N" buttons with no ids, and the causes of
     a scenario in a shuffled order. A new pick clears the earlier verdict.
   - GA4 events only through an existing gtag, with the registered parameters only.
   Markup: each id is looked up first and built only when missing, so a page can ship the full markup or
   a bare section.sim-app#sim-app: .sim-bar (.sim-mode[data-mode], #sim-pause, #sim-rm), .sim-grid
   (.sim-fig, .sim-side), #sim-live (#sim-status, #sim-warn), #sim-fail, [data-panel] per mode,
   #sim-info-body, #dg-scen, #dg-case (#dg-symptom, #dg-work, #dg-causes, #dg-result, #sim-offer),
   #sim-end. Explanations come from the page: #tbl-faults td[data-k], .sim-why p[data-k].
   Hooks: mode(m), scenario(sc), ready(sc), label(node, m), activate(node, m), motion(on), solved(id). */
(function (root) {
  "use strict";

  /* ---------- pure helpers, also exported for the node tests ---------- */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* display order of n items for one seed (Fisher-Yates) */
  function order(n, seed) {
    var r = rng(seed), out = [], i, j, x;
    for (i = 0; i < n; i++) out.push(i);
    for (i = n - 1; i > 0; i--) { j = Math.floor(r() * (i + 1)); x = out[i]; out[i] = out[j]; out[j] = x; }
    return out;
  }
  /* class of one drawing group: base classes, plus the state and the moving marks when a view is given.
     states: the state names the engine reports (anything else is ignored). A null view (fault scenarios)
     keeps the base only. */
  function lineClass(base, l, states) {
    var c = base;
    if (l && typeof l.state === "string" && (!states || states.indexOf(l.state) >= 0)) {
      c += " st-" + l.state;
      if (l.dir) c += " mv" + (l.dir < 0 ? " rev" : "");
    }
    return c;
  }
  /* ?seed=N in a location search string fixes the scenario order (tests); null when absent */
  function seedOf(search) {
    var m = /[?&]seed=(\d{1,9})(?:&|$)/.exec(search || "");
    return m ? +m[1] : null;
  }
  var api = root.SimShell = { version: 1, rng: rng, order: order, lineClass: lineClass, seedOf: seedOf };

  var doc = root.document;
  if (!doc || !doc.getElementById) return;

  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function copy(o) { var r = {}, k; for (k in o) if (has(o, k)) r[k] = o[k]; return r; }
  function byId(id) { return doc.getElementById(id); }
  function all(scope, sel) { return Array.prototype.slice.call(scope.querySelectorAll(sel)); }
  function closest(node, sel) {
    while (node && node.nodeType === 1) {
      if (node.matches && node.matches(sel)) return node;
      node = node.parentNode;
    }
    return null;
  }
  function flag(e, name, on) { if (e && e.classList.contains(name) !== !!on) e.classList.toggle(name, !!on); }
  function press(b, on) { if (b) b.setAttribute("aria-pressed", on ? "true" : "false"); }
  function ga(name, params) {
    try { if (typeof root.gtag === "function") root.gtag("event", name, params); } catch (e) { /* never break the page */ }
  }
  function text(node, s) { if (node && node.textContent !== s) node.textContent = s; }
  function make(tag, cls, s) {
    var n = doc.createElement(tag);
    if (cls) n.className = cls;
    if (s != null) n.textContent = s;
    return n;
  }
  function button(cls, s, attrs) {
    var b = make("button", cls, s), k;
    b.type = "button";
    for (k in attrs || {}) if (has(attrs, k)) b.setAttribute(k, attrs[k]);
    return b;
  }
  /* a group of buttons with a name for screen readers */
  function group(tag, cls, label) {
    var g = make(tag, cls);
    g.setAttribute("role", "group");
    g.setAttribute("aria-label", label);
    return g;
  }
  /* the element with this id, or a new one placed in parent (before a child of parent, when given) */
  function need(id, parent, tag, cls, before) {
    var n = byId(id);
    if (n) return n;
    n = make(tag, cls);
    n.id = id;
    parent.insertBefore(n, before && before.parentNode === parent ? before : null);
    return n;
  }
  /* a <p> holding copies of the sentence spans of a page element */
  function para(src) {
    var p = make("p");
    if (src) for (var c = src.firstChild; c; c = c.nextSibling) p.appendChild(c.cloneNode(true));
    return p;
  }
  api.dom = { has: has, copy: copy, byId: byId, all: all, closest: closest, flag: flag, press: press, ga: ga,
    text: text, make: make, button: button, group: group, need: need, para: para };

  var UI = {
    modeGroup: "Simulator mode", pause: "Pause animation", play: "Play animation",
    rm: "This device asks for reduced motion, so the animation waits for Play.",
    fail: "The simulator could not start in this browser. The text below still works.",
    pick: "Pick a scenario to start.", scenario: "Scenario", report: "Symptom", causeHead: "Choose the cause",
    cause: "Cause", more: "Take more readings before choosing a cause.", solved: "Solved:",
    notIt: "Not the cause in this scenario.", ifIt: "If it were %s, the readings would show:",
    reveal: "Show the cause", revealed: "The cause in this scenario:", why: "Why",
    apart: "How to tell it apart", details: "details shown in the panel."
  };
  var KEYS = /^(Enter| |Spacebar|ArrowLeft|ArrowRight|ArrowUp|ArrowDown|Home|End|PageUp|PageDown)$/;

  function pageSeed() {
    var s = seedOf(root.location && root.location.search);
    if (s != null) return s;
    try {
      if (root.crypto && root.crypto.getRandomValues) {
        var u = new Uint32Array(1);
        root.crypto.getRandomValues(u);
        return u[0];
      }
    } catch (e) { /* fall back below */ }
    return Math.floor(Math.random() * 4294967296);
  }

  function fail(app, err) {
    var f = byId("sim-fail");
    if (f) f.hidden = false;
    if (app) app.setAttribute("data-sim", "failed");
    if (err && root.console && root.console.error) root.console.error(err);
  }
  api.fail = fail;

  /* cfg: { app, modes: [...], start, scenarioMode, trade, scenarios, targets, names: { modes, panels,
     hints, faults, symptoms }, ui: { overrides of UI }, hooks: {...} } */
  api.create = function (cfg) {
    var app = cfg.app, H = cfg.hooks || {}, N = cfg.names || {}, U = copy(UI), k;
    for (k in cfg.ui || {}) if (has(cfg.ui, k)) U[k] = cfg.ui[k];
    var modes = (cfg.modes || []).slice(), DG = cfg.scenarioMode || "diagnose", trade = cfg.trade || "multi";
    var scens = cfg.scenarios || [], targets = cfg.targets || "[data-info]", seed = pageSeed();
    var FN = N.faults || {}, SY = N.symptoms || {};
    var mode = has(cfg, "start") ? cfg.start : modes[0], reduce = false, paused = false, started = false;
    var el = {}, svg = null, dg = { sc: null, done: false, solved: {}, num: {} };

    /* ---------- markup ---------- */
    function build() {
      var bar = app.querySelector(".sim-bar");
      if (!bar) {
        bar = make("div", "sim-bar");
        var g = group("div", "sim-modes", U.modeGroup);
        modes.forEach(function (m) {
          g.appendChild(button("sim-mode", (N.modes || {})[m] || m, { "data-mode": m, "aria-pressed": "false" }));
        });
        bar.appendChild(g);
        app.insertBefore(bar, app.firstChild);
      }
      el.pause = need("sim-pause", bar, "button", "sim-btn sim-pause");
      el.pause.type = "button";
      el.rm = need("sim-rm", bar, "p", "sim-rm");
      if (!el.rm.firstChild) { el.rm.textContent = U.rm; el.rm.hidden = true; }
      var grid = app.querySelector(".sim-grid") || app.appendChild(make("div", "sim-grid"));
      el.fig = app.querySelector(".sim-fig") || grid.appendChild(make("div", "sim-fig"));
      el.side = app.querySelector(".sim-side") || grid.appendChild(make("div", "sim-side"));
      var live = need("sim-live", el.side, "div", "sim-live", el.side.firstChild);
      live.setAttribute("aria-live", "polite");
      el.status = need("sim-status", live, "p");
      el.warn = need("sim-warn", live, "p", "sim-warn");
      el.fail = need("sim-fail", el.side, "p", "sim-fail", live.nextSibling);
      if (!el.fail.firstChild) { el.fail.textContent = U.fail; el.fail.hidden = true; }
      el.panels = {};
      modes.forEach(function (m) {
        var p = app.querySelector("[data-panel=\"" + m + "\"]");
        if (!p) {
          p = make("div", "sim-panel");
          p.setAttribute("data-panel", m);
          p.appendChild(make("h2", "sim-h", (N.panels || {})[m] || ""));
          if ((N.hints || {})[m]) p.appendChild(make("p", "sim-hint", N.hints[m]));
          el.side.appendChild(p);
        }
        el.panels[m] = p;
      });
      if (el.panels.explore) {
        el.info = need("sim-info", el.panels.explore, "div", "sim-info");
        el.infoBody = need("sim-info-body", el.info, "div");
        if (!el.infoBody.firstChild) el.info.hidden = true;
      }
      var P = el.panels[DG];
      if (P) {
        if (!byId("dg-scen")) P.appendChild(group("div", "sim-row", U.scenario)).id = "dg-scen";
        el.scen = byId("dg-scen");
        /* the case area in reading order; a part the page already has stays where it is */
        el.caseBox = need("dg-case", P, "div");
        if (!el.caseBox.firstChild) { el.caseBox.hidden = true; el.caseBox.appendChild(make("h3", "sim-h3", U.report)); }
        el.symptom = need("dg-symptom", el.caseBox, "p", "sim-symptom");
        el.work = need("dg-work", el.caseBox, "div", null, byId("dg-causes"));
        if (!byId("dg-causes")) {
          el.caseBox.appendChild(make("h3", "sim-h3", U.causeHead));
          el.caseBox.appendChild(group("div", "sim-col", U.cause)).id = "dg-causes";
        }
        el.causes = byId("dg-causes");
        el.result = need("dg-result", el.caseBox, "div", "sim-result");
        el.verdict = need("dg-verdict", el.result, "p", "sim-verdict");
        el.more = need("dg-more", el.result, "div");
        el.reveal = need("dg-reveal", el.result, "button", "sim-btn");
        el.reveal.type = "button";
        if (!el.reveal.firstChild) el.reveal.textContent = U.reveal;
        el.offer = need("sim-offer", el.caseBox, "div", "sim-offer");
        el.result.hidden = true; el.reveal.hidden = true; el.offer.hidden = true;
        /* a button for every cause a scenario can name, unless the page already has it */
        var want = {};
        scens.forEach(function (s) { (s.causes || []).forEach(function (f) { want[f] = 1; }); });
        Object.keys(want).forEach(function (f) {
          if (el.causes.querySelector("[data-fault=\"" + f + "\"]")) return;
          var b = button("sim-cause", FN[f] || f, { "data-fault": f });
          b.hidden = true;
          el.causes.appendChild(b);
        });
      }
      if (!byId("sim-end") && app.parentNode) {
        var end = make("div", "sim-end");
        end.id = "sim-end";
        end.setAttribute("aria-hidden", "true");
        app.parentNode.insertBefore(end, app.nextSibling);
      }
    }

    function say(status, warnings) {
      text(el.status, status || "");
      var w = (warnings || []).map(function (x) { return typeof x === "string" ? x : x.text; }).join(" ");
      text(el.warn, w);
      el.warn.hidden = !w;
    }

    /* ---------- drawing targets: buttons only where the mode gives them a job ---------- */
    function setRoles() {
      if (!svg) return;
      all(svg, targets).forEach(function (g) {
        var label = null;
        if (mode === "explore") label = g.hasAttribute("data-info") ? g.getAttribute("data-name") : null;
        else if (H.label) label = H.label(g, mode);
        if (label) {
          g.setAttribute("role", "button");
          g.setAttribute("tabindex", "0");
          g.setAttribute("aria-label", label);
        } else {
          g.removeAttribute("role");
          g.removeAttribute("tabindex");
          g.removeAttribute("aria-label");
        }
      });
    }

    function activate(g) {
      if (mode === "explore") { if (g.hasAttribute("data-info")) selectPart(g); }
      else if (H.activate) H.activate(g, mode);
    }

    /* ---------- Explore ---------- */
    function partCopy(id) {
      var src = doc.querySelector(".sim-parts [data-part=\"" + id + "\"]");
      if (!src) return null;
      var c = src.cloneNode(true);
      c.removeAttribute("id");
      c.removeAttribute("data-part");
      return c;
    }
    function selectPart(g) {
      all(svg, ".sel").forEach(function (x) { x.classList.remove("sel"); });
      g.classList.add("sel");
      var body = el.infoBody, name = g.getAttribute("data-name") || "", shown = 0;
      body.textContent = "";
      (g.getAttribute("data-info") || "").split(/\s+/).forEach(function (id) {
        var c = id && partCopy(id);
        if (c) { body.appendChild(c); shown++; }
      });
      if (!shown) {
        var art = make("div", "sim-part"), p = make("p");
        art.appendChild(make("h3", null, name));
        (g.getAttribute("data-info-ref") || "").split(/\s+/).filter(Boolean).forEach(function (ref, i) {
          var s = doc.querySelector(".sim-sec [data-ref=\"" + ref + "\"]");
          if (!s) return;
          if (i) p.appendChild(doc.createTextNode(" "));
          p.appendChild(s.cloneNode(true));
        });
        if (p.firstChild) art.appendChild(p);
        body.appendChild(art);
      }
      el.info.hidden = false;
      /* on a phone the panel sits below the drawing: without this a tap seems to do nothing */
      if (el.info.scrollIntoView) el.info.scrollIntoView({ block: "nearest" });
      say(name + ": " + U.details, []);
    }

    /* ---------- Find the fault ---------- */
    function resultBox(kind, verdict) {
      el.result.className = "sim-result" + (kind ? " " + kind : "");
      text(el.verdict, verdict);
      el.more.textContent = "";
      el.result.hidden = false;
    }
    function addBlock(title, src) {
      if (!src) return;
      if (title) el.more.appendChild(make("h4", null, title));
      el.more.appendChild(para(src));
    }
    function faultCell(id, k) { return doc.querySelector("#tbl-faults tr[data-fault=\"" + id + "\"] td[data-k=\"" + k + "\"]"); }
    function faultText(id, k) { return doc.querySelector(".sim-why details[data-fault=\"" + id + "\"] p[data-k=\"" + k + "\"]"); }
    function explain(id) {
      addBlock(null, faultCell(id, "cause"));
      addBlock(U.why, faultText(id, "why"));
      addBlock(U.apart, faultText(id, "distinguish"));
    }
    function lockCauses() { all(el.causes, "[data-fault]").forEach(function (b) { b.disabled = true; }); }

    function pickCause(f, b) {
      if (!dg.sc || dg.done) return;
      if (H.ready && !H.ready(dg.sc)) {
        resultBox("", U.more);
        el.reveal.hidden = true;
        say(U.more, []);
        return;
      }
      var name = FN[f] || f;
      if (f === dg.sc.correct) {
        dg.done = true;
        lockCauses();
        resultBox("ok", U.solved + " " + name + ".");
        explain(f);
        el.reveal.hidden = true;
        /* the offer card is page markup; an empty one stays hidden */
        el.offer.hidden = !el.offer.firstChild;
        if (!dg.solved[dg.sc.id]) {
          dg.solved[dg.sc.id] = true;
          ga("fault_solved", { placement: "sim_" + f, trade: trade });
        }
        if (H.solved) H.solved(f);
        say(U.solved + " " + name + ".", []);
        return;
      }
      b.classList.add("tried");
      b.disabled = true;
      resultBox("no", U.notIt);
      addBlock(U.ifIt.replace("%s", name), faultCell(f, "see"));
      el.reveal.hidden = false;
      say(U.notIt, []);
    }

    function reveal() {
      if (!dg.sc || dg.done) return;
      dg.done = true;
      lockCauses();
      var f = dg.sc.correct, s = U.revealed + " " + (FN[f] || f) + ".";
      resultBox("", s);
      explain(f);
      el.reveal.hidden = true;
      say(s, []);
    }

    function pick(sc, btn) {
      dg.sc = sc; dg.done = false;
      resultBox("", "");
      all(el.scen, "button").forEach(function (b) { press(b, b === btn); });
      text(el.symptom, SY[sc.symptom] || "");
      all(el.causes, "[data-fault]").forEach(function (b) { b.hidden = true; b.disabled = false; b.classList.remove("tried"); });
      /* the causes of this scenario in a shuffled order, so the place of a button tells nothing */
      var list = (sc.causes || []).slice();
      order(list.length, (seed + dg.num[sc.id] * 7919) >>> 0).forEach(function (j) {
        var b = el.causes.querySelector("[data-fault=\"" + list[j] + "\"]");
        if (b) { b.hidden = false; el.causes.appendChild(b); }
      });
      el.result.hidden = true;
      el.offer.hidden = true;
      el.reveal.hidden = true;
      el.caseBox.hidden = false;
      if (H.scenario) H.scenario(sc);
      setRoles();
      say(U.scenario + " " + dg.num[sc.id] + ". " + U.report + ": " + (SY[sc.symptom] || ""), []);
    }

    function bindScenarios() {
      /* shuffled on every page load; the scenario stays in this closure and never reaches the page */
      order(scens.length, seed).forEach(function (j, i) {
        var sc = scens[j], b = button("sim-tog", U.scenario + " " + (i + 1), { "aria-pressed": "false" });
        dg.num[sc.id] = i + 1;
        b.addEventListener("click", function () { pick(sc, b); });
        el.scen.appendChild(b);
      });
      all(el.causes, "[data-fault]").forEach(function (b) {
        var f = b.getAttribute("data-fault");
        b.addEventListener("click", function () { pickCause(f, b); });
      });
      el.reveal.addEventListener("click", reveal);
    }

    /* ---------- the dock on narrow screens (CSS decides the width) ---------- */
    /* a bar at the bottom edge (the site cookie notice) keeps its place: the dock sits on top of it */
    function dockClear() {
      var b = byId("cookieBanner"), h = 0, r;
      if (b && b.style.display !== "none" && !b.hidden) { r = b.getBoundingClientRect(); h = Math.round(r.bottom - r.top); }
      if (el.dockB !== h) { app.style.setProperty("--dock-b", h + "px"); el.dockB = h; }
    }
    function bindDock() {
      var end = byId("sim-end");
      if (!end || typeof root.IntersectionObserver !== "function") return;
      app.classList.add("sim-dockable");
      var io = new root.IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.target === app) flag(app, "sim-away", !e.isIntersecting); });
        /* on while the end of the simulator is still below the screen, read from the live position */
        flag(app, "sim-dockon", end.getBoundingClientRect().top >= root.innerHeight);
        dockClear();
      });
      io.observe(end);
      io.observe(app);
      dockClear();
      root.addEventListener("resize", dockClear);
      doc.addEventListener("click", function () { root.setTimeout(dockClear, 0); });
    }

    /* ---------- modes, motion, first use ---------- */
    function setMode(m, user) {
      if (modes.indexOf(m) < 0) return;
      mode = m;
      app.setAttribute("data-mode", m);
      all(app, ".sim-mode").forEach(function (b) { press(b, b.getAttribute("data-mode") === m); });
      all(app, "[data-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-panel") !== m; });
      if (m !== "explore" && svg) all(svg, ".sel").forEach(function (x) { x.classList.remove("sel"); });
      if (H.mode) H.mode(m);
      setRoles();
      if (m === DG && !dg.sc) say(U.pick, []);
      if (user) ga("mode_change", { placement: m, trade: trade });
    }

    function showMotion() {
      flag(app, "sim-still", paused);
      flag(app, "sim-play", reduce && !paused);
      flag(app, "sim-rmon", reduce);
      el.rm.hidden = !reduce;
      text(el.pause, paused ? U.play : U.pause);
      if (H.motion) H.motion(!paused);
    }
    /* the device setting decides until the next press of the button */
    function applyMotion() {
      var was = reduce;
      reduce = !!(el.mq && el.mq.matches);
      if (reduce !== was) paused = reduce;
      showMotion();
    }
    function firstUse() {
      if (started) return;
      started = true;
      ga("sim_start", { placement: mode, trade: trade });
    }

    function bind() {
      all(app, ".sim-mode").forEach(function (b) {
        b.addEventListener("click", function () { var m = b.getAttribute("data-mode"); if (m !== mode) setMode(m, true); });
      });
      el.pause.addEventListener("click", function () { paused = !paused; showMotion(); });
      el.mq = typeof root.matchMedia === "function" ? root.matchMedia("(prefers-reduced-motion: reduce)") : null;
      if (el.mq) {
        if (el.mq.addEventListener) el.mq.addEventListener("change", applyMotion);
        else if (el.mq.addListener) el.mq.addListener(applyMotion);
      }
      /* taps and keys on the drawing, through the figure so a redrawn drawing keeps working */
      el.fig.addEventListener("click", function (ev) {
        var g = closest(ev.target, targets);
        if (g && svg && g.getAttribute("role") === "button") activate(g);
      });
      el.fig.addEventListener("keydown", function (ev) {
        if (ev.key !== "Enter" && ev.key !== " " && ev.key !== "Spacebar") return;
        var g = closest(ev.target, targets);
        if (!g || g.getAttribute("role") !== "button") return;
        ev.preventDefault();
        activate(g);
      });
      app.addEventListener("click", firstUse, true);
      app.addEventListener("input", firstUse, true);
      app.addEventListener("keydown", function (ev) { if (KEYS.test(ev.key)) firstUse(); }, true);
      if (el.scen) bindScenarios();
    }

    build();
    bind();
    return {
      el: el,
      mode: function () { return mode; },
      scenario: function () { return dg.sc; },
      solved: function () { return dg.done; },
      moving: function () { return !paused; },
      setSvg: function (s) { svg = s; },
      setMode: setMode,
      setRoles: setRoles,
      say: say,
      start: function () {
        applyMotion();
        bindDock();
        setMode(mode, false);
        app.setAttribute("data-sim", "ready");
      },
      fail: function (err) { fail(app, err); }
    };
  };
})(typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : this);
