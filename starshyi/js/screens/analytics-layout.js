(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var A = P.srAn = P.srAn || {}, X = P.srAnParts = P.srAnParts || {};
  var SCOPE = 'order.sr:an-blocks';
  var FOLD_N = 5, FOLD_MIN = 3;   // показуємо 5 рядків; згортаємо, лише коли під кнопкою лишається щонайменше 3

  function esc(s) { return P.esc ? P.esc(s) : String(s); }
  function ic(name) { return P.ic ? P.ic(name, 'ui-icon--sm') : ''; }

  var BLOCKS = [
    { id: 'today', name: 'Сьогодні', cls: 'card an-today' },
    { id: 'sum', name: 'За період — підсумок', cls: 'an-sumbox' },
    { id: 'days', name: 'Брак за днями', cls: 'card' },
    { id: 'levels', name: 'Рівні браку', cls: 'card' },
    { id: 'depts', name: 'Брак по відділах', when: 'коли обрано «Усі відділи»', cls: 'card' },
    { id: 'top', name: 'Що бракує найчастіше', cls: 'card' },
    { id: 'dstats', name: 'Види браку відділу — статистика', when: 'коли обрано один відділ', cls: 'card' },
    { id: 'orders', name: 'Аналітика по замовленнях', cls: 'card' },
    { id: 'watch', name: 'Стежу', cls: 'card', buffer: true, desc: 'Те, що ви позначили зірочкою, — числа за період' }   // v1.3
  ];
  var IDS = BLOCKS.map(function (b) { return b.id; });

  function order(saved) {
    if (saved === undefined) saved = P.prefs ? P.prefs.get(SCOPE, null) : null;
    return P.tileRow ? P.tileRow.applyOrder(IDS, saved, []) : IDS.slice();
  }
  function moved(ids, from, to) { var a = ids.slice(); a.splice(to, 0, a.splice(from, 1)[0]); return a; }

  var folds = Object.create(null);   // ключ списку → розгорнуто (живе, доки відкрита сторінка: перемальовування не згортає назад)

  function foldHtml(key, total, html, open) {
    if (!(total - FOLD_N >= FOLD_MIN)) return html;
    function btn() {
      return '<button class="btn btn--quiet btn--sm fold__btn" type="button" data-act="an-fold" aria-expanded="' + !!open + '">' +
        '<span class="fold__more">' + ic('chevron-down') + 'Розгорнути — ще ' + (total - FOLD_N) + '</span>' +
        '<span class="fold__less">' + ic('chevron-up') + 'Згорнути</span></button>';
    }
    return '<div class="fold' + (open ? ' fold--open' : '') + '" data-fold="' + esc(key) + '">' +
      '<div class="fold__bar fold__bar--top">' + btn() + '<span class="hint">показано всі ' + total + '</span></div>' + html +
      '<div class="fold__bar fold__bar--end">' + btn() + '<span class="hint fold__more">показано ' + FOLD_N + ' з ' + total + '</span></div></div>';
  }
  A.fold = function (key, total, html) { return foldHtml(key, total, html, !!folds[key]); };

  A.foldToggle = function (btn) {
    var box = btn.closest('[data-fold]');
    if (!box) return;
    var open = !box.classList.contains('fold--open'), end = box.querySelector(':scope > .fold__bar--end .fold__btn');
    var fromEnd = btn === end, before = end.getBoundingClientRect().top;
    folds[box.getAttribute('data-fold')] = open;
    box.classList.toggle('fold--open', open);
    Array.prototype.forEach.call(box.querySelectorAll(':scope > .fold__bar > .fold__btn'), function (b) { b.setAttribute('aria-expanded', String(open)); });
    if (open) return;
    if (fromEnd) { var d = end.getBoundingClientRect().top - before; if (d) root.scrollBy(0, d); }
    else try { end.focus({ preventScroll: true }); } catch (e) { /* старий браузер — без фокуса */ }
  };

  var L = P.blockLayout ? P.blockLayout.create({ key: 'sr:an', prefix: 'an-', act: 'an-layout', title: 'Блоки «Аналітики»',
    help: A.q ? A.q('sr.an.blocks') : '', blocks: BLOCKS,
    onShow: function (id) { if (id === 'watch' && X.watch && X.watch.redraw) X.watch.redraw(); } }) : null;
  X.layout = L ? Object.assign({ SCOPE: L.scopes.order }, L) : null;

  if (typeof module !== 'undefined' && module.exports) module.exports = { order: order, moved: moved, foldHtml: foldHtml, BLOCKS: BLOCKS, FOLD_N: FOLD_N, FOLD_MIN: FOLD_MIN };
})(typeof window !== 'undefined' ? window : globalThis);
