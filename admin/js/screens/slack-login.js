(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm, da = A.da, q = A.q;
  var LAST_CHANNEL = 'adm:slack:lastChannel';   // останній канал, куди слали кнопку (щоб не вписувати ID щоразу)

  function subnav(cur) {
    return '<nav class="pills adm-subnav" aria-label="Розділи вкладки">' + [['main', '/slack-login', 'Кнопка й запити'], ['who', '/slack-login/who', 'Хто входить'], ['log', '/slack-login/log', 'Журнал входів']].map(function (s) {
      return '<a class="pill' + (s[0] === cur ? ' pill--on' : '') + '" href="#' + s[1] + '"' + (s[0] === cur ? ' aria-current="page"' : '') + '>' + esc(s[2]) + '</a>';
    }).join('') + '</nav>';
  }
  P.admLogin = { subnav: subnav };

  var STEPS = [
    ['Створіть додаток у Slack', 'На сайті для розробників Slack: Create New App, назва «Аудит якості», робоча команда компанії.'],
    ['Увімкніть вхід через Slack', 'У додатку ввімкніть вхід через Slack (Sign in with Slack) і впишіть адреси повернення на сайт — їх дасть розробник.'],
    ['Увімкніть кнопки', 'Interactivity: впишіть адресу сервера входу — туди Slack передає натиск кнопки «Увійти в Аудит».'],
    ['Дайте права', 'Писати в канали й особисті повідомлення та показувати вкладку «Головна» у додатку.'],
    ['Встановіть у робочий Slack', 'Кнопка Install; збережіть ключі, які покаже Slack.'],
    ['Впишіть ключі в Supabase', 'Supabase → Edge Functions → Secrets (у чат і в код — ніколи); далі — команди з МАНУАЛу, розділ «Вхід через Slack». Потім надішліть кнопку нижче й натисніть її самі.']
  ];

  function previewHtml(dest) {
    return '<p class="hint">Так виглядає повідомлення в Slack. У тестовій версії нічого справді не надсилається.</p>' +
      '<div style="border:1px solid var(--line);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px">' +
        '<div style="display:flex;gap:8px;align-items:center"><span class="avatar" aria-hidden="true">А</span><b>Аудит якості</b><span class="hint">додаток · щойно</span></div>' +
        '<p style="margin:0">' + esc(P.authSlack.BUTTON_MESSAGE) + '</p>' +
        '<button class="btn btn--primary" type="button" disabled style="align-self:flex-start">' + esc(P.authSlack.BUTTON_LABEL) + '</button></div>' +
      '<p class="hint"><b>Надіслано:</b> ' + esc(dest) + '</p>' +
      '<p class="hint">У журналі (вкладка «Стан») зʼявився рядок «Кнопку входу надіслано».</p>';
  }

  P.cab.tab({ id: 'slack', label: 'Вхід через Slack', ic: 'slack', path: '/slack-login', order: 25, real: true });   // real — працює і на справжньому сервері
  P.cab.screen('/slack-login', { tab: 'slack', title: 'Вхід через Slack', render: function (ctx) {
    var items = [], real = P.authSlack.real();

    function stateBadge(x) {
      if (x.state === 'guest') return H.badge('гість простору', 'warn');
      if (x.state === 'deleted') return H.badge('акаунт у Slack вимкнено', '');
      if (x.state === 'bot' || x.state === 'other_team') return H.badge(P.accessApi.SLACK[x.state], '');
      return !x.state || x.state === 'not_found' ? H.badge('стан у Slack невідомий', '') : '';
    }
    function reqRow(x) {
      var nm = x.name || 'Імʼя зі Slack не отримано', off = x.state === 'deleted', TR = P.teamRequests;
      var where = TR ? TR.sourceText(x) : '';
      return '<div class="adm-person">' + (TR ? TR.avatar(x) : '<span class="avatar" aria-hidden="true">' + esc(x.name ? P.initials(x.name) : '?') + '</span>') +
        '<div class="adm-person__main" style="min-width:min(100%,220px)"><div class="adm-person__name"><b>' + esc(nm) + '</b>' + stateBadge(x) + '</div>' +
        '<span class="adm-person__meta">Slack ' + esc(P.authSlack.maskId(x.slackId)) + ' · ' + esc(where || 'просить увійти') + ' · ' + esc(A.ago(x.createdAt)) + '</span></div>' +
        '<div class="adm-person__acts"><button class="btn btn--primary btn--sm" type="button" data-act="sl-add"' + da('id', x.id) + (off ? ' disabled title="Акаунт цієї людини у Slack вимкнено"' : '') + '>' + P.ic('check', 'ui-icon--sm') + 'Додати</button>' +
          '<button class="btn btn--quiet btn--sm" type="button" data-act="sl-reject"' + da('id', x.id) + '>' + P.ic('close', 'ui-icon--sm') + 'Відхилити</button></div></div>';
    }
    function draw() {
      ctx.el.innerHTML = '<section class="adm-col">' +
        A.head('Вхід через Slack', real ? 'Slack підключено · ' + A.asOf() : 'Тестова версія — Slack не підключено', '', 'admin.slack.setup') + subnav('main') +
        '<section class="card"><h3 class="adm-card-t">' + P.ic('slack', 'ui-icon--sm') + 'Стан підключення</h3>' +
          (real ? '<p class="hint">Slack підключено: люди входять кнопкою «Увійти в Аудит» у Slack' +
              (P.authSlack.siteButton() ? ' або кнопкою «Увійти через Slack» на сайті' : ' (кнопку на сайті вимкнено — у Slack-додатка немає дозволів openid і profile)') + '.</p>'
            : '<p class="hint">Тестова версія — Slack не підключено. Вхід на цьому сайті показано на вигаданих людях; кнопки нижче лише показують, як усе виглядатиме.</p>') +
          '<details' + (real ? '' : ' open') + '><summary class="hint" style="cursor:pointer">Що має зробити власник — шість кроків</summary>' +
            '<ol style="margin:8px 0 0;padding-left:20px;display:flex;flex-direction:column;gap:6px">' + STEPS.map(function (s) {
              return '<li><b>' + esc(s[0]) + '.</b> <span class="hint">' + esc(s[1]) + '</span></li>'; }).join('') + '</ol></details></section>' +
        '<section class="card"><h3 class="adm-card-t">' + P.ic('access', 'ui-icon--sm') + 'Перевірка справжнього входу</h3>' +
          '<p class="hint">Окрема сторінка показує, чи працює справжній вхід: натисніть «Увійти в Аудит» у Slack — посилання відкриє її вже зі входом, і там буде видно ваше імʼя, роль і локації.</p>' +
          '<div><a class="btn btn--secondary" href="../vhid/" target="_blank" rel="noopener">' + P.ic('login', 'ui-icon--sm') + 'Відкрити сторінку перевірки</a></div></section>' +
        '<section class="card"><h3 class="adm-card-t">' + P.ic('login', 'ui-icon--sm') + 'Кнопка входу' + A.help('admin.slack.button') + '</h3>' +
          '<p class="hint">Одна кнопка «Увійти в Аудит» для всіх. Вона вже є в додатку «Аудит якості» у Slack (вкладка «Головна»). Тут можна надіслати ще одну її копію — щоб закріпити в каналі або показати окремій людині.</p>' +
          '<div class="adm-person__acts" style="flex-wrap:wrap"><button class="btn btn--secondary" type="button" data-act="sl-send" data-kind="channel">' + P.ic('slack', 'ui-icon--sm') + 'Надіслати в канал</button>' +
          '<button class="btn btn--secondary" type="button" data-act="sl-send" data-kind="person">' + P.ic('user', 'ui-icon--sm') + 'Надіслати людині</button></div></section>' +
        '<section class="card"><h3 class="adm-card-t">' + P.ic('people', 'ui-icon--sm') + 'Хочуть увійти · ' + items.length + A.help('admin.slack.requests') + '</h3>' +
          (items.length ? '<div class="adm-people">' + items.map(reqRow).join('') + '</div>'
            : H.empty('Зараз ніхто не чекає', 'Коли людина, якої немає в списку, натисне «Увійти в Аудит», вона зʼявиться тут.')) +
          '<p class="hint">Учасників нашого Slack-простору можуть додати й старші аудитори та керівники. Гостей — лише адміністратор.</p></section></section>';
    }
    function load() {
      P.authSlack.requests().then(function (r) {
        if (!ctx.alive()) return;
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        items = r.requests || []; draw();
      });
    }

    function openSend(kind0) {
      P.authSlack.people().then(function (pr) {
        if (!ctx.alive()) return;
        var people = pr && pr.ok ? pr.items : [], st = { kind: kind0 };
        function dest() {
          if (st.kind === 'channel') {
            return A.field('channelId', 'ID каналу', A.input('channelId', P.store.get(LAST_CHANNEL, ''), ' autocomplete="off" maxlength="40" placeholder="ID каналу"'),
              'Відкрийте канал у Slack → його назва вгорі → внизу «ID каналу».', 'admin.slack.channelId');
          }
          return A.field('userId', 'Кому', '<select class="input" name="userId">' + (people.length ? people.map(function (x, i) {
            return '<option value="' + i + '">' + esc(x.name + (x.roleLabel ? ' · ' + x.roleLabel : '') + ' · Slack ' + P.authSlack.maskId(x.slackId)) + '</option>'; }).join('')
            : '<option value="">Немає кого обрати</option>') + '</select>', 'Людина отримає кнопку особистим повідомленням від додатку.');
        }
        A.modal({ size: 'sm', title: 'Надіслати кнопку входу', sub: 'Кнопка «Увійти в Аудит»',
          body: '<div class="adm-form"><div class="field" data-f="kind"><span class="label">Куди</span>' + A.seg('kind', [['channel', 'У канал'], ['person', 'Людині']], st.kind) + '</div>' +
            '<div data-sl-dest>' + dest() + '</div></div>',
          foot: A.cancelBtn() + A.saveBtn('Надіслати', 'slack'),
          onMount: function (el) { A.enterSubmits(el); },
          on: {
            'adm-seg': function (t, e, layer) { st.kind = A.segPick(layer, t); q(layer.el, '[data-sl-dest]').innerHTML = dest(); },
            'adm-save': function (t, e, layer) {
              var o = { kind: st.kind };
              if (st.kind === 'channel') o.channelId = A.val(layer.el, 'channelId');
              else o.person = people[+A.val(layer.el, 'userId')];
              t.disabled = true;
              P.authSlack.sendButton(o).then(function (r) {
                t.disabled = false;
                if (!r.ok) { A.showErrors(layer.el, r); return; }
                if (st.kind === 'channel') P.store.set(LAST_CHANNEL, o.channelId);
                if (real) { layer.close(); P.toast('ok', 'Кнопку входу надіслано'); return; }
                layer.body(previewHtml(r.destination));
                layer.foot('<span style="flex:1"></span><button class="btn btn--primary" type="button" data-ov-close>Готово</button>');
              });
            }
          } });
      });
    }

    ctx.on('sl-send', function (t) { openSend(t.getAttribute('data-kind')); });
    ctx.on('sl-add', function (t) { ctx.go('/people', { req: t.getAttribute('data-id') }); });
    ctx.on('sl-reject', function (t) {
      var x = items.filter(function (i) { return String(i.id) === t.getAttribute('data-id'); })[0];
      if (!x) return;
      P.confirm({ title: 'Відхилити запит · ' + (x.name || 'Slack ' + P.authSlack.maskId(x.slackId)) + '?', text: 'Запит зникне зі списку. Якщо людина знову натисне «Увійти в Аудит», новий запит зʼявиться тут не раніше ніж через добу після цього запиту.', okLabel: 'Відхилити', danger: true })
        .then(function (ok) {
          if (!ok) return;
          P.authSlack.resolveRequest(x.id, 'rejected').then(function (r) {
            if (!r.ok) { A.failToast(r); return; }
            P.toast('ok', 'Запит відхилено · ' + x.name);
            if (ctx.alive()) load();
          });
        });
    });
    load();
  } });
})(window);
