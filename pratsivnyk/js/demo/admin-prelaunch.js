(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon;
  P.demoApis = P.demoApis || []; P.demoResetKeys = P.demoResetKeys || [];

  var KEY = 'demo:adm:important';   // { channel: 'C…' | null } — той самий ключ читає сервер (_shared/slack-api.mjs, IMPORTANT_KEY)
  P.demoResetKeys.push(KEY);
  var CHANNEL_RE = /^(?:[CG][A-Z0-9]{8,14}|C-DEMO-[0-9]{2,3})$/;   // межі — як validChannelId розсилок (30.10)   // справжній код або вигаданий (демо)
  var GROUPS = [['server', 'Сервер'], ['slack', 'Slack'], ['data', 'Дані'], ['people', 'Люди'], ['mail', 'Розсилки й пости'], ['backups', 'Копії'], ['watchdog', 'Сторож']];
  var NOT_CHECKED = 'На тестовому сайті не перевіряється';

  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function isAdmin(me) { return P.demoAdmin.isAdmin(me); }
  function item(id, group, state, title, value, todo) { return { id: id, group: group, state: state, title: title, value: value, todo: todo || '' }; }
  function dmy(day) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(day || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : '—'; }
  function names(list) {
    var n = list.length;
    return list.slice(0, 4).join(', ') + (n > 4 ? ' та ще ' + (n - 4) : '');
  }
  function plural(n, f) { var a = n % 10, b = n % 100; return n + ' ' + f[a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 1 : 2]; }
  function summary(items) {
    var s = { ok: 0, warn: 0, bad: 0, total: 0 };
    items.forEach(function (x) { if (x.state === 'info') return; s.total++; s[x.state]++; });
    return s;
  }

  function channelOf(env) { var v = obj(env.storage.get(KEY, null)).channel; return typeof v === 'string' && CHANNEL_RE.test(v) ? v : null; }

  function activeLocs(env) { return env.db.locations.filter(function (l) { return l.active !== false; }); }

  function refsItem(env) {
    var d = env.db, c = { loc: d.locations.length, dep: d.departments.length, prod: d.products.length, def: d.defectTypes.length, wrk: d.workers.length };
    var value = plural(c.loc, ['локація', 'локації', 'локацій']) + ' · ' + plural(c.dep, ['відділ', 'відділи', 'відділів']) + ' · ' + plural(c.prod, ['виріб', 'вироби', 'виробів']) +
      ' · ' + plural(c.def, ['вид браку', 'види браку', 'видів браку']) + ' · ' + plural(c.wrk, ['працівник', 'працівники', 'працівників']);
    var empty = [];
    if (!c.loc) empty.push('локацій'); if (!c.dep) empty.push('відділів'); if (!c.prod) empty.push('виробів'); if (!c.def) empty.push('видів браку'); if (!c.wrk) empty.push('працівників');
    if (!c.loc || !c.dep) return item('data.refs', 'data', 'bad', 'Довідники в базі', value, 'Довідників ще немає — перенесіть дані зі старої системи (МАНУАЛ: «npm run migrate:plan», потім «migrate:write»).');
    if (empty.length) return item('data.refs', 'data', 'warn', 'Довідники в базі', value, 'Порожньо: ' + empty.join(', ') + '. Додайте їх через «+ Додати» вгорі або в кабінеті старшого.');
    return item('data.refs', 'data', 'ok', 'Довідники в базі', value);
  }

  function auditsItem(env) {
    var all = env.db.audits, fresh = arr(env.storage.get('demo:audits:new', [])).length, last = '';
    all.forEach(function (a) { if (a.day && a.day > last) last = a.day; });
    var moved = Math.max(0, all.length - fresh);
    var value = 'перенесених ' + moved + ' · нових ' + fresh + (last ? ' · останній ' + dmy(last) : '');
    if (!all.length) return item('data.audits', 'data', 'bad', 'Аудити в базі', 'аудитів ще немає', 'Перенесіть історію аудитів (МАНУАЛ: «npm run migrate:write») або запишіть перший аудит.');
    return item('data.audits', 'data', 'ok', 'Аудити в базі', value);
  }

  function kdItem(env) {
    var k = P.demoKd && typeof P.demoKd.kdFrom === 'function' ? P.demoKd.kdFrom(env) : null;
    if (!k || !k.real) return item('data.kd', 'data', 'ok', 'Коригуючі дії — день переходу', 'на тестовому сайті без обмеження');
    if (k.from) return item('data.kd', 'data', 'ok', 'Коригуючі дії — день переходу', 'відкриваються з ' + dmy(k.from));
    return item('data.kd', 'data', 'bad', 'Коригуючі дії — день переходу', 'не задано — дії не відкриваються',
      'День переходу записує перенесення даних (МАНУАЛ: «npm run migrate:write»). Запустіть його або попросіть власника.');
  }

  function prodItem(env) {
    var T = P.demoProd;
    if (!T || typeof T.status !== 'function') return item('data.prod', 'data', 'info', 'Таблиці виробництва', 'немає даних');
    var all = [], lastOk = '';
    activeLocs(env).forEach(function (l) {
      T.status(env, l.id).forEach(function (s) { all.push({ loc: l.name, s: s }); if (s.okAt && s.okAt > lastOk) lastOk = s.okAt; });
    });
    if (!all.length) return item('data.prod', 'data', 'warn', 'Таблиці виробництва', 'жодної таблиці не підключено',
      'Підключіть таблицю цеху: «+ Додати» вгорі → «Таблиця виробництва». Без неї «зроблено» по відділах не видно.');
    var bad = all.filter(function (x) { return x.s.status === 'error'; }), never = all.filter(function (x) { return x.s.status === 'never'; });
    var value = plural(all.length, ['таблиця', 'таблиці', 'таблиць']) + (lastOk ? ' · остання вдала передача ' + dmy(lastOk.slice(0, 10)) + ' ' + P.fmt.time(lastOk) : '');
    if (bad.length) return item('data.prod', 'data', 'bad', 'Таблиці виробництва', value + ' · не прочиталось: ' + bad.length,
      'Відкрийте «Виробництво» у кабінеті старшого: там видно, яка таблиця не читається і чому; після виправлення натисніть «Оновити зараз».');
    if (never.length) return item('data.prod', 'data', 'warn', 'Таблиці виробництва', value + ' · ще не читалось: ' + never.length,
      'Сервер читає таблиці раз на 4 години. Щоб не чекати, натисніть «Оновити зараз» у «Виробництві».');
    return item('data.prod', 'data', 'ok', 'Таблиці виробництва', value);
  }

  function peopleItems(env) {
    var on = env.db.users.filter(function (u) { return !u.accessOff; }), n = { admin: 0, manager: 0, senior_auditor: 0, auditor: 0 };
    on.forEach(function (u) { if (n[u.role] !== undefined) n[u.role]++; });
    var out = [];
    out.push(n.admin >= 1 ? item('people.admin', 'people', 'ok', 'Адміністратор є', plural(n.admin, ['адміністратор', 'адміністратори', 'адміністраторів']))
      : item('people.admin', 'people', 'bad', 'Адміністратор є', 'жодного', 'Додайте адміністратора: МАНУАЛ → «Перший адміністратор» (один раз, вручну в базі).'));
    out.push(item('people.roles', 'people', 'info', 'Люди за ролями', 'аудиторів ' + n.auditor + ' · старших ' + n.senior_auditor + ' · керівників ' + n.manager + ' · адміністраторів ' + n.admin));
    var without = activeLocs(env).filter(function (l) {
      return !on.some(function (u) { return u.role === 'senior_auditor' && arr(u.locationIds).indexOf(l.id) >= 0; });
    }).map(function (l) { return l.name; });
    out.push(without.length ? item('people.senior', 'people', 'warn', 'У кожної локації є старший', 'без старшого: ' + names(without),
      'Додайте старшого: «+ Додати» вгорі → «Людина», роль «Старший аудитор», і оберіть цю локацію.')
      : item('people.senior', 'people', 'ok', 'У кожної локації є старший', 'так, на всіх активних локаціях'));
    return out;
  }

  function channelItems(env) {
    var locs = activeLocs(env), out = [];
    var noChannel = locs.filter(function (l) { return !l.slackChannel; }).map(function (l) { return l.name; });
    out.push(noChannel.length ? item('mail.channels', 'mail', 'warn', 'У кожної локації є Slack-канал', 'без каналу: ' + names(noChannel),
      'Впишіть канал: вкладка «Локації» → олівець біля локації → «Slack-канал». Без нього бот не знає, куди писати.')
      : item('mail.channels', 'mail', 'ok', 'У кожної локації є Slack-канал', 'так, на всіх активних локаціях'));
    var noRem = locs.filter(function (l) { return !(l.reminders && l.reminders.on); }).map(function (l) { return l.name; });
    out.push(item('mail.reminders', 'mail', 'info', 'Нагадування «запишіть аудит»', noRem.length ? 'вимкнені на: ' + names(noRem) : 'увімкнені на всіх активних локаціях',
      noRem.length ? 'Якщо вони потрібні — увімкніть: вкладка «Локації» → олівець → «Нагадування».' : ''));
    return out;
  }

  function dataItems(env) {
    return [refsItem(env), auditsItem(env), kdItem(env), prodItem(env)].concat(peopleItems(env), channelItems(env));
  }

  function serverPlaceholders() {
    return [['srv.health', 'server', 'База і схема'], ['srv.mode', 'server', 'Сайт у справжньому режимі'], ['srv.url', 'server', 'Адреса сайту з https'],
      ['srv.entry', 'server', 'Посилання входу ведуть у кабінет'], ['srv.oidc', 'server', 'Кнопка «Увійти через Slack»'],
      ['slack.token', 'slack', 'Ключ бота Slack'], ['slack.secret', 'slack', 'Підпис запитів Slack'], ['slack.bot', 'slack', 'Бот у Slack'],
      ['mail.posts', 'mail', 'Пости про аудити в Slack'], ['mail.migrated', 'mail', 'Перенесені розсилки'],
      ['bk.last', 'backups', 'Остання копія бази'], ['bk.key', 'backups', 'Ключ шифрування копій'], ['bk.slack', 'backups', 'Копія в Slack'],
      ['wd.state', 'watchdog', 'Сторож сайту']].map(function (x) { return item(x[0], x[1], 'info', x[2], NOT_CHECKED); });
  }

  function importantItem(env) {
    var ch = channelOf(env);
    return ch ? item('slack.important', 'slack', 'ok', 'Канал «важливе»', 'задано')
      : item('slack.important', 'slack', 'warn', 'Канал «важливе»', 'не задано', 'Впишіть код каналу в картці «Канал «важливе»» нижче. Без нього сервер не напише, що сайт ліг.');
  }

  function sorted(items) {
    var order = {}; GROUPS.forEach(function (g, i) { order[g[0]] = i; });
    return items.map(function (x, i) { return [x, i]; }).sort(function (a, b) { return (order[a[0].group] - order[b[0].group]) || (a[1] - b[1]); }).map(function (x) { return x[0]; });
  }

  P.demoPrelaunch = { GROUPS: GROUPS, summary: summary, sorted: sorted, importantItem: importantItem, dataItems: dataItems };

  P.demoApis.push({
    admImportant: function (p, me, env) {
      if (!isAdmin(me)) return C.forbidden();
      return { ok: true, channel: channelOf(env) };
    },
    admImportantSave: function (p, me, env) {
      if (!isAdmin(me)) return C.forbidden();
      var raw = String(obj(p).channel == null ? '' : obj(p).channel).replace(/\s+/g, '').toUpperCase();
      if (raw && !CHANNEL_RE.test(raw)) {
        return C.fail('validation', 'Це не схоже на код каналу.', [{ field: 'channel', message: 'Код каналу — літери й цифри, що починаються з C чи G (наприклад C0123…). Його видно у Slack: правою кнопкою на каналі → «Копіювати посилання» — код в кінці.' }]);
      }
      var was = channelOf(env), now = raw || null;
      if (was !== now) {
        env.storage.set(KEY, { channel: now });
        P.demoAdmin.log(env, me, 'Система', 'Канал «важливе»', [['Канал «важливе»', was, now]]);
      }
      return { ok: true, channel: now, changed: was !== now };
    },
    admImportantTest: function (p, me, env) {
      if (!isAdmin(me)) return C.forbidden();
      return { ok: true, demo: true, note: 'На тестовому сайті повідомлення не надсилаються' };
    },
    admPrelaunch: function (p, me, env) {
      if (!isAdmin(me)) return C.forbidden();
      var items = serverPlaceholders().concat([importantItem(env)], dataItems(env));
      items = sorted(items);
      return { ok: true, real: false, asOf: env.now().toISOString(), groups: GROUPS.map(function (g) { return { id: g[0], label: g[1] }; }), items: items, summary: summary(items) };
    },
    admPrelaunchData: function (p, me, env) {
      if (!isAdmin(me)) return C.forbidden();
      return { ok: true, items: dataItems(env), groups: GROUPS.map(function (g) { return { id: g[0], label: g[1] }; }) };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
