(function (global) {
  'use strict';
  var Falcon = global.Falcon = global.Falcon || {};

  /* ---------- the single shared state object ---------- */
  var state = {
    bars: [], datasetId: 'spy', period: 1260, source: 'synthetic', yahoo: null,
    meta: { ticker: 'SPY-SIM', name: 'S&P 500' },
    rules: { entry: [], exit: [] },
    logic: { entry: 'AND', exit: 'AND' },
    risk: { capital: 10000, sl: 3, tp: 6, comm: 0.02, slip: 0.02, mtf: false, fractional: true },
    result: null, compare: null, series: null, tab: 'overview', chartKey: ''
  };

  Falcon.state = state;
})(window);
