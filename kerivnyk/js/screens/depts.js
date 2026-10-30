(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, K = P.mgr, T = P.mgrDeptTiles;
  var WEEKLY_FROM = 46;   // з такої довжини періоду (днів) графік панелі — по тижнях, а не по днях
  var FIRST_PRODUCTS = 8, FIRST_DEFECTS = 10;   // скільки рядків панелі видно до «Показати всі»
  var KD_ORDER = ['pre', 'over', 'watch', 'hold', 'done', 'part', 'relapse', 'skip'];
  var st = { locs: [], many: false, type: '' };

  function slot(d) { return '<div class="mgr-dp" id="mgr-dp-' + esc(d.id) + '" data-dpanel="' + esc(d.id) + '" role="region" aria-label="' + esc('Відділ ' + d.name + (d.locationName ? ' · ' + d.locationName : '')) + '"></div>'; }
  function days(n) { return K.n(n, 'день', 'дні', 'днів'); }
  function big(val, label, key, sub) {
    return '<div class="mgr-kdbig"><span class="mgr-kdbig__l">' + esc(label) + (key ? K.help(key) : '') + '</span><b class="mgr-kdbig__v">' + val + '</b>' +
      (sub ? '<span class="mgr-kdbig__s">' + sub + '</span>' : '') + '</div>';
  }
  function more(act, all, n) {
    return '<button class="btn btn--secondary btn--sm mgr-dp__more" type="button" data-act="' + act + '" aria-expanded="' + all + '">' + (all ? 'Згорнути список' : 'Показати всі ' + H.num(n)) + '</button>';
  }
  function head(dep, locName, sub) {
    return '<div class="mgr-dp__head"><div class="mgr-dp__ht"><h3 class="mgr-dp__t">' + esc(dep.name) + (locName ? ' <span class="mgr-dp__loc">' + P.ic('location', 'ui-icon--sm') + esc(locName) + '</span>' : '') + '</h3>' +
      (sub ? '<p class="hint">' + sub + '</p>' : '') + '</div>' +
      '<button class="btn btn--secondary btn--sm" type="button" data-act="mgr-d-open" data-id="' + esc(dep.id) + '">' + P.ic('chevron-up', 'ui-icon--sm') + 'Згорнути</button></div>';
  }
  function bigs(r) {
    var t = r.totals, n = t.norm, crit = r.criticalPct;
    return '<div class="mgr-dp__bigs">' + big(H.num(t.audits), 'Аудитів', 'term.audit') + big(H.num(t.checked), 'Перевірено, шт', 'term.checked') +
      big(H.num(t.rejected), 'Брак, шт', 'mgr.deptBrak') + big(K.rate(t.pct, crit), 'Брак, %', 'term.rate') +
      big(H.num(t.daysWithAudits) + ' <small>з ' + H.num(t.days) + '</small>', 'Днів з аудитами', 'mgr.daysWithAudits') +
      big(n.of ? H.num(n.ok) + ' <small>з ' + H.num(n.of) + '</small>' : '—', 'Днів з виконаною нормою вибірки', 'mgr.dept.normDays',
        n.target != null ? (n.of ? H.pct(n.pct) + ' · ' : '') + 'норма — ' + H.num(n.target) + ' шт на день' : 'норму вибірки не задано') + '</div>';
  }
  function chartItems(r) {
    var crit = r.criticalPct;
    if (r.days.length < WEEKLY_FROM) {
      return r.days.map(function (d) { return { key: d.day, x: H.dayShort(d.day), v: d.pct || 0, hot: d.pct > crit, none: !d.audits, d: d, title: K.dcap(d.day) }; });
    }
    var out = [];
    for (var i = 0; i < r.days.length; i += 7) {
      var part = r.days.slice(i, i + 7), o = { audits: 0, checked: 0, rejected: 0 };
      part.forEach(function (d) { o.audits += d.audits; o.checked += d.checked; o.rejected += d.rejected; });
      o.pct = o.checked > 0 ? Math.round(o.rejected / o.checked * 1000) / 10 : null;
      var a = part[0].day, b = part[part.length - 1].day;
      out.push({ key: a, x: H.dayShort(a), v: o.pct || 0, hot: o.pct > crit, none: !o.audits, d: o, title: K.span(a, b) });
    }
    return out;
  }
  function chartSec(r) {
    var weekly = r.days.length >= WEEKLY_FROM;
    return '<section class="mgr-dp__sec mgr-dp__sec--wide"><div><h4 class="mgr-dp__st">Брак, % ' + (weekly ? 'по тижнях' : 'по днях') + K.help('mgr.dept.chart') + '</h4>' +
      '<p class="hint">' + (weekly ? 'Стовпчик — 7 днів від ' + esc(K.day(r.from)) + ' (останній може бути коротшим) · ' : '') + 'наведіть на стовпчик або торкніться — його числа</p></div>' +
      '<div class="legend"><span class="mgr-key"><i class="mgr-key__hot"></i>червоний — понад ' + r.criticalPct + '%</span>' +
      '<span class="mgr-key"><i class="mgr-key__dash"></i>норма — ' + r.criticalPct + '%' + K.help('mgr.kd.threshold') + '</span><span class="mgr-key"><i class="mgr-key__none"></i>аудитів у відділі не було</span></div>' +
      (r.totals.audits || r.totals.rejected ? '<div data-chart="dept"></div>' : '<p class="hint">Аудитів у відділі за період не було.</p>') + '</section>';
  }
  function mountChart(el, r, scope) {
    var box = el.querySelector('[data-chart="dept"]');
    if (!box) return;
    P.srChart.mount(box, {
      items: chartItems(r), height: root.innerWidth < 900 ? 180 : 220, label: 'Брак, % · ' + scope,
      line: { v: r.criticalPct, label: 'норма — ' + r.criticalPct + '%' },
      tip: function (it) {
        var d = it.d;
        return P.srChart.tip({ title: it.title, sub: scope, rows: [['Перевірено', H.num(d.checked) + ' шт'], ['Брак', H.num(d.rejected) + ' шт'],
          ['Брак, %', H.pct(d.pct), d.pct > r.criticalPct ? 'danger' : ''], ['Аудитів', H.num(d.audits)]] });
      }
    });
  }
  function productsSec(r, all) {
    var list = r.products, shown = all ? list : list.slice(0, FIRST_PRODUCTS), crit = r.criticalPct;
    var top = '<div><h4 class="mgr-dp__st">Вироби, які перевіряли · ' + H.num(list.length) + K.help('mgr.dept.products') + '</h4>' +
      '<p class="hint">Перевірено — штуки виробу в аудитах цього відділу; брак — штуки виробу з браком, який зробив цей відділ, хоч би де їх знайшли.</p></div>';
    if (!list.length) return '<section class="mgr-dp__sec">' + top + '<p class="hint">Виробів за період немає.</p></section>';
    return '<section class="mgr-dp__sec">' + top +
      '<div class="tbl-box mgr-desk"><table class="tbl mgr-tbl mgr-dp__tbl"><thead><tr><th>Виріб</th><th class="n">Перевірено, шт</th><th class="n">Брак, шт</th><th class="n">Брак, %</th>' +
      '<th class="n">Замовлень' + K.help('term.order') + '</th></tr></thead><tbody>' + shown.map(function (p) {
        return '<tr><td>' + esc(p.name) + '</td><td class="n">' + H.num(p.checked) + '</td><td class="n">' + H.num(p.rejected) + '</td><td class="n">' + K.rate(p.pct, crit) + '</td><td class="n">' + H.num(p.orders) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +
      '<ul class="mgr-dp__list mgr-phone">' + shown.map(function (p) {
        return '<li><b>' + esc(p.name) + '</b><span class="mgr-dp__nums">перевірено ' + H.num(p.checked) + ' шт · брак ' + H.num(p.rejected) + ' шт · ' + K.rate(p.pct, crit) +
          ' · замовлень ' + H.num(p.orders) + '</span></li>';
      }).join('') + '</ul>' + (list.length > FIRST_PRODUCTS ? more('mgr-d-allp', all, list.length) : '') + '</section>';
  }
  function defectsSec(r, all) {
    var list = r.defects, shown = all ? list : list.slice(0, FIRST_DEFECTS), lv = r.totals.levels;
    var top = '<div><h4 class="mgr-dp__st">Знайдені види браку · ' + H.num(list.length) + K.help('term.defectType') + '</h4>' +
      '<p class="hint">Частка — від усього браку, шт цього відділу за період (' + H.num(r.totals.rejected) + ' шт)</p></div>';
    if (!list.length) return '<section class="mgr-dp__sec">' + top + '<p class="hint">Браку за період не знайдено.</p></section>';
    return '<section class="mgr-dp__sec">' + top + '<div class="mgr-gap mgr-gap--sm"><p class="group-label" style="padding:0">Рівні браку · ' + H.num(K.total(lv)) + ' шт' + K.help('term.levels') + '</p>' + K.levels(lv, 12) + '</div>' +
      '<ol class="mgr-top10__l mgr-dp__defs">' + shown.map(function (t) {
        return '<li><span class="lvl lvl--' + esc(t.level) + '">' + esc(t.name) + '</span><b>' + H.num(t.pieces) + ' шт · ' + H.pct(t.share) + '</b>' +
          '<span class="mgr-top10__bar"><i class="s-' + esc(t.level) + '" style="width:' + (t.share || 0) + '%"></i></span></li>';
      }).join('') + '</ol>' + (list.length > FIRST_DEFECTS ? more('mgr-d-alld', all, list.length) : '') + '</section>';
  }
  function canon(s) { return P.sr.KD_STATES[s] ? s : P.sr.kdStateOf(s); }
  function day(v) { return v ? K.day(String(v).slice(0, 10)) : '—'; }
  function action(a) {
    var s = canon(a.state), d = a.daysToImplement;
    var noAfter = s === 'skip' || s === 'over' || s === 'pre';   // «після» не буде (дія не потрібна) або ще не впроваджено — лише «до»
    return '<article class="mgr-dact"><div class="mgr-dact__top">' + (a.no ? '<b>№' + a.no + '</b>' : '') + H.kdState(s, P.mgrKd.word(s)) + P.mgrKd.help(s) +
      (a.weekStart ? '<span class="mgr-dim">тиждень, через який відкрито: ' + esc(K.span(a.weekStart, a.weekEnd)) + '</span>' : '') + '</div>' +
      '<dl class="mgr-dact__kv"><dt>Відкрито</dt><dd>' + esc(day(a.openedAt)) + (a.early ? ' <span class="badge">достроково, посеред тижня</span>' + K.help('mgr.kd.early') +
        (a.earlyBelow ? '<span class="mgr-dim mgr-block">брак, % за весь тиждень: ' + H.pct(a.weekRate) + '</span>' : '') : '') + '</dd>' +
      '<dt>Впроваджено</dt><dd>' + (a.implementedAt ? esc(day(a.implementedAt)) + (d != null ? ' <span class="mgr-dim">· ' + (d ? 'через ' + days(d) + ' після відкриття' : 'того ж дня') + '</span>' : '') : '<span class="mgr-dim">' + (s === 'skip' ? 'дія не потрібна' : 'ще не впроваджено') + '</span>') + '</dd>' +
      '<dt>Головна причина' + K.help('mgr.kd.causes') + '</dt><dd>' + (a.cause ? esc(K.causeName(a.cause, a.cause)) : '<span class="mgr-dim">не записано</span>') + '</dd>' +
      '<dt>Брак, % відділу: до → після' + K.help('mgr.kd.beforeAfter') + '</dt><dd>' + H.ba(a.before, a.after, noAfter) + '</dd></dl>' +
      ((a.items || []).length ? '<div class="mgr-dact__items"><span class="mgr-dact__il">Види браку, з якими працює дія' + K.help('mgr.kd.items') + '</span>' + a.items.map(function (it) {
        return '<span class="mgr-dact__it"><span>' + esc(it.name) + '</span>' + H.ba(it.before, s === 'watch' ? null : it.after, noAfter) + '</span>';
      }).join('') + '</div>' : '') + '</article>';
  }
  function kdSec(r) {
    var k = r.kd, top = '<div><h4 class="mgr-dp__st">Коригуючі дії відділу' + (k ? ' · ' + H.num(k.actions.length) : '') + K.help('mgr.kd.action') + '</h4>';
    if (!k) return '<section class="mgr-dp__sec">' + top + '</div><p class="hint">Даних про коригуючі дії немає.</p></section>';
    var states = KD_ORDER.filter(function (s) { return k.states[s]; });
    var list = k.actions.slice().sort(function (a, b) { return String(b.openedAt) < String(a.openedAt) ? -1 : 1; });
    return '<section class="mgr-dp__sec">' + top + '<p class="hint">Коригуючі дії, які тривали хоча б частину цього періоду · стан — на сьогодні' +
      ' · за період: відкрито <b>' + H.num(k.opened) + '</b>, впроваджено <b>' + H.num(k.implemented) + '</b></p></div>' +
      (!list.length ? '<p class="hint">Коригуючих дій відділу за цей період не було.</p>'
        : '<div class="mgr-split__key">' + states.map(function (s) { return '<span class="mgr-split__i">' + H.kdState(s, P.mgrKd.word(s) + ' · ' + k.states[s]) + P.mgrKd.help(s) + '</span>'; }).join('') + '</div>' +
          '<div class="mgr-dacts">' + list.map(action).join('') + '</div>') + '</section>';
  }
  function peopleSec(r) {
    var top = '<div><h4 class="mgr-dp__st">Хто перевіряв · ' + H.num(r.auditors.length) + K.help('term.auditor') + '</h4><p class="hint">Аудитів і перевірено, шт — лише в цьому відділі за період</p></div>';
    if (!r.auditors.length) return '<section class="mgr-dp__sec">' + top + '<p class="hint">За період у відділі ніхто не записував аудитів.</p></section>';
    return '<section class="mgr-dp__sec">' + top + '<ul class="mgr-dp__list">' + r.auditors.map(function (a) {
      return '<li><span><b>' + esc(a.name) + '</b>' + (a.senior ? ' <span class="badge mgr-senior">старший</span>' : '') + (a.legacy ? ' ' + H.badge('ще не в новій системі') : a.active ? '' : ' ' + H.badge('вимкнено')) + '</span>' +
        '<span class="mgr-dp__nums">' + K.n(a.audits, 'аудит', 'аудити', 'аудитів') + ' · ' + H.num(a.checked) + ' шт</span></li>';
    }).join('') + '</ul></section>';
  }
  function panel(r, allP, allD) {
    var sub = '<b>' + esc(K.span(r.from, r.to)) + '</b> · ' + K.dn(r.totals.days) + ' · ' + esc(K.asOf(r.asOf)) + (r.department.deptTypeName && r.department.deptTypeName !== r.department.name ? ' · ' + esc(r.department.deptTypeName) : '');
    return head(r.department, r.location ? r.location.name : '', sub) + bigs(r) +
      '<div class="mgr-dp__grid">' + chartSec(r) + productsSec(r, allP) + defectsSec(r, allD) + kdSec(r) + peopleSec(r) + '</div>';
  }

  P.cab.tab({ id: 'depts', label: 'Відділи', ic: 'department', path: '/depts', order: 20, real: 'mgrDeptTiles' });
  P.cab.screen('/depts', { tab: 'depts', title: 'Відділи', period: true,
    share: function (ctx) {
      var on = ctx.el && ctx.el.querySelector('.mgr-dtile--on'), blk = on && on.closest('[data-dpblock]');
      if (on && blk) return { path: '/analytics', query: { loc: blk.getAttribute('data-dpblock'), dep: on.getAttribute('data-tile-id') }, label: '«Аналітика» старшого · обраний відділ · період із шапки' };
      return st.locs.length === 1 ? { path: '/analytics', query: { loc: st.locs[0] }, label: '«Аналітика» старшого · обрана локація · період із шапки' } : null;
    },
    render: function (ctx) {
    var req = 0, last = null, rows = [];
    var dp = { id: null, row: null, data: null, err: null, req: 0, allP: false, allD: false };
    function find(r, id) {
      var out = null;
      r.locations.forEach(function (l) { l.depts.forEach(function (d) { if (d.id === id) out = { id: d.id, name: d.name, locationId: l.id, locationName: l.name }; }); });
      return out;
    }
    function load() {
      var my = ++req, box = ctx.el.querySelector('#mgr-dl');
      if (box) box.classList.add('mgr-busy');   // фільтр змінили — старі числа тьмяніють, доки не прийдуть нові
      var p = { from: ctx.period.from, to: ctx.period.to, deptTypeId: st.type };
      if (st.locs.length) p.locationIds = st.locs;
      P.srv('mgrDeptTiles', p).then(function (r) {
        if (!ctx.alive() || my !== req) return;
        if (!r.ok && (r.code === 'not_found' || r.code === 'validation') && (st.locs.length || st.type)) { st.locs = []; st.type = ''; load(); return; }   // вибір на те, чого вже немає
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        if (!st.locs.length) { st.locs = r.allLocations.length ? [r.allLocations[0].id] : []; if (st.locs.length) { load(); return; } }   // перший захід — перша локація
        last = r;
        if (dp.id && !find(r, dp.id)) close();   // відкритого відділу в новому списку немає
        draw(r);
      });
    }
    function draw(r) {
      var types = [['', 'Усі відділи']].concat(r.deptTypes.map(function (t) { return [t.id, t.name]; }));
      var names = r.locations.map(function (l) { return l.name; }).join(' · ');
      T.unmount(rows);
      ctx.el.innerHTML = '<section class="mgr-page"><div><h2 class="h2">Відділи' + (names ? ' · ' + esc(names) : '') + '</h2>' +
        '<p class="h2-sub">' + esc(K.span(r.from, r.to)) + ' · ' + esc(K.asOf(r.asOf)) + ' · натисніть на плитку відділу — під рядом розгорнеться все про нього' + K.help('mgr.dept.open') + '</p></div>' +
        '<div class="card mgr-gap mgr-gap--sm">' + K.locBar('mgr-d', r.allLocations, st.locs, st.many) +
        '<div class="mgr-pick"><span class="mgr-pick__l">Відділ' + K.help('mgr.deptPick') + '</span>' + K.chips('mgr-d-type', types, st.type, 'Відділ') + '</div>' +
        (st.many && st.locs.length < 2 ? '<p class="hint">Оберіть ще одну локацію вище — вони стануть одна під одною.</p>' : '') + '</div>' + T.key() +
        '<div id="mgr-dl" class="mgr-page">' + (r.locations.length ? r.locations.map(function (l) { return T.block(l, dp.id); }).join('')
          : '<section class="card">' + H.empty('Локацій ще немає', 'Коли адміністратор додасть локацію, тут зʼявляться її відділи.') + '</section>') + '</div></section>';
      rows = T.mount(ctx.el);
      sync();
    }
    function sync() {
      Array.prototype.forEach.call(ctx.el.querySelectorAll('.mgr-dtile'), function (el) {
        var on = el.getAttribute('data-tile-id') === dp.id, b = el.querySelector('[data-act="mgr-d-open"]');
        el.classList.toggle('mgr-dtile--on', on);
        if (b) { b.setAttribute('aria-expanded', on); b.setAttribute('aria-label', (on ? 'Згорнути: ' : 'Розгорнути: ') + el.getAttribute('data-tile-name')); }
      });
      Array.prototype.forEach.call(ctx.el.querySelectorAll('[data-dpslot]'), function (box) {
        box.innerHTML = dp.id && dp.row && dp.row.locationId === box.getAttribute('data-dpslot') ? slot(dp.row) : '';
      });
      fill();
    }
    function fill() {
      var el = ctx.el.querySelector('[data-dpanel]');
      if (!el || !dp.id) return;
      var row = dp.row || { id: dp.id, name: '' };
      if (dp.data) {
        el.innerHTML = panel(dp.data, dp.allP, dp.allD);
        mountChart(el, dp.data, dp.data.department.name + (dp.data.location ? ' · ' + dp.data.location.name : '') + ' · ' + K.span(dp.data.from, dp.data.to));
      } else if (dp.err) {
        el.innerHTML = head(row, row.locationName, '') + '<div class="mgr-dp__msg"><p><b>Не вдалося завантажити відділ.</b> ' + esc(dp.err.error || '') + '</p>' +
          '<button class="btn btn--secondary btn--sm" type="button" data-act="mgr-d-retry">' + P.ic('refresh', 'ui-icon--sm') + 'Спробувати ще раз</button></div>';
      } else {
        el.innerHTML = head(row, row.locationName, esc(K.span(ctx.period.from, ctx.period.to))) + '<div class="mgr-dp__msg">' + H.loading() + '</div>';
      }
    }
    function request() {
      var my = ++dp.req, id = dp.id, p = { departmentId: id, from: ctx.period.from, to: ctx.period.to };
      if (dp.row && dp.row.locationId) p.locationId = dp.row.locationId;
      P.srv('mgrDeptDetail', p).then(function (r) {
        if (!ctx.alive() || my !== dp.req || dp.id !== id) return;
        if (r.ok) dp.data = r; else dp.err = r;
        fill();
      });
    }
    function close() { dp.id = null; dp.row = null; dp.data = null; dp.err = null; dp.req++; }
    function reveal() {
      var el = ctx.el.querySelector('[data-dpanel]'), top = el ? el.getBoundingClientRect().top : 0;
      if (el && (top < 60 || top > root.innerHeight - 120)) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
    ctx.on('mgr-d-open', function (t) {
      var id = t.getAttribute('data-id');
      if (!last) return;
      if (dp.id === id) { close(); sync(); return; }   // повторний клік — закрити
      close();
      dp.id = id; dp.row = find(last, id); dp.allP = dp.allD = false;
      sync(); reveal(); request();
    });
    ctx.on('mgr-d-retry', function () { dp.err = null; fill(); request(); });
    ctx.on('mgr-d-allp', function () { dp.allP = !dp.allP; fill(); });
    ctx.on('mgr-d-alld', function () { dp.allD = !dp.allD; fill(); });
    ctx.on('mgr-d-loc', function (t) { st.locs = K.pickLocs(st.locs, t.getAttribute('data-v'), st.many); close(); load(); });
    ctx.on('mgr-d-many', function () {
      st.many = !st.many; close();
      if (!st.many && st.locs.length > 1) { st.locs = st.locs.slice(0, 1); load(); } else if (last) draw(last);
    });
    ctx.on('mgr-d-type', function (t) { st.type = t.getAttribute('data-v'); close(); load(); });
    load();
  } });
})(window);
