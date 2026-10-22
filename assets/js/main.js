/* Site behaviour: theme toggle, scroll reveals, active-section nav,
   click-to-load YouTube facades, and visibility-driven video playback.
   Vanilla JS, no dependencies. Everything degrades to a working static page. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  function safe(fn) { try { return fn(); } catch (e) { return null; } }

  /* ---------- theme: Light / Dark / Auto ---------- */
  var KEY = "theme";
  function currentChoice() { return safe(function () { return localStorage.getItem(KEY); }) || "auto"; }
  function applyChoice(choice) {
    if (choice === "light" || choice === "dark") { root.setAttribute("data-theme", choice); }
    else { root.removeAttribute("data-theme"); }
    $$("[data-theme-set]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-theme-set") === choice)); });
    var meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) {
      var dark = choice === "dark" || (choice === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      meta.setAttribute("content", dark ? "#14130f" : "#f4f0e7");
    }
  }
  applyChoice(currentChoice());
  $$("[data-theme-set]").forEach(function (b) {
    b.addEventListener("click", function () {
      var c = b.getAttribute("data-theme-set");
      safe(function () { if (c === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, c); });
      applyChoice(c);
    });
  });

  /* ---------- scroll reveal (content stays visible if this never runs) ---------- */
  var reveals = $$(".reveal");
  $$("[data-stagger]").forEach(function (g) {
    $$(".reveal", g).forEach(function (el, i) { el.style.setProperty("--i", Math.min(i, 6)); });
  });
  if (reveals.length) {
    if (!("IntersectionObserver" in window) || reduce) {
      reveals.forEach(function (el) { el.classList.add("on"); });
    } else {
      var fired = false;
      var rio = new IntersectionObserver(function (entries) {
        fired = true;
        entries.forEach(function (e) {
          if (e.isIntersecting) { e.target.classList.add("on"); rio.unobserve(e.target); }
        });
      }, { threshold: 0.08, rootMargin: "0px 0px -6% 0px" });
      reveals.forEach(function (el) { rio.observe(el); });
      setTimeout(function () { if (!fired) reveals.forEach(function (el) { el.classList.add("on"); }); }, 1500);
    }
  }

  /* ---------- active section in nav / table of contents ---------- */
  function trackSections(links) {
    if (!links.length) return;
    var items = [];
    links.forEach(function (a) { var t = doc.querySelector(a.getAttribute("href")); if (t) items.push({ a: a, t: t }); });
    var ticking = false;
    function update() {
      ticking = false;
      var line = window.innerHeight * 0.35, cur = null;
      items.forEach(function (it) { if (it.t.getBoundingClientRect().top <= line) cur = it; });
      items.forEach(function (it) { if (it === cur) it.a.setAttribute("aria-current", "true"); else it.a.removeAttribute("aria-current"); });
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }
  trackSections($$(".nav-links a[href^='#']"));
  trackSections($$(".toc a[href^='#']"));
  /* ---------- small-screen menu: disclosure sheet with focus trap ---------- */
  (function () {
    var nav = doc.querySelector(".nav"), btn = doc.querySelector(".menu-btn"), list = doc.getElementById("nav-links");
    if (!nav || !btn || !list) return;
    var mq = window.matchMedia("(max-width: 860px)");
    function focusables() { return [btn].concat($$("a", list)); }
    function setOpen(open, restore) {
      nav.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", String(open));
      btn.firstChild.textContent = open ? "Close" : "Menu";
      if (!open && restore) btn.focus();
    }
    btn.addEventListener("click", function () { setOpen(!nav.classList.contains("open")); });
    list.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
    doc.addEventListener("keydown", function (e) {
      if (!nav.classList.contains("open")) return;
      if (e.key === "Escape") { setOpen(false, true); return; }
      if (e.key === "Tab") {
        var f = focusables(), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    doc.addEventListener("click", function (e) { if (nav.classList.contains("open") && !nav.contains(e.target)) setOpen(false); });
    (mq.addEventListener ? mq.addEventListener.bind(mq, "change") : mq.addListener.bind(mq))(function () { if (!mq.matches) setOpen(false); });
  })();
  /* ---------- YouTube facades: nothing loads until clicked ---------- */
  $$("a[data-yt]").forEach(function (a) {
    a.addEventListener("click", function (ev) {
      ev.preventDefault();
      var id = a.getAttribute("data-yt");
      var f = doc.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0&modestbranding=1&playsinline=1&loop=1&playlist=" + id;
      f.title = a.getAttribute("data-title") || "Video";
      f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
      f.setAttribute("allowfullscreen", "");
      var frame = doc.createElement("div");
      frame.className = a.className.replace(/\byt\b/, "").trim();
      frame.appendChild(f);
      a.replaceWith(frame);
      f.focus();
    });
  });

  /* ---------- videos ---------- */
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  $$("video").forEach(function (v) {
    var frame = v.closest(".media-frame");
    if (v.hasAttribute("data-click")) {
      // large file: poster + explicit play button, no autoplay
      if (!frame) return;
      v.removeAttribute("controls");
      var b = doc.createElement("button");
      b.type = "button"; b.className = "play";
      b.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1l9 5-9 5z"/></svg><span></span>';
      b.lastChild.textContent = v.getAttribute("data-label") || "Play video";
      b.addEventListener("click", function () {
        v.setAttribute("controls", ""); frame.classList.add("is-playing");
        var p = v.play(); if (p && p.catch) p.catch(function () {});
      });
      frame.appendChild(b);
      return;
    }
    if (v.hasAttribute("data-auto")) {
      if (reduce || saveData || !("IntersectionObserver" in window)) return; // keep native controls
      v.removeAttribute("controls");
      v.muted = true;
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
          else { v.pause(); }
        });
      }, { threshold: 0.5 }).observe(v);
    }
  });
})();
