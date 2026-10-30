(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var doc = root.document;

  function esc(s) { return P.esc ? P.esc(s) : String(s); }
  function ic(name) { return P.ic ? P.ic(name, 'ui-icon--sm') : ''; }
  function moved(ids, from, to) { var a = ids.slice(); a.splice(to, 0, a.splice(from, 1)[0]); return a; }
  function toSet(list) { var o = Object.create(null); (Array.isArray(list) ? list : []).forEach(function (id) { o[id] = 1; }); return o; }

  function ready(ms) {
    if (!P.prefs || !P.prefs.load) return Promise.resolve();
    return new Promise(function (resolve) {
      var done = false, t = setTimeout(finish, ms == null ? 1000 : ms);
      function finish() { if (!done) { done = true; clearTimeout(t); resolve(); } }
      try { P.prefs.load().then(finish, finish); } catch (e) { finish(); }
    });
  }

  function create(cfg) {
    var BLOCKS = cfg.blocks, IDS = BLOCKS.map(function (b) { return b.id; });
    var SC = { order: 'order.' + cfg.key + '-blocks', off: 'lists.' + cfg.key + '-off', on: 'lists.' + cfg.key + '-on' };
    var PREFIX = cfg.prefix || '', ACT = cfg.act || 'bl-layout';
    var menu = null, cur = null, pageBody = null, dragging = false, stopDrag = null;

    function byId(id) { return BLOCKS.filter(function (b) { return b.id === id; })[0]; }
    function pref(path) { return P.prefs ? P.prefs.get(path, null) : null; }
    function order(saved) {
      if (saved === undefined) saved = pref(SC.order);
      return P.tileRow ? P.tileRow.applyOrder(IDS, saved, []) : IDS.slice();
    }
    function state() { return { off: toSet(pref(SC.off)), on: toSet(pref(SC.on)) }; }
    function visibleIn(id, st) { var b = byId(id); return !!b && (b.buffer ? !!st.on[id] : !st.off[id]); }
    function visible(id) { return visibleIn(id, state()); }
    function isDefault() {
      var st = state();
      return order().join('|') === IDS.join('|') && !Object.keys(st.off).length && !Object.keys(st.on).length;
    }
    function setVisible(id, vis) {
      var b = byId(id), st = state(), box = b.buffer ? st.on : st.off, want = b.buffer ? vis : !vis;
      if (want) box[id] = 1; else delete box[id];
      var list = Object.keys(box).filter(function (x) { return IDS.indexOf(x) >= 0; });
      if (P.prefs) P.prefs.set(b.buffer ? SC.on : SC.off, list.length ? list : null);
    }
    function saveOrder(ids) { if (P.prefs) P.prefs.set(SC.order, ids.join('|') === IDS.join('|') ? null : ids.slice()); }

    function frame() {
      var st = state();
      return order().map(function (id) {
        var b = byId(id);
        return '<section class="' + (b.cls || '') + (visibleIn(id, st) ? '' : ' bl-off') + '" id="' + PREFIX + id + '" data-block="' + id + '"' + (b.when ? ' style="display:none"' : '') + '></section>';
      }).join('') + '<div class="bl-empty" hidden>' + ic('archive') + '<span>Усі блоки — у буфері. Натисніть «Блоки» над сторінкою, щоб повернути потрібні.</span></div>';
    }
    function apply(body, ids) {
      if (!body) return;
      var st = state(), shown = 0;
      (ids || order()).forEach(function (id) {
        var el = body.querySelector(':scope > #' + PREFIX + id);
        if (!el) return;
        body.appendChild(el);
        var vis = visibleIn(id, st);
        el.classList.toggle('bl-off', !vis);
        if (vis) shown++;
      });
      var empty = body.querySelector(':scope > .bl-empty');
      if (empty) { body.appendChild(empty); empty.hidden = shown > 0; }
    }
    function button() {
      return '<button class="btn btn--secondary btn--sm bl-btn" type="button" data-act="' + ACT + '" aria-haspopup="true" aria-expanded="false" title="Порядок блоків і буфер блоків">' +
        ic('list-ordered') + '<span class="sr-hide-phone">Блоки</span></button>';
    }
    function box(id) {
      var b = byId(id);
      return b ? '<button class="icon-btn bl-box" type="button" data-bl-hide="' + esc(id) + '" title="Сховати в буфер блоків" aria-label="' + esc('Сховати «' + b.name + '» у буфер блоків') + '">' + ic('archive') + '</button>' : '';
    }
    function bindPage(body) {
      if (!body) return;
      body.addEventListener('click', function (e) {
        var t = e.target.closest ? e.target.closest('[data-bl-hide]') : null;
        if (!t || !body.contains(t)) return;
        e.preventDefault();
        hide(t.getAttribute('data-bl-hide'), body);
      });
    }
    function hide(id, body) {
      if (!byId(id) || !visible(id)) return;
      setVisible(id, false);
      apply(body || pageBody);
      if (menu && !menu.closed) { cur = visibleOrder(); drawList(); }
      if (P.toast) P.toast('info', '«' + byId(id).name + '» — у буфері', 'Повернути: кнопка «Блоки» над сторінкою → «У буфері» → «+ Додати».');
    }
    function show(id, body) {
      if (!byId(id) || visible(id)) return;
      var all = order(), vis = all.filter(function (x) { return visible(x); });
      setVisible(id, true);
      var rest = all.filter(function (x) { return x !== id && vis.indexOf(x) < 0; });
      var next = vis.concat([id], rest);
      saveOrder(next);
      apply(body || pageBody, next);
      if (cfg.onShow) cfg.onShow(id);
    }

    function visibleOrder() { var st = state(); return order().filter(function (id) { return visibleIn(id, st); }); }
    function hiddenList() { var st = state(); return IDS.filter(function (id) { return !visibleIn(id, st); }); }

    function itemHtml(id, i, n) {
      var b = byId(id);
      return '<li class="bl-i" data-id="' + esc(id) + '">' +
        '<button class="bl-grip" type="button" data-grip aria-label="' + esc('Перемістити «' + b.name + '»: тягніть або стрілки вгору / вниз') + '"></button>' +
        '<span class="bl-n" aria-hidden="true">' + (i + 1) + '</span>' +
        '<span class="bl-t">' + esc(b.name) + (b.when ? '<span class="bl-s">видно ' + esc(b.when) + '</span>' : '') + '</span>' +
        '<button class="icon-btn bl-mv" type="button" data-act="bl-up" aria-label="' + esc('«' + b.name + '» — вище') + '"' + (i === 0 ? ' disabled' : '') + '>' + ic('arrow-up') + '</button>' +
        '<button class="icon-btn bl-mv" type="button" data-act="bl-down" aria-label="' + esc('«' + b.name + '» — нижче') + '"' + (i === n - 1 ? ' disabled' : '') + '>' + ic('arrow-down') + '</button>' +
        '<button class="icon-btn bl-mv" type="button" data-act="bl-off" aria-label="' + esc('Сховати «' + b.name + '» у буфер') + '" title="У буфер">' + ic('archive') + '</button></li>';
    }
    function bufHtml(id) {
      var b = byId(id);
      return '<li class="bl-bi" data-id="' + esc(id) + '"><span class="bl-t">' + esc(b.name) +
        '<span class="bl-s">' + esc(b.desc || (b.buffer ? 'новий вид аналізу' : 'ви сховали цей блок')) + (b.when ? ' · видно ' + esc(b.when) : '') + '</span></span>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="bl-add" aria-label="' + esc('Додати «' + b.name + '» на сторінку') + '">' + ic('add') + 'Додати</button></li>';
    }
    function menuBody() {
      return '<div class="bl-lay"><div class="bl-head"><p class="bl-title"><b>' + esc(cfg.title || 'Блоки на цій вкладці') + '</b>' + (cfg.help || '') + '</p>' +
        '<p class="hint">Тягніть блок за шість крапок або натискайте стрілки — сторінка змінюється одразу. Коробка ховає блок у буфер; звідти його можна повернути будь-коли. Усе зберігається у вашому профілі.</p></div>' +
        '<p class="bl-sec" data-bl-cnt="page"></p><ol class="bl-list" data-lay-list></ol>' +
        '<p class="bl-sec" data-bl-cnt="buf"></p><ul class="bl-list bl-buf" data-buf-list></ul>' +
        '<p class="ui-sr-only" aria-live="polite" data-lay-say></p>' +
        '<div class="bl-foot"><button class="btn btn--quiet btn--sm" type="button" data-act="bl-reset">' + ic('refresh') + 'Як було</button>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-ov-close>Готово</button></div></div>';
    }
    function live() { return menu && !menu.closed ? menu.el : null; }
    function drawList(focus) {
      var el = live();
      if (!el) return;
      var list = el.querySelector('[data-lay-list]'), buf = el.querySelector('[data-buf-list]'), hid = hiddenList();
      list.innerHTML = cur.map(function (id, i) { return itemHtml(id, i, cur.length); }).join('') ||
        '<li class="bl-none">На сторінці зараз нічого — додайте блоки з буфера.</li>';
      buf.innerHTML = hid.map(bufHtml).join('') || '<li class="bl-none">Порожньо. Сюди потрапляють сховані блоки, а згодом — нові види аналізу.</li>';
      el.querySelector('[data-bl-cnt="page"]').textContent = 'На сторінці · ' + cur.length;
      el.querySelector('[data-bl-cnt="buf"]').textContent = 'У буфері · ' + hid.length;
      var reset = el.querySelector('[data-act="bl-reset"]');
      if (reset) reset.disabled = isDefault();
      if (!focus) return;
      var li = list.querySelector('[data-id="' + focus[0] + '"]'), want = focus[1] === 'grip' ? '[data-grip]' : '[data-act="' + focus[1] + '"]';
      var f = li && li.querySelector(want);
      if (f && f.disabled) f = li.querySelector('[data-act="' + (focus[1] === 'bl-up' ? 'bl-down' : 'bl-up') + '"]');   // край — фокус на другу стрілку
      if (f) try { f.focus({ preventScroll: false }); } catch (e) { /* */ }
    }
    function say(text) { var el = live(); var s = el && el.querySelector('[data-lay-say]'); if (s) s.textContent = text; }
    function commit(vis, focus) {
      cur = vis;
      var next = vis.concat(order().filter(function (id) { return vis.indexOf(id) < 0; }));
      saveOrder(next);
      apply(pageBody, next);
      drawList(focus);
      if (focus) say('«' + byId(focus[0]).name + '» — тепер ' + (cur.indexOf(focus[0]) + 1) + '-й з ' + cur.length);
    }
    function step(t, dir) {
      var id = t.closest('[data-id]').getAttribute('data-id'), i = cur.indexOf(id), j = i + dir;
      if (j < 0 || j >= cur.length) return;
      commit(moved(cur, i, j), [id, t.getAttribute('data-act')]);
    }

    function bindDrag(list) {
      var scroller = list.closest('.menu') || list.parentNode;   // меню P.sr.menu гортається (overflow:auto)
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
        var li = g.closest('.bl-i'), items = Array.prototype.slice.call(list.querySelectorAll(':scope > .bl-i')), from = items.indexOf(li);
        if (from < 0 || items.length < 2) return;
        e.preventDefault();
        dragging = true;
        var rects = items.map(function (el) { return el.getBoundingClientRect(); });
        var gap = rects[1].top - rects[0].bottom, shift = rects[from].height + gap, half = rects[from].height / 2;
        var minDy = rects[0].top - rects[from].top - half, maxDy = rects[items.length - 1].bottom - rects[from].bottom + half;
        var y0 = e.clientY, sc0 = scroller.scrollTop, lastY = e.clientY, to = from, moving = false, raf = 0, done = false, pid = e.pointerId;
        try { g.setPointerCapture(pid); } catch (x) { /* рух однаково чуємо на документі */ }
        function place() {
          var dy = lastY - y0 + (scroller.scrollTop - sc0);
          if (!moving) { if (Math.abs(dy) < 4) return; moving = true; li.classList.add('bl-i--lift'); list.classList.add('bl-list--drag'); }
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
        function edge() {   // вказівник біля краю меню — гортаємо меню, поки він там
          var b = scroller.getBoundingClientRect(), v = lastY < b.top + 48 ? -10 : lastY > b.bottom - 48 ? 10 : 0;
          if (!v || !moving) { raf = 0; return; }
          var before = scroller.scrollTop;
          scroller.scrollTop += v;
          if (scroller.scrollTop !== before) place();
          raf = root.requestAnimationFrame(edge);
        }
        function move(ev) { if (ev.pointerId !== pid) return; lastY = ev.clientY; place(); if (!raf) raf = root.requestAnimationFrame(edge); }
        function end(ok) {
          if (done) return;
          done = true; dragging = false; stopDrag = null;
          if (raf) root.cancelAnimationFrame(raf);
          doc.removeEventListener('pointermove', move);
          doc.removeEventListener('pointerup', onUp);
          doc.removeEventListener('pointercancel', onCancel);
          g.removeEventListener('lostpointercapture', onUp);
          items.forEach(function (el) { el.style.transform = ''; });
          li.classList.remove('bl-i--lift'); list.classList.remove('bl-list--drag');
          if (ok && moving && to !== from) commit(moved(cur, from, to), [li.getAttribute('data-id'), 'grip']);
        }
        function onUp(ev) { if (!ev || ev.pointerId === undefined || ev.pointerId === pid) end(true); }
        function onCancel(ev) { if (ev.pointerId === pid) end(false); }
        stopDrag = function () { end(false); };   // меню закрили посеред руху — скасувати
        doc.addEventListener('pointermove', move);
        doc.addEventListener('pointerup', onUp);
        doc.addEventListener('pointercancel', onCancel);
        g.addEventListener('lostpointercapture', onUp);
      });
    }

    function open(anchor, body) {
      if (menu && !menu.closed) { menu.close(); return; }   // друге натискання — закрити
      pageBody = body;
      cur = visibleOrder();
      var r = anchor.getBoundingClientRect();
      if (root.innerHeight - r.bottom < 700 && r.top > 130) root.scrollBy(0, r.top - 120);   // під кнопкою замало місця — підкрутити
      menu = P.sr.menu(anchor, { width: 420, body: menuBody(),
        on: {
          'bl-up': function (t) { step(t, -1); }, 'bl-down': function (t) { step(t, 1); },
          'bl-off': function (t) {
            var id = t.closest('[data-id]').getAttribute('data-id');
            setVisible(id, false); apply(pageBody); cur = visibleOrder(); drawList();
            say('«' + byId(id).name + '» — у буфері');
          },
          'bl-add': function (t) {
            var id = t.closest('[data-id]').getAttribute('data-id');
            show(id, pageBody); cur = visibleOrder(); drawList([id, 'grip']);
            say('«' + byId(id).name + '» — на сторінці, ' + cur.length + '-й з ' + cur.length);
          },
          'bl-reset': function () {
            if (P.prefs) { P.prefs.set(SC.order, null); P.prefs.set(SC.off, null); P.prefs.set(SC.on, null); }
            apply(pageBody); cur = visibleOrder(); drawList(cur.length ? [cur[0], 'grip'] : null);
            say('Блоки — як було спочатку');
            if (cfg.onShow) IDS.forEach(function (id) { if (visible(id)) cfg.onShow(id); });
          }
        },
        onMount: function (wrap) {
          var nav = wrap.querySelector('.menu');
          if (nav) nav.setAttribute('aria-label', cfg.title || 'Блоки на цій вкладці');
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

    return { ready: ready, BLOCKS: BLOCKS, IDS: IDS, scopes: SC, order: order, frame: frame, apply: apply, button: button, open: open, box: box,
      bindPage: bindPage, visible: visible, hide: hide, show: show,
      late: function (body) { apply(body); } };
  }

  P.blockLayout = { create: create, moved: moved, ready: ready };
  if (typeof module !== 'undefined' && module.exports) module.exports = { create: create, moved: moved, ready: ready };
})(typeof window !== 'undefined' ? window : globalThis);
