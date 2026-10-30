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

  function isReal() { return !!(P.cab && P.cab.real && P.cab.real()); }
  var POLL_MS = 5000, POLL_MAX_MS = 10 * 60 * 1000;
  var SETUP = [
    'Підключіться до сервера (AnyDesk) і відкрийте PowerShell від імені адміністратора (Пуск → набрати PowerShell → правою кнопкою → «Запуск від імені адміністратора»).',
    'Перейдіть у теку оновлення: cd C:\\AuditServer\\update\\current',
    'Запустіть: & "C:\\Program Files\\nodejs\\node.exe" tools\\server-backup-setup.mjs — наприкінці має бути «Готово».',
    'Перезапустіть сервер: Restart-Service audit-server -Force; Start-Service audit-caddy',
    'Оновіть цю сторінку: у шапці зʼявиться стан копій, перша копія — приблизно за 3 хвилини.'
  ];
  var KINDS = [['manual', 'Зроблені вручну'], ['daily', 'Щоденні'], ['weekly', 'Щотижневі'], ['monthly', 'Щомісячні']];
  var POLICY = [['daily', 'Щоденних копій', 'Від 1 до 31.'], ['weekly', 'Щотижневих копій', 'Від 0 до 12.'], ['monthly', 'Щомісячних копій', 'Від 0 до 24.']];
  function mask(id) { id = String(id || ''); return id.length > 5 ? id.charAt(0) + '…' + id.slice(-3) : id ? '…' : ''; }
  function sentText(l) { return nextText(l.at) + (l.bytes ? ' · ' + bytes(l.bytes) : ''); }
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
        (x.verifiedAt ? ' · перевірено ' + esc(A.ago(x.verifiedAt)) : '') + (x.checkedAt ? ' · файл перевірено ' + esc(A.ago(x.checkedAt)) : '') + '</span></div>' +
      A.more('bk-more', da('id', x.id), 'Дії · копія ' + P.fmt.dateTime(x.at)) + '</div>';
  }
  function list(items) {
    return KINDS.map(function (k) {
      var g = items.filter(function (x) { return x.kind === k[0]; });
      return g.length ? '<h4 class="adm-bk__group">' + esc(k[1]) + ' · ' + g.length + '</h4><div class="adm-bk__list">' + g.map(row).join('') + '</div>' : '';
    }).join('');
  }

  P.cab.tab({ id: 'backups', label: 'Резервні копії', ic: 'backup', path: '/backups', order: 60, real: 'admBackups' });   // real — видно, коли admBackups є на двигуні сервера
  P.cab.screen('/backups', { tab: 'backups', title: 'Резервні копії', render: function (ctx) {
    var data = null, poll = null, pollUntil = 0, real = isReal();
    function find(id) { return data.items.filter(function (x) { return x.id === id; })[0]; }
    function drawOff(r) {
      ctx.el.innerHTML = '<section class="adm-col">' + A.head('Резервні копії', A.asOf() + ' · копії на сервері ще не налаштовано', '', 'admin.system.schedule') +
        (r.problem ? '<div class="banner banner--warn">' + P.ic('warning', 'icon') + '<div class="banner__body"><p class="banner__title">Налаштування копій з помилкою</p>' +
          '<p class="banner__text">' + esc(r.problem) + '</p></div></div>' : '') +
        '<section class="card"><h3 class="adm-card-t">' + P.ic('info', 'ui-icon--sm') + 'Як увімкнути копії на сервері' + A.help('admin.system.schedule') + '</h3>' +
          '<p class="hint"><b>Один раз, на самому сервері.</b> Після цього сервер сам робить копію щодня о ' + esc(r.schedule.at) + ' за Києвом, а тут зʼявиться кнопка «Зробити копію зараз».</p>' +
          '<ol class="hint">' + SETUP.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' +
          '<p class="hint">Докладно — у МАНУАЛі, розділ «РЕЗЕРВНА КОПІЯ БАЗИ» → <b>«▶ npm run server:backup-setup»</b>.</p></section></section>';
    }
    function notice(r) {
      if (r.running) return '<div class="banner"><span class="ui-spinner ui-spinner--sm" aria-hidden="true"></span><div class="banner__body"><p class="banner__title">Копія робиться просто зараз</p>' +
        '<p class="banner__text">Зазвичай це хвилина-дві. Сторінка оновиться сама, коли копія буде готова.</p></div></div>';
      var h = r.head;
      if (h && h.state === 'failed') return '<div class="banner banner--danger">' + P.ic('warning', 'icon') + '<div class="banner__body"><p class="banner__title">Остання копія не вдалась</p>' +
        '<p class="banner__text">' + esc(h.error || 'Причину записано в журнал копій на сервері (backup.log).') + ' Спробуйте «Зробити копію зараз»; не допоможе — перевірте сервер.</p></div></div>';
      return '';
    }
    function watch(kind) {
      if (poll) return;
      pollUntil = Date.now() + POLL_MAX_MS;
      poll = root.setInterval(function () {
        if (!ctx.alive() || Date.now() > pollUntil) { root.clearInterval(poll); poll = null; return; }
        P.srv('admBackups', {}).then(function (r) {
          if (!poll || !ctx.alive() || !r.ok) return;
          data = r; draw(r);
          if (kind === 'slack' ? r.slack && r.slack.sending : r.running) return;
          root.clearInterval(poll); poll = null;
          if (kind === 'slack') {   // v1.2: відправка в Slack закінчилась — результат
            var sl = r.slack && r.slack.last;
            if (sl) P.toast(sl.ok ? 'ok' : 'danger', sl.ok ? 'Копію надіслано в Slack' : 'Копію не надіслано в Slack', sl.ok ? bytes(sl.bytes) + ', зашифровано.' : (sl.error || ''));
            return;
          }
          var failed = r.head && r.head.state === 'failed';
          P.toast(failed ? 'danger' : 'ok', failed ? 'Копію не зроблено' : 'Копію зроблено',
            failed ? (r.head.error || '') : (r.items[0] ? bytes(r.items[0].bytes) + ', таблиць ' + r.items[0].tables + '.' : ''));
        });
      }, POLL_MS);
    }
    function slackCard(r) {
      var pol = r.policy, s = r.slack, on = !!pol.slackOn, to = s ? s.to : mask(pol.slackTo), badge, rows = '';
      if (!on) badge = '<span class="badge">вимкнено</span>';
      else if (s && !s.keySet) badge = '<span class="badge badge--warn">увімкнено, але пароль копій не задано</span>';
      else if (s && !s.tokenSet) badge = '<span class="badge badge--warn">увімкнено, але в сервера немає ключа Slack-бота</span>';
      else if (s && s.sending) badge = '<span class="badge badge--info"><span class="ui-spinner ui-spinner--sm" aria-hidden="true"></span>надсилається…</span>';
      else badge = '<span class="badge badge--ok">' + P.ic('check', 'ui-icon--sm') + 'увімкнено</span>';
      rows += kv('Стан', badge);
      if (on) rows += kv('Куди', esc(to || '—'));
      if (s) {
        rows += kv('Остання відправка', s.last ? (s.last.ok ? esc(sentText(s.last)) + ' · зашифровано'
          : '<span class="adm-dim">не вдалася, ' + esc(nextText(s.last.at)) + ':</span> ' + esc(s.last.error || 'причина невідома')) : '<span class="adm-dim">ще не було</span>');
        rows += kv('Пароль копій', s.keySet ? '<span class="badge badge--ok">задано</span>'
          : '<span class="badge badge--warn">не задано</span> <span class="adm-dim">— на сервері: npm run server:backup-key</span>');
      }
      return '<section class="card"><div class="adm-sys-t"><h3 class="adm-card-t">' + P.ic('export', 'ui-icon--sm') + 'Копія в Slack</h3>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-act="bk-policy">' + P.ic('edit', 'ui-icon--sm') + 'Редагувати</button></div>' +
        '<dl class="kv adm-sys-kv">' + rows + '</dl>' +
        '<p class="hint">Після кожної копії — щоденної і після «Зробити копію зараз» — сервер надсилає її у Slack. У Slack іде лише <b>зашифрований</b> файл — відкрити його можна лише паролем копій.</p>' +
        (real ? '<button class="btn btn--secondary btn--sm" type="button" data-act="bk-slack"' + (!on || !s || !s.keySet || s.sending || !r.items.length ? ' disabled' : '') + '>' +
            P.ic('export', 'ui-icon--sm') + 'Надіслати останню копію в Slack зараз</button>'
          : '<p class="hint">На тестовому сайті копія в Slack не надсилається — тут можна лише налаштувати правило.</p>') + '</section>';
    }
    function draw(r) {
      if (r.configured === false) { drawOff(r); return; }
      var t = r.totals, pol = r.policy, last = r.items[0] || null;
      var ver = r.items.map(function (x) { return x.verifiedAt; }).filter(Boolean).sort().pop() || null;
      ctx.el.innerHTML = '<section class="adm-col">' +
        A.head('Резервні копії', A.asOf() + ' · щодня о ' + r.schedule.at + (r.schedule.next ? ', наступна — ' + nextText(r.schedule.next) : ''),
          r.running ? '<button class="btn btn--primary" type="button" disabled><span class="ui-spinner ui-spinner--sm" aria-hidden="true"></span>Копія робиться…</button>'
            : '<button class="btn btn--primary" type="button" data-act="bk-now">' + P.ic('backup') + 'Зробити копію зараз</button>', 'admin.system.schedule') +
        (real ? notice(r) : demoBanner()) +
        '<div class="kpis">' + A.kpi(H.num(t.count), A.plural(t.count, ['копія', 'копії', 'копій']), 'admin.system.count') +
          A.kpi(bytes(t.bytes), 'разом місця, з ' + bytes(pol.maxBytes), 'admin.system.bytes') +
          A.kpi(last ? A.ago(last.at) : '—', 'остання копія', 'admin.system.last') +
          A.kpi(ver ? A.ago(ver) : '—', 'остання перевірка відновленням', 'admin.system.verified') + '</div>' +
        '<div class="adm-sys-grid">' +
          '<section class="card"><div class="adm-sys-t"><h3 class="adm-card-t">' + P.ic('settings', 'ui-icon--sm') + 'Правило зберігання' + A.help('admin.system.policy') + '</h3>' +
            '<button class="btn btn--secondary btn--sm" type="button" data-act="bk-policy">' + P.ic('edit', 'ui-icon--sm') + 'Редагувати</button></div>' +
            '<dl class="kv adm-sys-kv">' + kv('Час щоденної копії', esc(pol.at || r.schedule.at) + ' за Києвом', 'admin.system.schedule') +
              POLICY.map(function (f) { return kv(f[1], H.num(pol[f[0]]), 'admin.system.' + f[0]); }).join('') +
              kv('Місце для всіх копій', esc(bytes(pol.maxBytes)), 'admin.system.maxBytes') + '</dl>' +
            '<p class="hint">Найновішу копію і найновішу перевірену правило не видаляє ніколи.</p></section>' +
          slackCard(r) +
          '<section class="card"><h3 class="adm-card-t">' + P.ic(r.offsite.set ? 'success' : 'warning', 'ui-icon--sm') + 'Друга копія на іншому пристрої — ' +
            (r.offsite.set ? 'налаштовано' : 'ще не налаштовано') + A.help('admin.system.offsite') + '</h3>' +
            '<p class="hint">' + esc(r.offsite.hint) + '</p></section>' +
        '</div>' +
        '<section class="card"><h3 class="adm-card-t">' + P.ic('list', 'ui-icon--sm') + 'Копії · ' + r.items.length + A.help('admin.system.list') + '</h3>' +
          (r.items.length ? list(r.items) : H.empty('Копій ще немає', 'Перша зʼявиться сьогодні о ' + r.schedule.at + ' або після «Зробити копію зараз».')) + '</section>' +
        '<section class="card"><h3 class="adm-card-t">' + P.ic('lock', 'ui-icon--sm') + 'Відновлення поверх робочої бази — лише через SSH' + A.help('admin.system.restore') + '</h3>' +
          '<p class="hint">З браузера відновлення не робиться: воно замінює всі дані бази. Замість назви файлу — копія зі списку вище.</p>' +
          (real ? '<p class="hint"><b>Перевірка з цієї сторінки — швидка:</b> відбиток файлу і його зміст. Повна перевірка (пробне відновлення в тимчасову базу, крок 1) — лише командою на сервері; після неї копія отримує позначку «перевірено відновленням».</p>' : '') +
          cmd('Відновити з копії', r.restore.text, 0, r.restore.note) + '</section>' +
        '</section>';
    }
    function load() {
      P.srv('admBackups', {}).then(function (r) {
        if (!ctx.alive()) return;
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        data = r; draw(r);
        if (r.running) watch(); else if (r.slack && r.slack.sending) watch('slack');
      });
    }
    function editPolicy() {
      var pol = data.policy, st = { slackOn: !!pol.slackOn };
      var body = '<div class="adm-form">' + POLICY.map(function (f) {
        return A.field(f[0], f[1], A.input(f[0], pol[f[0]], ' inputmode="numeric" autocomplete="off" maxlength="3"'), f[2], 'admin.system.' + f[0]);
      }).join('') +
        A.field('maxBytes', 'Місце для всіх копій, ГБ', A.input('maxGb', String(Math.round(pol.maxBytes / GB * 100) / 100).replace('.', ','), ' inputmode="decimal" autocomplete="off" maxlength="6"'),
          'Від 0,1 до 50 ГБ. Коли копії займають більше — найстаріші видаляються.', 'admin.system.maxBytes') +
        '<p class="hint">Нове правило застосовується під час наступної копії. Найновішу копію і найновішу перевірену воно не видаляє.</p>' +
        A.field('at', 'Час щоденної копії (за Києвом)', A.input('at', pol.at || data.schedule.at, ' inputmode="numeric" autocomplete="off" maxlength="5" placeholder="20:00"'),
          'У форматі ГГ:ХХ, наприклад 20:00.', 'admin.system.schedule') +
        '<div class="field" data-f="slackOn"><span class="label">Надсилати копію в Slack</span>' + A.seg('slackOn', [['true', 'Увімкнено'], ['false', 'Вимкнено']], String(st.slackOn)) +
          '<span class="hint">У Slack іде лише зашифрований файл. Спершу на сервері треба задати пароль копій: npm run server:backup-key.</span></div>' +
        A.field('slackTo', 'Куди (Slack-ID каналу чи людини)', A.input('slackTo', pol.slackTo || '', ' autocomplete="off" maxlength="21" placeholder="C…"'),
          'Де взяти: у Slack відкрийте канал чи профіль людини → «…» → «Скопіювати ID». Канал починається з C чи G, людина — з U чи W. Бота треба додати в канал.') + '</div>';
      A.modal({ size: 'sm', title: 'Правило зберігання', sub: esc(pol.daily + ' · ' + pol.weekly + ' · ' + pol.monthly + ' · ' + bytes(pol.maxBytes)), body: body,
        foot: A.cancelBtn() + A.saveBtn('Зберегти'),
        onMount: function (el) { A.enterSubmits(el); var i = A.q(el, 'input.input'); if (i) i.select(); },
        on: { 'adm-seg': function (t, e, layer) { st.slackOn = A.segPick(layer, t) === 'true'; },
          'adm-save': function (b, e, layer) {
          var el = layer.el, gb = Number(A.val(el, 'maxGb').trim().replace(',', '.'));
          var p = { daily: A.val(el, 'daily').trim(), weekly: A.val(el, 'weekly').trim(), monthly: A.val(el, 'monthly').trim(),
            maxBytes: A.val(el, 'maxGb').trim() && isFinite(gb) ? Math.round(gb * GB) : '',
            at: A.val(el, 'at').trim(), slackOn: st.slackOn, slackTo: A.val(el, 'slackTo').trim().toUpperCase() };
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
              kv('Версія схеми', r.schema ? esc(r.schema) : '<span class="adm-dim">—</span>', 'admin.system.schema') + kv('Перевірено відновленням', r.verifiedAt ? esc(P.fmt.dateTime(r.verifiedAt)) : '<span class="adm-dim">ще ні</span>', 'admin.system.verifiedFlag') + '</dl>' +
            '<table class="table adm-bk__tables"><thead><tr><th>Таблиця</th><th class="n">Рядків</th></tr></thead><tbody>' +
              r.tables.map(function (t) { return '<tr><td>' + esc(t.name) + '</td><td class="n">' + H.num(t.rows) + '</td></tr>'; }).join('') +
              '<tr><th>Разом · ' + r.tables.length + ' таблиць</th><th class="n">' + H.num(total) + '</th></tr></tbody></table>' +
            '<p class="hint">Без даних (лише структура): ' + esc(r.excluded.join(', ')) + ' — там секрети й входи; після відновлення всі просто увійдуть знову.</p>' +
            '<p class="hint">' + (real ? 'Рядки — на момент копії, з її опису (маніфесту); робоча база не змінюється.'
              : 'На справжньому сервері вміст читається з тимчасової копії бази лише для читання; робоча база не змінюється.') + '</p></div>',
          foot: '<span style="flex:1"></span><button class="btn btn--quiet" type="button" data-ov-close>Закрити</button>' });
      });
    }
    function verify(x) {
      P.toast('info', real ? 'Перевіряю файл копії…' : 'Перевіряю відновлення…',
        'Копія ' + P.fmt.dateTime(x.at) + (real ? ': відбиток і зміст файлу.' : ' розгортається в тимчасову базу.'));
      P.srv('admBackupVerify', { id: x.id }).then(function (r) {
        if (!r.ok) { if (r.code !== 'forbidden') P.toast('danger', 'Перевірку не пройдено', r.error || ''); }
        else P.toast('ok', r.quick ? 'Файл копії цілий' : 'Перевірку пройдено', r.message);
        if (ctx.alive()) load();
      });
    }
    ctx.on('bk-now', function (t) {
      t.disabled = true;
      P.srv('admBackupNow', {}).then(function (r) {
        t.disabled = false;
        if (!r.ok) { if (r.code !== 'forbidden') P.toast('warn', 'Копію не зроблено', r.error || ''); return; }
        if (r.running) { P.toast('info', 'Копія робиться', r.message || ''); if (ctx.alive()) load(); return; }   // справжній сервер: копія йде у фоні
        P.toast('ok', 'Копію зроблено', r.message + (r.removed ? ' За правилом зберігання прибрано старих: ' + r.removed + '.' : ''));
        if (ctx.alive()) load();
      });
    });
    ctx.on('bk-policy', editPolicy);
    ctx.on('bk-slack', function (t) {   // v1.2: «Надіслати останню копію в Slack зараз» (лише справжній сервер); відправка йде у фоні
      t.disabled = true;
      P.srv('admBackupSlackNow', {}).then(function (r) {
        if (!r.ok) { t.disabled = false; if (r.code !== 'forbidden') P.toast('warn', 'Не надіслано', r.error || ''); return; }
        P.toast('info', 'Надсилаю в Slack', r.message || '');
        if (ctx.alive()) load();
      });
    });
    ctx.on('bk-more', function (t) {
      var x = find(t.getAttribute('data-id'));
      if (!x) return;
      A.rowMenu(t, [
        { act: 'm-view', ic: 'table', title: 'Переглянути що всередині', sub: 'таблиці, рядки, версія схеми' },
        real ? { act: 'm-verify', ic: 'check', title: 'Перевірити файл (швидко)', sub: 'відбиток і зміст; повна перевірка — командою на сервері' }
          : { act: 'm-verify', ic: 'check', title: 'Перевірити відновлення', sub: x.verifiedAt ? 'перевірено ' + A.ago(x.verifiedAt) : 'ще не перевірялась' }
      ], { 'm-view': function () { view(x); }, 'm-verify': function () { verify(x); } });
    });
    ctx.on('sys-copy', function (t) { copy(data.restore.text, A.q(ctx.el, '[data-cmd="' + t.getAttribute('data-i') + '"]')); });
    load();
  } });
})(window);
