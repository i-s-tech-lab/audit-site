(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm;
  var URLS = [
    ['Event Subscriptions → Request URL', '/functions/v1/slack-auth/events'],
    ['Interactivity & Shortcuts → Request URL', '/functions/v1/slack-auth/interact'],
    ['Slash Commands → /audit → Request URL', '/functions/v1/slack-auth/command'],
    ['OAuth & Permissions → Redirect URLs (лише для кнопки входу)', '/functions/v1/slack-auth/oidc/callback']
  ];
  var BOT_ERR = { no_token: 'ключа бота ще немає', demo: 'на тестовому сайті не перевіряється', network: 'Slack не відповів — спробуйте пізніше',
    invalid_auth: 'Slack не приймає ключ — вставте новий', token_revoked: 'ключ відкликано — вставте новий', account_inactive: 'бота вимкнено в Slack' };

  function botCard(d) {
    var b = d.bot || {};
    var line = b.ok ? '<b>' + esc(b.user) + '</b> · простір «' + esc(b.team) + '»' + H.badge('працює', 'ok')
      : '<b>' + esc(BOT_ERR[b.error] || ('Slack відповів: ' + (b.error || 'невідомо'))) + '</b>' + (b.error === 'demo' ? '' : H.badge(b.error === 'no_token' ? 'не підключено' : 'не працює', b.error === 'no_token' ? 'warn' : 'danger'));
    return '<section class="card adm-sl-card"><h3 class="adm-card-t">' + P.ic('slack', 'ui-icon--sm') + 'Бот зараз' + A.help('admin.slack.bot') + '</h3>' +
      '<div class="adm-sl-bot">' + line + '</div>' +
      '<dl class="kv adm-sys-kv"><dt>Простір (Team ID)' + A.help('admin.slack.team') + '</dt><dd>' + (d.team ? '<span class="adm-sys-mono">' + esc(d.team) + '</span>' : 'не задано') + '</dd></dl>' +
      '<p class="hint">Простір підставляється сам, коли ви вставляєте ключ бота.</p></section>';
  }
  function keyRow(f) {
    return '<div class="adm-sl-row"><div class="adm-sl-main"><div class="adm-sl-top"><b>' + esc(f.label) + '</b>' +
      (f.set ? H.badge('задано', 'ok') : H.badge('не задано', 'warn')) + '</div>' +
      (f.set ? '<span class="adm-sys-mono adm-sl-val">' + esc(f.shown) + '</span>' : '') +
      '<span class="hint">Де взяти: ' + esc(f.where) + '</span></div>' +
      A.pen('sl-edit', ' data-key="' + esc(f.key) + '"', 'Змінити · ' + f.label) + '</div>';
  }
  function keysCard(d) {
    return '<section class="card adm-sl-card"><h3 class="adm-card-t">' + P.ic('key', 'ui-icon--sm') + 'Ключі' + A.help('admin.slack.keys') + '</h3>' +
      '<p class="hint">Перейшли на іншого бота — вставте його ключі сюди (олівець). Старе значення заміниться, діє одразу.</p>' +
      '<div class="adm-sl-rows">' + d.fields.map(keyRow).join('') + '</div></section>';
  }
  function oidcCard(d) {
    var ready = d.fields.filter(function (f) { return f.key === 'SLACK_CLIENT_ID' || f.key === 'SLACK_CLIENT_SECRET'; }).every(function (f) { return f.set; });
    return '<section class="card adm-sl-card"><h3 class="adm-card-t">' + P.ic('login', 'ui-icon--sm') + 'Кнопка «Увійти через Slack»' + A.help('admin.slack.oidc') + '</h3>' +
      '<div class="adm-sl-bot">' + (d.oidc ? H.badge('увімкнено', 'ok') : H.badge('вимкнено', '')) + '</div>' +
      '<p class="hint">Потрібні Client ID і Client Secret, адреса повернення (нижче, остання) і дозволи openid та profile у Slack-додатка.</p>' +
      '<div class="adm-pl-chan__btns"><button class="btn btn--secondary btn--sm" type="button" data-act="sl-oidc"' + (!d.oidc && !ready ? ' disabled' : '') + '>' +
        P.ic(d.oidc ? 'power' : 'login', 'ui-icon--sm') + (d.oidc ? 'Вимкнути кнопку' : 'Увімкнути кнопку') + '</button>' +
        (!d.oidc && !ready ? '<span class="hint">Спершу впишіть Client ID і Client Secret.</span>' : '') + '</div></section>';
  }
  function urlsCard() {
    var origin = root.location && root.location.origin && /^https?:/.test(root.location.origin) ? root.location.origin : '<адреса сайту>';
    return '<section class="card adm-sl-card"><h3 class="adm-card-t">' + P.ic('link', 'ui-icon--sm') + 'Адреси для сторінки бота' + A.help('admin.slack.urls') + '</h3>' +
      '<p class="hint">Їх вписують на сторінці налаштувань бота в Slack (Your Apps → ваш бот). Повні кроки — docs/AUDITBOT-ПЕРЕМИКАННЯ.md.</p>' +
      '<div class="adm-sl-rows">' + URLS.map(function (u, i) {
        return '<div class="adm-sl-row"><div class="adm-sl-main"><b>' + esc(u[0]) + '</b><span class="adm-sys-mono adm-sl-val">' + esc(origin + u[1]) + '</span></div>' +
          '<button class="icon-btn" type="button" data-act="sl-copy" data-i="' + i + '" title="Скопіювати" aria-label="Скопіювати адресу · ' + esc(u[0]) + '">' + P.ic('export') + '</button></div>';
      }).join('') + '</div></section>';
  }
  function demoBanner(note) {
    return '<div class="banner">' + P.ic('info', 'icon') + '<div class="banner__body"><p class="banner__title">Тестовий сайт</p><p class="banner__text">' + esc(note) + '</p></div></div>';
  }

  P.cab.tab({ id: 'slackcfg', label: 'Налаштування Slack', ic: 'slack', path: '/slack-settings', order: 67, real: 'admSlack' });   // id 'slack' уже має «Вхід через Slack»   // місце в меню задає група «Система» (index.html)
  P.cab.screen('/slack-settings', { tab: 'slackcfg', title: 'Налаштування Slack', render: function (ctx) {
    var data = null;
    function draw() {
      ctx.el.innerHTML = '<section class="adm-col">' +
        A.head('Налаштування Slack', A.asOf() + ' · ключі Slack-додатка', '<button class="btn btn--secondary" type="button" data-act="sl-refresh">' + P.ic('refresh') + 'Перевірити ще раз</button>', 'admin.slack.page') +
        (data.real ? '' : demoBanner(data.note || '')) +
        '<div class="adm-sys-grid">' + botCard(data) + keysCard(data) + oidcCard(data) + urlsCard() + '</div></section>';
    }
    function load() {
      P.srv('admSlack', {}).then(function (r) {
        if (!ctx.alive()) return;
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        data = r; draw();
      });
    }
    function edit(t) {
      var key = t.getAttribute('data-key'), f = data.fields.filter(function (x) { return x.key === key; })[0];
      if (!f) return;
      var body = '<div class="adm-form">' +
        A.field('value', 'Нове значення', A.input('value', '', ' type="' + (f.secret ? 'password' : 'text') + '" autocomplete="' + (f.secret ? 'new-password' : 'off') + '" spellcheck="false" maxlength="200"'),
          'Де взяти: ' + f.where + '. Вставте (Ctrl+V) і натисніть «Зберегти». ' + (f.set ? 'Зараз задано: ' + f.shown + ' — заміниться.' : 'Зараз не задано.'), 'admin.slack.' + key) +
        '<div class="adm-sl-confirm" hidden></div></div>';
      A.modal({ size: 'sm', title: f.label, sub: f.set ? 'задано · ' + esc(f.shown) : 'не задано', body: body, foot: A.cancelBtn() + A.saveBtn('Зберегти'),
        onMount: function (el) {
          A.enterSubmits(el);
          var i = A.q(el, 'input.input'), box = A.q(el, '.adm-sl-confirm');
          if (i) {
            i.focus();
            i.addEventListener('input', function () { if (box && !box.hidden) { box.hidden = true; box.innerHTML = ''; } });
          }
        },
        on: { 'adm-save': function (b, e, layer) {
          var el = layer.el, box = A.q(el, '.adm-sl-confirm'), tick = A.q(el, 'input[name="confirm"]');
          b.disabled = true;
          P.srv('admSlackSave', { key: key, value: A.val(el, 'value'), confirm: !!(tick && tick.checked) }).then(function (r) {
            b.disabled = false;
            if (!r.ok && r.confirm) {   // бойовий бот чи інший простір: попередження й галочка; наступне «Зберегти» — з підтвердженням
              box.hidden = false;
              box.innerHTML = '<p class="adm-sl-warn">' + P.ic('warning', 'ui-icon--sm') + esc(r.error) + '</p>' +
                '<label class="adm-sl-tick"><input type="checkbox" name="confirm"> Так, підключити цього бота до нашого сервера</label>';
              return;
            }
            if (!r.ok) { A.showErrors(el, r); return; }
            layer.close();
            if (r.demo) { P.toast('info', 'Тестовий сайт', r.note); return; }
            P.toast(r.logged === false || r.alerted === false ? 'warn' : 'ok', 'Збережено · ' + f.label, (r.changed ? (r.teamChanged ? 'Це інший простір Slack — люди з попереднього не зможуть увійти.' : 'Діє одразу.') : 'Значення те саме — нічого не змінено.') +
              (r.logged === false ? ' Рядок у журналі змін не записався.' : '') +
              (r.alerted === false ? ' Попередження в канал «важливе» не надіслано (канал не задано чи Slack не прийняв).' : ''));
            if (ctx.alive()) { data = r; draw(); }
          });
        } } });
    }
    ctx.on('sl-refresh', function (t) { t.disabled = true; load(); });
    ctx.on('sl-edit', edit);
    ctx.on('sl-oidc', function (t) {
      var on = !data.oidc;
      t.disabled = true;
      P.srv('admSlackSave', { oidc: on ? 'on' : 'off' }).then(function (r) {
        t.disabled = false;
        if (!r.ok) { P.toast('warn', 'Не вдалося', r.error || ''); return; }
        if (r.demo) { P.toast('info', 'Тестовий сайт', r.note); return; }
        P.toast('ok', on ? 'Кнопку входу ввімкнено' : 'Кнопку входу вимкнено', 'Люди побачать зміну, коли оновлять сторінку.');
        if (ctx.alive()) { data = r; draw(); }
      });
    });
    ctx.on('sl-copy', function (t) {
      var u = URLS[Number(t.getAttribute('data-i'))], origin = root.location.origin;
      if (!u) return;
      P.hdrTools.copy(origin + u[1]).then(function (ok) { P.toast(ok ? 'ok' : 'warn', ok ? 'Адресу скопійовано' : 'Не вдалося скопіювати', ok ? u[0] : 'Виділіть адресу вручну.'); });
    });
    load();
  } });
})(window);
