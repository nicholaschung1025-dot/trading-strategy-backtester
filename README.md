# Trading Strategy Backtester

[![License: MIT](https://img.shields.io/badge/License-MIT-c2410c.svg)](LICENSE)

**Falcon Lab** — a zero-dependency trading-strategy backtester. One
Python file serves it, no build step, no npm install, and the whole
interface is driven by a single set of design tokens.

The interface is the redesigned dark/light editorial layout (formerly
`falcon-lab-v2/`, now the main project): preset tickers in the rail, a
backtest overlay against any ticker, full light mode, and GSAP
scroll-reveal motion that degrades gracefully offline. See
[docs/v2-redesign-notes.md](docs/v2-redesign-notes.md) for what changed
versus the original layout, which now lives in
[`legacy/root-v1/`](legacy/root-v1).

It is a **local tool**: clone it and run it on your own machine. There is
no public website, because the Yahoo Finance lookup needs the Python
proxy in `server.py` — the browser cannot call Yahoo directly (CORS).

---

## 1. Install it

```bash
git clone https://github.com/nicholaschung1025-dot/trading-strategy-backtester.git
cd trading-strategy-backtester
```

That is the whole installation. **Falcon Lab has no dependencies** — the
server uses only the Python standard library and the interface is plain
HTML/CSS/JavaScript. No `pip install`, no `npm install`, no build step.

| Requirement | Version | Needed for |
| --- | --- | --- |
| [Python](https://www.python.org/downloads/) | 3.8 or newer | `server.py` — the local server and the Yahoo Finance proxy |

Check what you already have:

```bash
python --version    # Windows
python3 --version   # macOS / Linux
node --version      # optional
```

**No Git installed?** On the repository page press **Code → Download
ZIP**, unzip it and open the extracted folder — it runs from there
unchanged.

**Prefer Docker?** The container files (Dockerfile, docker-compose.yml)
have moved to [`legacy/root-v1/`](legacy/root-v1) together with the
previous interface; copy one back to the root if you want to containerise
the current one.

**Already cloned it earlier?** Update in place with `git pull`.

Next: [2. Start it](#2-start-it).

## 2. Start it

```bash
python server.py
```

Then open <http://127.0.0.1:8765/index.html>.

* Nothing to install — the server only uses the Python standard library.
* `index.html` also opens straight from disk (`python -m http.server
  8080` works too), but then the Yahoo Finance lookup has no proxy to
  talk to, so only local CSV files work.

The server reads `PORT` from the environment (default `8765`) and binds
`0.0.0.0` whenever `PORT` is set, so it works unchanged behind Docker,
systemd or a hosted platform.

## 3. Use it

The screen has three parts: **Data** and **Strategy** on the left rail,
the results on the right.

**① Choose the data**

| Where | What you get | How |
| --- | --- | --- |
| Preset tickers | AAPL, MSFT, NVDA, TSLA, AMZN, META, GOOGL, SPY, QQQ, BTC-USD, ETH-USD, 0700.HK | Click a chip in the left rail — SPY loads on start |
| Yahoo Finance | Real adjusted daily bars | Type any Yahoo ticker (`^GSPC`, `0700.HK`, …) in **Data → Yahoo Finance** and press **Load** |
| Custom CSV | Your own OHLCV file | **Data → Custom OHLCV → Choose CSV** — the file is parsed in your browser and never uploaded |

There are no simulated universes in this layout — all data comes from
Yahoo Finance (through the bundled proxy) or your own CSV.

**② Describe the strategy**

* **Template** — six ready-made strategies (Golden Cross, RSI Reversion,
  MACD Momentum, Bollinger Squeeze, Dual Timeframe, Trend + Oscillator).
  Pick one and edit from there.
* **Rules** — add entry and exit conditions with `+ Entry rule` /
  `+ Exit rule`. Each condition is *indicator · operator · value or
  indicator*, and the row under the rule switches the right-hand side
  between a number and another indicator. Combine the rows with **AND** or
  **OR**.
* **Risk** — capital, stop loss %, take profit %, commission %, slippage %,
  the weekly trend filter and whether fractional shares are allowed.

**③ Run it**

Press **Run backtest** (or change anything — the app re-runs itself).
The status line on the right shows the trade count and the total return.

**④ Read the result**

* **Metric tiles** — net P&L, total return, trades, win rate, profit
  factor, max drawdown, Sharpe, Sortino, Calmar, average win/loss, fees.
* **Price & execution** — price with the SMA overlays, green triangles for
  entries and orange/red triangles for exits. Hover a marker for the
  trade details.
* **Equity curve** — strategy against buy & hold.
* **Drawdown** — the underwater curve.
* **Monthly returns** — one heat map cell per month, green or red.
* **Show data table** — every chart carries a table of exactly what is on
  screen, so the numbers are reachable without a mouse.
* **Trade log** — every closed trade with entry, exit, size, P&L, return,
  holding time and the reason it closed.

**⑤ Compare** — the *Compare* tab takes any ticker: type `QQQ`,
`BTC-USD`, `0700.HK`… and it fetches the same period, runs the identical
rules, and puts the two equity curves side by side.

**⑥ Export** — **Download trades CSV** for a spreadsheet, or
**Download report TXT** for the full write-up (see
[`docs/DATA_FORMATS.md`](docs/DATA_FORMATS.md)).

### Shortcuts

| Action | How |
| --- | --- |
| Zoom a chart | Mouse wheel, or the `−` / `+` buttons, or `+` / `-` when the chart has focus |
| Pan a chart | Drag with the mouse, or the `←` / `→` arrow keys |
| Reset a chart | The `↺` button, double click, or `0` / `Home` |
| Trade details | Hover a triangle on the price chart |
| Change theme | The colour dots in the header (saved in the browser) |
| Pause the background | The wave button in the header |
| Reduce motion | Honoured automatically via `prefers-reduced-motion` |

## 4. Where the data comes from

* **Yahoo Finance** — real adjusted daily history, fetched through the
  local proxy in `server.py` (the browser cannot call Yahoo directly
  because of CORS).
* **Custom CSV** — `date, open, high, low, close, volume`; at least 60
  rows; parsed locally.

## 5. Run it on a hosted platform (optional)

Falcon Lab is a **local-first tool** — there is no public website. The
Yahoo Finance lookup needs a proxy, and the proxy is Python, so the app
runs from a server you start yourself.

A hosted `server.py` starts on its own and sends
`Access-Control-Allow-Origin: *`, so a static front end on another host
can use it: open the site with `?api=https://your-app.onrender.com`, or
paste the base URL into the **Deployment** panel in the left rail. Both
remember the choice in `localStorage`.

## 6. Data & privacy

**What the app sends, and where**

| Data | Where it goes | Notes |
| --- | --- | --- |
| Your uploaded CSV | **Nowhere** | Read with `FileReader` in the browser, parsed locally, never uploaded. There is no upload endpoint. |
| A ticker you type | The Yahoo proxy you configured | Only the symbol and the period. The proxy forwards it to `query1.finance.yahoo.com` and returns price history. |
| Your theme, background-animation and proxy preferences | Your browser's `localStorage` | Three keys only: `falcon-theme`, `falcon-bg-anim`, `falcon-api-base`. Nothing else is stored, and the proxy one can be cleared from the Deployment panel. |

**What the app never does**

* No analytics, no telemetry, no beacons, no error reporting, no cookies.
* No user accounts, no sessions, no server-side storage of anything.
* No request to any host other than the proxy you configured (enforced by
  `legacy/root-v1/tests/privacy.test.mjs`).

**Server-side hygiene** (`server.py`)

* Access logs contain the path only — the query string, and therefore the
  tickers people look up, is never written to the log.
* The rate limiter keeps a truncated SHA-256 hash of the client address
  instead of the address itself, and forgets it after the window.
* Responses carry `Content-Security-Policy`, `Referrer-Policy:
  no-referrer`, `X-Content-Type-Options`, `X-Frame-Options` and
  `Permissions-Policy`. The CSP allows scripts only from the same
  origin, so no third-party code can be injected.

**Two things worth knowing**

* Yahoo Finance data is for personal use; check their terms before
  redistributing it commercially.
* Git commits in this repository carry your e-mail address in the author
  field. If you would rather keep it private, enable *Settings → Emails
  → Keep my email address private* and rewrite the history with
  `git filter-repo --email-callback 'git commit --email=%an <%anon@users.noreply.github.com>'`.

Run `npm test` inside [`legacy/root-v1/`](legacy/root-v1) to verify the
server-side hygiene of that generation — the privacy suite fails the
build if any of these invariants is broken. (The Node test suites pin the
original layout's engine, whose metric logic this interface reuses.)

## 7. Layout

```
index.html        markup only (no inline CSS or JS)
styles.css        design tokens + every theme
src/util.js       DOM + formatting helpers
src/indicators.js SMA, EMA, RSI, MACD, Bollinger, ATR, Stoch, ADX, VWAP, OBV…
src/state.js      the single shared state object
src/engine.js     CSV/Yahoo parsing, rule DSL, backtest engine
src/charts.js     canvas rendering, zoom/pan, accessible data tables
src/app.js        UI wiring, themes, exports, preset tickers
src/boot.js       applies the saved theme before the first paint
src/threads.js    WebGL background animation
src/motion.js     GSAP scroll-reveal motion (self-hosted, reduced-motion aware)
assets/           self-hosted GSAP, ScrollTrigger and web fonts (CSP-safe)
docs/             data formats, redesign notes
legacy/streamlit/ the original Python/Streamlit app, kept for reference
legacy/root-v1/   the previous interface + its tests, Docker and deploy files
server.py         static server + Yahoo Finance proxy
```

## 8. Develop

The engine's metric logic is shared with the original layout, whose test
suites still guard it:

```bash
cd legacy/root-v1
npm run lint      # syntax + hygiene checks
npm test          # engine golden tests, colour contrast tests, privacy tests
npm run check     # both
```

* `tests/engine.test.mjs` pins the backtest results of every universe, so
  a change in the engine has to be a deliberate one.
* `tests/contrast.test.mjs` fails the build if any colour pair drops
  below WCAG AA.
* `tests/privacy.test.mjs` fails the build if analytics, cookies, extra
  storage keys, CSV uploads, query-string logging or unescaped values
  come back.

## 9. The original apps

The repository started life as a Python/Streamlit backtester — it lives
in [`legacy/streamlit/`](legacy/) as a reference implementation of the
same engine. The previous web layout (the original workbench with
simulated universes, plus its tests, Docker, systemd and auto-start
files) is kept in [`legacy/root-v1/`](legacy/root-v1). Nothing in the
root project imports from either folder.

## License

MIT — see [LICENSE](LICENSE).
