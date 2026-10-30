(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var S = P.search = P.search || {};
  var doc = root.document;
  var MIN_LEN = S.MIN_LEN, esc = S.esc, norm = S.norm, hl = S.hl, run = S.run, GROUPS = S.GROUPS;
  var PER_GROUP = 6, DEBOUNCE_MS = 120, CACHE_MS = 5 * 60 * 1000;

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

  S.setup = function (c) { cfg = c || null; };
  S.open = open;
  S.reset = function () { cache = null; };
  S.locName = function (id) { var l = cache ? cache.locations.filter(function (x) { return x.id === id; })[0] : null; return l ? l.name : ''; };
})(typeof window !== 'undefined' ? window : globalThis);
