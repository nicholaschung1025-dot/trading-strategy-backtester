# trading-strategy-backtester

A comprehensive, interactive, web-based quantitative trading backtesting platform built with Streamlit and Plotly. It allows users to design, test, and visualize custom rule-based trading strategies with advanced risk management, multi-timeframe (MTF) analysis, and deep performance analytics.

## Key Features

- **Data Integration**: Fetch historical data directly from Yahoo Finance or upload custom OHLCV CSV files.
- **Visual Strategy Builder**: Create complex Entry/Exit logic using a visual interface. Combine multiple indicators with `AND`/`OR` logic and crossover conditions.
- **Multi-Timeframe (MTF) Analysis**: Filter entries on a lower timeframe (e.g., Daily) while using higher timeframe (e.g., Weekly) indicators for exit signals or trend confirmation.
- **Advanced Risk Management**: Simulate real-world conditions with customizable Stop Loss (SL), Take Profit (TP), Commission fees, and Slippage.
- **Rich Interactive Visualizations**: 
  - Candlestick, Line, and Area charts with Trade Markers (Buy/Sell).
  - Market Regime detection overlays.
  - Sub-charts for RSI, MACD, and Bollinger Bands.
  - Equity Curve vs. Buy & Hold Benchmark.
  - Underwater Drawdown Chart.
  - Monthly Returns Heatmap.
- **Strategy Comparison**: Run side-by-side backtests on different assets using the exact same strategy rules and compare normalized equity curves and drawdowns.
- **Presets & Templates**: Quick-start with pre-built classic strategies (Golden Cross, RSI Reversion, MACD Momentum, etc.) and save your own custom configurations.
- **Exporting**: Download detailed Trade Logs (CSV) and comprehensive Performance Reports (TXT).

## Project Structure

```text
.
├── app.py            # Main Streamlit UI, session state, and layout logic
├── backtester.py     # Core backtesting engine, condition evaluator, and metrics calculator
├── charts.py         # Plotly chart generation (Price, Equity, Drawdown, Heatmap)
├── config.py         # UI Themes, CSS, Strategy Types, Indicators, and Templates
├── data.py           # Data fetching (Yahoo/CSV), normalization, and MTF resampling
└── indicators.py     # (Required) Technical indicator calculations (e.g., SMA, RSI, MACD)
```

## Installation & Dependencies

To run this application, you need Python 3.8+ and the following libraries:

```bash
pip install streamlit pandas numpy plotly yfinance
```

*Note: Ensure you have the `indicators.py` file in the root directory, as it is required by `data.py` and `backtester.py` to compute technical analysis metrics.*

## Usage

1. Clone the repository and navigate to the project folder.
2. Ensure all `.py` files (including `indicators.py`) are in the same directory.
3. Run the Streamlit app:
   ```bash
   streamlit run app.py
   ```
4. The application will open in your default web browser (usually at `http://localhost:8501`).

## How to Use the App

### 1. Load Data
Use the sidebar to search for a Ticker Symbol (e.g., `AAPL`, `BTC-USD`) via Yahoo Finance or upload a local CSV. Select your desired Date Range.

### 2. Configure Strategy
Navigate to the **STRATEGY** tab:
- **Rule Templates**: Click "Apply" on built-in templates like *Golden Cross* or *RSI Reversion*.
- **Custom Rules**: Add Entry (Buy) and Exit (Sell) rules. You can compare Indicators to Indicators (e.g., `SMA 10 > SMA 50`) or Indicators to Values (e.g., `RSI 14 < 30`).
- **Risk Management**: Set your Stop Loss %, Take Profit %, Position Size, and simulate Commission/Slippage.
- **MTF Analysis**: Toggle "Enable MTF Analysis" to use Weekly/Monthly data for specific exit conditions.

### 3. Run & Analyze
Click **RUN BACKTEST**. Once complete, explore the tabs:
- **RESULTS**: View high-level metrics (Sharpe, Sortino, Calmar, Profit Factor, Max Drawdown) and interactive equity/drawdown charts.
- **TRADE LOG**: Inspect every individual trade, including duration, P&L, and exit reasons (Signal, SL, TP).
- **COMPARE**: Load a second ticker to see how the strategy performs across different assets side-by-side.

## Supported Indicators & Operations

**Indicators**:
- **Trend**: SMA, EMA, VWAP, ADX, +DI, -DI
- **Momentum**: RSI, MACD, Stochastic, Williams %R, CCI
- **Volatility**: Bollinger Bands, ATR
- **Volume**: OBV, Volume

**Operations**:
`>`, `>=`, `<`, `<=`, `==`, `!=`, `crosses_above`, `crosses_below`

## Disclaimer

This tool is built for educational and research purposes only. The backtesting engine does not account for all real-world market friction (e.g., liquidity constraints, partial fills, flash crashes). Past performance in backtests does not guarantee future results in live trading. Always paper-trade and conduct thorough due diligence before risking real capital.
