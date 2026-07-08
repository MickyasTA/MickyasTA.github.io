# mickyasta.github.io

Personal portfolio of **Mickyas Tamiru Asfaw** — robotics, reinforcement learning, control.

Live at: **https://mickyasta.github.io**

## Structure

```
index.html              # main page: hero, flagship (AETHER-1), projects, experience,
                        #   publications, education, skills, about, contact
projects/aether-1.html  # AETHER-1 deep-dive page (high-level, code private)
projects/mybot.html               # mybot wheel-legged biped deep-dive (code private)
projects/collision-avoidance.html # DRL quadrotor collision avoidance deep-dive (code private)
assets/css/style.css    # single stylesheet (dark engineering theme)
assets/js/main.js       # scroll reveals + video coordination
assets/img/  assets/video/  # curated media
.nojekyll               # serve as plain static files
```

Plain static site — no build step. Edit the HTML/CSS directly and push to `main`.

## Notes

- AETHER-1 is shown at a high level only (code private; no landing-sequence video is published
  pre-patent-filing — the EU has no disclosure grace period).
- Videos are H.264 MP4s kept small (< 7 MB) for fast loads; the collision-avoidance demo was
  transcoded from GIF with ffmpeg.
- Some project demos (Duckietown lane following, palletizing arm) are embedded as
  privacy-enhanced YouTube (`youtube-nocookie.com`) iframes inside the project cards.
- Content mirrors the owner's CV (role at CESI LINEACT, Rouen; experience, publications,
  education); contact is email + GitHub + LinkedIn + YouTube. Phone number is intentionally
  not published.
