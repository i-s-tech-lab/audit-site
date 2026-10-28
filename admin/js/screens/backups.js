(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm, da = A.da, doc = root.document;
  var MB = 1048576, GB = 1073741824;

  function demoBanner() {
    return '<div class="banner">' + P.ic('info', 'icon') + '<div class="banner__body"><p class="banner__title">На тестовому сайті дані вигадані</p>' +
      '<p class="banner__text">Числа, дати й адреси тут — приклад. На справжньому сервері їх показує сам сервер.</p></div></div>';
  }
  function bytes(n) { return n < GB ? (n / MB).toFixed(1).replace('.', ',') + ' МБ' : (n / GB).toFixed(2).replace('.', ',') + ' ГБ'; }
  function dur(sec) {
    var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
    if (d) return d + ' ' + A.plural(d, ['день', 'дні', 'днів']) + (h ? ' ' + h + ' год' : '');
    return h ? h + ' год' + (m ? ' ' + m + ' хв' : '') : m + ' хв';
  }
  function cmd(label, text, i, note) {
    return '<div class="adm-cmd' + (text.indexOf('\n') >= 0 ? ' adm-cmd--wide' : '') + '"><div class="adm-cmd__head"><b>' + esc(label) + '</b>' +
      '<button class="btn btn--secondary btn--sm" type="button" data-act="sys-copy"' + da('i', i) + '>' + P.ic('export', 'ui-icon--sm') + 'Копіювати</button></div>' +
      '<pre class="adm-cmd__text" data-cmd="' + i + '">' + esc(text) + '</pre>' + (note ? '<p class="hint">' + esc(note) + '</p>' : '') + '</div>';
  }
  function copy(text, pre) {
    function select() {
      if (!pre) { P.toast('warn', 'Не вдалося скопіювати', 'Виділіть текст команди вручну.'); return; }
      var r = doc.createRange(), s = root.getSelection();
      r.selectNodeContents(pre); s.removeAllRanges(); s.addRange(r);
      var ok = false;
      try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
      if (ok) P.toast('ok', 'Скопійовано', 'Вставте команду в SSH-сесію на сервері.');
      else P.toast('info', 'Текст виділено', 'Натисніть Ctrl+C, щоб скопіювати.');
    }
    var nav = root.navigator;
    if (nav && nav.clipboard && nav.clipboard.writeText) {
      nav.clipboard.writeText(text).then(function () { P.toast('ok', 'Скопійовано', 'Вставте команду в SSH-сесію на сервері.'); }, select);
    } else select();
  }
  function kv(label, value, key) { return '<dt>' + esc(label) + A.help(key) + '</dt><dd>' + value + '</dd>'; }
  P.admSys = { demoBanner: demoBanner, bytes: bytes, dur: dur, cmd: cmd, copy: copy, kv: kv };

  var KINDS = [['manual', 'Зроблені вручну'], ['daily', 'Щоденні'], ['weekly', 'Щотижневі'], ['monthly', 'Щомісячні']];
  var POLICY = [['daily', 'Щоденних копій', 'Від 1 до 31.'], ['weekly', 'Щотижневих копій', 'Від 0 до 12.'], ['monthly', 'Щомісячних копій', 'Від 0 до 24.']];
  function nextText(iso) {
    var d = Math.round((Date.parse(P.fmt.dayKey(iso) + 'T12:00:00Z') - Date.parse(P.fmt.dayKey(new Date()) + 'T12:00:00Z')) / 86400000);
    return (d <= 0 ? 'сьогодні' : d === 1 ? 'завтра' : P.fmt.date(iso)) + ', ' + P.fmt.time(iso);
  }
  function row(x) {
    return '<div class="adm-bk">' +
      '<div class="adm-bk__main"><div class="adm-bk__top"><b>' + esc(P.fmt.dateTime(x.at)) + '</b>' +
        (x.verifiedAt ? '<span class="badge badge--ok" title="' + esc('Перевірено ' + P.fmt.dateTime(x.verifiedAt)) + '">' + P.ic('check', 'ui-icon--sm') + 'перевірено відновленням</span>' : '') +
        (x.protected ? '<span class="badge badge--info">' + P.ic('lock', 'ui-icon--sm') + 'не видаляється</span>' : '') +
        (x.ok ? '' : '<span class="badge badge--danger">помилка</span>') + '</div>' +
        '<span class="adm-bk__meta">' + esc(bytes(x.bytes)) + ' · ' + H.num(x.tables) + ' таблиць · ' + H.num(x.rows) + ' рядків · відбиток ' + esc(x.sha256) + '…' +
        (x.verifiedAt ? ' · перевірено ' + esc(A.ago(x.verifiedAt)) : '') + '</span></div>' +
      A.more('bk-more', da('id', x.id), 'Дії · копія ' + P.fmt.dateTime(x.at)) + '</div>';
  }
  function list(items) {
    return KINDS.map(function (k) {
      var g = items.filter(function (x) { return x.kind === k[0]; });
      return g.length ? '<h4 class="adm-bk__group">' + esc(k[1]) + ' · ' + g.length + '</h4><div class="adm-bk__list">' + g.map(row).join('') + '</div>' : '';
    }).join('');
  }

  P.cab.tab({ id: 'backups', label: 'Резервні копії', ic: 'backup', path: '/backups', order: 60 });
  P.cab.screen('/backups', { tab: 'backups', title: 'Резервні копії', render: function (ctx) {
    var data = null;
    function find(id) { return data.items.filter(function (x) { return x.id === id; })[0]; }
    function draw(r) {
      var t = r.totals, pol = r.policy, last = r.items[0] || null;
      var ver = r.items.map(function (x) { return x.verifiedAt; }).filter(Boolean).sort().pop() || null;
      ctx.el.innerHTML = '<section class="adm-col">' +
        A.head('Резервні копії', A.asOf() + ' · щоночі о ' + r.schedule.at + ', наступна — ' + nextText(r.schedule.next),
          '<button class="btn btn--primary" type="button" data-act="bk-now">' + P.ic('backup') + 'Зробити копію зараз</button>', 'admin.system.schedule') +
        demoBanner() +
        '<div class="kpis">' + A.kpi(H.num(t.count), A.plural(t.count, ['копія', 'копії', 'копій']), 'admin.system.count') +
          A.kpi(bytes(t.bytes), 'разом місця, з ' + bytes(pol.maxBytes), 'admin.system.bytes') +
          A.kpi(last ? A.ago(last.at) : '—', 'остання копія', 'admin.system.last') +
          A.kpi(ver ? A.ago(ver) : '—', 'остання перевірка відновленням', 'admin.system.verified') + '</div>' +
        '<div class="adm-sys-grid">' +
          '<section class="card"><div class="adm-sys-t"><h3 class="adm-card-t">' + P.ic('settings', 'ui-icon--sm') + 'Правило зберігання' + A.help('admin.system.policy') + '</h3>' +
            '<button class="btn btn--secondary btn--sm" type="button" data-act="bk-policy">' + P.ic('edit', 'ui-icon--sm') + 'Редагувати</button></div>' +
            '<dl class="kv adm-sys-kv">' + POLICY.map(function (f) { return kv(f[1], H.num(pol[f[0]]), 'admin.system.' + f[0]); }).join('') +
              kv('Місце для всіх копій', esc(bytes(pol.maxBytes)), 'admin.system.maxBytes') + '</dl>' +
            '<p class="hint">Найновішу копію і найновішу перевірену правило не видаляє ніколи.</p></section>' +
          '<section class="card"><h3 class="adm-card-t">' + P.ic(r.offsite.set ? 'success' : 'warning', 'ui-icon--sm') + 'Друга копія на іншому пристрої — ' +
            (r.offsite.set ? 'налаштовано' : 'ще не налаштовано') + A.help('admin.system.offsite') + '</h3>' +
            '<p class="hint">' + esc(r.offsite.hint) + '</p></section>' +
        '</div>' +
        '<section class="card"><h3 class="adm-card-t">' + P.ic('list', 'ui-icon--sm') + 'Копії · ' + r.items.length + A.help('admin.system.list') + '</h3>' +
          (r.items.length ? list(r.items) : H.empty('Копій ще немає', 'Перша зʼявиться сьогодні о ' + r.schedule.at + ' або після «Зробити копію зараз».')) + '</section>' +
        '<section class="card"><h3 class="adm-card-t">' + P.ic('lock', 'ui-icon--sm') + 'Відновлення поверх робочої бази — лише через SSH' + A.help('admin.system.restore') + '</h3>' +
          '<p class="hint">З браузера відновлення не робиться: воно замінює всі дані бази. Замість назви файлу — копія зі списку вище.</p>' +
          cmd('Відновити з копії', r.restore.text, 0, r.restore.note) + '</section>' +
        '</section>';
    }
    function load() {
      P.srv('admBackups', {}).then(function (r) {
        if (!ctx.alive()) return;
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        data = r; draw(r);
      });
    }
    function editPolicy() {
      var pol = data.policy;
      var body = '<div class="adm-form">' + POLICY.map(function (f) {
        return A.field(f[0], f[1], A.input(f[0], pol[f[0]], ' inputmode="numeric" autocomplete="off" maxlength="3"'), f[2], 'admin.system.' + f[0]);
      }).join('') +
        A.field('maxBytes', 'Місце для всіх копій, ГБ', A.input('maxGb', String(Math.round(pol.maxBytes / GB * 100) / 100).replace('.', ','), ' inputmode="decimal" autocomplete="off" maxlength="6"'),
          'Від 0,1 до 50 ГБ. Коли копії займають більше — найстаріші видаляються.', 'admin.system.maxBytes') +
        '<p class="hint">Нове правило застосовується під час наступної копії. Найновішу копію і найновішу перевірену воно не видаляє.</p></div>';
      A.modal({ size: 'sm', title: 'Правило зберігання', sub: esc(pol.daily + ' · ' + pol.weekly + ' · ' + pol.monthly + ' · ' + bytes(pol.maxBytes)), body: body,
        foot: A.cancelBtn() + A.saveBtn('Зберегти'),
        onMount: function (el) { A.enterSubmits(el); var i = A.q(el, 'input.input'); if (i) i.select(); },
        on: { 'adm-save': function (b, e, layer) {
          var el = layer.el, gb = Number(A.val(el, 'maxGb').trim().replace(',', '.'));
          var p = { daily: A.val(el, 'daily').trim(), weekly: A.val(el, 'weekly').trim(), monthly: A.val(el, 'monthly').trim(),
            maxBytes: A.val(el, 'maxGb').trim() && isFinite(gb) ? Math.round(gb * GB) : '' };
          b.disabled = true;
          P.srv('admBackupPolicySave', p).then(function (r) {
            b.disabled = false;
            if (!r.ok) { A.showErrors(el, r); return; }
            layer.close();
            P.toast('ok', 'Збережено · Правило зберігання', r.changed ? r.policy.daily + ' щоденних, ' + r.policy.weekly + ' щотижневих, ' + r.policy.monthly + ' щомісячних, до ' + bytes(r.policy.maxBytes) + '.' : 'Нічого не змінилось.');
            if (ctx.alive()) load();
          });
        } } });
    }
    function view(x) {
      P.srv('admBackupView', { id: x.id }).then(function (r) {
        if (!r.ok) { if (r.code !== 'forbidden') P.toast('danger', 'Не вдалося відкрити копію', r.error || ''); if (r.code === 'not_found' && ctx.alive()) load(); return; }
        var total = r.tables.reduce(function (s, t) { return s + t.rows; }, 0);
        A.modal({ title: 'Що всередині копії', sub: esc(P.fmt.dateTime(r.at)),
          body: '<div class="adm-form"><dl class="kv adm-sys-kv">' + kv('Коли зроблено', esc(P.fmt.dateTime(r.at))) + kv('Розмір', esc(bytes(r.bytes))) +
              kv('Версія схеми', esc(r.schema), 'admin.system.schema') + kv('Перевірено відновленням', r.verifiedAt ? esc(P.fmt.dateTime(r.verifiedAt)) : '<span class="adm-dim">ще ні</span>', 'admin.system.verifiedFlag') + '</dl>' +
            '<table class="table adm-bk__tables"><thead><tr><th>Таблиця</th><th class="n">Рядків</th></tr></thead><tbody>' +
              r.tables.map(function (t) { return '<tr><td>' + esc(t.name) + '</td><td class="n">' + H.num(t.rows) + '</td></tr>'; }).join('') +
              '<tr><th>Разом · ' + r.tables.length + ' таблиць</th><th class="n">' + H.num(total) + '</th></tr></tbody></table>' +
            '<p class="hint">Без даних (лише структура): ' + esc(r.excluded.join(', ')) + ' — там секрети й входи; після відновлення всі просто увійдуть знову.</p>' +
            '<p class="hint">На справжньому сервері вміст читається з тимчасової копії бази лише для читання; робоча база не змінюється.</p></div>',
          foot: '<span style="flex:1"></span><button class="btn btn--quiet" type="button" data-ov-close>Закрити</button>' });
      });
    }
    function verify(x) {
      P.toast('info', 'Перевіряю відновлення…', 'Копія ' + P.fmt.dateTime(x.at) + ' розгортається в тимчасову базу.');
      P.srv('admBackupVerify', { id: x.id }).then(function (r) {
        if (!r.ok) { if (r.code !== 'forbidden') P.toast('danger', 'Перевірку не пройдено', r.error || ''); }
        else P.toast('ok', 'Перевірку пройдено', r.message);
        if (ctx.alive()) load();
      });
    }
    ctx.on('bk-now', function (t) {
      t.disabled = true;
      P.srv('admBackupNow', {}).then(function (r) {
        t.disabled = false;
        if (!r.ok) { if (r.code !== 'forbidden') P.toast('warn', 'Копію не зроблено', r.error || ''); return; }
        P.toast('ok', 'Копію зроблено', r.message + (r.removed ? ' За правилом зберігання прибрано старих: ' + r.removed + '.' : ''));
        if (ctx.alive()) load();
      });
    });
    ctx.on('bk-policy', editPolicy);
    ctx.on('bk-more', function (t) {
      var x = find(t.getAttribute('data-id'));
      if (!x) return;
      A.rowMenu(t, [
        { act: 'm-view', ic: 'table', title: 'Переглянути що всередині', sub: 'таблиці, рядки, версія схеми' },
        { act: 'm-verify', ic: 'check', title: 'Перевірити відновлення', sub: x.verifiedAt ? 'перевірено ' + A.ago(x.verifiedAt) : 'ще не перевірялась' }
      ], { 'm-view': function () { view(x); }, 'm-verify': function () { verify(x); } });
    });
    ctx.on('sys-copy', function (t) { copy(data.restore.text, A.q(ctx.el, '[data-cmd="' + t.getAttribute('data-i') + '"]')); });
    load();
  } });
})(window);
