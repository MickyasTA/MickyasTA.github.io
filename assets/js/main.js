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
    if (!links.length || !("IntersectionObserver" in window)) return;
    var map = {};
    links.forEach(function (a) { var t = doc.querySelector(a.getAttribute("href")); if (t) map[t.id] = a; });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.removeAttribute("aria-current"); });
        var a = map[e.target.id]; if (a) a.setAttribute("aria-current", "true");
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    Object.keys(map).forEach(function (id) { io.observe(doc.getElementById(id)); });
  }
  trackSections($$(".nav-links a[href^='#']"));
  trackSections($$(".toc a[href^='#']"));

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
