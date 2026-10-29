(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var A = P.srAn = P.srAn || {}, X = P.srAnParts = P.srAnParts || {};
  var doc = root.document;
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
    { id: 'orders', name: 'Аналітика по замовленнях', cls: 'card' }
  ];
  var IDS = BLOCKS.map(function (b) { return b.id; });
  function byId(id) { return BLOCKS.filter(function (b) { return b.id === id; })[0]; }

  function order(saved) {
    if (saved === undefined) saved = P.prefs ? P.prefs.get(SCOPE, null) : null;
    return P.tileRow ? P.tileRow.applyOrder(IDS, saved, []) : IDS.slice();
  }
  function moved(ids, from, to) { var a = ids.slice(); a.splice(to, 0, a.splice(from, 1)[0]); return a; }
  function isDefault(ids) { return ids.join('|') === IDS.join('|'); }

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

  var menu = null, cur = null, pageBody = null;

  function frame() {
    return order().map(function (id) {
      var b = byId(id);
      return '<section class="' + b.cls + '" id="an-' + id + '" data-block="' + id + '"' + (b.when ? ' style="display:none"' : '') + '></section>';
    }).join('');
  }
  function apply(body, ids) {
    if (!body) return;
    ids.forEach(function (id) { var el = body.querySelector(':scope > #an-' + id); if (el) body.appendChild(el); });
  }
  function button() {
    return '<button class="btn btn--secondary btn--sm an-lay-btn" type="button" data-act="an-layout" aria-haspopup="true" aria-expanded="false" title="Порядок блоків на цій вкладці">' +
      ic('list-ordered') + '<span class="sr-hide-phone">Порядок блоків</span></button>';
  }

  function itemHtml(id, i, n) {
    var b = byId(id);
    return '<li class="an-lay__i" data-id="' + id + '">' +
      '<button class="an-lay__grip" type="button" data-grip aria-label="' + esc('Перемістити «' + b.name + '»: тягніть або стрілки вгору / вниз') + '"></button>' +
      '<span class="an-lay__n" aria-hidden="true">' + (i + 1) + '</span>' +
      '<span class="an-lay__t">' + esc(b.name) + (b.when ? '<span class="an-lay__s">видно ' + esc(b.when) + '</span>' : '') + '</span>' +
      '<button class="icon-btn an-lay__mv" type="button" data-act="lay-up" aria-label="' + esc('«' + b.name + '» — вище') + '"' + (i === 0 ? ' disabled' : '') + '>' + ic('arrow-up') + '</button>' +
      '<button class="icon-btn an-lay__mv" type="button" data-act="lay-down" aria-label="' + esc('«' + b.name + '» — нижче') + '"' + (i === n - 1 ? ' disabled' : '') + '>' + ic('arrow-down') + '</button></li>';
  }
  function menuBody() {
    return '<div class="an-lay"><div class="an-lay__head"><p class="an-lay__title"><b>Порядок блоків</b>' + (A.q ? A.q('sr.an.blocks') : '') + '</p>' +
      '<p class="hint">Тягніть блок за шість крапок або натискайте стрілки — сторінка змінюється одразу. Порядок зберігається у вашому профілі й однаковий для всіх локацій.</p></div>' +
      '<ol class="an-lay__list" data-lay-list></ol><p class="ui-sr-only" aria-live="polite" data-lay-say></p>' +
      '<div class="an-lay__foot"><button class="btn btn--quiet btn--sm" type="button" data-act="lay-reset">' + ic('refresh') + 'Як було</button>' +
      '<button class="btn btn--secondary btn--sm" type="button" data-ov-close>Готово</button></div></div>';
  }
  function listEl() { return menu && !menu.closed ? menu.el.querySelector('[data-lay-list]') : null; }
  function drawList(focus) {
    var list = listEl();
    if (!list) return;
    list.innerHTML = cur.map(function (id, i) { return itemHtml(id, i, cur.length); }).join('');
    var reset = menu.el.querySelector('[data-act="lay-reset"]');
    if (reset) reset.disabled = isDefault(cur);
    if (!focus) return;
    var li = list.querySelector('[data-id="' + focus[0] + '"]'), want = focus[1] === 'grip' ? '[data-grip]' : '[data-act="' + focus[1] + '"]';
    var el = li && li.querySelector(want);
    if (el && el.disabled) el = li.querySelector('[data-act="' + (focus[1] === 'lay-up' ? 'lay-down' : 'lay-up') + '"]');   // дійшли до краю — фокус на другу стрілку
    if (el) try { el.focus({ preventScroll: false }); } catch (e) { /* */ }
  }
  function say(id) {
    var el = menu && menu.el.querySelector('[data-lay-say]');
    if (el) el.textContent = '«' + byId(id).name + '» — тепер ' + (cur.indexOf(id) + 1) + '-й з ' + cur.length;
  }
  function commit(ids, focus) {
    cur = ids;
    if (P.prefs) P.prefs.set(SCOPE, isDefault(ids) ? null : ids.slice());
    apply(pageBody, ids);
    drawList(focus);
    if (focus) say(focus[0]);
  }
  function step(t, dir) {
    var id = t.closest('[data-id]').getAttribute('data-id'), i = cur.indexOf(id), j = i + dir;
    if (j < 0 || j >= cur.length) return;
    commit(moved(cur, i, j), [id, t.getAttribute('data-act')]);
  }

  var dragging = false, stopDrag = null;
  function bindDrag(list) {
    var box = list.closest('.menu') || list.parentNode;   // елемент, що гортається (меню P.sr.menu — overflow:auto)
    list.addEventListener('keydown', function (e) {
      var g = e.target.closest('[data-grip]');
      if (!g || dragging || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault();
      var id = g.closest('[data-id]').getAttribute('data-id'), i = cur.indexOf(id), j = i + (e.key === 'ArrowUp' ? -1 : 1);
      if (j >= 0 && j < cur.length) commit(moved(cur, i, j), [id, 'grip']);
    });
    list.addEventListener('pointerdown', function (e) {
      var g = e.target.closest('[data-grip]');
      if (!g || dragging || e.button > 0) return;
      var li = g.closest('.an-lay__i'), items = Array.prototype.slice.call(list.children), from = items.indexOf(li);
      if (from < 0 || items.length < 2) return;
      e.preventDefault();
      dragging = true;
      var rects = items.map(function (el) { return el.getBoundingClientRect(); });   // місця рядків на початку (прокрутка sc0)
      var gap = rects[1].top - rects[0].bottom, shift = rects[from].height + gap;
      var half = rects[from].height / 2;
      var minDy = rects[0].top - rects[from].top - half, maxDy = rects[items.length - 1].bottom - rects[from].bottom + half;
      var y0 = e.clientY, sc0 = box.scrollTop, lastY = e.clientY, to = from, moving = false, raf = 0, done = false, pid = e.pointerId;
      try { g.setPointerCapture(pid); } catch (x) { /* без захоплення — рух однаково чуємо на документі */ }
      function place() {
        var dy = lastY - y0 + (box.scrollTop - sc0);   // зсув у координатах списку: рух вказівника + прокрутка меню
        if (!moving) { if (Math.abs(dy) < 4) return; moving = true; li.classList.add('an-lay__i--lift'); list.classList.add('an-lay__list--drag'); }
        dy = Math.max(minDy, Math.min(maxDy, dy));
        li.style.transform = 'translateY(' + dy + 'px)';
        var mid = rects[from].top + rects[from].height / 2 + dy;
        to = from;
        rects.forEach(function (r, i) {
          var m = r.top + r.height / 2;
          if (i > from && m <= mid) to = i;
          if (i < from && m >= mid && to === from) to = i;
        });
        items.forEach(function (el, i) {
          if (el === li) return;
          var sh = from < to && i > from && i <= to ? -shift : from > to && i >= to && i < from ? shift : 0;
          el.style.transform = sh ? 'translateY(' + sh + 'px)' : '';
        });
      }
      function edge() {
        var b = box.getBoundingClientRect(), v = lastY < b.top + 48 ? -10 : lastY > b.bottom - 48 ? 10 : 0;
        if (!v || !moving) { raf = 0; return; }
        var before = box.scrollTop;
        box.scrollTop += v;
        if (box.scrollTop !== before) place();
        raf = root.requestAnimationFrame(edge);
      }
      function move(ev) {
        if (ev.pointerId !== pid) return;
        lastY = ev.clientY;
        place();
        if (!raf) raf = root.requestAnimationFrame(edge);
      }
      function end(ok) {
        if (done) return;
        done = true; dragging = false; stopDrag = null;
        if (raf) root.cancelAnimationFrame(raf);
        doc.removeEventListener('pointermove', move);
        doc.removeEventListener('pointerup', onUp);
        doc.removeEventListener('pointercancel', onCancel);
        g.removeEventListener('lostpointercapture', onUp);
        items.forEach(function (el) { el.style.transform = ''; });
        li.classList.remove('an-lay__i--lift'); list.classList.remove('an-lay__list--drag');
        if (ok && moving && to !== from) commit(moved(cur, from, to), [li.getAttribute('data-id'), 'grip']);
      }
      function onUp(ev) { if (!ev || ev.pointerId === undefined || ev.pointerId === pid) end(true); }
      function onCancel(ev) { if (ev.pointerId === pid) end(false); }
      stopDrag = function () { end(false); };   // меню закрили посеред руху (Esc, інша вкладка) — скасувати, нічого не зберігати
      doc.addEventListener('pointermove', move);
      doc.addEventListener('pointerup', onUp);
      doc.addEventListener('pointercancel', onCancel);
      g.addEventListener('lostpointercapture', onUp);
    });
  }

  function open(anchor, body) {
    if (menu && !menu.closed) { menu.close(); return; }   // друге натискання на кнопку — закрити
    pageBody = body;
    cur = order();
    var r = anchor.getBoundingClientRect();
    if (root.innerHeight - r.bottom < 700 && r.top > 130) root.scrollBy(0, r.top - 120);
    menu = P.sr.menu(anchor, { width: 400, body: menuBody(),
      on: { 'lay-up': function (t) { step(t, -1); }, 'lay-down': function (t) { step(t, 1); },
        'lay-reset': function () {
          commit(IDS.slice(), [IDS[0], 'grip']);   // фокус — на першу ручку (сама кнопка «Як було» тепер вимкнена)
          var s = menu && menu.el.querySelector('[data-lay-say]');
          if (s) s.textContent = 'Порядок блоків — як було спочатку';
        } },
      onMount: function (wrap) {
        var nav = wrap.querySelector('.menu');
        if (nav) nav.setAttribute('aria-label', 'Порядок блоків');
        bindDrag(wrap.querySelector('[data-lay-list]'));
      },
      onClose: function () {
        if (stopDrag) stopDrag();
        menu = null; dragging = false;
        anchor.setAttribute('aria-expanded', 'false');
        try { anchor.focus({ preventScroll: true }); } catch (e) { /* */ }
      } });
    anchor.setAttribute('aria-expanded', 'true');
    drawList();
    var first = menu.el.querySelector('[data-grip]');
    if (first) try { first.focus({ preventScroll: true }); } catch (e) { /* */ }
  }

  X.layout = { BLOCKS: BLOCKS, SCOPE: SCOPE, order: order, moved: moved, frame: frame, apply: apply, button: button, open: open,
    late: function (body) { apply(body, order()); } };

  if (typeof module !== 'undefined' && module.exports) module.exports = { order: order, moved: moved, foldHtml: foldHtml, BLOCKS: BLOCKS, FOLD_N: FOLD_N, FOLD_MIN: FOLD_MIN };
})(typeof window !== 'undefined' ? window : globalThis);
