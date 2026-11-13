/* =============================================================================
   GreenGenius landing page: hero cutaway simulation, moisture chart, loop
   highlight, care-type picker and the "inside" parts list.
   site.js handles the nav, reveal-on-scroll and the sign-up form.
   ========================================================================== */
(function () {
  "use strict";

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (id) { return document.getElementById(id); };

  /* Run a callback only while an element is on screen. */
  function whileVisible(el, onShow, onHide) {
    if (!("IntersectionObserver" in window)) { onShow(); return; }
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.isIntersecting ? onShow() : onHide && onHide(); });
    }, { threshold: 0.15 }).observe(el);
  }

  /* --------------------------------------------------------------------- */
  /* Hero cutaway: soil dries, pump doses, tank drains, refill.             */
  /* --------------------------------------------------------------------- */
  var cut = $("cutaway");
  if (cut) {
    var wet = $("wet"), water = $("water"), roM = $("roM"), roBar = $("roBar"), roPump = $("roPump"), roTank = $("roTank");
    var readout = $("readout");
    var LOW = 40, HIGH = 70, TANK_TOP = 368, TANK_H = 108;
    var m = 62, tank = 82, pumping = false, refilling = false, last = 0, raf = null;

    var draw = function () {
      wet.setAttribute("opacity", (0.04 + Math.max(0, (m - 30) / 45) * 0.3).toFixed(3));
      var h = (tank / 100) * (TANK_H - 6);
      water.setAttribute("y", (TANK_TOP + TANK_H - h).toFixed(1));
      water.setAttribute("height", h.toFixed(1));
      roM.textContent = Math.round(m);
      roBar.style.transform = "scaleX(" + (m / 100).toFixed(3) + ")";
      roTank.textContent = Math.round(tank) + "%";
      roPump.textContent = refilling ? "Tank refilled" : pumping ? "Watering" : "Idle";
      cut.classList.toggle("pumping", pumping);
      readout.classList.toggle("pumping-state", pumping);
    };

    var step = function (now) {
      var dt = Math.min((now - (last || now)) / 1000, 0.1);
      last = now;
      if (pumping) {
        m += 14 * dt;
        tank -= 2.6 * dt;
        if (m >= HIGH) { m = HIGH; pumping = false; }
      } else {
        m -= 4.2 * dt;
        if (m <= LOW) { m = LOW; pumping = tank > 20; }
      }
      if (tank < 45 && !pumping && !refilling) {
        refilling = true;
        setTimeout(function () { tank = 88; refilling = false; }, 1400);
      }
      draw();
      raf = requestAnimationFrame(step);
    };

    if (reduce) {
      draw();
    } else {
      whileVisible(cut, function () {
        if (!raf) { last = 0; raf = requestAnimationFrame(step); }
      }, function () {
        if (raf) { cancelAnimationFrame(raf); raf = null; }
      });
    }
  }

  /* --------------------------------------------------------------------- */
  /* Moisture chart (illustrative model, seeded so it's identical each load) */
  /* --------------------------------------------------------------------- */
  var chart = $("chart");
  if (chart) {
    var NS = "http://www.w3.org/2000/svg";
    var mk = function (tag, attrs, parent) {
      var el = document.createElementNS(NS, tag);
      for (var k in attrs) el.setAttribute(k, attrs[k]);
      (parent || chart).appendChild(el);
      return el;
    };
    var W = 800, H = 260, L = 34, R = 10, T = 10, B = 28;
    var DAYS = 14, LOWC = 45, HIGHC = 70;
    var x = function (h) { return L + (h / (DAYS * 24)) * (W - L - R); };
    var y = function (v) { return T + (1 - v / 100) * (H - T - B); };

    var seed = 7;
    var rand = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    var cloud = [];
    for (var d = 0; d < DAYS; d++) cloud.push(0.35 + rand() * 0.75);

    var pts = [], doses = [], v = 66;
    for (var hr = 0; hr <= DAYS * 24; hr++) {
      var sun = Math.max(0, Math.sin(((hr % 24) - 6) / 12 * Math.PI)) * cloud[Math.min(DAYS - 1, Math.floor(hr / 24))];
      v -= 0.12 + 0.9 * sun;
      if (v <= LOWC) { doses.push([hr, v]); v = HIGHC + rand() * 2; }
      pts.push([x(hr), y(v)]);
    }

    var grid = mk("g", { "class": "grid" });
    [0, 25, 50, 75, 100].forEach(function (g) {
      mk("line", { x1: L, x2: W - R, y1: y(g), y2: y(g) }, grid);
      mk("text", { x: L - 8, y: y(g) + 4, "text-anchor": "end", "class": "axis" }).textContent = g;
    });
    for (var dd = 0; dd <= DAYS; dd += 2) {
      mk("text", { x: x(dd * 24), y: H - 8, "text-anchor": "middle", "class": "axis" }).textContent = dd === 0 ? "Day 0" : dd;
    }
    mk("line", { x1: L, x2: W - R, y1: y(LOWC), y2: y(LOWC), "class": "thresh" });
    mk("line", { x1: L, x2: W - R, y1: y(HIGHC), y2: y(HIGHC), "class": "target" });

    var d = "M" + pts.map(function (p) { return p[0].toFixed(1) + " " + p[1].toFixed(1); }).join(" L");
    var area = mk("path", { d: d + " L" + (W - R) + " " + y(0) + " L" + L + " " + y(0) + "Z", "class": "area" });
    var curve = mk("path", { d: d, "class": "curve" });
    var dots = doses.map(function (p) {
      return mk("circle", { cx: x(p[0]).toFixed(1), cy: y(p[1]).toFixed(1), r: 4.5, "class": "dose" });
    });

    if (!reduce && curve.getTotalLength) {
      var len = curve.getTotalLength();
      curve.style.strokeDasharray = len;
      curve.style.strokeDashoffset = len;
      area.style.opacity = 0;
      dots.forEach(function (c) { c.style.opacity = 0; });
      var played = false;
      whileVisible(chart, function () {
        if (played) return;
        played = true;
        curve.style.transition = "stroke-dashoffset 2.6s cubic-bezier(.4,0,.2,1)";
        area.style.transition = "opacity 1s 1.8s";
        curve.style.strokeDashoffset = 0;
        area.style.opacity = 1;
        dots.forEach(function (c, i) {
          c.style.transition = "opacity .3s " + (0.2 + (i / dots.length) * 2.4).toFixed(2) + "s";
          c.style.opacity = 1;
        });
      });
    }
  }

  /* --------------------------------------------------------------------- */
  /* Loop steps: highlight each step in turn while on screen                */
  /* --------------------------------------------------------------------- */
  var loop = $("loopSteps");
  if (loop && !reduce) {
    var steps = loop.querySelectorAll(".loop-step"), idx = 0, timer = null;
    var tick = function () {
      steps.forEach(function (s, i) { s.classList.toggle("active", i === idx); });
      idx = (idx + 1) % steps.length;
    };
    whileVisible(loop, function () {
      if (!timer) { tick(); timer = setInterval(tick, 2200); }
    }, function () {
      clearInterval(timer); timer = null;
    });
  }

  /* --------------------------------------------------------------------- */
  /* Care-type picker                                                       */
  /* --------------------------------------------------------------------- */
  var CARE = {
    moist:  { phrase: "Keep evenly moist", plants: "Ferns, calathea, maranta",                              lo: 60, hi: 70, vwc: "40–45%" },
    top:    { phrase: "Top inch dry",      plants: "Most tropical foliage: monstera, philodendron, peace lily", lo: 40, hi: 50, vwc: "30–35%" },
    mostly: { phrase: "Mostly dry",        plants: "Pothos, ZZ plant, snake plant",                         lo: 20, hi: 30, vwc: "20–25%" },
    dry:    { phrase: "Completely dry",    plants: "Cacti and succulents (then wait a few days)",           lo: 0,  hi: 10, vwc: "5–15%" }
  };
  var tabs = document.querySelectorAll("#careTabs .tab");
  var select = function (tab) {
    var c = CARE[tab.getAttribute("data-care")];
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    $("carePhrase").textContent = c.phrase;
    $("carePlants").textContent = c.plants;
    $("careWhen").textContent = c.lo + "–" + c.hi;
    $("careVwc").textContent = c.vwc;
    var band = $("careBand");
    band.style.left = c.lo + "%";
    band.style.width = Math.max(c.hi - c.lo, 2) + "%";
  };
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { select(t); });
    t.addEventListener("keydown", function (e) {
      var n = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!n) return;
      e.preventDefault();
      var next = tabs[(i + n + tabs.length) % tabs.length];
      next.focus();
      select(next);
    });
  });
  var current = document.querySelector('#careTabs .tab[aria-selected="true"]');
  if (current) select(current);

  /* --------------------------------------------------------------------- */
  /* Inside: accordion that also highlights the part on the blueprint       */
  /* --------------------------------------------------------------------- */
  var parts = document.querySelectorAll("#parts button");
  var hots = document.querySelectorAll("#cadSlot [data-hot]");
  var openPart = function (btn) {
    var wasOpen = btn && btn.getAttribute("aria-expanded") === "true";
    parts.forEach(function (b) {
      var open = b === btn && !wasOpen;
      b.setAttribute("aria-expanded", String(open));
      b.nextElementSibling.style.height = open ? b.nextElementSibling.scrollHeight + "px" : "0px";
    });
    var key = btn && !wasOpen ? btn.getAttribute("data-part") : null;
    hots.forEach(function (h) { h.classList.toggle("on", h.getAttribute("data-hot") === key); });
  };
  parts.forEach(function (b) {
    b.addEventListener("click", function () { openPart(b); });
  });
  if (parts.length) { parts[0].setAttribute("aria-expanded", "false"); openPart(parts[0]); }
  window.addEventListener("resize", function () {
    var a = document.querySelector('#parts button[aria-expanded="true"]');
    if (a) a.nextElementSibling.style.height = a.nextElementSibling.scrollHeight + "px";
  }, { passive: true });
})();
