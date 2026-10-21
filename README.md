# Trading Strategy Backtester

[![CI](https://github.com/nicholaschung1025-dot/trading-strategy-backtester/actions/workflows/ci.yml/badge.svg)](https://github.com/nicholaschung1025-dot/trading-strategy-backtester/actions/workflows/ci.yml)
[![Pages](https://github.com/nicholaschung1025-dot/trading-strategy-backtester/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/nicholaschung1025-dot/trading-strategy-backtester/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-c2410c.svg)](LICENSE)

**Falcon Lab** — a zero-dependency trading-strategy backtester. It runs
from a static file server, needs no build step, and the whole interface is
one predictable set of design tokens.

![Overview of the Falcon Lab workbench](docs/preview.png)

## Quick start

```bash
python server.py          # http://127.0.0.1:8765/index.html
```

No pip install is required — the server only uses the Python standard
library. You can also open `index.html` straight from disk; the app boots
fine and only the Yahoo Finance lookup needs the local server.

```bash
npm run lint              # syntax + hygiene checks
npm test                  # engine golden tests + colour contrast tests
npm run check             # both
```

### Run the server automatically

| Platform | Command | Notes |
| --- | --- | --- |
| Windows, one click | `start.bat` | Starts the server minimised and opens the browser |
| macOS / Linux | `./start.sh` | Same, opens the browser |
| Windows, at every log on | `powershell -ExecutionPolicy Bypass -File scripts\install-autostart.ps1` | Creates a scheduled task; remove it with the same script plus `-Uninstall` |
| Any host with Docker | `docker compose up -d` | `restart: unless-stopped`, so it comes back after a reboot |
| Linux VPS (systemd) | `sudo cp deploy/falcon-lab.service /etc/systemd/system/ && sudo systemctl enable --now falcon-lab` | Runs as a service on `PORT=8765` |
| VS Code | `Terminal → Run Task… → "Serve Falcon Lab"` | Background task you can start with F5 |

The server reads `PORT` from the environment (default `8765`) and binds
`0.0.0.0` whenever `PORT` is set, so it works unchanged behind Docker,
systemd or a hosted platform.

## Deploy

### GitHub Pages (static, one click)

1. Push this repository to GitHub with the default branch `main`.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. The `Deploy to GitHub Pages` workflow publishes the site to
   <https://nicholaschung1025-dot.github.io/trading-strategy-backtester/>.

Everything works on the published site: the simulated universes, custom
CSV files, every chart, the themes and the exports.

#### Where the Yahoo proxy runs

GitHub Pages cannot execute Python — it only runs static assets plus
*Pages Functions* (JavaScript). So the proxy for the Pages site is the
Pages Function in `functions/api/yahoo.js`, which is the same job
`server.py` does locally.

Pages Functions are only mounted when the site source is set to
**GitHub Actions** (Settings → Pages → Build and deployment → Source).
The REST API cannot toggle that, so it is the one manual click in this
README. Until it is set, the app says so instead of failing silently.

If you would rather run the real `server.py`, deploy it anywhere that
runs Python (Render, Railway, Fly, a VPS) — it starts automatically and
sends `Access-Control-Allow-Origin: *`, so the Pages site can use it.
Point the app at it in two ways:

* open the site with `?api=https://your-app.onrender.com`, or
* open the **Deployment** panel in the left rail and paste the base URL.

Both remember the choice in `localStorage`.

### Any Python host (Render, Railway, Fly, Heroku…)

`render.yaml` is included, so Render can deploy with the Infra button. On
other platforms the start command is `python server.py` (see `Procfile`).
The server reads `PORT` from the environment and binds `0.0.0.0` when it
is set.

This is the way to get the *real* `server.py` running automatically for
users of the GitHub Pages site: deploy it here, then point the Pages site
at it with `?api=https://your-app.onrender.com` (or the Deployment
panel in the left rail).

```bash
# Render blueprint (from the repo root)
render blueprint launch
```

## What it does

* **Strategy builder** — entry/exit rules over 30+ indicators (SMA, EMA,
  RSI, MACD, Bollinger, ATR, Stochastic, ADX, VWAP, OBV…), combined with
  AND/OR logic.
* **Risk model** — capital, stop loss, take profit, commission, slippage,
  weekly trend filter, and fractional or whole-share sizing.
* **Results** — net P&L, return, win rate, profit factor, max drawdown,
  Sharpe/Sortino/Calmar, streaks, expectancy, equity curve vs buy &
  hold, underwater drawdown, and a monthly returns heat map.
* **Interaction** — zoom, pan and reset on every chart (wheel, drag,
  keyboard, double click), trade markers with hover details, and a data
  table behind each chart.
* **Compare** — run the same rules against a second universe.
* **Export** — trades CSV and a full text report (see
  [`docs/DATA_FORMATS.md`](docs/DATA_FORMATS.md)).

## Data sources

* **Simulated universes** (default) — deterministic series generated by the
  app itself. Their tickers end in `-SIM` because they are *not* real
  prices.
* **Yahoo Finance** — real adjusted daily history through the proxy.
* **Custom CSV** — your own OHLCV file (see `docs/DATA_FORMATS.md`).

## Layout

```
index.html        markup only (no inline CSS or JS)
styles.css        design tokens + every theme
threads.css       background animation container
src/util.js       DOM + formatting helpers
src/indicators.js SMA, EMA, RSI, MACD, Bollinger, ATR, Stoch, ADX, VWAP, OBV…
src/state.js      the single shared state object
src/engine.js     dataset generation, CSV/Yahoo parsing, rule DSL, backtest engine
src/charts.js     canvas rendering, zoom/pan, accessible data tables
src/app.js        UI wiring, themes, exports
src/threads.js    WebGL background animation
functions/        GitHub Pages Function for the Yahoo proxy
legacy/streamlit/ the original Python/Streamlit app, kept for reference
tests/            node:test suites (engine golden values, WCAG contrast)
scripts/          lint + Windows auto-start installer
deploy/           systemd unit
start.bat         Windows: start the server and open the browser
start.sh          macOS / Linux: same
Dockerfile        container image
server.py         static server + Yahoo Finance proxy
```

## The original Streamlit app

The repository started life as a Python/Streamlit backtester. It still
lives in [`legacy/streamlit/`](legacy/) as a reference implementation of
the same engine — the web workbench is a port of it, not a rewrite from
scratch. Nothing in the root project imports from that folder.

## Design rules worth keeping

* Colours live in tokens only; the contrast test fails the build if a
  pair drops below WCAG AA.
* Every chart has a `<details>` data table so the numbers are reachable
  without a mouse.
* The engine is pure and has no DOM dependency, which is why it can be
  unit tested in Node.
* Built-in universes must stay labelled as simulated.

## License

MIT — see [LICENSE](LICENSE).
