/* Falcon Lab v2 — motion layer.
   Progressive enhancement only: if GSAP is unavailable (offline) or the user
   prefers reduced motion, every element stays in its natural end state and the
   workbench remains fully functional. No existing behaviour is wrapped. */
(function () {
  'use strict';

  function reduced() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function start() {
    if (!window.gsap || reduced()) return;
    try { window.ScrollTrigger && window.gsap.registerPlugin(window.ScrollTrigger); } catch (e) {}

    var gsap = window.gsap;

    /* watchdog: if the entrance timeline is ever interrupted or frozen
       (throttled rAF, backgrounded tab), force the natural end state so
       the workbench never renders invisible content */
    var settle = function () {
      try { tl.kill(); } catch (e) {}
      gsap.set('.lab-nav, .rail-block, .mast-line > *, .lab-tabs', { clearProps: 'all' });
    };
    setTimeout(settle, 3000);

    /* entrance: nav, masthead, rail blocks, existing cards */
    var tl = gsap.timeline({ defaults: { ease: 'power3.out', duration: 0.7 } });
    tl.from('.lab-nav', { y: -18, autoAlpha: 0, duration: 0.6 })
      .from('.mast-line > *', { y: 22, autoAlpha: 0, stagger: 0.08 }, '-=0.25')
      .from('.lab-tabs', { y: 14, autoAlpha: 0 }, '-=0.4')
      .from('.rail-block', { y: 26, autoAlpha: 0, stagger: 0.09, clearProps: 'transform,visibility,opacity' }, '-=0.45');

    /* stat bento re-renders on every run: stagger the fresh tiles */
    var statGrid = document.getElementById('statGrid');
    if (statGrid && 'MutationObserver' in window) {
      var observer = new MutationObserver(function () {
        var tiles = statGrid.querySelectorAll('.stat');
        if (!tiles.length) return;
        gsap.fromTo(tiles,
          { y: 16, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.55, ease: 'power2.out', stagger: 0.035, overwrite: 'auto', clearProps: 'transform,visibility,opacity' });
      });
      observer.observe(statGrid, { childList: true });
    }

    /* chart chapters rise into view; gentle scale settle, no pinning.
       ScrollTrigger follows the internal main scroller, not the document */
    if (window.ScrollTrigger) {
      var mainScroller = document.querySelector('.lab-main');
      window.ScrollTrigger.batch('.chapter, .export-panel', {
        scroller: mainScroller,
        interval: 0.12,
        batchMax: 4,
        onEnter: function (batch) {
          gsap.fromTo(batch,
            { y: 42, autoAlpha: 0, scale: 0.985 },
            { y: 0, autoAlpha: 1, scale: 1, duration: 0.85, ease: 'power3.out', stagger: 0.1, overwrite: true, clearProps: 'transform,visibility,opacity' });
        },
        start: 'top 88%'
      });
    }

    /* tab switches: crossfade the incoming pane content */
    document.querySelectorAll('.lab-tabs [role="tab"]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var pane = document.getElementById(tab.getAttribute('aria-controls'));
        if (pane && !pane.hidden) {
          gsap.fromTo(pane, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out', clearProps: 'transform,visibility,opacity' });
          var inner = pane.querySelectorAll('.chapter, .export-panel, .compare-bar, .trade-head, .trade-scroll');
          if (inner.length) {
            gsap.fromTo(inner,
              { autoAlpha: 0, y: 26 },
              { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.07, overwrite: 'auto', clearProps: 'transform,visibility,opacity' });
          }
          if (window.ScrollTrigger) window.ScrollTrigger.refresh();
        }
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
