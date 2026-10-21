import test from 'node:test';
import assert from 'node:assert/strict';
import { loadFalcon } from './helpers.mjs';

const { engine, indicators } = loadFalcon();

const RISK = { capital: 10000, sl: 3, tp: 6, comm: 0.02, slip: 0.02, mtf: false, fractional: true };
const GOLDEN = engine.TEMPLATES['Golden Cross'];
const RULES = { entry: GOLDEN.entry, exit: GOLDEN.exit };
const LOGIC = { entry: GOLDEN.logic[0], exit: GOLDEN.logic[1] };

function backtest(id, risk = RISK, period = 1260) {
  const bars = engine.generateDataset(engine.DEFS[id], period);
  const series = indicators.buildSeries(bars, !!risk.mtf);
  return { bars, result: engine.execute(bars, series, RULES, LOGIC, risk) };
}

/* ------------------------------------------------------------------ *
 * Golden values — changing any of these means the engine changed
 * behaviour and the expectations below must be reviewed on purpose.
 * ------------------------------------------------------------------ */
const GOLDEN_RESULTS = {
  btc: { trades: 7, totalReturn: 25.21, finalCapital: 12521.05, maxDrawdown: 6.1 },
  spy: { trades: 7, totalReturn: 20.71, finalCapital: 12071.39, maxDrawdown: 4.3 },
  tsla: { trades: 6, totalReturn: 18.22, finalCapital: 11821.79, maxDrawdown: 6.1 },
  gold: { trades: 6, totalReturn: 24.37, finalCapital: 12437.28, maxDrawdown: 4.52 },
};

test('built-in universes are labelled as simulated', () => {
  assert.equal(engine.DEFS.falcon, undefined, 'Falcon Semis must be gone');
  assert.ok(Object.keys(engine.DEFS).length >= 4);
  Object.entries(engine.DEFS).forEach(([id, def]) => {
    assert.match(def.ticker, /-SIM$/, `${id} ticker must be marked simulated`);
  });
});

test('golden cross results are stable for every simulated universe', () => {
  Object.entries(GOLDEN_RESULTS).forEach(([id, exp]) => {
    const { result } = backtest(id);
    assert.equal(result.trades.length, exp.trades, `${id}: trade count`);
    assert.ok(Math.abs(result.metrics.totalReturn - exp.totalReturn) < 0.01, `${id}: total return`);
    assert.ok(Math.abs(result.metrics.finalCapital - exp.finalCapital) < 0.05, `${id}: final capital`);
    assert.ok(Math.abs(result.metrics.maxDrawdown - exp.maxDrawdown) < 0.02, `${id}: max drawdown`);
  });
});

test('dataset generation is deterministic for a given seed and length', () => {
  const a = engine.generateDataset(engine.DEFS.spy, 1260);
  const b = engine.generateDataset(engine.DEFS.spy, 1260);
  assert.equal(a.length, b.length);
  assert.equal(a[0].close, b[0].close);
  assert.equal(a[a.length - 1].close, b[b.length - 1].close);
  const c = engine.generateDataset(engine.DEFS.spy, 504);
  assert.notEqual(a[a.length - 1].close, c[c.length - 1].close);
});

test('whole shares cannot open a position above the available capital', () => {
  const { result } = backtest('btc', { ...RISK, fractional: false });
  assert.equal(result.trades.length, 0);
  assert.ok(result.blockedEntries > 0, 'blocked entries must be reported');
  assert.ok(result.blockedPrice > 10000, 'blocked price is above the capital');
});

test('fractional shares allow the same signal to trade', () => {
  const { result } = backtest('btc', RISK);
  assert.ok(result.trades.length > 0);
  assert.equal(result.blockedEntries, 0);
});

test('stop loss exits at the stop price', () => {
  const bars = [];
  for (let i = 0; i < 60; i++) {
    const price = 100 - i * 0.3;
    bars.push({ date: new Date(2024, 0, 1 + i), time: new Date(2024, 0, 1 + i).getTime(), open: price, high: price + 0.2, low: price - 0.2, close: price, volume: 1000 });
  }
  const series = indicators.buildSeries(bars, false);
  // entry on any close above 50, exit only through the stop
  const rules = { entry: [{ left: 'close', op: '>', rightType: 'value', right: '50' }], exit: [] };
  const result = engine.execute(bars, series, rules, LOGIC, { ...RISK, sl: 3, tp: 0 });
  assert.ok(result.trades.length >= 1, 'expected at least one stop out');
  assert.equal(result.trades[0].reason, 'Stop loss');
  assert.ok(result.trades[0].retPct < -2.8 && result.trades[0].retPct > -3.2, 'stop out is close to -3%');
});

test('take profit exits at the target price', () => {
  const bars = [];
  for (let i = 0; i < 60; i++) {
    const price = 100 + i * 1.2;
    bars.push({ date: new Date(2024, 0, 1 + i), time: new Date(2024, 0, 1 + i).getTime(), open: price, high: price + 0.2, low: price - 0.2, close: price, volume: 1000 });
  }
  const series = indicators.buildSeries(bars, false);
  const rules = { entry: [{ left: 'close', op: '>', rightType: 'value', right: '50' }], exit: [] };
  const result = engine.execute(bars, series, rules, LOGIC, { ...RISK, sl: 0, tp: 6 });
  assert.ok(result.trades.length >= 1, 'expected at least one take profit');
  assert.equal(result.trades[0].reason, 'Take profit');
  assert.ok(result.trades[0].retPct > 5.4 && result.trades[0].retPct < 6.2, 'take profit is close to +6%');
});

test('commissions reduce the final capital', () => {
  const free = backtest('spy', { ...RISK, comm: 0, slip: 0 }).result;
  const paid = backtest('spy', RISK).result;
  assert.ok(paid.metrics.fees > 0, 'fees must be charged');
  assert.ok(paid.metrics.finalCapital < free.metrics.finalCapital, 'fees must reduce equity');
});

test('cross detection needs a real transition', () => {
  const s = { a: [1, 2, 3, 4], b: [2, 2, 2, 2] };
  assert.equal(engine.evalCond({ left: 'a', op: 'crosses_above', rightType: 'value', right: '2' }, s, 2), true);
  assert.equal(engine.evalCond({ left: 'a', op: 'crosses_above', rightType: 'value', right: '2' }, s, 3), false);
  assert.equal(engine.evalCond({ left: 'a', op: 'crosses_above', rightType: 'value', right: '2' }, s, 1), false);
});

test('indicators match known series', () => {
  assert.deepEqual(indicators.sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
  assert.deepEqual(indicators.sma([1, 2, 3, 4], 2), [null, 1.5, 2.5, 3.5]);
  const up = indicators.rsi([1, 2, 3, 4, 5, 6], 2);
  assert.equal(up[up.length - 1], 100, 'a monotonic rise is RSI 100');
  const down = indicators.rsi([6, 5, 4, 3, 2, 1], 2);
  assert.equal(down[down.length - 1], 0, 'a monotonic fall is RSI 0');
});

test('moving averages are seeded with nulls, not zeros', () => {
  const closes = [10, 11, 12, 13, 14];
  const s = indicators.sma(closes, 5);
  assert.equal(s[0], null);
  assert.equal(s[3], null);
  assert.equal(s[4], 12);
});

test('parseCsv rejects short files and parses valid ones', () => {
  assert.throws(() => engine.parseCsv('date,open,high,low,close\n2024-01-01,1,1,1,1'), /header row and at least two data rows/);
  assert.throws(() => engine.parseCsv('a,b,c\n1,2,3'), /header row and at least two data rows/);
  assert.throws(() => engine.parseCsv('a,b,c\n1,2,3\n4,5,6'), /open, high, low, close/);
  const rows = ['date,open,high,low,close,volume'];
  for (let i = 0; i < 70; i++) rows.push(`2024-01-${String((i % 28) + 1).padStart(2, '0')},${100 + i},${101 + i},${99 + i},${100 + i},10`);
  const bars = engine.parseCsv(rows.join('\n'));
  assert.equal(bars.length, 70);
  assert.ok(bars[0].time <= bars[bars.length - 1].time, 'bars must be sorted by time');
});

test('parseYahooChart applies the adjusted close factor', () => {
  const count = 70;
  const timestamp = [];
  const open = [], high = [], low = [], close = [], volume = [], adj = [];
  for (let i = 0; i < count; i++) {
    timestamp.push(1704067200 + i * 86400);
    open.push(100 + i); high.push(102 + i); low.push(99 + i); close.push(100 + i); volume.push(10 + i);
    adj.push(50);
  }
  const payload = {
    chart: {
      result: [{
        meta: { symbol: 'AAPL' },
        timestamp,
        indicators: {
          quote: [{ open, high, low, close, volume }],
          adjclose: [{ adjclose: adj }],
        },
      }],
    },
  };
  const parsed = engine.parseYahooChart(payload, 'AAPL');
  assert.equal(parsed.ticker, 'AAPL');
  assert.equal(parsed.bars.length, count);
  assert.equal(parsed.bars[0].close, 50, 'close is scaled by adjclose/close');
  assert.throws(() => engine.parseYahooChart({ chart: { error: { description: 'bad symbol' } } }, 'X'), /bad symbol/);
  assert.throws(() => engine.parseYahooChart({}, 'X'), /unexpected response/);
});
