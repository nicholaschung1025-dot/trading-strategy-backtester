# Data formats

Falcon Lab exports two files. Both are versioned in the file name
(`_v1`) so a later format change can be detected downstream.

## trades_<TICKER>_v1.csv

One row per closed trade, newest first. UTF-8, comma separated, no
BOM, `\n` line endings.

| Column | Type | Meaning |
| --- | --- | --- |
| `entry_date` | `YYYY-MM-DD` | Bar date of the entry |
| `exit_date` | `YYYY-MM-DD` | Bar date of the exit |
| `entry_price` | float (4 dp) | Fill price used for the entry |
| `exit_price` | float (4 dp) | Fill price used for the exit |
| `shares` | float or int | Position size; fractional when the run used fractional sizing |
| `pnl` | float (2 dp) | Net profit in account currency, fees included |
| `return_pct` | float (4 dp) | Return on the entry cost |
| `bars_held` | int | Bars between entry and exit |
| `reason` | text | `Take profit`, `Stop loss`, `Signal` or `End of data` |

## report_<TICKER>_v1.txt

UTF-8 **with BOM** so Windows Notepad opens it correctly. Sections:
`STRATEGY` (rules, stop, target, capital, fees, position sizing, weekly
filter), `PERFORMANCE` (metrics) and `TRADES` (one line per trade).

The report always states the **data source**:

- `Simulated series · not real market data` — a built-in universe
- `Yahoo Finance · adjusted daily` — real history fetched through the proxy
- `Custom CSV` — a file you supplied

## Input: custom OHLCV CSV

Header names are matched case-insensitively; `date` (or `datetime`) is
required, as are `open`, `high`, `low` and `close`. `volume` is optional.
Dates are parsed with `new Date(...)`, so ISO `YYYY-MM-DD` is recommended.
Rows are sorted by time and at least 60 bars are required.
