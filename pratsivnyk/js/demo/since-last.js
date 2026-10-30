(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon;
  P.demoApis = P.demoApis || [];

  var MAX_BACK_DAYS = 90, DAY_MS = 86400000;
  var ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;
  var SCOPES = { auditor: 1, senior: 1, manager: 1 };

  function bad(field, message) { return C.fail('validation', 'Перевірте поля.', [{ field: field, message: message }]); }

  function zero() { return { audits: 0, kdNew: 0, relapses: 0, selfClosed: 0, workersAdded: 0 }; }

  function kdCounts(env, locId, fromDay) {
    var out = { kdNew: 0, relapses: 0, selfClosed: 0 };
    var I = P.demoKd && P.demoKd.internal;
    if (!I || !I.makeCx || !env.ix.loc[locId]) return out;
    I.makeCx(env, env.ix.loc[locId]).all().forEach(function (a) {
      if (a.openedAt && a.openedAt >= fromDay) out.kdNew++;
      if (a.status === 'not_helped' && a.relapseDay && a.relapseDay >= fromDay) out.relapses++;
      if (a.status === 'self_closed' && a.finishedOn && a.finishedOn >= fromDay) out.selfClosed++;
    });
    return out;
  }

  function locCounts(env, locId, sinceIso, fromDay) {
    var c = zero(), kd = kdCounts(env, locId, fromDay);
    c.audits = env.audits().filter(function (a) { return a.locationId === locId && a.createdAt > sinceIso; }).length;
    c.kdNew = kd.kdNew; c.relapses = kd.relapses; c.selfClosed = kd.selfClosed;
    c.workersAdded = env.db.workers.filter(function (w) { return w.locationId === locId && typeof w.addedAt === 'string' && w.addedAt > sinceIso; }).length;
    return c;
  }

  P.demoApis.push({
    sinceLast: function (p, me, env) {
      if (!me) return C.auth();
      p = p || {};
      if (typeof p.scope !== 'string' || !SCOPES[p.scope]) return bad('scope', 'Незрозуміло, для якого екрана.');
      if (typeof p.since !== 'string' || !ISO_RE.test(p.since) || isNaN(Date.parse(p.since))) return bad('since', 'Потрібен час у форматі ISO.');
      var now = env.now(), t = Date.parse(p.since);
      if (t > now.getTime()) return bad('since', 'Час не може бути в майбутньому.');
      var floor = now.getTime() - MAX_BACK_DAYS * DAY_MS;
      var sinceIso = new Date(t < floor ? floor : t).toISOString(), fromDay = P.fmt.dayKey(new Date(sinceIso));
      var locId = typeof p.locationId === 'string' ? p.locationId : null;

      if (p.scope === 'manager') {
        if (!((me.role === 'manager' || me.role === 'admin') && me.can && me.can.viewAllLocations)) return C.forbidden();
        return { ok: true, since: sinceIso, locations: env.db.locations.filter(function (l) { return l.active !== false; }).map(function (l) {
          return { id: l.id, name: l.name, counts: locCounts(env, l.id, sinceIso, fromDay) };
        }) };
      }
      if (!locId || !Object.prototype.hasOwnProperty.call(env.ix.loc, locId)) return bad('locationId', 'Оберіть локацію.');
      if (p.scope === 'senior') {
        if (!C.hasLoc(me, locId)) return C.forbidden();
        return { ok: true, since: sinceIso, counts: locCounts(env, locId, sinceIso, fromDay) };
      }
      if (!(C.hasLoc(me, locId) || C.canRecordAt(me, locId, env.ix))) return C.forbidden();
      return { ok: true, since: sinceIso, counts: { kdNew: kdCounts(env, locId, fromDay).kdNew } };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
