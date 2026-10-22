/*
 * Live two-wheel self-balancer: a wheeled inverted pendulum (cart-pole)
 * stabilised by a discrete-time LQR controller.
 *
 * Everything is computed in the browser at load:
 *   1. the linearised model about the upright equilibrium (A, B),
 *   2. its exact zero-order-hold discretisation (matrix exponential),
 *   3. the LQR gain K, by iterating the discrete algebraic Riccati
 *      equation  P <- Q + A'PA - A'PB (R + B'PB)^-1 B'PA  until it converges.
 * The plant it controls is the full NONLINEAR model (RK4), with viscous
 * friction, actuator saturation and sensor noise the controller does not model.
 */
(function (root) {
  "use strict";

  /* ---------------- physical parameters (SI) ---------------- */
  var P = {
    M: 0.6,      // wheel + drive mass [kg]
    m: 2.4,      // body mass [kg]
    l: 0.32,     // axle -> body centre of mass [m]
    I: 0.04,     // body inertia about its CoM [kg m^2]
    g: 9.81,
    b: 0.15,     // viscous friction at the wheel [N s/m] (not in the LQR model)
    h: 0.60,     // height at which a push is applied [m]
    r: 0.11,     // wheel radius [m] (drawing only)
    umax: 25,    // actuator limit [N]
    dt: 0.01,    // controller period [s] (100 Hz)
    sub: 4       // plant sub-steps per controller period
  };

  /* ---------------- small dense matrix helpers ---------------- */
  function zeros(n, m) { var a = []; for (var i = 0; i < n; i++) { a.push(new Array(m).fill(0)); } return a; }
  function mul(A, B) {
    var n = A.length, k = B.length, m = B[0].length, C = zeros(n, m);
    for (var i = 0; i < n; i++) for (var j = 0; j < m; j++) {
      var s = 0; for (var t = 0; t < k; t++) s += A[i][t] * B[t][j]; C[i][j] = s;
    }
    return C;
  }
  function tr(A) { var C = zeros(A[0].length, A.length); for (var i = 0; i < A.length; i++) for (var j = 0; j < A[0].length; j++) C[j][i] = A[i][j]; return C; }
  function add(A, B, s) { var C = zeros(A.length, A[0].length); for (var i = 0; i < A.length; i++) for (var j = 0; j < A[0].length; j++) C[i][j] = A[i][j] + (s === undefined ? 1 : s) * B[i][j]; return C; }
  function scale(A, s) { return A.map(function (r) { return r.map(function (v) { return v * s; }); }); }
  function eye(n) { var I = zeros(n, n); for (var i = 0; i < n; i++) I[i][i] = 1; return I; }

  /* exp(M) by scaling and squaring with a Taylor series */
  function expm(Mx) {
    var n = Mx.length, norm = 0, i, j;
    for (i = 0; i < n; i++) { var rs = 0; for (j = 0; j < n; j++) rs += Math.abs(Mx[i][j]); norm = Math.max(norm, rs); }
    var sq = Math.max(0, Math.ceil(Math.log(norm + 1e-12) / Math.LN2) + 1);
    var X = scale(Mx, Math.pow(2, -sq)), term = eye(n), sum = eye(n);
    for (var k = 1; k <= 14; k++) { term = scale(mul(term, X), 1 / k); sum = add(sum, term); }
    for (i = 0; i < sq; i++) sum = mul(sum, sum);
    return sum;
  }

  /* ---------------- model, discretisation, LQR ---------------- */
  function linearModel(p) {
    var J = p.I + p.m * p.l * p.l;
    var D = (p.M + p.m) * J - Math.pow(p.m * p.l, 2);
    var A = [
      [0, 1, 0, 0],
      [0, 0, -p.m * p.m * p.g * p.l * p.l / D, 0],
      [0, 0, 0, 1],
      [0, 0, (p.M + p.m) * p.m * p.g * p.l / D, 0]
    ];
    var B = [[0], [J / D], [0], [-p.m * p.l / D]];
    return { A: A, B: B };
  }

  function discretise(A, B, dt) {
    var n = A.length, Maug = zeros(n + 1, n + 1), i, j;
    for (i = 0; i < n; i++) { for (j = 0; j < n; j++) Maug[i][j] = A[i][j] * dt; Maug[i][n] = B[i][0] * dt; }
    var E = expm(Maug), Ad = zeros(n, n), Bd = zeros(n, 1);
    for (i = 0; i < n; i++) { for (j = 0; j < n; j++) Ad[i][j] = E[i][j]; Bd[i][0] = E[i][n]; }
    return { Ad: Ad, Bd: Bd };
  }

  /* Iterate the discrete Riccati equation to convergence; return {K, P, iters}. */
  function dlqr(Ad, Bd, Q, R) {
    var Pm = Q.map(function (r) { return r.slice(); }), iters = 0, K = null;
    var At = tr(Ad), Bt = tr(Bd);
    for (iters = 1; iters <= 200000; iters++) {
      var BtP = mul(Bt, Pm);                        // 1 x 4
      var S = R + mul(BtP, Bd)[0][0];               // scalar
      K = scale(mul(BtP, Ad), 1 / S);               // 1 x 4
      var AtPA = mul(mul(At, Pm), Ad);
      var AtPB = mul(mul(At, Pm), Bd);              // 4 x 1
      var Pn = add(add(Q, AtPA), mul(AtPB, K), -1);
      var diff = 0, mx = 0;
      for (var i = 0; i < 4; i++) for (var j = 0; j < 4; j++) { diff = Math.max(diff, Math.abs(Pn[i][j] - Pm[i][j])); mx = Math.max(mx, Math.abs(Pn[i][j])); }
      Pm = Pn;
      if (diff < 1e-10 * mx) break;
    }
    return { K: K[0], P: Pm, iters: iters };
  }

  function design(p) {
    var lin = linearModel(p), d = discretise(lin.A, lin.B, p.dt);
    var Q = zeros(4, 4); Q[0][0] = 6; Q[1][1] = 2; Q[2][2] = 90; Q[3][3] = 6;   // x, v, theta, omega
    var R = 0.12;
    var sol = dlqr(d.Ad, d.Bd, Q, R);
    return { K: sol.K, iters: sol.iters, A: lin.A, B: lin.B, Ad: d.Ad, Bd: d.Bd };
  }

  /* ---------------- nonlinear plant ---------------- */
  function deriv(s, u, Fd, p) {
    var th = s[2], w = s[3], v = s[1];
    var c = Math.cos(th), sn = Math.sin(th), J = p.I + p.m * p.l * p.l;
    var a11 = p.M + p.m, a12 = p.m * p.l * c, a22 = J;
    var r1 = u + Fd + p.m * p.l * w * w * sn - p.b * v;
    var r2 = p.m * p.g * p.l * sn + Fd * p.h * c;
    var det = a11 * a22 - a12 * a12;
    return [v, (r1 * a22 - a12 * r2) / det, w, (a11 * r2 - a12 * r1) / det];
  }
  function rk4(s, u, Fd, h, p) {
    var k1 = deriv(s, u, Fd, p);
    var s2 = s.map(function (v, i) { return v + 0.5 * h * k1[i]; }), k2 = deriv(s2, u, Fd, p);
    var s3 = s.map(function (v, i) { return v + 0.5 * h * k2[i]; }), k3 = deriv(s3, u, Fd, p);
    var s4 = s.map(function (v, i) { return v + h * k3[i]; }), k4 = deriv(s4, u, Fd, p);
    return s.map(function (v, i) { return v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]); });
  }

  /* gaussian noise */
  function randn() { var u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  var NOISE = [0.0005, 0.004, 0.0004, 0.004];

  /* one control period: measure (noisy) -> LQR -> saturate -> integrate plant */
  function step(sim, Fd) {
    var z = sim.s.map(function (v, i) { return v + NOISE[i] * randn(); });
    var u = 0; for (var i = 0; i < 4; i++) u -= sim.K[i] * z[i];
    var sat = Math.abs(u) > P.umax; u = Math.max(-P.umax, Math.min(P.umax, u));
    var h = P.dt / P.sub, s = sim.s;
    for (var k = 0; k < P.sub; k++) s = rk4(s, u, Fd, h, P);
    sim.s = s; sim.u = u; sim.sat = sat; sim.t += P.dt;
    return u;
  }

  var core = { P: P, design: design, step: step, linearModel: linearModel, discretise: discretise, dlqr: dlqr };
  if (typeof module !== "undefined" && module.exports) { module.exports = core; }
  if (typeof document === "undefined") { return; }

  /* ============================================================
     Browser part: canvas drawing, interaction, scheduling
     ============================================================ */
  var host = document.getElementById("sim");
  if (!host) { return; }
  var frame = host.querySelector(".sim-frame");
  var canvas = frame.querySelector("canvas");
  var ctx = canvas.getContext("2d");
  var toggle = host.querySelector(".sim-toggle");
  var chip = host.querySelector(".sim-chip span");
  var out = {
    th: host.querySelector("[data-o=th]"), w: host.querySelector("[data-o=w]"),
    u: host.querySelector("[data-o=u]"), c: host.querySelector("[data-o=c]")
  };

  var ctl = design(P);
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  var sim = { s: [0, 0, 0.2, 0], K: ctl.K, u: 0, sat: false, t: 0 };
  var W = 0, H = 0, dpr = 1, S = 1, col = {};
  var running = false, userPaused = false, visible = true, raf = 0, last = 0, acc = 0;
  var settled = 0, sleeping = false, nudgeTimer = 0, fallT = 0, frameNo = 0;
  var push = { down: false, x: 0, t0: 0, x0: 0, moved: false }, pulse = { F: 0, t: 0 };
  var HIST = 600, hist = [], histN = 0;   // 6 s of (theta, u) at 100 Hz

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    function g(n) { return cs.getPropertyValue(n).trim(); }
    col = { ink: g("--ink"), ink2: g("--ink-2"), ink3: g("--ink-3"), rule: g("--rule"), accent: g("--accent"), paper: g("--paper"), surface: g("--surface") };
    col.mono = g("--mono") || "monospace";
  }

  function resize() {
    var r = frame.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    S = W / 1.9;   // px per metre
    draw();
  }

  /* ---------- drawing ---------- */
  function draw() {
    var s = sim.s, x = s[0], th = s[2];
    var gy = H * 0.66, cx = W / 2, px = cx + x * S;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.lineCap = "round"; ctx.lineJoin = "round";

    // ground line, ticks every 0.25 m, hatching below
    ctx.strokeStyle = col.ink; ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
    ctx.strokeStyle = col.rule; ctx.lineWidth = 1;
    var tick;
    ctx.beginPath();
    for (tick = -1.25; tick <= 1.25; tick += 0.125) {
      var tx = cx + tick * S; if (tx < 0 || tx > W) continue;
      var major = Math.abs(tick * 4 - Math.round(tick * 4)) < 1e-6;
      ctx.moveTo(tx, gy); ctx.lineTo(tx - 6, gy + (major ? 9 : 5));
    }
    ctx.stroke();
    ctx.fillStyle = col.ink3; ctx.font = "10px " + col.mono; ctx.textAlign = "center";
    for (tick = -0.5; tick <= 0.5; tick += 0.5) { ctx.fillText((tick > 0 ? "+" : "") + tick.toFixed(1), cx + tick * S, gy + 22); }

    // reference marker at x = 0
    ctx.strokeStyle = col.accent; ctx.fillStyle = col.accent; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx, gy + 1); ctx.lineTo(cx - 4, gy + 8); ctx.lineTo(cx + 4, gy + 8); ctx.closePath(); ctx.fill();

    // robot, drawn in axle coordinates (y up)
    var wy = gy - P.r * S;   // axle height on screen
    ctx.save(); ctx.translate(px, wy);

    // vertical reference (dashed) + angle arc
    ctx.strokeStyle = col.ink3; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -0.78 * S); ctx.stroke(); ctx.setLineDash([]);
    var ar = 0.3 * S;
    ctx.strokeStyle = col.accent; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, ar, -Math.PI / 2, -Math.PI / 2 + th, th < 0); ctx.stroke();
    ctx.fillStyle = col.accent; ctx.font = "11px " + col.mono;
    ctx.textAlign = th >= 0 ? "left" : "right";
    ctx.fillText("θ", (th >= 0 ? 1 : -1) * (Math.max(Math.abs(Math.sin(th / 2)) * ar * 1.9, 0) + 8), -ar - 5);

    // body (rotates with theta about the axle)
    ctx.save(); ctx.rotate(th);
    var bw = 0.19 * S, bh = 0.60 * S, br = 4;
    ctx.fillStyle = col.surface; ctx.strokeStyle = col.ink; ctx.lineWidth = 1.5;
    roundRect(ctx, -bw / 2, -bh - 0.02 * S, bw, bh, br); ctx.fill(); ctx.stroke();
    // inner details: battery bay, sensor head, centre line
    ctx.lineWidth = 1; ctx.strokeStyle = col.ink2;
    roundRect(ctx, -bw / 2 + 6, -bh * 0.62 - 0.02 * S, bw - 12, bh * 0.36, 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -bh + 0.05 * S, 0.035 * S, 0, 7); ctx.stroke();
    ctx.setLineDash([2, 3]); ctx.strokeStyle = col.ink3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -bh - 0.07 * S); ctx.stroke(); ctx.setLineDash([]);
    // centre of mass marker
    var cy = -P.l * S;
    ctx.strokeStyle = col.ink; ctx.fillStyle = col.paper; ctx.lineWidth = 1.25;
    ctx.beginPath(); ctx.arc(0, cy, 6, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = col.ink; ctx.beginPath(); ctx.moveTo(0, cy); ctx.arc(0, cy, 6, -Math.PI / 2, 0); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.arc(0, cy, 6, Math.PI / 2, Math.PI); ctx.closePath(); ctx.fill();
    ctx.restore();

    // wheel (rotates with x / r), spokes
    var rr = P.r * S, wa = x / P.r;
    ctx.fillStyle = col.paper; ctx.strokeStyle = col.ink; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, 7); ctx.fill(); ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = col.ink2;
    ctx.beginPath();
    for (var i = 0; i < 3; i++) { var a = wa + i * Math.PI / 3; ctx.moveTo(Math.cos(a) * rr * .86, Math.sin(a) * rr * .86); ctx.lineTo(-Math.cos(a) * rr * .86, -Math.sin(a) * rr * .86); }
    ctx.stroke();
    ctx.fillStyle = col.ink; ctx.beginPath(); ctx.arc(0, 0, 3, 0, 7); ctx.fill();

    // wheel command arrow at the contact patch
    var ua = sim.u / P.umax;
    if (Math.abs(ua) > 0.02) {
      var len = ua * 0.3 * S, ay = rr + 14;
      ctx.strokeStyle = col.ink; ctx.fillStyle = col.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(len, ay); ctx.stroke();
      var dir = len >= 0 ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(len, ay); ctx.lineTo(len - dir * 6, ay - 3.5); ctx.lineTo(len - dir * 6, ay + 3.5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // push indicator while dragging
    if (push.down && push.moved) {
      ctx.strokeStyle = col.accent; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      var topX = px + Math.sin(th) * P.h * S, topY = wy - Math.cos(th) * P.h * S;
      ctx.beginPath(); ctx.moveTo(topX, topY); ctx.lineTo(push.x, topY); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col.accent; ctx.beginPath(); ctx.arc(push.x, topY, 3, 0, 7); ctx.fill();
    }

    drawChart();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y); c.closePath();
  }

  /* strip chart of the last 6 s: tilt (accent) and wheel command (grey) */
  function drawChart() {
    var pad = 16, y0 = H * 0.83, hh = H * 0.1, x0 = pad, w = W - pad * 2;
    ctx.strokeStyle = col.rule; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + w, y0); ctx.stroke();
    ctx.fillStyle = col.ink3; ctx.font = "9.5px " + col.mono; ctx.textAlign = "left";
    ctx.fillText("last 6 s", x0, y0 + hh + 14);
    ctx.textAlign = "right";
    var uT = "u ±" + P.umax + " N", tT = "θ ±30°";
    ctx.fillStyle = col.ink3; ctx.fillText(uT, x0 + w, y0 + hh + 14);
    ctx.fillStyle = col.accent; ctx.fillText(tT, x0 + w - ctx.measureText(uT).width - 14, y0 + hh + 14);
    var n = Math.min(histN, HIST);
    if (n < 2) return;
    function trace(idx, scl, color, lw) {
      ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
      for (var i = 0; i < n; i++) {
        var j = (histN - n + i) % HIST, v = hist[j * 2 + idx] * scl;
        v = Math.max(-1, Math.min(1, v));
        var px = x0 + (i + (HIST - n)) / (HIST - 1) * w, py = y0 - v * hh;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    trace(1, 1 / P.umax, col.ink3, 1);
    trace(0, 1 / (30 * Math.PI / 180), col.accent, 1.5);
  }

  /* ---------- readouts (throttled) ---------- */
  function fmt(v, d, w) { var t = Math.abs(v).toFixed(d); return (v < -0.5 * Math.pow(10, -d) ? "−" : "+") + t; }
  function readout() {
    var s = sim.s;
    out.th.firstChild.nodeValue = fmt(s[2] * 180 / Math.PI, 1);
    out.w.firstChild.nodeValue = fmt(s[3] * 180 / Math.PI, 0);
    out.u.firstChild.nodeValue = fmt(sim.u, 1);
    out.c.textContent = fallT > 0 ? "reset" : (sim.sat ? "LQR sat." : "LQR");
  }

  /* ---------- loop ---------- */
  function pushForce() {
    if (push.down && push.moved) {
      var s = sim.s, topX = W / 2 + (s[0] + Math.sin(s[2]) * P.h) * S;
      var target = Math.max(W / 2 - 0.4 * S, Math.min(W / 2 + 0.4 * S, push.x));
      return Math.max(-3, Math.min(3, 15 * (target - topX) / S));
    }
    if (pulse.t > 0) return pulse.F;
    return 0;
  }

  function tick(now) {
    raf = 0;
    if (!running) return;
    var dtReal = Math.min(0.05, (now - last) / 1000); last = now; acc += dtReal;
    var n = 0;
    while (acc >= P.dt && n < 6) {
      if (fallT > 0) { fallT -= P.dt; if (fallT <= 0) { sim.s = [0, 0, (Math.random() < .5 ? -1 : 1) * 0.15, 0]; settled = 0; } }
      else {
        var Fd = pushForce();
        if (pulse.t > 0) pulse.t -= P.dt;
        step(sim, Fd);
        var s = sim.s;
        if (Math.abs(s[2]) > 0.95 || Math.abs(s[0]) > 0.9) { fallT = 0.9; sim.u = 0; }
        var quiet = Math.abs(s[2]) < 0.0025 && Math.abs(s[3]) < 0.02 && Math.abs(s[0]) < 0.02 && Math.abs(s[1]) < 0.03;
        settled = (quiet && !push.down) ? settled + P.dt : 0;
        var j = histN % HIST; hist[j * 2] = s[2]; hist[j * 2 + 1] = sim.u; histN++;
      }
      acc -= P.dt; n++;
    }
    if (acc > 0.1) acc = 0;
    draw();
    if ((frameNo++ & 3) === 0) readout();
    if (settled > 1.4) { readout(); sleep(); return; }
    raf = requestAnimationFrame(tick);
  }

  function setState(live) {
    host.classList.toggle("is-live", live);
    chip.textContent = live ? "Live · LQR" : (sleeping ? "Settled · LQR" : "Paused");
    toggle.textContent = running || sleeping && !userPaused ? "Pause" : "Play";
    toggle.setAttribute("aria-pressed", String(userPaused));
  }

  function canRun() { return visible && !document.hidden && !userPaused; }

  function wake() {
    clearTimeout(nudgeTimer);
    sleeping = false;
    if (!canRun()) { running = false; setState(false); return; }
    if (!running) { running = true; last = performance.now(); acc = 0; }
    if (!raf) raf = requestAnimationFrame(tick);
    setState(true);
  }
  function stop() { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } clearTimeout(nudgeTimer); }
  function sleep() {
    stop(); sleeping = true; settled = 0; setState(false);
    // idle invitation: a small automatic nudge after a while, only while visible
    nudgeTimer = setTimeout(function () {
      if (!canRun() || reduce.matches) return;
      pulse.F = (Math.random() < .5 ? -1 : 1) * 7; pulse.t = 0.06; wake();
    }, 9000);
  }

  /* ---------- pointer interaction ---------- */
  function localX(e) { var r = frame.getBoundingClientRect(); return e.clientX - r.left; }
  frame.addEventListener("pointerdown", function (e) {
    if (e.button !== undefined && e.button > 0) return;
    push.down = true; push.moved = false; push.x0 = localX(e); push.x = push.x0; push.t0 = performance.now();
    frame.classList.add("is-grabbing");
    try { frame.setPointerCapture(e.pointerId); } catch (_) {}
    if (userPaused) { userPaused = false; }
    wake();
  });
  frame.addEventListener("pointermove", function (e) {
    if (!push.down) return;
    push.x = localX(e);
    if (Math.abs(push.x - push.x0) > 6) push.moved = true;
  });
  function release(e) {
    if (!push.down) return;
    var quickTap = !push.moved && performance.now() - push.t0 < 400;
    if (quickTap) {
      // a tap pushes the body away from the tap position
      var topX = W / 2 + (sim.s[0] + Math.sin(sim.s[2]) * P.h) * S;
      pulse.F = (push.x0 < topX ? 1 : -1) * 10; pulse.t = 0.06;
    }
    push.down = false; push.moved = false;
    frame.classList.remove("is-grabbing");
    wake();
  }
  frame.addEventListener("pointerup", release);
  frame.addEventListener("pointercancel", release);

  toggle.addEventListener("click", function () {
    if (running || (sleeping && !userPaused)) { userPaused = true; stop(); sleeping = false; setState(false); toggle.textContent = "Play"; }
    else { userPaused = false; if (sim.s[2] === 0 && Math.abs(sim.s[0]) < 1e-9) sim.s[2] = 0.12; wake(); }
  });

  /* ---------- visibility, theme, resize ---------- */
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible) { if (!userPaused && !(reduce.matches && !ever)) wake(); } else { stop(); setState(false); }
    }, { threshold: 0.15 }).observe(host);
  }
  document.addEventListener("visibilitychange", function () { if (document.hidden) { stop(); } else if (visible && !userPaused && !(reduce.matches && !ever)) { wake(); } });
  if ("ResizeObserver" in window) { new ResizeObserver(function () { resize(); }).observe(frame); } else { window.addEventListener("resize", resize); }
  new MutationObserver(function () { readColors(); draw(); }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  var mq = window.matchMedia("(prefers-color-scheme: dark)");
  if (mq.addEventListener) mq.addEventListener("change", function () { readColors(); draw(); });

  /* ---------- boot ---------- */
  var ever = false;       // has the user ever started it under reduced motion
  readColors(); resize();
  out.th.firstChild || (out.th.textContent = "+0.0");
  if (reduce.matches) {
    // static frame: a visibly tilted pose, no loop until the user presses Play
    userPaused = true; sim.s = [0, 0, 0.12, 0]; draw(); readout(); setState(false);
    toggle.addEventListener("click", function () { ever = true; }, { once: true });
  } else {
    wake();
  }
  host.dataset.k = ctl.K.map(function (k) { return k.toFixed(2); }).join(", ");
  host.dataset.iters = ctl.iters;
  root.__balancer = { K: ctl.K, iters: ctl.iters };
})(typeof window !== "undefined" ? window : globalThis);
