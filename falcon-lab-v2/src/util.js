(function (global) {
  'use strict';
  var Falcon = global.Falcon = global.Falcon || {};

  /* ---------- dom + formatting helpers ---------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function isoDate(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function shortDate(d, withYear) {
    try {
      return d.toLocaleDateString('en-US', withYear ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' });
    } catch (e) { return isoDate(d); }
  }
  function fmtPrice(v) {
    if (Math.abs(v) >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (Math.abs(v) >= 10) return v.toFixed(2);
    return v.toFixed(4);
  }
  function money(n) {
    var sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function money0(n) {
    var sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  function fmtShares(v) {
    if (!Number.isFinite(v)) return '0';
    if (Math.abs(v - Math.round(v)) < 1e-9) return String(Math.round(v));
    return v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  }
  function compactMoney(n) {
    var a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(2) + 'B';
    if (a >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (a >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return n.toFixed(0);
  }

  Falcon.util = {$: $, $$: $$, esc: esc, clamp: clamp, isoDate: isoDate, shortDate: shortDate, fmtPrice: fmtPrice, money: money, money0: money0, fmtShares: fmtShares, compactMoney: compactMoney};
})(window);
