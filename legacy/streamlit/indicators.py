import numpy as np
import pandas as pd


def sma(s, p):
    return s.rolling(window=p, min_periods=p).mean()


def ema(s, p):
    return s.ewm(span=p, adjust=False).mean()


def rsi(s, p=14):
    d = s.diff()
    g = d.where(d > 0, 0.0)
    l = (-d.where(d < 0, 0.0))
    ag = g.ewm(alpha=1/p, min_periods=p).mean()
    al = l.ewm(alpha=1/p, min_periods=p).mean()
    return 100 - (100 / (1 + ag / al))


def macd(s, fast=12, slow=26, sig=9):
    ml = ema(s, fast) - ema(s, slow)
    sl = ema(ml, sig)
    return ml, sl, ml - sl


def bollinger(s, p=20, sd=2):
    m = sma(s, p)
    st = s.rolling(window=p, min_periods=p).std()
    return m + sd * st, m, m - sd * st


def atr(h, l, c, p=14):
    tr = pd.concat([h - l, (h - c.shift(1)).abs(), (l - c.shift(1)).abs()], axis=1).max(axis=1)
    return tr.rolling(window=p, min_periods=p).mean()


def stochastic(h, l, c, kp=14, dp=3):
    ll = l.rolling(kp, min_periods=kp).min()
    hh = h.rolling(kp, min_periods=kp).max()
    k = 100 * (c - ll) / (hh - ll).replace(0, np.nan)
    return k, k.rolling(dp, min_periods=dp).mean()


def adx_calc(h, l, c, p=14):
    pdm = h.diff()
    mdm = -l.diff()
    pdm = pdm.where((pdm > mdm) & (pdm > 0), 0.0)
    mdm = mdm.where((mdm > pdm) & (mdm > 0), 0.0)
    av = atr(h, l, c, p)
    pdi = 100 * ema(pdm, p) / av.replace(0, np.nan)
    mdi = 100 * ema(mdm, p) / av.replace(0, np.nan)
    dx = 100 * (pdi - mdi).abs() / (pdi + mdi).replace(0, np.nan)
    return ema(dx, p), pdi, mdi


def vwap(h, l, c, v):
    tp = (h + l + c) / 3
    cv = v.cumsum()
    return (tp * v).cumsum() / cv


def obv(c, v):
    return (v * np.sign(c.diff())).cumsum()


def williams_r(h, l, c, p=14):
    return -100 * (h.rolling(p, min_periods=p).max() - c) / (h.rolling(p, min_periods=p).max() - l.rolling(p, min_periods=p).min())


def cci(h, l, c, p=20):
    tp = (h + l + c) / 3
    m = sma(tp, p)
    md = tp.rolling(p, min_periods=p).apply(lambda x: np.abs(x - x.mean()).mean(), raw=True)
    return (tp - m) / (0.015 * md)


def compute_indicators(df):
    c, h, l, v = df['close'], df['high'], df['low'], df['volume']
    for p in [10, 20, 50, 200]:
        df[f'sma_{p}'] = sma(c, p)
    for p in [9, 12, 21, 26, 50]:
        df[f'ema_{p}'] = ema(c, p)
    for p in [7, 14, 21]:
        df[f'rsi_{p}'] = rsi(c, p)
    ml, sl, hist = macd(c)
    df['macd'] = ml
    df['macd_signal'] = sl
    df['macd_hist'] = hist
    bu, bm, bl = bollinger(c)
    df['bb_upper'] = bu
    df['bb_middle'] = bm
    df['bb_lower'] = bl
    df['bb_width'] = (bu - bl) / bm.replace(0, np.nan)
    df['atr_14'] = atr(h, l, c, 14)
    sk, sd = stochastic(h, l, c)
    df['stoch_k'] = sk
    df['stoch_d'] = sd
    av, pdi, mdi = adx_calc(h, l, c)
    df['adx'] = av
    df['plus_di'] = pdi
    df['minus_di'] = mdi
    df['vwap'] = vwap(h, l, c, v)
    df['obv'] = obv(c, v)
    df['williams_r'] = williams_r(h, l, c)
    df['cci'] = cci(h, l, c)
    return df
