(function (global) {
  'use strict';
  var Falcon = global.Falcon = global.Falcon || {};

  /* ---------- the single shared state object ---------- */
  var state = {
    bars: [], period: 1260, source: 'empty', yahoo: null,
    meta: { ticker: '', name: '' },
    rules: { entry: [], exit: [] },
    logic: { entry: 'AND', exit: 'AND' },
    risk: { capital: 10000, sl: 3, tp: 6, comm: 0.02, slip: 0.02, mtf: false, fractional: true },
    result: null, compare: null, series: null, tab: 'overview', chartKey: ''
  };

  Falcon.state = state;
})(window);
