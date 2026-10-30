(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, K = P.mgr;
  function H() { return P.sr.h; }
  var OPEN = ['over', 'pre'], OBSERVE = ['watch', 'hold'], CLOSED = ['done', 'part', 'relapse'];   // без плану · на спостереженні · закрито з результатом
  var NOW = ['pre', 'over', 'watch', 'hold'], DONE = ['done', 'part', 'relapse', 'skip'];           // зараз (як іде дія) і завершені за період
  var KNOWN = NOW.concat(DONE);
  var SHORT = { over: 'без плану', pre: 'достроково · без плану', watch: 'тиждень 1 з 2', hold: 'тиждень 2 з 2', done: '✓ тримається',
    part: '✓ види нижче', relapse: '✕ рецидив', skip: 'не потрібна', ok: 'у нормі' };
  var WD_FROM = ['понеділка', 'вівторка', 'середи', 'четверга', 'пʼятниці', 'суботи', 'неділі'];
  var WD_TO = ['понеділок', 'вівторок', 'середу', 'четвер', 'пʼятницю', 'суботу', 'неділю'];
  var WD_EACH = ['щопонеділка', 'щовівторка', 'щосереди', 'щочетверга', 'щопʼятниці', 'щосуботи', 'щонеділі'];
  var WD_SHORT = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];   // за getUTCDay()

  function n(v) { return v == null ? '—' : H().num(v); }
  function dd(v) {
    if (v == null) return '—';
    var r = Math.round(v * 10) / 10;
    return String(r).replace('.', ',') + ' ' + (r % 1 ? 'дня' : P.plural(r, 'день', 'дні', 'днів'));
  }
  function short(s) {
    var st = P.sr && P.sr.KD_STATES && P.sr.KD_STATES[s];
    return (st && st.short) || SHORT[s] || (st ? st.label : s);
  }
  function stHelp(s) { return KNOWN.indexOf(s) >= 0 ? K.help('mgr.kd.state.' + s) : ''; }
  function day(v) { return v ? K.day(String(v).slice(0, 10)) : '—'; }
  function ms(d) { return Date.parse(String(d).slice(0, 10) + 'T12:00:00Z'); }
  function plus(d, k) { return new Date(ms(d) + k * 86400000).toISOString().slice(0, 10); }
  function between(a, b) { return a && b ? Math.round((ms(b) - ms(a)) / 86400000) : null; }
  function wdNo(d) { return new Date(ms(d)).getUTCDay() || 7; }
  function firstReview(d, wd) { return plus(d, (wd - wdNo(d) + 7) % 7); }
  function wdDay(d) { return WD_SHORT[new Date(ms(d)).getUTCDay()] + ' ' + H().dayShort(d); }
  function canon(s) { return P.sr.KD_STATES[s] ? s : P.sr.kdStateOf(s); }
  function causeName(kd, c) { var x = (kd.causes || []).filter(function (o) { return o.id === c; })[0]; return x ? K.causeName(x.id, x.label) : K.causeName(c, c); }
  function sum(states, keys) { return keys.reduce(function (s, k) { return s + ((states || {})[k] || 0); }, 0); }
  function lastAfter(a) { return a.typesAfter2 != null ? a.typesAfter2 : a.typesAfter; }

  function closedList(kd) {
    return (kd.actions || []).filter(function (a) {
      return CLOSED.indexOf(a.state) >= 0 && a.finishedOn && (!kd.from || a.finishedOn >= kd.from) && (!kd.to || a.finishedOn <= kd.to);
    });
  }
  function stats(kd) {
    var s = kd.states || {}, p = kd.period || {}, e = kd.effect || {}, today = kd.today;
    var now = kd.now || (kd.actions || []).filter(function (a) { return NOW.indexOf(a.state) >= 0; });   // без kd.now — як було: дії зведення
    var maxDays = null, nOpen = 0, nObs = 0;
    now.forEach(function (a) {
      if (OBSERVE.indexOf(a.state) >= 0) nObs++;
      if (OPEN.indexOf(a.state) < 0) return;
      nOpen++;
      var d = between(a.openedAt, today);
      if (d != null && (maxDays == null || d > maxDays)) maxDays = d;
    });
    var total = sum(s, CLOSED), cl = closedList(kd);
    var low = cl.filter(function (a) { var x = lastAfter(a); return a.typesBefore != null && x != null && x < a.typesBefore; }).length;
    return { open: nOpen, openMaxDays: maxDays, observe: nObs, nextResult: nextResult(kd, now),
      closed: { done: s.done || 0, part: s.part || 0, relapse: s.relapse || 0, skip: s.skip || 0, total: total },
      closedList: cl, lowered: { n: low, of: cl.length },
      effect: { items: e.items || 0, before: e.avgBefore, after: e.avgAfter, delta: e.avgDeltaPp }, daysAvg: p.implementedDaysAvg };
  }
  function nextResult(kd, list) {
    var best = null, day = {};
    (kd.actions || []).forEach(function (a) { if (a.key && a.resultDay) day[a.key] = a.resultDay; });
    (list || kd.actions || []).forEach(function (a) {
      var d = a.resultDay || (a.key && day[a.key]) || null;
      if ((a.state === 'watch' || a.state === 'hold') && d && (!best || d < best)) best = d;
    });
    return best;
  }
  function ruleLine(kd) {
    var wd = kd.cycle && kd.cycle.reviewWeekday, th = 'норма браку ' + H().pct(kd.threshold);
    if (!wd) return 'Тиждень — 7 днів · ' + th + ' · розбір раз на тиждень зранку';
    return 'Тиждень — з ' + WD_FROM[wd - 1] + ' по ' + WD_TO[(wd + 5) % 7] + ' · ' + th + ' · розбір ' + WD_EACH[wd - 1] + ' зранку';
  }

  function split(parts, label) {
    var tot = parts.reduce(function (s, x) { return s + (x[0] || 0); }, 0);
    return '<div class="mgr-split" role="img" aria-label="' + esc(label + ': ' + parts.map(function (x) { return x[2] + ' ' + (x[0] || 0); }).join(', ')) + '">' +
      (tot ? parts.map(function (x) { return x[0] ? '<i style="flex-grow:' + x[0] + ';background:var(--kd-' + x[1] + ')" title="' + esc(x[2] + ': ' + x[0]) + '"></i>' : ''; }).join('') : '') + '</div>' +
      '<div class="mgr-split__key">' + parts.map(function (x) { return '<span class="mgr-split__i">' + H().kdState(x[1], x[2] + ' · ' + (x[0] || 0)) + stHelp(x[1]) + '</span>'; }).join('') + '</div>';
  }
  function big(val, label, key, sub) {
    return '<div class="mgr-kdbig"><span class="mgr-kdbig__l">' + esc(label) + (key ? K.help(key) : '') + '</span><b class="mgr-kdbig__v">' + val + '</b>' +
      (sub ? '<span class="mgr-kdbig__s">' + sub + '</span>' : '') + '</div>';
  }

  function ago(a, today) { var d = between(a.openedAt, today); return d == null ? '' : d ? K.dn(d) : 'сьогодні'; }
  function chip(a, today, noNo) {
    var s = canon(a.state), txt = (!noNo && a.no ? '№' + a.no + ' ' : '') + short(s) + (OPEN.indexOf(s) >= 0 && ago(a, today) ? ' · ' + ago(a, today) : '');
    var full = (P.sr.KD_STATES[s] ? P.sr.KD_STATES[s].label : s) + ' · відкрито ' + day(a.openedAt);
    return '<span class="mgr-chip mgr-chip--' + esc(s) + '" title="' + esc(a.departmentName + (a.no ? ' №' + a.no : '') + ' · ' + full) + '">' + esc(txt) + '</span>';
  }

  function periodCard(kd, scope) {
    var p = kd.period || {}, r = p.results || {}, hd = p.held || {};
    return '<section class="card mgr-gap"><div><h2 class="card-title">Коригуючі дії за період' + K.help('mgr.kd.period') + '</h2><p class="hint">' + esc(scope) + '</p></div>' +
      '<div class="mgr-kdbigs">' + big(n(p.opened), 'Відкрито', 'mgr.kd.action', p.earlyOpened ? 'з них достроково, посеред тижня — ' + n(p.earlyOpened) + K.help('mgr.kd.early') : '') +
      big(n(p.implemented), 'Впроваджено', 'mgr.kd.implemented') + big(dd(p.implementedDaysAvg), 'Від відкриття до впровадження', 'mgr.kd.days', 'у середньому') +
      big(n(p.notImplemented), 'Ще не впроваджено', 'mgr.kd.notImpl') + '</div>' +
      '<div class="mgr-gap mgr-gap--sm"><p class="group-label" style="padding:0">Перший тиждень після впровадження: брак, % відділу' + K.help('mgr.kd.after1') + '</p>' +
      split([[r.belowAfter1, 'hold', 'не вище норми'], [r.notBelowAfter1, 'over', 'понад норму (рецидив або «її види браку нижче, ніж до дії»)'], [r.pending, 'watch', 'тиждень ще йде']], 'Перший тиждень після впровадження') + '</div>' +
      '<div class="mgr-gap mgr-gap--sm"><p class="group-label" style="padding:0">Другий тиждень після впровадження: брак, % відділу' + K.help('mgr.kd.after2') + '</p>' +
      split([[hd.done, 'done', 'знову не вище норми — закрито: тримається'], [hd.part, 'part', 'понад норму, але види браку дії разом нижче, ніж до дії — закрито'],
        [hd.relapse, 'relapse', 'понад норму (рецидив)'], [hd.pending, 'hold', 'тиждень ще йде (під наглядом)']], 'Другий тиждень після впровадження') + '</div></section>';
  }
  function effectCard(kd) {
    var e = kd.effect || {}, rows = [], h = H();
    (kd.actions || []).forEach(function (a) {
      var d = a.implementedAt ? String(a.implementedAt).slice(0, 10) : '';
      if (!d || d < kd.from || d > kd.to || canon(a.state) === 'watch') return;
      (a.items || []).forEach(function (it) { if (it.after != null && it.before != null) rows.push({ dept: a.departmentName, name: it.name, before: it.before, after: it.after }); });
    });
    rows.sort(function (a, b) { return (a.after - a.before) - (b.after - b.before); });
    var max = Math.max(5, kd.threshold || 5, Math.max.apply(null, rows.map(function (x) { return Math.max(x.before, x.after); }).concat([0])));
    function w(v) { return Math.max(0, Math.min(100, v / max * 100)).toFixed(1) + '%'; }
    return '<section class="card mgr-gap"><div><h2 class="card-title">Що сталося з браком після коригуючих дій' + K.help('mgr.kd.beforeAfter') + '</h2>' +
      '<p class="hint">Рядок — вид браку, з яким працювала коригуюча дія: його брак, % у відділі до дії і в перший повний тиждень після впровадження' +
      (e.items ? ' · рядків: <b>' + n(e.items) + '</b> · у середньому: ' + h.ba(e.avgBefore, e.avgAfter) : '') + '</p></div>' +
      (!rows.length ? '<p class="hint">За період ще немає видів браку з числом «після». «Після» зʼявляється, коли мине перший повний тиждень після впровадження.</p>'
        : '<div class="mgr-ba"><div class="mgr-ba__key"><span><i class="mgr-ba__b"></i>до коригуючої дії</span><span><i class="mgr-ba__a"></i>після впровадження</span><span><i class="mgr-key__dash"></i>норма — ' + h.pct(kd.threshold) + '</span>' +
          '<span>в. п. — відсоткові пункти: різниця «після» мінус «до»</span></div>' +
          rows.map(function (x) {
            return '<div class="mgr-ba__r"><span class="mgr-ba__n"><b>' + esc(x.name) + '</b> <span class="mgr-dim">' + esc(x.dept) + '</span></span>' +
              '<span class="mgr-ba__v">' + h.ba(x.before, x.after) + '</span>' +
              '<span class="mgr-ba__bars"><i class="mgr-ba__b" style="width:' + w(x.before) + '"></i><i class="mgr-ba__a" style="width:' + w(x.after) + '"></i>' +
              '<i class="mgr-ba__lim" style="left:' + w(kd.threshold || 5) + '"></i></span></div>';
          }).join('') + '</div>') + '</section>';
  }
  function causesCard(kd) {
    var list = (kd.causes || []).filter(function (c) { return c.n; }).sort(function (a, b) { return b.n - a.n; }), tot = list.reduce(function (s, c) { return s + c.n; }, 0);
    return '<section class="card mgr-gap"><h2 class="card-title">Причини браку в планах · ' + n(tot) + K.help('mgr.kd.causes') + '</h2>' +
      (!tot ? '<p class="hint">За період жодного плану не впроваджено — причин немає.</p>' : '<div class="mgr-causes">' + list.map(function (c) {
        var pc = Math.round(c.n / tot * 1000) / 10;
        return '<div class="mgr-causes__r"><span>' + esc(K.causeName(c.id, c.label)) + '</span><b>' + n(c.n) + ' · ' + H().pct(pc) + '</b><span class="mgr-causes__bar"><i style="width:' + pc + '%"></i></span></div>';
      }).join('') + '</div>') + '</section>';
  }
  function howOpened(a) {
    if (!a.early) return '';
    return ' <span class="badge">достроково, посеред тижня</span>' + K.help('mgr.kd.early') +
      (a.earlyBelow ? '<span class="mgr-dim mgr-block">брак, % за весь тиждень: ' + H().pct(a.weekRate) + '</span>' : '');
  }
  function actionsCard(kd, state) {
    var list = (kd.actions || []).slice().sort(function (a, b) { return String(b.openedAt) < String(a.openedAt) ? -1 : 1; });
    return '<section class="card mgr-gap"><div><h2 class="card-title">Перелік коригуючих дій · ' + list.length + K.help('mgr.kd.actions') + '</h2>' +
      '<p class="hint">Рядок — одна коригуюча дія відділу, де брак, % за тиждень вищий за норму; відкрито за підсумком тижня або достроково, посеред тижня' +
      (state ? ' · стан — на сьогодні' : '') + '</p></div>' +
      (!list.length ? '<p class="hint">Коригуючих дій за період немає.</p>' : '<div class="tbl-box"><table class="tbl mgr-tbl mgr-acts"><thead><tr><th>Відділ</th><th>Відкрито</th><th>Впроваджено</th>' +
        '<th class="n mgr-wrap">Днів від відкриття до впровадження' + K.help('mgr.kd.days') + '</th><th>Головна причина' + K.help('mgr.kd.causes') + '</th>' + (state ? '<th>Стан на сьогодні</th>' : '') +
        '<th class="n mgr-wrap">Брак, % відділу: до → після' + K.help('mgr.kd.beforeAfter') + '</th></tr></thead><tbody>' +
        list.map(function (a) {
          var st = canon(a.state), d = a.daysToImplement != null ? a.daysToImplement : between(a.openedAt, a.implementedAt);
          return '<tr><td><b>' + esc(a.departmentName) + '</b></td><td>' + esc(day(a.openedAt)) + howOpened(a) + '</td>' +
            '<td>' + (a.implementedAt ? esc(day(a.implementedAt)) : '<span class="mgr-dim">' + (st === 'skip' ? 'дія не потрібна' : 'ще не впроваджено') + '</span>') + '</td>' +
            '<td class="n">' + (d == null ? '—' : n(d)) + '</td><td>' + (a.cause ? esc(causeName(kd, a.cause)) : '<span class="mgr-dim">не записано</span>') + '</td>' +
            (state ? '<td>' + H().kdState(st, short(st)) + '</td>' : '') + '<td class="n">' + H().ba(a.before, a.after, st === 'skip' || st === 'over' || st === 'pre') + '</td></tr>';
        }).join('') + '</tbody></table></div>') + '</section>';
  }
  function weeksTable(kd) {
    return '<div class="tbl-box"><table class="tbl mgr-tbl"><thead><tr><th>Тиждень</th><th class="n">Перевірено, шт</th><th class="n">Брак, % локації</th><th class="n">Відкрито дій</th>' +
      '<th class="n">Впроваджено дій</th><th class="n mgr-wrap">' + AFTER1 + '</th><th class="n">Рецидивів</th></tr></thead><tbody>' +
      (kd.weeks || []).map(function (w) {
        return '<tr><td>' + esc(K.span(w.start, w.end)) + (w.current ? ' <span class="mgr-dim">· ще триває</span>' : '') + '</td><td class="n">' + n(w.checked) + '</td><td class="n">' + K.rate(w.rate, kd.threshold) + '</td><td class="n">' + n(w.opened) + '</td>' +
          '<td class="n">' + n(w.implemented) + '</td><td class="n">' + n(w.belowAfter) + '</td><td class="n">' + n(w.relapse) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  function weekSpan(kd) {
    var w = (kd.weeks || [])[0];
    return w ? WD_SHORT[new Date(ms(w.start)).getUTCDay()] + ' → ' + WD_SHORT[new Date(ms(w.end)).getUTCDay()] : '';
  }
  function reviewDay(kd) { return kd.cycle && kd.cycle.reviewWeekdayName ? 'день розбору — ' + kd.cycle.reviewWeekdayName : 'день розбору — за правилом адміністратора'; }
  var AFTER1 = 'Перший тиждень після впровадження не вище норми, дій';

  var KD = P.mgrKd = {
    word: short,
    help: stHelp,
    chip: chip,
    stats: stats,
    rule: ruleLine,
    tile: function (t) {
      if (!t) return '<span class="mgr-tile__kd mgr-dim">коригуючі дії: даних немає</span>';
      function list(keys) { return keys.map(function (k) { return '<span class="' + (t.states[k] ? '' : 'mgr-zero') + '">' + H().kdState(k, short(k) + ' · ' + t.states[k]) + '</span>'; }).join(''); }
      return '<span class="mgr-tile__kd"><span class="mgr-tile__kdh">Коригуючі дії зараз: <b>' + n(t.active) + '</b></span><span class="mgr-tile__kds">' + list(NOW) + '</span>' +
        '<span class="mgr-tile__kdh">За період: відкрито <b>' + n(t.opened) + '</b> · впроваджено <b>' + n(t.implemented) + '</b></span><span class="mgr-tile__kds">' + list(['done', 'part', 'relapse']) + '</span></span>';
    },
    month: function (kd, scope) {
      if (!kd) return '<section class="card">' + H().empty('Даних про коригуючі дії немає', 'Для цієї локації їх ще не підраховано.') + '</section>';
      return periodCard(kd, scope) + '<p class="hint">Перший і другий тиждень після впровадження — лише для коригуючих дій, впроваджених у цьому місяці. Самі ці тижні можуть припасти на наступний місяць.</p>' +
        '<section class="card mgr-gap mgr-avoid"><div><h2 class="card-title">Тижні місяця: брак, % локації і коригуючі дії' + K.help('mgr.kd.weeks') + '</h2><p class="hint">Тиждень — ' + esc(weekSpan(kd)) + ' · ' + esc(reviewDay(kd)) + K.help('mgr.kd.review') + '</p></div>' +
        ((kd.weeks || []).length ? weeksTable(kd) : '<p class="hint">Тижнів у місяці немає.</p>') + '</section>' +
        '<div class="row mgr-print-stack"><div class="col--wide">' + effectCard(kd) + '</div><div class="col">' + causesCard(kd) + '</div></div>' + actionsCard(kd, false);
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = KD;
})(typeof window !== 'undefined' ? window : globalThis);
