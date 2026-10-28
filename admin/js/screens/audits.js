(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm, da = A.da, q = A.q;
  if (!P.cab) return;
  var DAYS = [[1, 'Сьогодні'], [7, '7 днів'], [30, '30 днів'], [90, '90 днів'], [183, '183 дні']];
  var flt = { days: 7, from: '', to: '', loc: '', dep: '', aud: '', def: '', withDefects: false, edited: false, trash: false, q: '' };

  function payload(page) {
    var to = flt.days ? P.cab.today() : flt.to, from = flt.days ? P.cab.addDays(to, -(flt.days - 1)) : flt.from;
    return { from: from, to: to, locationId: flt.loc, departmentId: flt.dep, auditorId: flt.aud, defectTypeId: flt.def,
      withDefects: flt.withDefects, edited: flt.edited, trash: flt.trash, q: flt.q.trim(), page: page };
  }
  function subText(r) {
    if (!r) return A.asOf();
    if (r.trash) return 'Кошик: видалені за 30 днів · ' + A.asOf();
    var per = r.from === r.to ? H.dayLong(r.from) : P.fmt.date(r.from + 'T12:00:00Z') + ' — ' + P.fmt.date(r.to + 'T12:00:00Z') + ' (' + r.days + ' ' + A.plural(r.days, ['день', 'дні', 'днів']) + ')';
    return per + (r.limited ? ' · період скорочено до ' + r.maxDays + ' днів' : '') + ' · ' + A.asOf();
  }
  function pills() {
    return '<nav class="pills acc-pills" aria-label="Період">' + DAYS.map(function (x) {
      var on = !flt.trash && flt.days === x[0];
      return '<button class="pill' + (on ? ' pill--on' : '') + '" type="button" data-act="au-days"' + da('v', x[0]) + ' aria-pressed="' + on + '"' + (flt.trash ? ' disabled' : '') + '>' + esc(x[1]) + '</button>';
    }).join('') + '</nav>';
  }
  function dateInput(k, v) {
    return '<label class="date adm-au-date">' + P.ic('calendar', 'ui-icon--sm') + '<span class="adm-dim">' + (k === 'from' ? 'з' : 'по') + '</span>' +
      '<input type="date" data-change="au-date"' + da('k', k) + ' value="' + esc(v) + '" max="' + P.cab.today() + '" aria-label="' + (k === 'from' ? 'Перший день' : 'Останній день') + '"' + (flt.trash ? ' disabled' : '') + '></label>';
  }
  function chip(act, on, label, key, off) {
    return '<span class="adm-au-chip"><button class="chip-pick' + (on ? ' chip-pick--on' : '') + '" type="button" data-act="' + act + '" aria-pressed="' + on + '"' + (off ? ' disabled' : '') + '>' +
      (on ? P.ic('check', 'ui-icon--sm') : '') + esc(label) + '</button>' + A.help(key) + '</span>';
  }
  function select(name, label) { return '<select class="input adm-select" data-change="au-sel"' + da('k', name) + ' aria-label="' + esc(label) + '"><option value="">' + esc(label) + '</option></select>'; }
  function fill(el, name, all, list, cur) {
    var s = q(el, '[data-k="' + name + '"]'); if (!s) return cur;
    if (cur && !list.some(function (x) { return x.id === cur; })) cur = '';
    s.innerHTML = '<option value="">' + esc(all) + '</option>' + list.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === cur ? ' selected' : '') + '>' + esc(x.label) + '</option>'; }).join('');
    return cur;
  }
  function tr(x) {
    var flags = x.trash ? H.badge('видалено ' + P.fmt.date(x.trash.deletedAt), 'warn')
      : (x.edited ? H.badge('виправлено', 'info') : '') + (x.photos ? H.badge('фото · ' + x.photos, '') : '');
    return '<tr class="adm-au-tr' + (x.rejected ? ' adm-au-tr--bad' : '') + '" data-act="au-open"' + da('id', x.id) + '>' +
      '<td data-l="Коли"><button class="link adm-au-open" type="button" data-act="au-open"' + da('id', x.id) + '>' + esc(x.createdAt ? P.fmt.dateTime(x.createdAt) : '—') + '</button></td>' +
      '<td data-l="Де"><span><b>' + esc(x.locationName) + '</b> · ' + esc(x.departmentName) + '</span></td><td data-l="Хто записав">' + esc(x.auditorName) + '</td>' +
      '<td class="n" data-l="Перевірено, шт">' + H.num(x.checked) + '</td><td class="n" data-l="Брак, шт">' + H.num(x.rejected) + '</td>' +
      '<td class="n" data-l="Брак, %">' + H.pct(x.pct) + '</td><td data-l="Позначки"' + (flags ? '' : ' class="adm-au-noflags"') + '><span class="adm-au-flags">' + (flags || '<span class="adm-dim">—</span>') + '</span></td></tr>';
  }

  function shotsOf(a) {
    var out = [];
    a.defects.forEach(function (d) { (Array.isArray(d.photos) ? d.photos : []).forEach(function (src) { if (/^data:image\/jpeg;base64,/.test(src)) out.push({ src: src, type: d.defectTypeName }); }); });
    return out;
  }
  function cardBody(a, x) {
    var shots = shotsOf(a), stubs = a.defects.filter(function (d) { return d.photo && !(d.photos && d.photos.length); });
    var kv = '<dl class="kv adm-au-kv"><dt>Записав' + A.help('admin.data.au.who') + '</dt><dd><b>' + esc(a.auditorName) + '</b> · ' + esc(P.fmt.dateTime(a.createdAt)) + '</dd>' +
      '<dt>Виправив</dt><dd>' + (x.updatedAt ? '<b>' + esc(x.updatedByName || '—') + '</b> · ' + esc(P.fmt.dateTime(x.updatedAt)) : '<span class="adm-dim">не виправляли</span>') + '</dd>' +
      '<dt>Де</dt><dd>' + esc(a.locationName + ' · ' + a.departmentName) + '</dd><dt>Замовлення</dt><dd>' + esc(a.orders.length ? a.orders.join(', ') : '—') + '</dd></dl>';
    var kpis = '<div class="kpis adm-au-k3">' + A.kpi(H.num(a.checked), 'перевірено, шт', 'term.checked') + A.kpi(H.num(a.rejected), 'брак, шт', 'term.rejected') + A.kpi(H.pct(a.pct), 'брак, %', 'term.rate') + '</div>';
    var items = '<table class="table"><thead><tr><th>Виріб · замовлення</th><th class="n">Перевірено, шт</th><th class="n">Брак, шт</th></tr></thead><tbody>' + a.items.map(function (i) {
      return '<tr><td>' + esc(i.productName) + (i.orderNo ? ' <span class="adm-dim">· ' + esc(i.orderNo) + '</span>' : '') + '</td><td class="n">' + H.num(i.qty) + '</td><td class="n">' + H.num(i.rejected) + '</td></tr>';
    }).join('') + '</tbody></table>';
    var defects = a.defects.length ? a.defects.map(function (d) {
      return '<div class="entry ' + (d.otherDept ? 'entry--other' : 'entry--defect') + ' adm-au-def"><div class="adm-au-def__top"><b>' + esc(d.defectTypeName) + '</b>' + (d.otherDept ? H.badge('брак відділу ' + d.departmentName, 'info') : '') +
        '<b class="adm-au-def__q">' + H.num(d.qty) + ' шт</b></div>' + H.lvl(d.level) + '<span class="hint">' + esc(d.productName) + ' · ' + (d.workerCode ? 'винний: ' + esc(d.workerName) : 'працівника не вказано') + '</span></div>';
    }).join('') : '<p class="hint">Браку немає</p>';
    var workers = a.checkedWorkers.length ? '<div class="chips">' + a.checkedWorkers.map(function (w) { return '<span class="chip chip--plain">' + esc(w.name) + (w.helper ? H.badge('допомога', 'info') : '') + '</span>'; }).join('') + '</div>' : '<p class="hint">—</p>';
    var ph = shots.length ? '<div class="adm-au-shots">' + shots.map(function (s, i) {
      return '<button class="adm-au-shot" type="button" data-act="au-photo"' + da('i', i) + ' aria-label="Фото ' + (i + 1) + ' · ' + esc(s.type) + ' — більше"><img src="' + esc(s.src) + '" alt="Фото браку · ' + esc(s.type) + '" loading="lazy"></button>';
    }).join('') + '</div>' : '';
    ph += stubs.length ? '<div class="adm-au-shots">' + stubs.map(function (d) { return '<span class="adm-au-stub" title="' + esc(d.photo.name || '') + '">' + P.ic('photo', 'ui-icon--sm') + esc(d.defectTypeName) + '</span>'; }).join('') + '</div>' +
      '<p class="hint">У тестових аудитах замість фото — позначки.</p>' : '';
    function block(t, html) { return '<div class="adm-au-block"><h3 class="adm-card-t">' + t + '</h3>' + html + '</div>'; }
    return kv + kpis + block('Перевірка', items) + block('Види браку · ' + H.num(a.rejected) + ' шт' + A.help('term.levels'), defects) +
      block('Перевірені працівники · ' + a.checkedWorkers.length, workers) + (a.comment ? block('Коментар', '<p class="adm-au-note">' + esc(a.comment) + '</p>') : '') +
      (ph ? block('Фото браку', ph) : '') +
      '<p class="hint adm-au-fix">' + P.ic('info', 'ui-icon--sm') + '<span>Виправлення робить старший аудитор у своєму кабінеті.' + A.help('admin.data.au.fix') +
        ' «Видалити» переносить аудит у кошик на 30 днів.' + A.help('admin.data.au.delete') + '</span></p>';
  }
  function trashBody(x) {
    var t = x.trash;
    return '<dl class="kv adm-au-kv"><dt>Видалив</dt><dd><b>' + esc(t.byName) + '</b> · ' + esc(P.fmt.dateTime(t.deletedAt)) + '</dd><dt>Причина</dt><dd>' + (t.reason ? esc(t.reason) : '<span class="adm-dim">не вказано</span>') + '</dd>' +
      '<dt>Повернути можна до</dt><dd>' + esc(H.dayLong(P.fmt.dayKey(t.until))) + '</dd><dt>Записав</dt><dd><b>' + esc(x.auditorName) + '</b> · ' + esc(x.createdAt ? P.fmt.dateTime(x.createdAt) : '—') + '</dd>' +
      '<dt>Де</dt><dd>' + esc(x.locationName + ' · ' + x.departmentName) + '</dd><dt>Вироби</dt><dd>' + esc(x.products.join(', ') || '—') + '</dd></dl>' +
      '<div class="kpis adm-au-k3">' + A.kpi(H.num(x.checked), 'перевірено, шт', 'term.checked') + A.kpi(H.num(x.rejected), 'брак, шт', 'term.rejected') + A.kpi(H.pct(x.pct), 'брак, %', 'term.rate') + '</div>' +
      '<p class="hint adm-au-fix">' + P.ic('info', 'ui-icon--sm') + '<span>У кошику видно лише коротке з аудиту; повністю він зʼявиться знову після «Повернути».' + A.help('admin.data.au.restore') + '</span></p>';
  }
  function openShot(s) { A.modal({ title: 'Фото браку · ' + s.type, body: '<div class="adm-au-full"><img src="' + esc(s.src) + '" alt="Фото браку · ' + esc(s.type) + '"></div>' }); }
  function askDelete(x, done) {
    A.modal({ size: 'sm', title: 'Видалити аудит?', sub: esc(P.fmt.dateTime(x.createdAt) + ' · ' + x.locationName + ' · ' + x.departmentName),
      body: '<div class="adm-form">' + A.field('reason', 'Причина', A.input('reason', '', ' autocomplete="off" maxlength="300" placeholder="Наприклад: записали двічі"'), 'Причину видно в кошику.', 'admin.data.au.delete') + '</div>',
      foot: A.cancelBtn() + '<button class="btn btn--danger" type="button" data-act="adm-save">' + P.ic('delete', 'ui-icon--sm') + 'Далі</button>',
      onMount: function (el) { A.enterSubmits(el); },
      on: { 'adm-save': function (t, e, layer) {
        var reason = A.val(layer.el, 'reason').trim();
        if (!reason) { A.showErrors(layer.el, { ok: false, code: 'validation', error: 'Напишіть причину.', errors: [{ field: 'reason', message: 'Напишіть причину — її побачать у кошику.' }] }); return; }
        P.sr.closeAll();
        P.confirm({ title: 'Видалити аудит · ' + P.fmt.dateTime(x.createdAt) + '?', text: 'Аудит зникне з аналітики, історії й коригуючих дій у всіх кабінетах. 30 днів його можна повернути з кошика.', okLabel: 'Видалити', danger: true })
          .then(function (ok) {
            if (!ok) { open(x, done); return; }
            P.srv('srAuditDelete', { id: x.id, reason: reason }).then(function (r) {
              if (!r.ok) { if (r.code !== 'forbidden') P.toast('danger', 'Не вдалося видалити', (r.errors && r.errors[0] ? r.errors[0].message : r.error) || ''); return; }
              P.toast('ok', 'Аудит видалено · ' + P.fmt.dateTime(x.createdAt), 'Він у кошику 30 днів: «У кошику (видалені)» → аудит → «Повернути».');
              done();
            });
          });
      } } });
  }
  function open(x, done) {
    var audit = null;
    var foot = x.trash ? A.cancelBtn().replace('Скасувати', 'Закрити') + '<button class="btn btn--primary" type="button" data-act="au-restore">' + P.ic('refresh', 'ui-icon--sm') + 'Повернути</button>'
      : A.cancelBtn().replace('Скасувати', 'Закрити') + '<button class="btn btn--secondary adm-au-del" type="button" data-act="au-del" disabled>' + P.ic('delete', 'ui-icon--sm') + 'Видалити</button>';
    var layer = A.modal({ title: (x.trash ? 'Видалений аудит · ' : 'Аудит · ') + (x.createdAt ? P.fmt.dateTime(x.createdAt) : '—'), sub: esc(x.locationName + ' · ' + x.departmentName + ' · ' + x.id),
      body: x.trash ? trashBody(x) : H.loading(), foot: foot,
      on: {
        retry: function () { load(); },
        'au-photo': function (t) { var s = shotsOf(audit)[+t.getAttribute('data-i')]; if (s) openShot(s); },
        'au-del': function () { askDelete(x, done); },
        'au-restore': function (t, e, l) {
          t.disabled = true;
          P.srv('srAuditRestore', { id: x.id }).then(function (r) {
            t.disabled = false;
            if (!r.ok) { if (r.code !== 'forbidden') P.toast('danger', 'Не вдалося повернути', r.error || ''); return; }
            l.close(); P.toast('ok', 'Аудит повернуто · ' + (x.createdAt ? P.fmt.dateTime(x.createdAt) : x.id), 'Він знову в аналітиці й історії.');
            done();
          });
        }
      } });
    function load() {
      layer.body(H.loading());
      P.srv('auditGet', { id: x.id }).then(function (r) {
        if (layer.closed) return;
        if (!r.ok) { layer.body(r.code === 'not_found' ? H.empty('Аудиту вже немає', 'Його могли щойно видалити — оновіть список.') : H.error(r)); return; }
        audit = r.audit; layer.body(cardBody(audit, x));
        var b = q(layer.el, '[data-act="au-del"]'); if (b) b.disabled = false;
      });
    }
    if (!x.trash) load();
  }
  P.admAuditCard = { open: open };

  P.cab.tab({ id: 'audits', label: 'Аудити', ic: 'audit', path: '/audits', order: 34 });
  P.cab.screen('/audits', { tab: 'audits', title: 'Аудити', render: function (ctx) {
    var items = [], last = null, loading = false, failed = null, seq = 0, timer = null;

    function draw() {
      var pl = payload(1);   // дати в полях — завжди ті, за які зараз список (і для кнопок періоду)
      ctx.el.innerHTML = '<section class="adm-col">' + A.head('Аудити', subText(null), '', 'admin.data.audits') +
        '<section class="card adm-au-filters">' +
          '<div class="adm-au-line">' + pills() + A.help('admin.data.au.period') + '<span class="adm-au-dates">' + dateInput('from', pl.from) + dateInput('to', pl.to) + '</span></div>' +
          '<div class="adm-tools">' + select('loc', 'Усі локації') + select('dep', 'Усі відділи') + select('aud', 'Усі, хто записував') + select('def', 'Усі види браку') + A.help('admin.data.au.filters') +
            '<label class="search adm-search">' + P.ic('search', 'icon') + '<input class="input input--search" type="search" data-input="au-q" value="' + esc(flt.q) + '" placeholder="Номер замовлення або аудиту" aria-label="Пошук за номером замовлення або аудиту" maxlength="60"></label>' + A.help('admin.data.au.q') + '</div>' +
          '<div class="adm-chips" role="group" aria-label="Позначки">' + chip('au-bad', flt.withDefects, 'Лише з браком', 'admin.data.au.withDefects') +
            chip('au-edited', flt.edited, 'Лише виправлені', 'admin.data.au.edited', flt.trash) + chip('au-trash', flt.trash, 'У кошику (видалені)', 'admin.data.au.trash') + '</div>' +
        '</section><div data-au-kpis></div>' +
        '<section class="card adm-flat"><p class="hint" data-au-n></p><div data-au-list></div>' +
          '<div class="acc-more"><button class="btn btn--secondary" type="button" data-act="au-more" data-au-more hidden>Показати ще</button>' + A.help('admin.data.au.more') + '</div></section></section>';
      if (flt.trash) q(ctx.el, '[data-k="def"]').disabled = true;
      drawList();
    }
    function drawList() {
      var box = q(ctx.el, '[data-au-list]'); if (!box) return;
      var more = q(ctx.el, '[data-au-more]'), n = q(ctx.el, '[data-au-n]');
      if (failed) { box.innerHTML = H.error(failed); more.parentNode.hidden = true; n.textContent = ''; return; }
      if (!last) { box.innerHTML = H.loading(); more.parentNode.hidden = true; return; }
      var t = last.totals;
      q(ctx.el, '.h2-sub').textContent = subText(last);
      q(ctx.el, '[data-au-kpis]').innerHTML = '<div class="kpis">' + A.kpi(H.num(t.audits), A.plural(t.audits, ['аудит', 'аудити', 'аудитів']), 'admin.data.au.kpi.audits') +
        A.kpi(H.num(t.checked), 'перевірено, шт', 'term.checked') + A.kpi(H.num(t.rejected), 'брак, шт', 'term.rejected') + A.kpi(H.pct(t.pct), 'брак, %', 'term.rate') +
        A.kpi(t.withPhotos == null ? '—' : H.num(t.withPhotos), 'з фото браку', 'admin.data.au.kpi.photos') + '</div>';
      box.innerHTML = items.length ? '<table class="table adm-au-table"><thead><tr><th>Коли</th><th>Локація · відділ</th><th>Хто записав</th><th class="n">Перевірено, шт</th>' +
        '<th class="n">Брак, шт</th><th class="n">Брак, %</th><th>Позначки' + A.help('admin.data.au.flags') + '</th></tr></thead><tbody>' + items.map(tr).join('') + '</tbody></table>'
        : H.empty(flt.trash ? 'Кошик порожній' : 'Аудитів не знайдено', flt.trash ? 'Видалені аудити зʼявляються тут на 30 днів.' : 'Спробуйте довший період або зніміть частину фільтрів.');
      n.textContent = last.total ? 'Показано ' + H.num(items.length) + ' з ' + H.num(last.total) : '';
      more.hidden = last.page >= last.pages; more.parentNode.hidden = more.hidden; more.disabled = loading;   // разом з кнопкою ховаємо і її «?»
      var f = last.filters, many = !flt.loc;
      flt.loc = fill(ctx.el, 'loc', 'Усі локації', f.locations.map(function (x) { return { id: x.id, label: x.name + (x.active ? '' : ' (вимкнена)') }; }), flt.loc);
      flt.dep = fill(ctx.el, 'dep', 'Усі відділи', f.departments.map(function (x) { return { id: x.id, label: x.name + (many ? ' · ' + x.locationName : '') }; }), flt.dep);
      flt.aud = fill(ctx.el, 'aud', 'Усі, хто записував', f.auditors.map(function (x) { return { id: x.id, label: x.name }; }), flt.aud);
      flt.def = fill(ctx.el, 'def', 'Усі види браку', f.defectTypes.map(function (x) { return { id: x.id, label: x.name + ' · ' + x.deptTypeName }; }), flt.def);
    }
    function fetchPage(reset) {
      var my = ++seq, page = reset || !last ? 1 : last.page + 1;
      loading = true; failed = null;
      if (reset) { items = []; last = null; }
      drawList();
      P.srv('admAudits', payload(page)).then(function (r) {
        if (!ctx.alive() || my !== seq) return;
        loading = false;
        if (!r || !r.ok) { failed = r || { ok: false, error: 'Не вдалося отримати аудити.' }; drawList(); return; }
        items = reset ? r.items : items.concat(r.items); last = r;
        drawList();
      });
    }
    function refilter() { draw(); fetchPage(true); }
    function row(id) { return items.filter(function (x) { return x.id === id; })[0]; }

    ctx.on('au-days', function (t) { flt.days = +t.getAttribute('data-v'); refilter(); });
    ctx.on('au-date', function () {
      var f = q(ctx.el, '[data-k="from"]').value, t = q(ctx.el, '[data-k="to"]').value;
      if (!f || !t) return;
      if (f > t) { var x = f; f = t; t = x; }
      flt.from = f; flt.to = t; flt.days = null; refilter();
    });
    ctx.on('au-sel', function (t) {
      var k = t.getAttribute('data-k');
      flt[k] = t.value;
      if (k === 'loc') { flt.dep = ''; flt.def = ''; }   // відділи й види браку — свої в кожної локації
      fetchPage(true);
    });
    ctx.on('au-q', function (t) { flt.q = t.value; clearTimeout(timer); timer = setTimeout(function () { if (ctx.alive()) fetchPage(true); }, 300); });
    ctx.on('au-bad', function () { flt.withDefects = !flt.withDefects; refilter(); });
    ctx.on('au-edited', function () { flt.edited = !flt.edited; refilter(); });
    ctx.on('au-trash', function () { flt.trash = !flt.trash; if (flt.trash) { flt.edited = false; flt.def = ''; } refilter(); });
    ctx.on('au-more', function () { if (!loading && last && last.page < last.pages) fetchPage(false); });
    ctx.on('au-open', function (t) {
      var x = row(t.getAttribute('data-id'));
      if (x && P.admAuditCard) P.admAuditCard.open(x, function () { if (ctx.alive()) fetchPage(true); });
    });
    draw();
    fetchPage(true);
  } });
})(window);
