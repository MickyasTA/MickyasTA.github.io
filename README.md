# mickyasta.github.io

Personal portfolio of **Mickyas Tamiru Asfaw**: robotics, reinforcement learning, control.

Live at: **https://mickyasta.github.io**

## Structure

```
index.html              # main page: hero (live balancer), flagship (AETHER-1), work,
                        #   experience, publications, education, skills, about, contact
projects/*.html         # five case studies (aether-1, mybot, collision-avoidance,
                        #   drl-navigation, wheeled-quadruped), one shared template
404.html                # branded not-found page (root-absolute paths, for GitHub Pages)
assets/css/style.css    # single stylesheet: paper light theme, dark theme, one accent
assets/js/main.js       # theme toggle, reveals, active nav, video + YouTube facades
assets/js/balancer.js   # hero simulation: cart-pole + discrete LQR (see below)
assets/img/  assets/video/  # curated media, favicon.svg
.nojekyll               # serve as plain static files
```

Plain static site, no build step, no dependencies. Edit the HTML/CSS directly and push to `main`.

## Design system

- Warm paper light theme by default; full dark theme through `prefers-color-scheme`, with a
  Light / Dark / Auto toggle in the footer (stored in `localStorage`).
- Fonts (Google Fonts, with system fallbacks): Instrument Serif (display), Geist (text),
  Geist Mono (labels, data).
- One accent, oxide red (`#a23b27` light, `#e0775e` dark).
- Motion is quiet and honours `prefers-reduced-motion`. Reveals are gated on a `.js` class so
  content is never hidden without JavaScript.

## Hero simulation

`balancer.js` simulates a two-wheeled self-balancing robot (wheeled inverted pendulum) in the
browser. At load it linearises the model about upright, discretises it exactly (matrix
exponential, 100 Hz), and computes the LQR gain by iterating the discrete Riccati equation to
convergence. The controller then drives the full nonlinear plant (RK4) with friction, actuator
saturation and sensor noise it does not model. It pauses when off-screen or when the tab is
hidden, and sleeps once the robot has settled.

## Notes

- AETHER-1 is shown at a high level only (code private; no landing-sequence video is published
  pre-patent-filing, the EU has no disclosure grace period).
- Videos are H.264 MP4s with `preload="none"`; small ones play while visible, the 22 MB AETHER-1
  montage waits for a click. YouTube demos are click-to-load (`youtube-nocookie.com`).
- Content mirrors the owner's CV (role at CESI LINEACT, Rouen; experience, publications,
  education); contact is email + GitHub + LinkedIn + YouTube. Phone number is intentionally
  not published.
