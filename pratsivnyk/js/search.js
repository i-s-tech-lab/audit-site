(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var doc = root.document;

  var MIN_LEN = 2, PER_GROUP = 6, DEBOUNCE_MS = 120, CACHE_MS = 5 * 60 * 1000;
  var GROUPS = [
    { k: 'ui', name: 'Розділи й блоки', ic: 'list' },
    { k: 'auditor', name: 'Аудитори', ic: 'user' },
    { k: 'senior', name: 'Старші', ic: 'user' },
    { k: 'worker', name: 'Працівники', ic: 'people' },
    { k: 'dept', name: 'Відділи', ic: 'department' },
    { k: 'loc', name: 'Локації', ic: 'location' },
    { k: 'defect', name: 'Види браку', ic: 'defect' },
    { k: 'product', name: 'Вироби', ic: 'department' },
    { k: 'order', name: 'Замовлення', ic: 'order' },
    { k: 'kd', name: 'Коригуючі дії', ic: 'corrective' },
    { k: 'audit', name: 'Аудити', ic: 'audit' },
    { k: 'person', name: 'Люди', ic: 'user' }
  ];

  function esc(s) {
    if (P.esc) return P.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function fold(s) { return String(s == null ? '' : s).toLowerCase().replace(/[ʼ’`]/g, "'"); }
  function norm(s) { return fold(s).replace(/\s+/g, ' ').trim(); }

  function tagHit(tag, w) {
    if (!tag) return false;
    if (tag.indexOf(w) === 0 || w.indexOf(tag) === 0) return true;
    return tag.split(' ').some(function (tw) { return tw.indexOf(w) === 0; });
  }

  function match(item, q) {
    var nq = norm(q);
    if (nq.length < MIN_LEN) return null;
    var words = nq.split(' '), t = norm(item.t), s = norm(item.s), tags = (item.tags || []).map(norm), got = {};
    var inTitle = 0, inSub = 0, inTag = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (t.indexOf(w) >= 0) { inTitle++; continue; }
      if (s && s.indexOf(w) >= 0) { inSub++; continue; }
      var hit = false;
      for (var j = 0; j < tags.length; j++) { if (tagHit(tags[j], w)) { got[j] = 1; hit = true; } }
      if (!hit) return null;
      inTag++;
    }
    var score = inTag && !inTitle && !inSub ? 0 : inTag ? 1 : inSub ? 2 : t.indexOf(nq) === 0 ? 4 : 3;
    return { score: score, tags: Object.keys(got).map(function (j) { return item.tags[j]; }) };
  }

  function hl(text, words) {
    var s = String(text == null ? '' : text), f = fold(s);
    if (!words || !words.length || f.length !== s.length) return esc(s);
    var mask = [], i;
    words.forEach(function (w) {
      if (!w) return;
      for (var at = f.indexOf(w); at >= 0; at = f.indexOf(w, at + w.length)) for (i = at; i < at + w.length; i++) mask[i] = 1;
    });
    var out = '', chunk = '', on = false;
    function flush() { if (chunk) out += on ? '<mark>' + esc(chunk) + '</mark>' : esc(chunk); chunk = ''; }
    for (i = 0; i < s.length; i++) {
      var m = !!mask[i];
      if (m !== on) { flush(); on = m; }
      chunk += s.charAt(i);
    }
    flush();
    return out;
  }

  function byRank(a, b) {
    return b.m.score - a.m.score || String(a.item.t).localeCompare(String(b.item.t), 'uk', { numeric: true });
  }
  function run(items, q, extra) {
    var nq = norm(q), out = { words: [], total: 0, groups: [] };
    if (nq.length < MIN_LEN) return out;
    out.words = nq.split(' ');
    var by = {};
    (items || []).forEach(function (it) {
      var m = match(it, nq);
      if (m) (by[it.k] = by[it.k] || []).push({ item: it, m: m });
    });
    Object.keys(by).forEach(function (k) { by[k].sort(byRank); });
    (extra || []).forEach(function (it) { (by[it.k] = by[it.k] || []).push({ item: it, m: { score: 4, tags: [] } }); });
    GROUPS.forEach(function (g) {
      if (!by[g.k]) return;
      out.groups.push({ k: g.k, name: g.name, ic: g.ic, rows: by[g.k] });
      out.total += by[g.k].length;
    });
    return out;
  }

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

  var cfg = null, cache = null, pending = null, layer = null, st = null;

  function loadIndex() {
    var locId = cfg && cfg.locationId ? cfg.locationId() : null;   // перевірка 30.10: кабінет старшого — лише поточна локація
    if (cache && cache.loc === locId && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache);
    if (pending) return pending;
    pending = P.srv('searchIndex', locId ? { locationId: locId } : {}).then(function (r) {
      pending = null;
      if (r && r.ok) cache = { ok: true, at: Date.now(), loc: locId, items: r.items || [], locations: r.locations || [] };
      return r && r.ok ? cache : (r || { ok: false, error: '' });
    });
    return pending;
  }
  function allItems() {
    var ui = ((cfg && cfg.ui) || []).map(function (u) { return Object.assign({ k: 'ui' }, u); });
    return ui.concat(cache ? cache.items : []);
  }

  function ic(name) { return P.ic ? P.ic(name, 'ui-icon--sm') : ''; }
  function rowHtml(r, i, words) {
    var it = r.item, g = GROUPS.filter(function (x) { return x.k === it.k; })[0];
    return '<button class="srch__row" type="button" role="option" id="srch-o-' + i + '" data-act="srch-pick" data-i="' + i + '" aria-selected="false">' +
      '<span class="srch__ico">' + ic(g ? g.ic : 'search') + '</span><span class="srch__txt">' +
      '<span class="srch__t">' + hl(it.t, words) + '</span>' + (it.s ? '<span class="srch__s">' + hl(it.s, words) + '</span>' : '') +
      (r.m.tags.length ? '<span class="srch__tags">' + r.m.tags.map(function (t) { return '<span class="srch__tag">' + esc(t) + '</span>'; }).join('') + '</span>' : '') +
      '</span></button>';
  }
  function mark(idx) {
    var box = st.res;
    Array.prototype.forEach.call(box.querySelectorAll('.srch__row'), function (b) {
      var on = +b.getAttribute('data-i') === idx;
      b.classList.toggle('srch__row--on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) { st.inp.setAttribute('aria-activedescendant', b.id); try { b.scrollIntoView({ block: 'nearest' }); } catch (e) { /* без прокрутки */ } }
    });
    st.act = idx;
  }
  function view() {
    var box = st.res, nq = norm(st.inp.value);
    st.rows = [];
    st.inp.removeAttribute('aria-activedescendant');
    if (st.status === 'loading') { box.innerHTML = P.state.loading('Готуємо список для пошуку…'); return; }
    var note = st.status === 'error' ? '<p class="srch__tip">Людей, відділи й замовлення зараз не знайти — список не завантажився' +
      (st.error ? ' (' + esc(st.error) + ')' : '') + '. Розділи й блоки шукаються.</p>' : '';
    if (nq.length < MIN_LEN) { box.innerHTML = note + (nq ? '<p class="srch__tip">Введіть хоча б 2 знаки.</p>' : ''); return; }
    var extra = st.au && st.au.q === nq ? st.au.items : [], out = run(allItems(), nq, extra);
    if (!out.total) {
      box.innerHTML = note + P.state.empty('search', 'Нічого не знайдено', 'Спробуйте інше слово або тег: аудитор, працівник, графік, відділ…');
      return;
    }
    var html = note;
    out.groups.forEach(function (g) {
      var open = !!st.open[g.k], shown = open ? g.rows : g.rows.slice(0, PER_GROUP), left = g.rows.length - shown.length;
      html += '<section class="srch__g"><p class="srch__gh">' + esc(g.name) + '<span class="srch__n">' + g.rows.length + '</span></p>' +
        shown.map(function (r) { st.rows.push(r.item); return rowHtml(r, st.rows.length - 1, out.words); }).join('') +
        (left > 0 ? '<button class="srch__more" type="button" data-act="srch-more" data-k="' + esc(g.k) + '">ще ' + left + '</button>' : '') + '</section>';
    });
    box.innerHTML = html;
    mark(Math.max(0, Math.min(st.act, st.rows.length - 1)));
  }

  function lookupAudits(nq) {
    if (!cfg || cfg.audits === false || nq.length < 4 || !/\d/.test(nq)) { st.au = null; return; }
    if (st.au && st.au.q === nq) return;
    st.au = { q: nq, items: [] };
    P.srv('searchIndex', { audit: nq }).then(function (r) {
      if (!layer || layer.closed || !st.au || st.au.q !== nq) return;
      st.au.items = r && r.ok ? r.items || [] : [];
      if (norm(st.inp.value) === nq) view();
    });
  }
  function onInput() {
    clearTimeout(st.timer);
    st.timer = setTimeout(function () {
      st.open = {}; st.act = 0;
      lookupAudits(norm(st.inp.value));
      view();
    }, DEBOUNCE_MS);
  }
  function pick(item) {
    if (!item) return;
    if (layer) layer.close();
    var t = cfg && cfg.route ? cfg.route(item) : null;
    if (t) P.router.go(t.path, t.query);
    if (cfg && cfg.after) cfg.after(item);
  }
  function onKey(e) {
    var n = st.rows.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (n) mark((st.act + (e.key === 'ArrowDown' ? 1 : -1) + n) % n);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(st.rows[st.act]);
    }
  }
  function ready() {
    if (cache && Date.now() - cache.at < CACHE_MS) { st.status = 'ok'; view(); return; }
    st.status = 'loading'; view();
    loadIndex().then(function (r) {
      if (!layer || layer.closed) return;
      if (r && r.ok) st.status = 'ok';
      else { st.status = 'error'; st.error = (r && r.error) || ''; }
      view();
    });
  }

  function open() {
    if (!cfg || !P.sr || !doc) return;
    if (layer && !layer.closed) { st.inp.focus(); return; }
    st = { rows: [], act: 0, open: {}, status: 'loading', error: '', au: null, timer: null };
    layer = P.sr.modal({
      size: 'sm',
      raw: '<div class="srch" role="search"><div class="srch__bar"><div class="search srch__field">' + P.ic('search', 'icon') +
        '<input class="input srch__in" type="search" autocomplete="off" spellcheck="false" placeholder="Що знайти?" aria-label="Пошук" role="combobox" aria-expanded="true" aria-controls="srch-res"></div>' +
        '<button class="icon-btn" type="button" data-ov-close aria-label="Закрити">' + P.ic('close') + '</button></div>' +
        '<p class="hint srch__hint">Наприклад: аудитор, працівник, графік, відділ, вид браку, замовлення</p>' +
        '<div class="srch__res" id="srch-res" role="listbox" aria-live="polite"></div></div>',
      on: {
        'srch-pick': function (t) { pick(st.rows[+t.getAttribute('data-i')]); },
        'srch-more': function (t) { st.open[t.getAttribute('data-k')] = true; view(); },
        retry: function () { ready(); }
      },
      onMount: function (wrap) {
        wrap.querySelector('.modal').classList.add('srch-modal');
        st.inp = wrap.querySelector('.srch__in'); st.res = wrap.querySelector('.srch__res');
        st.inp.addEventListener('input', onInput);
        st.inp.addEventListener('keydown', onKey);
      },
      onClose: function () { clearTimeout(st.timer); }
    });
    ready();
  }

  P.search = {
    setup: function (c) { cfg = c || null; },
    open: open,
    reset: function () { cache = null; },
    locName: function (id) { var l = cache ? cache.locations.filter(function (x) { return x.id === id; })[0] : null; return l ? l.name : ''; },
    waitFor: waitFor, reveal: reveal, showBlock: showBlock,
    norm: norm, match: match, hl: hl, run: run, GROUPS: GROUPS
  };
  if (P.hdrTools) P.hdrTools.on('search', P.search.open);

  if (typeof module !== 'undefined' && module.exports) module.exports = { norm: norm, match: match, hl: hl, run: run, GROUPS: GROUPS };
})(typeof window !== 'undefined' ? window : globalThis);
