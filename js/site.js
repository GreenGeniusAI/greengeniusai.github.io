/* GreenGenius — shared page behaviour. No dependencies.
   Navigation (mobile menu, dropdown), tabs with deep links, care-band selector. */
(function () {
  "use strict";

  /* ---------------- Mobile menu ---------------- */
  var nav = document.querySelector(".nav");
  var toggle = document.querySelector(".burger");
  if (nav && toggle) {
    var setMenu = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Close" : "Menu";
      nav.classList.toggle("open", open);
      document.body.style.overflow = open ? "hidden" : "";
    };
    toggle.addEventListener("click", function () {
      setMenu(toggle.getAttribute("aria-expanded") !== "true");
    });
    // Closing on same-page anchor clicks; full navigations reload anyway.
    nav.querySelectorAll(".menu a").forEach(function (a) {
      a.addEventListener("click", function () { setMenu(false); });
    });
    window.matchMedia("(min-width: 1081px)").addEventListener("change", function (e) {
      if (e.matches) setMenu(false);
    });
  }

  /* ---------------- Dropdowns ---------------- */
  var items = Array.prototype.slice.call(document.querySelectorAll(".has-drop"));
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
    var hoverable = window.matchMedia("(hover: hover) and (min-width: 1081px)");
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
    if (!e.target.closest(".has-drop")) closeAll();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var open = document.querySelector(".has-drop.open");
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

  /* ---------------- Contact form ----------------
     Posts to the form's action (a Formspree endpoint) as FormData and asks
     for JSON back, so the visitor stays on the page. */
  var contact = document.querySelector("form[data-contact]");
  if (contact) {
    var status = contact.querySelector(".form-status");
    var submit = contact.querySelector('button[type="submit"]');
    var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    var MESSAGES = {
      name: "Please add your name.",
      email: "Please enter a valid email address.",
      topic: "Please choose one.",
      message: "Please write a short message."
    };
    var setError = function (field, text) {
      var err = document.getElementById(field.getAttribute("aria-describedby"));
      field.setAttribute("aria-invalid", text ? "true" : "false");
      if (err) err.textContent = text || "";
    };
    var validate = function (field) {
      var v = field.value.trim();
      var bad = field.required && !v ? MESSAGES[field.name] : "";
      if (!bad && field.type === "email" && v && !EMAIL.test(v)) bad = MESSAGES.email;
      setError(field, bad);
      return !bad;
    };
    var fields = Array.prototype.slice.call(contact.querySelectorAll("[required]"));
    fields.forEach(function (f) {
      f.addEventListener("blur", function () { if (f.value.trim()) validate(f); });
      f.addEventListener("input", function () { if (f.getAttribute("aria-invalid") === "true") validate(f); });
    });
    var say = function (text, state) { status.textContent = text; status.setAttribute("data-state", state || ""); };

    contact.addEventListener("submit", function (e) {
      e.preventDefault();
      var invalid = fields.filter(function (f) { return !validate(f); });
      if (invalid.length) { invalid[0].focus(); say(""); return; }

      // Bots fill the hidden field; humans can't see it.
      if (contact.querySelector('[name="_gotcha"]').value) { contact.reset(); return; }

      var endpoint = contact.getAttribute("action");
      if (!endpoint) { say("The contact form isn't connected yet. Please try again later.", "error"); return; }

      submit.disabled = true;
      say("Sending…");
      fetch(endpoint, { method: "POST", body: new FormData(contact), headers: { Accept: "application/json" } })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) { return { ok: res.ok, data: data }; });
        })
        .then(function (r) {
          if (!r.ok) {
            var msg = r.data && r.data.errors && r.data.errors.map(function (x) { return x.message; }).join(" ");
            throw new Error(msg || "");
          }
          var done = document.createElement("div");
          done.className = "form-done";
          done.setAttribute("tabindex", "-1");
          done.innerHTML = '<h2 class="h2">Thank you.</h2><p class="big-copy">Your message is with us. We\'ll reply to the email address you gave.</p>';
          contact.replaceWith(done);
          done.focus();
        })
        .catch(function (err) {
          say((err && err.message) || "Something went wrong sending your message. Please try again.", "error");
          submit.disabled = false;
        });
    });
  }

  /* ---------------- Footer year ---------------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
