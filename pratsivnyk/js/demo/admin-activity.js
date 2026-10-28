(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon;
  P.demoApis = P.demoApis || [];

  var MIN = 60000, DAY = 86400000;
  var PAGE = 50, DEF_DAYS = 7, KEEP_DAYS = 183, ONLINE_MIN = 15, PAGE_MAX = 10000;
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  var KEY_TRASH = 'demo:sr:hist:trash';   // корзина аудитів (senior-history.js)
  var KINDS = [['login', 'Входи'], ['admin', 'Налаштування'], ['catalog', 'Довідники локацій'], ['audit', 'Аудити']];
  var APPS = { pratsivnyk: 'Додаток працівника', starshyi: 'Кабінет старшого', kerivnyk: 'Кабінет керівника', admin: 'Кабінет адміністратора' };
  var APP_OF_ROLE = { auditor: 'pratsivnyk', senior_auditor: 'starshyi', manager: 'kerivnyk', admin: 'admin' };
  var LOGIN_TEXT = { exchange_ok: 'Увійшов', logout: 'Вийшов', sessions_closed: 'Закрито входи', not_listed: 'Натиснув «Увійти» — немає в списку',
    disabled: 'Натиснув «Увійти» — доступ вимкнено', exchange_denied: 'Спроба входу — доступ вимкнено', exchange_fail: 'Посилання не спрацювало',
    rate: 'Забагато посилань за 10 хвилин', wrong_team: 'Натиснув з іншого Slack-простору', oidc_denied: 'Вхід на сайті скасовано в Slack',
    oidc_bad_state: 'Вхід на сайті: застаріле посилання', oidc_token_failed: 'Вхід на сайті: Slack не підтвердив', oidc_userinfo_failed: 'Вхід на сайті: Slack не підтвердив' };
  var VIA = { button: 'кнопка в каналі', home: 'вкладка «Головна»', oidc: 'вхід на сайті' };
  var LOG_DAYS = [1, 7, 30, 90];   // періоди, які приймає admLoginLog
  var ACTION = { add: 'додано', edit: 'змінено', merge: 'обʼєднано', 'delete': 'видалено' };

  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function verr(field, message) { return C.fail('validation', message, [{ field: field, message: message }]); }
  function hash(s) {
    var h = 2166136261;
    s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function apiFn(name) { var a = P.demoApis.filter(function (x) { return x && typeof x[name] === 'function'; })[0]; return a ? a[name] : null; }
  function adminMe(env, me) {
    if (me && me.role === 'admin') return me;
    var u = env.db.users.filter(function (x) { return x.role === 'admin'; })[0];
    return u ? C.buildMe(u, env.ix) : null;
  }
  function userOf(env, id) { return typeof id === 'string' && has(env.ix.user, id) ? env.ix.user[id] : null; }
  function whoOf(env, id, name) { var u = userOf(env, id); return u ? { id: u.id, name: u.name, role: u.role } : { id: id || null, name: name || '—', role: null }; }
  function appOf(role) { return APP_OF_ROLE[role] || null; }
  function homeLoc(env, u) { return u && u.locationIds && u.locationIds.length === 1 && has(env.ix.loc, u.locationIds[0]) ? u.locationIds[0] : null; }
  function stamp(iso) { return P.fmt.date(iso) + '.' + iso.slice(0, 4) + ', ' + P.fmt.time(iso); }
  function ev(env, o) {
    var x = { at: o.at, kind: o.kind, who: o.who, area: o.area, target: o.target || '—', what: o.what };
    var loc = o.locationId && has(env.ix.loc, o.locationId) ? env.ix.loc[o.locationId] : null;
    if (loc) { x.locationId = loc.id; x.locationName = loc.name; }
    if (o.from != null) x.from = String(o.from);
    if (o.to != null) x.to = String(o.to);
    if (o.app) x.app = o.app;
    if (o.details && o.details.length) x.details = o.details;
    return x;
  }

  function loginEvents(env, me, fromIso, toIso) {
    var h = apiFn('admLoginLog'), out = [];
    if (!h) return out;
    var back = Math.ceil((env.now().getTime() - Date.parse(fromIso)) / DAY);
    var days = LOG_DAYS.filter(function (d) { return d >= back; })[0] || 90, before, r;
    do {
      r = h({ days: days, limit: 200, beforeId: before }, me, env);
      if (!r || !r.ok) break;
      r.items.forEach(function (e) {
        if (e.at < fromIso || e.at >= toIso || !has(LOGIN_TEXT, e.event) || (e.kind !== 'login' && e.kind !== 'refused' && e.event !== 'sessions_closed')) return;
        var u = e.who ? userOf(env, e.who.id) : null, det = [];
        if (VIA[e.detail]) det.push(['Спосіб входу', VIA[e.detail]]);
        if (e.slackId) det.push(['Slack', e.slackId]);
        if (e.kind === 'refused' && e.detail && /[А-Яа-яІіЇїЄєҐґ]/.test(e.detail)) det.push(['Подробиці', e.detail]);
        out.push(ev(env, { at: e.at, kind: 'login', area: 'Вхід', what: LOGIN_TEXT[e.event], locationId: homeLoc(env, u), app: u && e.event === 'exchange_ok' ? appOf(u.role) : null,
          who: e.who ? { id: e.who.id, name: e.who.name, role: e.who.role } : { id: null, name: 'Невідомий · Slack ' + (e.slackId || '—'), role: null },
          target: e.event === 'sessions_closed' ? (e.target && e.target.name ? e.target.name : 'усі, крім того, хто закривав') : u ? APPS[appOf(u.role)] || 'Аудит' : 'Аудит',
          details: det }));
      });
      before = r.nextBeforeId;
    } while (r.more && before);
    return out;
  }
  function adminEvents(env, fromIso, toIso) {
    var rows = P.demoAdmin && P.demoAdmin.readLog ? P.demoAdmin.readLog(env) : [];
    return rows.filter(function (x) { return x && typeof x.at === 'string' && x.at >= fromIso && x.at < toIso; }).map(function (x) {
      var who = whoOf(env, x.by, x.byName), loc = x.area === 'Локації' ? env.db.locations.filter(function (l) { return l.name === x.target; })[0] : null;
      return ev(env, { at: x.at, kind: 'admin', who: who, area: x.area, target: x.target, what: x.what, from: x.from, to: x.to,
        locationId: loc ? loc.id : null, app: who.role === 'admin' ? 'admin' : appOf(who.role) });
    });
  }
  function catalogEvents(env, me, fromIso, toIso) {
    var h = apiFn('srMgJournal'), out = [];
    if (!h) return out;
    env.db.locations.forEach(function (l) {
      var r = h({ locationId: l.id }, me, env);
      if (!r || !r.ok) return;
      r.items.forEach(function (x) {
        if (x.at < fromIso || x.at >= toIso) return;
        var who = whoOf(env, x.by, x.byName), base = { at: x.at, kind: 'catalog', who: who, area: x.sectionLabel, target: x.what, locationId: l.id,
          app: who.role === 'manager' ? 'kerivnyk' : 'starshyi' };
        if (!x.changes.length) { out.push(ev(env, Object.assign({ what: ACTION[x.action] || x.action }, base))); return; }
        x.changes.forEach(function (c) { out.push(ev(env, Object.assign({ what: c.label, from: c.from, to: c.to }, base))); });
      });
    });
    return out;
  }
  function auditEvents(env, fromIso, toIso) {
    var out = [], ix = env.ix;
    function target(depId, depName, id) { return (has(ix.dep, depId) ? ix.dep[depId].name : depName || 'Відділ') + ' · ' + id; }
    function facts(a) { return [['Перевірено, шт', String(C.checkedOf(a))], ['Брак, шт', String(C.rejectedOf(a))]]; }
    env.audits().forEach(function (a) {
      if (a.createdAt >= fromIso && a.createdAt < toIso) {
        out.push(ev(env, { at: a.createdAt, kind: 'audit', who: whoOf(env, a.auditorId), area: 'Аудити', target: target(a.departmentId, null, a.id),
          what: 'Записано аудит', locationId: a.locationId, app: 'pratsivnyk', details: facts(a) }));
      }
      if (typeof a.updatedAt === 'string' && a.updatedAt >= fromIso && a.updatedAt < toIso && a.updatedAt <= env.now().toISOString()) {
        var by = a.updatedBy || a.auditorId;
        out.push(ev(env, { at: a.updatedAt, kind: 'audit', who: whoOf(env, by), area: 'Аудити', target: target(a.departmentId, null, a.id),
          what: 'Виправлено аудит', locationId: a.locationId, app: a.updatedBy ? 'starshyi' : 'pratsivnyk', details: facts(a) }));
      }
    });
    arr(env.storage.get(KEY_TRASH, [])).forEach(function (t) {
      if (!t || typeof t.deletedAt !== 'string' || t.deletedAt < fromIso || t.deletedAt >= toIso) return;
      var a = t.audit || {}, det = [];
      if (a.createdAt) det.push(['Аудит від', stamp(a.createdAt)]);
      if (a.auditorName) det.push(['Аудитор', a.auditorName]);
      det.push(['Причина', t.reason || '—']);
      out.push(ev(env, { at: t.deletedAt, kind: 'audit', who: whoOf(env, t.by), area: 'Аудити', target: target(null, a.departmentName, t.id),
        what: 'Видалено аудит у корзину', locationId: t.locationId, app: 'starshyi', details: det }));
    });
    return out;
  }
  function collect(env, me, fromIso, toIso) {
    me = adminMe(env, me);
    if (!me) return [];
    var all = loginEvents(env, me, fromIso, toIso).concat(adminEvents(env, fromIso, toIso), catalogEvents(env, me, fromIso, toIso), auditEvents(env, fromIso, toIso));
    all.forEach(function (e, i) { e.seq = i; });
    all.sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : a.seq - b.seq; });
    all.forEach(function (e) { delete e.seq; });
    return all;
  }
  function stats(list) {
    var s = { events: list.length, changes: 0, logins: 0 };
    list.forEach(function (e) { if (e.kind !== 'login') s.changes++; else if (e.what === LOGIN_TEXT.exchange_ok) s.logins++; });
    return s;
  }

  function onlineNow(env, me) {
    me = adminMe(env, me);
    if (!me) return [];
    var now = env.now().getTime(), nowIso = env.now().toISOString(), fromIso = new Date(now - ONLINE_MIN * MIN).toISOString(), best = {};
    function put(u, at, app) {
      if (!u || u.active === false || u.accessOff || (best[u.id] && best[u.id].lastAt >= at)) return;
      best[u.id] = { userId: u.id, name: u.name, role: u.role, roleLabel: P.demoDict.roleLabels[u.role] || u.role, app: app || appOf(u.role), lastAt: at, loc: homeLoc(env, u) };
    }
    collect(env, me, fromIso, new Date(now + 1).toISOString()).forEach(function (e) { if (e.who && e.who.id) put(userOf(env, e.who.id), e.at, e.app); });
    var hh = +P.fmt.time(nowIso).slice(0, 2), wd = P.demoDates.dow(P.fmt.dayKey(nowIso)), list = apiFn('admAccessList');
    if (list && wd !== 0 && hh >= 8 && hh < 18) {
      var r = list({}, me, env), slot = Math.floor(now / (ONLINE_MIN * MIN));
      arr(r && r.ok ? r.items : []).forEach(function (x) {
        var h = hash(x.id + ':' + slot);
        if (!x.active || x.openSessions < 1 || x.role === 'admin' || h % 2) return;
        put(userOf(env, x.id), new Date(now - (1 + (h >>> 3) % (ONLINE_MIN - 1)) * MIN - (h >>> 9) % 50 * 1000).toISOString(), null);
      });
    }
    return Object.keys(best).map(function (k) { return best[k]; }).sort(function (a, b) { return a.lastAt < b.lastAt ? 1 : a.lastAt > b.lastAt ? -1 : a.name.localeCompare(b.name, 'uk'); })
      .map(function (x) {
        var o = { userId: x.userId, name: x.name, role: x.role, roleLabel: x.roleLabel, app: x.app, appLabel: APPS[x.app] || '—', lastAt: x.lastAt };
        if (x.loc) o.locationName = env.ix.loc[x.loc].name;
        return o;
      });
  }
  function countToday(env) {
    return stats(collect(env, null, P.demoDates.kyivToIso(env.day(), 0), new Date(env.now().getTime() + 1).toISOString()));
  }
  P.demoActivity = { onlineNow: onlineNow, countToday: countToday, KEEP_DAYS: KEEP_DAYS, ONLINE_MIN: ONLINE_MIN, PAGE: PAGE };

  function realDay(s) { return typeof s === 'string' && DAY_RE.test(s) && P.demoDates.addDays(s, 0) === s; }
  function filters(p, env) {
    var DT = P.demoDates, today = env.day(), earliest = DT.addDays(today, -(KEEP_DAYS - 1));
    var to = p.to === undefined || p.to === '' ? today : p.to;
    if (!realDay(to)) return { err: verr('to', 'Оберіть дату «по».') };
    var from = p.from === undefined || p.from === '' ? DT.addDays(to, -(DEF_DAYS - 1)) : p.from;
    if (!realDay(from)) return { err: verr('from', 'Оберіть дату «з».') };
    if (p.from === undefined || p.from === '') from = from < earliest ? earliest : from;
    if (to > today) return { err: verr('to', 'Дата «по» — не пізніше сьогодні.') };
    if (from > to) return { err: verr('to', 'Дата «по» — не раніше за дату «з».') };
    if (from < earliest) return { err: verr('from', 'Журнали зберігаються 6 місяців — оберіть дату не раніше ' + earliest.split('-').reverse().join('.') + '.') };
    var kind = p.kind === undefined || p.kind === '' || p.kind === 'all' ? '' : p.kind;
    if (kind && !KINDS.some(function (k) { return k[0] === kind; })) return { err: verr('kind', 'Оберіть вид подій зі списку.') };
    var who = p.who === undefined || p.who === '' ? '' : p.who;
    if (typeof who !== 'string') return { err: verr('who', 'Оберіть людину зі списку.') };
    var loc = p.locationId === undefined || p.locationId === '' ? '' : p.locationId;
    if (loc && (typeof loc !== 'string' || !has(env.ix.loc, loc))) return { err: verr('locationId', 'Такої локації немає — оновіть сторінку.') };
    var page = p.page === undefined ? 1 : p.page;
    if (typeof page !== 'number' || Math.floor(page) !== page || page < 1 || page > PAGE_MAX) return { err: verr('page', 'Сторінка — ціле число від 1.') };
    return { f: { from: from, to: to, kind: kind, who: who, loc: loc, page: page } };
  }

  P.demoApis.push({
    admActivity: function (p, me, env) {
      if (!P.demoAdmin.isAdmin(me)) return C.forbidden();
      var r = filters(p || {}, env); if (r.err) return r.err;
      var f = r.f, DT = P.demoDates;
      var all = collect(env, me, DT.kyivToIso(f.from, 0), DT.kyivToIso(DT.addDays(f.to, 1), 0));
      var seen = {}, people = [];
      all.forEach(function (e) { if (e.who && e.who.id && !has(seen, e.who.id)) { seen[e.who.id] = 1; people.push({ id: e.who.id, name: e.who.name }); } });
      var scoped = all.filter(function (e) { return (!f.who || (e.who && e.who.id === f.who)) && (!f.loc || e.locationId === f.loc); });
      var list = f.kind ? scoped.filter(function (e) { return e.kind === f.kind; }) : scoped, pages = Math.max(1, Math.ceil(list.length / PAGE));
      return { ok: true, from: f.from, to: f.to, page: f.page, pages: pages, total: list.length,
        items: list.slice((f.page - 1) * PAGE, f.page * PAGE), stats: stats(scoped),
        kinds: KINDS.map(function (k) { return { id: k[0], label: k[1], count: scoped.filter(function (e) { return e.kind === k[0]; }).length }; }),
        people: people.sort(function (a, b) { return a.name.localeCompare(b.name, 'uk'); }) };
    },
    admOnline: function (p, me, env) {
      if (!P.demoAdmin.isAdmin(me)) return C.forbidden();
      return { ok: true, asOf: env.now().toISOString(), items: onlineNow(env, me) };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
