(function (global) {
  'use strict';
  var Falcon = global.Falcon = global.Falcon || {};

  /* ---------- technical indicators ---------- */
  function sma(v, p) {
    var out = new Array(v.length).fill(null), sum = 0;
    for (var i = 0; i < v.length; i++) {
      sum += v[i];
      if (i >= p) sum -= v[i - p];
      if (i >= p - 1) out[i] = sum / p;
    }
    return out;
  }
  function ema(v, p) {
    var out = new Array(v.length).fill(null);
    if (!v.length) return out;
    var k = 2 / (p + 1), prev = v[0];
    out[0] = prev;
    for (var i = 1; i < v.length; i++) {
      prev = v[i] * k + prev * (1 - k);
      out[i] = prev;
    }
    return out;
  }
  function rsi(v, p) {
    var out = new Array(v.length).fill(null);
    var gain = 0, loss = 0;
    for (var i = 1; i < v.length; i++) {
      var d = v[i] - v[i - 1];
      var g = d > 0 ? d : 0;
      var l = d < 0 ? -d : 0;
      if (i <= p) {
        gain += g; loss += l;
        if (i === p) {
          gain /= p; loss /= p;
          out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
        }
      } else {
        gain = (gain * (p - 1) + g) / p;
        loss = (loss * (p - 1) + l) / p;
        out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
      }
    }
    return out;
  }
  function rollingMean(v, p) {
    var out = new Array(v.length).fill(null), sum = 0, n = 0;
    for (var i = 0; i < v.length; i++) {
      var x = v[i];
      if (x === null || Number.isNaN(x)) { continue; }
      sum += x; n++;
      if (i >= p && v[i - p] !== null && !Number.isNaN(v[i - p])) { sum -= v[i - p]; n--; }
      if (n === p) out[i] = sum / p;
    }
    return out;
  }
  function rollingStd(v, p) {
    var out = new Array(v.length).fill(null), sum = 0, sumSq = 0, n = 0;
    for (var i = 0; i < v.length; i++) {
      sum += v[i]; sumSq += v[i] * v[i]; n++;
      if (i >= p) { sum -= v[i - p]; sumSq -= v[i - p] * v[i - p]; n--; }
      if (n === p) {
        var variance = (sumSq - sum * sum / p) / (p - 1);
        out[i] = variance > 0 ? Math.sqrt(variance) : 0;
      }
    }
    return out;
  }
  function macdSeries(v, fast, slow, sig) {
    var f = ema(v, fast), s = ema(v, slow);
    var line = v.map(function (_, i) { return f[i] - s[i]; });
    var signal = ema(line, sig);
    var hist = line.map(function (x, i) { return x - signal[i]; });
    return [line, signal, hist];
  }
  function atrSeries(h, l, c, p) {
    var tr = new Array(h.length).fill(null);
    for (var i = 0; i < h.length; i++) {
      var pc = i > 0 ? c[i - 1] : c[i];
      tr[i] = Math.max(h[i] - l[i], Math.abs(h[i] - pc), Math.abs(l[i] - pc));
    }
    return rollingMean(tr, p);
  }
  function coreSeries(bars) {
    var o = bars.map(function (b) { return b.open; });
    var h = bars.map(function (b) { return b.high; });
    var l = bars.map(function (b) { return b.low; });
    var c = bars.map(function (b) { return b.close; });
    var v = bars.map(function (b) { return b.volume; });
    var s = { open: o, high: h, low: l, close: c, volume: v };
    [10, 20, 50, 200].forEach(function (p) { s['sma_' + p] = sma(c, p); });
    [9, 12, 21, 26, 50].forEach(function (p) { s['ema_' + p] = ema(c, p); });
    [7, 14, 21].forEach(function (p) { s['rsi_' + p] = rsi(c, p); });
    var m = macdSeries(c, 12, 26, 9);
    s.macd = m[0]; s.macd_signal = m[1]; s.macd_hist = m[2];
    var mid = sma(c, 20), sd = rollingStd(c, 20);
    s.bb_middle = mid;
    s.bb_upper = c.map(function (_, i) { return sd[i] === null ? null : mid[i] + 2 * sd[i]; });
    s.bb_lower = c.map(function (_, i) { return sd[i] === null ? null : mid[i] - 2 * sd[i]; });
    s.bb_width = c.map(function (_, i) { return sd[i] === null || !mid[i] ? null : (4 * sd[i]) / mid[i]; });
    s.atr_14 = atrSeries(h, l, c, 14);

    var kp = 14, k = new Array(c.length).fill(null), lo14 = new Array(c.length).fill(null), hi14 = new Array(c.length).fill(null);
    for (var i = 0; i < c.length; i++) {
      if (i < kp - 1) continue;
      var lo = Infinity, hi = -Infinity;
      for (var j = i - kp + 1; j <= i; j++) { if (l[j] < lo) lo = l[j]; if (h[j] > hi) hi = h[j]; }
      lo14[i] = lo; hi14[i] = hi;
      k[i] = hi === lo ? null : 100 * (c[i] - lo) / (hi - lo);
    }
    s.stoch_k = k;
    s.stoch_d = rollingMean(k, 3);

    var pdm = new Array(c.length).fill(0), mdm = new Array(c.length).fill(0);
    for (var t = 1; t < c.length; t++) {
      var up = h[t] - h[t - 1], dn = l[t - 1] - l[t];
      pdm[t] = (up > dn && up > 0) ? up : 0;
      mdm[t] = (dn > up && dn > 0) ? dn : 0;
    }
    var atr14 = s.atr_14;
    var ep = ema(pdm, 14), em = ema(mdm, 14);
    s.plus_di = c.map(function (_, i) { return !atr14[i] ? null : 100 * ep[i] / atr14[i]; });
    s.minus_di = c.map(function (_, i) { return !atr14[i] ? null : 100 * em[i] / atr14[i]; });
    var dx = c.map(function (_, i) {
      var a = s.plus_di[i], b = s.minus_di[i];
      return (a === null || b === null || a + b === 0) ? null : 100 * Math.abs(a - b) / (a + b);
    });
    s.adx = ema(dx.map(function (x) { return x === null ? 0 : x; }), 14);

    var tp = c.map(function (_, i) { return (h[i] + l[i] + c[i]) / 3; });
    var cumPV = 0, cumV = 0;
    s.vwap = c.map(function (_, i) { cumPV += tp[i] * v[i]; cumV += v[i]; return cumV ? cumPV / cumV : null; });
    var obv = 0;
    s.obv = c.map(function (_, i) { if (i > 0) obv += v[i] * Math.sign(c[i] - c[i - 1] || 0); return obv; });
    s.williams_r = c.map(function (_, i) { return hi14[i] === null ? null : -100 * (hi14[i] - c[i]) / (hi14[i] - lo14[i] || 1); });

    var cciMean = sma(tp, 20);
    s.cci = c.map(function (_, i) {
      if (cciMean[i] === null) return null;
      var sum = 0;
      for (var j2 = i - 19; j2 <= i; j2++) sum += Math.abs(tp[j2] - cciMean[i]);
      var md = sum / 20;
      return md === 0 ? null : (tp[i] - cciMean[i]) / (0.015 * md);
    });
    return s;
  }

  function aggregateWeekly(bars) {
    var weeks = [], cur = null;
    for (var i = 0; i < bars.length; i++) {
      var b = bars[i];
      var monday = new Date(b.time);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      var key = monday.getTime();
      if (!cur || cur.key !== key) { cur = { key: key, bars: [] }; weeks.push(cur); }
      cur.bars.push(b);
    }
    return weeks.map(function (w) {
      var first = w.bars[0], last = w.bars[w.bars.length - 1];
      var hi = -Infinity, lo = Infinity, vol = 0;
      w.bars.forEach(function (b) { if (b.high > hi) hi = b.high; if (b.low < lo) lo = b.low; vol += b.volume; });
      return {
        date: last.date, time: last.time, endTime: last.time,
        open: first.open, high: hi, low: lo, close: last.close, volume: vol
      };
    });
  }

  function buildSeries(bars, useMtf) {
    var s = coreSeries(bars);
    if (!useMtf) return s;
    var weeks = aggregateWeekly(bars);
    if (weeks.length < 3) return s;
    var ws = coreSeries(weeks);
    var keys = Object.keys(ws);
    var merged = {};
    keys.forEach(function (k) { merged[k] = new Array(bars.length).fill(null); });
    var j = -1;
    for (var i = 0; i < bars.length; i++) {
      while (j + 1 < weeks.length && weeks[j + 1].endTime < bars[i].time) j++;
      if (j < 0) continue;
      for (var ki = 0; ki < keys.length; ki++) {
        var key = keys[ki];
        merged[key][i] = ws[key][j];
      }
    }
    keys.forEach(function (k) { s[k + '_wtf'] = merged[k]; });
    return s;
  }

  Falcon.indicators = {sma: sma, ema: ema, rsi: rsi, buildSeries: buildSeries};
})(window);
