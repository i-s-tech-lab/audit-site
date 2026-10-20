(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon;
  P.demoApis = P.demoApis || []; P.demoResetKeys = P.demoResetKeys || [];

  var K = { logins: 'demo:adm:logins', closed: 'demo:adm:sessclosed', slack: 'demo:adm:slack', checkAt: 'demo:adm:slackcheckAt' };
  Object.keys(K).forEach(function (k) { P.demoResetKeys.push(K[k]); });

  var MIN = 60000, HOUR = 3600000, DAY = 86400000;
  var LOGINS_MAX = 300, LOG_DAYS = 90, LIMIT_MAX = 200, LIMIT_DEF = 50;
  var VIA = ['button', 'home', 'oidc'];
  var KINDS = {
    login: ['button_press', 'token_issued', 'exchange_ok', 'logout'],
    refused: ['not_listed', 'disabled', 'exchange_denied', 'exchange_fail', 'rate', 'wrong_team', 'request_created', 'request_skipped',
      'oidc_denied', 'oidc_bad_state', 'oidc_token_failed', 'oidc_userinfo_failed'],
    people: ['user_add', 'user_save', 'user_close', 'grant_on', 'grant_off', 'sessions_closed', 'slack_gone', 'slack_check',
      'admin_user_add', 'admin_user_save', 'admin_request_added', 'admin_request_rejected', 'admin_postButton', 'admin_sendButton'],
    system: ['reply_failed', 'home_failed', 'bad_signature', 'oidc_start']
  };
  var KIND_OF = {};
  Object.keys(KINDS).forEach(function (k) { KINDS[k].forEach(function (e) { KIND_OF[e] = k; }); });
  var REFUSALS = [
    { slackId: 'U-DEMO-901', event: 'not_listed', agoMin: 95, request: true },
    { slackId: 'U-DEMO-902', event: 'not_listed', agoMin: 1560, request: true },
    { slackId: 'U-DEMO-950', event: 'not_listed', agoMin: 4300, request: true },
    { slackId: 'U-DEMO-943', event: 'wrong_team', agoMin: 700 },
    { userId: 'u_aud_a1', event: 'rate', agoMin: 200, detail: 'Більше 5 посилань за 10 хвилин' }
  ];
  var SLACK_GONE = { u_aud_c2: 'deleted' };

  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function iso(ms) { return new Date(ms).toISOString(); }
  function isAdmin(me) { return !!me && me.role === 'admin'; }
  function verr(field, message) { return C.fail('validation', message, [{ field: field, message: message }]); }
  function hash(s) {
    var h = 2166136261;
    s = String(s);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  function maskText(s) {
    return String(s == null ? '' : s).replace(/\b[UW](?:-DEMO-\d{3}|[A-Z0-9]{8,10})\b/g, function (m) { return C.maskSlackId(m); });
  }
  function sessionMs(role) { return (role === 'manager' ? 30 : 7) * DAY; }
  function userBy(env, id) { return typeof id === 'string' && has(env.ix.user, id) ? env.ix.user[id] : null; }
  function userByName(env, name) { return env.db.users.filter(function (u) { return u.name === name; })[0] || null; }
  function whoOf(u) { return u ? { id: u.id, name: u.name, role: u.role } : null; }
  function refOf(env, id) { var u = userBy(env, id); return u ? { id: u.id, name: u.name } : null; }
  function isOff(env, u) { return !!(u.accessOff || u.active === false || (P.demoAccessOff && P.demoAccessOff(env.storage, u.id))); }

  function note(env, e) {
    if (!env || !env.storage || !e || typeof e.event !== 'string') return;
    var list = arr(env.storage.get(K.logins, []));
    var row = { at: env.now().toISOString(), event: e.event };
    ['userId', 'slackId', 'via', 'detail', 'actorId', 'targetId'].forEach(function (k) { if (e[k] != null) row[k] = e[k]; });
    if (env.storage.set(K.logins, [row].concat(list).slice(0, LOGINS_MAX)) === false) env.storage.del(K.logins);
  }
  P.demoAccessLog = { note: note, KINDS: KINDS, K: K };

  function lastLoginOf(env, u, notes) {
    var day0 = Math.floor(env.now().getTime() / DAY) * DAY, h = hash(u.id), best = null;
    if (!(h % 7 === 0 && u.role !== 'admin')) {   // кожен 7-й за хешем «ще не входив»
      best = { at: day0 - ((h >>> 3) % 21) * DAY - (1 + (h >>> 8) % 12) * HOUR, via: VIA[(h >>> 12) % 3], seeded: true };
    }
    notes.forEach(function (n) {
      var t = Date.parse(n.at);
      if (n.userId === u.id && n.event === 'exchange_ok' && (!best || t > best.at)) best = { at: t, via: VIA.indexOf(n.via) >= 0 ? n.via : 'oidc', seeded: false };
    });
    return best;
  }
  function sessionsOf(env, u, last, closed) {
    var now = env.now().getTime(), life = sessionMs(u.role);
    if (!last || isOff(env, u) || now - last.at > life) return { count: 0, until: null };
    if (has(closed, u.id) && Date.parse(closed[u.id]) > last.at) return { count: 0, until: null };
    return { count: last.seeded ? 1 + (hash(u.id) >>> 16) % 2 : 1, until: last.at + life };
  }
  function itemOf(env, u, me, notes, closed, slack, checkAt) {
    var last = lastLoginOf(env, u, notes), s = sessionsOf(env, u, last, closed), h = hash(u.id), now = env.now().getTime();
    var day0 = Math.floor(now / DAY) * DAY, off = isOff(env, u), by = u.addedBy ? userBy(env, u.addedBy) : null;
    var state = has(slack, u.id) ? slack[u.id] : (last ? 'active' : null);
    var seenAt = null;
    if (u.id === me.id) seenAt = now;
    else if (last) seenAt = last.at + ((h >>> 4) % Math.max(1, day0 - last.at));
    return {
      id: u.id, name: u.name, role: u.role, roleLabel: P.demoDict.roleLabels[u.role] || u.role, active: !off,
      disabledBy: u.disabledBy || (off ? (u.accessOff ? 'admin' : 'senior_auditor') : null),
      locationIds: arr(u.locationIds).slice(), slackId: C.maskSlackId(u.slackId), slackFull: String(u.slackId || ''),
      canAddPeople: !!u.canAddPeople, addedBy: by ? whoOf(by) : null,
      createdAt: u.addedAt || iso(day0 - (30 + (h >>> 5) % 300) * DAY),
      lastSeenAt: seenAt == null ? null : iso(seenAt), lastLoginAt: last ? iso(last.at) : null, lastLoginVia: last ? last.via : null,
      openSessions: s.count, sessionsUntil: s.until == null ? null : iso(s.until),
      slackState: state, slackCheckedAt: has(slack, u.id) ? checkAt : (last ? iso(last.at) : null), isMe: u.id === me.id
    };
  }

  function evOf(env, at, event, o) {
    o = o || {};
    var who = o.who || null;
    return { at: at, event: event, kind: KIND_OF[event] || 'system', who: who ? whoOf(who) : null,
      slackId: o.slackId ? C.maskSlackId(o.slackId) : (who ? C.maskSlackId(who.slackId) : null),
      actor: o.actor || null, target: o.target || null, detail: o.detail ? maskText(o.detail) : null };
  }
  function seedEvents(env, notes) {
    var now = env.now().getTime(), out = [], minute = Math.floor(now / MIN) * MIN;
    env.db.users.forEach(function (u) {
      var h = hash(u.id), last = lastLoginOf(env, u, []);
      if (!last) return;
      out.push(evOf(env, last.at - 40000, 'token_issued', { who: u, detail: last.via }));
      out.push(evOf(env, last.at, 'exchange_ok', { who: u, detail: u.role }));
      var prev = last.at - (1 + (h >>> 20) % 6) * DAY - 2 * HOUR;
      out.push(evOf(env, prev, 'exchange_ok', { who: u, detail: u.role }));
      if ((h >>> 24) % 2 === 0) out.push(evOf(env, prev + 40 * MIN, 'logout', { who: u }));
    });
    REFUSALS.forEach(function (r) {
      var at = minute - r.agoMin * MIN, u = userBy(env, r.userId);
      out.push(evOf(env, at, r.event, { who: u, slackId: r.slackId, detail: r.detail }));
      if (r.request) out.push(evOf(env, at + 1000, 'request_created', { slackId: r.slackId }));
    });
    return out;
  }
  function noteEvents(env, notes) {
    return notes.map(function (n) {
      var u = userBy(env, n.userId);
      return evOf(env, Date.parse(n.at), n.event, { who: u, slackId: u ? null : n.slackId, detail: n.detail || n.via,
        actor: refOf(env, n.actorId), target: refOf(env, n.targetId) });
    });
  }
  function adminEvents(env) {
    var rows = P.demoAdmin && P.demoAdmin.readLog ? P.demoAdmin.readLog(env) : [], out = [];
    rows.forEach(function (x) {
      var event = null, detail = x.what + ': ' + x.from + ' → ' + x.to;
      if (x.area === 'Люди й доступи') {
        if (x.what === 'Нова людина') { event = 'user_add'; detail = x.to; }
        else if (/^Право «Додавати людей»/.test(x.what)) event = /^(ні|не |вимк|немає|забрано)/i.test(String(x.to)) ? 'grant_off' : 'grant_on';
        else if (x.what === 'Доступ' && x.to === 'вимкнено') event = 'user_close';
        else event = 'user_save';
      } else if (x.area === 'Вхід через Slack') {
        if (x.what === 'Кнопку входу надіслано') { event = /^у канал/.test(x.to) ? 'admin_postButton' : 'admin_sendButton'; detail = x.to; }
        else if (x.what === 'Запит на вхід') { event = x.to === 'додано до списку' ? 'admin_request_added' : 'admin_request_rejected'; detail = x.to; }
      }
      if (!event) return;
      var by = userBy(env, x.by), target = userByName(env, x.target);
      out.push(evOf(env, x.at ? Date.parse(x.at) : 0, event, { who: by, detail: detail,
        actor: by ? { id: by.id, name: by.name } : { id: x.by || null, name: x.byName || '' }, target: target ? { id: target.id, name: target.name } : { id: null, name: x.target || '' } }));
    });
    return out;
  }
  function allEvents(env) {
    var notes = arr(env.storage.get(K.logins, [])).filter(function (n) { return n && typeof n.at === 'string' && typeof n.event === 'string'; });
    var all = seedEvents(env, notes).concat(noteEvents(env, notes), adminEvents(env)).map(function (e, i) { e.seq = i; return e; });
    all.sort(function (a, b) { return a.at - b.at || a.seq - b.seq; });
    return all.map(function (e, i) {
      return { id: i + 1, at: iso(e.at), event: e.event, kind: e.kind, who: e.who, slackId: e.slackId, actor: e.actor, target: e.target, detail: e.detail };
    });
  }

  P.demoApis.push({
    admAccessList: function (p, me, env) {
      if (!isAdmin(me)) return C.forbidden();
      var notes = arr(env.storage.get(K.logins, [])), closed = obj(env.storage.get(K.closed, null)), slack = obj(env.storage.get(K.slack, null));
      var checkAt = env.storage.get(K.checkAt, null);
      return { ok: true, now: env.now().toISOString(),
        items: env.db.users.map(function (u) { return itemOf(env, u, me, notes, closed, slack, checkAt); }),
        locations: env.db.locations.map(function (l) { return { id: l.id, name: l.name }; }) };
    },

    admLoginLog: function (p, me, env) {
      if (!isAdmin(me)) return C.forbidden();
      var days = p.days === undefined ? 7 : p.days, kind = p.kind === undefined ? 'all' : p.kind;
      if ([1, 7, 30, 90].indexOf(days) < 0) return verr('days', 'Оберіть період: 1, 7, 30 або 90 днів.');
      if (kind !== 'all' && kind !== 'login' && kind !== 'refused' && kind !== 'people') return verr('kind', 'Оберіть: усе, входи, відмови чи люди й доступи.');
      var limit = p.limit === undefined ? LIMIT_DEF : p.limit;
      if (typeof limit !== 'number' || Math.floor(limit) !== limit || limit < 1) return verr('limit', 'Скільки показати — ціле число від 1 до ' + LIMIT_MAX + '.');
      limit = Math.min(limit, LIMIT_MAX);
      var from = env.now().getTime() - Math.min(days, LOG_DAYS) * DAY, uid = typeof p.userId === 'string' ? p.userId : null;
      var list = allEvents(env).filter(function (e) {
        if (Date.parse(e.at) < from) return false;
        if (kind !== 'all' && e.kind !== kind) return false;
        if (typeof p.beforeId === 'number' && e.id >= p.beforeId) return false;
        return !uid || [e.who, e.actor, e.target].some(function (x) { return x && x.id === uid; });
      }).reverse();
      var page = list.slice(0, limit), more = list.length > limit;
      return { ok: true, items: page, more: more, nextBeforeId: more ? page[page.length - 1].id : null };
    },

    admSessionsClose: function (p, me, env) {
      if (!isAdmin(me)) return C.forbidden();
      var notes = arr(env.storage.get(K.logins, [])), closed = obj(env.storage.get(K.closed, null)), now = env.now().toISOString(), count = 0;
      function count1(u) { return sessionsOf(env, u, lastLoginOf(env, u, notes), closed).count; }
      if (p.all === true) {
        env.db.users.forEach(function (u) { if (u.id === me.id) return; var n = count1(u); if (n) { count += n; closed[u.id] = now; } });
        note(env, { event: 'sessions_closed', userId: me.id, actorId: me.id, detail: 'усіх, крім того, хто закривав' });
      } else if (typeof p.userId === 'string') {
        var u = userBy(env, p.userId);
        if (!u) return C.fail('not_found', 'Цієї людини немає в списку — оновіть сторінку.');
        count = count1(u); closed[u.id] = now;
        note(env, { event: 'sessions_closed', userId: me.id, actorId: me.id, targetId: u.id });
      } else return verr('userId', 'Оберіть людину або «усіх».');
      env.storage.set(K.closed, closed);
      return { ok: true, closed: count };
    },

    admSlackCheck: function (p, me, env) {
      if (!isAdmin(me)) return C.forbidden();
      var slack = obj(env.storage.get(K.slack, null)), closed = obj(env.storage.get(K.closed, null)), now = env.now().toISOString();
      var users = env.db.users.filter(function (u) { return !isOff(env, u); }), gone = [];
      users.forEach(function (u) {
        var state = has(SLACK_GONE, u.id) ? SLACK_GONE[u.id] : 'active', was = slack[u.id];
        slack[u.id] = state;
        if (state !== 'deleted') return;
        gone.push({ id: u.id, name: u.name, state: state });
        if (was !== 'deleted') { closed[u.id] = now; note(env, { event: 'slack_gone', userId: u.id, targetId: u.id }); }
      });
      env.storage.set(K.slack, slack); env.storage.set(K.closed, closed); env.storage.set(K.checkAt, now);
      note(env, { event: 'slack_check', userId: me.id, actorId: me.id, detail: users.length + ' людей' });
      return { ok: true, checked: users.length, gone: gone, other: [], errors: 0 };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
