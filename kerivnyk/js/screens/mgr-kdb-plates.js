(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, X = P.mgrKdb;
  var WD = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var OUT = { helped: 'тримається', held_types: 'її види нижче', not_helped: 'рецидив', not_needed: 'не потрібно', self_closed: 'без участі старшого' };
  function nm(a) { return a.departmentName + ' №' + a.no; }
  function wl(r) { return X.wl(r.weeks); }
  function dv(v) { return v == null ? '—' : '<b class="' + X.dcls(v) + '">' + X.signed(v) + '</b>'; }
  function pl(r, k) { return (r.plates && r.plates[k]) || null; }

  var T = X.plates = {};

  T.p1 = function (r) {
    var list = pl(r, 'diff') || [];
    var lim = Math.max(3, Math.ceil(Math.max.apply(null, list.map(function (x) { return Math.abs(x.diff || 0); }).concat([0]))));
    var bar = function (v) {
      if (v == null) return '';
      var w = Math.min(Math.abs(v) / lim * 50, 50);
      return '<span class="mkd-dbar" role="img" aria-label="' + esc('різниця змін ' + X.signed(v) + ' в. п.') + '"><i class="mkd-dbar__c"></i><i class="mkd-dbar__v' + (v > 0 ? ' mkd-dbar__v--up' : '') + '" style="--at:' + (v < 0 ? 50 - w : 50).toFixed(1) + '%;--w:' + w.toFixed(1) + '%"></i></span>';
    };
    var body = list.length ? X.table([['Дія'], ['види браку в дії: до → після', 'kb-r'], ['інші види того ж відділу: до → після', 'kb-r kb-hide-m'], ['різниця змін, в. п. (від −' + lim + ' до +' + lim + ')', 'kb-hide-m mkd-t__bar'], ['різниця', 'kb-r']],
      list.map(function (a) {
        var t = a.types || {}, o = a.other || {};
        var dt = t.before != null && t.after != null ? t.after - t.before : null, dob = o.before != null && o.after != null ? o.after - o.before : null;
        return { cells: [[X.nm(nm(a), X.day(a.openedAt) + ' → ' + X.day(a.finishedOn) + ' · ' + (OUT[a.outcome] || ''))], [X.p(t.before) + ' → ' + X.p(t.after) + ' ' + dv(dt), 'kb-r kb-nw'],
          [X.p(o.before) + ' → ' + X.p(o.after) + ' ' + dv(dob), 'kb-r kb-nw kb-hide-m'], [bar(a.diff), 'kb-hide-m'], [dv(a.diff), 'kb-r']] };
      }), '', 'Зміна видів браку в дії проти решти браку відділу') : X.none('Дій з планом, що закрились ' + wl(r) + ', немає.');
    var ex = list.filter(function (a) { return a.diff != null && a.types && a.other && a.types.after != null && a.other.after != null; })[0];
    var foot = 'Різниця змін = зміна видів браку в дії − зміна інших видів браку того ж відділу.' +
      (ex ? ' Приклад: ' + esc(nm(ex)) + ' — (' + X.signed(ex.types.after - ex.types.before) + ') − (' + X.signed(ex.other.after - ex.other.before) + ') = ' + X.signed(ex.diff) + ' в. п.' : '') + ' Однакова зміна обох дає 0.';
    return X.card('Чи змінився брак видів дії більше, ніж решта браку відділу', 'mkd.p1', '', body + (list.length ? X.foot(foot) : ''), '',
      'ті самі дні: «до» — на день плану, «після» — дні 8–14 після плану (закрито достроково чи рецидив у днях 1–7 — дні 1–7)');
  };

  T.p2 = function (r) {
    var list = pl(r, 'precision') || [];
    var mx = Math.max(6, Math.ceil(Math.max.apply(null, list.map(function (x) { return Math.max(x.hi || 0, x.typesBefore || 0); }).concat([0])) + 0.5));
    var at = function (v) { return (Math.max(0, Math.min(mx, v)) / mx * 100).toFixed(1); };
    var frame = function (a) {
      if (a.typesRate == null) return '';
      return '<span class="mkd-fr" role="img" aria-label="' + esc('брак видів дії ' + X.p(a.typesRate) + ', рамка ' + X.p(a.lo) + '–' + X.p(a.hi) + ', до дії ' + X.p(a.typesBefore)) + '">' +
        (a.lo != null && a.hi != null ? '<i class="mkd-fr__b" style="--at:' + at(a.lo) + '%;--w:' + (at(a.hi) - at(a.lo)).toFixed(1) + '%"></i>' : '') +
        '<i class="mkd-fr__d" style="--at:' + at(a.typesRate) + '%"></i>' + (a.typesBefore != null ? '<i class="mkd-fr__l" style="--at:' + at(a.typesBefore) + '%"></i>' : '') + '</span>';
    };
    var mr = X.more(list.map(function (a) {
        var verdict = a.bigger == null ? '—' : a.bigger ? X.chip('done', 'так') : X.chip('none', 'ні — у межах рамки');
        var lbl = (a.n === 2 ? 'дні 8–14' : 'дні 1–7') + ' після плану · ' + (a.start === a.end ? X.day(a.start) : X.rng(a.start, a.end)) +
          (a.status === 'running' ? ', поки · днів з аудитами ' + (a.days || 0) + ' з 7' : '');
        return { cells: [[X.nm(nm(a), lbl)], [X.num(a.checked), 'kb-r'], [frame(a), 'kb-hide-m'],
          [X.p(a.typesRate) + (a.margin != null ? ' ± ' + X.n1(a.margin) : ''), 'kb-r kb-nw'], [dv(a.change), 'kb-r kb-hide-m'], [verdict]] };
    }), 8);
    var body = list.length ? X.table([['Дія · дні після плану'], ['перевірено, шт', 'kb-r'], ['рамка точності, 0–' + mx + '%', 'kb-hide-m mkd-t__bar'], ['брак ± точність', 'kb-r'], ['зміна від «до»', 'kb-r kb-hide-m'], ['зміна більша за точність?', 'mkd-t__chip']],
      mr.rows, '', 'Точність результату за дні 1–7 і 8–14 після плану') + mr.btn : X.none('Днів спостереження після плану ' + wl(r) + ' немає.');
    return X.card('Чи достатньо перевірили, щоб бачити зміну', 'mkd.p2', '', body + (list.length ? X.legend([['<i class="kb-sw kb-sw--frm"></i>', 'рамка — де справжній брак найімовірніше'],
      ['<i class="kb-dot kb-dot--obs"></i>', 'брак видів дії за ці дні'], ['<i class="mkd-k-dot"></i>', 'рівень до дії'], ['', 'шкала 0–' + mx + '%']]) +
      X.foot('Що менше штук перевірили, то ширша рамка. Якщо зміна від «до» менша за рамку, ці числа не розрізняють «стало краще» і «так вийшло у вибірці».') : ''),
      '', 'дні 1–7 і 8–14 після плану (дні з аудитами): штуки й точність числа');
  };

  function postSpark(vals, before) {
    var pts = vals.map(function (v, i) { return v == null ? null : [i, v]; }).filter(Boolean);
    if (pts.length < 2) return '<span class="kb-cs">—</span>';
    var mx = Math.max.apply(null, pts.map(function (p) { return p[1]; }).concat([before || 0])) * 1.15 || 1;
    var Xp = function (i) { return 6 + i * 14.5; }, Y = function (v) { return 26 - v / mx * 22; }, last = pts[pts.length - 1];
    return '<svg class="mkd-ps" viewBox="0 0 116 30" role="img" aria-label="' + esc('Брак видів дії після закриття по тижнях: ' + pts.map(function (p) { return X.p(p[1]); }).join(', ')) + '">' +
      (before != null ? '<line class="mkd-ps__b" x1="0" y1="' + Y(before).toFixed(1) + '" x2="116" y2="' + Y(before).toFixed(1) + '"></line>' : '') +
      '<polyline class="mkd-ps__l" points="' + pts.map(function (p) { return Xp(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ') + '"></polyline>' +
      pts.slice(0, -1).map(function (p) { return '<circle class="mkd-ps__p" cx="' + Xp(p[0]).toFixed(1) + '" cy="' + Y(p[1]).toFixed(1) + '" r="1.8"></circle>'; }).join('') +
      '<circle class="' + (before != null && last[1] >= before ? 'mkd-ps__up' : 'mkd-ps__dn') + '" cx="' + Xp(last[0]).toFixed(1) + '" cy="' + Y(last[1]).toFixed(1) + '" r="3"></circle></svg>';
  }
  function later(v, before, wait) {
    if (v == null) return '<span class="kb-cs">' + wait + '</span>';
    if (before == null) return X.p(v);
    return X.p(v) + ' ' + (v >= before ? '<b class="kb-up">≥ до дії</b>' : '<b class="kb-dn">нижче, ніж до дії</b>');
  }
  T.p3 = function (r) {
    var list = pl(r, 'after') || [];
    var body = list.length ? X.table([['Дія'], ['до дії', 'kb-r'], ['на закритті', 'kb-r kb-hide-m'], ['тижні після закриття (пунктир — до дії)', 'kb-hide-m'], ['через 4 тижні', 'kb-r'], ['через 8 тижнів', 'kb-r kb-hide-m']],
      list.map(function (a) {
        return { cells: [[X.nm(nm(a), 'закрито ' + X.day(a.finishedOn) + ' · ' + (OUT[a.outcome] || ''))], [X.p(a.before), 'kb-r'], [X.p(a.atClose), 'kb-r kb-hide-m'], [postSpark(a.weekly || [], a.before), 'kb-hide-m'],
          [later(a.plus4, a.before, 'ще не минуло 4 тижні'), 'kb-r'], [later(a.plus8, a.before, 'ще не минуло'), 'kb-r kb-hide-m']] };
      }), '', 'Брак видів дії після закриття') : X.none('Закритих дій ' + wl(r) + ' немає.');
    return X.card('Що з браком видів дії після закриття', 'mkd.p3', 'дія стежить 14 днів з аудитами — тут видно, що було далі',
      body + (list.length ? X.foot('Брак видів, які були в дії, по тижнях після її закриття. Повернення до рівня «до дії» система не рахує рецидивом — дія вже закрита.') : ''));
  };

  T.p4 = function (r) {
    var o = pl(r, 'pieces') || { items: [], total: {} }, list = o.items || [], tot = o.total || {};
    var mx = Math.max.apply(null, list.map(function (x) { return x.lessProduced || 0; }).concat([1]));
    var bar = function (v) { return '<span class="mkd-pc"><i style="--w:' + (Math.max(0, v || 0) / mx * 45).toFixed(1) + '%"></i><b>' + X.num(v) + ' шт</b></span>'; };
    var rows = list.map(function (a) {
      return { cells: [['<b>' + esc(nm(a)) + '</b>'], [X.p(a.before) + ' → ' + X.p(a.after), 'kb-r kb-nw kb-hide-m'], [X.num(a.checked) + ' шт', 'kb-r kb-hide-m'], ['<b>' + X.num(a.lessChecked) + ' шт</b>', 'kb-r'],
        [X.num(a.produced) + ' шт', 'kb-r kb-hide-m'], [bar(a.lessProduced)]] };
    });
    if (list.length) rows.push({ cls: 'mkd-t__tot', cells: [['Разом ' + wl(r)], ['', 'kb-hide-m'], ['', 'kb-hide-m'], [X.num(tot.lessChecked) + ' шт', 'kb-r'], ['', 'kb-hide-m'], [X.num(tot.lessProduced) + ' шт']] });
    var body = list.length ? X.table([['Дія'], ['брак видів дії: до → після', 'kb-r kb-hide-m'], ['перевірено за дні спостереження', 'kb-r kb-hide-m'], ['≈ менше на перевірених', 'kb-r'], ['виготовлено за ці дні', 'kb-r kb-hide-m'], ['≈ менше на виготовлених']],
      rows, '', 'Скільки штук браку менше після дій') : X.none('Дій з планом, що закрились ' + wl(r) + ', немає.');
    var fake = o.producedFake ? ' <b>«Виготовлено» поки тестове число:</b> виробіток у додаток ще не завантажується.' : ' Виготовлені — з імпорту виробітку.';
    return X.card('Скільки штук браку менше після дій', 'mkd.p4', '', body + (list.length ? X.foot('≈ менше = (брак до дії − брак після) × штук. Перевірені — з аудитів.' + fake +
      ' Це оцінка: скільки браку видів дії було б, якби лишився рівень «до».') : ''), '', 'порівняння з рівнем до дії за дні 1–14 після плану (закрито достроково — дні 1–7)');
  };

  T.p5 = function (r) {
    var u = pl(r, 'uncovered') || { items: [] }, list = u.items || [], Tn = r.threshold;
    var mx = Math.max.apply(null, list.map(function (x) { return x.pieces || 0; }).concat([1]));
    var share = u.coveredShare == null ? null : Math.max(0, Math.min(100, u.coveredShare)), rest = share == null ? null : Math.round((100 - share) * 10) / 10;
    var head = u.totalPieces ? '<div class="mkd-cov"><span class="mkd-cov__bar" role="img" aria-label="' + esc(X.p(share) + ' штук браку — у видах, з якими працюють дії; ' + X.p(rest) + ' — поза діями') + '">' +
      '<i class="mkd-cov__in" style="--w:' + (share || 0).toFixed(1) + '%"></i><i class="mkd-cov__out" style="--w:' + (rest || 0).toFixed(1) + '%"></i></span>' +
      '<span class="mkd-cov__t"><span><b>' + X.p(share) + '</b> штук браку цеху — у видах, з якими зараз працюють дії</span><span><b class="kb-up">' + X.p(rest) + '</b> — поза діями</span></span></div>' : '';
    var body = list.length ? X.table([['Вид браку'], ['відділ', 'kb-hide-m'], ['штук браку за 4 тижні'], ['чи є дія з цим видом']],
      list.map(function (t) {
        return { cells: [['<span class="mkd-nm"><b>' + X.lvlDot(t.level) + ' ' + esc(t.name) + '</b><span class="kb-cs mkd-only-m">' + esc(t.departmentName) + '</span></span>'], [esc(t.departmentName), 'kb-hide-m'],
          ['<span class="mkd-pc mkd-pc--' + (t.inAction ? 'in' : 'out') + '"><i style="--w:' + ((t.pieces || 0) / mx * 70).toFixed(1) + '%"></i><b>' + X.num(t.pieces) + ' шт</b></span>'],
          [t.inAction ? X.chip('obs', 'у дії <span class="kb-hide-m">' + esc(t.departmentName) + ' </span>№' + t.inAction.no) : X.chip('none', 'поза діями')]] };
      }), '', 'Великі види браку і дії') : X.none('Браку за останні 4 завершені тижні не записано.');
    return X.card('Великі види браку, з якими зараз не працює жодна дія', 'mkd.p5', '', head + body +
      (list.length ? X.foot('Дія відкривається на відділ, коли брак усього відділу за тиждень понад ' + Tn + '%. Тому великий вид браку у відділі, що в нормі, у дію не потрапляє — тут його видно.') : ''),
      '', esc(r.location.name) + (u.from ? ' · ' + X.rng(u.from, u.to) : '') + ' · від більшого');
  };

  T.p6 = function (r) {
    var o = pl(r, 'load') || { weeks: [], max: {} }, ws = o.weeks || [], mxo = o.max || {}, H0 = 110;
    var top = Math.max.apply(null, ws.map(function (w) { return w.total || 0; }).concat([1]));
    var px = function (n) { return Math.round((n || 0) / top * H0); };
    var cols = ws.map(function (w) {
      return '<span class="mkd-ld__c' + (w.current ? ' mkd-ld__c--cur' : '') + '" title="' + esc(X.rng(w.start, w.end) + ': усього ' + (w.total || 0) + ' · без плану ' + (w.open || 0) + ' · рецидив ' + (w.relapse || 0) + ' · на спостереженні ' + (w.observe || 0)) + '">' +
        '<b>' + (w.total || 0) + '</b><i class="mkd-ld__obs" style="--h:' + px(w.observe) + '"></i><i class="mkd-ld__rel" style="--h:' + px(w.relapse) + '"></i><i class="mkd-ld__open" style="--h:' + px(w.open) + '"></i></span>';
    }).join('');
    var lbl = ws.map(function (w, i) { return '<span class="' + ((ws.length - 1 - i) % 2 ? 'mkd-ld__odd' : '') + '">' + X.day(w.start) + '</span>'; }).join('');
    var mw = (mxo.weeks || []).map(X.day);
    var body = ws.length ? '<div class="mkd-ld" role="img" aria-label="' + esc('Дій одночасно по тижнях: ' + ws.map(function (w) { return w.total || 0; }).join(', ')) + '">' + cols + '</div><div class="mkd-ld__x">' + lbl + '</div>' +
      X.legend([['<i class="kb-sw mkd-ld__open"></i>', 'без плану'], ['<i class="kb-sw mkd-ld__rel"></i>', 'рецидив — потрібен новий план'], ['<i class="kb-sw mkd-ld__obs"></i>', 'на спостереженні'], ['', 'число — усього дій у тижні (хоч один день)']]) +
      X.foot(mxo.total ? 'Найбільше одночасно — ' + X.acts(mxo.total) + ' (' + esc(mw.join(' і ')) + '), з них без плану або рецидив — ' + (mxo.needPlan || 0) + '. Старших аудиторів у цеху: ' + (o.seniors || 0) + '.' : 'За 13 тижнів дій не було.')
      : X.none('Даних по тижнях немає.');
    return X.card('Скільки дій одночасно в роботі, по тижнях', 'mkd.p6', esc(r.location.name) + ' · 13 тижнів · старших аудиторів у цеху: ' + (o.seniors || 0), body);
  };

  var ST7 = [['noPlan', 'mkd-d7--open', 'без плану: від відкриття до плану'], ['wait', 'mkd-d7--wait', 'дострокова: дні до звичайного розбору'], ['week1', 'mkd-d7--w1', 'дні 1–7 після плану'], ['week2', 'mkd-d7--w2', 'дні 8–14 після плану']];
  T.p7 = function (r) {
    var o = pl(r, 'duration') || { items: [], avg: {} }, list = o.items || [], avg = o.avg || {};
    var sc = Math.max(30, Math.ceil(Math.max.apply(null, list.map(function (x) { return x.total || 0; }).concat([0]))));
    var bar = function (d) {
      return '<span class="mkd-d7" role="img" aria-label="' + esc(ST7.map(function (k) { return k[2] + ' — ' + X.n1(d[k[0]] || 0); }).join(', ')) + '">' + ST7.filter(function (k) { return d[k[0]]; }).map(function (k) {
        var w = d[k[0]] / sc * 100;
        return '<i class="' + k[1] + '" style="--w:' + w.toFixed(1) + '%">' + (w >= 4 ? X.n1(d[k[0]]) : '') + '</i>';
      }).join('') + '</span>';
    };
    var rows = list.map(function (a) {
      return { cells: [[esc(nm(a)) + (a.outcome === 'not_needed' ? ' <span class="kb-cs">· не потрібно</span>' : '')], [bar(a)], ['<b>' + X.n1(a.total) + '</b>', 'kb-r']] };
    });
    if (avg.n) rows.push({ cls: 'mkd-t__tot', cells: [['Середнє (' + X.acts(avg.n) + ' з планом)'], [bar(avg)], [X.n1(avg.total), 'kb-r']] });
    var body = list.length ? X.table([['Дія'], ['дні на кожному етапі (шкала 0–' + sc + ' днів)', 'mkd-t__wide'], ['усього днів', 'kb-r']], rows, 'mkd-t--d7', 'Скільки триває дія') +
      X.legend(ST7.map(function (k) { return ['<i class="kb-sw ' + k[1] + '"></i>', k[2]]; })) +
      X.foot('«Дострокова: дні до звичайного розбору» — план дострокової дії записали ще до розбору її тижня; спостереження почалось з дня розбору, дні між планом і розбором не рахуються. ' +
        'Дні 1–7 і 8–14 — календарні дні, за які набралось по 7 днів з аудитами; закрита достроково — лише дні 1–7.')
      : X.none('Закритих дій ' + wl(r) + ' немає.');
    return X.card('Скільки триває дія і на якому етапі минає час', 'mkd.p7', '', body, '', 'закриті дії ' + wl(r) + ', від відкриття до закриття');
  };

  var V8 = { no_plan: ['open', 'новий план ще не записано'], changed: ['done', 'так, інші'], same: ['rel', 'та сама причина й той самий захід'] };
  T.p8 = function (r) {
    var list = pl(r, 'repeats') || [], rows = [];
    var plan = function (cause, label, text) { return cause || label || text ? esc([cause || label ? X.cause(cause, label) : '', text || ''].filter(Boolean).join(' — ')) : '<span class="kb-cs">—</span>'; };
    list.forEach(function (a) {
      rows.push({ group: esc(nm(a) + ' · рецидив ' + X.day(a.relapseDay)) });
      (a.types || []).forEach(function (t) {
        var v = V8[t.verdict] || V8.changed, o = a.original || {}, p = a.repeat || {};
        rows.push({ cells: [['<b>' + esc(t.name) + '</b>'], [t.cause1 || t.cause1Label ? plan(t.cause1, t.cause1Label, o.plan) : '<span class="kb-cs">—</span>'],
          [t.verdict === 'no_plan' ? '<span class="kb-cs">—</span>' : plan(t.cause2, t.cause2Label, p.plan), 'kb-hide-m'], [X.chip(v[0], v[1])]] });
      });
    });
    var body = list.length ? X.table([['Вид браку'], ['1-й план: причина — що зробили'], ['2-й план після рецидиву', 'kb-hide-m'], ['причина чи захід змінились?', 'mkd-t__chip']], rows, 'mkd-t--wrap', 'Повторні дії') +
      X.foot('Порівнюємо записане в планах дослівно: причину і «що зроблено» по кожному виду браку.') : X.none('Повторних дій ' + wl(r) + ' не було.');
    return X.card('Повторні дії: чи змінили план після рецидиву', 'mkd.p8', '', body, '', 'для кожного виду браку — перший і другий план');
  };

  T.p9 = function (r) {
    var o = pl(r, 'early') || { items: [], summary: {} }, list = o.items || [], s = o.summary || {}, Tn = r.threshold, g = X.startGen(r.rules);
    var wd = function (d) { return d ? WD[new Date(Date.parse(d + 'T12:00:00Z')).getUTCDay()] + ' ' + X.day(d) : '—'; };
    var body = list.length ? X.table([['Дія'], ['відкрито посеред тижня', 'kb-hide-m'], ['перевірено з ' + g, 'kb-r kb-hide-m'], ['брак з ' + g + ' до відкриття', 'kb-r'], ['брак за весь тиждень', 'kb-r'], ['тиждень понад норму ' + Tn + '%?', 'mkd-t__chip']],
      list.map(function (a) {
        var st = !a.weekDone ? X.chip('none', 'тиждень ще йде') : a.over ? X.chip('open', 'так') : X.chip('obs', 'ні — дія лишилась відкритою');
        return { cells: [['<span class="mkd-nm"><b>' + esc(nm(a)) + '</b><span class="kb-cs mkd-only-m">відкрито ' + esc(wd(a.openedAt)) + '</span></span>'], [esc(wd(a.openedAt)), 'kb-nw kb-hide-m'], [X.num(a.checkedBefore) + ' шт', 'kb-r kb-hide-m'], ['<b class="kb-up">' + X.p(a.rateBefore) + '</b>', 'kb-r'],
          [a.weekDone ? '<b class="' + (a.weekRate != null && a.weekRate > Tn ? 'kb-up' : '') + '">' + X.p(a.weekRate) + '</b>' : '—', 'kb-r'], [st]] };
      }), '', 'Дострокові дії') +
      '<p class="mkd-sum">Завершених тижнів: <b>' + (s.done || 0) + '</b> · понад норму за весь тиждень: <b>' + (s.over || 0) + '</b> · не вище норми: <b>' + (s.notOver || 0) + '</b></p>' +
      X.foot('Дострокова дія лишається відкритою, навіть коли весь тиждень закінчився не вище норми. Тут видно, як часто так буває.')
      : X.none('Дострокових дій ' + wl(r) + ' не було.');
    return X.card('Дострокові дії: чим закінчився тиждень відкриття', 'mkd.p9', '', body, '', r.weeks + ' ' + P.plural(r.weeks, 'тиждень', 'тижні', 'тижнів') + ' · відкриття, коли брак з ' + g + ' точно понад норму');
  };

  T.p10 = function (r) {
    var list = r.sameDepts || [], locs = r.locations || [], Tn = r.threshold, wlx = wl(r);
    var cell = function (c) {
      if (!c || !c.departmentId) return '<span class="kb-cs">такого відділу немає</span>';
      return '<span class="mkd-sd"><b class="mkd-sd__v' + (c.rate != null && c.rate > Tn ? ' kb-up' : '') + '">' + X.p(c.rate) + '</b><span class="mkd-sd__s">' +
        (c.opened ? 'дій: <b>' + c.opened + '</b> · ✓ ' + (c.closedOk || 0) + ' · <b class="' + (c.relapses ? 'kb-up' : 'kb-zr') + '">✕ ' + (c.relapses || 0) + '</b>' : 'дій не було') + '</span></span>';
    };
    var body = list.length ? X.table([['Тип відділу']].concat(locs.map(function (l) { return [esc(l.name) + ': середній брак ' + wlx + ' · дії']; })),
      list.map(function (d) { return { cells: [['<b>' + esc(d.name) + '</b>']].concat(locs.map(function (l, i) { return [cell((d.cells || [])[i])]; })) }; }), 'mkd-t--sd', 'Однакові відділи в різних цехах') +
      X.legend([['✓', 'закрито: тримається або види нижче'], ['<b class="kb-up">✕</b>', 'рецидивів'], ['', 'червоне число — середній брак понад ' + Tn + '%']]) +
      X.foot('Пошив порівнюємо з пошивом, а не з пакуванням: у різних відділів різний звичний рівень браку.') : X.none('Відділів немає.');
    return X.card('Однакові відділи в різних цехах', 'mkd.p10', 'брак, дії й результати ' + wlx, body);
  };
})(window);
