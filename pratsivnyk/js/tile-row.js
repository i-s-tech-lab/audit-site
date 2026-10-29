(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var doc = root.document;
  var HINT = 'Пробіл — взяти, стрілки — перемістити, Enter — поставити, Esc — скасувати';
  var HINT_ID = 'tr-hint', SLOP = 4, EDGE = 48, MS = 180;
  var GRIP_EVENTS = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture', 'click', 'keydown', 'keyup', 'blur'];
  var insts = typeof WeakMap === 'function' ? new WeakMap() : null;   // rowEl → живий ряд (щоб повторний mount спершу знімав старий)
  var scrollMem = Object.create(null);   // v1.2: scope → прокрутка слайдера (ряд перемальовують — позиція лишається)
  var live = null;                                                    // спільний «диктор» для читачів екрана

  function uniq(a) {
    var seen = Object.create(null), out = [];
    (Array.isArray(a) ? a : []).forEach(function (v) {
      if (v === null || v === undefined || v === '') return;
      var s = String(v);
      if (!seen[s]) { seen[s] = true; out.push(s); }
    });
    return out;
  }

  function applyOrder(currentIds, savedIds, fixedIds) {
    var cur = uniq(currentIds), fixed = Object.create(null), known = Object.create(null), used = Object.create(null), out = [];
    uniq(fixedIds).forEach(function (id) { fixed[id] = true; });
    cur.forEach(function (id) { known[id] = true; });
    function put(id) { if (!used[id]) { used[id] = true; out.push(id); } }
    cur.forEach(function (id) { if (fixed[id]) put(id); });
    uniq(savedIds).forEach(function (id) { if (known[id] && !fixed[id]) put(id); });
    cur.forEach(put);
    return out;
  }

  function cols(width, minWidth, gap, max) {
    var w = +width, m = +minWidth, g = +gap, cap = +max >= 1 ? Math.floor(+max) : Infinity;
    if (!(w > 0) || !isFinite(w)) return 1;
    if (!(g >= 0) || !isFinite(g)) g = 0;
    if (!(m > 0) || !isFinite(m)) m = 1;
    var n = Math.floor((w + g) / (m + g) + 1e-6);   // 1e-6 — щоб 1079.9999 не «з'їло» колонку через дроби
    return Math.max(1, Math.min(cap, n));
  }

  function calm() { return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function tx(px) { return px ? 'translate3d(' + px + 'px,0,0)' : ''; }
  function srNodes() {
    if (!doc.getElementById(HINT_ID)) {
      var hint = doc.createElement('span');
      hint.id = HINT_ID; hint.className = 'ui-sr-only'; hint.textContent = HINT;
      doc.body.appendChild(hint);
    }
    if (!live || !live.isConnected) {
      live = doc.createElement('span');
      live.className = 'ui-sr-only'; live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
      doc.body.appendChild(live);
    }
    return live;
  }
  function say(text) { var el = srNodes(); el.textContent = ''; setTimeout(function () { el.textContent = text; }, 30); }

  function mount(rowEl, opts) {
    var noop = { refresh: function () {}, destroy: function () {} };
    if (!doc || !rowEl || rowEl.nodeType !== 1) return noop;
    if (insts && insts.get(rowEl)) insts.get(rowEl).destroy();
    var o = opts || {}, sel = o.item || '[data-tile-id]', attr = o.idAttr || 'data-tile-id', fixed = uniq(o.fixed);
    var minW = +o.minWidth > 0 ? +o.minWidth : 170, max = +o.max >= 1 ? Math.floor(+o.max) : 6, label = o.label || 'плитка';
    var grips = [], wrap = null, prev = null, next = null, ro = null, gap = 12, width = 0, ownGap = false;
    var drag = null, kb = null, settling = null, timer = null, flipT = null, scrollRaf = 0, keyAct = false, dead = false;
    var api = { refresh: refresh, destroy: destroy };

    function list() { return Array.prototype.filter.call(rowEl.children, function (el) { return el.matches(sel) && el.getAttribute(attr); }); }
    function idOf(el) { return el.getAttribute(attr); }
    function isFixed(el) { return fixed.indexOf(idOf(el)) >= 0; }
    function minIdx(tiles) { return tiles.filter(isFixed).length; }
    function nameOf(el) {
      var n = el.getAttribute('data-tile-name'), h = n ? null : el.querySelector('h1,h2,h3,h4,h5,h6,strong');
      return (n || (h && h.textContent) || '').trim() || label + ' ' + (list().indexOf(el) + 1);
    }
    function isSlider() { return rowEl.classList.contains('tr-row--slider'); }

    function reorder(ids) {
      var tiles = list(), pool = tiles.slice(), out = [];
      if (!tiles.length) return;
      ids.forEach(function (id) { for (var i = 0; i < pool.length; i++) if (idOf(pool[i]) === id) { out.push(pool.splice(i, 1)[0]); return; } });
      out = out.concat(pool);
      if (out.every(function (el, i) { return el === tiles[i]; })) return;
      var ref = tiles[tiles.length - 1].nextSibling, had = rowEl.contains(doc.activeElement) ? doc.activeElement : null;
      out.forEach(function (el) { rowEl.insertBefore(el, ref); });
      if (had && doc.activeElement !== had) try { had.focus({ preventScroll: true }); } catch (x) { /* немає — не страшно */ }
    }
    function order() {
      var saved = P.prefs && o.scope ? P.prefs.get('order.' + o.scope, null) : null;
      reorder(applyOrder(list().map(idOf), saved, fixed));
    }
    function save() {
      var ids = list().filter(function (el) { return !isFixed(el); }).map(idOf);
      if (P.prefs && o.scope) P.prefs.set('order.' + o.scope, ids);
      if (typeof o.onOrder === 'function') try { o.onOrder(ids.slice()); } catch (x) { /* чужий обробник не ламає ряд */ }
    }

    function decorate() {
      var tiles = list();
      srNodes();
      grips = grips.filter(function (g) {
        var t = g.parentNode, keep = !!t && tiles.indexOf(t) >= 0 && !isFixed(t);
        if (!keep) unGrip(g);
        return keep;
      });
      tiles.forEach(function (el) {
        var fx = isFixed(el), g = grips.filter(function (x) { return x.parentNode === el; })[0];
        el.classList.add('tr-tile');
        el.classList.toggle('tr-tile--fixed', fx);
        if (fx) return;
        if (!g) {
          g = doc.createElement('button');
          g.type = 'button'; g.className = 'tr-grip';
          g.setAttribute('aria-pressed', 'false'); g.setAttribute('aria-describedby', HINT_ID);
          GRIP_EVENTS.forEach(function (t) { g.addEventListener(t, onGrip); });
          el.appendChild(g); grips.push(g);
        }
        g.setAttribute('aria-label', 'Перемістити: ' + nameOf(el));
      });
    }
    function unGrip(g) {
      GRIP_EVENTS.forEach(function (t) { g.removeEventListener(t, onGrip); });
      if (g.parentNode) g.parentNode.removeChild(g);
    }

    function layout() {
      if (dead || (drag && drag.on)) return;
      var cs = root.getComputedStyle(rowEl), g = parseFloat(cs.columnGap);
      if (!(g >= 0)) { g = 12; ownGap = true; rowEl.style.columnGap = '12px'; }
      gap = g;
      var w = rowEl.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
      if (w > 0) {
        var n = cols(w, minW, gap, max), slider = list().length > n;
        width = w;
        rowEl.style.setProperty('--tr-w', Math.floor((w - (n - 1) * gap) / n * 100) / 100 + 'px');
        rowEl.classList.toggle('tr-row--slider', slider);
        rowEl.classList.toggle('tr-row--fill', !!o.fill && !slider);
      }
      edges();
    }
    function edges() {
      var on = isSlider(), x = rowEl.scrollLeft, l = on && x > 1, r = on && x + rowEl.clientWidth < rowEl.scrollWidth - 1;
      rowEl.classList.toggle('tr-row--more-l', l);
      rowEl.classList.toggle('tr-row--more-r', r);
      if (prev) { prev.hidden = !l; next.hidden = !r; }
    }
    function onScroll() {
      if (scrollRaf) return;
      scrollRaf = root.requestAnimationFrame(function () {
        scrollRaf = 0; if (dead) return;
        if (o.scope && isSlider()) scrollMem[o.scope] = rowEl.scrollLeft;   // v1.2: де людина зупинилась — для перемальовування
        edges(); if (drag && drag.on) track();
      });
    }
    function restoreScroll() {
      if (!isSlider()) return;
      if (o.scope && scrollMem[o.scope] > 0) rowEl.scrollLeft = scrollMem[o.scope];
      var act = o.active ? rowEl.querySelector(o.active) : null;
      if (act && act.parentNode === rowEl) reveal(act);
      edges();
    }
    function arrow(dir) {
      var b = doc.createElement('button');
      b.type = 'button'; b.className = 'tr-arrow tr-arrow--' + (dir < 0 ? 'prev' : 'next'); b.tabIndex = -1; b.hidden = true;
      b.setAttribute('aria-hidden', 'true'); b.title = dir < 0 ? 'Назад' : 'Далі';
      b.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        rowEl.scrollBy({ left: dir * (width + gap), behavior: calm() ? 'auto' : 'smooth' });
      });
      return b;
    }
    function reveal(el) {
      if (!isSlider()) return;
      var l = el.offsetLeft, r = l + el.offsetWidth, x = rowEl.scrollLeft;
      if (l < x) rowEl.scrollLeft = l - 3; else if (r > x + rowEl.clientWidth) rowEl.scrollLeft = r - rowEl.clientWidth + 3;
    }

    function onGrip(e) {
      var g = e.currentTarget, tile = g.parentNode, mine = drag && drag.id === e.pointerId;
      switch (e.type) {
        case 'pointerdown': return down(e, g, tile);
        case 'pointermove': if (mine) move(e); return;
        case 'pointerup': if (mine) up(true); return;
        case 'pointercancel': case 'lostpointercapture': if (mine) up(false); return;
        case 'click':   // клік ручки ніколи не доходить до плитки; клік без миші (читач екрана) — взяти / поставити
          e.preventDefault(); e.stopPropagation();
          if (e.detail === 0 && !keyAct) { if (kb && kb.tile === tile) kbEnd(true); else kbPick(tile, g); }
          return;
        case 'keydown': return key(e, g, tile);
        case 'keyup': if (e.key === ' ' || e.key === 'Enter') setTimeout(function () { keyAct = false; }, 0); return;
        case 'blur': if (kb && kb.tile === tile) kbEnd(true); return;
      }
    }
    function down(e, g, tile) {
      if (drag || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      if (settling) finish();
      if (kb) kbEnd(true);
      e.preventDefault();
      try { g.setPointerCapture(e.pointerId); } catch (x) { /* без захоплення теж працює, поки вказівник над ручкою */ }
      drag = { id: e.pointerId, grip: g, tile: tile, sx: e.clientX, sy: e.clientY, cx: e.clientX, on: false, raf: 0,
        x0: e.clientX - rowEl.getBoundingClientRect().left + rowEl.scrollLeft };
    }
    function move(e) {
      drag.cx = e.clientX;
      if (!drag.on) {
        if (Math.abs(e.clientX - drag.sx) < SLOP && Math.abs(e.clientY - drag.sy) < SLOP) return;
        if (!start()) return;
      }
      track();
      autoScroll();
    }
    function start() {
      var d = drag, tiles = list(), rr = rowEl.getBoundingClientRect(), sl = rowEl.scrollLeft;
      d.f = tiles.indexOf(d.tile);
      if (d.f < 0) { up(false); return false; }
      d.tiles = tiles; d.t = d.f; d.min = minIdx(tiles); d.left = []; d.w = [];
      tiles.forEach(function (el) { var r = el.getBoundingClientRect(); d.left.push(r.left - rr.left + sl); d.w.push(r.width); });
      d.on = true;
      rowEl.classList.add('tr-row--dragging');
      d.tile.classList.add('tr-tile--lifted');
      return true;
    }
    function track() {
      var d = drag, n = d.tiles.length, f = d.f, rr = rowEl.getBoundingClientRect();
      var dx = d.cx - rr.left + rowEl.scrollLeft - d.x0;
      dx = Math.max(d.left[d.min] - d.left[f], Math.min(d.left[n - 1] + d.w[n - 1] - d.w[f] - d.left[f], dx));
      d.tile.style.transform = tx(dx);
      var c = d.left[f] + dx + d.w[f] / 2, t = d.min, i;
      for (i = d.min; i < n; i++) if (i !== f && d.left[i] + d.w[i] / 2 < c) t++;
      if (t === d.t) return;
      d.t = t;
      var step = d.w[f] + gap;
      for (i = d.min; i < n; i++) if (i !== f) d.tiles[i].style.transform = tx(f < i && i <= t ? -step : t <= i && i < f ? step : 0);
    }
    function autoScroll() {
      if (!drag || !drag.on || drag.raf || !isSlider()) return;
      drag.raf = root.requestAnimationFrame(function step() {
        if (!drag || !drag.on) return;
        var rr = rowEl.getBoundingClientRect(), x = drag.cx, v = 0, was = rowEl.scrollLeft;
        if (x < rr.left + EDGE) v = -(rr.left + EDGE - x); else if (x > rr.right - EDGE) v = x - (rr.right - EDGE);
        if (v) rowEl.scrollLeft = was + Math.max(-16, Math.min(16, Math.round(v / EDGE * 12) || (v < 0 ? -1 : 1)));
        if (!v || rowEl.scrollLeft === was) { drag.raf = 0; return; }
        track();
        drag.raf = root.requestAnimationFrame(step);
      });
    }
    function up(commit) {
      var d = drag;
      drag = null;
      if (!d) return;
      if (d.raf) root.cancelAnimationFrame(d.raf);
      try { d.grip.releasePointerCapture(d.id); } catch (x) { /* вже відпущено */ }
      if (!d.on) return;
      swallowClick();
      var moved = commit && d.t !== d.f;
      var to = moved ? (d.t > d.f ? d.left[d.t] + d.w[d.t] - d.w[d.f] : d.left[d.t]) - d.left[d.f] : 0;
      d.tile.classList.remove('tr-tile--lifted');
      if (!moved) d.tiles.forEach(function (el) { el.style.transform = ''; });
      d.tile.style.transform = tx(to);
      settling = { d: d, moved: moved };
      timer = setTimeout(finish, calm() ? 0 : MS + 20);
    }
    function finish() {
      clearTimeout(timer); timer = null;
      var s = settling;
      settling = null;
      if (!s) return;
      var d = s.d, had = doc.activeElement === d.grip;
      rowEl.classList.remove('tr-row--dragging');
      d.tiles.forEach(function (el) { el.style.transform = ''; });
      if (s.moved && d.tile.parentNode === rowEl) {
        var others = d.tiles.filter(function (el) { return el !== d.tile; });
        rowEl.insertBefore(d.tile, d.t < others.length ? others[d.t] : others[others.length - 1].nextSibling);
        if (had) try { d.grip.focus({ preventScroll: true }); } catch (x) { /* не страшно */ }
        save();
      }
      layout();   // зміни розміру під час перетягування пропускались — доганяємо
    }
    function swallowClick() {
      var t = setTimeout(off, 400);
      function stop(e) { if (rowEl.contains(e.target)) { e.preventDefault(); e.stopPropagation(); } off(); }
      function off() { clearTimeout(t); root.removeEventListener('click', stop, true); }
      root.addEventListener('click', stop, true);
    }
    function onDocKey(e) { if (!rowEl.isConnected) { destroy(); return; } if (drag && drag.on && (e.key === 'Escape' || e.key === 'Esc')) { e.preventDefault(); e.stopPropagation(); up(false); } }

    function key(e, g, tile) {
      var k = e.key, held = kb && kb.tile === tile;
      if (k === ' ' || k === 'Enter') { keyAct = true; if (!e.repeat) { if (held) kbEnd(true); else kbPick(tile, g); } }
      else if (held && (k === 'ArrowLeft' || k === 'ArrowRight')) kbMove(k === 'ArrowLeft' ? -1 : 1);
      else if (held && (k === 'Escape' || k === 'Esc')) kbEnd(false);
      else return;
      e.preventDefault(); e.stopPropagation();
    }
    function kbPick(tile, g) {
      if (drag) return;
      if (settling) finish();
      if (kb) kbEnd(true);
      var tiles = list();
      kb = { tile: tile, grip: g, ids: tiles.map(idOf) };
      tile.classList.add('tr-tile--lifted');
      g.setAttribute('aria-pressed', 'true');
      say(nameOf(tile) + ': взято, місце ' + (tiles.indexOf(tile) + 1) + ' з ' + tiles.length);
    }
    function kbMove(dir) {
      var tiles = list(), i = tiles.indexOf(kb.tile), j = i + dir, el = kb.tile;
      if (j >= minIdx(tiles) && j < tiles.length) {
        var other = tiles[j];
        flip([el, other], function () { rowEl.insertBefore(other, dir > 0 ? el : el.nextSibling); });
        reveal(el);
        i = j;
      }
      say(nameOf(el) + ': місце ' + (i + 1) + ' з ' + tiles.length);
    }
    function kbEnd(commit) {
      var k = kb;
      kb = null;
      if (!k) return;
      k.tile.classList.remove('tr-tile--lifted');
      k.grip.setAttribute('aria-pressed', 'false');
      var tiles = list(), changed = tiles.map(idOf).join('\n') !== k.ids.join('\n'), name = nameOf(k.tile);
      if (!commit) { if (changed) reorder(k.ids); say(name + ': скасовано'); return; }
      if (changed) save();
      say(name + ': поставлено, місце ' + (tiles.indexOf(k.tile) + 1) + ' з ' + tiles.length);
    }
    function flip(els, fn) {
      if (calm()) return fn();
      var before = els.map(function (el) { return el.getBoundingClientRect().left; });
      fn();
      els.forEach(function (el, i) {
        var dx = before[i] - el.getBoundingClientRect().left;
        if (!dx) return;
        el.classList.remove('tr-tile--flip');
        el.style.transform = tx(dx);
        void el.offsetWidth;   // зафіксувати стартову точку перед анімацією
        el.classList.add('tr-tile--flip');
        el.style.transform = '';
      });
      clearTimeout(flipT);
      flipT = setTimeout(function () { list().forEach(function (el) { el.classList.remove('tr-tile--flip'); }); }, MS + 20);
    }

    function refresh() { if (dead) return; order(); decorate(); layout(); }
    function destroy() {
      if (dead) return;
      if (drag) { try { drag.grip.releasePointerCapture(drag.id); } catch (x) { /* вже відпущено */ } if (drag.raf) root.cancelAnimationFrame(drag.raf); }
      dead = true; drag = null; kb = null; settling = null;
      clearTimeout(timer); clearTimeout(flipT);
      if (scrollRaf) root.cancelAnimationFrame(scrollRaf);
      if (ro) ro.disconnect(); else root.removeEventListener('resize', layout);
      rowEl.removeEventListener('scroll', onScroll);
      doc.removeEventListener('keydown', onDocKey, true);
      grips.forEach(unGrip); grips = [];
      list().forEach(function (el) { el.classList.remove('tr-tile', 'tr-tile--fixed', 'tr-tile--lifted', 'tr-tile--flip'); el.style.transform = ''; });
      rowEl.classList.remove('tr-row', 'tr-row--slider', 'tr-row--fill', 'tr-row--more-l', 'tr-row--more-r', 'tr-row--dragging');
      rowEl.style.removeProperty('--tr-w');
      if (ownGap) rowEl.style.columnGap = '';
      [prev, next].forEach(function (b) { if (b && b.parentNode) b.parentNode.removeChild(b); });
      if (wrap && rowEl.parentNode === wrap && wrap.parentNode) { wrap.parentNode.insertBefore(rowEl, wrap); wrap.parentNode.removeChild(wrap); }
      if (insts && insts.get(rowEl) === api) insts.delete(rowEl);
    }

    if (rowEl.parentNode) {
      wrap = rowEl.parentNode.classList && rowEl.parentNode.classList.contains('tr-wrap') ? rowEl.parentNode : null;
      if (wrap) Array.prototype.slice.call(wrap.querySelectorAll(':scope > .tr-arrow')).forEach(function (b) { wrap.removeChild(b); });
      else { wrap = doc.createElement('div'); wrap.className = 'tr-wrap'; rowEl.parentNode.insertBefore(wrap, rowEl); wrap.appendChild(rowEl); }
      prev = arrow(-1); next = arrow(1);
      wrap.appendChild(prev); wrap.appendChild(next);
    }
    rowEl.classList.add('tr-row');
    order(); decorate(); layout(); restoreScroll();
    rowEl.addEventListener('scroll', onScroll, { passive: true });
    doc.addEventListener('keydown', onDocKey, true);
    if (typeof root.ResizeObserver === 'function') { ro = new root.ResizeObserver(function () { layout(); }); ro.observe(rowEl); }
    else root.addEventListener('resize', layout);
    if (insts) insts.set(rowEl, api);
    if (P.prefs && typeof P.prefs.load === 'function') P.prefs.load().then(function () { if (!dead && !drag && !kb) { order(); decorate(); layout(); restoreScroll(); } });
    return api;
  }

  P.tileRow = { mount: mount, applyOrder: applyOrder, cols: cols };
  if (typeof module !== 'undefined' && module.exports) module.exports = { applyOrder: applyOrder, cols: cols };
})(typeof window !== 'undefined' ? window : globalThis);
