(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm;
  var STATE = { ok: ['гаразд', 'ok', 'success'], warn: ['варто перевірити', 'warn', 'warning'], bad: ['потрібна дія', 'danger', 'error'], info: ['довідково', '', 'info'] };
  var GROUP_IC = { server: 'power', slack: 'slack', data: 'table', people: 'people', mail: 'notification', backups: 'backup', watchdog: 'clock' };
  var RANK = { bad: 0, warn: 1, info: 2 };

  function st(x) { return STATE[x.state] || STATE.info; }
  function stateIc(x) { var s = st(x); return '<span class="adm-pl-ic adm-pl-ic--' + esc(STATE[x.state] ? x.state : 'info') + '" title="' + esc(s[0]) + '">' + P.ic(s[2], 'ui-icon--sm') + '</span>'; }
  function needsTodo(x) { return !!x.todo && x.state !== 'ok'; }
  function isProblem(x) { return x.state === 'bad' || x.state === 'warn'; }
  function rank(x) { return Object.prototype.hasOwnProperty.call(RANK, x.state) ? RANK[x.state] : 2; }   // невідомий стан — як довідковий

  function cell(x) {
    var inner = stateIc(x) + '<span class="adm-pl-cell__txt"><b>' + esc(x.title) + '</b><span class="adm-pl-val" title="' + esc(x.value) + '">' + esc(x.value) + '</span></span>' +
      '<span class="ui-sr-only">' + esc(st(x)[0]) + '</span>';
    return needsTodo(x)
      ? '<button class="adm-pl-cell adm-pl-cell--go" type="button" data-act="pl-go" data-id="' + esc(x.id) + '" title="Що зробити">' + inner + '</button>'
      : '<div class="adm-pl-cell">' + inner + '</div>';
  }
  function overGroup(g, items) {
    var list = items.filter(function (x) { return x.group === g.id; });
    if (!list.length) return '';
    var bad = list.filter(function (x) { return x.state === 'bad'; }).length, warn = list.filter(function (x) { return x.state === 'warn'; }).length;
    var judged = list.filter(function (x) { return x.state !== 'info'; });   // довідкові не оцінюються — «гаразд» від них не залежить
    var allOk = judged.length > 0 && judged.every(function (x) { return x.state === 'ok'; });
    var tag = bad ? H.badge(bad + ' ' + A.plural(bad, ['потрібна дія', 'потрібні дії', 'потрібних дій']), 'danger')
      : warn ? H.badge(warn + ' варто перевірити', 'warn') : allOk ? H.badge('гаразд', 'ok') : '';
    return '<div class="adm-pl-og"><div class="adm-pl-og__h">' + P.ic(GROUP_IC[g.id] || 'info', 'ui-icon--sm') + '<b>' + esc(g.label) + '</b>' + A.help('admin.prelaunch.' + g.id) + tag + '</div>' +
      list.map(cell).join('') + '</div>';
  }
  function overview(data) {
    var legend = ['ok', 'bad', 'warn', 'info'].map(function (k) { return '<span>' + stateIc({ state: k }) + esc(STATE[k][0]) + '</span>'; }).join('');
    return '<section class="card adm-pl-over"><h3 class="adm-card-t">' + P.ic('checked', 'ui-icon--sm') + 'Стан усіх перевірок' + A.help('admin.prelaunch.overview') + '</h3>' +
      '<div class="adm-pl-legend">' + legend + '</div>' +
      '<div class="adm-pl-over__grid">' + data.groups.map(function (g) { return overGroup(g, data.items); }).join('') + '</div></section>';
  }
  function todoRow(x, label) {
    var s = st(x);
    return '<div class="adm-pl-row adm-pl-row--' + esc(x.state) + '" data-pl="' + esc(x.id) + '" tabindex="-1">' + stateIc(x) + '<div class="adm-pl-main">' +
      '<div class="adm-pl-top"><span class="adm-dim">' + esc(label) + ' ·</span><b>' + esc(x.title) + '</b>' + H.badge(s[0], s[1]) + '</div>' +
      '<span class="adm-pl-val">' + esc(x.value) + '</span>' +
      '<p class="adm-pl-todo"><b>Що зробити:</b> ' + esc(x.todo) + '</p></div></div>';
  }
  function todoCard(data) {
    var labels = {}; data.groups.forEach(function (g) { labels[g.id] = g.label; });
    var list = data.items.map(function (x, i) { return [x, i]; }).filter(function (p) { return needsTodo(p[0]); })
      .sort(function (a, b) { return (rank(a[0]) - rank(b[0])) || (a[1] - b[1]); }).map(function (p) { return p[0]; });
    var n = list.filter(isProblem).length;
    return '<section class="card adm-pl-card"><h3 class="adm-card-t">' + P.ic('warning', 'ui-icon--sm') + 'Що зробити' + (n ? ' · ' + n : '') + A.help('admin.prelaunch.todo') + '</h3>' +
      (n ? '' : '<p class="hint">Нічого термінового: усі перевірки гаразд або довідкові.</p>') +
      (list.length ? '<div class="adm-pl-rows">' + list.map(function (x) { return todoRow(x, labels[x.group] || ''); }).join('') + '</div>' : '') + '</section>';
  }
  function chanText(ch) { return ch === undefined ? 'не вдалося прочитати' : ch || 'не задано'; }
  function channelCard(ch) {
    return '<section class="card adm-pl-card adm-pl-chan"><h3 class="adm-card-t">' + P.ic('notification', 'ui-icon--sm') + 'Канал «важливе»' + A.help('admin.prelaunch.important') + '</h3>' +
      '<p class="hint">Сюди сервер пише лише важливе: людина натиснула «Увійти» і чекає на доступ, або сайт не відповідає. Більше нічого.</p>' +
      '<div class="adm-pl-chan__line"><span class="adm-dim">Код каналу</span> ' + (ch ? '<b class="adm-sys-mono">' + esc(ch) + '</b>' : '<b>' + esc(chanText(ch)) + '</b>') +
        A.pen('pl-edit', '', 'Редагувати · Канал «важливе»') + '</div>' +
      '<div class="adm-pl-chan__btns"><button class="btn btn--secondary btn--sm" type="button" data-act="pl-test"' + (ch ? '' : ' disabled') + '>' + P.ic('notification', 'ui-icon--sm') + 'Надіслати пробне</button>' +
        (ch ? '' : '<span class="hint">' + (ch === undefined ? 'Натисніть «Перевірити ще раз».' : 'Спершу впишіть код каналу (олівець).') + '</span>') + '</div></section>';
  }
  var MARK = { ok: '✓', bad: '✗', warn: '⚠', info: 'i' };
  function chatText(data, channel) {
    var s = data.summary, out = ['Готово до запуску: ' + s.ok + ' з ' + s.total + ' · потрібна дія: ' + s.bad + ' · варто перевірити: ' + s.warn];
    if (!data.real) out.push('(тестовий сайт: серверні перевірки не виконуються)');
    out.push('Позначки: ✓ гаразд · ✗ потрібна дія · ⚠ варто перевірити · i довідково');
    data.groups.forEach(function (g) {
      var list = data.items.filter(function (x) { return x.group === g.id; });
      if (!list.length) return;
      out.push('', g.label.toUpperCase());
      list.forEach(function (x) { out.push((MARK[x.state] || 'i') + ' ' + x.title + ' — ' + x.value); });
    });
    var todo = data.items.filter(needsTodo).sort(function (a, b) { return rank(a) - rank(b); });
    if (todo.length) {
      var labels = {}; data.groups.forEach(function (g) { labels[g.id] = g.label; });
      out.push('', 'ЩО ЗРОБИТИ');
      todo.forEach(function (x) { out.push((MARK[x.state] || 'i') + ' ' + (labels[x.group] || '') + ' · ' + x.title + ': ' + x.todo); });
    }
    out.push('', 'Канал «важливе»: ' + chanText(channel));
    return out.join('\n');
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
      if (P.chatText) P.chatText.add('prelaunch', function () { return chatText(data, channel); });
      ctx.el.innerHTML = '<section class="adm-col" data-chat="prelaunch">' +
        A.head('Перевірки перед запуском', A.asOf() + ' · лише перегляд', '<button class="btn btn--primary" type="button" data-act="pl-refresh">' + P.ic('refresh') + 'Перевірити ще раз</button>', 'admin.prelaunch.page') +
        (data.real ? '' : demoBanner()) +
        '<div class="kpis">' + A.kpi(s.ok + ' з ' + s.total, 'готово до запуску', 'admin.prelaunch.summary') +
          A.kpi(String(s.bad), A.plural(s.bad, ['потрібна дія', 'потрібні дії', 'потрібних дій']), 'admin.prelaunch.bad') +
          A.kpi(String(s.warn), 'варто перевірити', 'admin.prelaunch.warn') + '</div>' +
        (data.real && !rest ? '<div class="banner banner--ok">' + P.ic('success', 'icon') + '<div class="banner__body"><p class="banner__title">Усе гаразд — можна запускати</p></div></div>' : '') +
        overview(data) +
        '<div class="adm-sys-grid">' + todoCard(data) + channelCard(channel) + '</div></section>';
    }
    function load() {
      Promise.all([P.srv('admPrelaunch', {}), P.srv('admImportant', {})]).then(function (rs) {
        if (!ctx.alive()) return;
        if (!rs[0].ok) { ctx.el.innerHTML = H.error(rs[0]); return; }
        data = rs[0]; channel = rs[1].ok ? rs[1].channel : undefined;
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
    function go(t) {
      var id = t.getAttribute('data-id'), rows = ctx.el.querySelectorAll('[data-pl]'), row = null;
      for (var i = 0; i < rows.length; i++) if (rows[i].getAttribute('data-pl') === id) row = rows[i];
      if (!row) return;
      row.scrollIntoView({ block: 'center', behavior: 'smooth' });
      row.focus({ preventScroll: true });
      row.classList.remove('is-flash'); void row.offsetWidth; row.classList.add('is-flash');
    }
    ctx.on('pl-refresh', function (t) { t.disabled = true; load(); });
    ctx.on('pl-edit', edit);
    ctx.on('pl-go', go);
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
