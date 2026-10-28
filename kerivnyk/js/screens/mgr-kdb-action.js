(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, X = P.mgrKdb;
  var PHASE = { open: ['open', 'Без плану'], relapse: ['rel', 'Рецидив · новий план ще не записано'], observe: ['obs', 'На спостереженні'] };
  var FINAL = { helped: ['done', '✓ Закрито: тримається'], held_types: ['part', '✓ Закрито: її види браку нижче, ніж до дії'], not_needed: ['skip', '○ Старший позначив «не потрібно»'], not_helped: ['rel', '✕ Закрито: рецидив'],
    self_closed: ['done', '✓ Закрито без участі старшого: брак упав, аналізу й плану не було'] };
  var FINAL_EARLY = ['done', '✓ Закрито достроково: брак видів дії впав щонайменше вдвічі'];
  var VERD = { norm: ['done', '✓ брак відділу не вище норми'], types_lower: ['part', 'відділ понад норму, види дії нижче, ніж до дії'], relapse: ['rel', '✕ рецидив'] };
  var STAGE = { early: 'відкрито достроково', open: 'без плану', week1: 'дні 1–7 після плану', week2: 'дні 8–14 після плану', quiet: 'тихий нагляд', relapse: 'рецидив' };
  var PER = { p1: 'дні 1–7 після плану', p2: 'дні 8–14 після плану', quiet: 'тихий нагляд' };

  function perRng(w) { return (w.start === w.end ? X.day(w.start) : X.rng(w.start, w.end)) + (w.estimated ? ' (кінець ≈)' : ''); }
  function phasePill(kd) {
    if (kd.phaseUi === 'final') {
      var f = kd.closedEarly ? FINAL_EARLY : FINAL[kd.status] || FINAL.helped;
      return X.chip(f[0], esc(f[1] + (kd.finishedOn ? ' · ' + X.day(kd.finishedOn) : '')));
    }
    if (kd.phaseUi === 'observe') {
      var w = (kd.weeks || []).filter(function (x) { return x.status === 'running'; })[0], w0 = (kd.weeks || [])[0];
      if (kd.inExtra) return X.chip('obs', esc('План є · ' + (kd.early ? 'дострокова: ' : '') + 'чекаємо звичайного розбору, спостереження з ' + X.day(w0 && w0.start)));
      return X.chip('obs', esc(w ? (kd.obsDay ? 'На спостереженні · день ' + kd.obsDay + ' з 14' : 'На спостереженні · днів з аудитами ще немає') : 'План є · спостереження з ' + X.day(w0 && w0.start)));
    }
    var p = PHASE[kd.phaseUi] || PHASE.open;
    if (kd.analysis) return X.chip(p[0], esc((kd.phaseUi === 'relapse' ? 'Рецидив · ' : '') + 'Аналіз · ' + kd.analysis.days + '-й день · плану ще немає'));   // v1.2
    return X.chip(p[0], esc(p[1]));
  }
  var STAGE_NAME = { open: 'Відкрито', analysis: 'Аналіз', plan: 'План і впровадження', week1: 'Дні 1–7', week2: 'Дні 8–14', closed: 'Закрито' };
  function stages(kd) {
    var list = kd.stages || [];
    if (!list.length) return '';
    return '<ol class="kb-stp" aria-label="Етапи дії">' + list.map(function (s) {
      var name = s.id === 'closed' && s.state === 'done' ? (kd.selfClosed ? 'Закрито без участі старшого' : kd.closedEarly ? 'Закрито достроково' : X.OUT[kd.status] ? 'Закрито: ' + X.OUT[kd.status] : STAGE_NAME.closed) : STAGE_NAME[s.id] || s.id;
      if (s.id === 'analysis' && s.state === 'now' && kd.analysis) name += ' · ' + kd.analysis.days + '-й день';
      var when = s.state === 'skip' ? 'не було' : s.state === 'next' ? 'попереду' : s.from && s.to && s.to !== s.from ? X.rng(s.from, s.to) : s.from ? (s.state === 'now' ? 'з ' : '') + X.day(s.from) : '';
      return '<li class="kb-stp__i kb-stp__i--' + s.state + '"><i class="kb-stp__m">' + (s.state === 'done' ? '✓' : '') + '</i><span><b>' + esc(name) + '</b><span class="kb-cs">' + esc(when) + '</span></span></li>';
    }).join('') + '</ol>';
  }
  function anLine(kd) {
    var a = kd.analysis;
    if (!a) return '';
    return '<p class="kb-an"><b>Аналіз ' + (a.to ? esc(X.rng(a.from, a.to)) : 'з ' + esc(X.day(a.from)) + ' · ' + a.days + '-й день') + '</b>' + (a.byName ? ' · почав(ла) ' + esc(a.byName) : '') +
      (a.note ? ' · що перевіряють: «' + esc(a.note) + '»' : '') + '</p>';
  }
  function selfBlock(kd, T) {
    var s = kd.selfClose;
    if (!s) return '';
    var ok = function (v) { return v ? '<b class="kb-dn">✓</b>' : '<b class="kb-up">✕</b>'; };
    return '<section class="mkd-act__s"><h3 class="kb-ct">Закрито без участі старшого · ' + esc(X.day(s.day)) + '</h3>' +
      '<p class="mkd-act__p">Аналізу й плану не було. За ' + esc(X.rng(s.from, s.to)) + ' (після дня відкриття) брак упав — дія закрилась сама.</p>' + X.table(
      [['Умова'], ['зараз', 'kb-r'], ['потрібно', 'kb-r'], ['', 'kb-r']],
      [{ cells: [['минуло днів після дня відкриття'], [String(s.days), 'kb-r'], [s.needDays + '–' + (s.maxDays || 7), 'kb-r kb-nw'], [ok(s.daysOk), 'kb-r']] },
        { cells: [['перевірено за ці дні'], [X.num(s.checked) + ' шт', 'kb-r kb-nw'], ['щонайменше ' + X.num(s.min) + ' шт', 'kb-r kb-nw'], [ok(s.minOk), 'kb-r']] },
        { cells: [['брак відділу за ці дні'], [X.p(s.deptRate), 'kb-r'], ['не вище ' + esc(String(T)) + '%', 'kb-r kb-nw'], [ok(s.deptOk), 'kb-r']] },
        { cells: [['види браку дії: верхній край смуги точності <span class="kb-cs mkd-block">брак видів дії ' + X.arrow(s.typesBefore, s.typesRate) + '</span>'], [X.p(s.hi), 'kb-r'],
          ['не вище ½ «до» = ' + X.p(s.half), 'kb-r kb-nw'], [ok(s.typesOk), 'kb-r']] }], 'mkd-t--sm', 'Умови закриття без участі старшого') +
      X.foot('«До» — види браку дії разом за ' + esc(X.rng(s.baseFrom, s.baseTo)) + ', коли дію відкрили.') + '</section>';
  }
  function quietPill(kd) {
    var q = (kd.weeks || []).filter(function (x) { return x.kind === 'quiet'; })[0];
    if (!kd.closedEarly || !q) return '';
    if (q.status !== 'done') return X.chip('none', esc('тихий нагляд ' + (q.status === 'running' ? 'іде · днів з аудитами ' + q.days + ' з 7' : 'з ' + X.day(q.start))));
    return kd.quietReturned ? X.chip('rel', esc('✕ брак повернувся в тихий нагляд · ' + X.rng(q.start, q.end))) : X.chip('none', esc('тихий нагляд ' + X.rng(q.start, q.end) + ' завершився'));
  }
  function closeBlock(c, w1, T) {
    if (!c || (!c.final && (!w1 || w1.status === 'done'))) return '';
    var ok = function (v) { return v ? '<b class="kb-dn">✓</b>' : '<b class="kb-up">✕</b>'; };
    var head = c.final ? (c.ok ? 'закрито достроково' : 'умови не виконано') : 'поки, за дні, що минули';
    return '<section class="mkd-act__s"><h3 class="kb-ct">Дострокове закриття після дня 7 · ' + esc(head) + '</h3>' + X.table(
      [['Умова'], ['зараз', 'kb-r'], ['потрібно', 'kb-r'], ['', 'kb-r']],
      [{ cells: [['перевірено за дні 1–7'], [X.num(c.checked) + ' шт', 'kb-r kb-nw'], ['щонайменше ' + X.num(c.min) + ' шт', 'kb-r kb-nw'], [ok(c.minOk), 'kb-r']] },
        { cells: [['брак відділу за дні 1–7'], [X.p(c.deptRate), 'kb-r'], ['не вище ' + esc(String(T)) + '%', 'kb-r kb-nw'], [ok(c.deptOk), 'kb-r']] },
        { cells: [['види браку дії: верхній край смуги точності <span class="kb-cs mkd-block">брак видів дії ' + X.p(c.typesRate) + '</span>'], [X.p(c.hi), 'kb-r'],
          ['не вище ½ «до» = ' + X.p(c.half), 'kb-r kb-nw'], [ok(c.typesOk), 'kb-r']] }], 'mkd-t--sm', 'Умови дострокового закриття') + '</section>';
  }
  function tags(kd) {
    return [kd.early ? 'відкрито достроково, посеред тижня' : '', (kd.parallelWith || []).length ? 'паралельна — у відділі є ще дія' : '', kd.repeatOf ? 'повторна — після рецидиву' : '']
      .filter(Boolean).map(function (t) { return X.chip('none', esc(t)); }).join('');
  }
  function kpi(label, val, sub) {
    return '<div class="kb-kpi"><span class="kb-kpi__l">' + esc(label) + '</span><span class="kb-kpi__v">' + val + '</span>' + (sub ? '<span class="kb-kpi__s">' + sub + '</span>' : '') + '</div>';
  }
  function startSum(kd) {
    var t = (kd.types || []).filter(function (x) { return x.start != null; });
    return t.length ? Math.round(t.reduce(function (s, x) { return s + x.start; }, 0) * 10) / 10 : null;
  }

  function body(kd, T) {
    var start = startSum(kd), w1 = (kd.weeks || [])[0], w2 = (kd.weeks || [])[1];
    var wv = function (w) { return w && w.status !== 'future' ? X.p(w.deptRate) : '—'; };
    var ws = function (w) {
      if (!w) return 'плану ще немає';
      if (w.status === 'future') return 'ще не почались · з ' + X.day(w.start) + ' · кінець ≈ ' + X.day(w.end);
      return perRng(w) + (w.status === 'running' ? ' · поки, днів з аудитами ' + w.days + ' з 7' : '') + ' · види браку дії ' + X.p(w.typesRate);
    };
    var w2l = w2 && w2.kind === 'quiet' ? 'Брак відділу, тихий нагляд' : 'Брак відділу, дні 8–14 після плану';
    var out = '<div class="kb mkd-act"><div class="kb-chips">' + phasePill(kd) + quietPill(kd) + tags(kd) + '</div>' + stages(kd) + anLine(kd) +
      '<div class="kb-kpis mkd-act__k">' +
      kpi('Відкрито', esc(X.day(kd.openedAt)), esc('тиждень ' + X.rng(kd.periodStart, kd.periodEnd) + ' · брак відділу ' + X.p(kd.openRate))) +
      (kd.selfClose ? kpi('Закрито без участі старшого', esc(X.day(kd.finishedOn)), esc('плану не було · брак упав за ' + X.rng(kd.selfClose.from, kd.selfClose.to)))
        : kpi('Впроваджено', esc(kd.implementedAt ? X.day(kd.implementedAt) : '—'), esc(kd.implementedAt ? (kd.daysToImplement != null ? X.days(kd.daysToImplement) + ' від відкриття' : '') : 'плану ще немає'))) +
      kpi(kd.implementedAt ? 'Види браку дії до дії (на день плану)' : 'Види браку дії на початку', esc(X.p(start)),
        esc(kd.startFrom ? X.rng(kd.startFrom, kd.startTo) + ' · ' + X.num(kd.startPieces) + ' шт з ' + X.num(kd.startChecked) : '')) +
      kpi('Брак відділу, дні 1–7 після плану', esc(wv(w1)), esc(ws(w1))) +
      kpi(w2l, esc(wv(w2)), esc(w2 ? ws(w2) : w1 ? (kd.status === 'not_helped' ? 'рецидив у днях 1–7' : 'ще не почались') : 'плану ще немає')) + '</div>';
    if (kd.implementedAt) {
      out += '<section class="mkd-act__s"><h3 class="kb-ct">Впроваджений план</h3><p class="mkd-act__p"><b>Відповідальний:</b> ' + esc(kd.whoName || '—') + '</p>' +
        '<p class="mkd-act__p"><b>Що зроблено:</b> ' + esc(kd.plan || '—') + '</p>' + (kd.causeNote ? '<p class="mkd-act__p"><b>Примітка:</b> ' + esc(kd.causeNote) + '</p>' : '') + '</section>';
    }
    if (kd.status === 'not_needed' && kd.notNeededReason) out += '<section class="mkd-act__s"><h3 class="kb-ct">Чому «не потрібно»</h3><p class="mkd-act__p">' + esc(kd.notNeededReason) + '</p></section>';
    out += selfBlock(kd, T);
    if ((kd.weeks || []).length) {
      var rows = kd.extra ? [{ cells: [[X.nm('дострокова: до звичайного розбору', X.rng(kd.extra.from, kd.extra.to))], ['—', 'kb-r kb-hide-m'], ['—', 'kb-r'], ['—', 'kb-r'],
        ['', 'kb-r kb-hide-m'], [X.chip('none', 'не рахуються')]] }] : [];
      out += '<section class="mkd-act__s"><h3 class="kb-ct">Результат за дні після плану</h3>' + X.table(
        [['Дні'], ['днів з аудитами', 'kb-r kb-hide-m'], ['брак відділу', 'kb-r'], ['види браку дії разом', 'kb-r'], ['до дії', 'kb-r kb-hide-m'], ['що вийшло']],
        rows.concat(kd.weeks.map(function (w) {
          var v = w.kind === 'quiet' && w.verdict === 'relapse' ? ['rel', '✕ брак повернувся'] : VERD[w.verdict];
          return { cells: [[X.nm(PER[w.kind] || '', w.status === 'future' ? 'з ' + X.day(w.start) + ' · кінець ≈ ' + X.day(w.end) : perRng(w))], [w.days + ' з ' + (w.need || 7), 'kb-r kb-hide-m'],
            [w.status === 'future' ? 'ще не почались' : '<b class="' + (w.deptRate != null && w.deptRate > T ? 'kb-up' : '') + '">' + X.p(w.deptRate) + '</b>', 'kb-r'],
            [w.status === 'future' ? '—' : X.arrow(w.typesBefore, w.typesRate), 'kb-r'], [X.p(w.typesBefore), 'kb-r kb-hide-m'],
            [w.status === 'running' ? X.chip('none', 'іде · поки') : w.status === 'future' ? '—' : v ? X.chip(v[0], esc(v[1])) : '—']] };
        })), 'mkd-t--sm', 'Результат за дні після плану') + X.foot('Спостереження — з наступного дня після плану: 14 днів, коли у відділі були аудити (дні 1–7 і 8–14). «До дії» — види браку дії разом на день плану' +
          (kd.photoFrom ? ' (' + esc(X.rng(kd.photoFrom, kd.photoTo)) + ')' : '') + '.') + '</section>';
      out += closeBlock(kd.weeks[0].close, kd.weeks[0], T);
    }
    var types = kd.types || [];
    out += '<section class="mkd-act__s"><h3 class="kb-ct">Види браку дії · ' + types.length + '</h3>' + (types.length ? X.table(
      [['Вид браку'], ['причина в плані', 'kb-hide-m'], ['на початку → зараз', 'kb-r']],
      types.map(function (t) {
        return { cells: [['<span class="mkd-nm"><b>' + X.lvlDot(t.level) + ' ' + esc(t.name) + '</b><span class="kb-cs">' + esc(X.LV_WORD[t.level] || '') + '</span></span>'],
          [t.cause || t.causeLabel ? esc(X.cause(t.cause, t.causeLabel)) + (t.causeNote ? '<span class="kb-cs mkd-block">' + esc(t.causeNote) + '</span>' : '') : '<span class="kb-cs">ще не записано</span>', 'kb-hide-m'],
          [X.arrow(t.start, t.now), 'kb-r kb-nw']] };
      }), 'mkd-t--sm', 'Види браку дії') : X.none('Видів браку в дії немає.')) + '</section>';
    var nums = kd.numbers || [];
    if (nums.length) {
      out += '<section class="mkd-act__s"><h3 class="kb-ct">Відділ по тижнях</h3>' + X.table(
        [['Тиждень'], ['перевірено', 'kb-r kb-hide-m'], ['брак відділу', 'kb-r'], ['види браку дії', 'kb-r'], ['інші види', 'kb-r kb-hide-m'], ['етап дії', 'kb-hide-m']],
        nums.map(function (n) {
          return { cells: [[esc(X.rng(n.start, n.end))], [X.num(n.checked) + ' шт', 'kb-r kb-hide-m'], ['<b class="' + (n.rate != null && n.rate > T ? 'kb-up' : '') + '">' + X.p(n.rate) + '</b>', 'kb-r'],
            [X.p(n.typesRate), 'kb-r'], [X.p(n.otherRate), 'kb-r kb-hide-m'], [esc(STAGE[n.stage] || '—'), 'kb-hide-m']] };
        }), 'mkd-t--sm', 'Відділ по тижнях') + '</section>';
    }
    return out + '</div>';
  }

  X.openAction = function (ctx, locId, key) {
    if (!locId || !key) return;
    var m = P.sr.modal({ title: 'Коригуюча дія', sub: 'лише перегляд', body: P.sr.h.loading() });
    P.srv('mgrKdAction', { locationId: locId, key: key }).then(function (r) {
      if (m.closed || !ctx.alive()) { m.close(); return; }
      if (!r.ok || !r.kd) { m.body(r.ok ? P.sr.h.empty('Дію не знайдено', 'Оновіть сторінку.') : P.sr.h.error(r)); return; }
      var kd = r.kd, t = m.el.querySelector('.modal__title'), s = m.el.querySelector('.modal__head .hint');
      if (t) t.textContent = kd.departmentName + ' №' + kd.no + ' · коригуюча дія';
      if (s) s.textContent = (r.location ? r.location.name + ' · ' : '') + 'лише перегляд';
      m.body(body(kd, r.threshold));
    });
  };
})(window);
