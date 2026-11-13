/* GreenGenius — shared page behaviour. No dependencies.
   Navigation (mobile menu, dropdown), tabs with deep links, care-band selector. */
(function () {
  "use strict";

  /* ---------------- Mobile menu ---------------- */
  var nav = document.querySelector(".site-nav");
  var toggle = document.querySelector(".nav-toggle");
  if (nav && toggle) {
    var setMenu = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      nav.classList.toggle("menu-open", open);
      document.body.style.overflow = open ? "hidden" : "";
    };
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    // Closing on same-page anchor clicks; full navigations reload anyway.
    nav.querySelectorAll(".nav-menu a").forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false); });
    });
    window.matchMedia("(min-width: 1021px)").addEventListener("change", function (e) {
      if (e.matches) setMenu(false);
    });
  }

  /* ---------------- Dropdowns ---------------- */
  var items = Array.prototype.slice.call(document.querySelectorAll(".nav-item"));
  var closeAll = function (except) {
    items.forEach(function (it) {
      if (it === except) return;
      it.classList.remove("open");
      it.querySelector("[aria-expanded]").setAttribute("aria-expanded", "false");
    });
  };
  items.forEach(function (item) {
    var btn = item.querySelector("button");
    var setOpen = function (open) {
      item.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
    };
    // Hover opens on devices that can hover; click still works everywhere.
    var hoverable = window.matchMedia("(hover: hover) and (min-width: 1021px)");
    var timer, hoverOpenedAt = 0;
    btn.addEventListener("click", function () {
      // A click that lands just after hover opened the menu means "open", not "toggle closed".
      if (Date.now() - hoverOpenedAt < 600) return;
      var open = !item.classList.contains("open");
      closeAll(item);
      setOpen(open);
    });
    item.addEventListener("mouseenter", function () {
      if (!hoverable.matches) return;
      clearTimeout(timer);
      if (!item.classList.contains("open")) hoverOpenedAt = Date.now();
      closeAll(item); setOpen(true);
    });
    item.addEventListener("mouseleave", function () {
      if (!hoverable.matches) return;
      timer = setTimeout(function () { setOpen(false); }, 120);
    });
    item.addEventListener("focusout", function (e) {
      if (!item.contains(e.relatedTarget) && hoverable.matches) setOpen(false);
    });
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest(".nav-item")) closeAll();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var open = document.querySelector(".nav-item.open");
    if (open) { closeAll(); open.querySelector("button").focus(); return; }
    if (toggle && toggle.getAttribute("aria-expanded") === "true") { toggle.click(); toggle.focus(); }
  });

  /* ---------------- Tabs ----------------
     Markup: [role=tablist] > [role=tab][aria-controls], panels [role=tabpanel].
     A tab's data-hash lets the URL (#sensing etc.) select it, so nav links work. */
  document.querySelectorAll("[role=tablist]").forEach(function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll("[role=tab]"));
    var select = function (tab, updateHash) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
      });
      if (updateHash && tab.dataset.hash && history.replaceState) {
        history.replaceState(null, "", "#" + tab.dataset.hash);
      }
    };
    tabs.forEach(function (tab, i) {
      tab.addEventListener("click", function () { select(tab, true); });
      tab.addEventListener("keydown", function (e) {
        var d = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: tabs.length - 1 - i }[e.key];
        if (d === undefined) return;
        e.preventDefault();
        var next = tabs[(i + d + tabs.length) % tabs.length];
        next.focus();
        select(next, true);
      });
    });
    var fromHash = function () {
      var h = location.hash.slice(1);
      var match = tabs.filter(function (t) { return t.dataset.hash === h; })[0];
      if (match) {
        select(match, false);
        list.scrollIntoView({ block: "start" });
      }
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
  });

  /* ---------------- Care-band selector ---------------- */
  var options = Array.prototype.slice.call(document.querySelectorAll("[data-band]"));
  if (options.length) {
    var out = {
      name: document.getElementById("bandName"),
      plants: document.getElementById("bandPlants"),
      band: document.getElementById("bandRange"),
      when: document.getElementById("bandWhen"),
      vwc: document.getElementById("bandVwc")
    };
    var choose = function (opt) {
      options.forEach(function (o) {
        var on = o === opt;
        o.setAttribute("aria-checked", String(on));
        o.tabIndex = on ? 0 : -1;
      });
      var lo = +opt.dataset.lo, hi = +opt.dataset.hi;
      out.name.textContent = opt.querySelector("strong").textContent;
      out.plants.textContent = opt.dataset.plants;
      out.when.textContent = lo + "–" + hi;
      out.vwc.textContent = opt.dataset.vwc;
      out.band.style.left = lo + "%";
      out.band.style.width = Math.max(hi - lo, 2) + "%";
    };
    options.forEach(function (opt, i) {
      opt.addEventListener("click", function () { choose(opt); });
      opt.addEventListener("keydown", function (e) {
        var d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
        if (!d) return;
        e.preventDefault();
        var next = options[(i + d + options.length) % options.length];
        next.focus();
        choose(next);
      });
    });
    choose(options.filter(function (o) { return o.getAttribute("aria-checked") === "true"; })[0] || options[0]);
  }

  /* ---------------- Footer year ---------------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
