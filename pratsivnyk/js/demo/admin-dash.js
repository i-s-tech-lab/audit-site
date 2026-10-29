(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon;
  P.demoApis = P.demoApis || [];

  var ONLINE_MAX = 5;   // скільки імен «Онлайн зараз» показує плитка (решта — лише в кількості)

  function apiFn(name) {
    var list = P.demoApis || [];
    for (var i = 0; i < list.length; i++) if (Object.prototype.hasOwnProperty.call(list[i], name)) return list[i][name];
    return null;
  }

  function systemTiles(env) {
    var S = P.demoSystem, snap = S && !env.real && typeof S.snapshot === 'function' ? S.snapshot(env) : null;   // v1.1: на справжньому сервері вигадане не показуємо
    var b = snap && snap.backups, s = snap && snap.server;
    return {
      server: s ? { ok: !!s.ok, uptimeSec: s.uptimeSec, errors24h: s.errors24h, services: (s.services || []).map(function (x) { return { id: x.id, label: x.label, state: x.state }; }) } : null,
      backups: b ? { last: b.last ? { at: b.last.at, ok: !!b.last.ok, bytes: b.last.bytes } : null, lastVerifiedAt: b.lastVerifiedAt || null, count: b.count, totalBytes: b.totalBytes } : null,
      disk: s && s.diskFreePct != null ? { freePct: s.diskFreePct } : null,
      cert: s && s.certDaysLeft != null ? { daysLeft: s.certDaysLeft } : null
    };
  }

  function onlineTile(env, sessions) {
    var A = P.demoActivity;
    if (!A || typeof A.onlineNow !== 'function') return null;
    var list = A.onlineNow(env, null, sessions) || [];
    return { count: list.length, people: list.slice(0, ONLINE_MAX).map(function (x) { return { name: x.name, roleLabel: x.roleLabel, appLabel: x.appLabel }; }) };
  }

  function todayTile(env) {
    var A = P.demoActivity;
    if (!A || typeof A.countToday !== 'function') return null;
    var c = A.countToday(env) || {};
    return { events: c.events || 0, changes: c.changes || 0, logins: c.logins || 0 };
  }

  function requestsTile(me, env) {
    if (env.real) return { pending: null };   // v1.1: справжні запити лежать у базі входу — рахує adm-system.mjs
    var h = apiFn('admAccessRequests'), r = h ? h({}, me, env) : null;
    var list = r && r.ok ? r.requests : [];
    return { pending: list.filter(function (x) { return x.status === 'pending'; }).length };
  }

  function auditsTile(env) {
    var day = env.day(), per = {};
    env.audits().forEach(function (a) { if (a.day === day) per[a.locationId] = (per[a.locationId] || 0) + 1; });
    var byLocation = env.db.locations.map(function (l) { return { id: l.id, name: l.name, count: per[l.id] || 0 }; });
    return { total: byLocation.reduce(function (s, l) { return s + l.count; }, 0), byLocation: byLocation };
  }

  P.demoApis.push({
    admDash: function (p, me, env) {
      if (!P.demoAdmin.isAdmin(me)) return C.forbidden();
      var sys = systemTiles(env);
      return { ok: true, asOf: env.now().toISOString(), tiles: {
        server: sys.server, backups: sys.backups, disk: sys.disk, cert: sys.cert,
        online: onlineTile(env, env.real && p && Array.isArray(p.sessions) ? p.sessions : null), requests: requestsTile(me, env), auditsToday: auditsTile(env), today: todayTile(env)
      } };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
