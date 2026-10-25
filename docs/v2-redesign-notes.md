# Falcon Lab v2 — redesign

A dark editorial redesign of `../falcon-backtest` (Falcon Lab strategy workbench).
The backtest engine is untouched: all logic in `src/` is reused as-is, so every
metric, chart, and export behaves identically to the original.

## Run

```bash
python -m http.server 8080
# open http://localhost:8080/
```

`server.py` (same as the original) is the optional Yahoo Finance proxy.

## What changed vs the original

- No simulated stock data. All four synthetic series (SPY-SIM, TSLA-SIM,
  BTC-SIM, GCF-SIM) and their random generator are gone. Data now comes from
  Yahoo Finance (bundled proxy) or a user CSV only.
- Preset ticker chips in the rail (AAPL, MSFT, NVDA, TSLA, AMZN, META, GOOGL,
  SPY, QQQ, BTC-USD, ETH-USD, 0700.HK); SPY loads on start. Any other Yahoo
  ticker can be typed.
- The Compare tab now takes any ticker: type QQQ, BTC-USD, 0700.HK... and it
  fetches the same period, runs the identical rules, and overlays the results.
- Dark editorial design system: Outfit + JetBrains Mono (self-hosted in
  `assets/`), warm near-black surfaces, ember accent (theme variants: ember /
  slate / forest / midnight).
- Floating glass command nav, editorial masthead with the run status as the
  hero line, generous section spacing.
- Dense stat bento (12 tiles, zero empty cells at every breakpoint,
  `grid-auto-flow: dense`).
- Scroll-reveal chapters and staggered stat tiles via GSAP
  (self-hosted; degrades gracefully offline).
- All motion honours `prefers-reduced-motion: reduce`; the threads background
  and every scroll animation collapse to their static end state.
- Fixed the original's toggle bug: hidden checkbox inputs are anchored to
  their own label (`.switch { position: relative }`), so clicking a switch can
  no longer yank the sidebar scroll.
- Fixed-attachment background removed (Chromium compositor glitch); ambient
  gradients live on a dedicated fixed layer.
- Shell scrolls internally (100dvh shell, internal scrollers), matching the
  proven architecture of the original app.

## Files

- `index.html` — new shell (all element IDs preserved for the engine)
- `styles.css` — complete redesign
- `src/motion.js` — GSAP motion layer (new)
- `src/*` — engine, charts, threads, state, util (engine.js: simulation
  generator removed; app.js: presets + compare-by-ticker)
- `assets/` — self-hosted GSAP, ScrollTrigger and web fonts (CSP-safe)
