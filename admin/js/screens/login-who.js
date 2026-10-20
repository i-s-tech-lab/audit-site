(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm, da = A.da, q = A.q, API = P.accessApi;
  var DAY = 86400000, STALE_DAYS = 30;
  var flt = { q: '', f: '' };   // пошук і плитка-фільтр живуть, поки відкрита сторінка

  if (P.help) {
    P.help.add({
      'admin.who.open': { t: 'Відкритий вхід', d: 'Людина увійшла й ще не вийшла. Кожен пристрій — окремий вхід; діє до вказаної дати: аудитор, старший і адміністратор — 7 днів, керівник — 30.' },
      'admin.who.slack': { t: 'Стан у Slack', d: 'Коли людина відкриває Аудит, він раз на 6 годин питає Slack, чи діє її акаунт. Акаунт вимкнено в Slack — входи закриваються одразу. Гість, інший простір чи бот — лише позначка, рішення за адміністратором.' },
      'admin.who.check': { t: 'Перевірити в Slack', d: 'Перевірити в Slack усіх людей зі списку зараз — не частіше разу на 5 хвилин.' }
    });
  }

  function tiles(now) {
    function ms(u) { return u.lastLoginAt ? Date.parse(u.lastLoginAt) : NaN; }
    return [
      ['access', 'З доступом', '', function (u) { return u.active; }],
      ['open', 'Відкритий вхід', 'admin.who.open', function (u) { return u.openSessions > 0; }],
      ['never', 'Входу ще не було', '', function (u) { return u.active && !u.lastLoginAt; }],
      ['stale', 'Не входили ' + STALE_DAYS + '+ днів', '', function (u) { return u.active && u.lastLoginAt && now - ms(u) > STALE_DAYS * DAY; }],
      ['off', 'Доступ вимкнено', '', function (u) { return !u.active; }],
      ['slackoff', 'Slack: акаунт вимкнено', 'admin.who.slack', function (u) { return u.slackState === 'deleted'; }]
    ];
  }
  function rel(iso, now) {
    var t = Date.parse(iso);
    if (!iso || isNaN(t)) return '—';
    var m = Math.round((now - t) / 60000);
    if (m < 1) return 'щойно';
    if (m < 60) return m + ' хв тому';
    if (m < 1440) return Math.floor(m / 60) + ' год тому';
    return A.ago(iso);
  }
  function grantOff() {
    return H.badge('право «Додавати людей» вимкнено', 'warn').replace('<span class="badge', '<span style="height:auto;min-height:24px;padding:3px 10px;white-space:normal;line-height:1.25;border-radius:12px" class="badge');
  }
  function stamp(iso) { return P.fmt.date(iso) + ', ' + P.fmt.time(iso); }
  function cell(label, inner, cls) { return '<div class="acc-c' + (cls ? ' ' + cls : '') + '"><span class="acc-lbl">' + esc(label) + '</span>' + inner + '</div>'; }

  P.cab.screen('/slack-login/who', { tab: 'slack', title: 'Хто входить', render: function (ctx) {
    var data = null, checkRes = null;
    function now() { return data && data.now ? Date.parse(data.now) : Date.now(); }
    function locName(id) { var l = data.locations.filter(function (x) { return x.id === id; })[0]; return l ? l.name : id; }
    function shown() {
      var s = flt.q.trim().toLowerCase(), t = tiles(now()).filter(function (x) { return x[0] === flt.f; })[0];
      return data.items.filter(function (u) {
        return (!t || t[3](u)) && (!s || String(u.name).toLowerCase().indexOf(s) >= 0 || String(u.slackId || '').toLowerCase().indexOf(s) >= 0 ||
          String(u.slackFull || '').toLowerCase().indexOf(s) >= 0);
      });
    }
    function row(u) {
      var all = u.role === 'manager' || u.role === 'admin', locs = all ? 'усі локації' : (u.locationIds || []).map(locName).join(', ') || '—';
      var by = u.addedBy && u.addedBy.name ? 'Додав: ' + u.addedBy.name + (u.addedBy.role ? ' (' + API.roleText(u.addedBy.role).toLowerCase() + ')' : '') + (u.createdAt ? ' · ' + P.fmt.date(u.createdAt) : '') : '';
      var sl = API.slackText(u.slackState, u.slackCheckedAt), via = API.viaText(u.lastLoginVia);
      return '<div class="adm-person acc-row' + (u.active ? '' : ' adm-person--off') + '"><span class="avatar" aria-hidden="true">' + esc(P.initials(u.name)) + '</span>' +
        '<div class="acc-c acc-c--who"><div class="adm-person__name"><b>' + esc(u.name) + '</b>' + (u.isMe ? H.badge('це ви', 'info') : '') +
          (u.active ? '' : H.badge('доступ вимкнено', '')) + (!u.canAddPeople && (u.role === 'senior_auditor' || u.role === 'manager') ? grantOff() : '') + '</div>' +
          (by ? '<span class="adm-person__meta">' + esc(by) + '</span>' : '') + '</div>' +
        cell('Роль і локації', '<span class="acc-v">' + H.badge(u.roleLabel || API.roleText(u.role), u.role === 'admin' ? 'brand' : '') + '</span><span class="acc-sub">Slack ' + esc(u.slackId) + ' · ' + esc(locs) + '</span>') +
        cell('Останній вхід', '<span class="acc-v">' + (u.lastLoginAt ? esc(stamp(u.lastLoginAt)) + (via ? ' · ' + esc(via) : '') : 'Входу ще не було') + '</span>') +
        cell('Остання дія', '<span class="acc-v">' + esc(u.lastSeenAt ? rel(u.lastSeenAt, now()) : '—') + '</span>') +
        cell('Відкриті входи', '<span class="acc-v">' + (u.openSessions > 0 ? u.openSessions + (u.sessionsUntil ? ' · діють до ' + esc(P.fmt.date(u.sessionsUntil)) : '') : 'немає') + '</span>') +
        cell('Slack', '<span class="acc-v' + (sl.bad ? ' acc-bad' : '') + '">' + esc(sl.text) + '</span>') +
        '<div class="acc-acts">' + (u.openSessions > 0 && !u.isMe ? '<button class="btn btn--quiet btn--sm" type="button" data-act="acc-close"' + da('id', u.id) + '>' + P.ic('logout', 'ui-icon--sm') + 'Закрити входи</button>' : '') +
          '<button class="btn btn--quiet btn--sm" type="button" data-act="acc-log"' + da('id', u.id) + '>' + P.ic('list', 'ui-icon--sm') + 'Журнал</button></div></div>';
    }
    function tilesHtml() {
      var n = now();
      return tiles(n).map(function (t) {
        var c = data.items.filter(t[3]).length, on = flt.f === t[0];
        return '<div class="kpi acc-tile' + (on ? ' acc-tile--on' : '') + '"><button class="acc-tile__b" type="button" data-act="acc-f"' + da('f', t[0]) + ' aria-pressed="' + on + '">' +
          '<span class="kpi__val">' + c + '</span><span class="kpi__label">' + esc(t[1]) + '</span></button>' + (t[2] ? '<span class="acc-tile__h">' + A.help(t[2]) + '</span>' : '') + '</div>';
      }).join('');
    }
    function drawList() {
      var box = q(ctx.el, '[data-acc-list]'); if (!box) return;
      var list = shown();
      q(ctx.el, '[data-acc-tiles]').innerHTML = tilesHtml();
      box.innerHTML = list.length ? list.map(row).join('') : H.empty('Нікого не знайдено', 'Змініть пошук або зніміть фільтр.');
      q(ctx.el, '[data-acc-n]').textContent = list.length === data.items.length ? '' : 'Показано ' + list.length + ' з ' + data.items.length;
    }
    function checkBanner() {
      if (!checkRes) return '';
      var r = checkRes, gone = r.gone || [], other = r.other || [], guests = other.filter(function (x) { return x.state === 'guest'; }).length,
        foreign = other.filter(function (x) { return x.state === 'other_team'; }).length;
      return '<div class="banner' + (gone.length ? ' banner--warn' : '') + '">' + P.ic('info', 'icon') + '<div class="banner__body"><p class="banner__title">Перевірено в Slack: ' + r.checked + ' ' + A.plural(r.checked, ['людина', 'людини', 'людей']) + '</p>' +
        '<p class="banner__text">' + (gone.length ? 'Акаунт вимкнено: ' + gone.length + ' (' + esc(gone.map(function (x) { return x.name; }).join(', ')) + ') — їхні входи закрито.' : 'Усі акаунти діють.') +
        ' Гостей: ' + guests + ' · з іншого простору: ' + foreign + '</p></div></div>';
    }
    function draw() {
      var on = data.items.filter(function (u) { return u.active; }).length, open = data.items.filter(function (u) { return u.openSessions > 0; }).length;
      ctx.el.innerHTML = '<section class="adm-col">' +
        A.head('Хто входить', on + ' з доступом · ' + open + ' з відкритим входом · ' + A.asOf(),
          '<div class="acc-btns"><span class="acc-chk"><button class="btn btn--secondary" type="button" data-act="acc-check">' + P.ic('slack', 'ui-icon--sm') + 'Перевірити в Slack</button>' + A.help('admin.who.check') + '</span>' +
            '<button class="btn btn--quiet" type="button" data-act="acc-close-all">' + P.ic('logout', 'ui-icon--sm') + 'Закрити всі входи, крім мого</button></div>') + P.admLogin.subnav('who') +
        checkBanner() +
        '<div class="acc-tiles" data-acc-tiles></div>' +
        '<div class="adm-tools"><label class="search adm-search">' + P.ic('search', 'icon') + '<input class="input input--search" type="search" data-input="acc-q" value="' + esc(flt.q) + '" placeholder="Імʼя або Slack ID" aria-label="Пошук людини"></label></div>' +
        '<section class="card adm-flat"><p class="hint" data-acc-n></p><div class="adm-people" data-acc-list></div></section>' +
        '<p class="hint">Тут лише дані зі Slack і профілю людини: імʼя, роль, локації. IP-адрес і пристроїв Аудит не зберігає.</p></section>';
      drawList();
    }
    function load() {
      API.list().then(function (r) {
        if (!ctx.alive()) return;
        if (!r || !r.ok) { ctx.el.innerHTML = H.error(r); return; }
        data = { now: r.now, items: r.items || [], locations: r.locations || [] }; draw();
      });
    }
    function find(id) { return data.items.filter(function (u) { return u.id === id; })[0]; }

    ctx.on('acc-f', function (t) { var f = t.getAttribute('data-f'); flt.f = flt.f === f ? '' : f; drawList(); });
    ctx.on('acc-q', function (t) { flt.q = t.value; drawList(); });
    ctx.on('acc-log', function (t) { ctx.go('/slack-login/log', { who: t.getAttribute('data-id') }); });
    ctx.on('acc-check', function (t) {
      t.disabled = true;
      API.check().then(function (r) {
        if (!ctx.alive()) return;
        t.disabled = false;
        if (!r || !r.ok) { P.toast('warn', 'Не вдалося перевірити в Slack', (r && r.error) || 'Спробуйте за кілька хвилин.'); return; }
        checkRes = r; load();
      });
    });
    ctx.on('acc-close', function (t) {
      var u = find(t.getAttribute('data-id')); if (!u) return;
      P.confirm({ title: 'Закрити входи · ' + u.name + '?', text: 'Людина вийде з Аудиту на всіх пристроях. Увійти знову можна кнопкою «Увійти в Аудит» у Slack.', okLabel: 'Закрити входи', danger: true })
        .then(function (ok) {
          if (!ok) return;
          API.close({ userId: u.id }).then(function (r) {
            if (!ctx.alive()) return;
            if (!r || !r.ok) { P.toast('warn', 'Не вдалося закрити входи', (r && r.error) || ''); return; }
            P.toast('ok', 'Входи закрито · ' + u.name, 'Закрито входів: ' + r.closed + '.'); load();
          });
        });
    });
    ctx.on('acc-close-all', function () {
      P.confirm({ title: 'Закрити всі входи, крім вашого?', text: 'Усі, крім вас, вийдуть з Аудиту на всіх пристроях. Увійти знову можна кнопкою в Slack.', okLabel: 'Закрити всі', danger: true })
        .then(function (ok) {
          if (!ok) return;
          API.close({ all: true }).then(function (r) {
            if (!ctx.alive()) return;
            if (!r || !r.ok) { P.toast('warn', 'Не вдалося закрити входи', (r && r.error) || ''); return; }
            P.toast('ok', 'Входи закрито', 'Закрито входів: ' + r.closed + '.'); load();
          });
        });
    });
    load();
  } });
})(window);
