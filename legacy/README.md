# Legacy — the original Streamlit app

The repository originally shipped a Python/Streamlit backtester. The
current project at the repository root is **Falcon Lab**, a zero
dependency web port of the same engine (same indicators, same rule DSL,
same metrics, same risk model) with a far richer interface.

This folder keeps the original Python implementation for reference:

| File | Role |
| --- | --- |
| `streamlit/app.py` | Streamlit UI, session state, layout |
| `streamlit/backtester.py` | Backtest engine, condition evaluator, metrics |
| `streamlit/charts.py` | Plotly charts (price, equity, drawdown, heatmap) |
| `streamlit/config.py` | Themes, CSS, strategy types, indicators, templates |
| `streamlit/data.py` | Yahoo/CSV loading, normalisation, MTF resampling |
| `streamlit/indicators.py` | Indicator maths |
| `streamlit/requirements.txt` | `streamlit`, `pandas`, `numpy`, `plotly`, `yfinance` |

## Running it

```bash
cd legacy/streamlit
python -m venv .venv && .venv/Scripts/activate     # Windows
# source .venv/bin/activate                          # macOS / Linux
pip install -r requirements.txt
streamlit run app.py
```

It opens on <http://localhost:8501>.

## Why it is here

* The Python version is the reference implementation the web engine was
  ported from — useful when comparing behaviour.
* It is not wired into the web app, not deployed and not tested by CI.
* Nothing in the root project imports from this folder.
