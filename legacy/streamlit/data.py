import pandas as pd
import yfinance as yf
from indicators import compute_indicators


def normalize_ohlcv(raw):
    raw = raw.reset_index()
    raw.columns = [c.lower().replace(' ', '_') for c in raw.columns]
    if 'date' not in raw.columns:
        raw = raw.rename(columns={raw.columns[0]: 'date'})
    raw['date'] = pd.to_datetime(raw['date']).dt.tz_localize(None)
    req = ['date', 'open', 'high', 'low', 'close', 'volume']
    raw = raw[[c for c in req if c in raw.columns]].copy()
    for c in ['open', 'high', 'low', 'close']:
        if c in raw.columns:
            raw[c] = raw[c].astype(float)
    if 'volume' in raw.columns:
        raw['volume'] = pd.to_numeric(raw['volume'], errors='coerce').fillna(0).astype(int)
    return raw.sort_values('date').reset_index(drop=True)


def load_yahoo_data(symbol, period):
    ticker = yf.Ticker(symbol.upper())
    raw = ticker.history(period=period, auto_adjust=True)
    if raw.empty:
        return None
    return normalize_ohlcv(raw)


def resample_to_timeframe(df, tf):
    df2 = df.set_index('date').copy()
    rule = {'weekly': 'W', 'monthly': 'ME'}.get(tf, 'W')
    agg = {'open': 'first', 'high': 'max', 'low': 'min', 'close': 'last', 'volume': 'sum'}
    cols = [c for c in agg if c in df2.columns]
    df2 = df2[cols].resample(rule, label='right', closed='right').agg({k: v for k, v in agg.items() if k in cols}).dropna()
    df2 = df2.reset_index()
    df2['date'] = df2['date'] + pd.Timedelta(days=1)
    return df2


def compute_mtf_indicators(daily_df, exit_tf='weekly'):
    weekly = resample_to_timeframe(daily_df, exit_tf)
    weekly = compute_indicators(weekly)
    weekly_cols = {}
    for col in weekly.columns:
        if col not in ['date', 'open', 'high', 'low', 'close', 'volume']:
            weekly_cols[f'{col}_wtf'] = weekly[col]
    weekly_cols['date'] = weekly['date']
    wdf = pd.DataFrame(weekly_cols)
    daily_df = daily_df.sort_values('date')
    wdf = wdf.sort_values('date')
    merged = pd.merge_asof(daily_df, wdf, on='date', direction='backward')
    return merged
