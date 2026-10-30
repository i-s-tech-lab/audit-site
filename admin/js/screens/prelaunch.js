(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm;
  var STATE = { ok: ['гаразд', 'ok'], warn: ['варто перевірити', 'warn'], bad: ['потрібна дія', 'danger'], info: ['довідково', ''] };
  var GROUP_IC = { server: 'power', slack: 'slack', data: 'table', people: 'people', mail: 'notification', backups: 'backup', watchdog: 'clock' };

  function row(x) {
    var s = STATE[x.state] || STATE.info;
    return '<div class="adm-pl-row adm-pl-row--' + esc(x.state) + '"><span class="adm-pl-dot" aria-hidden="true"></span><div class="adm-pl-main">' +
      '<div class="adm-pl-top"><b>' + esc(x.title) + '</b>' + H.badge(s[0], s[1]) + '</div>' +
      '<span class="adm-pl-val">' + esc(x.value) + '</span>' +
      (x.todo && x.state !== 'ok' ? '<p class="adm-pl-todo"><b>Що зробити:</b> ' + esc(x.todo) + '</p>' : '') + '</div></div>';
  }
  function group(g, items) {
    var list = items.filter(function (x) { return x.group === g.id; });
    if (!list.length) return '';
    return '<section class="card adm-pl-card"><h3 class="adm-card-t">' + P.ic(GROUP_IC[g.id] || 'info', 'ui-icon--sm') + esc(g.label) + A.help('admin.prelaunch.' + g.id) + '</h3>' +
      '<div class="adm-pl-rows">' + list.map(row).join('') + '</div></section>';
  }
  function channelCard(ch) {
    return '<section class="card adm-pl-card adm-pl-chan"><h3 class="adm-card-t">' + P.ic('notification', 'ui-icon--sm') + 'Канал «важливе»' + A.help('admin.prelaunch.important') + '</h3>' +
      '<p class="hint">Сюди сервер пише лише важливе: людина натиснула «Увійти» і чекає на доступ, або сайт не відповідає. Більше нічого.</p>' +
      '<div class="adm-pl-chan__line"><span class="adm-dim">Код каналу</span> ' + (ch ? '<b class="adm-sys-mono">' + esc(ch) + '</b>' : '<b>не задано</b>') +
        A.pen('pl-edit', '', 'Редагувати · Канал «важливе»') + '</div>' +
      '<div class="adm-pl-chan__btns"><button class="btn btn--secondary btn--sm" type="button" data-act="pl-test"' + (ch ? '' : ' disabled') + '>' + P.ic('notification', 'ui-icon--sm') + 'Надіслати пробне</button>' +
        (ch ? '' : '<span class="hint">Спершу впишіть код каналу (олівець).</span>') + '</div></section>';
  }
  function demoBanner() {
    return '<div class="banner">' + P.ic('info', 'icon') + '<div class="banner__body"><p class="banner__title">Тестовий сайт: серверні перевірки не виконуються</p>' +
      '<p class="banner__text">Служби, ключі Slack, копії й сторож перевіряє лише справжній сервер. Перевірки даних нижче — за тестовими даними.</p></div></div>';
  }

  P.cab.tab({ id: 'prelaunch', label: 'Перед запуском', ic: 'checked', path: '/prelaunch', order: 66, real: 'admPrelaunch' });   // порядок у меню задає група «Система» (index.html)
  P.cab.screen('/prelaunch', { tab: 'prelaunch', title: 'Перевірки перед запуском', render: function (ctx) {
    var data = null, channel = null;
    function draw() {
      var s = data.summary, rest = s.warn + s.bad;
      ctx.el.innerHTML = '<section class="adm-col">' +
        A.head('Перевірки перед запуском', A.asOf() + ' · лише перегляд', '<button class="btn btn--primary" type="button" data-act="pl-refresh">' + P.ic('refresh') + 'Перевірити ще раз</button>', 'admin.prelaunch.page') +
        (data.real ? '' : demoBanner()) +
        '<div class="kpis">' + A.kpi(s.ok + ' з ' + s.total, 'готово до запуску', 'admin.prelaunch.summary') +
          A.kpi(String(s.bad), A.plural(s.bad, ['потрібна дія', 'потрібні дії', 'потрібних дій']), 'admin.prelaunch.bad') +
          A.kpi(String(s.warn), 'варто перевірити', 'admin.prelaunch.warn') + '</div>' +
        (data.real && !rest ? '<div class="banner banner--ok">' + P.ic('success', 'icon') + '<div class="banner__body"><p class="banner__title">Усе гаразд — можна запускати</p></div></div>' : '') +
        '<div class="adm-sys-grid">' + channelCard(channel) + data.groups.map(function (g) { return group(g, data.items); }).join('') + '</div></section>';
    }
    function load() {
      Promise.all([P.srv('admPrelaunch', {}), P.srv('admImportant', {})]).then(function (rs) {
        if (!ctx.alive()) return;
        if (!rs[0].ok) { ctx.el.innerHTML = H.error(rs[0]); return; }
        data = rs[0]; channel = rs[1].ok ? rs[1].channel : null;
        draw();
      });
    }
    function edit() {
      var body = '<div class="adm-form">' + A.field('channel', 'Код каналу Slack', A.input('channel', channel || '', ' autocomplete="off" maxlength="24" placeholder="C0123…"'),
        'Залиште порожнім, щоб вимкнути. Код видно у Slack: правою кнопкою на каналі → «Копіювати посилання» — код в кінці посилання (починається з C чи G). Бота треба додати в канал.', 'admin.prelaunch.channel') + '</div>';
      A.modal({ size: 'sm', title: 'Канал «важливе»', sub: channel ? esc(channel) : 'не задано', body: body, foot: A.cancelBtn() + A.saveBtn('Зберегти'),
        onMount: function (el) { A.enterSubmits(el); var i = A.q(el, 'input.input'); if (i) i.select(); },
        on: { 'adm-save': function (b, e, layer) {
          var el = layer.el;
          b.disabled = true;
          P.srv('admImportantSave', { channel: A.val(el, 'channel').trim() }).then(function (r) {
            b.disabled = false;
            if (!r.ok) { A.showErrors(el, r); return; }
            layer.close();
            P.toast('ok', 'Збережено · Канал «важливе»', r.channel ? 'Тепер важливе буде йти в цей канал.' : 'Канал вимкнено.');
            if (ctx.alive()) load();
          });
        } } });
    }
    ctx.on('pl-refresh', function (t) { t.disabled = true; load(); });
    ctx.on('pl-edit', edit);
    ctx.on('pl-test', function (t) {
      t.disabled = true;
      P.srv('admImportantTest', {}).then(function (r) {
        t.disabled = false;
        if (!r.ok) { if (r.code !== 'forbidden') P.toast('warn', 'Не вдалося', r.error || ''); return; }
        if (r.demo) { P.toast('info', 'Тестовий сайт', r.note); return; }
        P.toast(r.sent ? 'ok' : 'warn', r.sent ? 'Пробне надіслано' : 'Пробне не надіслано', r.message || '');
      });
    });
    load();
  } });
})(window);
