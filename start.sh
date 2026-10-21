#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Falcon Lab - start the local server and open it in the default browser.
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 was not found on PATH." >&2
  exit 1
fi

echo "Starting Falcon Lab on http://127.0.0.1:8765/index.html ..."
python3 server.py &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT

sleep 2
if command -v open >/dev/null 2>&1; then open http://127.0.0.1:8765/index.html
elif command -v xdg-open >/dev/null 2>&1; then xdg-open http://127.0.0.1:8765/index.html
fi

wait "$SERVER_PID"
