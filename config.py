import streamlit as st

# ─── Theme ─────────────────────────────────────────────────────────────────────
t = {
    'bg_deepest': '#f5f5f5', 'bg_surface': '#ffffff', 'bg_card': '#ffffff',
    'bg_elevated': '#f0f0f0', 'border': '#e0e0e0', 'border_light': '#d0d0d0',
    'text_primary': '#1a1a1a', 'text_secondary': '#555555', 'text_muted': '#888888',
    'green': '#0a8f4f', 'red': '#d32f2f', 'blue': '#1565c0', 'orange': '#e65100',
    'chart_bg': '#ffffff', 'chart_grid': '#eeeeee', 'chart_font': '#555555',
    'hover_bg': '#f0f0f0', 'heatmap_mid': '#f0f0f0', 'plotly_template': 'plotly_white',
    'purple': '#7b1fa2', 'cyan': '#00838f', 'yellow': '#f9a825',
}


def hex_alpha(hex_color, alpha_pct):
    h = hex_color.lstrip('#')
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    a = round(alpha_pct / 100, 2)
    return f'rgba({r},{g},{b},{a})'


# ─── CSS ───────────────────────────────────────────────────────────────────────
CSS = f"""
<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
:root {{ color-scheme: light !important; }}
.stApp {{ background: {t['bg_deepest']} !important; }}
.stApp > header {{ background: transparent !important; }}
.block-container {{ padding-top: 1.2rem !important; padding-bottom: 0.8rem !important; max-width: 100% !important; }}
h1, h2, h3, h4, h5, h6 {{ color: {t['text_primary']} !important; font-weight: 600 !important; }}
.stMarkdown p, .stMarkdown li {{ color: {t['text_secondary']} !important; font-size: 13px !important; line-height: 1.5 !important; }}
[data-testid="stSidebar"] {{ background: {t['bg_surface']} !important; border-right: 1px solid {t['border']} !important; }}
[data-testid="stSidebar"] .stMarkdown p, [data-testid="stSidebar"] .stMarkdown li, [data-testid="stSidebar"] label {{ color: {t['text_secondary']} !important; font-size: 13px !important; }}
[data-testid="stSidebar"] h1, [data-testid="stSidebar"] h2, [data-testid="stSidebar"] h3 {{ color: {t['text_primary']} !important; }}
label, .stLabel {{ color: {t['text_secondary']} !important; font-size: 13px !important; font-weight: 500 !important; }}
.stNumberInput input, .stTextInput input {{ background: {t['bg_elevated']} !important; border: 1px solid {t['border_light']} !important; color: {t['text_primary']} !important; font-family: 'JetBrains Mono', monospace !important; font-size: 13px !important; border-radius: 3px !important; }}
.stNumberInput input:focus, .stTextInput input:focus {{ border-color: {t['blue']} !important; box-shadow: 0 0 0 1px {t['blue']} !important; }}
.stSelectbox > div > div {{ background: {t['bg_elevated']} !important; border: 1px solid {t['border_light']} !important; color: {t['text_primary']} !important; font-size: 13px !important; }}
.stButton > button {{ background: {t['bg_elevated']} !important; border: 1px solid {t['border_light']} !important; color: {t['text_primary']} !important; font-family: -apple-system, system-ui, sans-serif !important; font-size: 13px !important; font-weight: 500 !important; border-radius: 3px !important; }}
.stButton > button:hover {{ background: {t['border_light']} !important; }}
.stButton > button[kind="primary"], .stButton > button[data-testid="stBaseButton-primary"], .stDownloadButton > button {{ background: {t['blue']} !important; border-color: {t['blue']} !important; color: #ffffff !important; font-weight: 600 !important; font-size: 13px !important; }}
.stButton > button[kind="primary"] *, .stButton > button[data-testid="stBaseButton-primary"] *, .stDownloadButton > button * {{ color: #ffffff !important; opacity: 1 !important; }}
.stButton > button[kind="primary"]::before, .stButton > button[data-testid="stBaseButton-primary"]::before, .stButton > button[kind="primary"]::after, .stButton > button[data-testid="stBaseButton-primary"]::after {{ background: transparent !important; }}
.stButton > button[kind="primary"]:hover {{ opacity: 0.9 !important; }}
hr {{ border-color: {t['border']} !important; opacity: 0.6 !important; }}
.stTabs [data-baseweb="tab-list"] {{ background: {t['bg_surface']} !important; border-bottom: 2px solid {t['border']} !important; gap: 0 !important; }}
.stTabs [data-baseweb="tab"] {{ background: transparent !important; color: {t['text_muted']} !important; font-size: 12px !important; font-weight: 600 !important; padding: 10px 20px !important; border-bottom: 2px solid transparent !important; }}
.stTabs [aria-selected="true"] {{ color: {t['text_primary']} !important; border-bottom-color: {t['blue']} !important; }}
.stTabs [data-baseweb="tab-border"], .stTabs [data-baseweb="tab-highlight"] {{ display: none; }}
[data-testid="stMetric"] {{ background: {t['bg_card']} !important; border: 1px solid {t['border']} !important; padding: 14px 18px !important; border-radius: 3px !important; }}
[data-testid="stMetric"] label {{ color: {t['text_muted']} !important; font-size: 11px !important; text-transform: uppercase !important; letter-spacing: 0.5px !important; font-weight: 600 !important; }}
[data-testid="stMetric"] [data-testid="stMetricValue"] {{ color: {t['text_primary']} !important; font-family: 'JetBrains Mono', monospace !important; font-size: 22px !important; font-weight: 600 !important; }}
[data-testid="stMetric"] [data-testid="stMetricDelta"] > div {{ font-family: 'JetBrains Mono', monospace !important; font-size: 12px !important; }}
.stAlert {{ border-radius: 3px !important; font-size: 13px !important; }}
.stDataFrame {{ border: 1px solid {t['border']} !important; border-radius: 3px !important; }}
.stRadio label, .stCheckbox label span {{ color: {t['text_secondary']} !important; font-size: 13px !important; }}
.stSelectbox div[role="listbox"] span, .stSelectbox div[data-baseweb="select"] span, .stMultiSelect div[role="listbox"] span, .stMultiSelect div[data-baseweb="select"] span {{ color: {t['text_primary']} !important; }}
.stSlider label, .stNumberInput label, .stTextInput label, .stTextArea label, .stDateInput label, .stFileUploader label {{ color: {t['text_secondary']} !important; }}
div[data-baseweb="slider"] span, div[data-baseweb="input"] span {{ color: {t['text_primary']} !important; }}
.stCaption, .stCaptionContainer {{ color: {t['text_secondary']} !important; }}
small, .small {{ color: {t['text_secondary']} !important; }}
.rule-card {{ background: {t['bg_elevated']}; border: 1px solid {t['border_light']}; padding: 12px 14px; margin-bottom: 8px; border-left: 3px solid {t['blue']}; border-radius: 2px; }}
.rule-card.sell-rule {{ border-left-color: {t['red']}; }}
.rule-card .rule-header {{ font-size: 11px; font-weight: 600; color: {t['text_secondary']}; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }}
.section-label {{ font-size: 11px; font-weight: 700; color: {t['text_secondary']}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid {t['border']}; }}
.entry-label {{ color: {t['green']}; border-bottom-color: {t['green']}44; }}
.exit-label {{ color: {t['red']}; border-bottom-color: {t['red']}44; }}
#MainMenu {{ visibility: hidden; }} footer {{ visibility: hidden; }} header[data-testid="stHeader"] {{ background: transparent; }}
[data-testid="stDeployButton"], button[data-testid="stBaseButton-header"] {{ display: none !important; }}
.js-plotly-plot .plotly .modebar {{ opacity: 0.5; transition: opacity 0.2s; }}
.js-plotly-plot .plotly .modebar:hover {{ opacity: 1; }}
@keyframes skeleton {{ 0% {{ opacity: 0.3; }} 50% {{ opacity: 0.6; }} 100% {{ opacity: 0.3; }} }}
.skeleton-block {{ background: {t['bg_elevated']}; border-radius: 4px; animation: skeleton 1.5s infinite; margin-bottom: 8px; }}
.template-card {{ background: {t['bg_elevated']}; border: 1px solid {t['border_light']}; border-radius: 4px; padding: 12px; cursor: pointer; transition: border-color 0.2s; }}
.template-card:hover {{ border-color: {t['blue']}; }}
.template-card h4 {{ font-size: 13px; margin: 0 0 4px 0; color: {t['text_primary']}; }}
.template-card p {{ font-size: 11px; margin: 0; color: {t['text_muted']}; }}
.toast {{ position: fixed; bottom: 20px; right: 20px; background: {t['green']}; color: white; padding: 12px 20px; border-radius: 4px; font-size: 13px; z-index: 9999; box-shadow: 0 4px 12px rgba(0,0,0,0.3); }}
</style>
"""


# ─── Strategy Types ────────────────────────────────────────────────────────────
STRAT_TYPES = {
    'SMA Crossover': {
        'left':  ['close', 'open', 'high', 'low', 'sma_10', 'sma_20', 'sma_50', 'sma_200'],
        'right': ['sma_10', 'sma_20', 'sma_50', 'sma_200'],
        'ops':   ['>', '>=', '<', '<=', 'crosses_above', 'crosses_below'],
    },
    'EMA Crossover': {
        'left':  ['close', 'open', 'high', 'low', 'ema_9', 'ema_12', 'ema_21', 'ema_26', 'ema_50'],
        'right': ['ema_9', 'ema_12', 'ema_21', 'ema_26', 'ema_50'],
        'ops':   ['>', '>=', '<', '<=', 'crosses_above', 'crosses_below'],
    },
    'RSI': {
        'left':  ['rsi_7', 'rsi_14', 'rsi_21'],
        'right': ['rsi_7', 'rsi_14', 'rsi_21'],
        'ops':   ['>', '>=', '<', '<=', '==', '!='],
    },
    'MACD': {
        'left':  ['macd', 'macd_signal', 'macd_hist'],
        'right': ['macd', 'macd_signal', 'macd_hist'],
        'ops':   ['>', '>=', '<', '<=', 'crosses_above', 'crosses_below'],
    },
    'Bollinger Bands': {
        'left':  ['close', 'open', 'high', 'low', 'bb_upper', 'bb_middle', 'bb_lower', 'bb_width'],
        'right': ['close', 'open', 'high', 'low', 'bb_upper', 'bb_middle', 'bb_lower', 'bb_width'],
        'ops':   ['>', '>=', '<', '<=', 'crosses_above', 'crosses_below'],
    },
    'Stochastic': {
        'left':  ['stoch_k', 'stoch_d'],
        'right': ['stoch_k', 'stoch_d'],
        'ops':   ['>', '>=', '<', '<=', 'crosses_above', 'crosses_below'],
    },
    'ADX Trend': {
        'left':  ['adx', 'plus_di', 'minus_di'],
        'right': ['adx', 'plus_di', 'minus_di'],
        'ops':   ['>', '>=', '<', '<='],
    },
    'ATR Volatility': {
        'left':  ['atr_14'],
        'right': ['atr_14'],
        'ops':   ['>', '>=', '<', '<='],
    },
    'Price vs MA': {
        'left':  ['close', 'open', 'high', 'low'],
        'right': ['sma_10', 'sma_20', 'sma_50', 'sma_200', 'ema_9', 'ema_12', 'ema_21', 'ema_26', 'ema_50', 'vwap'],
        'ops':   ['>', '>=', '<', '<=', 'crosses_above', 'crosses_below'],
    },
    'Price vs Price': {
        'left':  ['close', 'open', 'high', 'low'],
        'right': ['close', 'open', 'high', 'low'],
        'ops':   ['>', '>=', '<', '<=', '==', '!='],
    },
    'Volume': {
        'left':  ['volume', 'obv'],
        'right': ['volume', 'obv'],
        'ops':   ['>', '>=', '<', '<='],
    },
    'Williams %R': {
        'left':  ['williams_r'],
        'right': ['williams_r'],
        'ops':   ['>', '>=', '<', '<='],
    },
    'CCI': {
        'left':  ['cci'],
        'right': ['cci'],
        'ops':   ['>', '>=', '<', '<='],
    },
    'Custom (Any)': {
        'left':  None, 'right': None,
        'ops':   ['>', '>=', '<', '<=', '==', '!=', 'crosses_above', 'crosses_below'],
    },
}

IND_LABEL = {
    'close': 'Close Price', 'open': 'Open Price', 'high': 'High', 'low': 'Low', 'volume': 'Volume',
    'sma_10': 'SMA (10)', 'sma_20': 'SMA (20)', 'sma_50': 'SMA (50)', 'sma_200': 'SMA (200)',
    'ema_9': 'EMA (9)', 'ema_12': 'EMA (12)', 'ema_21': 'EMA (21)', 'ema_26': 'EMA (26)', 'ema_50': 'EMA (50)',
    'rsi_7': 'RSI (7)', 'rsi_14': 'RSI (14)', 'rsi_21': 'RSI (21)',
    'macd': 'MACD Line', 'macd_signal': 'MACD Signal', 'macd_hist': 'MACD Histogram',
    'bb_upper': 'BB Upper', 'bb_middle': 'BB Middle', 'bb_lower': 'BB Lower', 'bb_width': 'BB Width',
    'atr_14': 'ATR (14)', 'stoch_k': 'Stoch %K', 'stoch_d': 'Stoch %D',
    'adx': 'ADX', 'plus_di': '+DI', 'minus_di': '-DI',
    'vwap': 'VWAP', 'obv': 'OBV', 'williams_r': 'Williams %R', 'cci': 'CCI',
}
ALL_IND = list(IND_LABEL.keys())
ALL_OPS = ['>', '>=', '<', '<=', '==', '!=', 'crosses_above', 'crosses_below']

MTF_IND_LABEL = {}
for k, v in IND_LABEL.items():
    MTF_IND_LABEL[f'{k}_wtf'] = f"{v} (Weekly)"
ALL_MTF_IND = list(MTF_IND_LABEL.keys())
IND_LABEL.update(MTF_IND_LABEL)


# ─── Rule Templates ────────────────────────────────────────────────────────────
RULE_TEMPLATES = {
    'Golden Cross': {
        'desc': 'Buy when fast SMA crosses above slow SMA. Classic trend-following for trending markets.',
        'entry': [{'strat_type': 'SMA Crossover', 'left': 'sma_10', 'op': 'crosses_above', 'right': 'sma_50', 'right_type': 'indicator'}],
        'exit':  [{'strat_type': 'SMA Crossover', 'left': 'sma_10', 'op': 'crosses_below', 'right': 'sma_50', 'right_type': 'indicator'}],
        'el': 'AND', 'xl': 'AND', 'sl': 3.0, 'tp': 6.0,
    },
    'RSI Reversion': {
        'desc': 'Mean-reversion: buy oversold, sell overbought. Best in ranging markets.',
        'entry': [{'strat_type': 'RSI', 'left': 'rsi_14', 'op': '<', 'right': '30', 'right_type': 'value'}],
        'exit':  [{'strat_type': 'RSI', 'left': 'rsi_14', 'op': '>', 'right': '70', 'right_type': 'value'}],
        'el': 'AND', 'xl': 'AND', 'sl': 3.0, 'tp': 8.0,
    },
    'MACD Momentum': {
        'desc': 'Capture trend acceleration on MACD line crossing above signal.',
        'entry': [{'strat_type': 'MACD', 'left': 'macd', 'op': 'crosses_above', 'right': 'macd_signal', 'right_type': 'indicator'}],
        'exit':  [{'strat_type': 'MACD', 'left': 'macd', 'op': 'crosses_below', 'right': 'macd_signal', 'right_type': 'indicator'}],
        'el': 'AND', 'xl': 'AND', 'sl': 3.0, 'tp': 6.0,
    },
    'Bollinger Squeeze': {
        'desc': 'Volatility breakout: buy above upper band, exit at middle band.',
        'entry': [{'strat_type': 'Bollinger Bands', 'left': 'close', 'op': 'crosses_above', 'right': 'bb_upper', 'right_type': 'indicator'}],
        'exit':  [{'strat_type': 'Bollinger Bands', 'left': 'close', 'op': 'crosses_below', 'right': 'bb_middle', 'right_type': 'indicator'}],
        'el': 'AND', 'xl': 'AND', 'sl': 2.0, 'tp': 5.0,
    },
    'Dual Timeframe': {
        'desc': 'Higher TF filter + lower TF entry. Buy on SMA cross with weekly trend confirmation.',
        'entry': [{'strat_type': 'SMA Crossover', 'left': 'sma_10', 'op': 'crosses_above', 'right': 'sma_50', 'right_type': 'indicator'}],
        'exit':  [{'strat_type': 'Price vs MA', 'left': 'close', 'op': '<', 'right': 'sma_200', 'right_type': 'indicator'}],
        'el': 'AND', 'xl': 'AND', 'sl': 3.0, 'tp': 8.0,
        'mtf': True, 'exit_tf': 'weekly',
    },
    'Trend + Oscillator': {
        'desc': 'ADX trend filter (strong trend) + Stochastic oversold entry for high-prob setups.',
        'entry': [{'strat_type': 'ADX Trend', 'left': 'adx', 'op': '>', 'right': '25', 'right_type': 'value'},
                  {'strat_type': 'Stochastic', 'left': 'stoch_k', 'op': 'crosses_above', 'right': 'stoch_d', 'right_type': 'indicator'}],
        'exit':  [{'strat_type': 'Stochastic', 'left': 'stoch_k', 'op': '>', 'right': '80', 'right_type': 'value'}],
        'el': 'AND', 'xl': 'AND', 'sl': 3.0, 'tp': 7.0,
    },
}

_PRESET_MAP = {
    'SMA Crossover': 'Golden Cross',
    'RSI Oversold / Overbought': 'RSI Reversion',
    'MACD Signal Cross': 'MACD Momentum',
    'Bollinger Breakout': 'Bollinger Squeeze',
}
PRESETS = {}
for _display, _tmpl in _PRESET_MAP.items():
    _t = RULE_TEMPLATES[_tmpl]
    PRESETS[_display] = {
        'entry': [dict(r) for r in _t['entry']],
        'exit': [dict(r) for r in _t['exit']],
        'el': _t['el'], 'xl': _t['xl'], 'sl': _t['sl'], 'tp': _t['tp'],
        'comm': 0.0, 'slip': 0.0,
    }
