(function (root) {
  'use strict';
  var P = root.P, doc = root.document, esc = P.esc;
  var SOURCE = { test: ['Пробне з «Стану»', 'вручну'], preview: ['Пробне з вікна розсилки', 'цифри вигадані'], daily: ['Денний звіт · надіслати зараз', 'з кабінету старшого'], 'daily-test': ['Денний звіт · пробне', 'з кабінету старшого'] };
  var STATUS = { pending: ['warn', 'У черзі', 'чекає надсилання'], sending: ['info', 'Надсилається', 'саме зараз'], sent: ['ok', 'Надіслано', 'дійшло в Slack'],
    failed: ['danger', 'Не надіслано', 'причина — у рядку'], expired: ['', 'Час минув', 'застаріло, поки чекало'] };
  var el = null, data = null, editChannel = false, busy = false, timer = null, gen = 0, logShow = 'all';

  function K() { return P.mlKit; }
  function badge(kind, text) { return '<span class="badge' + (kind ? ' badge--' + kind : '') + '">' + esc(text) + '</span>'; }
  function err(text) { return text ? '<p class="err" role="alert">' + P.ic('error', 'ui-icon--sm') + esc(text) + '</p>' : ''; }
  function minsAgo(iso) { return Math.max(0, Math.floor((Date.parse(data.now) - Date.parse(iso)) / 60000)); }
  function when(iso) { return P.fmt.dayKey(iso) === P.fmt.dayKey(data.now) ? 'сьогодні о ' + P.fmt.time(iso) : P.fmt.dateTime(iso); }
  function q(sel) { return el.querySelector(sel); }
  function hb(key) { return P.help ? P.help.btn(key) : ''; }
  function plain(s) { return String(s || '').replace(/\*/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }
  function card(title, pill, body, key) {
    return '<section class="card rz-scard"><div class="rz-scard__h"><h3 class="card-title">' + esc(title) + hb(key) + '</h3>' + (pill || '') + '</div>' + body + '</section>';
  }

  function drawLogin(message) { el.innerHTML = P.mlApi.loginHtml(message); }
  function load(quiet) {
    var my = ++gen;
    if (!quiet) el.innerHTML = '<section class="card">' + P.state.loading('Перевіряю стан розсилки…') + '</section>';
    return P.mailProbe.call('status').then(function (r) {
      if (my !== gen || !el) return;
      if (!r.ok) {
        if (r.code === 'auth' || r.code === 'setup') { P.mailProbe.clearCode(); drawLogin(r.code === 'auth' ? 'Код розсилки не підходить — введіть його ще раз.' : r.error); return; }
        if (!quiet) el.innerHTML = '<section class="card">' + P.state.error('Не вдалося отримати стан розсилки', r.error) + '</section>';
        return;
      }
      data = r;
      K().chan(r.settings.channelName || r.settings.channelId);
      draw();
    });
  }

  function draw() {
    el.innerHTML = '<p class="hint rz-asof">Станом на ' + esc(P.fmt.time(data.now)) + ' · оновлюється саме раз на 30 секунд. ' +
      '<button class="btn btn--quiet btn--sm" type="button" data-mail-act="refresh">' + P.ic('refresh', 'ui-icon--sm') + 'Оновити зараз</button></p>' +
      '<div class="rz-sgrid">' + beatCard() + tokenCard() + pauseCard() + channelCard() + codeCard() + skipCard() + '</div>' + logCard();
  }
  function beatCard() {
    var b = data.heartbeat, pill, line;
    if (!b || !b.lastRunAt) { pill = badge('warn', 'Ще не спрацьовував'); line = '<p>Перший запуск — протягом хвилини після встановлення розсилки.</p>'; }
    else {
      var m = minsAgo(b.lastRunAt);
      pill = m <= 2 ? badge('ok', 'Працює') : badge('danger', 'Не запускався ' + m + ' хв');
      line = '<p><b>Востаннє — ' + esc(when(b.lastRunAt)) + '</b>, усього ' + esc(P.fmt.num(b.runs)) + ' ' + K().plural(b.runs, ['запуск', 'запуски', 'запусків']) + '.</p>';
    }
    return card('Будильник Supabase', pill, '<p>Щохвилини перевіряє розсилки й надсилає чергу.</p>' + line +
      '<p class="hint">Якщо напис «Не запускався N хв» — у Supabase зупинився будильник (pg_cron). Сайт і правила від цього не ламаються, але нічого не надсилається.</p>', 'admin.probe.beat');
  }
  function tokenCard() {
    return card('Ключ бота Slack', data.hasToken ? badge('ok', 'Додано') : badge('danger', 'Не додано'), data.hasToken
      ? '<p>Секрет <b>SLACK_BOT_TOKEN</b> є в Supabase — бот «Аудит» може надсилати.</p><p class="hint">Без ключа повідомлення не йдуть: у журналі буде «Ключ бота ще не додано».</p>'
      : '<p>Секрету <b>SLACK_BOT_TOKEN</b> у Supabase немає — бот «Аудит» не може надсилати.</p><p class="hint">Додайте його: Supabase → Edge Functions → Secrets.</p>', 'admin.probe.token');
  }
  function pauseCard() {
    var on = !data.settings.paused;
    return card('Усі розсилки', '<span class="rz-scard__sw"><button class="toggle' + (on ? ' toggle--on' : '') + '" type="button" role="switch" aria-checked="' + on + '" aria-label="' +
        (on ? 'Розсилки працюють — зупинити всі' : 'Розсилки зупинено — увімкнути знову') + '" data-mail-act="pause"></button><b>' + (on ? 'Працюють' : 'Зупинено') + '</b></span>',
      '<p><b>Аварійна зупинка:</b> вимкніть — і не надсилатиметься нічого. Правила лишаються як є, будильник працюватиме далі.</p>' +
      (on ? '<p class="hint">Вимикач спершу питає «Зупинити всі розсилки?».</p>' : K().box('warn', '<b>Зараз нічого не надсилається.</b> Увімкніть, щоб розсилки знову йшли за розкладом.')), 'admin.probe.pause');
  }
  function channelCard() {
    var s = data.settings, on = !s.paused, body;
    if (editChannel || !s.channelId) {
      body = '<form class="rz-chform" data-mail-form="channel"><label class="field"><span class="label">ID тестового каналу</span><span class="rz-addrow"><input class="input" name="channelId" value="' + esc(s.channelId || '') +
        '" placeholder="напр. C012345678" autocomplete="off" maxlength="20"><button class="btn btn--primary btn--sm" type="submit">' + P.ic('save', 'ui-icon--sm') + 'Зберегти</button>' +
        (s.channelId ? '<button class="btn btn--quiet btn--sm" type="button" data-mail-act="channel-cancel">Скасувати</button>' : '') + '</span></label><div data-mail-err="channelId"></div></form>';
    } else {
      body = '<div class="rz-btns"><button class="btn btn--secondary btn--sm" type="button" data-mail-act="channel-edit">' + P.ic('edit', 'ui-icon--sm') + 'Змінити канал</button>' +
        '<button class="btn btn--secondary btn--sm" type="button" data-mail-act="test"' + (on ? '' : ' disabled') + '>' + P.ic('slack', 'ui-icon--sm') + 'Надіслати пробне зараз</button></div>' +
        (on ? '' : '<p class="hint">Пробне можна надіслати, коли розсилки працюють.</p>');
    }
    return card('Тестовий канал', s.channelId ? badge('info', '#' + (s.channelName || s.channelId)) : badge('warn', 'Не задано'),
      '<p>Сюди йдуть <b>пробні</b> повідомлення і розсилки, в яких не вказано отримувачів.</p>' + body +
      '<p class="hint">ID каналу: у Slack натисніть назву каналу — ID внизу вкладки About. Бота спершу запросіть у канал: напишіть /invite @Аудит.</p>', 'admin.probe.channel');
  }
  function codeCard() {
    return card('Код розсилки', badge('ok', 'Збережено в цьому браузері'), '<p>Потрібен, щоб бачити й змінювати розсилки. Це секрет <b>MAIL_ADMIN_CODE</b>, який ви задали в Supabase.</p>' +
      '<div class="rz-btns"><button class="btn btn--secondary btn--sm" type="button" data-mail-act="forget">' + P.ic('logout', 'ui-icon--sm') + 'Забути код у цьому браузері</button></div>' +
      '<p class="hint">На іншому компʼютері чи телефоні код треба ввести ще раз.</p>');
  }
  function ruleTitle(id) { var r = (data.rules || []).filter(function (x) { return x.id === id; })[0]; return r ? r.title : 'Розсилка ' + id; }
  function skipCard() {
    var b = data.heartbeat, res = b && b.lastResult, list = res && Array.isArray(res.skipped) ? res.skipped : [];
    var body = !b || !b.lastRunAt ? '<p class="hint">Будильник ще не запускався.</p>'
      : res && res.paused ? '<p class="hint">Розсилки зупинено — будильник правил не перевіряв.</p>'
      : !list.length ? '<p class="hint">Нічого не пропущено.</p>'
      : '<dl class="rz-skip">' + list.map(function (x) {
        var more = (x.count || 1) - 1;
        return '<dt>' + esc(K().cap(x.reason)) + '</dt><dd>«' + esc(ruleTitle(x.rule)) + '»' + (more > 0 ? ' та ще ' + more + ' ' + K().plural(more, ['розсилка', 'розсилки', 'розсилок']) : '') + '</dd>'; }).join('') + '</dl>';
    return card('Пропущено за останній запуск' + (b && b.lastRunAt ? ' · ' + P.fmt.time(b.lastRunAt) : ''), '',
      '<p class="hint">Розсилки, які будильник перевірив, але не надіслав, — і чому.</p>' + body);
  }

  function bad(m) { return m.status === 'failed' || m.status === 'expired'; }
  function what(m) {
    var src = String(m.source || ''), s = SOURCE[src];
    return /^rule:/.test(src) ? [ruleTitle(src.slice(5)), 'за розкладом'] : s || [src, ''];
  }
  function where(m) {
    var c = m.channel;
    if (!c) return '#' + (data.settings.channelName || 'тестовий канал');
    return c.charAt(0) === '#' ? c : K().maskId(c) + ' · особисто';
  }
  function why(m) {
    if (m.status === 'sent') return 'дійшло ' + (m.sent_at ? when(m.sent_at) : '') + (m.attempts > 1 ? ' · з ' + m.attempts + '-ї спроби' : '');
    if (m.status === 'pending') return m.attempts > 0 ? 'спроба ' + m.attempts + ' з 6 не вдалась' + (m.last_error ? ': ' + m.last_error : '') + ' · наступна о ' + P.fmt.time(m.next_try_at) : 'чекає надсилання';
    if (m.status === 'sending') return 'надсилається саме зараз';
    return m.last_error || (m.status === 'expired' ? 'застаріло, поки чекало в черзі' : 'Slack не прийняв');
  }
  function logCard() {
    var rows = data.log || [], nBad = rows.filter(bad).length, shown = logShow === 'bad' ? rows.filter(bad) : rows;
    var legend = Object.keys(STATUS).map(function (k) { var s = STATUS[k]; return '<span>' + badge(s[0], s[1]) + ' ' + esc(s[2]) + '</span>'; }).join('');
    return '<section class="card rz-log"><div class="rz-log__h"><h3 class="card-title">Журнал · останні ' + rows.length + ' ' + K().plural(rows.length, ['повідомлення', 'повідомлення', 'повідомлень']) + hb('admin.probe.log') + '</h3>' +
      '<div class="seg rz-seg" role="group" aria-label="Які повідомлення показати">' + [['all', 'Усі · ' + rows.length], ['bad', 'Не надіслано · ' + nBad]].map(function (x) {
        return '<button class="seg__btn' + (x[0] === logShow ? ' seg__btn--on' : '') + '" type="button" aria-pressed="' + (x[0] === logShow) + '" data-mail-act="log-show" data-v="' + x[0] + '">' + esc(x[1]) + '</button>'; }).join('') + '</div></div>' +
      '<div class="rz-legend">' + legend + '</div>' +
      '<p class="hint">Невдалу спробу будильник повторює сам — до 5 разів (через 1, 2, 5, 10, 30 хв), поки повідомлення не застаріло. Те саме повідомлення двічі не піде.</p>' +
      (!rows.length ? P.state.empty('notification', 'Ще жодного повідомлення', 'Тут зʼявиться кожне повідомлення: коли поставлено в чергу, чи надіслано, і що відповів Slack.')
        : !shown.length ? '<p class="hint">Невдалих повідомлень немає.</p>'
        : '<table class="table rz-lt"><thead><tr><th>Коли</th><th>Що</th><th>Куди</th><th>Стан</th><th>Пояснення</th><th><span class="ui-sr-only">Дії</span></th></tr></thead><tbody>' + shown.map(logRow).join('') + '</tbody></table>') + '</section>';
  }
  function logRow(m) {
    var st = STATUS[m.status] || ['', m.status, ''], w = what(m), first = plain(String(m.preview || '').split('\n')[0]).slice(0, 80);
    return '<tr><td data-l="Коли">' + esc(when(m.created_at)) + '</td><td data-l="Що"><b>' + esc(w[0]) + '</b>' + (w[1] ? '<span class="hint">' + esc(w[1]) + '</span>' : '') +
      (first ? '<span class="hint rz-lt__prev">«' + esc(first) + '»</span>' : '') + '</td><td data-l="Куди" class="rz-lt__to">' + esc(where(m)) + '</td><td data-l="Стан">' + badge(st[0], st[1]) + '</td>' +
      '<td data-l="Пояснення">' + esc(why(m)) + '</td><td class="rz-lt__act">' + (bad(m) ? '<button class="btn btn--secondary btn--sm" type="button" data-mail-act="retry" data-id="' + esc(m.id) + '">' +
        P.ic('refresh', 'ui-icon--sm') + 'Надіслати ще раз</button>' : '') + '</td></tr>';
  }

  function showErrors(box, r) {
    if (!box) { P.toast('danger', 'Не вийшло', r.error); return; }
    var list = r.errors && r.errors.length ? r.errors : [{ message: r.error }];
    box.innerHTML = list.map(function (e) { return err(e.message); }).join('');
  }
  function sentToast(r, w) {
    if (r.ok && r.sent) P.toast('ok', w + ' — надіслано в #' + (r.channelName || 'канал'), 'Перевірте тестовий канал у Slack.');
    else if (r.ok) P.toast('warn', w + ' — у черзі', (r.warning ? r.warning + ' ' : '') + 'Надішлеться автоматично — натискати ще раз не треба.');
    else P.toast('danger', w + ' не надіслано', r.error);
  }
  function act(t, fn) {
    if (busy) return;
    busy = true; t.disabled = true;
    return fn().then(function (x) { busy = false; if (doc.body.contains(t)) t.disabled = false; return x; });
  }
  function onClick(e) {
    var t = e.target.closest('[data-mail-act]');
    if (!t || !el.contains(t)) return;
    var a = t.getAttribute('data-mail-act');
    if (a === 'refresh') { load(); return; }
    if (a === 'log-show') { logShow = t.getAttribute('data-v'); draw(); return; }
    if (a === 'forget') { P.mailProbe.clearCode(); data = null; drawLogin(''); P.toast('ok', 'Код розсилки забуто в цьому браузері', 'Щоб знову відкрити розсилки, введіть код.'); return; }
    if (a === 'channel-edit') { editChannel = true; draw(); var i = q('[name="channelId"]'); if (i) i.focus(); return; }
    if (a === 'channel-cancel') { editChannel = false; draw(); return; }
    if (a === 'pause') {
      var pause = !data.settings.paused;
      var go = function () {
        act(t, function () {
          return P.mailProbe.call('setPaused', { paused: pause }).then(function (r) {
            if (!r.ok) { P.toast('danger', 'Не вийшло', r.error); return; }
            P.toast('ok', pause ? 'Усі розсилки зупинено' : 'Розсилки знову працюють', pause ? 'Нічого не надсилається, доки не ввімкнете.' : ''); load(true);
          });
        });
      };
      if (!pause) { go(); return; }
      P.confirm({ title: 'Зупинити всі розсилки?', text: 'Будильник працюватиме далі, але нічого не надсилатиме, доки не ввімкнете знову. Правила не зміняться.', okLabel: 'Зупинити', danger: true })
        .then(function (ok) { if (ok) go(); });
      return;
    }
    if (a === 'test') { act(t, function () { return P.mailProbe.call('sendTest').then(function (r) { sentToast(r, 'Пробне'); load(true); }); }); return; }
    if (a === 'retry') { act(t, function () { return P.mailProbe.call('retry', { id: +t.getAttribute('data-id') }).then(function (r) { sentToast(r, 'Повідомлення'); load(true); }); }); }
  }
  function onSubmit(e) {
    var form = e.target.closest('[data-mail-form]');
    if (!form || !el.contains(form)) return;
    e.preventDefault();
    var btn = form.querySelector('[type="submit"]');
    act(btn, function () {
      return P.mailProbe.call('saveChannel', { channelId: form.querySelector('[name="channelId"]').value }).then(function (r) {
        if (!r.ok) { showErrors(q('[data-mail-err="channelId"]'), r); return; }
        editChannel = false; P.toast('ok', 'Тестовий канал: #' + (r.channelName || r.channelId)); load(true);
      });
    });
  }

  function mount(target) {
    el = target; data = null; editChannel = false; busy = false;
    el.addEventListener('click', onClick);
    el.addEventListener('submit', onSubmit);
    P.mlApi.bindLogin(el, function () { load(); });
    if (timer) root.clearInterval(timer);
    timer = root.setInterval(function () {
      if (!el || !doc.body.contains(el)) { root.clearInterval(timer); timer = null; return; }
      if (doc.hidden || busy || editChannel || !data) return;
      var f = doc.activeElement, typed = el.querySelector('[data-mail-form] input:not([type="hidden"])');
      if ((f && el.contains(f) && /^(INPUT|TEXTAREA|SELECT)$/.test(f.tagName)) || (typed && typed.value !== typed.defaultValue)) return;
      load(true);
    }, 30000);
    if (P.mailProbe.has()) load(); else drawLogin('');
  }

  P.mailPanel = { mount: mount };
})(window);
