/* Apply the saved theme before the first paint (no flash, no inline script). */
(function () {
  'use strict';
  try {
    var saved = localStorage.getItem('falcon-theme');
    if (saved && saved !== 'ember') document.documentElement.setAttribute('data-theme', saved);
  } catch (e) {}
})();
