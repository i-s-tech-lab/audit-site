(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var S = P.search = P.search || {};
  var doc = root.document;

  function waitFor(selector, cb, ms, miss) {
    if (!doc) return;
    var left = Math.ceil((ms || 2000) / 100);
    (function tick(first) {
      var el = doc.querySelector(selector);
      if (el && !first) { cb(el); return; }
      if (--left > 0) setTimeout(function () { tick(false); }, first ? 80 : 100);
      else if (miss) miss();
    })(true);
  }
  function reveal(el) {
    if (!el) return;
    el.style.scrollMarginTop = '84px';
    try { el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { el.scrollIntoView(); }
    el.classList.add('srch-flash');
    setTimeout(function () { el.classList.remove('srch-flash'); el.style.scrollMarginTop = ''; }, 1800);
  }
  function showBlock(selector, o, cb) {
    waitFor(selector, function (el) {
      if (el.classList.contains('bl-off')) { if (P.toast) P.toast('info', 'Цей блок у буфері', 'Додайте його через кнопку «Блоки» над сторінкою.'); return; }
      function seen() { reveal(el); if (cb) cb(el); }
      if (el.offsetParent !== null) { seen(); return; }
      var left = 20;   // блок «коли …» зʼявляється, щойно прийшли дані: чекаємо до 2 с
      (function poll() {
        if (el.offsetParent !== null) { seen(); return; }
        if (--left > 0) { setTimeout(poll, 100); return; }
        if (P.toast) P.toast('info', 'Зараз цього блоку не видно', o && o.when ? 'Він зʼявляється, ' + o.when + '.' : 'Він зʼявляється на сторінці за певних умов.');
      })();
    });
  }

  S.waitFor = waitFor; S.reveal = reveal; S.showBlock = showBlock;
  if (P.hdrTools) P.hdrTools.on('search', S.open);

  if (typeof module !== 'undefined' && module.exports) module.exports = { norm: S.norm, match: S.match, hl: S.hl, run: S.run, GROUPS: S.GROUPS };
})(typeof window !== 'undefined' ? window : globalThis);
