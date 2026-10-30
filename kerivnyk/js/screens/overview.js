(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, K = P.mgr, OV = P.mgrOv;
  var AUD = ['аудит', 'аудити', 'аудитів'];

  var nb = null;   // нові блоки поточного показу екрана (overview-blocks.js): onShow малює блок, щойно його повернули з буфера
  var L = P.blockLayout.create({ key: 'mgr:ov', prefix: 'ov-', act: 'ov-layout', title: 'Блоки «Огляду»', help: K.help('mgr.ov.blocks'),
    blocks: [
      { id: 'sum', name: 'За період — підсумок', cls: 'card mgr-gap' },
      { id: 'days', name: 'Брак за днями', cls: 'card mgr-gap' },
      { id: 'cmp', name: 'Було → стало', cls: 'card mgr-gap' },
      { id: 'kd', name: 'Коригуючі дії', cls: '' },
      { id: 'compare', name: 'Порівняння двох періодів', cls: 'card mgr-gap' },
      { id: 'nocheck', name: 'Дні без перевірок', cls: 'card mgr-gap', buffer: true, desc: 'Скільки днів кожен відділ обраної локації був без жодної перевірки' },
      { id: 'per100', name: 'Брак на 100 перевірених', cls: 'card mgr-gap', buffer: true, desc: 'Відділи всіх локацій: скільки браку на кожні 100 перевірених штук' }
    ],
    onShow: function (id) { if (nb) nb.show(id); } });

  function tile(id, name, o, prev, on, days) {
    return '<div class="mgr-tile' + (on ? ' mgr-tile--on' : '') + '" data-tile-id="' + esc(id) + '" data-tile-name="' + esc(name) + '">' +
      '<button class="mgr-tile__btn" type="button" data-act="mgr-loc" data-id="' + esc(id) + '" aria-pressed="' + on + '">' +
      '<span class="mgr-tile__head"><b class="mgr-tile__name">' + P.ic('location', 'ui-icon--sm') + esc(name) + '</b>' +
      (on ? '<span class="mgr-tile__on">' + P.ic('check', 'ui-icon--sm') + 'обрано</span>' : '') + '</span>' +
      '<span class="mgr-tile__hero"><b class="mgr-tile__pct">' + H.pct(o.pct) + '</b><span class="mgr-dim">брак, % за ' + K.dn(days) + '</span></span>' +
      '<span class="mgr-tile__sub">' + (o.audits ? H.num(o.rejected) + ' з ' + H.num(o.checked) + ' шт · ' + K.n(o.audits, AUD[0], AUD[1], AUD[2]) : 'аудитів за період не було') + '</span>' +
      H.stack(o.levels, 6) +
      '<span class="mgr-tile__was">попередні ' + K.dn(days) + ': ' + K.was(H.pct(prev.pct), H.pct(o.pct)) + '</span>' + P.mgrKd.tile(o.kd) + '</button></div>';
  }

  function tiles(r, sel) {
    var n = r.totals.days;
    return '<section class="mgr-tiles" aria-label="Локація">' +
      r.locations.map(function (l) { return tile(l.id, l.name, l, l.prev, sel === l.id, n); }).join('') + '</section>' +
      '<div class="ov-bar"><p class="hint mgr-tiles__key">Плитка перемикає всю сторінку на локацію' + K.help('mgr.tiles') + ' · смужка — рівні браку' + K.help('term.levels') + ': ' +
      K.LV.map(function (k) { return H.lvl(k); }).join(' ') + ' · «було → стало»' + K.help('mgr.was') + ' · коригуючі дії зараз' + K.help('mgr.kd.now') + '</p>' + L.button() + '</div>';
  }
  function sumLocs(list) {
    var o = { audits: 0, checked: 0, rejected: 0, levels: { fix: 0, repair: 0, scrap: 0 } };
    list.forEach(function (l) {
      o.audits += l.audits; o.checked += l.checked; o.rejected += l.rejected;
      if (l.levels) K.LV.forEach(function (k) { o.levels[k] += l.levels[k]; });
    });
    o.pct = o.checked > 0 ? Math.round(o.rejected / o.checked * 1000) / 10 : null;
    return o;
  }

  function summary(r, scope, bx) {
    var t = r.totals, p = r.prev, n = t.days;
    function cell(label, key, val, prev) {
      return '<div class="mgr-sum__i"><span class="mgr-sum__l">' + esc(label) + K.help(key) + '</span><b class="mgr-sum__v">' + val + '</b>' +
        '<span class="mgr-sum__p">попередні ' + K.dn(n) + ' — <b>' + prev + '</b></span></div>';
    }
    var lv = K.total(t.levels);
    return OV.wrap('<h2 class="h2">За період · ' + esc(scope) + '</h2><p class="h2-sub">' + esc(K.span(r.from, r.to)) + ' · ' + K.dn(n) +
      ' · ' + esc(K.asOf(r.asOf)) + ' · під кожним числом — те саме за ' + esc(K.span(p.from, p.to)) + K.help('mgr.prev') + '</p>', bx) +
      '<div class="mgr-sum">' + cell('Аудитів', 'term.audit', H.num(t.audits), H.num(p.audits)) +
      cell('Днів з аудитами', 'mgr.daysWithAudits', t.daysWithAudits + ' з ' + n, p.daysWithAudits + ' з ' + n) +
      cell('Перевірено, шт', 'term.checked', H.num(t.checked), H.num(p.checked)) + cell('Брак, шт', 'term.rejected', H.num(t.rejected), H.num(p.rejected)) +
      cell('Брак, %', 'term.rate', K.rate(t.pct, r.criticalPct), H.pct(p.pct)) + '</div>' +
      '<div class="mgr-gap mgr-gap--sm"><p class="group-label" style="padding:0">Рівні браку · ' + H.num(lv) + ' шт' + K.help('term.levels') + '</p>' +
      (lv ? K.levels(t.levels, 14) : '<p class="hint">Браку за період не знайдено.</p>') + '</div>';
  }

  function daysCard(r, scope, bx) {
    var head = OV.wrap('<h2 class="card-title">Брак за днями, % від перевіреного' + K.help('mgr.daysChart') + '</h2><p class="hint">' + esc(scope) + ' · ' + esc(K.span(r.from, r.to)) +
      ' · колір — рівень браку · наведіть на день або торкніться — його числа · протягніть мишею — сума кількох днів</p>', bx);
    if (!r.totals.audits) return head + H.empty('Аудитів за період не було', scope + ' · ' + K.span(r.from, r.to));
    return head + '<div class="legend">' + K.LV.map(function (k) { return H.lvl(k); }).join('') +
      '<span class="mgr-key"><i class="mgr-key__dash"></i>критичний рівень — ' + r.criticalPct + '%' + K.help('term.critical') + '</span>' +
      '<span class="mgr-key"><i class="mgr-key__none"></i>аудитів не було</span></div><div data-chart="days"></div>';
  }
  function mountChart(el, r, scope) {
    var box = el.querySelector('[data-chart="days"]');
    if (!box) return;
    P.srChart.mount(box, {
      items: r.days.map(function (d) { return { key: d.day, x: H.dayShort(d.day), v: d.pct || 0, levels: d.levels, none: !d.audits, d: d }; }),
      height: root.innerWidth < 900 ? 220 : 300, label: 'Брак за днями, % · ' + scope,
      line: { v: r.criticalPct, label: 'критичний рівень — ' + r.criticalPct + '%' },
      tip: function (it) {
        var d = it.d;
        if (!d.audits) return P.srChart.tipDay({ title: K.dcap(d.day), none: scope + ' · аудитів не було' });
        return P.srChart.tipDay({ title: K.dcap(d.day), sub: scope, audits: d.audits, checked: d.checked, rejected: d.rejected, pct: d.pct, levels: d.levels, over: d.pct > r.criticalPct });
      },
      tipRange: function (list, a, b) {
        var s = sumLocs(list.map(function (x) { return x.d; })), withA = list.filter(function (x) { return x.d.audits; }).length;
        return P.srChart.tipDay({ title: K.span(a.key, b.key), sub: K.dn(list.length) + ' · з аудитами — ' + withA, audits: s.audits, checked: s.checked, rejected: s.rejected, pct: s.pct, levels: s.levels });
      }
    });
  }

  function compareCard(r, scope, bx) {
    var t = r.totals, p = r.prev, n = t.days;
    function row(label, prev, cur) { return '<div class="mgr-cmp__r"><span>' + label + '</span><span>' + K.was(prev, cur) + '</span></div>'; }
    return OV.wrap('<h2 class="card-title">Порівняння з попереднім періодом (' + K.dn(n) + ')' + K.help('mgr.was') + '</h2><p class="hint">' + esc(scope) + ' · було — ' + esc(K.span(p.from, p.to)) +
      ' · стало — ' + esc(K.span(r.from, r.to)) + '</p>', bx) + '<div class="mgr-cmp">' +
      row('Брак, %', H.pct(p.pct), H.pct(t.pct)) + row('Брак, шт', H.num(p.rejected), H.num(t.rejected)) +
      row('Перевірено, шт', H.num(p.checked), H.num(t.checked)) + row('Аудитів', H.num(p.audits), H.num(t.audits)) +
      row('Днів з аудитами', p.daysWithAudits + ' з ' + n, t.daysWithAudits + ' з ' + n) +
      K.LV.map(function (k) { return row(H.lvl(k) + ', шт', H.num(p.levels[k]), H.num(t.levels[k])); }).join('') + '</div>';
  }

  function kdLink(loc, bx) {
    return '<div class="card mgr-kdlink ov-kd"><a class="ov-kd__a" href="#/kd/loc/' + encodeURIComponent(loc.id) + '">' + P.ic('corrective', 'ui-icon--sm') +
      '<span>Коригуючі дії цієї локації — на вкладці «Коригуючі дії» ›</span></a>' + bx + '</div>';
  }

  P.cab.tab({ id: 'overview', label: 'Огляд', ic: 'chart', path: '/overview', order: 10, real: 'mgrOverview' });
  var last = '';   // остання обрана локація (повертаючись на вкладку без ?loc= — та сама)
  P.cab.screen('/overview', { tab: 'overview', title: 'Огляд', period: true,
    share: function (ctx) {
      var loc = (ctx.query && ctx.query.loc) || last;
      return loc ? { path: '/analytics', query: { loc: loc }, label: '«Аналітика» старшого · обрана локація · період із шапки' } : null;
    },
    render: function (ctx) {
    var sel = (ctx.query && ctx.query.loc) || last, tileRow = null;
    function load() {
      P.srv('mgrOverview', { from: ctx.period.from, to: ctx.period.to, locationId: sel }).then(function (r) {
        return L.ready().then(function () { return r; });   // v1.10: перший показ — після профілю (≤ 1 с), щоб блоки не «стрибали»
      }).then(show);
    }
    function show(r) {
      if (!ctx.alive()) return;
      if (r.ok && !r.location && r.locations.length) { sel = r.locations[0].id; load(); return; }   // без вибору — перша локація
      if (!r.ok && r.code === 'not_found' && sel === last && last) { last = sel = ''; load(); return; }   // запамʼятована локація зникла
      if (!r.ok) {
        ctx.el.innerHTML = r.code === 'not_found' ? H.empty('Такої локації немає', 'Адреса веде на локацію, якої немає в списку.') +
          '<p style="text-align:center"><a class="btn btn--secondary btn--sm" href="#/overview">Показати першу локацію</a></p>' : H.error(r);
        return;
      }
      if (!r.location) { ctx.el.innerHTML = '<section class="card">' + H.empty('Локацій ще немає', 'Коли адміністратор додасть локацію, тут зʼявляться її числа.') + '</section>'; return; }   // жодної локації
      var scope = r.location.name;
      last = r.location.id;
      ctx.el.innerHTML = '<div class="mgr-page"><div id="ov-since"></div>' + tiles(r, sel) + '<div id="ov-body" class="ov-body">' + L.frame() + '</div></div>';
      var body = ctx.el.querySelector('#ov-body');
      fill(body, 'sum', summary(r, scope, L.box('sum')));
      fill(body, 'days', daysCard(r, scope, L.box('days')));
      fill(body, 'cmp', compareCard(r, scope, L.box('cmp')));
      fill(body, 'kd', kdLink(r.location, L.box('kd')));
      L.bindPage(body);
      mountChart(ctx.el, r, scope);
      mountTiles();
      mountSince();
      nb = OV.mount(ctx, { loc: r.location, period: { from: r.from, to: r.to }, visible: L.visible,
        box: { compare: L.box('compare'), nocheck: L.box('nocheck'), per100: L.box('per100') } });
      ctx.on('ov-layout', function (t) { L.open(t, body); });
      if (P.prefs) P.prefs.load().then(function () { if (ctx.alive()) { L.late(body); nb.start(); } });   // налаштування могли прийти пізніше за перше малювання
      else nb.start();
    }
    function fill(body, id, html) { var el = body.querySelector('#ov-' + id); if (el) el.innerHTML = html; }
    function mountSince() {
      var el = ctx.el.querySelector('#ov-since');
      if (el && P.sinceLast && P.sinceLast.mount) P.sinceLast.mount(el, { scope: 'manager', link: function (kind, locId) {
        return kind === 'audits' ? { path: '/overview', query: { loc: locId } } : { path: '/kd/loc/' + locId };
      } });
    }
    function mountTiles() {
      var row = ctx.el.querySelector('.mgr-tiles');
      if (tileRow) tileRow.destroy();
      tileRow = row ? P.tileRow.mount(row, { scope: 'mgr:ov', item: '.mgr-tile', idAttr: 'data-tile-id', active: '.mgr-tile--on', minWidth: 260, max: 6, fill: true, label: 'локацію' }) : null;
    }
    nb = null;
    load();
    ctx.on('mgr-loc', function (t) { var id = t.getAttribute('data-id'); if (id !== sel) ctx.go('/overview', { loc: id }); });
  } });
})(window);
