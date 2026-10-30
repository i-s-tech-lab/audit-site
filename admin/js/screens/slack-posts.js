(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm, da = A.da;

  if (P.help) P.help.add({
    'admin.slackposts.what': { t: 'Пости в каналах', d: 'Коли аудитор записує аудит, бот пише про нього пост у канал його локації: де, хто, скільки перевірено, який брак.\nПід постом — кнопка «Відкрити в Аудиті». Вона відкриває цей аудит у кабінеті тієї людини, що її натиснула: аудитор бачить свій кабінет, старший — свій, керівник — свій.\nЯкщо аудит виправили чи видалили, пост оновлюється сам.' },
    'admin.slackposts.on': { t: 'Писати пости', d: 'Вимикач усіх постів. Вимкнено — бот у каналах мовчить.\nУвімкнули — пости підуть лише про НОВІ аудити. Старі, перенесені зі старої системи, і тестові в канали не потрапляють ніколи.' },
    'admin.slackposts.intro': { t: 'Допис над першими постами', d: 'Коротке пояснення для людей у каналі: що це за пости і як користуватись кнопкою. Воно стоїть над постом лише в перших кількох постах кожного каналу — далі пости йдуть без нього.\nУ тексті можна виділяти жирним: *так*. Згадки (@канал, @людина) у дописі не спрацюють — так задумано, щоб допис нікого не будив. Порожній допис — постів із дописом не буде.' },
    'admin.slackposts.count': { t: 'Скільки перших постів', d: 'У скількох перших постах кожного каналу є допис. 0 — допису немає ніде. Від 0 до 10.', ex: '3 — перші три пости в кожному каналі з дописом, далі без.' },
    'admin.slackposts.channels': { t: 'Канали локацій', d: 'Куди бот пише пост про аудит цієї локації. Канал і вимикач «Бот пише» міняються у вкладці «Локації» (олівець біля локації).\nНемає каналу або бот вимкнений — пости цієї локації не надсилаються.' },
    'admin.slackposts.state': { t: 'Коли писали востаннє', d: 'Коли бот востаннє створив чи оновив пост у каналі цієї локації. Якщо Slack відмовив — тут причина (найчастіше бота ще не додано в канал).' }
  });

  var INTRO_PREVIEW = 600;   // скільки знаків допису показуємо на картці (повний — у вікні редагування)

  P.cab.tab({ id: 'slackposts', label: 'Пости в каналах', ic: 'slack', path: '/slack-posts', order: 42, real: ['admSlackPosts', 'admSlackPostsSave'] });   // real — назви функцій, які вкладка читає й пише (двигун сервера)
  P.cab.screen('/slack-posts', { tab: 'slackposts', title: 'Пости в каналах', render: function (ctx) {
    var data = null;

    function banner(r) {
      if (r.demo) {
        return '<div class="banner">' + P.ic('info', 'icon') + '<div class="banner__body"><p class="banner__title">На тестовому сайті пости не надсилаються</p>' +
          '<p class="banner__text">Тут можна налаштувати, як усе виглядатиме. Справжні пости бот надсилає лише з нашого сервера.</p></div></div>';
      }
      if (r.botSet === false) {
        return '<div class="banner banner--warn">' + P.ic('warning', 'icon') + '<div class="banner__body"><p class="banner__title">Бот Slack на сервері ще не підключений</p>' +
          '<p class="banner__text">Налаштування збережуться, але пости підуть, лише коли на сервері зʼявиться ключ бота.</p></div></div>';
      }
      return '';
    }

    function cardOn(r) {
      return '<section class="card"><h3 class="adm-card-t">' + P.ic('slack', 'ui-icon--sm') + 'Писати пост про кожен новий аудит' + A.help('admin.slackposts.on') + '</h3>' +
        '<div class="adm-sys-row"><div class="adm-sys-row__main"><b>' + (r.on ? 'Увімкнено' : 'Вимкнено') + '</b>' +
          '<span class="adm-dim">' + (r.on ? 'Новий аудит одразу з’являється в каналі його локації.' : 'Бот у каналах мовчить. Увімкніть, коли будете готові.') + '</span></div>' +
          '<div class="adm-sys-row__side">' + A.sw(r.on, 'sp-toggle', '', r.on ? 'Вимкнути пости' : 'Увімкнути пости') + '</div></div>' +
        '<p class="hint">Пости йдуть лише про нові аудити: старі, перенесені зі старої системи, і тестові в канали не потрапляють.</p></section>';
    }

    function cardIntro(r) {
      var t = String(r.intro || '').trim(), shown = t.length > INTRO_PREVIEW ? t.slice(0, INTRO_PREVIEW - 1) + '…' : t;
      return '<section class="card"><div class="adm-rule__head"><h3 class="adm-card-t">' + P.ic('notification', 'ui-icon--sm') + 'Допис над першими постами' + A.help('admin.slackposts.intro') + '</h3>' +
        A.pen('sp-edit', '', 'Змінити допис') + '</div>' +
        (t ? '<p class="hint" style="white-space:pre-wrap">' + esc(shown) + '</p>' : '<p class="hint">Допису немає — пости йдуть без пояснення.</p>') +
        '<dl class="kv adm-sys-kv"><dt>Скільки перших постів у кожному каналі' + A.help('admin.slackposts.count') + '</dt><dd>' + esc(r.introCount) + '</dd></dl></section>';
    }

    function locRow(l, st) {
      var channel = l.channel ? 'Канал: ' + esc(l.channel) : 'Каналу немає — пости цієї локації не надсилаються';
      var bot = !l.channel ? H.badge('не пишемо', 'warn') : l.bot ? H.badge('бот пише', 'ok') : H.badge('бот мовчить', 'warn');
      var side = '', hint = '';
      if (st) {
        side = st.lastError ? '<span class="badge badge--danger">помилка</span>' : st.lastAt ? '<span class="adm-dim">писали ' + esc(A.ago(st.lastAt)) + '</span>' : '<span class="adm-dim">ще не писали</span>';
        hint = st.lastError ? '<span class="adm-dim">' + esc(st.lastError) + '</span>' : '';
      }
      return '<div class="adm-sys-row"><div class="adm-sys-row__main"><b>' + esc(l.name) + (l.active ? '' : ' <span class="adm-dim">(вимкнена)</span>') + '</b>' +
        '<span class="adm-dim">' + channel + '</span>' + hint + '</div>' +
        '<div class="adm-sys-row__side">' + bot + side + '<a class="btn btn--quiet btn--sm" href="#/locations">' + P.ic('edit', 'ui-icon--sm') + 'Змінити</a></div></div>';
    }

    function cardChannels(r) {
      var byId = {};
      (r.status || []).forEach(function (s) { byId[s.locationId] = s; });
      return '<section class="card"><h3 class="adm-card-t">' + P.ic('location', 'ui-icon--sm') + 'Канали локацій' + A.help('admin.slackposts.channels') + '</h3>' +
        (r.locations.length ? '<div class="adm-sys-rows">' + r.locations.map(function (l) { return locRow(l, r.demo ? null : byId[l.id] || { lastAt: null, lastError: null }); }).join('') + '</div>'
          : '<p class="hint">Локацій ще немає.</p>') + '</section>';
    }

    function draw() {
      ctx.el.innerHTML = '<section class="adm-col">' + A.head('Пости в каналах', 'Бот пише пост про кожен новий аудит у канал його локації · ' + A.asOf(), '', 'admin.slackposts.what') +
        banner(data) + cardOn(data) + cardIntro(data) + cardChannels(data) + '</section>';
    }
    function load() {
      P.srv('admSlackPosts', {}).then(function (r) {
        if (!ctx.alive()) return;
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        data = r; draw();
      });
    }
    function save(p, layer, btn, done) {
      if (btn) btn.disabled = true;
      return P.srv('admSlackPostsSave', p).then(function (res) {
        if (btn) btn.disabled = false;
        if (!res.ok) { if (layer) A.showErrors(layer.el, res); else A.failToast(res); return; }
        if (layer) layer.close();
        P.toast('ok', 'Збережено', done || '');
        if (ctx.alive()) load();
      });
    }

    ctx.on('sp-toggle', function (t) {
      if (data.on) { save({ on: false }, null, t, 'Пости вимкнено — бот у каналах мовчить.'); return; }
      P.confirm({ title: 'Увімкнути пости в каналах?', text: 'Відтепер кожен новий аудит з’являтиметься в каналі його локації. Старі аудити не публікуються. Вимкнути можна будь-коли.', okLabel: 'Увімкнути' })
        .then(function (ok) { if (ok) save({ on: true }, null, t, 'Новий аудит одразу з’явиться в каналі його локації.'); });
    });
    ctx.on('sp-edit', function () {
      var body = '<div class="adm-form">' +
        A.field('intro', 'Допис над постом', '<textarea class="input" name="intro" rows="7" maxlength="' + data.limits.introMax + '" style="resize:vertical;min-height:150px">' + esc(data.intro) + '</textarea>',
          'Виділити жирним: *так*. До ' + data.limits.introMax + ' знаків. Порожнє поле — допису не буде.', 'admin.slackposts.intro') +
        A.field('introCount', 'Скільки перших постів у кожному каналі', A.input('introCount', data.introCount, ' inputmode="numeric" autocomplete="off" maxlength="2"'),
          'Від 0 до ' + data.limits.countMax + '. Далі пости йдуть без допису.', 'admin.slackposts.count') +
        '<div><button class="btn btn--quiet btn--sm" type="button" data-act="sp-default">' + P.ic('refresh', 'ui-icon--sm') + 'Вставити типовий допис</button></div></div>';
      A.modal({ size: 'sm', title: 'Допис над першими постами', body: body, foot: A.cancelBtn() + A.saveBtn('Зберегти'),
        on: {
          'sp-default': function (b, e, layer) { A.q(layer.el, 'textarea[name="intro"]').value = data.defaultIntro; },
          'adm-save': function (b, e, layer) {
            save({ intro: A.val(layer.el, 'intro'), introCount: A.val(layer.el, 'introCount').trim() }, layer, b, 'Допис оновлено.');
          }
        } });
    });
    load();
  } });
})(window);
