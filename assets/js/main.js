// Reveal-on-scroll animations + pause other videos when one plays.
(function () {
  // Scroll reveal
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

  // Only one video playing at a time
  var vids = Array.prototype.slice.call(document.querySelectorAll("video"));
  vids.forEach(function (v) {
    v.addEventListener("play", function () {
      vids.forEach(function (o) { if (o !== v) o.pause(); });
    });
  });
})();
