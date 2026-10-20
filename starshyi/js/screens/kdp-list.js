(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, K = P.srKd, B = K.board, X = K.pages;
  var FILTERS = [['open', 'Без плану', 'open'], ['relapse', 'Рецидив', 'rel'], ['observe', 'На спостереженні', 'obs'],
    ['helped', 'Закрито: тримається', 'helped'], ['held_types', 'Закрито: її види нижче', 'held'], ['not_needed', 'Не потрібно', 'skip'], ['not_helped', 'Закрито: рецидив', 'rel']];
  var TAGS = [['early', 'достроково'], ['parallel', 'паралельна'], ['repeat', 'повторна після рецидиву']];

  P.sr.screen('/kd/list', { tab: 'kd', title: 'Коригуючі дії — список дій', period: false, render: function (ctx) {
    var q = ctx.query || {}, data = null, req = 0;
    var st = { dep: q.dep || '', st: q.st || 'all', w: X.weeksOf(q.w) };
    B.bind(ctx, null);
    ctx.on('kdp-dep', function (t) { st.dep = t.getAttribute('data-id') || ''; X.sync('list', st); draw(); });
    ctx.on('kdp-st', function (t) { st.st = t.getAttribute('data-v') || 'all'; X.sync('list', st); draw(); });
    ctx.on('kdp-w', function (t) { st.w = X.weeksOf(t.getAttribute('data-v')); X.sync('list', st); load(); });
    load();

    function load() {
      var my = ++req;
      if (data) ctx.el.classList.add('kd-busy');
      P.srv('srKdListBoard', { locationId: ctx.loc.id, weeks: st.w }).then(function (r) {
        if (!ctx.alive() || my !== req) return;
        ctx.el.classList.remove('kd-busy');
        if (!r.ok) { data = null; ctx.el.innerHTML = '<div class="kb">' + P.sr.h.error(r) + '</div>'; return; }
        data = r;
        if (st.dep && !(r.tiles || []).some(function (d) { return d.departmentId === st.dep; })) { st.dep = ''; X.sync('list', st); }
        if (st.st !== 'all' && !FILTERS.some(function (f) { return f[0] === st.st; })) { st.st = 'all'; X.sync('list', st); }
        draw();
      });
    }
    function draw() {
      var r = data;
      if (!r) return;
      ctx.el.innerHTML = '<div class="kb kdp">' + X.top(r, 'list', st) + listCard(r, st, ctx.loc) + '</div>';
      X.adapt(ctx, 'list', st);
      X.fit(ctx.el);
    }
  } });

  function rowsOf(r, dep) { return (r.rows || []).filter(function (x) { return !dep || x.departmentId === dep; }); }
  function countsOf(rows) {
    var c = { all: rows.length };
    FILTERS.forEach(function (f) { c[f[0]] = 0; });
    rows.forEach(function (x) { c[x.state] = (c[x.state] || 0) + 1; });
    return c;
  }
  function filters(c, cur) {
    var chip = function (v, label, dot, n) {
      return '<button type="button" class="kdp-fc' + (v === cur ? ' kdp-fc--on' : '') + (n ? '' : ' kdp-fc--off') + '" data-act="kdp-st" data-v="' + v + '" aria-pressed="' + (v === cur) + '">' +
        (dot ? '<i class="kb-dot kdp-dot--' + dot + '"></i>' : '') + esc(label) + ' <b>' + n + '</b></button>';
    };
    return '<div class="kdp-fl" role="group" aria-label="Стан дії"><span class="kb-cs">Стан</span>' + chip('all', 'Усі', '', c.all) +
      FILTERS.filter(function (f) { return f[0] !== 'not_helped' || c.not_helped || cur === 'not_helped'; }).map(function (f) { return chip(f[0], f[1], f[2], c[f[0]] || 0); }).join('') + '</div>';
  }
  function typeNames(names) {
    names = names || [];
    return names.length > 3 ? names.slice(0, 2).join(' · ') + ' · ще ' + (names.length - 2) : names.join(' · ');
  }
  function row(x, r) {
    var tg = TAGS.filter(function (t) { return x.tags && x.tags[t[0]]; }).map(function (t) { return ' <span class="kb-cs">· ' + t[1] + '</span>'; }).join('');
    var ty = x.types || {}, T = r.threshold, closed = x.group === 'closed';
    var name = x.departmentName + ' №' + x.no;
    return '<a class="kdp-lt__r" href="' + B.href(x.departmentId, x.key) + '" aria-label="' + esc('Відкрити ' + name) + '">' +
      '<span class="kdp-lt__n"><span><b>' + esc(name) + '</b>' + tg + '</span>' +
        '<span class="kb-cs">відкрито <b class="kdp-ink">' + esc(B.wd(x.openedAt)) + '</b> · ' + K.plural(ty.count || 0, 'вид', 'види', 'видів') + ' · ' + B.num(ty.pieces || 0) + ' шт</span>' +
        (ty.names && ty.names.length ? '<span class="kb-cs">' + esc(typeNames(ty.names)) + '</span>' : '') + '</span>' +
      '<span class="kdp-lt__s">' + X.strip(x, r.scale) + X.ml('хід дії ' + B.day(r.scale.from) + ' — ' + B.day(r.scale.to)) + '</span>' +
      '<span class="kb-r">' + X.ml(closed ? 'види дії: на початку → після' : 'види дії: на початку → зараз') + X.typesPair(x.typesStart, x.typesNow, x.typesNowPartial) + '</span>' +
      '<span class="kb-r">' + X.ml(closed ? 'брак відділу: тиждень дії → після' : 'брак відділу: тиждень дії → зараз') + X.deptPair(x.deptStart, x.deptNow, x.deptNowPartial, T) + '</span>' +
      '<span class="kdp-lt__st">' + X.stateChip(x) + (closed && x.finishedOn ? '<span class="kb-cs">закрито ' + B.day(x.finishedOn) + '</span>' : '') +
        (x.relapseDay && !closed ? '<span class="kb-cs">рецидив ' + B.day(x.relapseDay) + '</span>' : '') + '</span></a>';
  }
  function listCard(r, st, loc) {
    var all = rowsOf(r, st.dep), c = countsOf(all), dep = st.dep ? (r.tiles || []).filter(function (d) { return d.departmentId === st.dep; })[0] : null;
    var rows = all.filter(function (x) { return st.st === 'all' || x.state === st.st; });
    var act = rows.filter(function (x) { return x.group === 'active'; }), cl = rows.filter(function (x) { return x.group === 'closed'; });
    var sc = r.scale || { weeks: [] };
    var head = '<span class="kdp-lt__h"><span>Дія · коли відкрито · види браку в дії</span><span>Хід дії по тижнях' + X.weekHead(sc.weeks || []) + '</span>' +
      '<span class="kb-r">брак видів дії: на початку → зараз / після</span><span class="kb-r">брак відділу: тиждень дії → зараз / після</span><span>Стан</span></span>';
    var none = !all.length ? (dep ? 'У відділі «' + dep.name + '» дій немає: зараз у роботі немає, за ' + X.weeksLabel(st.w) + ' нічого не закрито.' : 'Дій немає: зараз у роботі немає, за ' + X.weeksLabel(st.w) + ' нічого не закрито.')
      : !rows.length ? 'Дій у цьому стані немає.' : '';
    var body = none ? '<p class="kb-cs kdp-none">' + esc(none) + '</p>' :
      '<div class="kb-scroll"><div class="kdp-lt" role="table" aria-label="' + esc('Коригуючі дії · ' + (dep ? dep.name : loc.name)) + '" style="--n:' + (sc.weeks || []).length + '">' + head +
        (act.length ? '<span class="kdp-lsec">ЗАРАЗ У РОБОТІ · ' + act.length + '</span>' + act.map(function (x) { return row(x, r); }).join('') : '') +
        (cl.length ? '<span class="kdp-lsec">ЗАКРИТО ЗА ' + X.weeksLabel(st.w).toUpperCase() + ' · ' + cl.length + '</span>' + cl.map(function (x) { return row(x, r); }).join('') : '') +
        '</div></div>' + X.stripLegend(rows);
    var title = (dep ? 'Дії відділу «' + dep.name + '»' : 'Усі дії · ' + loc.name) + ' · ' + c.all;
    return B.card(title, 'kd.l.list', 'натисніть рядок — сторінка цієї дії',
      '<div class="kdp-bar">' + filters(c, st.st) + X.weeksSwitch('Закриті за', st.w, esc(X.span(r.from, r.to)) + ' · відкриті дії видно завжди') + '</div>' + body);
  }
})(window);
