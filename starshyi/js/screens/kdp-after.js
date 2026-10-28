(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, K = P.srKd, B = K.board, X = K.pages;
  var D1 = 'дні 1–7 після плану', D2 = 'дні 8–14 після плану';

  P.sr.screen('/kd/stats', { tab: 'kd', title: 'Коригуючі дії — що після дій', period: false, render: function (ctx) {
    var q = ctx.query || {}, data = null, req = 0;
    var st = { dep: q.dep || '', w: X.weeksOf(q.w) };
    B.bind(ctx, null);
    ctx.on('kdp-dep', function (t) { st.dep = t.getAttribute('data-id') || ''; X.sync('after', st); draw(); });
    ctx.on('kdp-w', function (t) { st.w = X.weeksOf(t.getAttribute('data-v')); X.sync('after', st); load(); });
    load();

    function load() {
      var my = ++req;
      if (data) ctx.el.classList.add('kd-busy');
      P.srv('srKdAfter', { locationId: ctx.loc.id, weeks: st.w }).then(function (r) {
        if (!ctx.alive() || my !== req) return;
        ctx.el.classList.remove('kd-busy');
        if (!r.ok) { data = null; ctx.el.innerHTML = '<div class="kb">' + P.sr.h.error(r) + '</div>'; return; }
        data = r;
        if (st.dep && !(r.departments || []).some(function (d) { return d.id === st.dep; })) { st.dep = ''; X.sync('after', st); }
        draw();
      });
    }
    function draw() {
      var r = data;
      if (!r) return;
      var items = (r.items || []).filter(function (x) { return !st.dep || x.departmentId === st.dep; });
      var w = X.weeksLabel(st.w), n = items.length;
      var per = X.weeksSwitch('Дії, відкриті за', st.w, esc(X.span(r.from, r.to)) + ' · рахуємо ' + B.acts(n) + ', що відкрились за цей час, і що з ними сталось далі');
      var body = n ? '<div class="kb-kpis kdp-kpis">' + kpis(items, w) + '</div>' +
        '<div class="kdp-g2"><div class="kb-col">' + pathCard(items, w) + causesCard(items) + '</div>' + weeksCard(items, r) + '</div>' + slopeCard(items, r.threshold)
        : B.card('Що після дій', '', '', '<p class="kb-cs">' + esc('За ' + w + ' ' + (st.dep ? 'у цьому відділі ' : '') + 'дій не відкривалось.') + '</p>');
      ctx.el.innerHTML = '<div class="kb kdp">' + X.top(r, 'after', st) + per + body + deptCard(r, items, st) + '</div>';
      X.adapt(ctx, 'after', st);
      X.fit(ctx.el);
    }
  } });

  function cnt(list, f) { return list.filter(f).length; }
  function avg(list) { return list.length ? Math.round(list.reduce(function (s, v) { return s + v; }, 0) / list.length * 10) / 10 : null; }
  function resultOf(x) {
    if (x.week1 === 'relapse' || x.week2 === 'relapse') return 'relapse';
    if (x.week1 === 'wait') return 'wait';
    if (x.week2 === 'helped' || x.week2 === 'held_types') return x.week2;
    if (x.week1 === 'running' || x.week2 === 'running') return 'running';
    return x.planned ? 'wait' : 'none';
  }
  function afterOf(x) { return x.after2 != null ? x.after2 : x.after1; }
  function closedBA(list) { return list.filter(function (x) { return (x.week2 === 'helped' || x.week2 === 'held_types') && x.before != null && afterOf(x) != null; }); }
  function baText(list) {
    var b = avg(list.map(function (x) { return x.before; })), a = avg(list.map(afterOf));
    if (b == null || a == null) return null;
    var d = Math.round((a - b) * 10) / 10;
    return { v: B.p(b) + ' → ' + B.p(a), d: '<b class="' + (d < 0 ? 'kb-dn' : d > 0 ? 'kb-up' : 'kb-zr') + '">(' + (d > 0 ? '+' : d < 0 ? '−' : '') + B.n1(Math.abs(d)) + ' в. п.)</b>', b: b, a: a };
  }
  function parts(list) { return list.filter(function (p) { return p[0]; }).map(function (p) { return p[1]; }).join(' · '); }

  function kpis(items, w) {
    var planned = items.filter(function (x) { return x.planned; });
    var days = avg(planned.filter(function (x) { return x.daysToPlan != null; }).map(function (x) { return x.daysToPlan; }));
    var dLabel = days == null ? '' : days % 1 ? B.n1(days) + ' дня' : K.plural(days, 'день', 'дні', 'днів');
    var w1 = function (v) { return cnt(planned, function (x) { return x.week1 === v; }); };
    var d1 = w1('norm') + w1('types_lower') + w1('relapse');
    var base2 = items.filter(function (x) { return x.week1 === 'norm' || x.week1 === 'types_lower'; });
    var w2 = function (v) { return cnt(base2, function (x) { return x.week2 === v; }); };
    var d2 = w2('helped') + w2('held_types') + w2('relapse'), early2 = cnt(base2, function (x) { return x.week2 === 'helped' && x.closedEarly; });
    var rel = items.filter(function (x) { return resultOf(x) === 'relapse'; }), ba = baText(closedBA(items));
    var going = function (n) { return n ? (n === 1 ? '1 — дні ще йдуть' : n + ' — дні ще йдуть') : ''; };
    return X.kpi('Відкрилось дій за ' + w, String(items.length), esc(parts([[1, 'з них достроково ' + cnt(items, function (x) { return x.early; })], [1, 'паралельна ' + cnt(items, function (x) { return x.parallel; })]]))) +
      X.kpi('Записали впроваджений план', planned.length + ' з ' + items.length, dLabel ? 'від відкриття до плану в середньому ' + dLabel : 'плану ще немає в жодної') +
      X.kpi('Дні 1–7 після плану: брак відділу не вище норми', d1 ? w1('norm') + ' з ' + d1 : '—',
        esc(parts([[w1('types_lower'), 'ще ' + w1('types_lower') + ' — її види нижче, ніж до дії'], [w1('relapse'), w1('relapse') + ' рецидив'], [w1('running'), going(w1('running'))], [w1('wait'), w1('wait') + ' — план є, дні ще не почались']]) || (d1 ? '' : 'ще не завершились у жодної дії')), '', 'kd.a.week1') +
      X.kpi('Дні 8–14 після плану: тримається', d2 ? w2('helped') + ' з ' + d2 : '—',
        esc(parts([[early2, 'з них достроково ' + early2], [w2('held_types'), w2('held_types') + ' — її види нижче, ніж до дії'], [w2('relapse'), w2('relapse') + ' рецидив'], [w2('running'), going(w2('running'))]]) || (d2 ? '' : 'ще не завершились у жодної дії')), d2 ? 'kdp-kpi--ok' : '') +
      X.kpi('Рецидивів', String(rel.length), esc(rel.length ? rel.slice(0, 3).map(function (x) { return x.departmentName + ' №' + x.no; }).join(' · ') + (rel.length > 3 ? ' · +' + (rel.length - 3) : '') : 'рецидивів немає'), rel.length ? 'kdp-kpi--bad' : '') +
      X.kpi('Брак видів дії: до дії → після', ba ? ba.v : '—', ba ? ba.d + ' середнє по ' + closedBA(items).length + ' закритих' : 'закритих з результатом ще немає', '', 'kd.a.ba');
  }

  function fbar(list, N) {
    list = list.filter(function (p) { return p[0]; });
    if (!list.length) return '<span class="kb-cs">—</span>';
    return '<span class="kdp-fn__c"><span class="kdp-fbar" role="img" aria-label="' + esc(list.map(function (p) { return p[2] + ' — ' + p[0]; }).join(', ')) + '">' +
      list.map(function (p) { return '<span class="kdp-f--' + p[1] + '" style="--w:' + (p[0] / N * 100).toFixed(2) + '%">' + p[0] + '</span>'; }).join('') + '</span>' +
      '<span class="kdp-fsub">' + list.map(function (p) { return '<span><i class="kb-sw kdp-f--' + p[1] + '"></i>' + esc(p[2]) + ' — <b>' + p[0] + '</b></span>'; }).join('') + '</span></span>';
  }
  function frow(title, sub, list, total, N) {
    return '<span><b>' + esc(title) + '</b><br><span class="kb-cs">' + esc(sub) + '</span></span>' + fbar(list, N) + '<b class="kb-r kdp-fn__t">' + total + '</b>';
  }
  function pathCard(items, w) {
    var N = items.length, planned = items.filter(function (x) { return x.planned; });
    var c = function (list, f) { return cnt(list, f); };
    var base2 = items.filter(function (x) { return x.week1 === 'norm' || x.week1 === 'types_lower'; });
    var by = function (list, key, v) { return c(list, function (x) { return x[key] === v; }); };
    var unNeed = c(items, function (x) { return !x.planned && x.final === 'not_needed'; });
    var alone = c(items, function (x) { return !x.planned && x.final === 'self_closed'; });   // 28.10: закрито без участі старшого
    var body = '<div class="kdp-fn">' +
      frow('Відкрилось', 'дії за ' + w, [[planned.length, 'plan', 'план записано'], [N - planned.length - unNeed - alone, 'open', 'без плану зараз'], [unNeed, 'skip', 'не потрібна'],
        [alone, 'done', 'закрито без участі старшого']], N, N) +
      frow('Дні 1–7 після плану', 'з ' + planned.length + ' дій, де план записано', [[by(planned, 'week1', 'norm'), 'w2', 'брак відділу в нормі'], [by(planned, 'week1', 'types_lower'), 'part', 'її види нижче, ніж до дії'],
        [by(planned, 'week1', 'relapse'), 'rel', 'рецидив'], [by(planned, 'week1', 'running'), 'run', 'дні ще йдуть'], [by(planned, 'week1', 'wait') + by(planned, 'week1', null), 'wait', 'план є — дні ще не почались']], planned.length, N) +
      frow('Дні 8–14 після плану', 'з ' + base2.length + ' дій без рецидиву в днях 1–7', [[by(base2, 'week2', 'helped'), 'done', '✓ закрито: тримається'], [by(base2, 'week2', 'held_types'), 'part', '✓ закрито: її види нижче'],
        [by(base2, 'week2', 'relapse'), 'rel', 'рецидив'], [by(base2, 'week2', 'running'), 'run', 'дні ще йдуть'], [by(base2, 'week2', null), 'wait', 'ще не почались']], base2.length, N) + '</div>' +
      '<span class="kb-cs">«Її види нижче» — брак відділу понад норму, але види браку в дії разом нижче, ніж до дії.</span>';
    return B.card('Шлях дій: що сталось після відкриття', 'kd.a.path', 'довжина смуги — частка від ' + B.acts(N), body);
  }

  var RES = [['helped', 'done', 'тримається'], ['held_types', 'part', 'її види нижче'], ['relapse', 'rel', 'рецидив'], ['running', 'run', 'ще йде']];
  function causesCard(items) {
    var map = {}, order = [], plans = 0;
    items.forEach(function (x) {
      if ((x.causes || []).length) plans++;
      var res = resultOf(x), k = res === 'wait' || res === 'none' ? 'running' : res;
      (x.causes || []).forEach(function (c) {
        var id = c.cause || c.causeLabel;
        if (!map[id]) { map[id] = { label: c.causeLabel || id, n: 0, by: {} }; order.push(id); }
        map[id].n++; map[id].by[k] = (map[id].by[k] || 0) + 1;
      });
    });
    var list = order.map(function (id) { return map[id]; }).sort(function (a, b) { return b.n - a.n; }), max = Math.max.apply(null, list.map(function (x) { return x.n; }).concat([1]));
    var total = list.reduce(function (s, x) { return s + x.n; }, 0);
    var body = list.length ? '<div class="kdp-cz">' + list.map(function (x) {
      return '<span>' + esc(x.label) + '</span><span class="kdp-cz__b" style="--w:' + (x.n / max * 100).toFixed(1) + '%" role="img" aria-label="' + esc(x.label + ': ' + RES.filter(function (r) { return x.by[r[0]]; }).map(function (r) { return r[2] + ' — ' + x.by[r[0]]; }).join(', ')) + '">' +
        RES.filter(function (r) { return x.by[r[0]]; }).map(function (r) { return '<i class="kdp-f--' + r[1] + '" style="--w:' + (x.by[r[0]] / x.n * 100).toFixed(1) + '%"></i>'; }).join('') + '</span><b class="kb-r">' + x.n + '</b>';
    }).join('') + '</div>' + B.legend(RES.map(function (r) { return ['<i class="kb-sw kdp-f--' + r[1] + '"></i>', r[2]]; }).concat([['', 'довжина — скільки разів причину записали']]))
      : '<p class="kb-cs">Планів із причинами за цей час немає.</p>';
    return B.card('Причини браку в планах і чим закінчились ці дії', 'kd.a.causes', list.length ? K.plural(total, 'причина', 'причини', 'причин') + ' у ' + K.plural(plans, 'плані', 'планах', 'планах') : '', body);
  }

  var NOW = [['open', 'open', 'без плану'], ['w1', 'plan', D1], ['w2', 'w2', D2], ['wait', 'wait', 'план є — дні ще не почались'], ['relapse', 'rel', 'рецидив'],
    ['helped', 'done', 'тримається'], ['held_types', 'part', 'її види нижче'], ['not_needed', 'skip', 'не потрібна'], ['self_closed', 'done', 'без участі старшого']];
  function nowOf(x) {
    if (x.final === 'observe') {
      if (x.finalWaiting) return 'wait';
      if (x.finalWeek === 2 || x.finalWeek === 1) return x.finalWeek === 2 ? 'w2' : 'w1';
      return x.week2 === 'running' ? 'w2' : x.week1 === 'running' ? 'w1' : 'wait';
    }
    return x.final === 'not_helped' ? 'relapse' : x.final;
  }
  function weeksCard(items, r) {
    var cur = r.week ? K.addDays(r.week.end, 1) : r.today, bins = [];
    for (var s = cur; K.addDays(s, 6) >= r.from; s = K.addDays(s, -7)) bins.unshift({ start: s > r.from ? s : r.from, end: K.addDays(s, 6), current: s === cur, list: [] });
    items.forEach(function (x) { bins.forEach(function (b) { if (x.openedAt >= b.start && x.openedAt <= b.end) b.list.push(x); }); });
    var max = Math.max.apply(null, bins.map(function (b) { return b.list.length; }).concat([1])), unit = Math.min(52, 120 / max), used = {};
    var cols = bins.map(function (b) {
      var by = {};
      b.list.forEach(function (x) { var k = nowOf(x); by[k] = (by[k] || 0) + 1; used[k] = 1; });
      var keys = NOW.map(function (n) { return n[0]; }).filter(function (k) { return by[k]; }).concat(Object.keys(by).filter(function (k) { return !NOW.some(function (n) { return n[0] === k; }); }));
      var bars = keys.reverse().map(function (k) { var n = NOW.filter(function (z) { return z[0] === k; })[0]; return '<i class="kdp-f--' + (n ? n[1] : 'other') + '" style="--h:' + Math.max(2, by[k] * unit - 2).toFixed(0) + 'px"></i>'; }).join('');
      return '<div class="kdp-ow__c"><b>' + (b.list.length || '') + '</b>' + (bars || '<i class="kdp-ow__0"></i>') + '</div>';
    }).join('');
    var labels = bins.map(function (b) { var t = esc(B.day(b.start) + (b.current ? ' · іде' : '')); return '<span' + (b.current ? ' class="kb-tl__cur"' : '') + ' data-s="' + (b.current ? 'іде' : t) + '">' + t + '</span>'; }).join('');
    var aria = bins.filter(function (b) { return b.list.length; }).map(function (b) { return B.day(b.start) + ' — ' + b.list.length; }).join(', ');
    var body = '<div class="kdp-ow" role="img" aria-label="' + esc('Дії за тижнем відкриття: ' + (aria || 'немає')) + '">' + cols + '</div><div class="kdp-ow__x" data-kdp-wk>' + labels + '</div>' +
      B.legend(NOW.filter(function (n) { return used[n[0]]; }).map(function (n) { return ['<i class="kb-sw kdp-f--' + n[1] + '"></i>', n[2]]; }));
    return B.card('Дії за тижнем відкриття і що з ними зараз', 'kd.a.byweek', 'висота — скільки дій відкрилось; колір — стан сьогодні', body);
  }

  function slope(x, T) {
    var q = x.closedEarly && x.after2 == null;
    var t = [x.before, x.after1, q ? x.quiet : x.after2], d = [x.deptBefore, x.deptAfter1, q ? x.deptQuiet : x.deptAfter2], px = [10, 64, 118];
    var mx = Math.max.apply(null, t.concat(d, [T + 1]).filter(function (v) { return v != null; })) * 1.1, Y = function (v) { return 38 - v / mx * 34; };
    var line = function (vals, cls, r) {
      var pts = vals.map(function (v, i) { return v == null ? null : [px[i], Y(v)]; }).filter(Boolean);
      return '<polyline class="' + cls + '" points="' + pts.map(function (p) { return p[0] + ',' + p[1].toFixed(1); }).join(' ') + '"></polyline>' +
        pts.map(function (p) { return '<circle class="' + cls + '-p" cx="' + p[0] + '" cy="' + p[1].toFixed(1) + '" r="' + r + '"></circle>'; }).join('');
    };
    return '<svg class="kdp-sl__g" viewBox="0 0 128 42" role="img" aria-label="' + esc('Види дії: ' + t.filter(function (v) { return v != null; }).map(B.p).join(' → ') + '; брак відділу: ' + d.filter(function (v) { return v != null; }).map(B.p).join(' → ')) + '">' +
      '<line class="kdp-sl__n" x1="0" x2="128" y1="' + Y(T).toFixed(1) + '" y2="' + Y(T).toFixed(1) + '"></line>' + line(d, 'kdp-sl__d', 1.8) + line(t, 'kdp-sl__t', 2.6) + '</svg>';
  }
  function cell(v, dv, base, partial, T, label) {
    if (v == null) return X.ml(label) + '<span class="kb-cs">ще не було</span>';
    if (base == null) return X.ml(label) + '<b>' + B.p(v) + '</b><br><span class="kb-cs">відділ ' + B.p(dv) + '</span>';
    return X.ml(label) + (partial ? '<span class="kb-cs">поки </span>' : '') + B.arrow(base, v) + '<br><span class="kb-cs">відділ <b class="' + (dv != null && dv > T ? 'kb-up' : '') + '">' + B.p(dv) + '</b></span>';
  }
  function quietCell(x, T) {
    var l = X.ml(D2);
    if (x.quiet == null) return l + '<span class="kb-cs">тихий нагляд · даних ще немає</span>';
    return l + '<span class="kb-cs">тихий нагляд: ' + (x.quietPartial ? 'поки ' : '') + '</span>' + B.arrow(x.before, x.quiet) +
      '<br><span class="kb-cs">відділ <b class="' + (x.deptQuiet != null && x.deptQuiet > T ? 'kb-up' : '') + '">' + B.p(x.deptQuiet) + '</b></span>';
  }
  function resultChip(x) {
    var r = resultOf(x);
    if (x.closedEarly && (r === 'helped' || r === 'held_types')) return B.chip(r === 'helped' ? 'done' : 'part', '✓ закрито достроково');
    if (r === 'helped') return B.chip('done', '✓ тримається');
    if (r === 'held_types') return B.chip('part', '✓ її види нижче');
    if (r === 'relapse') return B.chip('rel', 'рецидив');
    if (r === 'running' || r === 'wait') return B.chip('obs', esc(X.obsText({ waiting: r === 'wait', week: x.week2 === 'running' ? 2 : 1, day: x.day })));
    if (x.selfClosed) return B.chip('done', '✓ без участі старшого');   // 28.10: плану не було, брак упав сам
    return B.chip('none', 'плану немає');
  }
  function slopeCard(items, T) {
    var list = items.filter(function (x) { return x.planned; }).sort(function (a, b) { return a.openedAt < b.openedAt ? -1 : a.openedAt > b.openedAt ? 1 : 0; });
    var head = '<span class="kdp-sl__h"><span>Дія</span><span>види дії · відділ</span><span>до дії</span><span>' + esc(D1) + '</span><span>' + esc(D2) + '</span><span>результат</span></span>';
    var rows = list.map(function (x) {
      return '<a class="kdp-sl__r" href="' + B.href(x.departmentId, x.key) + '"><span class="kdp-lt__n"><b>' + esc(x.departmentName + ' №' + x.no) + '</b><span class="kb-cs">відкрито ' + B.day(x.openedAt) +
        (x.implementedAt ? ' · план ' + B.day(x.implementedAt) : '') + '</span></span><span>' + slope(x, T) + '</span><span>' + cell(x.before, x.deptBefore, null, false, T, 'до дії') + '</span>' +
        '<span>' + cell(x.after1, x.deptAfter1, x.before, x.after1Partial, T, D1) + '</span><span>' + (x.closedEarly && x.after2 == null ? quietCell(x, T) : cell(x.after2, x.deptAfter2, x.before, x.after2Partial, T, D2)) + '</span><span>' + resultChip(x) + '</span></a>';
    }).join('');
    var body = list.length ? '<div class="kdp-sl" role="table" aria-label="Брак видів дії до і після плану">' + head + rows + '</div>' +
      B.legend([['<i class="kb-ln kb-ln--types"></i>', 'види браку в дії'], ['<i class="kb-ln kdp-ln--dept"></i>', 'брак відділу'], ['<i class="kb-ln kb-ln--norm"></i>', 'норма ' + T + '%'],
        ['<b class="kb-dn">▼</b>', 'менше, ніж до дії'], ['<b class="kb-up">▲</b>', 'більше']])
      : '<p class="kb-cs">Записаного плану ще немає в жодної з цих дій.</p>';
    return B.card('Брак видів дії: до → дні 1–7 → дні 8–14 після плану', 'kd.a.slope', 'дії, де план записано · % від перевірених у відділі', body);
  }

  function deptCard(r, items, st) {
    var T = r.threshold, s0 = r.tiles && r.tiles[0] && r.tiles[0].series && r.tiles[0].series[0];
    var deps = (r.departments || []).filter(function (d) { return !st.dep || d.id === st.dep; });
    var num = function (n, cls) { return n ? '<b class="' + cls + '">' + n + '</b>' : '0'; };
    var head = '<span class="kdp-dt__h"><span>Відділ</span><span class="kb-r">дій за ' + esc(X.weeksLabel(st.w)) + '</span><span class="kb-r">зараз без плану</span><span class="kb-r">на спостереженні</span><span class="kb-r">був рецидив (з усіх дій)</span>' +
      '<span class="kb-r">закрито: тримається</span><span class="kb-r">закрито: її види нижче</span><span class="kb-r">не потрібна</span><span class="kb-r">брак видів дії: до → після, середнє закритих</span>' +
      '<span>брак відділу по тижнях' + (s0 ? ' з ' + B.day(s0.start) : '') + '</span></span>';
    var rows = deps.map(function (d) {
      var my = items.filter(function (x) { return x.departmentId === d.id; }), ba = baText(closedBA(my));
      var c = function (f) { return cnt(my, f); };
      var cells = [['дій', '<b>' + my.length + '</b>'], ['зараз без плану', num(c(function (x) { return x.final === 'open'; }), 'kb-up')], ['на спостереженні', num(c(function (x) { return x.final === 'observe'; }), 'kb-blue')],
        ['був рецидив (з усіх дій)', num(c(function (x) { return resultOf(x) === 'relapse'; }), 'kb-up')], ['закрито: тримається', String(c(function (x) { return x.week2 === 'helped'; }))],
        ['закрито: її види нижче', String(c(function (x) { return x.week2 === 'held_types'; }))], ['не потрібна', String(c(function (x) { return !x.planned && x.final === 'not_needed'; }))],
        ['до → після', ba ? B.arrow(ba.b, ba.a) : '<span class="kb-cs">закритих немає</span>']];
      return '<span class="kdp-dt__r"><a class="kdp-dt__a" href="' + X.url('list', { dep: d.id, w: st.w }) + '">' + esc(d.name) + '</a>' +
        cells.map(function (x) { return '<span class="kb-r">' + X.ml(x[0]) + x[1] + '</span>'; }).join('') +
        '<span>' + X.ml('брак відділу по тижнях') + X.spark((r.series || {})[d.id], T, d.name) + '</span></span>';
    }).join('');
    return B.card('Що після дій — по відділах', 'kd.a.depts', 'натисніть відділ — його дії у «Списку дій»',
      '<div class="kdp-dt" role="table" aria-label="Що після дій по відділах">' + head + (rows || '<p class="kb-cs">Відділів немає.</p>') + '</div>');
  }
})(window);
