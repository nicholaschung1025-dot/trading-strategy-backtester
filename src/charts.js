(function (global) {
  'use strict';
  var Falcon = global.Falcon = global.Falcon || {};
  var U = Falcon.util;
  var esc = U.esc, clamp = U.clamp, isoDate = U.isoDate, shortDate = U.shortDate, fmtPrice = U.fmtPrice,
        money = U.money, money0 = U.money0, fmtShares = U.fmtShares, compactMoney = U.compactMoney;
  var $ = U.$, $$ = U.$$;
  var state = Falcon.state;
  /* ---------- canvas rendering, zoom/pan and accessible data tables ---------- */
  function fitCanvas(cv) {
    var rect = cv.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return null;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(rect.width * dpr);
    cv.height = Math.round(rect.height * dpr);
    var ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    return { ctx: ctx, w: rect.width, h: rect.height };
  }

  function scheduleDraws() {
    cancelAnimationFrame(drawRaf);
    drawRaf = requestAnimationFrame(drawAll);
  }

  function chartPalette() {
    var cs = getComputedStyle(document.documentElement);
    var v = function (name) { return cs.getPropertyValue(name).trim(); };
    return {
      grid: v('--chart-grid'),
      axis: v('--chart-axis'),
      ref: v('--chart-ref'),
      marker: v('--chart-marker'),
      accent: v('--accent'),
      pos: v('--pos-2'),
      neg: v('--neg'),
      muted: v('--muted'),
      accentRgb: v('--chart-accent-rgb'),
      posRgb: v('--chart-pos-rgb'),
      negRgb: v('--chart-neg-rgb')
    };
  }


  function drawAxisDate(ctx, d, x, y, withYear) {
    ctx.fillText(shortDate(d, withYear), x, y);
  }

  var CHART_IDS = ['priceChart', 'eqChart', 'ddChart', 'cmpChart'];
  var CHART_MARGINS = {
    priceChart: { l: 46, r: 12 },
    eqChart: { l: 46, r: 12 },
    ddChart: { l: 42, r: 12 },
    cmpChart: { l: 40, r: 12 }
  };
  var chartViews = {};
  var priceMarkers = [];
  var chartTip = null;

  function markerTipHtml(marker) {
    var tr = marker.trade;
    if (marker.kind === 'entry') {
      return '<b>Entry</b> ' + isoDate(tr.entryDate) + ' · ' + fmtPrice(tr.entryPrice) + ' · ' + fmtShares(tr.shares) + ' sh';
    }
    return '<b>Exit</b> ' + isoDate(tr.exitDate) + ' · ' + fmtPrice(tr.exitPrice) + ' · ' +
      (tr.pnl >= 0 ? '+' : '') + tr.retPct.toFixed(2) + '% · ' + tr.reason;
  }

  function showChartTip(html, clientX, clientY) {
    if (!chartTip) {
      chartTip = document.createElement('div');
      chartTip.className = 'chart-tip';
      chartTip.setAttribute('role', 'tooltip');
      document.body.appendChild(chartTip);
    }
    chartTip.innerHTML = html;
    chartTip.hidden = false;
    var r = chartTip.getBoundingClientRect();
    var x = clientX + 14;
    var y = clientY - r.height - 12;
    if (x + r.width > window.innerWidth - 8) x = clientX - r.width - 14;
    if (y < 8) y = clientY + 18;
    chartTip.style.left = Math.max(8, x) + 'px';
    chartTip.style.top = Math.max(8, y) + 'px';
  }

  function hideChartTip() {
    if (chartTip) chartTip.hidden = true;
  }

  function chartLength(id) {
    if (!state.result) return 0;
    if (id === 'priceChart') return state.bars.length;
    if (id === 'cmpChart') {
      if (!state.compare || !state.compare.result) return 0;
      return Math.min(state.result.equity.length, state.compare.result.equity.length);
    }
    return state.result.equity.length;
  }

  function getChartView(id) {
    if (!chartViews[id]) chartViews[id] = { a: 0, b: 1 };
    return chartViews[id];
  }

  function minChartSpan(n) {
    return Math.min(1, 8 / Math.max(1, n - 1));
  }

  function viewBounds(id, n) {
    var max = Math.max(1, n - 1);
    var min = minChartSpan(n);
    var v = getChartView(id);
    var span = clamp(v.b - v.a, min, 1);
    var a = clamp(v.a, 0, 1 - span);
    v.a = a;
    v.b = a + span;
    var i0 = a * max, i1 = (a + span) * max;
    return {
      i0: i0,
      i1: i1,
      start: Math.max(0, Math.floor(i0)),
      end: Math.min(n - 1, Math.ceil(i1))
    };
  }

  function updateChartButtons(id) {
    var n = chartLength(id);
    var v = getChartView(id);
    var min = minChartSpan(n);
    var span = clamp(v.b - v.a, min, 1);
    var atFull = span >= 1 - 1e-6;
    var atMin = span <= min + 1e-6;
    $$('[data-zoom-out="' + id + '"]').forEach(function (b) { b.disabled = !n || atFull; });
    $$('[data-zoom-in="' + id + '"]').forEach(function (b) { b.disabled = !n || atMin; });
    $$('[data-zoom-reset="' + id + '"]').forEach(function (b) { b.disabled = !n || (atFull && v.a <= 1e-6); });
  }

  function zoomChart(id, factor, anchorFrac) {
    var n = chartLength(id);
    if (n < 2) return false;
    var v = getChartView(id);
    var min = minChartSpan(n);
    var oldSpan = clamp(v.b - v.a, min, 1);
    var span = clamp(oldSpan * factor, min, 1);
    if (Math.abs(span - oldSpan) < 1e-7) return false;
    var frac = Number.isFinite(anchorFrac) ? clamp(anchorFrac, 0, 1) : 0.5;
    var a0 = clamp(v.a, 0, 1 - oldSpan);
    var anchor = a0 + oldSpan * frac;
    var a = clamp(anchor - frac * span, 0, 1 - span);
    v.a = a;
    v.b = a + span;
    scheduleDraws();
    updateChartButtons(id);
    return true;
  }

  function panChart(id, frac) {
    var n = chartLength(id);
    if (n < 2) return;
    var v = getChartView(id);
    var min = minChartSpan(n);
    var span = clamp(v.b - v.a, min, 1);
    var a = clamp(v.a + frac * span, 0, 1 - span);
    if (Math.abs(a - v.a) < 1e-7) return;
    v.a = a;
    v.b = a + span;
    scheduleDraws();
    updateChartButtons(id);
  }

  function resetChartView(id) {
    chartViews[id] = { a: 0, b: 1 };
    scheduleDraws();
    updateChartButtons(id);
  }

  function resetAllChartViews() {
    chartViews = {};
    CHART_IDS.forEach(updateChartButtons);
  }

  function drawPrice() {
    var pal = chartPalette();
    var f = fitCanvas($('#priceChart'));
    if (!f || !state.result) return;
    priceMarkers = [];
    var ctx = f.ctx, w = f.w, h = f.h;
    var bars = state.bars, n = bars.length;
    if (n < 2) return;
    var m = { l: 46, r: 12, t: 34, b: 22 };
    var pw = w - m.l - m.r, ph = h - m.t - m.b;
    if (pw < 20 || ph < 20) return;
    var view = viewBounds('priceChart', n);
    var i0 = view.i0, i1 = view.i1;
    var visibleSpan = Math.max(1, i1 - i0);

    var lo = Infinity, hi = -Infinity;
    for (var s = view.start; s <= view.end; s++) {
      if (bars[s].low < lo) lo = bars[s].low;
      if (bars[s].high > hi) hi = bars[s].high;
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return;
    var pad = (hi - lo) * 0.05 || 1;
    lo -= pad; hi += pad;
    var X = function (i) { return m.l + ((i - i0) / visibleSpan) * pw; };
    var Y = function (p) { return m.t + (hi - p) / (hi - lo) * ph; };

    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.textBaseline = 'middle';
    for (var g = 0; g <= 4; g++) {
      var y = m.t + ph * g / 4;
      var v = hi - (hi - lo) * g / 4;
      ctx.strokeStyle = pal.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(m.l, Math.round(y) + 0.5);
      ctx.lineTo(w - m.r, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.fillStyle = pal.axis;
      ctx.textAlign = 'right';
      ctx.fillText('$' + fmtPrice(v), m.l - 6, y);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = pal.axis;
    for (var t = 0; t <= 3; t++) {
      var idx = clamp(Math.round(i0 + (i1 - i0) * t / 3), 0, n - 1);
      ctx.textAlign = t === 3 ? 'right' : 'center';
      drawAxisDate(ctx, bars[idx].date, X(idx), h - m.b + 6, visibleSpan > 420);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(m.l, m.t, pw, ph);
    ctx.clip();

    if (visibleSpan <= 420) {
      var cw = Math.max(1, Math.min(24, pw / visibleSpan * 0.62));
      for (var i = view.start; i <= view.end; i++) {
        var b = bars[i], x = X(i);
        var up = b.close >= b.open;
        ctx.strokeStyle = up ? pal.pos : pal.neg;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = Math.min(1.4, Math.max(0.7, cw * 0.35));
        ctx.beginPath();
        ctx.moveTo(x, Y(b.high));
        ctx.lineTo(x, Y(b.low));
        ctx.stroke();
        var yo = Y(b.open), yc = Y(b.close);
        ctx.fillRect(x - cw / 2, Math.min(yo, yc), cw, Math.max(1, Math.abs(yc - yo)));
      }
    } else {
      ctx.strokeStyle = pal.marker;
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      for (var k = view.start; k <= view.end; k++) {
        var xk = X(k), yk = Y(bars[k].close);
        if (k === view.start) ctx.moveTo(xk, yk); else ctx.lineTo(xk, yk);
      }
      ctx.stroke();
    }

    function line(arr, color, width) {
      if (!arr) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      var started = false;
      for (var q = 0; q < arr.length; q++) {
        var vq = arr[q];
        if (vq === null || vq === undefined || Number.isNaN(vq)) { started = false; continue; }
        var xq = X(q), yq = Y(vq);
        if (!started) { ctx.moveTo(xq, yq); started = true; } else ctx.lineTo(xq, yq);
      }
      ctx.stroke();
    }
    var series = state.result.series;
    line(series.sma_20, 'rgba(' + pal.accentRgb + ',.34)', 1.1);
    line(series.sma_50, 'rgba(' + pal.posRgb + ',.30)', 1.1);

    state.result.trades.forEach(function (tr) {
      var xe = X(tr.entryIdx);
      if (xe >= m.l && xe <= w - m.r) {
        var ye = Y(tr.entryPrice);
        ctx.fillStyle = pal.pos;
        ctx.beginPath();
        ctx.moveTo(xe, ye + 10);
        ctx.lineTo(xe - 4.2, ye + 17);
        ctx.lineTo(xe + 4.2, ye + 17);
        ctx.closePath();
        ctx.fill();
        priceMarkers.push({ x: xe, y: ye + 14, kind: 'entry', trade: tr });
      }
      var xx = X(tr.exitIdx);
      if (xx >= m.l && xx <= w - m.r) {
        var yx = Y(tr.exitPrice);
        ctx.fillStyle = tr.pnl > 0 ? pal.accent : pal.neg;
        ctx.beginPath();
        ctx.moveTo(xx, yx - 10);
        ctx.lineTo(xx - 4.2, yx - 17);
        ctx.lineTo(xx + 4.2, yx - 17);
        ctx.closePath();
        ctx.fill();
        priceMarkers.push({ x: xx, y: yx - 14, kind: 'exit', trade: tr });
      }
    });
    ctx.restore();

    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(' + pal.accentRgb + ',.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(m.l + 2, m.t + 8); ctx.lineTo(m.l + 16, m.t + 8); ctx.stroke();
    ctx.fillStyle = pal.muted;
    ctx.fillText('SMA 20', m.l + 20, m.t + 8);
    ctx.strokeStyle = 'rgba(' + pal.posRgb + ',.55)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(m.l + 66, m.t + 8); ctx.lineTo(m.l + 80, m.t + 8); ctx.stroke();
    ctx.fillText('SMA 50', m.l + 84, m.t + 8);

    $('#priceMeta').textContent = state.meta.ticker + ' · ' + n.toLocaleString() + ' bars · ' + state.result.trades.length + ' fills';
  }

  function drawEquity() {
    var pal = chartPalette();
    var f = fitCanvas($('#eqChart'));
    if (!f || !state.result) return;
    var ctx = f.ctx, w = f.w, h = f.h;
    var m = { l: 46, r: 12, t: 34, b: 20 };
    var pw = w - m.l - m.r, ph = h - m.t - m.b;
    if (pw < 20 || ph < 20) return;
    var eq = state.result.equity, bm = state.result.benchmark;
    var n = eq.length;
    var view = viewBounds('eqChart', n);
    var i0 = view.i0, i1 = view.i1;
    var visibleSpan = Math.max(1, i1 - i0);
    var lo = Infinity, hi = -Infinity;
    function scan(arr) {
      for (var s = view.start; s <= view.end; s++) {
        if (arr[s].equity < lo) lo = arr[s].equity;
        if (arr[s].equity > hi) hi = arr[s].equity;
      }
    }
    scan(eq); scan(bm);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return;
    var flat = (hi - lo) < 1e-9;
    if (flat) {
      var midV = hi || 1;
      lo = midV * 0.985;
      hi = midV * 1.015;
    } else {
      var pad = (hi - lo) * 0.08;
      lo -= pad; hi += pad;
    }
    var X = function (i) { return m.l + ((i - i0) / visibleSpan) * pw; };
    var Y = function (v) { return m.t + (hi - v) / (hi - lo) * ph; };

    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.textBaseline = 'middle';
    for (var g = 0; g <= 3; g++) {
      var y = m.t + ph * g / 3;
      ctx.strokeStyle = pal.grid;
      ctx.beginPath();
      ctx.moveTo(m.l, Math.round(y) + 0.5);
      ctx.lineTo(w - m.r, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.fillStyle = pal.axis;
      ctx.textAlign = 'right';
      ctx.fillText('$' + compactMoney(hi - (hi - lo) * g / 3), m.l - 6, y);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (var t = 0; t <= 3; t++) {
      var idx = clamp(Math.round(i0 + (i1 - i0) * t / 3), 0, n - 1);
      ctx.textAlign = t === 3 ? 'right' : 'center';
      drawAxisDate(ctx, eq[idx].date, X(idx), h - m.b + 4, visibleSpan > 420);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(m.l, m.t, pw, ph);
    ctx.clip();

    if (!flat) {
      ctx.beginPath();
      ctx.moveTo(X(view.start), Y(eq[view.start].equity));
      for (var i = view.start + 1; i <= view.end; i++) ctx.lineTo(X(i), Y(eq[i].equity));
      ctx.lineTo(X(view.end), m.t + ph);
      ctx.lineTo(X(view.start), m.t + ph);
      ctx.closePath();
      var grad = ctx.createLinearGradient(0, m.t, 0, m.t + ph);
      grad.addColorStop(0, 'rgba(' + pal.accentRgb + ',.18)');
      grad.addColorStop(1, 'rgba(' + pal.accentRgb + ',0)');
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.strokeStyle = pal.ref;
    ctx.lineWidth = 1.1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (var j = view.start; j <= view.end; j++) {
      var xj = X(j), yj = Y(bm[j].equity);
      if (j === view.start) ctx.moveTo(xj, yj); else ctx.lineTo(xj, yj);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (var k = view.start; k <= view.end; k++) {
      var xk = X(k), yk = Y(eq[k].equity);
      if (k === view.start) ctx.moveTo(xk, yk); else ctx.lineTo(xk, yk);
    }
    ctx.stroke();
    ctx.restore();

    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(m.l + 2, m.t + 8); ctx.lineTo(m.l + 16, m.t + 8); ctx.stroke();
    ctx.fillStyle = pal.muted;
    ctx.fillText('Strategy', m.l + 20, m.t + 8);
    ctx.strokeStyle = pal.ref;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(m.l + 66, m.t + 8); ctx.lineTo(m.l + 80, m.t + 8); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillText('Buy & hold', m.l + 84, m.t + 8);
  }

  function drawDrawdown() {
    var pal = chartPalette();
    var f = fitCanvas($('#ddChart'));
    if (!f || !state.result) return;
    var ctx = f.ctx, w = f.w, h = f.h;
    var m = { l: 42, r: 12, t: 34, b: 20 };
    var pw = w - m.l - m.r, ph = h - m.t - m.b;
    if (pw < 20 || ph < 20) return;
    var dd = state.result.drawdown;
    var n = dd.length;
    var view = viewBounds('ddChart', n);
    var i0 = view.i0, i1 = view.i1;
    var visibleSpan = Math.max(1, i1 - i0);
    var min = 0;
    for (var s = view.start; s <= view.end; s++) if (dd[s] < min) min = dd[s];
    if (min > -0.5) min = -0.5;
    var X = function (i) { return m.l + ((i - i0) / visibleSpan) * pw; };
    var Y = function (v) { return m.t + (0 - v) / (0 - min) * ph; };

    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.textBaseline = 'middle';
    for (var g = 0; g <= 3; g++) {
      var y = m.t + ph * g / 3;
      ctx.strokeStyle = pal.grid;
      ctx.beginPath();
      ctx.moveTo(m.l, Math.round(y) + 0.5);
      ctx.lineTo(w - m.r, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.fillStyle = pal.axis;
      ctx.textAlign = 'right';
      ctx.fillText((min * g / 3).toFixed(1) + '%', m.l - 5, y);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (var t = 0; t <= 3; t++) {
      var idx = clamp(Math.round(i0 + (i1 - i0) * t / 3), 0, n - 1);
      ctx.textAlign = t === 3 ? 'right' : 'center';
      drawAxisDate(ctx, state.result.equity[idx].date, X(idx), h - m.b + 4, visibleSpan > 420);
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(m.l, m.t, pw, ph);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(X(view.start), Y(0));
    for (var i = view.start; i <= view.end; i++) ctx.lineTo(X(i), Y(dd[i]));
    ctx.lineTo(X(view.end), Y(0));
    ctx.closePath();
    ctx.fillStyle = 'rgba(' + pal.negRgb + ',.20)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(' + pal.negRgb + ',.75)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (var k = view.start; k <= view.end; k++) {
      var xk = X(k), yk = Y(dd[k]);
      if (k === view.start) ctx.moveTo(xk, yk); else ctx.lineTo(xk, yk);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawCmp() {
    var pal = chartPalette();
    var f = fitCanvas($('#cmpChart'));
    if (!f || !state.compare || !state.result) return;
    var ctx = f.ctx, w = f.w, h = f.h;
    var m = { l: 40, r: 12, t: 34, b: 20 };
    var pw = w - m.l - m.r, ph = h - m.t - m.b;
    if (pw < 20 || ph < 20) return;
    var a = state.result.equity, b = state.compare.result.equity;
    var na = a.map(function (p) { return p.equity / state.result.capital * 100; });
    var nb = b.map(function (p) { return p.equity / state.compare.result.capital * 100; });
    var n = Math.min(na.length, nb.length);
    if (n < 2) return;
    var view = viewBounds('cmpChart', n);
    var i0 = view.i0, i1 = view.i1;
    var visibleSpan = Math.max(1, i1 - i0);
    var lo = Infinity, hi = -Infinity;
    for (var s = view.start; s <= view.end; s++) {
      if (na[s] < lo) lo = na[s];
      if (nb[s] < lo) lo = nb[s];
      if (na[s] > hi) hi = na[s];
      if (nb[s] > hi) hi = nb[s];
    }
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return;
    var pad = (hi - lo) * 0.08 || 1;
    lo -= pad; hi += pad;
    var X = function (i) { return m.l + ((i - i0) / visibleSpan) * pw; };
    var Y = function (v) { return m.t + (hi - v) / (hi - lo) * ph; };

    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.textBaseline = 'middle';
    for (var g = 0; g <= 4; g++) {
      var y = m.t + ph * g / 4;
      ctx.strokeStyle = pal.grid;
      ctx.beginPath();
      ctx.moveTo(m.l, Math.round(y) + 0.5);
      ctx.lineTo(w - m.r, Math.round(y) + 0.5);
      ctx.stroke();
      ctx.fillStyle = pal.axis;
      ctx.textAlign = 'right';
      ctx.fillText((hi - (hi - lo) * g / 4).toFixed(0), m.l - 5, y);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (var t = 0; t <= 3; t++) {
      var idx = clamp(Math.round(i0 + (i1 - i0) * t / 3), 0, n - 1);
      ctx.textAlign = t === 3 ? 'right' : 'center';
      drawAxisDate(ctx, a[idx].date, X(idx), h - m.b + 4, visibleSpan > 420);
    }

    function stroke(arr, color, width) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (var i = view.start; i <= view.end; i++) {
        var x = X(i), yv = Y(arr[i]);
        if (i === view.start) ctx.moveTo(x, yv); else ctx.lineTo(x, yv);
      }
      ctx.stroke();
    }
    stroke(nb, pal.ref, 1.4);
    stroke(na, pal.accent, 1.9);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '10px "Segoe UI", Arial, sans-serif';
    ctx.strokeStyle = pal.accent; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(m.l + 2, m.t + 8); ctx.lineTo(m.l + 16, m.t + 8); ctx.stroke();
    ctx.fillStyle = pal.muted;
    ctx.fillText(state.meta.ticker, m.l + 20, m.t + 8);
    ctx.strokeStyle = pal.ref; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(m.l + 70, m.t + 8); ctx.lineTo(m.l + 84, m.t + 8); ctx.stroke();
    ctx.fillText(state.compare.ticker, m.l + 88, m.t + 8);
  }

  function drawAll() {
    if (!state.result) return;
    drawPrice();
    drawEquity();
    drawDrawdown();
    if (state.compare) drawCmp();
    CHART_IDS.forEach(updateChartButtons);
    renderChartData();
  }

  /* ───────────────────────── accessible data tables ─────────────────────────
     Canvas charts are opaque to assistive tech, so every chart ships a
     downsampled table of exactly what is currently on screen. */
  var chartDataSig = {};

  function dataTable(hostId, headers, rows) {
    var host = document.getElementById(hostId);
    if (!host) return;
    var head = '<tr>' + headers.map(function (h) { return '<th scope="col">' + esc(h) + '</th>'; }).join('') + '</tr>';
    var body = rows.map(function (r) {
      return '<tr>' + r.map(function (c, i) {
        return i === 0 ? '<th scope="row">' + esc(c) + '</th>' : '<td>' + esc(c) + '</td>';
      }).join('') + '</tr>';
    }).join('');
    host.innerHTML = '<table class="data-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';
  }

  function sampleRows(span, maxRows) {
    if (span <= maxRows) return { step: 1, count: span };
    var step = Math.ceil(span / maxRows);
    return { step: step, count: Math.ceil(span / step) };
  }

  function renderChartData() {
    if (!state.result) return;
    var r = state.result;

    var priceSpan = state.bars.length;
    var pv = viewBounds('priceChart', priceSpan);
    var ps = sampleRows(priceSpan, 60);
    var priceRows = [];
    for (var p = 0; p < priceSpan; p += ps.step) {
      var b = state.bars[p];
      priceRows.push([isoDate(b.date), fmtPrice(b.open), fmtPrice(b.high), fmtPrice(b.low), fmtPrice(b.close), String(b.volume)]);
    }
    var priceSig = 'p' + priceSpan + ':' + r.trades.length;
    if (chartDataSig.price !== priceSig) {
      chartDataSig.price = priceSig;
      dataTable('priceData', ['Date', 'Open', 'High', 'Low', 'Close', 'Volume'], priceRows);
    }

    var eq = r.equity;
    var es = sampleRows(eq.length, 60);
    var eqRows = [];
    for (var e = 0; e < eq.length; e += es.step) {
      eqRows.push([isoDate(eq[e].date), money0(eq[e].equity), money0(r.benchmark[e].equity)]);
    }
    var eqSig = 'e' + eq.length;
    if (chartDataSig.eq !== eqSig) {
      chartDataSig.eq = eqSig;
      dataTable('eqData', ['Date', 'Strategy equity', 'Buy & hold equity'], eqRows);
    }

    var dd = r.drawdown;
    var ds = sampleRows(dd.length, 60);
    var ddRows = [];
    for (var d = 0; d < dd.length; d += ds.step) {
      ddRows.push([isoDate(r.equity[d].date), dd[d].toFixed(2) + '%']);
    }
    var ddSig = 'd' + dd.length;
    if (chartDataSig.dd !== ddSig) {
      chartDataSig.dd = ddSig;
      dataTable('ddData', ['Date', 'Drawdown'], ddRows);
    }

    if (state.compare) {
      var na = r.equity.map(function (x) { return x.equity / r.capital * 100; });
      var nb = state.compare.result.equity.map(function (x) { return x.equity / state.compare.result.capital * 100; });
      var n = Math.min(na.length, nb.length);
      var cs = sampleRows(n, 60);
      var cmpRows = [];
      for (var c = 0; c < n; c += cs.step) {
        cmpRows.push([isoDate(r.equity[c].date), na[c].toFixed(1) + '%', nb[c].toFixed(1) + '%']);
      }
      var cmpSig = 'c' + n + ':' + state.compare.ticker;
      if (chartDataSig.cmp !== cmpSig) {
        chartDataSig.cmp = cmpSig;
        dataTable('cmpData', ['Date', state.meta.ticker, state.compare.ticker], cmpRows);
      }
    } else {
      chartDataSig.cmp = null;
      var cmpHost = document.getElementById('cmpData');
      if (cmpHost) cmpHost.innerHTML = '';
    }
  }

  /* ───────────────────────── chart zoom / pan ───────────────────────── */
  var CHART_LABELS = {
    priceChart: 'Price chart with trade fills',
    eqChart: 'Equity curve versus buy and hold',
    ddChart: 'Drawdown chart',
    cmpChart: 'Strategy comparison chart'
  };

  function bindChartZoom() {
    CHART_IDS.forEach(function (id) {
      var cv = document.getElementById(id);
      if (!cv || cv.dataset.zoomBound) return;
      cv.dataset.zoomBound = '1';
      cv.tabIndex = 0;
      cv.setAttribute('role', 'img');
      cv.setAttribute('aria-label', CHART_LABELS[id] + '. Scroll or use plus and minus to zoom, drag to pan, and press zero to reset.');
      cv.title = 'Scroll to zoom · drag to pan · double-click to reset';

      var wrap = cv.parentElement;
      var tools = document.createElement('div');
      tools.className = 'chart-tools';
      tools.setAttribute('role', 'group');
      tools.setAttribute('aria-label', CHART_LABELS[id] + ' zoom');

      [['out', '−', 'Zoom out'], ['in', '+', 'Zoom in'], ['reset', '↺', 'Reset zoom']].forEach(function (spec) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = spec[1];
        btn.title = spec[2];
        btn.setAttribute('aria-label', spec[2] + ' — ' + CHART_LABELS[id]);
        btn.dataset['zoom' + spec[0][0].toUpperCase() + spec[0].slice(1)] = id;
        tools.appendChild(btn);
      });

      tools.addEventListener('click', function (e) {
        var btn = e.target.closest('button');
        if (!btn) return;
        if (btn.dataset.zoomIn) zoomChart(id, 0.68);
        else if (btn.dataset.zoomOut) zoomChart(id, 1 / 0.68);
        else resetChartView(id);
      });
      wrap.appendChild(tools);

      function plotFraction(clientX) {
        var r = cv.getBoundingClientRect();
        var mm = CHART_MARGINS[id];
        return clamp((clientX - r.left - mm.l) / Math.max(1, r.width - mm.l - mm.r), 0, 1);
      }

      cv.addEventListener('wheel', function (e) {
        var delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1);
        if (!delta) return;
        if (zoomChart(id, Math.exp(delta * 0.0015), plotFraction(e.clientX))) e.preventDefault();
      }, { passive: false });

      var drag = null;
      cv.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        hideChartTip();
        drag = { pointer: e.pointerId, x: e.clientX };
        try { cv.setPointerCapture(e.pointerId); } catch (_) {}
        cv.classList.add('is-dragging');
      });
      cv.addEventListener('pointermove', function (e) {
        if (!drag || drag.pointer !== e.pointerId) return;
        var r = cv.getBoundingClientRect();
        var mm = CHART_MARGINS[id];
        var pw = Math.max(1, r.width - mm.l - mm.r);
        var dx = e.clientX - drag.x;
        drag.x = e.clientX;
        if (!dx) return;
        var v = getChartView(id);
        var span = v.b - v.a;
        var a = clamp(v.a - (dx / pw) * span, 0, 1 - span);
        if (Math.abs(a - v.a) < 1e-7) return;
        v.a = a;
        v.b = a + span;
        scheduleDraws();
        updateChartButtons(id);
      });
      function endDrag(e) {
        if (!drag || drag.pointer !== e.pointerId) return;
        drag = null;
        cv.classList.remove('is-dragging');
        try { cv.releasePointerCapture(e.pointerId); } catch (_) {}
      }
      cv.addEventListener('pointerup', endDrag);
      cv.addEventListener('pointercancel', endDrag);

      cv.addEventListener('dblclick', function (e) {
        e.preventDefault();
        resetChartView(id);
      });

      if (id === 'priceChart') {
        cv.addEventListener('mousemove', function (e) {
          var r = cv.getBoundingClientRect();
          var mx = e.clientX - r.left, my = e.clientY - r.top;
          var best = null, bestD = 13;
          for (var i = 0; i < priceMarkers.length; i++) {
            var mk = priceMarkers[i];
            var d = Math.sqrt((mk.x - mx) * (mk.x - mx) + (mk.y - my) * (mk.y - my));
            if (d < bestD) { bestD = d; best = mk; }
          }
          if (best) showChartTip(markerTipHtml(best), e.clientX, e.clientY);
          else hideChartTip();
        });
        cv.addEventListener('mouseleave', hideChartTip);
      }

      cv.addEventListener('keydown', function (e) {
        if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          zoomChart(id, 0.68);
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          zoomChart(id, 1 / 0.68);
        } else if (e.key === '0' || e.key === 'Home') {
          e.preventDefault();
          resetChartView(id);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          panChart(id, -0.12);
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          panChart(id, 0.12);
        }
      });

      updateChartButtons(id);
    });
  }

  var drawRaf = 0;

  Falcon.charts = {fitCanvas: fitCanvas, scheduleDraws: scheduleDraws, chartPalette: chartPalette, drawAll: drawAll, drawCmp: drawCmp, resetChartView: resetChartView, resetAllChartViews: resetAllChartViews, updateChartButtons: updateChartButtons, zoomChart: zoomChart, panChart: panChart, bindChartZoom: bindChartZoom, CHART_IDS: CHART_IDS, CHART_LABELS: CHART_LABELS};
})(window);
