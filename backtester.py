import numpy as np
import pandas as pd
from indicators import compute_indicators
from data import compute_mtf_indicators


def get_val(expr, df, idx):
    if expr in df.columns:
        v = df[expr].iloc[idx]
        return v if pd.notna(v) else None
    return None


def eval_cond(cond, df, idx):
    lv = get_val(cond['left'], df, idx)
    if lv is None:
        return False
    try:
        rv = float(cond['right']) if cond['right_type'] == 'value' else get_val(cond['right'], df, idx)
    except (ValueError, TypeError):
        return False
    if rv is None:
        return False
    op = cond['op']
    if op == '>':
        return lv > rv
    if op == '>=':
        return lv >= rv
    if op == '<':
        return lv < rv
    if op == '<=':
        return lv <= rv
    if op == '==':
        return abs(lv - rv) < 1e-10
    if op == '!=':
        return abs(lv - rv) >= 1e-10
    if op in ('crosses_above', 'crosses_below') and idx >= 1:
        pl = get_val(cond['left'], df, idx - 1)
        try:
            pr = float(cond['right']) if cond['right_type'] == 'value' else get_val(cond['right'], df, idx - 1)
        except (ValueError, TypeError):
            return False
        if pl is None or pr is None:
            return False
        return (pl <= pr and lv > rv) if op == 'crosses_above' else (pl >= pr and lv < rv)
    return False


def eval_group(conds, logic, df, idx):
    if not conds:
        return False
    return all(eval_cond(c, df, idx) for c in conds) if logic == 'AND' else any(eval_cond(c, df, idx) for c in conds)


def detect_regime(prices, window=50, threshold=0.02):
    sma_val = prices.rolling(window=window, min_periods=window).mean()
    pct_diff = (prices - sma_val) / sma_val
    regime = pd.Series(0, index=prices.index)
    regime[pct_diff > threshold] = 1
    regime[pct_diff < -threshold] = -1
    return regime


def run_backtest(df, entry_conds, exit_conds, entry_logic, exit_logic, sl_pct, tp_pct, pos_size,
                 commission=0.0, slippage=0.0, use_mtf=False, exit_tf='weekly'):
    df = df.copy().reset_index(drop=True)
    if use_mtf:
        df = compute_mtf_indicators(df, exit_tf)
    df = compute_indicators(df)
    trades, equity_curve = [], []
    pos = None
    cash = pos_size
    total_commission = 0

    for i in range(len(df)):
        bar = df.iloc[i]
        if pos:
            ep, sh = pos['entry_price'], pos['shares']
            sl_hit = sl_pct > 0 and bar['low'] <= ep * (1 - sl_pct / 100)
            tp_hit = tp_pct > 0 and bar['high'] >= ep * (1 + tp_pct / 100)
            if sl_hit and tp_hit:
                sl_hit = bar['open'] <= ep
                tp_hit = not sl_hit
            if sl_hit:
                sx = ep * (1 - sl_pct / 100)
                if bar['open'] < sx:
                    sx = bar['open']
                exit_val = sh * sx
                comm = exit_val * commission / 100
                slip = exit_val * slippage / 100
                pnl = sh * (sx - ep) - comm - slip - pos['entry_fee']
                total_commission += comm + slip
                trades.append({'entry_date': pos['entry_date'], 'entry_price': ep, 'exit_date': bar['date'], 'exit_price': sx, 'pnl': pnl, 'return_pct': pnl / (sh * ep) * 100, 'duration': i - pos['entry_idx'], 'reason': 'Stop Loss'})
                cash += exit_val - comm - slip
                pos = None
            elif tp_hit:
                tx = ep * (1 + tp_pct / 100)
                if bar['open'] > tx:
                    tx = bar['open']
                exit_val = sh * tx
                comm = exit_val * commission / 100
                slip = exit_val * slippage / 100
                pnl = sh * (tx - ep) - comm - slip - pos['entry_fee']
                total_commission += comm + slip
                trades.append({'entry_date': pos['entry_date'], 'entry_price': ep, 'exit_date': bar['date'], 'exit_price': tx, 'pnl': pnl, 'return_pct': pnl / (sh * ep) * 100, 'duration': i - pos['entry_idx'], 'reason': 'Take Profit'})
                cash += exit_val - comm - slip
                pos = None
            elif eval_group(exit_conds, exit_logic, df, i):
                exit_val = sh * bar['close']
                comm = exit_val * commission / 100
                slip = exit_val * slippage / 100
                pnl = sh * (bar['close'] - ep) - comm - slip - pos['entry_fee']
                total_commission += comm + slip
                trades.append({'entry_date': pos['entry_date'], 'entry_price': ep, 'exit_date': bar['date'], 'exit_price': bar['close'], 'pnl': pnl, 'return_pct': pnl / (sh * ep) * 100, 'duration': i - pos['entry_idx'], 'reason': 'Signal'})
                cash += exit_val - comm - slip
                pos = None
        else:
            if eval_group(entry_conds, entry_logic, df, i):
                price = bar['close']
                total_cost_pct = 1 + (commission + slippage) / 100
                sh = int(cash / (price * total_cost_pct))
                if sh > 0:
                    entry_comm = sh * bar['close'] * commission / 100
                    entry_slip = sh * bar['close'] * slippage / 100
                    cash -= sh * bar['close'] + entry_comm + entry_slip
                    total_commission += entry_comm + entry_slip
                    pos = {'entry_idx': i, 'entry_date': bar['date'], 'entry_price': bar['close'], 'shares': sh, 'entry_fee': entry_comm + entry_slip}
        eq = cash + (pos['shares'] * bar['close'] if pos else 0)
        equity_curve.append({'date': bar['date'], 'equity': eq})

    if pos:
        last = df.iloc[-1]
        exit_val = pos['shares'] * last['close']
        comm = exit_val * commission / 100
        slip = exit_val * slippage / 100
        pnl = pos['shares'] * (last['close'] - pos['entry_price']) - comm - slip - pos['entry_fee']
        total_commission += comm + slip
        trades.append({'entry_date': pos['entry_date'], 'entry_price': pos['entry_price'], 'exit_date': last['date'], 'exit_price': last['close'], 'pnl': pnl, 'return_pct': pnl / (pos['shares'] * pos['entry_price']) * 100, 'duration': len(df) - 1 - pos['entry_idx'], 'reason': 'End of Data'})
        cash += exit_val - comm - slip
        pos = None
        if equity_curve:
            equity_curve[-1]['equity'] = cash

    result = calc_metrics(trades, equity_curve, pos_size, cash)
    result['total_commission'] = total_commission
    return result


def calc_metrics(trades, equity_curve, init_cap, final_cap):
    tdf = pd.DataFrame(trades) if trades else pd.DataFrame()
    edf = pd.DataFrame(equity_curve) if equity_curve else pd.DataFrame()
    n = len(tdf)
    pnl = final_cap - init_cap
    ret = pnl / init_cap * 100

    base = {'trades_df': tdf, 'equity_df': edf, 'net_pnl': pnl, 'total_return': ret, 'total_trades': n,
            'win_rate': 0, 'profit_factor': 0, 'max_drawdown': 0, 'avg_win': 0, 'avg_loss': 0,
            'sharpe': 0, 'max_consec_wins': 0, 'max_consec_losses': 0, 'avg_duration': 0,
            'best_trade': 0, 'worst_trade': 0, 'expectancy': 0, 'initial_capital': init_cap, 'final_capital': final_cap,
            'calmar': 0, 'sortino': 0, 'total_commission': 0}
    if n == 0:
        return base

    wins = tdf[tdf['pnl'] > 0]
    losses = tdf[tdf['pnl'] <= 0]
    wr = len(wins) / n * 100
    gp = wins['pnl'].sum() if len(wins) else 0
    gl = abs(losses['pnl'].sum()) if len(losses) else 0
    pf = gp / gl if gl > 0 else (float('inf') if gp > 0 else 0)
    eq_s = edf['equity']
    pk = eq_s.cummax()
    dd = (pk - eq_s) / pk * 100
    mdd = dd.max()
    dr = eq_s.pct_change().dropna()
    sh = (dr.mean() / dr.std()) * np.sqrt(252) if len(dr) > 1 and dr.std() > 0 else 0

    neg_dr = dr[dr < 0]
    down_std = neg_dr.std() if len(neg_dr) > 1 else 0
    sortino = (dr.mean() / down_std) * np.sqrt(252) if down_std > 0 else 0

    calmar = ret / mdd if mdd > 0 else 0

    cw = cl = mcw = mcl = 0
    for _, tr in tdf.iterrows():
        if tr['pnl'] > 0:
            cw += 1
            cl = 0
            mcw = max(mcw, cw)
        else:
            cl += 1
            cw = 0
            mcl = max(mcl, cl)

    return {**base,
        'win_rate': wr, 'profit_factor': pf, 'max_drawdown': mdd,
        'avg_win': wins['pnl'].mean() if len(wins) else 0,
        'avg_loss': losses['pnl'].mean() if len(losses) else 0,
        'sharpe': sh, 'sortino': sortino, 'calmar': calmar,
        'max_consec_wins': mcw, 'max_consec_losses': mcl,
        'avg_duration': tdf['duration'].mean(),
        'best_trade': tdf['return_pct'].max(), 'worst_trade': tdf['return_pct'].min(),
        'expectancy': pnl / n}
