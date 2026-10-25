(function (global) {
  'use strict';
  var Falcon = global.Falcon = global.Falcon || {};
  var U = Falcon.util, E = Falcon.engine, C = Falcon.charts;
  var esc = U.esc, clamp = U.clamp, isoDate = U.isoDate, shortDate = U.shortDate, fmtPrice = U.fmtPrice,
        money = U.money, money0 = U.money0, fmtShares = U.fmtShares, compactMoney = U.compactMoney;
  var $ = U.$, $$ = U.$$;
  var state = Falcon.state;
  var DEFS = E.DEFS, TEMPLATES = E.TEMPLATES, IND_LABEL = E.IND_LABEL, IND_KEYS = E.IND_KEYS,
        OPS = E.OPS, OP_LABEL = E.OP_LABEL;
  var generateDataset = E.generateDataset, parseCsv = E.parseCsv, parseYahooChart = E.parseYahooChart,
        buildSeries = E.buildSeries, execute = E.execute;
  var fitCanvas = C.fitCanvas, scheduleDraws = C.scheduleDraws, resetChartView = C.resetChartView,
        resetAllChartViews = C.resetAllChartViews, drawCmp = C.drawCmp, bindChartZoom = C.bindChartZoom,
        chartPalette = C.chartPalette;
  /* ---------- ui state, rendering, themes, exports and wiring ---------- */
  function loadDataset(id, period) {
    var def = DEFS[id];
    if (!def) return;
    state.datasetId = id;
    state.period = period;
    state.source = 'synthetic';
    state.yahoo = null;
    state.bars = generateDataset(def, period);
    state.meta = { ticker: def.ticker, name: def.name };
    clearCsvSelection();
    var sel = $('#dtSet');
    if (sel) {
      ['yahoo', 'custom'].forEach(function (value) {
        var option = sel.querySelector('option[value="' + value + '"]');
        if (option) option.remove();
      });
    }
  }

  function setStatus(text) { $('#runStatus').textContent = text; }

  function bindDeployment() {
    var input = $('#yProxy');
    var save = $('#yProxySave');
    var clear = $('#yProxyClear');
    if (!input) return;
    input.value = apiBase();
    if (save) {
      save.addEventListener('click', function () {
        var value = String(input.value || '').trim().replace(/\/+$/, '');
        try { localStorage.setItem(API_BASE_KEY, value); } catch (e) {}
        input.value = value;
        setYahooNote(value ? 'Yahoo proxy set to ' + value : 'Using the bundled proxy.');
      });
    }
    if (clear) {
      clear.addEventListener('click', function () {
        try { localStorage.removeItem(API_BASE_KEY); } catch (e) {}
        input.value = '';
        setYahooNote('Using the bundled proxy.');
      });
    }
  }

  function dataSourceLabel() {
    if (state.source === 'yahoo') return 'Yahoo Finance · adjusted daily';
    if (state.source === 'csv') return 'Custom CSV';
    return 'Simulated series · not real market data';
  }

  function updateChrome() {
    var bars = state.bars;
    var ticker = state.meta.ticker || 'CUSTOM';
    $('#labChip').textContent = ticker + ' · ' + bars.length.toLocaleString() + ' bars';
    var first = bars.length ? isoDate(bars[0].date) : '—';
    var last = bars.length ? isoDate(bars[bars.length - 1].date) : '—';
    $('#dtMeta').textContent = state.meta.name + ' · ' + first + ' → ' + last + ' · ' +
      bars.length.toLocaleString() + ' bars · ' + dataSourceLabel();
  }

  var yahooReq = 0;
  var YAHOO_PERIODS = { 252: '1y', 504: '2y', 1260: '5y', 2520: '10y', 5040: '20y' };
  var API_BASE_KEY = 'falcon-api-base';

  /* Where the Yahoo proxy lives.
     1. ?api=https://host  (shareable link, stored for the session)
     2. a saved base URL from the Deployment panel
     3. the bundled proxy: /api/yahoo served by server.py */
  function apiBase() {
    var fromUrl = '';
    try {
      fromUrl = new URLSearchParams(location.search).get('api') || '';
    } catch (e) {}
    if (fromUrl) {
      try { localStorage.setItem(API_BASE_KEY, fromUrl); } catch (e) {}
      return fromUrl.replace(/\/+$/, '');
    }
    try { return (localStorage.getItem(API_BASE_KEY) || '').replace(/\/+$/, ''); } catch (e) { return ''; }
  }

  function yahooEndpoint() {
    if (location.protocol === 'file:') return 'http://127.0.0.1:8765/api/yahoo';
    var base = apiBase();
    return base ? base + '/api/yahoo' : 'api/yahoo';
  }

  function setYahooNote(text, isError) {
    var el = $('#yNote');
    el.textContent = text;
    el.classList.toggle('is-error', !!isError);
  }

  function clearCsvSelection() {
    var input = $('#csvFile'), name = $('#csvName');
    if (input) input.value = '';
    if (name) name.textContent = 'No file selected';
  }

  function setUniverseOption(value, label) {
    var sel = $('#dtSet');
    ['yahoo', 'custom'].forEach(function (key) {
      if (key === value) return;
      var stale = sel.querySelector('option[value="' + key + '"]');
      if (stale) stale.remove();
    });
    var option = sel.querySelector('option[value="' + value + '"]');
    if (!option) {
      option = document.createElement('option');
      option.value = value;
      sel.appendChild(option);
    }
    option.textContent = label;
    sel.value = value;
  }

  function loadYahoo(query, period) {
    var symbol = String(query == null ? $('#ySymbol').value : query).trim();
    if (!symbol) {
      setYahooNote('Enter a Yahoo Finance ticker first.', true);
      $('#ySymbol').focus();
      return;
    }
    if (!/^[A-Za-z0-9.^=-]{1,24}$/.test(symbol)) {
      setYahooNote('Use a ticker such as AAPL, BTC-USD, ^GSPC or 0700.HK.', true);
      $('#ySymbol').focus();
      return;
    }

    var req = ++yahooReq;
    var periodKey = period || state.period;
    var endpoint = yahooEndpoint();
    var btn = $('#yLoad');
    btn.disabled = true;
    btn.textContent = 'Loading…';
    $('#ySymbol').setAttribute('aria-busy', 'true');
    setYahooNote('Fetching ' + symbol.toUpperCase() + ' from Yahoo Finance…');
    setStatus('Fetching ' + symbol.toUpperCase() + ' from Yahoo Finance…');

    fetch(endpoint + '?symbol=' + encodeURIComponent(symbol) + '&period=' + encodeURIComponent(YAHOO_PERIODS[periodKey] || '5y'), { headers: { Accept: 'application/json' } })
      .then(function (response) {
        return response.text().then(function (text) {
          var payload;
          try { payload = JSON.parse(text); } catch (e) {
            throw new Error(response.status === 404
              ? 'Yahoo proxy not available here. Run "python server.py" locally, or point the Deployment panel at a hosted copy of server.py.'
              : 'Yahoo proxy returned an invalid response.');
          }
          if (!response.ok && !(payload && payload.chart)) {
            throw new Error((payload && payload.error) || 'Yahoo Finance request failed (' + response.status + ')');
          }
          return payload;
        });
      })
      .then(function (payload) {
        if (req !== yahooReq) return;
        var data = parseYahooChart(payload, symbol);
        state.period = periodKey;
        state.source = 'yahoo';
        state.yahoo = { symbol: data.ticker };
        state.datasetId = 'yahoo';
        state.bars = data.bars;
        state.meta = { ticker: data.ticker, name: data.name };
        clearCsvSelection();
        $('#ySymbol').value = data.ticker;
        $('#dtPeriod').disabled = false;
        $('#dtPeriod').value = String(state.period);
        setUniverseOption('yahoo', 'Yahoo · ' + data.ticker);
        setYahooNote('Yahoo Finance · adjusted daily · ' + data.bars.length.toLocaleString() + ' bars');
        runNow();
        setStatus('Yahoo · ' + data.ticker + ' · ' + data.bars.length.toLocaleString() + ' bars');
      })
      .catch(function (err) {
        if (req !== yahooReq) return;
        var message = err.message || 'Yahoo Finance could not be reached.';
        if (location.protocol === 'file:' && /failed to fetch/i.test(message)) {
          message = 'Cannot reach the local Yahoo proxy. Run "python server.py" in this folder.';
        }
        $('#dtPeriod').value = String(state.period);
        setYahooNote(message, true);
        setStatus('Yahoo: ' + message);
      })
      .then(function () {
        if (req !== yahooReq) return;
        btn.disabled = false;
        btn.textContent = 'Load';
        $('#ySymbol').removeAttribute('aria-busy');
      });
  }

  function buildDatasetSelect() {
    var sel = $('#dtSet');
    Object.keys(DEFS).forEach(function (id) {
      var o = document.createElement('option');
      o.value = id;
      o.textContent = DEFS[id].name + ' · ' + DEFS[id].ticker;
      sel.appendChild(o);
    });
    sel.value = state.datasetId;
    var cmp = $('#cmpSet');
    Object.keys(DEFS).forEach(function (id) {
      var o = document.createElement('option');
      o.value = id;
      o.textContent = DEFS[id].name + ' · ' + DEFS[id].ticker;
      if (id === 'spy') o.selected = true;
      cmp.appendChild(o);
    });
  }

  function buildTemplateSelect() {
    var sel = $('#tplSel');
    Object.keys(TEMPLATES).forEach(function (name) {
      var o = document.createElement('option');
      o.value = name;
      o.textContent = name;
      sel.appendChild(o);
    });
    sel.value = 'Golden Cross';
  }

  function syncRiskInputs() {
    $('#rCapital').value = state.risk.capital;
    $('#rSl').value = state.risk.sl;
    $('#rTp').value = state.risk.tp;
    $('#rComm').value = state.risk.comm;
    $('#rSlip').value = state.risk.slip;
    $('#rFrac').checked = state.risk.fractional !== false;
    $('#rMtf').checked = !!state.risk.mtf;
  }

  function syncLogicButtons() {
    $$('.seg').forEach(function (seg) {
      var side = seg.dataset.logic;
      $$('button', seg).forEach(function (b) {
        b.setAttribute('aria-pressed', String(b.dataset.val === state.logic[side]));
      });
    });
  }

  function ruleRow(side, rule, idx) {
    var row = document.createElement('div');
    row.className = 'rule';
    row.dataset.idx = String(idx);
    row.dataset.side = side;

    var left = document.createElement('select');
    left.className = 'r-left';
    left.setAttribute('aria-label', 'Left indicator');
    IND_KEYS.forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = IND_LABEL[k];
      if (k === rule.left) o.selected = true;
      left.appendChild(o);
    });

    var op = document.createElement('select');
    op.className = 'r-op';
    op.setAttribute('aria-label', 'Operator');
    OPS.forEach(function (k) {
      var o = document.createElement('option');
      o.value = k; o.textContent = OP_LABEL[k] || k;
      if (k === rule.op) o.selected = true;
      op.appendChild(o);
    });

    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.textContent = '×';
    del.setAttribute('aria-label', 'Remove rule');
    del.dataset.del = '1';

    var right = document.createElement('div');
    right.className = 'rule-right';

    var type = document.createElement('select');
    type.className = 'r-type';
    type.setAttribute('aria-label', 'Compare against');
    [['indicator', 'vs ind'], ['value', 'vs value']].forEach(function (pair) {
      var o = document.createElement('option');
      o.value = pair[0]; o.textContent = pair[1];
      if (pair[0] === rule.rightType) o.selected = true;
      type.appendChild(o);
    });

    var rightWrap;
    if (rule.rightType === 'value') {
      rightWrap = document.createElement('input');
      rightWrap.type = 'number';
      rightWrap.className = 'r-right-val';
      rightWrap.value = rule.right;
      rightWrap.step = '0.1';
      rightWrap.setAttribute('aria-label', 'Value');
    } else {
      rightWrap = document.createElement('select');
      rightWrap.className = 'r-right-ind';
      rightWrap.setAttribute('aria-label', 'Right indicator');
      IND_KEYS.forEach(function (k) {
        var o = document.createElement('option');
        o.value = k; o.textContent = IND_LABEL[k];
        if (k === rule.right) o.selected = true;
        rightWrap.appendChild(o);
      });
    }

    right.appendChild(type);
    right.appendChild(rightWrap);
    row.appendChild(left);
    row.appendChild(op);
    row.appendChild(del);
    row.appendChild(right);
    return row;
  }

  function renderRules(side) {
    var box = side === 'entry' ? $('#entryRules') : $('#exitRules');
    box.textContent = '';
    var rules = state.rules[side];
    if (!rules.length) {
      var empty = document.createElement('p');
      empty.className = 'rail-meta';
      empty.textContent = side === 'entry' ? 'No entry rule — nothing opens.' : 'No exit rule — SL/TP only.';
      box.appendChild(empty);
      return;
    }
    rules.forEach(function (r, i) { box.appendChild(ruleRow(side, r, i)); });
  }

  function renderAllRules() {
    renderRules('entry');
    renderRules('exit');
  }

  function applyTemplate(name, opts) {
    var t = TEMPLATES[name];
    if (!t) return;
    state.rules.entry = t.entry.map(function (r) { return Object.assign({}, r); });
    state.rules.exit = t.exit.map(function (r) { return Object.assign({}, r); });
    state.logic.entry = t.logic[0];
    state.logic.exit = t.logic[1];
    state.risk.sl = t.sl;
    state.risk.tp = t.tp;
    state.risk.mtf = !!t.mtf;
    state.risk.capital = state.risk.capital || 10000;
    syncRiskInputs();
    syncLogicButtons();
    renderAllRules();
    $('#tplSel').value = name;
    if (!opts || opts.run !== false) scheduleRun();
  }

  function scheduleRun() {
    clearTimeout(runTimer);
    runTimer = setTimeout(runNow, 170);
  }

  function runNow() {
    clearTimeout(runTimer);
    try {
      state.series = buildSeries(state.bars, state.risk.mtf);
      state.result = execute(state.bars, state.series, state.rules, state.logic, state.risk);
      var first = state.bars[0], last = state.bars[state.bars.length - 1];
      var key = [state.source, state.meta.ticker, state.bars.length, first ? first.time : '', last ? last.time : ''].join('|');
      if (key !== state.chartKey) {
        state.chartKey = key;
        resetAllChartViews();
      }
      renderAll();
      if (state.tab === 'compare') renderCompare();
      setStatus(state.result.trades.length + ' trades · ' + (state.result.metrics.totalReturn >= 0 ? '+' : '') + state.result.metrics.totalReturn.toFixed(2) + '%');
    } catch (err) {
      setStatus('Run failed');
      if (window.console) console.error(err);
    }
  }

  function statTile(k, v, cls, sub) {
    return '<div class="stat"><span class="k">' + esc(k) + '</span><span class="v ' + (cls || '') + '">' + v +
      '</span>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div>';
  }

  function renderStats() {
    var r = state.result;
    var warn = $('#warnBox');
    if (!r) {
      if (warn) { warn.hidden = true; warn.innerHTML = ''; }
      $('#statGrid').innerHTML = '<p class="lab-empty">Run a backtest to see results.</p>';
      return;
    }
    if (warn) {
      if (r.blockedEntries > 0) {
        var cost = r.blockedPrice;
        var need = Math.ceil(cost * (1 + (state.risk.comm + state.risk.slip) / 100));
        warn.hidden = false;
        warn.innerHTML = '<strong>No position was opened.</strong> ' + r.blockedEntries + ' entry signal' +
          (r.blockedEntries === 1 ? '' : 's') + ' fired, but one whole share of ' + esc(state.meta.ticker) +
          ' costs ' + money0(cost) + ' — more than your ' + money0(state.risk.capital) +
          ' capital. Raise capital to at least ' + money0(need) + ' or pick a lower-priced universe.';
      } else {
        warn.hidden = true;
        warn.innerHTML = '';
      }
    }
    var m = r.metrics;
    var pnlCls = m.netPnl >= 0 ? 'pos' : 'neg';
    var retCls = m.totalReturn >= 0 ? 'pos' : 'neg';
    var pf = Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : '∞';
    $('#statGrid').innerHTML =
      statTile('Net P&L', money0(m.netPnl), pnlCls, (m.totalReturn >= 0 ? '+' : '') + m.totalReturn.toFixed(2) + '% return') +
      statTile('Total return', (m.totalReturn >= 0 ? '+' : '') + m.totalReturn.toFixed(2) + '%', retCls, money0(m.finalCapital) + ' final') +
      statTile('Trades', String(m.totalTrades), '', m.winRate.toFixed(0) + '% win rate') +
      statTile('Win rate', m.winRate.toFixed(1) + '%', '', money0(m.expectancy) + ' expectancy') +
      statTile('Profit factor', pf, '', 'gross win / loss') +
      statTile('Max drawdown', (m.maxDrawdown > 0.005 ? '-' : '') + m.maxDrawdown.toFixed(2) + '%', m.maxDrawdown > 0.005 ? 'neg' : '', 'peak to trough') +
      statTile('Sharpe', m.sharpe.toFixed(2), '', 'annualized, 252d') +
      statTile('Sortino', m.sortino.toFixed(2), '', 'downside adjusted') +
      statTile('Calmar', m.calmar.toFixed(2), '', 'return / drawdown') +
      statTile('Avg win', money0(m.avgWin), '', 'best +' + m.bestTrade.toFixed(1) + '%') +
      statTile('Avg loss', money0(m.avgLoss), '', 'worst ' + m.worstTrade.toFixed(1) + '%') +
      statTile('Fees paid', money0(m.fees), '', m.maxConsecWins + 'W / ' + m.maxConsecLosses + 'L streaks');
  }

  function renderTrades() {
    var r = state.result;
    var body = $('#tradeTable').querySelector('tbody');
    body.innerHTML = '';
    if (!r) { $('#tradeMeta').textContent = ''; return; }
    var trades = r.trades;
    $('#tradeTitle').textContent = 'Trade log';
    $('#tradeMeta').textContent = trades.length
      ? trades.length + ' executions · ' + money0(r.finalCapital) + ' final equity' + (trades.length > 500 ? ' · showing latest 500' : '')
      : 'No trades';
    if (!trades.length) {
      var tr0 = document.createElement('tr');
      var td0 = document.createElement('td');
      td0.colSpan = 9;
      td0.textContent = 'No trades were triggered by these rules.';
      td0.style.textAlign = 'center';
      td0.style.padding = '1.4rem';
      td0.className = 'muted-note';
      tr0.appendChild(td0);
      body.appendChild(tr0);
      return;
    }
    var rows = trades.slice(-500).reverse();
    rows.forEach(function (t) {
      var tr = document.createElement('tr');
      var win = t.pnl > 0;
      tr.innerHTML =
        '<td>' + isoDate(t.entryDate) + '</td>' +
        '<td>' + isoDate(t.exitDate) + '</td>' +
        '<td>' + fmtPrice(t.entryPrice) + '</td>' +
        '<td>' + fmtPrice(t.exitPrice) + '</td>' +
        '<td>' + fmtShares(t.shares) + '</td>' +
        '<td class="' + (win ? 'pos' : 'neg') + '">' + money(t.pnl) + '</td>' +
        '<td><span class="pill ' + (win ? 'win' : 'loss') + '">' + (t.retPct >= 0 ? '+' : '') + t.retPct.toFixed(2) + '%</span></td>' +
        '<td>' + t.duration + '</td>' +
        '<td><span class="tagx">' + esc(t.reason) + '</span></td>';
      body.appendChild(tr);
    });
    if (trades.length > 500) {
      var trn = document.createElement('tr');
      var tdn = document.createElement('td');
      tdn.colSpan = 9;
      tdn.style.textAlign = 'center';
      tdn.className = 'muted-note';
      tdn.textContent = 'Showing latest 500 of ' + trades.length + ' trades.';
      trn.appendChild(tdn);
      body.appendChild(trn);
    }
  }

  function monthlyMatrix() {
    var eq = state.result.equity;
    var cap = state.result.capital;
    var months = [];
    eq.forEach(function (p) {
      var key = p.date.getFullYear() * 12 + p.date.getMonth();
      if (months.length && months[months.length - 1].key === key) months[months.length - 1].last = p.equity;
      else months.push({ key: key, year: p.date.getFullYear(), month: p.date.getMonth(), last: p.equity });
    });
    var rets = months.map(function (m, i) {
      var base = i === 0 ? cap : months[i - 1].last;
      return base > 0 ? (m.last / base - 1) * 100 : 0;
    });
    return { months: months, rets: rets };
  }

  function renderHeatmap() {
    var pal = chartPalette();
    var box = $('#heatmap');
    box.innerHTML = '';
    if (!state.result || !state.result.equity.length) {
      box.innerHTML = '<p class="lab-empty">No equity history.</p>';
      $('#hmMeta').textContent = '';
      return;
    }
    var data = monthlyMatrix();
    var years = [];
    data.months.forEach(function (m) { if (years.indexOf(m.year) < 0) years.push(m.year); });
    var max = 0.01;
    data.rets.forEach(function (v) { max = Math.max(max, Math.abs(v)); });
    var up = data.rets.filter(function (v) { return v > 0.05; }).length;
    var down = data.rets.filter(function (v) { return v < -0.05; }).length;
    $('#hmMeta').textContent = data.months.length + ' months · ' + up + ' up · ' + down + ' down';

    var table = document.createElement('table');
    var thead = document.createElement('thead');
    var htr = document.createElement('tr');
    var th0 = document.createElement('th');
    th0.textContent = 'Year';
    htr.appendChild(th0);
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].forEach(function (mn) {
      var th = document.createElement('th');
      th.textContent = mn;
      htr.appendChild(th);
    });
    thead.appendChild(htr);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    years.forEach(function (y) {
      var tr = document.createElement('tr');
      var yc = document.createElement('td');
      yc.className = 'year';
      yc.textContent = y;
      tr.appendChild(yc);
      for (var m = 0; m < 12; m++) {
        var td = document.createElement('td');
        var idx = data.months.findIndex(function (mm) { return mm.year === y && mm.month === m; });
        if (idx < 0) {
          td.className = 'empty';
        } else {
          var v = data.rets[idx];
          td.title = y + '-' + String(m + 1).padStart(2, '0') + ': ' + v.toFixed(2) + '%';
          if (Math.abs(v) < 0.05) {
            td.className = 'flat';
            td.textContent = '·';
          } else {
            var alpha = Math.min(0.46, 0.06 + Math.sqrt(Math.abs(v) / max) * 0.4);
            td.style.background = v > 0 ? 'rgba(' + pal.posRgb + ',' + alpha.toFixed(2) + ')' : 'rgba(' + pal.negRgb + ',' + alpha.toFixed(2) + ')';
            td.textContent = (v > 0 ? '+' : '') + v.toFixed(1);
          }
        }
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    box.appendChild(table);
  }

  function renderAll() {
    updateChrome();
    renderStats();
    renderTrades();
    renderHeatmap();
    scheduleDraws();
  }

  var THEMES = ['ember', 'slate', 'forest', 'midnight'];
  var THEME_KEY = 'falcon-theme';
  var BG_KEY = 'falcon-bg-anim';
  var threads = null;

  function backgroundAnimated() {
    try {
      var v = localStorage.getItem(BG_KEY);
      if (v === '0') return false;
      if (v === '1') return true;
    } catch (e) {}
    return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function bindBackgroundToggle() {
    var btn = $('#bgBtn');
    if (!btn) return;
    var apply = function () {
      var on = backgroundAnimated();
      btn.classList.toggle('is-paused', !on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'Pause background animation' : 'Resume background animation');
      btn.setAttribute('title', on ? 'Pause background animation' : 'Resume background animation');
      if (threads) threads.setOptions({ paused: !on });
    };
    btn.addEventListener('click', function () {
      try { localStorage.setItem(BG_KEY, backgroundAnimated() ? '0' : '1'); } catch (e) {}
      apply();
    });
    apply();
  }

  function threadColors() {
    var cs = getComputedStyle(document.documentElement);
    return {
      color: cs.getPropertyValue('--thread-color').trim() || '#ffffff',
      accentColor: cs.getPropertyValue('--thread-accent').trim() || '#ffffff'
    };
  }

  function initThreads() {
    var create = Falcon.threads && Falcon.threads.createThreads;
    if (!create) return;
    var host = $('#threadsBg');
    if (!host) return;
    var colors = threadColors();
    threads = create(host, {
      color: colors.color,
      accentColor: colors.accentColor,
      lineCount: 110,
      thickness: 1,
      softness: 1.2,
      amplitude: 1.7,
      distance: 0.4,
      waves: 1.05,
      speed: 0.6,
      split: 0.04,
      fray: 0.5,
      angle: 25,
      taper: 0.85,
      brightness: 1.5,
      parting: 0.25,
      enableMouseInteraction: true,
      fade: 0,
      opacity: 0.95,
      paused: !backgroundAnimated()
    });
  }

  function currentTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    return THEMES.indexOf(t) >= 0 ? t : 'ember';
  }

  function applyTheme(name) {
    if (THEMES.indexOf(name) < 0) name = 'ember';
    if (name === 'ember') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', name);
    document.documentElement.style.colorScheme = name === 'midnight' ? 'dark' : 'light';
    try { localStorage.setItem(THEME_KEY, name); } catch (e) {}
    if (threads) threads.setOptions(threadColors());
    syncThemeButtons();
    renderHeatmap();
    scheduleDraws();
  }

  function syncThemeButtons() {
    var active = currentTheme();
    $$('.theme-dot').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.getAttribute('data-theme') === active ? 'true' : 'false');
    });
  }

  function bindThemePicker() {
    $$('.theme-dot').forEach(function (btn) {
      btn.addEventListener('click', function () { applyTheme(btn.getAttribute('data-theme')); });
    });
    document.documentElement.style.colorScheme = currentTheme() === 'midnight' ? 'dark' : 'light';
    syncThemeButtons();
  }

  /* ───────────────────────── compare ───────────────────────── */
  function compareSignature() {
    return [
      state.source, state.meta.ticker, state.bars.length, state.period,
      JSON.stringify(state.rules), JSON.stringify(state.logic),
      state.risk.capital, state.risk.sl, state.risk.tp, state.risk.comm, state.risk.slip, state.risk.mtf
    ].join('|');
  }

  function renderCompare() {
    var statsBox = $('#cmpStats');
    var tableBox = $('#cmpTable');
    if (state.compare && state.compare.sig && state.compare.sig !== compareSignature()) state.compare = null;
    if (!state.compare) {
      statsBox.innerHTML = '';
      tableBox.innerHTML = '<p class="lab-empty">Pick a second universe and run the comparison.</p>';
      var noteBox = $('#cmpNote');
      if (noteBox) { noteBox.hidden = true; noteBox.innerHTML = ''; }
      var cv = $('#cmpChart');
      if (cv) { var f = fitCanvas(cv); if (f) f.ctx.clearRect(0, 0, f.w, f.h); }
      return;
    }
    var cmpNote = $('#cmpNote');
    if (cmpNote) {
      var day = 86400000;
      var startGap = Math.abs((state.compare.aStart || 0) - (state.compare.bStart || 0)) / day;
      var endGap = Math.abs((state.compare.aEnd || 0) - (state.compare.bEnd || 0)) / day;
      if (startGap > 3 || endGap > 3) {
        cmpNote.hidden = false;
        cmpNote.innerHTML = '<strong>Date ranges differ.</strong> ' + esc(state.meta.ticker) + ' covers ' +
          isoDate(new Date(state.compare.aStart)) + ' → ' + isoDate(new Date(state.compare.aEnd)) + ' while ' +
          esc(state.compare.ticker) + ' covers ' + isoDate(new Date(state.compare.bStart)) + ' → ' +
          isoDate(new Date(state.compare.bEnd)) + '. The curves are aligned by bar index, not by date.';
      } else {
        cmpNote.hidden = true;
        cmpNote.innerHTML = '';
      }
    }
    var a = state.result.metrics, b = state.compare.result.metrics;
    var aName = state.meta.name, bName = state.compare.name;
    statsBox.innerHTML =
      statTile(aName + ' return', (a.totalReturn >= 0 ? '+' : '') + a.totalReturn.toFixed(2) + '%', a.totalReturn >= 0 ? 'pos' : 'neg', a.totalTrades + ' trades') +
      statTile(bName + ' return', (b.totalReturn >= 0 ? '+' : '') + b.totalReturn.toFixed(2) + '%', b.totalReturn >= 0 ? 'pos' : 'neg', b.totalTrades + ' trades') +
      statTile('Return delta', ((a.totalReturn - b.totalReturn) >= 0 ? '+' : '') + (a.totalReturn - b.totalReturn).toFixed(2) + ' pts', a.totalReturn >= b.totalReturn ? 'pos' : 'neg', 'A minus B') +
      statTile('Sharpe delta', ((a.sharpe - b.sharpe) >= 0 ? '+' : '') + (a.sharpe - b.sharpe).toFixed(2), a.sharpe >= b.sharpe ? 'pos' : 'neg', 'annualized') +
      statTile('Max DD delta', ((a.maxDrawdown - b.maxDrawdown) >= 0 ? '+' : '') + (a.maxDrawdown - b.maxDrawdown).toFixed(2) + ' pts', a.maxDrawdown <= b.maxDrawdown ? 'pos' : 'neg', 'lower is better') +
      statTile('Win rate', a.winRate.toFixed(0) + '% / ' + b.winRate.toFixed(0) + '%', '', 'A / B');

    var rows = [
      ['Total return', (a.totalReturn >= 0 ? '+' : '') + a.totalReturn.toFixed(2) + '%', (b.totalReturn >= 0 ? '+' : '') + b.totalReturn.toFixed(2) + '%'],
      ['Net P&L', money0(a.netPnl), money0(b.netPnl)],
      ['Sharpe', a.sharpe.toFixed(2), b.sharpe.toFixed(2)],
      ['Sortino', a.sortino.toFixed(2), b.sortino.toFixed(2)],
      ['Max drawdown', '-' + a.maxDrawdown.toFixed(2) + '%', '-' + b.maxDrawdown.toFixed(2) + '%'],
      ['Profit factor', Number.isFinite(a.profitFactor) ? a.profitFactor.toFixed(2) : '∞', Number.isFinite(b.profitFactor) ? b.profitFactor.toFixed(2) : '∞'],
      ['Trades', String(a.totalTrades), String(b.totalTrades)],
      ['Win rate', a.winRate.toFixed(1) + '%', b.winRate.toFixed(1) + '%']
    ];
    var head = '<div class="cmp-row"><span class="name"><span class="dot"></span>' + esc(aName) +
      '</span><span class="name"><span class="dot grey"></span>' + esc(bName) + '</span></div>';
    tableBox.innerHTML = head + rows.map(function (r) {
      return '<div class="cmp-row"><span>' + r[0] + '</span><span>' + r[1] + '</span><span>' + r[2] + '</span></div>';
    }).join('');
    requestAnimationFrame(drawCmp);
  }

  function runCompare() {
    var id = $('#cmpSet').value;
    if (!DEFS[id]) return;
    try {
      var bars = generateDataset(DEFS[id], state.period);
      var series = buildSeries(bars, state.risk.mtf);
      var result = execute(bars, series, state.rules, state.logic, state.risk);
      state.compare = {
        id: id, name: DEFS[id].name, ticker: DEFS[id].ticker, bars: bars, result: result,
        sig: compareSignature(),
        aStart: state.bars.length ? state.bars[0].time : 0,
        aEnd: state.bars.length ? state.bars[state.bars.length - 1].time : 0,
        bStart: bars.length ? bars[0].time : 0,
        bEnd: bars.length ? bars[bars.length - 1].time : 0
      };
      resetChartView('cmpChart');
      renderCompare();
      setStatus('Comparing ' + state.meta.ticker + ' vs ' + DEFS[id].ticker);
    } catch (err) {
      setStatus('Comparison failed');
    }
  }

  /* ───────────────────────── exports ───────────────────────── */
  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function exportCsv() {
    if (!state.result) return;
    var lines = ['entry_date,exit_date,entry_price,exit_price,shares,pnl,return_pct,bars_held,reason'];
    state.result.trades.forEach(function (t) {
      lines.push([
        isoDate(t.entryDate), isoDate(t.exitDate), t.entryPrice.toFixed(4), t.exitPrice.toFixed(4),
        fmtShares(t.shares), t.pnl.toFixed(2), t.retPct.toFixed(4), t.duration, t.reason
      ].join(','));
    });
    download('trades_' + (state.meta.ticker || 'custom').replace(/[^\w-]/g, '_') + '_v1.csv', lines.join('\n'), 'text/csv;charset=utf-8');
  }

  function ruleText(conds) {
    return conds.map(function (r) {
      var right = r.rightType === 'value' ? r.right : (IND_LABEL[r.right] || r.right);
      return (IND_LABEL[r.left] || r.left) + ' ' + (OP_LABEL[r.op] || r.op) + ' ' + right;
    }).join(' ' + state.logic.entry + ' ');
  }

  function exportReport() {
    if (!state.result) return;
    var m = state.result.metrics;
    var risk = state.risk;
    var lines = [];
    lines.push('Falcon Lab — Strategy Backtest Report (v1)');
    lines.push('='.repeat(52));
    lines.push('Generated: ' + new Date().toISOString());
    lines.push('Universe: ' + state.meta.name + ' (' + state.meta.ticker + ')');
    lines.push('Data source: ' + dataSourceLabel());
    lines.push('Bars: ' + state.bars.length + ' · ' + isoDate(state.bars[0].date) + ' to ' + isoDate(state.bars[state.bars.length - 1].date));
    lines.push('');
    lines.push('STRATEGY');
    lines.push('Entry: ' + (ruleText(state.rules.entry) || 'none'));
    lines.push('Exit: ' + (ruleText(state.rules.exit) || 'none'));
    lines.push('Stop loss: ' + risk.sl + '% · Take profit: ' + risk.tp + '%');
    lines.push('Capital: ' + money0(risk.capital) + ' · Commission: ' + risk.comm + '% · Slippage: ' + risk.slip + '%');
    lines.push('Position sizing: ' + (state.result.fractional ? 'fractional shares' : 'whole shares'));
    lines.push('Weekly filter: ' + (risk.mtf ? 'on' : 'off'));
    lines.push('');
    lines.push('PERFORMANCE');
    lines.push('Net P&L: ' + money0(m.netPnl));
    lines.push('Total return: ' + m.totalReturn.toFixed(2) + '%');
    lines.push('Final capital: ' + money0(m.finalCapital));
    lines.push('Trades: ' + m.totalTrades + ' · Win rate: ' + m.winRate.toFixed(1) + '%');
    lines.push('Profit factor: ' + (Number.isFinite(m.profitFactor) ? m.profitFactor.toFixed(2) : 'inf'));
    lines.push('Max drawdown: ' + m.maxDrawdown.toFixed(2) + '%');
    lines.push('Sharpe: ' + m.sharpe.toFixed(2) + ' · Sortino: ' + m.sortino.toFixed(2) + ' · Calmar: ' + m.calmar.toFixed(2));
    lines.push('Avg win: ' + money0(m.avgWin) + ' · Avg loss: ' + money0(m.avgLoss) + ' · Expectancy: ' + money0(m.expectancy));
    lines.push('Streaks: ' + m.maxConsecWins + ' wins / ' + m.maxConsecLosses + ' losses');
    lines.push('Fees paid: ' + money0(m.fees));
    lines.push('');
    lines.push('TRADES');
    state.result.trades.forEach(function (t, i) {
      lines.push([
        '#' + (i + 1), isoDate(t.entryDate), '→', isoDate(t.exitDate),
        fmtShares(t.shares) + ' sh', fmtPrice(t.entryPrice), '→', fmtPrice(t.exitPrice),
        money(t.pnl), t.retPct.toFixed(2) + '%', t.reason
      ].join(' '));
    });
    download('report_' + (state.meta.ticker || 'custom').replace(/[^\w-]/g, '_') + '_v1.txt', '\uFEFF' + lines.join('\n'), 'text/plain;charset=utf-8');
  }

  function switchTab(tab) {
    state.tab = tab;
    $$('.lab-tabs [role="tab"]').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.tab === tab));
    });
    [['overview', 'paneOverview'], ['trades', 'paneTrades'], ['compare', 'paneCompare']].forEach(function (pair) {
      var pane = document.getElementById(pair[1]);
      if (pane) pane.hidden = pair[0] !== tab;
    });
    if (tab === 'compare') renderCompare();
    scheduleDraws();
  }

  function bindRules(side) {
    var box = side === 'entry' ? $('#entryRules') : $('#exitRules');
    box.addEventListener('change', function (e) {
      var row = e.target.closest('.rule');
      if (!row) return;
      var idx = Number(row.dataset.idx);
      var rule = state.rules[side][idx];
      if (!rule) return;
      if (e.target.classList.contains('r-left')) rule.left = e.target.value;
      else if (e.target.classList.contains('r-op')) rule.op = e.target.value;
      else if (e.target.classList.contains('r-right-ind')) rule.right = e.target.value;
      else if (e.target.classList.contains('r-right-val')) rule.right = e.target.value;
      else if (e.target.classList.contains('r-type')) {
        rule.rightType = e.target.value;
        if (rule.rightType === 'value' && !Number.isFinite(Number(rule.right))) rule.right = '30';
        if (rule.rightType === 'indicator') rule.right = rule.right === '30' ? 'sma_50' : rule.right;
        renderRules(side);
      }
      scheduleRun();
    });
    box.addEventListener('input', function (e) {
      if (!e.target.classList.contains('r-right-val')) return;
      var row = e.target.closest('.rule');
      if (!row) return;
      var rule = state.rules[side][Number(row.dataset.idx)];
      if (rule) { rule.right = e.target.value; scheduleRun(); }
    });
    box.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-del]');
      if (!btn) return;
      var row = btn.closest('.rule');
      var idx = Number(row.dataset.idx);
      state.rules[side].splice(idx, 1);
      renderRules(side);
      runNow();
    });
  }

  function addRule(side) {
    state.rules[side].push(side === 'entry'
      ? { left: 'sma_10', op: 'crosses_above', rightType: 'indicator', right: 'sma_50' }
      : { left: 'sma_10', op: 'crosses_below', rightType: 'indicator', right: 'sma_50' });
    renderRules(side);
    runNow();
  }

  function bindLab() {
    $$('.lab-tabs [role="tab"]').forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.dataset.tab); });
    });
    $('#runBtn').addEventListener('click', function () { runNow(); });
    $('#addEntry').addEventListener('click', function () { addRule('entry'); });
    $('#addExit').addEventListener('click', function () { addRule('exit'); });

    $$('.seg').forEach(function (seg) {
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        var side = seg.dataset.logic;
        state.logic[side] = b.dataset.val;
        syncLogicButtons();
        scheduleRun();
      });
    });

    $('#dtSet').addEventListener('change', function (e) {
      if (e.target.value === 'custom' || e.target.value === 'yahoo') return;
      $('#dtPeriod').disabled = false;
      setYahooNote('Daily adjusted OHLCV · uses selected history');
      loadDataset(e.target.value, state.period);
      $('#dtPeriod').value = String(state.period);
      runNow();
    });
    $('#dtPeriod').addEventListener('change', function (e) {
      var period = Number(e.target.value);
      if (state.source === 'csv') {
        state.period = period;
        return;
      }
      if (state.source === 'yahoo' && state.yahoo) {
        loadYahoo(state.yahoo.symbol, period);
        return;
      }
      loadDataset(state.datasetId, period);
      runNow();
    });
    $('#yLoad').addEventListener('click', function () { loadYahoo(null, state.period); });
    $('#ySymbol').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        loadYahoo(null, state.period);
      }
    });
    $('#ySymbol').addEventListener('input', function () {
      if ($('#yNote').classList.contains('is-error')) setYahooNote('Daily adjusted OHLCV · uses selected history');
    });
    $('#tplSel').addEventListener('change', function (e) {
      applyTemplate(e.target.value);
    });

    [['rCapital', 'capital'], ['rSl', 'sl'], ['rTp', 'tp'], ['rComm', 'comm'], ['rSlip', 'slip']].forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      el.addEventListener('input', function () {
        var v = parseFloat(el.value);
        state.risk[pair[1]] = Number.isFinite(v) ? v : 0;
        scheduleRun();
      });
    });
    $('#rMtf').addEventListener('change', function (e) {
      state.risk.mtf = e.target.checked;
      scheduleRun();
    });
    $('#rFrac').addEventListener('change', function (e) {
      state.risk.fractional = e.target.checked;
      scheduleRun();
    });

    $('#csvFile').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      $('#csvName').textContent = file.name;
      if (file.size > 8 * 1024 * 1024) {
        $('#csvName').textContent = 'File too large';
        setStatus('CSV must be under 8 MB');
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var bars = parseCsv(String(reader.result));
          state.bars = bars;
          state.source = 'csv';
          state.yahoo = null;
          state.datasetId = 'custom';
          state.meta = { ticker: file.name.replace(/\.[^.]+$/, '').slice(0, 14).toUpperCase(), name: file.name.replace(/\.[^.]+$/, '') };
          setUniverseOption('custom', 'Custom · ' + state.meta.name);
          $('#dtPeriod').disabled = true;
          $('#cmpSet').value = 'spy';
          runNow();
        } catch (err) {
          $('#csvName').textContent = file.name + ' — not loaded';
          setStatus(err.message || 'CSV could not be read');
        }
      };
      reader.readAsText(file);
    });

    $('#cmpBtn').addEventListener('click', runCompare);
    $('#cmpSet').addEventListener('change', function () { state.compare = null; renderCompare(); });
    $('#csvBtn').addEventListener('click', exportCsv);
    $('#reportBtn').addEventListener('click', exportReport);

    window.addEventListener('resize', scheduleDraws);
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(scheduleDraws);
      ['priceChart', 'eqChart', 'ddChart', 'cmpChart'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) ro.observe(el);
      });
    }
  }

  function init() {
    buildDatasetSelect();
    buildTemplateSelect();
    bindRules('entry');
    bindRules('exit');
    bindLab();
    syncRiskInputs();
    syncLogicButtons();
    bindChartZoom();
    bindThemePicker();
    initThreads();
    bindBackgroundToggle();
    bindDeployment();
    loadDataset('spy', 1260);
    applyTemplate('Golden Cross', { run: false });
    renderAll();
    runNow();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  var runTimer = 0;

  Falcon.app = {init: init, applyTheme: applyTheme, currentTheme: currentTheme};
})(window);
