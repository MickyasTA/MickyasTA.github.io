// Reveal-on-scroll animations + autoplay videos while they are in view.
(function () {
  // Scroll reveal
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add("on"); io.unobserve(e.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

  // Autoplay each video while it is on screen; pause it when it scrolls away.
  var vids = Array.prototype.slice.call(document.querySelectorAll("video"));
  var vio = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var v = e.target;
      if (e.isIntersecting) {
        v.muted = true;                 // required for autoplay to be allowed
        var p = v.play();
        if (p && p.catch) { p.catch(function () {}); }  // ignore autoplay rejections
      } else {
        v.pause();
      }
    });
  }, { threshold: 0.35 });
  vids.forEach(function (v) { vio.observe(v); });
})();
