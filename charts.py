import math
import pandas as pd
import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from config import t, hex_alpha
from backtester import detect_regime


def _resample_ohlcv(df, max_points=600):
    if len(df) <= max_points:
        return df
    step = max(1, math.ceil(len(df) / max_points))
    chunks = [df.iloc[i:i+step] for i in range(0, len(df), step)]
    rows = []
    has_ohlc = all(c in df.columns for c in ['open', 'high', 'low'])
    core_cols = {'date', 'open', 'high', 'low', 'close', 'volume'}
    extra_cols = [c for c in df.columns if c not in core_cols]
    for chunk in chunks:
        row = {'date': chunk['date'].iloc[0]}
        if has_ohlc:
            row['open'] = chunk['open'].iloc[0]
            row['high'] = chunk['high'].max()
            row['low'] = chunk['low'].min()
        row['close'] = chunk['close'].iloc[-1]
        if 'volume' in chunk:
            row['volume'] = int(chunk['volume'].sum())
        for col in extra_cols:
            row[col] = chunk[col].iloc[-1]
        rows.append(row)
    return pd.DataFrame(rows)


def build_price_chart(df, trades_df=None, chart_type='candlestick',
                      show_indicators=None, show_regime=False):
    plot_df = _resample_ohlcv(df, max_points=800)
    if show_indicators is None:
        show_indicators = []

    total_rows = 2 + len(show_indicators)
    row_heights = [0.72 - len(show_indicators) * 0.06]
    row_heights.append(0.14)
    for _ in show_indicators:
        row_heights.append(0.08)
    total_h = sum(row_heights)
    row_heights = [h / total_h for h in row_heights]

    fig = make_subplots(
        rows=total_rows, cols=1, shared_xaxes=True,
        vertical_spacing=0.012,
        row_heights=row_heights,
        subplot_titles=[''] * total_rows,
    )

    if show_regime and len(df) > 50:
        regime = detect_regime(df['close'])
        for i in range(1, len(df)):
            if pd.notna(regime.iloc[i]) and regime.iloc[i] != 0:
                color = hex_alpha(t['green'], 8) if regime.iloc[i] > 0 else hex_alpha(t['red'], 8)
                fig.add_vrect(x0=df['date'].iloc[i-1], x1=df['date'].iloc[i],
                    fillcolor=color, layer='below', line_width=0, row=1, col=1)

    if chart_type == 'candlestick':
        fig.add_trace(go.Candlestick(
            x=plot_df['date'], open=plot_df['open'], high=plot_df['high'],
            low=plot_df['low'], close=plot_df['close'],
            increasing_line_color=t['green'], decreasing_line_color=t['red'],
            increasing_fillcolor=t['green'], decreasing_fillcolor=t['red'],
            increasing_line_width=1, decreasing_line_width=1,
            whiskerwidth=0.6, name='OHLC', showlegend=False,
            hoverinfo='x+text',
            text=[f"O: ${o:,.2f}  H: ${h:,.2f}  L: ${l:,.2f}  C: ${c:,.2f}"
                  for o, h, l, c in zip(plot_df['open'], plot_df['high'], plot_df['low'], plot_df['close'])]),
            row=1, col=1)
    elif chart_type == 'line':
        fig.add_trace(go.Scatter(x=plot_df['date'], y=plot_df['close'], mode='lines',
            line=dict(color=t['blue'], width=1.5, shape='spline'),
            name='Close', showlegend=False), row=1, col=1)
    else:
        fig.add_trace(go.Scatter(x=plot_df['date'], y=plot_df['close'], fill='tozeroy',
            fillcolor=hex_alpha(t['blue'], 18), line=dict(color=t['blue'], width=1, shape='spline'),
            name='Close', showlegend=False), row=1, col=1)

    for p, c in [(20, t['orange']), (50, '#00897b')]:
        col = f'sma_{p}'
        if col in plot_df.columns and plot_df[col].notna().any():
            fig.add_trace(go.Scatter(x=plot_df['date'], y=plot_df[col],
                line=dict(color=c, width=1, shape='spline'),
                name=f'SMA {p}', showlegend=False), row=1, col=1)

    if trades_df is not None and len(trades_df) > 0:
        bd = pd.to_datetime(trades_df['entry_date'])
        bp = trades_df['entry_price']
        sd = pd.to_datetime(trades_df['exit_date'])
        sp = trades_df['exit_price']
        fig.add_trace(go.Scatter(x=bd, y=bp, mode='markers',
            marker=dict(symbol='triangle-up', size=9, color=t['green'], line=dict(width=0.5, color=t['green'])),
            name='Buy', showlegend=True, hovertemplate='Buy: $%{y:.2f}<extra></extra>'), row=1, col=1)
        sc = [t['red'] if r == 'Stop Loss' else (t['green'] if r == 'Take Profit' else t['orange']) for r in trades_df['reason']]
        fig.add_trace(go.Scatter(x=sd, y=sp, mode='markers',
            marker=dict(symbol='triangle-down', size=9, color=sc, line=dict(width=0.5, color=sc)),
            name='Sell', showlegend=True, hovertemplate='Sell: $%{y:.2f}<extra></extra>'), row=1, col=1)

    if 'volume' in plot_df.columns:
        vc = [t['green'] if c >= o else t['red'] for c, o in zip(plot_df['close'], plot_df['open'])]
        fig.add_trace(go.Bar(x=plot_df['date'], y=plot_df['volume'], marker_color=vc, opacity=0.45,
            name='Volume', showlegend=False), row=2, col=1)

    for ind_idx, ind_name in enumerate(show_indicators):
        row = 3 + ind_idx
        if ind_name == 'RSI':
            rsi_col = 'rsi_14'
            if rsi_col in plot_df.columns and plot_df[rsi_col].notna().any():
                fig.add_trace(go.Scatter(x=plot_df['date'], y=plot_df[rsi_col],
                    line=dict(color=t['purple'], width=1, shape='spline'), name='RSI 14', showlegend=False), row=row, col=1)
                fig.add_hline(y=70, line_dash='dot', line_color=t['red'], line_width=0.5, row=row, col=1)
                fig.add_hline(y=30, line_dash='dot', line_color=t['green'], line_width=0.5, row=row, col=1)
                fig.update_yaxes(range=[0, 100], row=row, col=1)
        elif ind_name == 'MACD':
            if 'macd' in plot_df.columns and plot_df['macd'].notna().any():
                fig.add_trace(go.Scatter(x=plot_df['date'], y=plot_df['macd'],
                    line=dict(color=t['blue'], width=1, shape='spline'), name='MACD', showlegend=False), row=row, col=1)
                if 'macd_signal' in plot_df.columns:
                    fig.add_trace(go.Scatter(x=plot_df['date'], y=plot_df['macd_signal'],
                        line=dict(color=t['orange'], width=1, dash='dot', shape='spline'), name='Signal', showlegend=False), row=row, col=1)
                if 'macd_hist' in plot_df.columns:
                    hc = [t['green'] if v >= 0 else t['red'] for v in plot_df['macd_hist']]
                    fig.add_trace(go.Bar(x=plot_df['date'], y=plot_df['macd_hist'], marker_color=hc, opacity=0.5,
                        name='Hist', showlegend=False), row=row, col=1)
                fig.add_hline(y=0, line_color=t['text_muted'], line_width=0.5, row=row, col=1)
        elif ind_name == 'Bollinger':
            if 'bb_upper' in plot_df.columns and plot_df['bb_upper'].notna().any():
                fig.add_trace(go.Scatter(x=plot_df['date'], y=plot_df['bb_upper'],
                    line=dict(color=t['cyan'], width=0.8, dash='dot', shape='spline'), name='BB Upper', showlegend=False), row=row, col=1)
                fig.add_trace(go.Scatter(x=plot_df['date'], y=plot_df['bb_lower'],
                    line=dict(color=t['cyan'], width=0.8, dash='dot', shape='spline'), name='BB Lower', showlegend=False,
                    fill='tonexty', fillcolor=hex_alpha(t['cyan'], 10)), row=row, col=1)
                fig.add_trace(go.Scatter(x=plot_df['date'], y=plot_df['bb_middle'],
                    line=dict(color=t['cyan'], width=0.8, shape='spline'), name='BB Mid', showlegend=False), row=row, col=1)

    has_trades = trades_df is not None and len(trades_df) > 0
    fig.update_layout(
        template=t['plotly_template'], paper_bgcolor=t['bg_deepest'], plot_bgcolor=t['chart_bg'],
        font=dict(family='JetBrains Mono, Consolas, monospace', color=t['chart_font'], size=11),
        margin=dict(l=70, r=20, t=10, b=10), height=560 + len(show_indicators) * 60,
        showlegend=has_trades,
        legend=dict(x=0.01, y=0.99, font=dict(size=10)) if has_trades else {},
        hovermode='x',
        hoverlabel=dict(bgcolor=t['hover_bg'], font_size=11, font_family='JetBrains Mono'),
        modebar=dict(bgcolor='rgba(0,0,0,0)', color=t['text_muted'], activecolor=t['blue']),
        dragmode='pan',
        xaxis_rangeslider_visible=False,
    )
    total_spacing = 0.012 * (total_rows - 1)
    plot_h = 1 - total_spacing
    y_boundary = 1 - row_heights[0] * plot_h
    fig.add_shape(type='line', x0=0, x1=1, y0=y_boundary, y1=y_boundary,
                  xref='paper', yref='paper',
                  line=dict(color=t['border'], width=1))

    start_date = df['date'].min()
    end_date = df['date'].max()
    x_min = start_date - pd.DateOffset(years=1)
    x_max = end_date + pd.DateOffset(years=1)
    price_high = df['high'].max()
    price_low = df['low'].min()

    fig.update_xaxes(gridcolor=t['chart_grid'], zerolinecolor=t['chart_grid'],
                     fixedrange=False, type='date',
                     rangeselector=None, automargin=True,
                     range=[x_min, x_max], minallowed=x_min, maxallowed=x_max)
    fig.update_yaxes(gridcolor=t['chart_grid'], zerolinecolor=t['chart_grid'],
                     fixedrange=False, row=1, col=1, automargin=True,
                     range=[price_low - 50, price_high + 50],
                     minallowed=price_low - 50, maxallowed=price_high + 50)
    fig.update_yaxes(gridcolor=t['chart_grid'], zerolinecolor=t['chart_grid'],
                     fixedrange=False, rangemode='nonnegative', row=2, col=1)
    for r in range(3, total_rows + 1):
        fig.update_yaxes(gridcolor=t['chart_grid'], zerolinecolor=t['chart_grid'],
                         fixedrange=False, row=r, col=1)

    return fig


def build_equity_chart(eq_df, init_cap, show_benchmark=False, benchmark_data=None):
    if eq_df is None or len(eq_df) == 0:
        return None
    plot_eq = _resample_ohlcv(eq_df.rename(columns={'equity': 'close'}), max_points=800)
    plot_eq = plot_eq[['date', 'close']].copy()
    plot_eq.rename(columns={'close': 'equity'}, inplace=True)
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=plot_eq['date'], y=plot_eq['equity'], fill='tozeroy',
        fillcolor=hex_alpha(t['blue'], 15), line=dict(color=t['blue'], width=1.5, shape='spline'),
        name='Strategy'))
    fig.add_hline(y=init_cap, line_dash='dash', line_color=t['text_muted'], line_width=1,
        annotation_text=f'Start: ${init_cap:,.0f}', annotation_font=dict(size=10, color=t['text_muted']))

    if show_benchmark and benchmark_data is not None and len(benchmark_data) > 0:
        bm = benchmark_data.copy()
        bm_norm = bm['close'] / bm['close'].iloc[0] * init_cap
        fig.add_trace(go.Scatter(x=bm['date'], y=bm_norm,
            line=dict(color=t['orange'], width=1.2, shape='spline'),
            name='Buy & Hold', showlegend=True))
        fig.update_layout(showlegend=True, legend=dict(x=0.01, y=0.99, font=dict(size=10)))

    fig.update_layout(
        template=t['plotly_template'], paper_bgcolor=t['bg_deepest'], plot_bgcolor=t['chart_bg'],
        font=dict(family='JetBrains Mono, Consolas, monospace', color=t['chart_font'], size=11),
        margin=dict(l=55, r=16, t=8, b=8), height=180, showlegend=False,
        hovermode='x', hoverlabel=dict(bgcolor=t['hover_bg'], font_size=11))
    fig.update_xaxes(gridcolor=t['chart_grid'])
    fig.update_yaxes(gridcolor=t['chart_grid'])
    return fig


def build_drawdown_chart(eq_df):
    if eq_df is None or len(eq_df) == 0:
        return None
    eq = eq_df['equity']
    peak = eq.cummax()
    dd = (peak - eq) / peak * 100
    fig = go.Figure()
    fig.add_trace(go.Scatter(x=eq_df['date'], y=-dd, fill='tozeroy',
        fillcolor=hex_alpha(t['red'], 30), line=dict(color=t['red'], width=1, shape='spline'),
        name='Drawdown', hovertemplate='Drawdown: %{y:.2f}%<extra></extra>'))
    fig.update_layout(
        template=t['plotly_template'], paper_bgcolor=t['bg_deepest'], plot_bgcolor=t['chart_bg'],
        font=dict(family='JetBrains Mono, monospace', color=t['chart_font'], size=11),
        margin=dict(l=55, r=16, t=6, b=6), height=140, showlegend=False,
        hovermode='x', hoverlabel=dict(bgcolor=t['hover_bg'], font_size=11),
        yaxis=dict(title=dict(text='Drawdown %', font=dict(size=10)), gridcolor=t['chart_grid']),
        xaxis=dict(gridcolor=t['chart_grid']))
    return fig


def build_heatmap(eq_df):
    if eq_df is None or len(eq_df) < 3:
        return None
    edf = eq_df.copy()
    edf['date'] = pd.to_datetime(edf['date'])
    edf['month'] = edf['date'].dt.to_period('M')
    monthly = edf.groupby('month')['equity'].last().pct_change() * 100
    if len(monthly) < 2:
        return None
    mdf = monthly.reset_index()
    mdf.columns = ['month', 'return']
    mdf['year'] = mdf['month'].dt.year
    mdf['mo'] = mdf['month'].dt.month
    pv = mdf.pivot_table(index='year', columns='mo', values='return', aggfunc='first')
    mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    pv.columns = [mn[c-1] for c in pv.columns]
    fig = go.Figure(data=go.Heatmap(z=pv.values, x=pv.columns.tolist(), y=pv.index.tolist(),
        colorscale=[[0, t['red']], [0.5, t['heatmap_mid']], [1, t['green']]], zmid=0,
        text=[[f"{v:.1f}%" if pd.notna(v) else "" for v in row] for row in pv.values],
        texttemplate="%{text}", textfont=dict(size=11, family='JetBrains Mono'),
        hovertemplate='Month: %{x}<br>Year: %{y}<br>Return: %{z:.2f}%<extra></extra>',
        colorbar=dict(title=dict(text='%', font=dict(size=10)), tickfont=dict(size=9))))
    fig.update_layout(
        template=t['plotly_template'], paper_bgcolor=t['bg_deepest'], plot_bgcolor=t['chart_bg'],
        font=dict(family='JetBrains Mono', color=t['chart_font'], size=11),
        margin=dict(l=55, r=20, t=10, b=10), height=max(140, len(pv) * 32 + 40), yaxis=dict(autorange='reversed'))
    return fig
