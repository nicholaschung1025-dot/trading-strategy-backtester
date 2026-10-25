/* Apply the saved theme and light/dark mode before the first paint (no flash, no inline script). */
(function () {
  'use strict';
  try {
    var saved = localStorage.getItem('falcon-theme');
    if (saved && saved !== 'ember') document.documentElement.setAttribute('data-theme', saved);
    var savedMode = localStorage.getItem('falcon-mode');
    if (savedMode === 'light') document.documentElement.setAttribute('data-mode', 'light');
  } catch (e) {}
})();
