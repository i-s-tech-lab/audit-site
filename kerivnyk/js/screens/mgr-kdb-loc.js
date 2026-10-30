(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, X = P.mgrKdb;
  var VIEWS = [['main', 'Головне'], ['effect', 'Чи справді діють дії'], ['work', 'Як іде робота']];

  function href(id, w, v) {
    var q = [];
    if (w && w !== 8) q.push('w=' + w);
    if (v && v !== 'main') q.push('v=' + v);
    return '#/kd/loc/' + encodeURIComponent(id) + (q.length ? '?' + q.join('&') : '');
  }

  function locBar(r, v) {
    return '<div class="mkd-lbar"><a class="mkd-back" href="#/kd' + (r.weeks !== 8 ? '?w=' + r.weeks : '') + '">← Усі локації</a><nav class="mkd-seg" aria-label="Локація">' +
      (r.locations || []).map(function (l) {
        var on = l.id === r.location.id;
        return '<a class="mkd-seg__a' + (on ? ' mkd-seg__a--on' : '') + '" href="' + href(l.id, r.weeks, v) + '"' + (on ? ' aria-current="true"' : '') + '>' + esc(l.name) + '</a>';
      }).join('') + '</nav></div>';
  }
  function views(r, v) {
    return '<nav class="kb-kdrow mkd-views" aria-label="Розділи аналізу">' + VIEWS.map(function (x) {
      var on = x[0] === v;
      return '<a class="kb-kdi' + (on ? ' kb-kdi--on' : '') + '" href="' + href(r.location.id, r.weeks, x[0]) + '"' + (on ? ' aria-current="page"' : '') + '>' + esc(x[1]) + '</a>';
    }).join('') + '</nav>';
  }

  function kpi(label, val, sub, helpKey, cls) {
    return '<div class="kb-kpi' + (cls ? ' ' + cls : '') + '"><span class="kb-kpi__l">' + esc(label) + (helpKey ? X.help(helpKey) : '') + '</span><span class="kb-kpi__v">' + val + '</span>' +
      '<span class="kb-kpi__s">' + sub + '</span></div>';
  }
  function kpis(r) {
    var k = r.kpi || {}, n = k.now || {}, c = k.closed || {}, ta = k.typesAvg || {}, wk = k.week || {}, wl = X.wl(r.weeks), T = r.threshold;
    var d = ta.before != null && ta.after != null ? Math.round((ta.after - ta.before) * 10) / 10 : null;
    return '<div class="kb-kpis">' +
      kpi('Відкрито зараз', String(n.total || 0), (n.open || 0) + ' без плану · ' + (n.relapse || 0) + ' рецидив · ' + (n.observe || 0) + ' на спостереженні', 'mkd.k.now', n.open || n.relapse ? 'kb-kpi--open' : '') +
      kpi('Відкрилось дій ' + wl, String(k.opened || 0), 'у ' + (k.openedDepts || 0) + ' ' + P.plural(k.openedDepts || 0, 'відділі', 'відділах', 'відділах') + ' · з них рецидивів ' + (k.relapses || 0), 'mkd.k.opened') +
      kpi('Закрилось дій ' + wl, String(c.total || 0), '<b class="kb-dn">✓ ' + (c.helped || 0) + '</b> тримається · <b class="kb-part">✓ ' + (c.held_types || 0) + '</b> види нижче · <b class="kb-zr">○ ' + (c.not_needed || 0) + '</b> не потрібно' +
        (c.self_closed ? ' · <b class="kb-dn">✓ ' + c.self_closed + '</b> без участі старшого' : ''), 'mkd.k.closed') +
      kpi('Брак видів дії: до дії → після', ta.before != null ? X.arrow(ta.before, ta.after) : '—',
        ta.n ? (d != null ? '<b class="' + X.dcls(d) + '">(' + X.signed(d) + ' в. п.)</b> ' : '') + 'середнє по ' + ta.n + ' ' + P.plural(ta.n, 'закритій дії', 'закритих діях', 'закритих діях') : 'закритих дій немає', 'mkd.k.types') +
      kpi('Від відкриття до впровадженого плану', esc(X.days(k.daysToPlan)), 'середнє по діях, де план записано', 'mkd.k.days') +
      kpi('Брак цеху за тиждень ' + (wk.start ? X.rng(wk.start, wk.end) : ''), '<span class="' + (wk.rate != null && wk.rate > T ? 'kb-up' : '') + '">' + X.p(wk.rate) + '</span>',
        (wk.deptsOver || 0) + ' ' + P.plural(wk.deptsOver || 0, 'відділ', 'відділи', 'відділів') + ' з ' + (wk.depts || 0) + ' понад норму ' + T + '%', 'mkd.k.week') + '</div>';
  }

  function actChip(a) {
    if (a.phase === 'observe') {
      var t = a.extra ? (a.early ? 'дострокова: чекаємо звичайного розбору' : 'план є, чекаємо звичайного розбору')
        : a.waiting ? 'план є, спостереження з завтра' : a.day ? 'спостереження, день ' + a.day + ' з 14' : 'спостереження почалось, днів з аудитами ще немає';
      return X.chip('obs', '№' + a.no + ' · ' + t);
    }
    if (a.phase === 'relapse') return X.chip('rel', '№' + a.no + ' · рецидив' + (a.relapseDay ? ' ' + X.day(a.relapseDay) : '') + (a.analysis ? ' · аналіз · ' + a.analysis.days + '-й день' : ', новий план не записано'));
    if (a.analysis) return X.chip('open', '№' + a.no + ' · аналіз · ' + a.analysis.days + '-й день' + (a.early ? ' · достроково' : ''));
    return X.chip('open', '№' + a.no + ' · без плану з ' + X.day(a.openedAt) + (a.early ? ' · достроково' : ''));
  }
  function execCard(r) {
    var list = r.exec || [], wl = X.wl(r.weeks);
    var body = list.length ? X.table([['Відділ'], ['Відкриті дії зараз'], ['дій ' + wl, 'kb-r'], ['днів до плану, середнє', 'kb-r kb-hide-m'], ['відповідальний у плані', 'kb-hide-m'],
      ['рецидивів', 'kb-r kb-hide-m'], ['позначено «не потрібно»', 'kb-r kb-hide-m']],
      list.map(function (d) {
        return { cells: [['<b>' + esc(d.name) + '</b>'], ['<span class="kb-chips">' + ((d.actives || []).map(actChip).join('') || X.chip('none', 'дій немає')) + '</span>'],
          ['<b>' + (d.count || 0) + '</b>', 'kb-r'], [X.n1(d.daysToPlan), 'kb-r kb-hide-m'], [esc((d.who || []).join(', ') || '—'), 'kb-hide-m'],
          ['<span class="' + (d.relapses ? 'kb-up' : '') + '">' + (d.relapses || 0) + '</span>', 'kb-r kb-hide-m'], [d.notNeeded || 0, 'kb-r kb-hide-m']] };
      }), 'mkd-t--exec', 'Як виконуються роботи по відділах') : X.none('Відділів немає.');
    return X.card('Як виконуються роботи по відділах', 'mkd.exec', 'дії, відкриті хоч один день ' + wl, body);
  }

  var HS = { open: 'mkd-hs--open', observe: 'mkd-hs--obs', relapse: 'mkd-hs--rel', wait: 'mkd-hs--wait' };
  var HSW = { open: 'дія без плану', observe: 'на спостереженні', relapse: 'рецидив', wait: 'дострокова: до звичайного розбору' };
  function heatCard(r) {
    var h = r.heat || { weeks: [], rows: [] }, T = r.threshold, ws = h.weeks || [], n = ws.length;
    if (!n || !(h.rows || []).length) return X.card('Брак відділів по тижнях і стан дій', 'mkd.heat', '', X.none('Даних по тижнях немає.'));
    var mob = function (i) { return i < n - 4 ? ' kb-hide-m' : ''; };   // на телефоні — 4 останні тижні
    var head = '<span class="kb-cs mkd-heat__c0">Відділ</span>' + ws.map(function (w, i) { return '<span class="kb-cs mkd-heat__w' + mob(i) + '">' + X.day(w.start) + (w.current ? ' · іде' : '') + '</span>'; }).join('');
    var rows = h.rows.map(function (d) {
      return '<b class="mkd-heat__n">' + esc(d.name) + '</b>' + (d.cells || []).map(function (c, i) {
        var bg = c.rate == null ? 'mkd-hc--none' : c.rate > T ? 'mkd-hc--hot' : c.rate > T - 1 ? 'mkd-hc--mid' : 'mkd-hc--ok';
        return '<span class="mkd-hc ' + bg + (ws[i] && ws[i].current ? ' mkd-hc--cur' : '') + mob(i) + '" title="' + esc(d.name + ' · ' + X.rng(ws[i].start, ws[i].end) + ' · ' + X.p(c.rate) + (c.state ? ' · ' + HSW[c.state] : '')) + '">' +
          '<b>' + X.p(c.rate) + '</b><i class="mkd-hs ' + (HS[c.state] || '') + '"></i></span>';
      }).join('');
    }).join('');
    var body = '<div class="mkd-heat" style="--n:' + n + ';--nm:' + Math.min(4, n) + '" role="table" aria-label="Брак відділів по тижнях">' + head + rows + '</div>' +
      X.legend([['<i class="kb-sw mkd-hc--hot"></i>', 'понад норму ' + T + '%'], ['<i class="kb-sw mkd-hc--mid"></i>', (T - 1) + '–' + T + '%'], ['<i class="kb-sw mkd-hc--ok"></i>', 'до ' + (T - 1) + '%'],
        ['<i class="kb-sw mkd-hs--open"></i>', 'дія без плану'], ['<i class="kb-sw mkd-hs--wait"></i>', 'дострокова: до звичайного розбору'], ['<i class="kb-sw mkd-hs--obs"></i>', 'на спостереженні'], ['<i class="kb-sw mkd-hs--rel"></i>', 'рецидив']]);
    return X.card('Брак відділів по тижнях і стан дій', 'mkd.heat', '', body, '', 'клітинка — брак відділу за тиждень, %; смужка внизу — у якому стані була дія того тижня');
  }

  function notNeededCard(r) {
    var list = r.notNeeded || [], wl = X.wl(r.weeks);
    var body = list.length ? '<div class="mkd-nn">' + list.map(function (a) {
      return '<div class="mkd-nn__i"><span class="mkd-nn__h"><b>' + esc(a.departmentName + ' №' + a.no + ' · дія від ' + X.day(a.openedAt)) + '</b>' + X.chip('skip', '○ не потрібно · ' + X.day(a.finishedOn)) + '</span>' +
        '<span class="kb-cs">Причина, яку написав старший: ' + esc(a.reason || '—') + '</span></div>';
    }).join('') + '</div>' : '<div class="mkd-nn__i mkd-nn__i--none"><b>Позначено «Не потрібно»</b> <span class="kb-cs">— ' + wl + ' не було.</span></div>';
    return X.card('Дії, закриті без впровадженого плану', 'mkd.notNeeded', '', body, '', 'старший позначив «не потрібно» і написав причину');
  }

  function selfClosedCard(r) {
    var list = r.selfClosed || [], wl = X.wl(r.weeks);
    var body = list.length ? '<div class="mkd-nn">' + list.map(function (a) {
      return '<div class="mkd-nn__i"><span class="mkd-nn__h"><b>' + esc(a.departmentName + ' №' + a.no + ' · дія від ' + X.day(a.openedAt)) + '</b>' + X.chip('done', '✓ без участі старшого · ' + X.day(a.finishedOn)) + '</span>' +
        '<span class="kb-cs">Види браку в дії: ' + X.arrow(a.typesBefore, a.typesAfter) + ' · брак відділу ' + X.p(a.deptRate) + ' · перевірено ' + X.num(a.checked) + ' шт за ' + esc(X.rng(a.from, a.to)) + '</span>' +
        (a.types && a.types.length ? '<span class="kb-cs">' + esc(a.types.join(' · ')) + '</span>' : '') + '</div>';
    }).join('') + '</div>' : '<div class="mkd-nn__i mkd-nn__i--none"><b>Без участі старшого</b> <span class="kb-cs">— ' + wl + ' не закривалось.</span></div>';
    return X.card('Закрито без участі старшого', 'mkd.selfClosed', '', body, '', 'старший не почав аналіз і не записав план, а брак упав — дія закрилась сама');
  }

  var CZ = [['helped', 'mkd-o1', 'тримається'], ['held_types', 'mkd-o2', 'її види нижче'], ['relapse', 'mkd-cz--rel', 'рецидив'], ['running', 'mkd-cz--run', 'ще йде']];
  function causesCard(r) {
    var c = r.causes || { items: [] }, items = c.items || [], max = Math.max.apply(null, items.map(function (x) { return x.count; }).concat([1]));
    var body = items.length ? '<div class="mkd-cz">' + items.map(function (x) {
      var o = x.outcomes || {};
      return '<span>' + esc(X.cause(x.id, x.label)) + '</span><span class="mkd-cz__trk"><span class="mkd-cz__bar" style="--w:' + (x.count / max * 100).toFixed(1) + '%">' +
        CZ.filter(function (k) { return o[k[0]]; }).map(function (k) { return '<i class="' + k[1] + '" style="--w:' + (o[k[0]] / x.count * 100).toFixed(1) + '%" title="' + esc(k[2] + ' — ' + o[k[0]]) + '"></i>'; }).join('') +
        '</span></span><b class="kb-r">' + x.count + '</b>';
    }).join('') + '</div>' + X.legend(CZ.map(function (k) { return ['<i class="kb-sw ' + k[1] + '"></i>', k[2]]; }).concat([['', 'довжина — скільки разів причину записали']]))
      : X.none('Планів, впроваджених ' + X.wl(r.weeks) + ', немає.');
    return X.card('Причини браку в планах і чим закінчились ці дії', 'mkd.causes', '', body, '', 'довжина — скільки разів причину записали; колір — результат дії');
  }

  function whoCard(r) {
    var list = r.who || [];
    var body = list.length ? X.table([['Людина · відділ'], ['впроваджених планів', 'kb-r'], ['з них тримається', 'kb-r'], ['з них види нижче', 'kb-r kb-hide-m'], ['з них рецидив', 'kb-r'], ['ще на спостереженні', 'kb-r kb-hide-m']],
      list.map(function (w) {
        return { cells: [['<b>' + esc(w.name) + '</b> · ' + esc(w.departmentName || '')], ['<b>' + (w.plans || 0) + '</b>', 'kb-r'], [w.helped || 0, 'kb-r'], [w.held_types || 0, 'kb-r kb-hide-m'],
          ['<span class="' + (w.relapse ? 'kb-up' : '') + '">' + (w.relapse || 0) + '</span>', 'kb-r'], [w.running || 0, 'kb-r kb-hide-m']] };
      }), '', 'Відповідальні в планах') : X.none('Планів, впроваджених ' + X.wl(r.weeks) + ', немає.');
    return X.card('Відповідальні в планах', 'mkd.who', 'хто записаний відповідальним у впроваджених планах', body);
  }

  function mainView(r) {
    return kpis(r) + X.timeline(r.timeline, r.threshold) +
      '<div class="kb-g2"><div class="kb-col">' + execCard(r) + heatCard(r) + '</div><div class="kb-col">' + X.effCard(r.efficiency, r.weeks) + notNeededCard(r) + selfClosedCard(r) + '</div></div>' +
      '<div class="kb-g2 mkd-g2e">' + causesCard(r) + whoCard(r) + '</div>';
  }
  function platesView(r, list) { return '<div class="mkd-plates">' + list.map(function (f) { return f(r); }).join('') + '</div>'; }

  P.cab.screen('/kd/loc/:id', { tab: 'kd', title: 'Коригуючі дії', period: false,
    share: function (ctx) { return ctx.params && ctx.params.id ? { path: '/kd', query: { loc: ctx.params.id }, label: '«Коригуючі дії» старшого · ця локація', period: false } : null; },
    render: function (ctx) {
    var id = ctx.params.id, w = X.weeks(ctx.query), q = ctx.query || {};
    var v = q.v === 'effect' || q.v === 'work' ? q.v : 'main';
    X.bind(ctx, id);
    ctx.on('retry', function () { ctx.reload(); });
    P.srv('mgrKdLoc', { locationId: id, weeks: w }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) {
        ctx.el.innerHTML = r.code === 'not_found' ? '<section class="card">' + P.sr.h.empty('Такої локації немає', 'Адреса веде на локацію, якої немає в списку.') +
          '<p class="mkd-center"><a class="btn btn--secondary btn--sm" href="#/kd">Усі локації</a></p></section>' : P.sr.h.error(r);
        return;
      }
      var X2 = X.plates;
      var inner = v === 'effect' ? platesView(r, [X2.p1, X2.p2, X2.p3, X2.p4]) : v === 'work' ? platesView(r, [X2.p5, X2.p6, X2.p7, X2.p8, X2.p9]) : mainView(r);
      if (X.kdWait(r)) { ctx.el.innerHTML = '<div class="kb mkd">' + locBar(r, v) + X.kdFromNote(r) + '</div>'; return; }
      ctx.el.innerHTML = '<div class="kb mkd">' + locBar(r, v) + X.periodBar(r, function (n) { return href(id, n, v); }) + X.kdFromNote(r) +
        '<h1 class="mkd-h1">' + esc(r.location.name) + ' · коригуючі дії</h1>' + views(r, v) + inner + '</div>';
      X.fitSegs(ctx.el);
    });
  } });
})(window);
