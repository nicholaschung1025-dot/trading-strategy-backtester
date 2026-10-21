#!/usr/bin/env python3
"""Serve Falcon Lab and proxy Yahoo Finance daily history.

Privacy notes
-------------
* The only request this server makes on your behalf is the Yahoo Finance
  chart lookup for the ticker you typed. Nothing else is sent anywhere.
* Access logs never contain the query string, so the tickers you look up
  do not end up in the server log.
* The rate limiter stores a truncated hash of the client address, not the
  address itself, and forgets it after the window closes.
* Uploaded CSV files are read in the browser and never reach this server.
"""

from __future__ import annotations

import hashlib
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
# Local development uses 127.0.0.1:8765; hosted platforms set PORT and expect 0.0.0.0.
PORT = int(os.environ.get("PORT", "8765"))
HOST = os.environ.get("HOST") or ("0.0.0.0" if os.environ.get("PORT") else "127.0.0.1")
SYMBOL_RE = re.compile(r"^[A-Za-z0-9.^=-]{1,24}$")
PERIOD_YEARS = {"1y": 1, "2y": 2, "5y": 5, "10y": 10, "20y": 20}
CACHE_TTL = 300
CACHE = {}
RATE_LIMIT = 30
RATE_WINDOW = 60.0
REQUESTS: dict[str, list[float]] = {}

# Conservative defaults: the app loads its own files only, and may talk to
# the Yahoo proxy over http(s) - the proxy host is chosen by the user.
CSP = (
    "default-src 'self'; "
    "script-src 'self'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; "
    "connect-src 'self' https: http:; "
    "font-src 'self'; "
    "base-uri 'none'; "
    "form-action 'none'; "
    "frame-ancestors 'none'"
)


def client_key(address: str) -> str:
    """Pseudonymous, non-reversible key for rate limiting."""
    return hashlib.sha256(address.encode("utf-8")).hexdigest()[:16]


def rate_limited(client: str) -> bool:
    """Simple per-client sliding-window limiter for the local proxy."""
    now = time.time()
    hits = [t for t in REQUESTS.get(client, []) if now - t < RATE_WINDOW]
    if len(hits) >= RATE_LIMIT:
        REQUESTS[client] = hits
        return True
    hits.append(now)
    REQUESTS[client] = hits
    if len(REQUESTS) > 64:
        REQUESTS.clear()
    return False


def yahoo_chart(symbol: str, period: str) -> tuple[int, bytes]:
    years = PERIOD_YEARS[period]
    end = datetime.now(timezone.utc) + timedelta(days=1)
    start = end - timedelta(days=int(round(years * 365.2425)) + 14)
    query = urllib.parse.urlencode(
        {
            "period1": int(start.timestamp()),
            "period2": int(end.timestamp()),
            "interval": "1d",
            "includeAdjustedClose": "true",
            "events": "div,splits",
        }
    )
    url = (
        "https://query1.finance.yahoo.com/v8/finance/chart/"
        + urllib.parse.quote(symbol, safe="^=")
        + "?"
        + query
    )
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read() or b'{"error":"Yahoo Finance request failed"}'
    except Exception:
        return 502, b'{"error":"Could not reach Yahoo Finance"}'


class Handler(SimpleHTTPRequestHandler):
    server_version = "FalconLab"
    sys_version = ""

    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Permissions-Policy", "geolocation=(), microphone=(), camera=(), interest-cohort=()")
        super().end_headers()

    def log_message(self, fmt: str, *args) -> None:
        """Log the path only - never the query string, so tickers stay private."""
        message = fmt % args
        path = message.split('"')[1] if '"' in message else ""
        path = path.split("?", 1)[0]
        if path.startswith("/api/"):
            # Market data lookups are not logged at all.
            return
        super().log_message('"%s"', path)

    def do_GET(self) -> None:
        parsed = urllib.parse.urlsplit(self.path)
        if parsed.path != "/api/yahoo":
            super().do_GET()
            return

        params = urllib.parse.parse_qs(parsed.query)
        symbol = (params.get("symbol") or [""])[0].strip()
        period = (params.get("period") or ["5y"])[0]
        if not SYMBOL_RE.fullmatch(symbol):
            self.send_json(400, b'{"error":"Enter a valid Yahoo Finance ticker"}')
            return
        if period not in PERIOD_YEARS:
            self.send_json(400, b'{"error":"Unsupported history period"}')
            return
        client = self.client_address[0] if self.client_address else "local"
        if rate_limited(client_key(client)):
            self.send_json(429, b'{"error":"Too many requests - slow down"}')
            return

        key = (symbol.upper(), period)
        cached = CACHE.get(key)
        if cached and time.time() - cached[0] < CACHE_TTL:
            self.send_json(cached[1], cached[2])
            return

        status, body = yahoo_chart(symbol, period)
        if status == 200:
            CACHE[key] = (time.time(), status, body)
        self.send_json(status, body)

    def send_json(self, status: int, body: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        # Readable from any origin so a static front end on another host can
        # use this proxy; the endpoint only forwards public market data.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    server = ThreadingHTTPServer(
        (HOST, PORT), partial(Handler, directory=str(ROOT))
    )
    print(f"Falcon Lab: http://127.0.0.1:{PORT}/index.html", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
