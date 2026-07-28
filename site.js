/* =============================================================================
   GreenGenius — site behaviour
   No external dependencies. Previously this file drove Lenis (smooth scroll),
   GSAP and ScrollTrigger; those fought each other and the browser's native
   scroll, which is what caused the stalling and freezing. Everything below is
   built on IntersectionObserver plus a single rAF-throttled scroll handler.

   Rules this file follows:
   - Exactly one `scroll` listener, passive, doing nothing but setting a flag.
   - All reads happen together, then all writes, inside one rAF tick.
   - Only `opacity` and `transform` are animated.
   - `prefers-reduced-motion` short-circuits every animation.
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* --------------------------------------------------------------------- */
  /* Single scroll loop                                                     */
  /* Subscribers are called at most once per frame with the current scrollY. */
  /* --------------------------------------------------------------------- */
  var subscribers = [];
  var ticking = false;
  var lastY = window.scrollY;

  function onFrame() {
    ticking = false;
    for (var i = 0; i < subscribers.length; i++) subscribers[i](lastY);

    // The position can change between the scroll event firing and this frame
    // running — notably on large programmatic jumps, where the value captured
    // in requestTick ends up stale. Re-read and run again so subscribers can
    // never settle on an out-of-date position.
    if (window.scrollY !== lastY) requestTick();
  }

  function requestTick() {
    lastY = window.scrollY;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(onFrame);
    }
  }

  function onScroll(fn) {
    subscribers.push(fn);
    fn(window.scrollY);
  }

  window.addEventListener("scroll", requestTick, { passive: true });

  /* --------------------------------------------------------------------- */
  /* Reveal on scroll                                                       */
  /* --------------------------------------------------------------------- */
  var revealEls = Array.prototype.slice.call(
    document.querySelectorAll(".reveal, .img-slide")
  );

  if (revealEls.length && !reduceMotion && "IntersectionObserver" in window) {
    // Opting in from JS means a blocked or failed script leaves content visible.
    document.body.classList.add("animate");

    // Stagger within each section, capped so nothing waits long enough to
    // read as "stuck". Six items in, the delay stops growing.
    document.querySelectorAll("header, section, footer").forEach(function (group) {
      group.querySelectorAll(".reveal").forEach(function (el, i) {
        el.style.setProperty("--reveal-delay", Math.min(i * 0.05, 0.25) + "s");
      });
    });

    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in");
          revealObserver.unobserve(entry.target);
        });
      },
      { threshold: 0.05, rootMargin: "0px 0px -6% 0px" }
    );

    revealEls.forEach(function (el) { revealObserver.observe(el); });

    // Anything still hidden after 1.5s is shown unconditionally. Guards
    // against zero-height or off-layout elements the observer never fires for.
    setTimeout(function () {
      revealEls.forEach(function (el) { el.classList.add("in"); });
    }, 1500);
  }

  /* --------------------------------------------------------------------- */
  /* Navbar background state                                                */
  /* --------------------------------------------------------------------- */
  var navbar = document.getElementById("navbar");
  if (navbar) {
    var isScrolled = null;
    onScroll(function (y) {
      var next = y > 60;
      // Only touch the DOM when the state actually flips.
      if (next !== isScrolled) {
        isScrolled = next;
        navbar.classList.toggle("scrolled", next);
      }
    });
  }

  /* --------------------------------------------------------------------- */
  /* Hero parallax                                                          */
  /* The image is 116% of its frame, so it can travel 16% without exposing   */
  /* an edge. Runs only while the hero is on screen.                        */
  /* --------------------------------------------------------------------- */
  var heroImg = document.querySelector(".hero-img-wrap img");
  var hero = document.querySelector(".hero");

  if (heroImg && hero && !reduceMotion && window.innerWidth > 768) {
    var heroHeight = hero.offsetHeight;
    var lastShift = null;

    // No visibility gate here on purpose. `progress` clamps to 1 once the hero
    // is scrolled past, so `shift` stops changing and the guard below skips
    // every write anyway. Gating on an IntersectionObserver instead would let
    // the transform freeze at a stale offset whenever the hero re-entered the
    // viewport without a subsequent scroll event.
    onScroll(function (y) {
      var progress = Math.min(Math.max(y / heroHeight, 0), 1);
      var shift = Math.round(progress * -16 * 100) / 100;
      if (shift === lastShift) return;
      lastShift = shift;
      heroImg.style.transform = "translate3d(0," + shift + "%,0)";
    });

    // offsetHeight is a layout read — recompute on resize only, never per frame.
    var resizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        heroHeight = hero.offsetHeight;
      }, 150);
    }, { passive: true });
  }

  /* --------------------------------------------------------------------- */
  /* Count-up figures                                                       */
  /* --------------------------------------------------------------------- */
  var counters = document.querySelectorAll("[data-count]");

  if (counters.length) {
    var runCount = function (el) {
      var target = parseFloat(el.getAttribute("data-count"));
      if (isNaN(target)) return;

      if (reduceMotion) {
        el.textContent = target.toLocaleString();
        return;
      }

      var duration = 1100;
      var start = null;

      var step = function (timestamp) {
        if (start === null) start = timestamp;
        var progress = Math.min((timestamp - start) / duration, 1);
        // easeOutCubic
        var eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(target * eased).toLocaleString();
        if (progress < 1) requestAnimationFrame(step);
      };

      requestAnimationFrame(step);
    };

    if ("IntersectionObserver" in window) {
      var countObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            runCount(entry.target);
            countObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.6 }
      );
      counters.forEach(function (el) { countObserver.observe(el); });
    }
  }

  /* --------------------------------------------------------------------- */
  /* Mobile menu                                                            */
  /* --------------------------------------------------------------------- */
  var navToggle = document.querySelector(".nav-toggle");
  var navLinks = document.getElementById("navLinks");

  if (navToggle && navLinks) {
    var setMenu = function (open) {
      navToggle.setAttribute("aria-expanded", String(open));
      navLinks.classList.toggle("open", open);
      document.body.style.overflow = open ? "hidden" : "";
    };

    navToggle.addEventListener("click", function () {
      setMenu(navToggle.getAttribute("aria-expanded") !== "true");
    });

    navLinks.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () { setMenu(false); });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") {
        setMenu(false);
        navToggle.focus();
      }
    });
  }

  /* --------------------------------------------------------------------- */
  /* FAQ accordion                                                          */
  /* --------------------------------------------------------------------- */
  var faqItems = Array.prototype.slice.call(document.querySelectorAll(".faq-item"));

  if (faqItems.length) {
    var closeItem = function (item) {
      item.classList.remove("open");
      item.querySelector(".faq-q").setAttribute("aria-expanded", "false");
      item.querySelector(".faq-a").style.maxHeight = null;
    };

    var openItem = function (item) {
      var panel = item.querySelector(".faq-a");
      item.classList.add("open");
      item.querySelector(".faq-q").setAttribute("aria-expanded", "true");
      panel.style.maxHeight = panel.scrollHeight + "px";
    };

    faqItems.forEach(function (item) {
      var question = item.querySelector(".faq-q");
      question.addEventListener("click", function () {
        var wasOpen = item.classList.contains("open");
        faqItems.forEach(closeItem);
        if (!wasOpen) openItem(item);
      });
    });

    // A reflow can change a panel's natural height; the pinned max-height
    // would then clip or overshoot it.
    var faqResizeTimer;
    window.addEventListener("resize", function () {
      clearTimeout(faqResizeTimer);
      faqResizeTimer = setTimeout(function () {
        faqItems.forEach(function (item) {
          if (!item.classList.contains("open")) return;
          var panel = item.querySelector(".faq-a");
          panel.style.maxHeight = panel.scrollHeight + "px";
        });
      }, 150);
    }, { passive: true });
  }

  /* --------------------------------------------------------------------- */
  /* Sign-up forms                                                          */
  /* Posts to the URL in data-endpoint. Until that is set, the form tells    */
  /* the visitor how to reach us rather than faking a successful submit.     */
  /* --------------------------------------------------------------------- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  document.querySelectorAll("form[data-signup]").forEach(function (form) {
    var input = form.querySelector('input[type="email"]');
    var button = form.querySelector("button");
    // The status line lives outside the form in the footer layout, where it
    // would otherwise become a flex item of .field-row. Check inside first,
    // then fall back to the surrounding block.
    var message =
      form.querySelector(".form-msg") ||
      (form.parentElement && form.parentElement.querySelector(".form-msg"));
    if (!input || !message) return;

    var say = function (text, state) {
      message.textContent = text;
      message.setAttribute("data-state", state);
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var value = input.value.trim();

      if (!EMAIL_RE.test(value)) {
        say("Please enter a valid email address.", "error");
        input.focus();
        return;
      }

      var endpoint = form.getAttribute("data-endpoint");

      if (!endpoint) {
        say("Email us at hello@greengenius.co and we'll add you to the list.", "error");
        return;
      }

      button.disabled = true;
      say("Sending…", "");

      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value, source: document.title })
      })
        .then(function (res) {
          if (!res.ok) throw new Error(res.status);
          form.reset();
          say("You're on the list. We'll be in touch before units ship.", "success");
        })
        .catch(function () {
          say("Something went wrong. Email hello@greengenius.co instead.", "error");
        })
        .finally(function () {
          button.disabled = false;
        });
    });
  });

  /* --------------------------------------------------------------------- */
  /* Footer year                                                            */
  /* --------------------------------------------------------------------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
