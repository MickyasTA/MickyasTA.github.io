# mickyasta.github.io

Personal portfolio of **Mickyas Tamiru Asfaw** — robotics, reinforcement learning, control.

Live at: **https://mickyasta.github.io**

## Structure

```
index.html              # main page: hero, flagship (AETHER-1), projects, skills, about, contact
projects/aether-1.html  # AETHER-1 deep-dive page (high-level, code private)
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
