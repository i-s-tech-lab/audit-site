(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, X = P.mgrKdb;

  function locHref(id, w) { return '#/kd/loc/' + encodeURIComponent(id) + (w && w !== 8 ? '?w=' + w : ''); }
  function nowChips(n) {
    n = n || {};
    return (n.open ? X.chip('open', n.open + ' без плану') : '') + (n.relapse ? X.chip('rel', n.relapse + ' рецидив') : '') +
      (n.observe ? X.chip('obs', n.observe + ' на спостереженні') : '') || X.chip('none', 'зараз дій немає');
  }

  function locCard(l, r) {
    var T = r.threshold, wl = X.wl(r.weeks), c = l.closed || {}, ta = l.typesAvg || {}, s = l.series || [];
    var cur = s.filter(function (x) { return x.current; })[0], done = s.filter(function (x) { return !x.current; }).length;
    return '<a class="mkd-lc" href="' + locHref(l.id, r.weeks) + '"><span class="mkd-lc__h"><b>' + esc(l.name) + '</b><span class="mkd-lc__go">відкрити аналіз ›</span></span>' +
      '<span class="mkd-lc__v"><b>' + ((l.now && l.now.total) || 0) + '</b><span class="kb-cs">відкритих дій зараз</span></span>' +
      '<span class="kb-chips">' + nowChips(l.now) + '</span>' +
      '<span class="mkd-lc__sec"><span class="mkd-lc__row"><span>Закрилось ' + wl + ': <b>' + (c.total || 0) + '</b> · відкрилось: <b>' + (l.opened || 0) + '</b></span>' +
      '<span class="kb-cs">рецидивів ' + wl + ': <b class="' + (l.relapses ? 'kb-up' : '') + '">' + (l.relapses || 0) + '</b></span></span>' + X.outBar(c) + X.outLegend(c) + '</span>' +
      '<span class="mkd-lc__two"><span class="mkd-mini"><span class="kb-cs">брак видів дії: до дії → після (середнє закритих)</span><span class="mkd-mini__v">' + X.arrow(ta.before, ta.after) + '</span></span>' +
      '<span class="mkd-mini"><span class="kb-cs">від відкриття до впровадженого плану, середнє</span><span class="mkd-mini__v"><b>' + X.days(l.daysToPlan) + '</b></span></span></span>' +
      '<span class="mkd-lc__sec"><span class="mkd-lc__row mkd-lc__row--sm"><span class="kb-cs">брак цеху, % по тижнях, останні ' + done + ' ' + P.plural(done, 'тиждень', 'тижні', 'тижнів') + ' і поточний</span>' +
      '<span>тиждень, що йде: <b class="' + (cur && cur.rate != null && cur.rate > T ? 'kb-up' : '') + '">' + X.p(cur ? cur.rate : null) + '</b></span></span>' + X.spark(s, T, l.name) + '</span></a>';
  }

  function compareCard(r) {
    var wl = X.wl(r.weeks), head = [['Локація'], ['відкрилось дій', 'kb-r'], ['закрилось дій', 'kb-r'], ['з них тримається', 'kb-r kb-hide-m'], ['з них види нижче, ніж до дії', 'kb-r kb-hide-m'],
      ['з них «не потрібно»', 'kb-r kb-hide-m'], ['з них без участі старшого', 'kb-r kb-hide-m'], ['рецидивів', 'kb-r kb-hide-m'], ['брак видів дії: до → після, середнє', 'kb-r'], ['днів до плану, середнє', 'kb-r kb-hide-m']];
    var rows = r.locations.map(function (l) {
      var c = l.closed || {}, ta = l.typesAvg || {};
      return { cells: [['<a class="mkd-link" href="' + locHref(l.id, r.weeks) + '">' + esc(l.name) + '</a>'], [l.opened || 0, 'kb-r'], ['<b>' + (c.total || 0) + '</b>', 'kb-r'],
        [c.helped || 0, 'kb-r kb-hide-m'], [c.held_types || 0, 'kb-r kb-hide-m'], [c.not_needed || 0, 'kb-r kb-hide-m'], [c.self_closed || 0, 'kb-r kb-hide-m'],
        ['<span class="' + (l.relapses ? 'kb-up' : '') + '">' + (l.relapses || 0) + '</span>', 'kb-r kb-hide-m'], [X.arrow(ta.before, ta.after), 'kb-r kb-nw'], [X.n1(l.daysToPlan), 'kb-r kb-hide-m']] };
    });
    return X.card('Порівняння локацій ' + wl, 'mkd.compare', 'рахуємо дії, що відкрились або закрились з ' + X.day(r.from) + ' по ' + X.day(r.to),
      X.table(head, rows, 'mkd-t--cmp', 'Порівняння локацій'));
  }

  function streakCard(r) {
    var list = r.streaks || [];
    var body = list.length ? X.table([['Локація · відділ'], ['номер останньої дії', 'kb-r'], ['дії без перерви з', 'kb-r'], ['рецидивів за цей час', 'kb-r'], ['відкритих дій зараз', 'kb-r kb-hide-m']],
      list.map(function (s) {
        return { cells: [['<b>' + esc(s.locationName) + '</b> · ' + esc(s.departmentName)], ['<b class="mkd-big">№' + s.no + '</b>', 'kb-r'], ['з ' + X.day(s.since), 'kb-r kb-nw'],
          ['<span class="' + (s.relapses ? 'kb-up' : '') + '">' + (s.relapses || 0) + '</span>', 'kb-r'], [s.activeNow || 0, 'kb-r kb-hide-m']] };
      }), '', 'Відділи, де дії йдуть одна за одною') : X.none('Таких відділів немає: у кожному відділі між діями були дні без відкритих дій.');
    return X.card('Відділи, де дії йдуть одна за одною', 'mkd.streaks', '', body + (list.length ? X.foot('Номер скидається на 1, коли у відділі був хоч один день без жодної відкритої дії. Великий номер — дії в цьому відділі йдуть одна за одною.') : ''),
      '', '№ = скільки дій у відділі підряд без жодного дня перерви');
  }

  function lastText(l) {
    if (!l) return '—';
    if (l.phase === 'final') return X.OUT[l.status] || '—';
    if (l.phase === 'observe') return l.waiting ? 'план є, спостереження ще не почалось' : (l.week === 2 ? 'дні 8–14' : 'дні 1–7') + ' після плану';
    return l.phase === 'relapse' ? 'рецидив' : 'без плану';
  }
  function returningCard(r) {
    var list = r.returning || [];
    var mr = X.more(list.map(function (t) {
        return { cells: [['<span class="mkd-nm"><b>' + esc(t.name) + '</b><span class="mkd-lvl">' + X.lvlDot(t.level) + esc(X.LV_WORD[t.level] || '') + '</span>' +
            '<span class="kb-cs mkd-only-m">' + esc(t.locationName + ' · ' + t.departmentName) + '</span></span>'],
          [esc(t.locationName + ' · ' + t.departmentName), 'kb-hide-m'], ['<b>' + t.count + '</b>', 'kb-r'], [esc(lastText(t.last))]] };
    }), 8);
    var body = list.length ? X.table([['Вид браку'], ['Локація · відділ', 'kb-hide-m'], ['у скількох діях був', 'kb-r'], ['стан останньої дії з цим видом']],
      mr.rows, '', 'Види браку, що знову потрапляють у дії') + mr.btn : X.none('Таких видів браку немає ' + X.wl(r.weeks) + '.');
    return X.card('Види браку, що знову потрапляють у дії', 'mkd.returning', '', body, '', 'вид браку був пунктом у 2 і більше діях ' + X.wl(r.weeks));
  }

  P.cab.tab({ id: 'kd', label: 'Коригуючі дії', ic: 'corrective', path: '/kd', order: 35, real: 'mgrKdBoard' });
  P.cab.screen('/kd', { tab: 'kd', title: 'Коригуючі дії', period: false, render: function (ctx) {
    var w = X.weeks(ctx.query), first = null;
    X.bind(ctx, function () { return first; });
    ctx.on('retry', function () { ctx.reload(); });
    P.srv('mgrKdBoard', { weeks: w }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { ctx.el.innerHTML = P.sr.h.error(r); return; }
      if (!r.locations || !r.locations.length) { ctx.el.innerHTML = '<section class="card">' + P.sr.h.empty('Локацій ще немає', 'Коли адміністратор додасть локацію, тут зʼявляться її коригуючі дії.') + '</section>'; return; }
      first = r.locations[0].id;
      if (X.kdWait(r)) { ctx.el.innerHTML = '<div class="kb mkd">' + X.kdFromNote(r) + '</div>'; return; }
      ctx.el.innerHTML = '<div class="kb mkd">' + X.periodBar(r, function (n) { return '#/kd' + (n !== 8 ? '?w=' + n : ''); }) + X.kdFromNote(r) +
        '<div class="mkd-locs">' + r.locations.map(function (l) { return locCard(l, r); }).join('') + '</div>' +
        X.legend([['<i class="mkd-osw mkd-o1"></i>', 'тримається'], ['<i class="mkd-osw mkd-o2"></i>', 'її види нижче, ніж до дії'], ['<i class="mkd-osw mkd-o3"></i>', 'старший позначив «не потрібно»'],
          ['<i class="kb-sw kb-sw--slate"></i>', 'брак цеху, % по тижнях'], ['<i class="kb-sw kb-sw--red"></i>', 'тиждень понад норму'], ['<i class="kb-sw kb-sw--dim"></i>', 'тиждень ще йде'],
          ['<i class="kb-ln kb-ln--norm"></i>', 'норма ' + r.threshold + '%']]) +
        compareCard(r) + '<div class="kb-g2 mkd-g2e">' + streakCard(r) + returningCard(r) + '</div>' + X.plates.p10(r) + '</div>';
    });
  } });
})(window);
