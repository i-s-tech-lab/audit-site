(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;
  var help = function (k) { return P.help ? P.help.btn(k) : ''; };

  function of(pcs, checked) { return K.num(pcs) + ' шт з ' + K.num(checked) + ' перевірених'; }
  K.formula = function (a, T) {
    return '<p class="kd-formula"><b' + (a.rate != null && a.rate > T ? ' class="kd-hot"' : '') + '>' + K.pct(a.rate) + '</b><span>= ' + K.num(a.rejected) + ' шт браку ÷ ' +
      K.num(a.checked) + ' перевірених у відділі за ' + esc(K.week(a.periodStart, a.periodEnd)) + (a.current ? ' (тиждень триває)' : '') + '</span>' + H.badge('норма ' + T + '%') + '</p>';
  };
  K.itemsTable = function (a, R) {
    if (!a.items.length) return '<p class="kd-text">Браку у відділі за тиждень не записано — пунктів немає.</p>' + openNote(a);
    var hasAfter = a.result != null, hasHold = a.hold != null;
    var res = a.result, ho = a.hold;
    var th = '<tr><th>Вид браку' + help('term.defectType') + '</th><th class="n">частка браку' + help('kd.pareto') + '</th>' +
      '<th class="n">до, %' + help('kd.beforeAfter') + '</th>' + (hasAfter ? '<th class="n">після, %<span class="sub">дні 1–7 · ' + esc(K.rangeShort(res.start, res.end)) + (res.pending ? ' · ідуть' : '') + '</span></th>' : '') +
      (hasHold ? '<th class="n">після, %<span class="sub">дні 8–14 · ' + esc(K.rangeShort(ho.start, ho.end)) + (ho.pending ? ' · ідуть' : '') + '</span></th>' : '') + '</tr>';
    var rows = a.items.map(function (it) {
      return '<tr><td><b>' + esc(it.name) + '</b><span class="sub">' + H.lvl(it.level) + '</span></td>' +
        '<td class="n">' + K.pct(it.share) + '<span class="sub">' + K.num(it.pieces) + ' шт · разом ' + K.pct(it.cumShare) + '</span></td><td class="n"><b>' + K.pct(it.before) + '</b></td>' +
        (hasAfter ? '<td class="n"><b>' + (it.after == null ? '—' : (res.pending ? 'поки ' : '') + K.pct(it.after)) + '</b>' +
          (it.delta != null ? '<span class="sub kd-nowrap">' + esc(K.delta(it.before, it.after)) + '</span>' : it.afterPieces != null ? '<span class="sub">' + K.num(it.afterPieces) + ' шт</span>' : '') + '</td>' : '') +
        (hasHold ? '<td class="n">' + (it.after2 == null ? '—' : (ho.pending ? 'поки ' : '') + K.pct(it.after2)) + '</td>' : '') + '</tr>';
    }).join('');
    var sum = a.implementedAt && a.typesBefore != null ? '<tr><td><b>Види дії разом</b><span class="sub">усі пункти разом</span></td><td class="n">' + K.pct(a.itemsShare) + '</td>' +
      '<td class="n"><b>' + K.pct(a.typesBefore) + '</b></td>' +
      (hasAfter ? '<td class="n"><b>' + (a.typesAfter == null ? '—' : (res.pending ? 'поки ' : '') + K.pct(a.typesAfter)) + '</b>' +
        (a.typesAfter != null && !res.pending ? '<span class="sub kd-nowrap">' + esc(K.delta(a.typesBefore, a.typesAfter)) + '</span>' : '') + '</td>' : '') +
      (hasHold ? '<td class="n">' + (a.typesAfter2 == null ? '—' : (ho.pending ? 'поки ' : '') + K.pct(a.typesAfter2)) + '</td>' : '') + '</tr>' : '';
    var from = (a.implementedAt ? a.baseFrom : a.liveFrom) || a.periodStart, to = (a.implementedAt ? a.baseTo : a.liveTo) || a.periodEnd;
    return '<div class="tbl-box"><table class="tbl kd-items">' + '<thead>' + th + '</thead><tbody>' + rows + sum + '</tbody></table></div>' +
      K.cap('Пункти — Парето за ' + esc(K.range(from, to)) + (a.implementedAt ? ' (база «до»)' : '') + ': види браку в порядку ' + esc(K.paretoOrderText(R)) +
        ' (усередині — від більшої кількості шт); вид заходить, лише якщо повністю вміщається в ' + a.pareto + '% браку відділу (тут — ' + K.pct(a.itemsShare) +
        '). % — шт виду браку ÷ перевірено у відділі за ці дні.') + openNote(a);
  };
  function openNote(a) {
    return K.isOpen(a) ? '<p class="hint">Список видів браку ще може змінитися до запису плану.</p>' + K.changesLog(a) : '';
  }
  K.changesLog = function (a) {
    var ch = (a.changes || []).slice().reverse(), pc = function (x) { return esc(x.name) + ' (' + K.num(x.pieces) + ' шт)'; };
    if (!ch.length) return '';
    return '<div class="kd-chg" data-kd-more><p class="kd-sec">Зміни списку видів браку' + help('kd.changes') + '</p><ul class="kd-chg__l">' + ch.map(function (c, i) {
      var what = [(c.added || []).length ? 'додано: ' + c.added.map(pc).join(', ') : '', (c.removed || []).length ? 'вибуло: ' + c.removed.map(pc).join(', ') : ''].filter(Boolean).join('; ');
      return '<li' + (i >= 3 ? ' class="kd-x"' : '') + '><b>' + esc(K.wd(c.day)) + '</b> — ' + what + '</li>';
    }).join('') + '</ul>' + K.moreBtn(ch.length, 3, 'Показати всі') + '</div>';
  };
  var VERDICT = { norm: 'відділ у нормі', types_lower: 'відділ понад норму, але види дії разом нижче, ніж до дії', relapse: 'рецидив' };
  K.obsSteps = function (a, T) {
    var done = 'num-badge num-badge--done', grey = ' style="background:var(--surface-3);color:var(--text-3)"';
    var step = function (n, on, title, text) {
      return '<div><span class="' + (on === 'done' ? done : 'num-badge') + '"' + (on === 'wait' ? grey : '') + '>' + n + '</span><div><b' + (on === 'wait' ? ' style="color:var(--text-2)"' : '') + '>' + title + '</b>' +
        (text ? '<p class="hint">' + text + '</p>' : '') + '</div></div>';
    };
    var wk = function (w, label, verdict, types) {
      if (!w) return '';
      if (w.future) return label + ' почнеться ' + esc(K.wd(w.start)) + '.';
      if (w.pending) return 'Тиждень триває (день ' + w.daysDone + ' з ' + w.days + '): поки ' + K.pct(w.rate) + ' · ' + of(w.rejected, w.checked) + '.';
      return 'Брак, % відділу ' + K.pct(w.rate) + ' · ' + of(w.rejected, w.checked) + ' — ' + (w.rate > T ? 'понад норму ' : 'не вище норми ') + T + '%.' +
        (types != null && a.typesBefore != null ? ' Види дії разом: ' + K.pct(a.typesBefore) + ' до дії → ' + K.pct(types) + '.' : '') +
        (VERDICT[verdict] ? ' <b>Тиждень: ' + VERDICT[verdict] + '.</b>' : '');
    };
    var html = step(1, 'done', 'Відкрито ' + esc(K.wd(a.openedAt)) + (a.early ? ' · ранній тумблер' : ' · розбір'),
      'Брак, % відділу за ' + esc(K.week(a.periodStart, a.periodEnd)) + (a.current ? ' (тиждень триває)' : '') + ': ' + K.pct(a.rate) + ' · ' + of(a.rejected, a.checked) +
      (a.earlyBelow ? ' — тиждень завершився не вище норми ' + T + '%' : '') + '.');
    if (a.status === 'not_needed') return '<div class="kd-steps">' + html + step(2, 'done', 'Дія не потрібна · ' + esc(H.dayShort(a.notNeededAt)), '«' + esc(a.notNeededReason) + '»') + '</div>';
    if (!a.implementedAt) {
      var grow = a.openRate != null || a.nowRate != null ? 'Брак, % відділу від початку тижня відкриття: до дня відкриття ' + K.pct(a.openRate) +
        (a.nowRate != null ? ' → до сьогодні ' + K.pct(a.nowRate) : '') + '.' : '';
      var sp = a.earlySplit;
      if (a.status === 'pre') html += step(2, 'now', 'Тиждень ще йде', (sp ? 'Після дня відкриття, поки: ' + K.pct(sp.after.rate) + ' · ' + of(sp.after.rejected, sp.after.checked) + '. ' : '') +
        'Дострокова дія остаточна: коли тиждень закінчиться, вона лишиться відкритою, навіть якщо брак, % відділу за тиждень буде не вище норми ' + T + '%.');
      var n = a.status === 'pre' ? 3 : 2;
      return '<div class="kd-steps">' + html + step(n, 'now', 'Впроваджений план — ще не записано',
        [grow, a.overWeeks >= 2 ? 'Понад норму ' + K.plural(a.overWeeks, 'тиждень', 'тижні', 'тижнів') + ' поспіль.' : ''].filter(Boolean).join(' ')) +
        step(n + 1, 'wait', 'Дні 1–7 після плану', 'Перші 7 днів з аудитами, з наступного дня після впровадження.') + '</div>';
    }
    html += step(2, 'done', 'Впроваджено ' + esc(K.wd(a.implementedAt)), 'Через ' + K.plural(a.daysToImplement, 'день', 'дні', 'днів') + ' після відкриття.');
    var r = a.result, h = a.hold;
    html += step(3, r.pending ? 'now' : 'done', 'Дні 1–7 після плану · ' + esc(K.range(r.start, r.end)), wk(r, 'Дні 1–7 після плану', a.week1Verdict, a.typesAfter));
    if (a.relapseStage === 1) return '<div class="kd-steps">' + html + '</div>';
    html += h ? step(4, h.pending ? 'now' : 'done', 'Дні 8–14 після плану · ' + esc(K.range(h.start, h.end)), wk(h, 'Дні 8–14 після плану', a.week2Verdict, a.typesAfter2))
      : a.closedEarly ? step(4, 'done', 'Закрито достроково · ' + esc(K.range(r.start, r.end)), 'Після днів 1–7 виконано всі три умови дострокового закриття; далі — 7 днів тихого нагляду.')
      : step(4, 'wait', 'Дні 8–14 після плану', 'Наступні 7 днів з аудитами.');
    return '<div class="kd-steps">' + html + '</div>';
  };
  function chartBlock(a, T) {
    return '<div class="facts"><p class="group-label" style="padding:0">Брак відділу по тижнях, %</p>' +
      K.cap('Відділ «' + esc(a.departmentName) + '», тижні ' + esc(K.spanOf(a.series)) + '. Рамка — тиждень КД; ● — тиждень, за який відкрито КД (колір — стан); риска — норма ' + T + '%.') +
      '<div data-chart="kd-item"></div></div>';
  }
  function mountChart(el, a, T) {
    var sel = {}; sel[a.period] = 'тиждень КД';
    if (a.result && !a.result.future) sel[a.result.n] = 'тут закінчуються дні 1–7 після плану';
    if (a.hold && !a.hold.future) sel[a.hold.n] = 'тут закінчуються дні 8–14 після плану';
    K.deptChart(el.querySelector('[data-chart="kd-item"]'), a.series, { sel: sel, T: T, height: 150, label: 'Брак відділу «' + a.departmentName + '» по тижнях, %' });
  }
  function whoBlock(a) {
    var per = esc(K.rangeShort(a.periodStart, a.periodEnd));
    return '<div class="facts"><p class="group-label" style="padding:0">У кого брак · тиждень ' + per + '</p>' + K.who(K.workerRows(a.workers), { empty: 'Винних у записах не вказано' }) +
      '<p class="group-label" style="padding:6px 0 0">Хто записує · тиждень ' + per + '</p>' + K.who(K.auditorRows(a.auditors), { empty: 'Записів немає' }) + '</div>';
  }

  K.openPlan = function (ctx, r0, opts) {
    opts = opts || {};
    P.srv('srKdItem', Object.assign({ locationId: ctx.loc.id }, r0)).then(function (r) {
      if (!ctx.alive()) return null;
      if (!r.ok) { P.toast('danger', 'Не вдалося відкрити КД', r.error); return null; }
      if (opts.edit) return { r: r, pl: null };
      return P.srv('srKdPlanItems', { locationId: ctx.loc.id, departmentId: r.item.departmentId, period: r.item.period, day: r.today }).then(function (pl) { return { r: r, pl: pl.ok ? pl : null }; });
    }).then(function (x) {
      if (!x || !ctx.alive()) return;
      var r = x.r;
      var a = r.item, T = r.threshold, edit = !!opts.edit, lockDay = edit && a.status !== 'check';
      var rows = (x.pl ? x.pl.items : a.items).map(function (it) { return { defectTypeId: it.defectTypeId, name: it.name, level: it.level, share: it.share }; });
      var WHOLE = { defectTypeId: '', name: 'Уся дія', level: null, share: null, whole: true }, curRows = function () { return rows.length ? rows : [WHOLE]; };
      var asked = 0;   // номер останнього запиту до сервера — відповідь на старіший ігноруємо
      var pend = Promise.resolve();   // v2.6: перечитування списку, що ще йде: «Записати» чекає на нього (рядки завжди = дата)
      var picked = {}, notes = {}, oldMain = edit && !a.causePerItem ? a.causes[0] || null : null;
      if (edit) {
        a.items.forEach(function (it) { picked[it.defectTypeId] = it.cause || oldMain; notes[it.defectTypeId] = it.causeNote || (oldMain === 'other' ? a.causeNote : ''); });
        if (!a.items.length) { picked[''] = oldMain; notes[''] = oldMain === 'other' ? a.causeNote : ''; }
      }
      var left = '<div class="col" style="flex-basis:440px"><h3 class="card-title">' + esc(a.departmentName) + ' · ' + esc(K.week(a.periodStart, a.periodEnd)) + '</h3>' +
        K.formula(a, T) + '<p class="hint">Відкрито ' + esc(K.wd(a.openedAt)) + (a.early ? ' за раннім тумблером' : ' на розборі') + '.</p>' +
        '<p class="group-label" style="padding:0">Пункти КД' + help('kd.pareto') + '</p>' + K.itemsTable(a, r.rules) + chartBlock(a, T) + whoBlock(a) + '</div>';
      var right = '<div class="col" style="flex-basis:480px">' +
        '<div class="field"><span class="label"><span class="num-badge" style="margin-right:8px">1</span>Причина для кожного виду браку</span>' +
        (edit && !a.causePerItem && a.causes.length ? '<p class="hint">Раніше причини було записано на всю дію: ' + esc(K.causeText(a)) + '. Підставлена головна — ' +
          (a.items.length ? 'оберіть для кожного виду браку свою.' : 'у дії немає видів браку, тож лишається одна причина на всю дію.') + '</p>' : '') +
        '<p class="hint" data-rows-hint>' + rowsHint() + '</p>' +
        K.errSlot('itemCauses') + '<div data-rows>' + curRows().map(causeRow).join('') + '</div></div>' +
        '<label class="field"><span class="label"><span class="num-badge" style="margin-right:8px">2</span>Що зроблено</span>' +
        '<textarea class="textarea" data-f="plan" maxlength="1000" style="min-height:96px" placeholder="Наприклад: замінили голки на машинах 3 і 5, показали працівникові, як закріплювати шов.">' + esc(a.plan) + '</textarea>' + K.errSlot('plan') + '</label>' +
        '<div class="pair"><label class="field"><span class="label">Хто відповідає</span><select class="input" data-f="who">' + r.people.map(function (u) {
          var sel = edit ? u.id === a.who : u.me;
          return '<option value="' + esc(u.id) + '"' + (sel ? ' selected' : '') + '>' + esc(u.name) + (u.me ? ' (я)' : ' · ' + u.roleLabel.toLowerCase()) + '</option>'; }).join('') +
        '</select>' + K.errSlot('who') + '</label>' +
        '<label class="field"><span class="label">Дата впровадження' + help('kd.implDay') + '</span><input class="input" type="date" data-f="day" min="' + esc(a.openedAt) + '" max="' + esc(r.today) + '" value="' +
          esc(edit ? a.implementedAt : r.today) + '"' + (lockDay ? ' disabled' : '') + '>' + (lockDay ? '<span class="hint">Дні 1–7 після плану вже минули — дату не змінити.</span>' : '') + K.errSlot('day') + '</label></div>' +
        '<div class="banner" style="align-items:center">' + P.ic('info') + '<div class="banner__body"><p class="banner__title"><span class="num-badge" style="width:24px;height:24px;margin-right:6px">3</span>Далі — два тижні спостереження</p>' +
        '<p class="banner__text">Цього дня робиться фото «до дії», а з наступного дня — 14 днів спостереження (лише дні, коли у відділі були аудити): дні 1–7, потім 8–14.<br>' +
        'Брак, % відділу до ' + T + '% включно → тиждень «у нормі»; понад ' + T + '%, а види дії разом нижче, ніж до дії, → «її види нижче, ніж до дії»; понад ' + T + '% і види дії разом не нижче, ніж до дії, → рецидив ✕.<br>' +
        'Два тижні без рецидиву: обидва в нормі → «закрито: тримається»; інакше → «закрито: її види браку нижче, ніж до дії».<br>' +
        'Пункти зафіксуються на дату впровадження.</p></div></div></div>';
      var m = P.sr.modal({
        title: (edit ? 'Змінити план · ' : 'Впроваджений план · ') + a.departmentName,
        sub: esc(K.week(a.periodStart, a.periodEnd)) + ' · брак ' + K.pct(a.rate) + ' (' + of(a.rejected, a.checked) + ') · ' + K.plural(a.items.length, 'пункт', 'пункти', 'пунктів'),
        head: '<span class="kd-head-badge">' + H.badge(K.pct(a.rate) + ' · норма ' + T + '%', a.rate > T ? 'danger' : '') + '</span>',
        body: '<div class="row kd-cols">' + left + right + '</div>',
        foot: '<p class="action-bar__sum kd-foot-note">Одна КД — відділ за тиждень; пункти — види браку з таблиці.</p>' +
          '<button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button>' +
          '<button class="btn btn--primary" type="button" data-act="save">' + P.ic(edit ? 'save' : 'check') + (edit ? 'Зберегти план' : 'Записати впроваджений план') + '</button>',
        on: {
          'kd-all': K.toggleMore,
          cause: function (t) {
            var i = +t.getAttribute('data-i');
            picked[curRows()[i].defectTypeId] = t.getAttribute('data-id');
            drawCauses(m.el, i);
          },
          save: function (t) {
            t.disabled = true;
            pend.then(function () {   // v2.6: спершу — відповідь на зміну дати (якщо ще йде), тоді рядки й дата збігаються
            if (!ctx.alive()) return;
            var el = m.el, val = function (f) { return el.querySelector('[data-f="' + f + '"]').value; };
            readNotes(el);
            var itemCauses = {}, itemNotes = {}, whole = {};
            rows.forEach(function (it) {
              var c = picked[it.defectTypeId];
              if (c) itemCauses[it.defectTypeId] = c;
              if (c === 'other') itemNotes[it.defectTypeId] = notes[it.defectTypeId] || '';
            });
            if (!rows.length) whole = { causes: picked[''] ? [picked['']] : [], causeNote: picked[''] === 'other' ? notes[''] || '' : '' };
            var payload = Object.assign({ locationId: ctx.loc.id, itemCauses: itemCauses, itemNotes: itemNotes, plan: val('plan'), who: val('who'), day: lockDay ? null : val('day') }, whole);
            Object.assign(payload, edit ? { id: a.id } : { departmentId: a.departmentId, period: a.period });
            P.srv(edit ? 'srKdEditPlan' : 'srKdImplement', payload).then(function (res) {
              t.disabled = false;
              if (!res.ok) { if (!K.showErrors(el, withRowErrors(el, res))) P.toast('danger', 'Не вдалося зберегти', res.error); return; }
              m.close();
              var x = res.action;
              K.done(ctx, 'ok', (edit ? 'План змінено · ' : 'Впроваджений план записано · ') + x.departmentName + ' · ' + K.week(x.periodStart, x.periodEnd),
                'Впроваджено ' + H.dayShort(x.implementedAt) + (x.result ? ' · дні 1–7: ' + K.rangeShort(x.result.start, x.result.end) : '') + (x.whoName ? ' · ' + x.whoName : ''));
            });
            });
          }
        },
        onMount: function (el) {
          drawCauses(el); mountChart(el, a, T);
          var dayEl = el.querySelector('[data-f="day"]');
          if (dayEl && !lockDay) dayEl.addEventListener('change', function () { refetch(el, dayEl.value); });
        }
      });
      function rowsHint() {
        if (!rows.length) return 'Видів браку у дії немає — оберіть одну причину для всієї дії.';
        return lockDay ? 'Види браку — ті, що зафіксовано на дату впровадження.' : 'Види браку — на дату впровадження: зміните дату — список оновиться.';
      }
      function readNotes(el) {
        curRows().forEach(function (it, i) { var f = el.querySelector('[data-note-in="' + i + '"]'); if (f) notes[it.defectTypeId] = f.value; });
      }
      function refetch(el, day) {
        var my = ++asked;
        pend = P.srv('srKdPlanItems', Object.assign({ locationId: ctx.loc.id, day: day }, edit ? { id: a.id } : { departmentId: a.departmentId, period: a.period })).then(function (pl) {
          if (my !== asked || !ctx.alive() || !pl.ok) return;
          var next = pl.items.map(function (it) { return { defectTypeId: it.defectTypeId, name: it.name, level: it.level, share: it.share }; });
          if (JSON.stringify(next) === JSON.stringify(rows)) return;
          readNotes(el);
          rows = next;
          if (oldMain) rows.concat([WHOLE]).forEach(function (it) { if (!picked[it.defectTypeId]) picked[it.defectTypeId] = oldMain; });   // старий запис: головна причина — і новим видам
          el.querySelector('[data-rows]').innerHTML = curRows().map(causeRow).join('');
          el.querySelector('[data-rows-hint]').textContent = rowsHint();
          drawCauses(el);
        });
      }
      function causeRow(it, i) {
        var id = esc(it.defectTypeId);
        return '<div class="field kd-crow"' + (i ? ' style="border-top:1px solid var(--line-mid);padding-top:12px"' : '') + '><span class="label">' +
          (it.whole ? 'Причина для всієї дії' : esc(it.name) + ' ' + H.lvl(it.level) + ' <span class="hint">' + K.pct(it.share) + ' браку відділу</span>') + '</span>' +
          '<div class="kd-chips" data-causes="' + i + '" role="group" aria-label="Причина: ' + esc(it.name) + '"></div>' +
          '<label class="field" data-note-wrap="' + i + '" style="display:none"><span class="label">Пояснення до причини «Інше»</span><input class="input" data-note-in="' + i + '" data-f="' + (it.whole ? 'causeNote' : 'itemNotes.' + id) +
          '" maxlength="300" value="' + esc(notes[it.defectTypeId] || '') + '" placeholder="Що саме сталося">' + K.errSlot(it.whole ? 'causeNote' : 'itemNotes.' + it.defectTypeId) + '</label>' +
          K.errSlot(it.whole ? 'causes' : 'itemCauses.' + it.defectTypeId) + '</div>';
      }
      function drawCauses(el, only) {
        curRows().forEach(function (it, i) {
          if (only != null && only !== i) return;
          el.querySelector('[data-causes="' + i + '"]').innerHTML = r.causes.map(function (c) {
            var on = picked[it.defectTypeId] === c.id;
            return '<button type="button" class="chip-pick kd-pick' + (on ? ' chip-pick--on' : '') + '" data-act="cause" data-i="' + i + '" data-id="' + c.id + '" aria-pressed="' + on + '" style="padding:0 12px">' + esc(c.label) + '</button>';
          }).join('');
          el.querySelector('[data-note-wrap="' + i + '"]').style.display = picked[it.defectTypeId] === 'other' ? '' : 'none';
        });
      }
      function withRowErrors(el, res) {
        var lost = [], errors = (res.errors || []).filter(function (e) {
          var rowErr = /^item(Causes|Notes)\./.test(e.field) && !el.querySelector('[data-err="' + e.field + '"]');
          if (rowErr) lost.push(e.message);
          return !rowErr;
        });
        return { errors: lost.length ? errors.concat([{ field: 'itemCauses', message: lost.join(' ') }]) : errors };
      }
    });
  };

  K.openNotNeeded = function (ctx, r0, a) {
    var editing = a && a.status === 'not_needed';
    var m = P.sr.modal({ size: 'sm', title: (editing ? 'Змінити причину · ' : 'Дія не потрібна · ') + (a ? a.departmentName : ''),
      sub: a ? esc(K.week(a.periodStart, a.periodEnd)) + ' · брак ' + esc(K.pct(a.rate)) : '',
      body: '<p class="kd-text">' + (editing ? 'Причину видно в картці КД та в списку КД.'
        : 'КД отримає стан «дія не потрібна», поруч — ця причина. Якщо наступного тижня брак, % відділу знову буде понад норму, відкриється нова КД.') + '</p>' +
        '<label class="field"><span class="label">Чому дія не потрібна</span><textarea class="textarea" data-f="reason" maxlength="300" style="min-height:80px" placeholder="Наприклад: разовий збій машини — полагодили того ж дня.">' +
          esc(editing ? a.notNeededReason : '') + '</textarea>' + K.errSlot('reason') + '</label>',
      foot: '<button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button><button class="btn btn--primary" type="button" data-act="ok" style="margin-left:auto">' + (editing ? 'Зберегти причину' : 'Позначити «не потрібно»') + '</button>',
      on: { ok: function (t) {
        t.disabled = true;
        P.srv('srKdNotNeeded', Object.assign({ locationId: ctx.loc.id, reason: m.el.querySelector('[data-f="reason"]').value }, r0)).then(function (res) {
          t.disabled = false;
          if (!res.ok) { if (!K.showErrors(m.el, res)) P.toast('danger', 'Не вдалося зберегти', res.error); return; }
          m.close();
          var x = res.action;
          K.done(ctx, 'ok', (editing ? 'Причину змінено · ' : 'Позначено «дія не потрібна» · ') + x.departmentName + ' · ' + K.week(x.periodStart, x.periodEnd), '«' + x.notNeededReason + '»');
        });
      } } });
  };

  function causeLines(a) {
    var per = K.itemCauses(a);
    if (!per.length) return '<p style="margin:0;font-weight:600">' + esc(K.causeText(a)) + '</p>';
    return per.map(function (x) {
      return '<p style="margin:0 0 4px"><b>' + esc(x.name) + '</b> — ' + esc(x.label) + (x.note ? '<span class="hint"> · ' + esc(x.note) + '</span>' : '') + '</p>';
    }).join('');
  }

  K.openDrawer = function (ctx, r0) {
    P.srv('srKdItem', Object.assign({ locationId: ctx.loc.id }, r0)).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { P.toast('danger', 'Не вдалося відкрити КД', r.error); return; }
      var a = r.item, T = r.threshold, body = '';
      if (a.after != null) {
        var st = P.sr.kdStateOf(a.status);
        body += '<div class="kd-res kd-res--' + (a.relapseStage ? 'relapse' : 'ok') + '"><span class="kd-res__state">' + H.kdState(st) + '</span>' +
          '<b class="kd-res__nums">' + esc(K.rates(a)) + '</b><span class="kd-res__thr">брак, % відділу: тиждень КД → дні 1–7 після плану' + (a.after2 != null ? ' → дні 8–14' : '') + ' · норма ' + T + '%</span></div>';
      } else body += K.formula(a, T);
      body += '<div class="facts"><p class="group-label" style="padding:0">Хід КД' + help('kd.steps') + '</p>' + K.obsSteps(a, T) + '</div>';
      body += '<div class="facts"><p class="group-label" style="padding:0">Пункти КД · до → після' + help('kd.beforeAfter') + '</p>' + K.itemsTable(a, r.rules) + '</div>';
      if (a.implementedAt) body += '<div class="facts"><p class="group-label" style="padding:0">' + ((K.itemCauses(a).length || a.causes.length) > 1 ? 'Причини' : 'Причина') + '</p>' + causeLines(a) +
        (a.causeNote ? '<p class="hint">' + esc(a.causeNote) + '</p>' : '') + '<p class="group-label" style="padding:6px 0 0">Що зроблено</p><p style="margin:0">' + esc(a.plan) + '</p>' +
        (a.whoName ? '<p class="hint">Відповідає: ' + esc(a.whoName) + '</p>' : '') + '</div>';
      body += chartBlock(a, T) + whoBlock(a);
      var foot = '<div class="kd-btns kd-btns--foot">' + (r.canWrite ? K.decisionBtns(a) : '') +
        '<a class="btn btn--quiet btn--sm" href="' + K.board.hrefOf(a) + '" data-ov-close>' + P.ic('department', 'ui-icon--sm') + 'Сторінка цієї дії</a></div>';
      var d = P.sr.drawer({ title: 'КД · ' + a.departmentName, sub: esc(K.range(a.periodStart, a.periodEnd)) + ' · відкрито ' + H.dayShort(a.openedAt) + (a.whoName && a.implementedAt ? ' · ' + esc(a.whoName) : ''),
        head: '<span class="kd-dhead">' + K.stateBadge(a) + K.earlyBadge(a) + '</span>', body: body, foot: foot,   // v2.2: довгий стан не стискає назву
        onMount: function (el) { mountChart(el, a, T); },
        on: {
          'kd-all': K.toggleMore,
          impl: function () { d.close(); K.openPlan(ctx, r0); },
          edit: function () { d.close(); K.openPlan(ctx, r0, { edit: true }); },
          nn: function () { d.close(); K.openNotNeeded(ctx, r0, a); }
        } });
    });
  };
})(window);
