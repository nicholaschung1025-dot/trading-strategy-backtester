import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from datetime import datetime

from config import t, CSS, hex_alpha, STRAT_TYPES, IND_LABEL, ALL_IND, ALL_OPS, ALL_MTF_IND, RULE_TEMPLATES, PRESETS
from indicators import compute_indicators
from backtester import run_backtest
from data import load_yahoo_data
from charts import build_price_chart, build_equity_chart, build_drawdown_chart, build_heatmap

st.set_page_config(page_title="Strategy Backtester", page_icon="◆", layout="wide", initial_sidebar_state="expanded")
st.markdown(CSS, unsafe_allow_html=True)


# ═══════════════════════════════════════════════════════════════════════════════
#  SESSION STATE
# ═══════════════════════════════════════════════════════════════════════════════
defaults = {
    'market_data': None, 'backtest_results': None, 'entry_rules': [], 'exit_rules': [],
    'entry_logic': 'AND', 'exit_logic': 'AND', 'stop_loss': 3.0, 'take_profit': 6.0,
    'date_start': None, 'date_end': None, 'loaded_symbol': None,
    'commission': 0.0, 'slippage': 0.0,
    'comparison_results': None, 'comparison_symbol': None,
    'show_regime': False, 'show_benchmark': False,
    'show_indicators': [],
    'use_mtf': False, 'exit_timeframe': 'weekly',
    'applied_template': None,
}
for k, v in defaults.items():
    if k not in st.session_state:
        st.session_state[k] = v


# ═══════════════════════════════════════════════════════════════════════════════
#  SIDEBAR
# ═══════════════════════════════════════════════════════════════════════════════
with st.sidebar:
    st.markdown("## STRATEGY BACKTESTER")
    st.markdown("---")

    st.markdown('<div class="section-label">DATA SOURCE</div>', unsafe_allow_html=True)
    data_src = st.radio("Source", ["Yahoo Finance", "Upload CSV"], horizontal=True, label_visibility="collapsed")

    if data_src == "Yahoo Finance":
        col1, col2 = st.columns([2, 1])
        with col1:
            symbol = st.text_input("Ticker Symbol", value="AAPL", placeholder="e.g. AAPL, MSFT, TSLA")
        with col2:
            period = st.selectbox("Period", ["1y", "2y", "5y", "10y", "15y", "20y", "max"], index=2)

        if st.button("Load Data", use_container_width=True, type="primary"):
            placeholder = st.empty()
            placeholder.markdown(f"""
            <div class="skeleton-block" style="height:40px;"></div>
            <div class="skeleton-block" style="height:20px; width:60%;"></div>
            <div class="skeleton-block" style="height:20px; width:80%;"></div>
            """, unsafe_allow_html=True)
            try:
                raw = load_yahoo_data(symbol, period)
                if raw is None:
                    placeholder.empty()
                    st.error(f"No data found for '{symbol.upper()}'. Check the ticker symbol.")
                else:
                    st.session_state.market_data = raw
                    st.session_state.loaded_symbol = symbol.upper()
                    st.session_state.date_start = raw['date'].iloc[0].date()
                    st.session_state.date_end = raw['date'].iloc[-1].date()
                    st.session_state.backtest_results = None
                    st.session_state.comparison_results = None
                    st.session_state.comparison_symbol = None
                    placeholder.empty()
                    st.toast(f"Loaded {symbol.upper()}: {len(raw)} bars", icon="✅")
                    st.rerun()
            except Exception as e:
                placeholder.empty()
                st.error(f"Failed to fetch data: {e}")
    else:
        uploaded = st.file_uploader("Upload OHLCV CSV", type=['csv'])
        if uploaded:
            try:
                df = pd.read_csv(uploaded)
                col_map = {}
                for c in df.columns:
                    cl = c.strip().lower()
                    if cl in ['date', 'datetime', 'time', 'timestamp']:
                        col_map[c] = 'date'
                    elif cl in ['open', 'o']:
                        col_map[c] = 'open'
                    elif cl in ['high', 'h']:
                        col_map[c] = 'high'
                    elif cl in ['low', 'l']:
                        col_map[c] = 'low'
                    elif cl in ['close', 'c', 'adj close', 'adj_close']:
                        col_map[c] = 'close'
                    elif cl in ['volume', 'vol', 'v']:
                        col_map[c] = 'volume'
                df = df.rename(columns=col_map)
                req = ['date', 'open', 'high', 'low', 'close', 'volume']
                miss = [c for c in req if c not in df.columns]
                if miss:
                    st.error(f"Missing columns: {miss}")
                else:
                    df['date'] = pd.to_datetime(df['date'])
                    df = df[req].sort_values('date').reset_index(drop=True)
                    st.session_state.market_data = df
                    st.session_state.loaded_symbol = "CSV"
                    st.session_state.date_start = df['date'].iloc[0].date()
                    st.session_state.date_end = df['date'].iloc[-1].date()
                    st.session_state.backtest_results = None
                    st.session_state.comparison_results = None
                    st.session_state.comparison_symbol = None
                    st.toast(f"Loaded {len(df)} bars", icon="✅")
                    st.rerun()
            except Exception as e:
                st.error(f"Error: {e}")

    st.markdown("---")

    if st.session_state.market_data is not None:
        raw_df = st.session_state.market_data
        min_d = raw_df['date'].iloc[0].date()
        max_d = raw_df['date'].iloc[-1].date()

        st.markdown('<div class="section-label">TIME PERIOD</div>', unsafe_allow_html=True)
        c1, c2 = st.columns(2)
        with c1:
            ds = st.date_input("Start", value=st.session_state.date_start or min_d,
                               min_value=min_d, max_value=max_d, key="ds")
        with c2:
            de = st.date_input("End", value=st.session_state.date_end or max_d,
                               min_value=min_d, max_value=max_d, key="de")
        st.session_state.date_start = ds
        st.session_state.date_end = de

        mask = (raw_df['date'].dt.date >= ds) & (raw_df['date'].dt.date <= de)
        df = raw_df[mask].reset_index(drop=True)

        if st.session_state.backtest_results is not None and len(df) > 0:
            bt_start = st.session_state.backtest_results.get('trades_df')
            if bt_start is not None and len(bt_start) > 0:
                st.warning("Date range changed. Rerun the backtest to update results.")

        st.markdown("---")
        st.markdown('<div class="section-label">DATA INFO</div>', unsafe_allow_html=True)
        sym_display = st.session_state.get('loaded_symbol', '')
        st.markdown(f"**{sym_display}**  |  {len(df):,} bars")
        st.markdown(f"{ds.strftime('%Y-%m-%d')} to {de.strftime('%Y-%m-%d')}")
        if len(df) > 0:
            c1, c2 = st.columns(2)
            c1.metric("Open", f"${df['open'].iloc[0]:,.2f}")
            c2.metric("Close", f"${df['close'].iloc[-1]:,.2f}")
            chg = (df['close'].iloc[-1] - df['close'].iloc[0]) / df['close'].iloc[0] * 100
            st.metric("Period Change", f"{chg:+.2f}%")
        st.markdown("---")

    st.markdown('<div class="section-label">PRESETS</div>', unsafe_allow_html=True)
    preset_name = st.selectbox("Load Preset", list(PRESETS.keys()), label_visibility="collapsed")
    if st.button("Apply Preset", use_container_width=True):
        p = PRESETS[preset_name]
        st.session_state.entry_rules = [dict(r) for r in p['entry']]
        st.session_state.exit_rules = [dict(r) for r in p['exit']]
        st.session_state.entry_logic = p['el']
        st.session_state.exit_logic = p['xl']
        st.session_state.stop_loss = p['sl']
        st.session_state.take_profit = p['tp']
        st.session_state.commission = p.get('comm', 0.0)
        st.session_state.slippage = p.get('slip', 0.0)
        st.rerun()

    st.markdown("---")

    st.markdown('<div class="section-label">MULTI-TIMEFRAME</div>', unsafe_allow_html=True)
    use_mtf = st.checkbox("Enable MTF Analysis", value=st.session_state.use_mtf,
        help="Use higher timeframe for exit signals (e.g., daily entry, weekly exit)")
    exit_tf = st.selectbox("Exit Timeframe", ['weekly', 'monthly'], index=0, disabled=not use_mtf)
    st.session_state.use_mtf = use_mtf
    st.session_state.exit_timeframe = exit_tf

    st.markdown("---")

    st.markdown('<div class="section-label">SAVE / EXPORT</div>', unsafe_allow_html=True)
    save_name = st.text_input("Preset Name", value="My Strategy", key="save_name_input")
    if st.button("Save Preset", use_container_width=True):
        preset_data = {
            'entry_rules': st.session_state.entry_rules,
            'exit_rules': st.session_state.exit_rules,
            'entry_logic': st.session_state.entry_logic,
            'exit_logic': st.session_state.exit_logic,
            'stop_loss': st.session_state.stop_loss, 'take_profit': st.session_state.take_profit,
            'commission': st.session_state.commission, 'slippage': st.session_state.slippage,
            'use_mtf': st.session_state.use_mtf, 'exit_timeframe': st.session_state.exit_timeframe,
        }
        saved = st.session_state.get('saved_presets', {})
        saved[save_name] = preset_data
        st.session_state.saved_presets = saved
        st.toast(f"Preset '{save_name}' saved", icon="💾")

    saved = st.session_state.get('saved_presets', {})
    if saved:
        loaded_name = st.selectbox("Load Saved Preset", list(saved.keys()), label_visibility="collapsed")
        sc1, sc2 = st.columns([3, 1])
        with sc1:
            if st.button("Load Saved", use_container_width=True):
                p = saved[loaded_name]
                st.session_state.entry_rules = [dict(r) for r in p['entry_rules']]
                st.session_state.exit_rules = [dict(r) for r in p['exit_rules']]
                st.session_state.entry_logic = p['entry_logic']
                st.session_state.exit_logic = p['exit_logic']
                st.session_state.stop_loss = p['stop_loss']
                st.session_state.take_profit = p['take_profit']
                st.session_state.commission = p.get('commission', 0.0)
                st.session_state.slippage = p.get('slippage', 0.0)
                st.session_state.use_mtf = p.get('use_mtf', False)
                st.session_state.exit_timeframe = p.get('exit_timeframe', 'weekly')
                st.toast(f"Loaded: {loaded_name}", icon="✅")
                st.rerun()
        with sc2:
            if st.button("🗑", key="del_preset", help="Delete saved preset"):
                del saved[loaded_name]
                st.session_state.saved_presets = saved
                st.toast(f"Deleted: {loaded_name}", icon="🗑")
                st.rerun()


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN CONTENT
# ═══════════════════════════════════════════════════════════════════════════════
if st.session_state.market_data is None:
    st.markdown(f"""
    <div style="text-align:center; padding: 80px 20px;">
        <div style="font-size: 42px; color: {t['text_muted']}; margin-bottom: 12px;">&#9670;</div>
        <h2 style="color: {t['text_secondary']}; font-weight: 400; font-size: 20px; margin-bottom: 8px;">Load a stock to begin</h2>
        <p style="color: {t['text_muted']}; font-size: 13px;">Enter a ticker symbol (e.g. AAPL, TSLA, BTC-USD) in the sidebar and click Load Data</p>
        <p style="color: {t['text_muted']}; font-size: 12px; margin-top: 8px;">Keyboard: Ctrl+Enter = Run Backtest | Ctrl+S = Save Preset</p>
    </div>""", unsafe_allow_html=True)
    st.stop()

raw_df = st.session_state.market_data
if st.session_state.date_start and st.session_state.date_end:
    mask = (raw_df['date'].dt.date >= st.session_state.date_start) & (raw_df['date'].dt.date <= st.session_state.date_end)
    df = raw_df[mask].reset_index(drop=True)
else:
    df = raw_df

if len(df) == 0:
    st.warning("No data in selected date range. Adjust the time period.")
    st.stop()

sym = st.session_state.get('loaded_symbol', '')
st.markdown(f"""<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
    <span style="color:{t['text_primary']}; font-size:18px; font-weight:700;">{sym}</span>
    <span style="color:{t['text_muted']}; font-size:12px; font-family:monospace;">{len(df):,} bars  |  {df['date'].iloc[0].strftime('%Y-%m-%d')} to {df['date'].iloc[-1].strftime('%Y-%m-%d')}</span>
</div>""", unsafe_allow_html=True)

cc1, cc2, cc3, cc4 = st.columns(4)
with cc1:
    chart_type = st.radio("Chart", ["candlestick", "line", "area"], index=0, label_visibility="collapsed")
with cc2:
    show_regime = st.checkbox("Regime Overlay", value=st.session_state.show_regime)
    st.session_state.show_regime = show_regime
with cc3:
    show_benchmark = st.checkbox("Buy & Hold", value=st.session_state.show_benchmark)
    st.session_state.show_benchmark = show_benchmark
with cc4:
    ind_options = ['RSI', 'MACD', 'Bollinger']
    show_inds = st.multiselect("Sub-Charts", ind_options, default=st.session_state.show_indicators)
    st.session_state.show_indicators = show_inds

df = compute_indicators(df)
trades_for_chart = st.session_state.backtest_results['trades_df'] if st.session_state.backtest_results else None
price_fig = build_price_chart(df, trades_for_chart, chart_type, show_inds, show_regime)
st.plotly_chart(price_fig, use_container_width=True, config={
    'scrollZoom': True, 'displayModeBar': True,
    'modeBarButtonsToRemove': ['lasso2d', 'select2d', 'autoScale2d'],
    'displaylogo': False, 'responsive': True,
})

if st.session_state.backtest_results and st.session_state.backtest_results['equity_df'] is not None:
    r = st.session_state.backtest_results
    edf = r['equity_df']
    if len(edf) > 0:
        last_eq = edf['equity'].iloc[-1]
        init = r['initial_capital']
        total_ret = (last_eq - init) / init * 100
        ci1, ci2, ci3, ci4, ci5 = st.columns(5)
        ci1.metric("Last Equity", f"${last_eq:,.2f}")
        ci2.metric("Total Return", f"{total_ret:+.2f}%")
        ci3.metric("Trades", f"{r['total_trades']}")
        ci4.metric("Win Rate", f"{r['win_rate']:.1f}%")
        ci5.metric("Max DD", f"{r['max_drawdown']:.2f}%")

tab_strategy, tab_results, tab_trades, tab_compare = st.tabs(
    ["STRATEGY", "RESULTS", "TRADE LOG", "COMPARE"])


# ── STRATEGY TAB ───────────────────────────────────────────────────────────────
def render_rule(rule, idx, key_prefix, use_mtf=False):
    strat_types = list(STRAT_TYPES.keys())
    current_type = rule.get('strat_type', 'Custom (Any)')
    try:
        type_idx = strat_types.index(current_type)
    except ValueError:
        type_idx = len(strat_types) - 1

    st.markdown(f"<div class='rule-header'>Rule {idx + 1}</div>", unsafe_allow_html=True)

    new_type = st.selectbox("Strategy Type", strat_types, index=type_idx,
        key=f"{key_prefix}_type_{idx}", label_visibility="collapsed")
    rule['strat_type'] = new_type

    cfg = STRAT_TYPES[new_type]
    allowed_left = cfg['left'] if cfg['left'] is not None else ALL_IND
    allowed_right = cfg['right'] if cfg['right'] is not None else ALL_IND
    if use_mtf:
        allowed_left = allowed_left + [x for x in ALL_MTF_IND if any(k in x for k in allowed_left)]
        allowed_right = allowed_right + [x for x in ALL_MTF_IND if any(k in x for k in allowed_right)]
    allowed_ops = cfg['ops']

    c1, c2, c3, c4, c5 = st.columns([1, 3, 2, 3, 1])

    with c1:
        new_order = st.number_input("Ord", min_value=1, max_value=20, value=idx + 1,
            key=f"{key_prefix}_ord_{idx}", label_visibility="collapsed", help="Rule order (lower = higher priority)")

    with c2:
        cl = rule.get('left', allowed_left[0])
        if cl not in allowed_left:
            cl = allowed_left[0]
        try:
            l_idx = allowed_left.index(cl)
        except ValueError:
            l_idx = 0
        rule['left'] = st.selectbox("L", allowed_left, index=l_idx,
            format_func=lambda x: IND_LABEL.get(x, x), key=f"{key_prefix}_l_{idx}", label_visibility="collapsed")

    with c3:
        co = rule.get('op', allowed_ops[0])
        if co not in allowed_ops:
            co = allowed_ops[0]
        try:
            o_idx = allowed_ops.index(co)
        except ValueError:
            o_idx = 0
        rule['op'] = st.selectbox("Op", allowed_ops, index=o_idx,
            key=f"{key_prefix}_op_{idx}", label_visibility="collapsed")

    with c4:
        is_value = rule.get('right_type') == 'value'
        if is_value:
            rule['right'] = st.text_input("V", value=rule.get('right', '50'),
                key=f"{key_prefix}_val_{idx}", label_visibility="collapsed", placeholder="Value")
        else:
            cr = rule.get('right', allowed_right[0])
            if cr not in allowed_right:
                cr = allowed_right[0]
            try:
                r_idx = allowed_right.index(cr)
            except ValueError:
                r_idx = 0
            rule['right'] = st.selectbox("R", allowed_right, index=r_idx,
                format_func=lambda x: IND_LABEL.get(x, x), key=f"{key_prefix}_r_{idx}", label_visibility="collapsed")
        rt = st.radio("T", ["indicator", "value"], index=1 if is_value else 0,
            horizontal=True, key=f"{key_prefix}_rt_{idx}", label_visibility="collapsed")
        rule['right_type'] = rt

    with c5:
        if st.button("x", key=f"{key_prefix}_del_{idx}", help="Remove rule"):
            return None, new_order

    return rule, new_order


with tab_strategy:
    st.markdown(f'<div class="section-label">RULE TEMPLATES</div>', unsafe_allow_html=True)
    tmpl_names = list(RULE_TEMPLATES.keys())
    tmpl_cols = st.columns(len(tmpl_names))
    for i, (col, name) in enumerate(zip(tmpl_cols, tmpl_names)):
        data = RULE_TEMPLATES[name]
        with col:
            st.markdown(f"**{name}**")
            st.caption(data['desc'])
    btn_cols = st.columns(len(tmpl_names))
    for i, (col, name) in enumerate(zip(btn_cols, tmpl_names)):
        data = RULE_TEMPLATES[name]
        with col:
            if st.button("Apply", key=f"tmpl_{i}", use_container_width=True):
                st.session_state.entry_rules = [dict(r) for r in data['entry']]
                st.session_state.exit_rules = [dict(r) for r in data['exit']]
                st.session_state.entry_logic = data['el']
                st.session_state.exit_logic = data['xl']
                st.session_state.stop_loss = data['sl']
                st.session_state.take_profit = data['tp']
                if data.get('mtf'):
                    st.session_state.use_mtf = True
                    st.session_state.exit_timeframe = data.get('exit_tf', 'weekly')
                st.session_state.applied_template = name
                st.toast(f"Loaded: {name}", icon="✅")
                st.rerun()

    if st.session_state.entry_rules or st.session_state.exit_rules:
        def _summarize_rules(rules, label):
            parts = []
            for r in rules:
                left = IND_LABEL.get(r.get('left', ''), r.get('left', '?'))
                op = r.get('op', '?')
                right = IND_LABEL.get(r.get('right', ''), r.get('right', '?')) if r.get('right_type') != 'value' else r.get('right', '?')
                parts.append(f"{left} {op} {right}")
            logic = st.session_state.entry_logic if 'entry' in label.lower() else st.session_state.exit_logic
            return f"**{label}** ({logic}): " + " | ".join(parts)

        entry_summary = _summarize_rules(st.session_state.entry_rules, "Entry") if st.session_state.entry_rules else ""
        exit_summary = _summarize_rules(st.session_state.exit_rules, "Exit") if st.session_state.exit_rules else ""
        summary = f"{entry_summary}<br>{exit_summary}" if entry_summary and exit_summary else (entry_summary or exit_summary)
        applied = st.session_state.get('applied_template', '')
        header = f"Applied: <b>{applied}</b><br>" if applied else ""
        st.markdown(f"""<div style="background:{t['bg_elevated']}; border:1px solid {t['border_light']}; border-left:3px solid {t['blue']};
            padding:10px 14px; border-radius:3px; margin-bottom:12px; font-size:12px; color:{t['text_secondary']};
            font-family:'JetBrains Mono',monospace; line-height:1.6;">{header}{summary}</div>""", unsafe_allow_html=True)

    if st.session_state.get('applied_template'):
        for prefix, rules in [('e', st.session_state.entry_rules), ('x', st.session_state.exit_rules)]:
            for i, rule in enumerate(rules):
                st.session_state[f'{prefix}_type_{i}'] = rule.get('strat_type', 'Custom (Any)')
                st.session_state[f'{prefix}_l_{i}'] = rule.get('left', '')
                st.session_state[f'{prefix}_op_{i}'] = rule.get('op', '')
                st.session_state[f'{prefix}_r_{i}'] = rule.get('right', '')
                st.session_state[f'{prefix}_val_{i}'] = rule.get('right', '50')
                st.session_state[f'{prefix}_rt_{i}'] = rule.get('right_type', 'indicator')
                st.session_state[f'{prefix}_ord_{i}'] = i + 1
        st.session_state.applied_template = None

    st.markdown("---")

    col_left, col_right = st.columns(2)

    with col_left:
        st.markdown(f'<div class="section-label entry-label">ENTRY RULES (BUY)</div>', unsafe_allow_html=True)
        entry_logic = st.radio("Entry logic", ["AND", "OR"], index=0, horizontal=True, key="el_radio", label_visibility="collapsed")
        st.session_state.entry_logic = entry_logic

        if not st.session_state.entry_rules:
            st.session_state.entry_rules = [{'strat_type': 'Price vs MA', 'left': 'close', 'op': '>', 'right': 'sma_20', 'right_type': 'indicator'}]

        new_entry = []
        entry_orders = []
        for i, rule in enumerate(st.session_state.entry_rules):
            with st.container():
                st.markdown(f"<div class='rule-card'>", unsafe_allow_html=True)
                result = render_rule(rule, i, 'e', st.session_state.use_mtf)
                if result is None or result[0] is None:
                    st.session_state.entry_rules.pop(i)
                    st.rerun()
                else:
                    new_entry.append(result[0])
                    entry_orders.append(result[1])
                st.markdown("</div>", unsafe_allow_html=True)

        if entry_orders:
            new_entry = [rule for _, rule in sorted(zip(entry_orders, new_entry), key=lambda x: x[0])]
        st.session_state.entry_rules = new_entry

        if st.button("+ Add Entry Rule", key="ae"):
            st.session_state.entry_rules.append({'strat_type': 'Price vs MA', 'left': 'close', 'op': '>', 'right': 'sma_20', 'right_type': 'indicator'})
            st.rerun()

    with col_right:
        st.markdown(f'<div class="section-label exit-label">EXIT RULES (SELL)</div>', unsafe_allow_html=True)
        exit_logic = st.radio("Exit logic", ["AND", "OR"], index=0, horizontal=True, key="xl_radio", label_visibility="collapsed")
        st.session_state.exit_logic = exit_logic

        if not st.session_state.exit_rules:
            st.session_state.exit_rules = [{'strat_type': 'Price vs MA', 'left': 'close', 'op': '<', 'right': 'sma_20', 'right_type': 'indicator'}]

        new_exit = []
        exit_orders = []
        for i, rule in enumerate(st.session_state.exit_rules):
            with st.container():
                st.markdown(f"<div class='rule-card sell-rule'>", unsafe_allow_html=True)
                result = render_rule(rule, i, 'x', st.session_state.use_mtf)
                if result is None or result[0] is None:
                    st.session_state.exit_rules.pop(i)
                    st.rerun()
                else:
                    new_exit.append(result[0])
                    exit_orders.append(result[1])
                st.markdown("</div>", unsafe_allow_html=True)

        if exit_orders:
            new_exit = [rule for _, rule in sorted(zip(exit_orders, new_exit), key=lambda x: x[0])]
        st.session_state.exit_rules = new_exit

        if st.button("+ Add Exit Rule", key="ax"):
            st.session_state.exit_rules.append({'strat_type': 'Price vs MA', 'left': 'close', 'op': '<', 'right': 'sma_20', 'right_type': 'indicator'})
            st.rerun()

    st.markdown("---")

    st.markdown(f'<div class="section-label">RISK MANAGEMENT</div>', unsafe_allow_html=True)
    rm1, rm2, rm3, rm4, rm5 = st.columns(5)
    with rm1:
        sl = st.number_input("Stop Loss (%)", min_value=0.0, max_value=50.0, value=st.session_state.stop_loss, step=0.5, format="%.1f")
    with rm2:
        tp = st.number_input("Take Profit (%)", min_value=0.0, max_value=500.0, value=st.session_state.take_profit, step=0.5, format="%.1f")
    with rm3:
        pos_size = st.number_input("Position Size ($)", min_value=100, max_value=10000000, value=10000, step=1000)
    with rm4:
        commission = st.number_input("Commission (%)", min_value=0.0, max_value=5.0, value=st.session_state.commission, step=0.01, format="%.3f")
    with rm5:
        slippage = st.number_input("Slippage (%)", min_value=0.0, max_value=5.0, value=st.session_state.slippage, step=0.01, format="%.3f")
    st.session_state.stop_loss = sl
    st.session_state.take_profit = tp
    st.session_state.commission = commission
    st.session_state.slippage = slippage

    st.markdown("---")
    if st.button("RUN BACKTEST", use_container_width=True, type="primary", key="run"):
        with st.spinner("Running backtest..."):
            results = run_backtest(df, st.session_state.entry_rules, st.session_state.exit_rules,
                st.session_state.entry_logic, st.session_state.exit_logic, sl, tp, pos_size,
                commission, slippage, st.session_state.use_mtf, st.session_state.exit_timeframe)
            st.session_state.backtest_results = results
        st.toast(f"Backtest complete -- {results['total_trades']} trades found", icon="✅")
        st.rerun()


# ── RESULTS TAB ────────────────────────────────────────────────────────────────
with tab_results:
    if st.session_state.backtest_results is None:
        st.info("Run a backtest to see results.")
    else:
        r = st.session_state.backtest_results
        m1, m2, m3, m4, m5, m6 = st.columns(6)
        pc = "normal" if r['net_pnl'] >= 0 else "inverse"
        m1.metric("Net P&L", f"${r['net_pnl']:,.2f}", f"{r['total_return']:+.2f}%", delta_color=pc)
        m2.metric("Total Return", f"{r['total_return']:+.2f}%")
        m3.metric("Total Trades", f"{r['total_trades']}")
        m4.metric("Win Rate", f"{r['win_rate']:.1f}%")
        m5.metric("Profit Factor", f"{r['profit_factor']:.2f}")
        m6.metric("Max Drawdown", f"{r['max_drawdown']:.2f}%")

        m7, m8, m9, m10, m11, m12 = st.columns(6)
        m7.metric("Avg Win", f"${r['avg_win']:,.2f}")
        m8.metric("Avg Loss", f"${r['avg_loss']:,.2f}")
        m9.metric("Sharpe Ratio", f"{r['sharpe']:.2f}")
        m10.metric("Sortino Ratio", f"{r['sortino']:.2f}")
        m11.metric("Calmar Ratio", f"{r['calmar']:.2f}")
        m12.metric("Expectancy", f"${r['expectancy']:,.2f}")

        if r.get('total_commission', 0) > 0:
            st.info(f"Total commission + slippage paid: ${r['total_commission']:,.2f}")

        st.markdown("---")

        if r['equity_df'] is not None and len(r['equity_df']) > 0:
            eq_fig = build_equity_chart(r['equity_df'], r['initial_capital'],
                show_benchmark=st.session_state.show_benchmark, benchmark_data=df)
            if eq_fig:
                st.plotly_chart(eq_fig, use_container_width=True)

            dd_fig = build_drawdown_chart(r['equity_df'])
            if dd_fig:
                st.markdown(f'<div class="section-label">DRAWDOWN</div>', unsafe_allow_html=True)
                st.plotly_chart(dd_fig, use_container_width=True)

        hm_fig = build_heatmap(r['equity_df'])
        if hm_fig:
            st.markdown(f'<div class="section-label">MONTHLY RETURNS</div>', unsafe_allow_html=True)
            st.plotly_chart(hm_fig, use_container_width=True)

        if r['trades_df'] is not None and len(r['trades_df']) > 0:
            st.markdown("---")
            ec1, ec2 = st.columns(2)
            with ec1:
                csv_data = r['trades_df'].to_csv(index=False)
                st.download_button("Download Trades CSV", csv_data,
                    file_name=f"trades_{sym}_{datetime.now().strftime('%Y%m%d')}.csv",
                    mime="text/csv", use_container_width=True)
            with ec2:
                metrics_str = "\n".join([f"{k}: {v}" for k, v in r.items()
                    if k not in ['trades_df', 'equity_df'] and not isinstance(v, (pd.DataFrame, dict))])
                report = f"Strategy Backtest Report\n{'='*50}\nSymbol: {sym}\nDate: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n\n{metrics_str}\n\nTrades:\n"
                if len(r['trades_df']) > 0:
                    report += r['trades_df'].to_string(index=False)
                st.download_button("Download Report TXT", report,
                    file_name=f"report_{sym}_{datetime.now().strftime('%Y%m%d')}.txt",
                    mime="text/plain", use_container_width=True)


# ── TRADE LOG TAB ──────────────────────────────────────────────────────────────
with tab_trades:
    if st.session_state.backtest_results is None:
        st.info("Run a backtest to see trade log.")
    else:
        r = st.session_state.backtest_results
        tdf = r['trades_df']
        if len(tdf) == 0:
            st.warning("No trades were executed.")
        else:
            st.markdown(f"**{len(tdf)} trades** executed")
            ddf = tdf.copy()
            ddf.index = range(1, len(ddf) + 1)
            ddf.index.name = '#'
            ddf['entry_date'] = pd.to_datetime(ddf['entry_date']).dt.strftime('%Y-%m-%d')
            ddf['exit_date'] = pd.to_datetime(ddf['exit_date']).dt.strftime('%Y-%m-%d')
            ddf['entry_price'] = ddf['entry_price'].map('${:,.2f}'.format)
            ddf['exit_price'] = ddf['exit_price'].map('${:,.2f}'.format)
            ddf['pnl'] = ddf['pnl'].map('${:,.2f}'.format)
            ddf['return_pct'] = ddf['return_pct'].map('{:+.2f}%'.format)
            ddf['duration'] = ddf['duration'].map(lambda x: f"{x} bars")
            ddf = ddf.rename(columns={'entry_date': 'Entry Date', 'entry_price': 'Entry Price', 'exit_date': 'Exit Date',
                'exit_price': 'Exit Price', 'pnl': 'P&L', 'return_pct': 'Return %', 'duration': 'Duration', 'reason': 'Exit Reason'})
            st.dataframe(ddf[['Entry Date', 'Entry Price', 'Exit Date', 'Exit Price', 'P&L', 'Return %', 'Duration', 'Exit Reason']],
                use_container_width=True, height=min(500, len(ddf) * 35 + 40))


# ── COMPARE TAB ────────────────────────────────────────────────────────────────
with tab_compare:
    st.markdown(f'<div class="section-label">BACKTEST COMPARISON</div>', unsafe_allow_html=True)

    if st.session_state.backtest_results is None:
        st.info("Run a backtest first, then load comparison data.")
    else:
        comp1, comp2 = st.columns([1, 1])
        with comp1:
            comp_symbol = st.text_input("Compare Ticker", value="MSFT", key="comp_sym",
                placeholder="e.g. MSFT, GOOGL")
            comp_period = st.selectbox("Compare Period", ["1y", "2y", "5y", "10y", "max"], index=2, key="comp_period")
            if st.button("Load & Compare", use_container_width=True):
                try:
                    comp_raw = load_yahoo_data(comp_symbol, comp_period)
                    if comp_raw is not None:
                        if st.session_state.date_start and st.session_state.date_end:
                            mask2 = (comp_raw['date'].dt.date >= st.session_state.date_start) & \
                                    (comp_raw['date'].dt.date <= st.session_state.date_end)
                            comp_df = comp_raw[mask2].reset_index(drop=True)
                        else:
                            comp_df = comp_raw

                        if len(comp_df) == 0:
                            st.error("No comparison data in the selected date range.")
                        else:
                            init_cap = st.session_state.backtest_results['initial_capital']
                            comp_result = run_backtest(comp_df, st.session_state.entry_rules, st.session_state.exit_rules,
                                st.session_state.entry_logic, st.session_state.exit_logic,
                                st.session_state.stop_loss, st.session_state.take_profit, init_cap,
                                st.session_state.commission, st.session_state.slippage,
                                st.session_state.use_mtf, st.session_state.exit_timeframe)
                            st.session_state.comparison_results = comp_result
                            st.session_state.comparison_symbol = comp_symbol.upper()
                            st.toast(f"Comparison loaded: {comp_symbol.upper()}", icon="✅")
                            st.rerun()
                    else:
                        st.error(f"No data for '{comp_symbol.upper()}'")
                except Exception as e:
                    st.error(f"Error: {e}")

        with comp2:
            if st.session_state.comparison_results is not None:
                r1 = st.session_state.backtest_results
                r2 = st.session_state.comparison_results
                sym2 = st.session_state.comparison_symbol

                st.markdown(f"**{sym}** vs **{sym2}**")

                metrics = ['total_return', 'win_rate', 'profit_factor', 'max_drawdown', 'sharpe', 'sortino', 'total_trades']
                metric_labels = ['Total Return', 'Win Rate', 'Profit Factor', 'Max Drawdown', 'Sharpe', 'Sortino', 'Total Trades']
                metric_fmts = ['{:+.2f}%', '{:.1f}%', '{:.2f}', '{:.2f}%', '{:.2f}', '{:.2f}', '{}']

                comp_table = []
                for m, lbl, fmt in zip(metrics, metric_labels, metric_fmts):
                    v1 = r1.get(m, 0)
                    v2 = r2.get(m, 0)
                    comp_table.append({
                        'Metric': lbl,
                        sym: fmt.format(v1),
                        sym2: fmt.format(v2),
                    })

                cdf = pd.DataFrame(comp_table)
                st.dataframe(cdf, use_container_width=True, hide_index=True)

                if r1['equity_df'] is not None and r2['equity_df'] is not None:
                    st.markdown(f'<div class="section-label">EQUITY COMPARISON</div>', unsafe_allow_html=True)
                    eq1 = r1['equity_df']
                    eq2 = r2['equity_df']
                    eq1_norm = eq1['equity'] / eq1['equity'].iloc[0] * 100
                    eq2_norm = eq2['equity'] / eq2['equity'].iloc[0] * 100

                    comp_eq_fig = go.Figure()
                    comp_eq_fig.add_trace(go.Scatter(x=eq1['date'], y=eq1_norm,
                        line=dict(color=t['blue'], width=1.5, shape='spline'), name=sym))
                    comp_eq_fig.add_trace(go.Scatter(x=eq2['date'], y=eq2_norm,
                        line=dict(color=t['orange'], width=1.5, shape='spline'), name=sym2))
                    comp_eq_fig.add_hline(y=100, line_dash='dash', line_color=t['text_muted'], line_width=0.5)
                    comp_eq_fig.update_layout(
                        template=t['plotly_template'], paper_bgcolor=t['bg_deepest'], plot_bgcolor=t['chart_bg'],
                        font=dict(family='JetBrains Mono', color=t['chart_font'], size=11),
                        margin=dict(l=55, r=16, t=8, b=8), height=300,
                        hovermode='x', hoverlabel=dict(bgcolor=t['hover_bg'], font_size=11),
                        showlegend=True, legend=dict(x=0.01, y=0.99, font=dict(size=10)))
                    comp_eq_fig.update_xaxes(gridcolor=t['chart_grid'])
                    comp_eq_fig.update_yaxes(gridcolor=t['chart_grid'], title='Normalized (%)')
                    st.plotly_chart(comp_eq_fig, use_container_width=True)

                    dd1 = (eq1['equity'].cummax() - eq1['equity']) / eq1['equity'].cummax() * 100
                    dd2 = (eq2['equity'].cummax() - eq2['equity']) / eq2['equity'].cummax() * 100
                    dd_comp_fig = go.Figure()
                    dd_comp_fig.add_trace(go.Scatter(x=eq1['date'], y=-dd1,
                        line=dict(color=t['blue'], width=1, shape='spline'), name=f'{sym} DD', fill='tozeroy',
                        fillcolor=hex_alpha(t['blue'], 15)))
                    dd_comp_fig.add_trace(go.Scatter(x=eq2['date'], y=-dd2,
                        line=dict(color=t['orange'], width=1, shape='spline'), name=f'{sym2} DD', fill='tozeroy',
                        fillcolor=hex_alpha(t['orange'], 15)))
                    dd_comp_fig.update_layout(
                        template=t['plotly_template'], paper_bgcolor=t['bg_deepest'], plot_bgcolor=t['chart_bg'],
                        font=dict(family='JetBrains Mono', color=t['chart_font'], size=11),
                        margin=dict(l=55, r=16, t=8, b=8), height=200,
                        hovermode='x', hoverlabel=dict(bgcolor=t['hover_bg'], font_size=11),
                        showlegend=True, legend=dict(x=0.01, y=0.99, font=dict(size=10)),
                        yaxis=dict(title='Drawdown %'))
                    dd_comp_fig.update_xaxes(gridcolor=t['chart_grid'])
                    dd_comp_fig.update_yaxes(gridcolor=t['chart_grid'])
                    st.plotly_chart(dd_comp_fig, use_container_width=True)
            else:
                st.info("Enter a ticker and click 'Load & Compare' to see side-by-side comparison.")
