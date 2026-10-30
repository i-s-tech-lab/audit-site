(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, K = P.mlKit;
  var flt = { q: '', loc: 'all', show: 'all' };   // пошук і фільтри — памʼятаються, поки відкрита сторінка
  var vcache = {};                                 // цифри-приклади для плашок карток: ключ — локації + відділи + текст

  function da(k, v) { return ' data-' + k + '="' + esc(v) + '"'; }
  function forLoc(r, id) { return id === 'all' || r.locations === 'all' || r.locations.indexOf(id) >= 0; }
  var DS = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  var MAX_PER_DAY = 60;   // дзеркало MAX_PER_RECIPIENT_DAY (сервер, mail-plan.mjs); справжній ліміт приходить у стані розсилки (limits)
  function dayWord(iso, now) {
    var k = P.fmt.dayKey(iso), t = Date.parse(k + 'T12:00:00Z'), diff = Math.round((t - Date.parse(P.fmt.dayKey(now) + 'T12:00:00Z')) / 86400000), d = new Date(t);
    return diff === 0 ? 'сьогодні' : diff === 1 ? 'завтра' : DS[d.getUTCDay()] + ', ' + d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()];
  }
  function nextLine(r, now) {
    if (r.when.kind === 'event') return 'Наступне: щойно станеться подія';
    if (!r.enabled) return 'Наступне: розсилку вимкнено — не надсилається';
    if (!r.nextAt) return 'Наступного надсилання в найближчі 14 днів немає';
    return 'Наступне: ' + dayWord(r.nextAt, now) + ' о ' + P.fmt.time(r.nextAt);
  }
  function lastLine(iso) { return 'Востаннє надіслано: ' + (iso ? P.fmt.date(iso) + ', ' + P.fmt.time(iso) : 'ще не надсилалося'); }

  function intro(dataReady) {
    var steps = [['Ви налаштовуєте правило:', ' для яких локацій і відділів, коли надсилати, кому і який текст.'],
      ['Будильник Supabase щохвилини перевіряє,', ' чи настав час котрогось правила, і ставить повідомлення в чергу.'],
      ['Повідомлення йде в канал Slack', ' (бачать усі учасники каналу) <b>або людині особисто</b> — від бота «Аудит».']];
    return '<section class="card rz-intro" aria-label="Як працює розсилка"><ol class="rz-steps">' + steps.map(function (s, i) {
      return '<li><span class="rz-num" aria-hidden="true">' + (i + 1) + '</span><p><b>' + s[0] + '</b>' + s[1] + '</p></li>'; }).join('') + '</ol>' +
      (dataReady ? K.box('ok', '<b>Цифри аудитів підключено:</b> розсилки з цифрами локацій (брак, аудити, відділи), з «каналом локації» і після подій надсилаються разом з усіма.')
        : K.box('warn', '<b>Поки немає бази аудитів,</b> розсилки з цифрами локацій (брак, аудити, відділи) і розсилки після подій зберігаються, але ще не надсилаються — ' +
          'біля них позначка «Чекає бази даних». Уже зараз працюють розсилки з часом, датою й посиланнями на сайт.')) + '</section>';
  }
  function statLine(st) {
    var out = [];
    if (st && st.ok) {
      var hb = st.heartbeat, m = hb && hb.lastRunAt ? Math.max(0, Math.floor((Date.parse(st.now) - Date.parse(hb.lastRunAt)) / 60000)) : null;
      out.push(m == null ? H.badge('Будильник ще не спрацьовував', 'warn') : m <= 2 ? H.badge('Будильник працює · востаннє о ' + P.fmt.time(hb.lastRunAt), 'ok') : H.badge('Будильник не запускався ' + m + ' хв', 'danger'));
      out.push(st.settings.paused ? H.badge('Усі розсилки зупинено', 'warn') : H.badge('Розсилки увімкнено', 'ok'));
      if (!st.hasToken) out.push(H.badge('Немає ключа бота Slack', 'danger'));
      out.push(st.settings.channelId ? H.badge('Пробні повідомлення йдуть у #' + (st.settings.channelName || st.settings.channelId), 'info') : H.badge('Тестовий канал не задано', 'warn'));
    }
    return '<div class="rz-stat">' + out.join('') + '<a class="rz-stat__a" href="#/mailing/state">Стан і журнал →</a></div>';
  }

  P.cab.tab({ id: 'mailing', label: 'Розсилки', ic: 'notification', path: '/mailing', order: 40 });
  P.cab.screen('/mailing', { tab: 'mailing', title: 'Розсилки', render: function (ctx) {
    var data = null, st = null, ix = {}, lastSent = {};
    if (ctx.query && ctx.query.q) flt.q = String(ctx.query.q);   // посилання «1 розсилка» з адресатів шукає за імʼям
    ctx.el.innerHTML = '<div class="rz">' + K.subnav('rules') + '<div class="rz" data-rz-list>' + H.loading() + '</div></div>';
    var list = ctx.el.querySelector('[data-rz-list]');
    P.mlApi.bindLogin(list, function () { list.innerHTML = H.loading(); load(); });

    function find(id) { return data.items.filter(function (x) { return x.id === id; })[0]; }
    function load() {
      Promise.all([P.mlApi.call('mlRules', {}), P.mailProbe && P.mailProbe.has() ? P.mailProbe.call('status') : Promise.resolve(null)]).then(function (res) {
        if (!ctx.alive()) return;
        var r = res[0];
        if (r.code === 'mail_auth') { list.innerHTML = P.mlApi.loginHtml(r.noCode ? '' : r.error); return; }
        if (!r.ok) { list.innerHTML = H.error(r); return; }
        data = r; st = res[1]; ix = K.people(r); lastSent = {};
        if (st && st.ok) {
          K.chan(st.settings.channelName || st.settings.channelId);
          (st.log || []).forEach(function (m) { var id = /^rule:/.test(m.source) ? m.source.slice(5) : null; if (id && m.status === 'sent' && !lastSent[id]) lastSent[id] = m.sent_at; });
        }
        K.setCounts('rules', r.items.length); K.setCounts('addr', (r.addressees || []).length);
        var nav = ctx.el.querySelector('.rz-subnav'); if (nav) nav.outerHTML = K.subnav('rules');
        drawFrame();
      });
    }
    function passes(r) {
      if (!forLoc(r, flt.loc) || (flt.show === 'on' && !r.enabled) || (flt.show === 'off' && r.enabled)) return false;
      var s = flt.q.trim().toLowerCase(); if (!s) return true;
      var hay = [r.title].concat((r.to || []).map(function (t) { return t.type === 'channel' ? K.chanText(t) : t.type === 'locChannel' ? 'канал локації' : ix[t.id] ? ix[t.id].name : t.id; }));
      return hay.some(function (x) { return String(x).toLowerCase().indexOf(s) >= 0; });
    }
    function drawFrame() {
      if (flt.loc !== 'all' && !data.locations.some(function (l) { return l.id === flt.loc; })) flt.loc = 'all';
      var n = data.items.length, on = data.items.filter(function (r) { return r.enabled; }).length;
      var locOpts = [['all', 'Усі локації · ' + n + ' ' + K.plural(n, ['розсилка', 'розсилки', 'розсилок'])]].concat(data.locations.map(function (l) {
        return [l.id, l.name + ' · ' + data.items.filter(function (r) { return forLoc(r, l.id); }).length]; }));
      list.innerHTML = '<div class="rz-head"><div><h2 class="h2">Розсилки · ' + n + P.help.btn('admin.ml.what') + '</h2>' +
        '<p class="h2-sub">Повідомлення в Slack: за розкладом або одразу після події. Правила зберігаються в Supabase — їх виконує будильник, навіть коли сайт закритий.</p></div>' +
        '<button class="btn btn--primary" type="button" data-act="rz-new">' + P.ic('add') + 'Нова розсилка</button></div>' + intro(data.dataReady) + statLine(st) +
        (n ? '<div class="card rz-tools"><label class="field rz-tools__q"><span class="label">Знайти розсилку</span><input class="input" type="search" data-input="rz-q" value="' + esc(flt.q) + '" placeholder="Назва розсилки, канал або імʼя людини"></label>' +
          '<label class="field rz-tools__loc"><span class="label">Для якої локації' + P.help.btn('admin.ml.filter') + '</span><select class="input rz-sel" data-change="rz-filter">' + locOpts.map(function (o) {
            return '<option value="' + esc(o[0]) + '"' + (o[0] === flt.loc ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>' +
          '<div class="field"><span class="label">Показати</span><div class="seg rz-seg" role="group" aria-label="Які розсилки показати">' + [['all', 'Усі · ' + n], ['on', 'Увімкнені · ' + on], ['off', 'Вимкнені · ' + (n - on)]].map(function (x) {
            return '<button class="seg__btn' + (x[0] === flt.show ? ' seg__btn--on' : '') + '" type="button" aria-pressed="' + (x[0] === flt.show) + '" data-act="rz-show"' + da('v', x[0]) + '>' + esc(x[1]) + '</button>'; }).join('') + '</div></div></div>' : '') +
        '<p class="hint" data-rz-n></p><div data-rz-cards></div>' +
        '<p class="hint rz-foot">Нова розсилка створюється <b>вимкненою</b> — увімкніть перемикачем, коли все перевірите. Розсилок може бути до 50.</p>';
      drawCards();
    }
    function drawCards() {
      var box = list.querySelector('[data-rz-cards]'); if (!box) return;
      var shown = data.items.filter(passes);
      list.querySelector('[data-rz-n]').textContent = shown.length === data.items.length ? '' : 'Показано ' + shown.length + ' з ' + data.items.length;
      if (!data.items.length) box.innerHTML = P.state.empty('notification', 'Ще жодної розсилки', 'Створіть першу — порожню або з готового шаблону: «Нова розсилка» вгорі.');
      else if (!shown.length) box.innerHTML = P.state.empty('filter', 'Таких розсилок немає', 'Змініть пошук чи фільтри. Розсилки на «усі локації» показуються в кожній локації.');
      else box.innerHTML = '<div class="rz-list">' + shown.map(card).join('') + '</div>';
      shown.forEach(fillVars);
    }
    function card(r) {
      var off = !r.enabled, why = r.waits !== undefined ? (r.waits ? K.waitWhy(r, K.labels(data.options)) : null) : K.waitWhy(r, K.labels(data.options));
      var note = K.whereNote(r), ppl = (r.to || []).filter(function (t) { return t.type === 'user'; });
      var nobody = r.to.length && ppl.length === r.to.length && !ppl.some(function (t) { return ix[t.id] && ix[t.id].active; });
      var last = r.lastSentAt || lastSent[r.id], cap = st && st.limits && st.limits.perRecipientDay || MAX_PER_DAY;
      var msg = nobody ? K.box('bad', '<b>Нікому не піде:</b> людей із «Кому» немає серед активних користувачів чи адресатів. Додайте отримувача або ввімкніть адресата.')
        : why ? K.box('warn', '<b>Чекає бази даних:</b> ' + esc(why) + '. Правило збережене й запрацює саме, щойно база буде.')
        : !off && last && !(st && st.settings && st.settings.paused) ? K.box('ok', '<b>Працює вже зараз.</b> Останнє повідомлення дійшло в Slack.') : '';
      if (r.perDay > cap) msg += K.box('warn', 'Понад ' + cap + ' на добу одному отримувачу не надсилається.');
      return '<article class="card rz-card' + (off ? ' rz-card--off' : '') + '"><div class="rz-card__top"><div class="rz-card__main"><h3 class="card-title">' + esc(r.title) + '</h3>' +
        '<p class="rz-card__sum">' + esc(K.whenShort(r) + ' · ' + K.toShort(r, ix) + ' · ' + K.condShort(r)) + '</p>' +
        '<p class="rz-card__next"><span>' + esc(nextLine(r, data.now)) + '</span><span>' + esc(lastLine(last)) + '</span></p></div>' +
        '<div class="rz-card__on">' + (off ? H.badge('Вимкнено — не надсилається', '') : H.badge('Увімкнено', 'ok')) +
        '<button class="toggle' + (off ? '' : ' toggle--on') + '" type="button" role="switch" aria-checked="' + !off + '" aria-label="' + (off ? 'Увімкнути' : 'Вимкнути') + ' розсилку «' + esc(r.title) + '»" data-act="rz-on"' + da('id', r.id) + '></button></div></div>' +
        '<dl class="kv rz-kv"><dt>Де</dt><dd>' + esc(K.whereText(r)) + (note ? ' <span class="rz-kv__n">(' + esc(note) + ')</span>' : '') + '</dd>' +
        '<dt>Коли</dt><dd>' + esc(K.whenText(r)) + '</dd><dt>Кому</dt><dd class="rz-rcs">' + (r.to.length ? r.to.map(function (t) { return K.recipChip(t, ix); }).join('') : '<span class="rz-rc rz-rc--ch"><span class="rz-rc__hash" aria-hidden="true">#</span><b>' + esc(K.chan() || 'тестовий канал') + '</b><em>тестовий канал (отримувачів не вказано)</em></span>') + '</dd>' +
        '<dt>Умова</dt><dd>' + esc(K.condText(r)) + '</dd></dl>' + msg +
        '<div class="rz-slack rz-slack--card"><span class="rz-slack__ava" aria-hidden="true">А</span><div class="rz-slack__msg"><p class="rz-slack__who"><b>Аудит</b> <span class="hint">бот · приклад з вигаданими цифрами</span></p>' +
          '<div class="rz-slack__text rz-slack__text--clamp" data-rz-pv="' + esc(r.id) + '">' + K.slackChips(r.template, data.options.links, null) + '</div></div></div>' +
        '<div class="rz-acts"><button class="btn btn--secondary btn--sm" type="button" data-act="rz-edit"' + da('id', r.id) + '>' + P.ic('edit', 'ui-icon--sm') + 'Змінити</button>' +
          '<button class="btn btn--secondary btn--sm" type="button" data-act="rz-test"' + da('id', r.id) + '>' + P.ic('slack', 'ui-icon--sm') + 'Надіслати пробне</button>' +
          '<button class="btn btn--secondary btn--sm" type="button" data-act="rz-copy"' + da('id', r.id) + '>' + P.ic('add', 'ui-icon--sm') + 'Дублювати</button>' +
          '<button class="btn btn--secondary btn--sm rz-btn-del" type="button" data-act="rz-del"' + da('id', r.id) + '>' + P.ic('delete', 'ui-icon--sm') + 'Видалити</button></div></article>';
    }
    function fillVars(r) {
      var key = JSON.stringify([r.locations, r.departments, r.template]);
      function put(v) { var el = list.querySelector('[data-rz-pv="' + r.id + '"]'); if (el) el.innerHTML = K.slackChips(r.template, data.options.links, v); }
      if (vcache[key]) { put(vcache[key]); return; }
      P.mlPreview.vars(r, data).then(function (v) { vcache[key] = v; if (ctx.alive()) put(v); });
    }
    function edit(id, rule) { P.mlEditor.open({ data: data, id: id, rule: rule, onSaved: function () { if (ctx.alive()) load(); } }); }

    ctx.on('rz-q', function (t) { flt.q = t.value; drawCards(); });
    ctx.on('rz-filter', function (t) { flt.loc = t.value; drawCards(); });
    ctx.on('rz-show', function (t) {
      flt.show = t.getAttribute('data-v');
      Array.prototype.forEach.call(list.querySelectorAll('[data-act="rz-show"]'), function (b) { var on = b === t; b.classList.toggle('seg__btn--on', on); b.setAttribute('aria-pressed', on); });
      drawCards();
    });
    ctx.on('rz-new', function (t) {
      if (!data) return;
      var items = [{ act: 'rz-tpl', key: '', ic: 'add', title: 'Порожня', sub: 'усе з нуля' }].concat(data.presets.map(function (x) {
        return { act: 'rz-tpl', key: x.key, ic: 'notification', title: x.title, sub: x.whenLabel }; }));
      P.sr.menu(t, { width: 340, on: { 'rz-tpl': function (b, e, layer) {
        layer.close();
        var key = b.getAttribute('data-key'), p = data.presets.filter(function (x) { return x.key === key; })[0];
        edit(null, p ? p.rule : { locations: flt.loc === 'all' ? 'all' : [flt.loc], departments: 'all', when: { kind: 'daily' }, condition: { kind: 'always' } });
      } }, body: '<p class="rz-menu__h">З чого почати нову розсилку</p>' + items.map(function (i) {
        return '<button class="menu__item rz-mi" type="button" role="menuitem" data-act="' + i.act + '"' + da('key', i.key) + '><span class="menu__ic">' + P.ic(i.ic) + '</span>' +
          '<span><span class="menu__t">' + esc(i.title) + '</span><span class="menu__s">' + esc(i.sub) + '</span></span></button>'; }).join('') });
    });
    ctx.on('rz-edit', function (t) { var r = find(t.getAttribute('data-id')); if (r) edit(r.id, r); });
    ctx.on('rz-test', function (t) { var r = find(t.getAttribute('data-id')); if (r) P.mlPreview.sendRule(t, r, data); });
    ctx.on('rz-on', function (t) {
      var r = find(t.getAttribute('data-id')); if (!r) return;
      t.disabled = true;
      P.mlApi.call('mlRuleOn', { id: r.id, enabled: !r.enabled }).then(function (x) {
        if (!ctx.alive()) return;
        if (!x.ok) { t.disabled = false; if (x.code !== 'forbidden') P.toast('danger', 'Не вдалося зберегти', x.error); return; }
        P.toast('ok', (x.enabled ? 'Увімкнено · ' : 'Вимкнено · ') + x.title, !x.enabled ? 'Більше не надсилається, доки не ввімкнете.' : (r.when.kind === 'event' ? 'Надсилатиметься після події' : 'Надсилатиметься за розкладом') + (K.needsData(r) ? ' — щойно буде база аудитів.' : '.')); load();
      });
    });
    ctx.on('rz-copy', function (t) {
      var r = find(t.getAttribute('data-id')); if (!r) return;
      t.disabled = true;
      P.mlApi.call('mlRuleCopy', { id: r.id }).then(function (x) {
        if (!ctx.alive()) return;
        t.disabled = false;
        if (!x.ok) { P.toast('danger', 'Не вдалося', x.error); return; }
        P.toast('ok', 'Створено копію · ' + x.item.title, 'Вона вимкнена — увімкніть, коли налаштуєте.'); load();
      });
    });
    ctx.on('rz-del', function (t) {
      var r = find(t.getAttribute('data-id')); if (!r) return;
      P.confirm({ title: 'Видалити розсилку «' + r.title + '»?', text: 'Вона зникне назавжди. Щоб лише призупинити — вимкніть її перемикачем на картці.', okLabel: 'Видалити', danger: true })
        .then(function (ok) {
          if (!ok) return;
          P.mlApi.call('mlRuleDelete', { id: r.id }).then(function (x) {
            if (!ctx.alive()) return;
            if (!x.ok) { P.toast('danger', 'Не вдалося видалити', x.error); return; }
            P.toast('ok', 'Видалено · ' + x.title); load();
          });
        });
    });
    load();
  } });
})(window);
