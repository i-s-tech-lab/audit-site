(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon;
  P.demoSysApi = P.demoSysApi || {}; P.demoResetKeys = P.demoResetKeys || [];

  var KEY_SEEN = 'demo:mail:kdSeen', KEY_LOCS = 'demo:adm:locs';
  var SELF_DAYS = 7, SEEN_DAYS = 60, SEEN_MAX = 500;   // скільки днів самозакриті дії ще варті повідомлення / як довго пам'ятаємо побачене / скільки id
  P.demoResetKeys.push(KEY_SEEN);

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }

  function sysMe(loc) { return { id: 'system:mail', name: 'Розсилка', role: 'senior_auditor', locations: [loc], locationIds: [loc.id], can: {} }; }

  function locConfig(env, loc) {
    var edit = obj(obj(env.storage.get(KEY_LOCS, null)).edit), e = obj(edit[loc.id]);
    var channel = has(e, 'slackChannel') ? e.slackChannel : loc.slackChannel, bot = has(e, 'slackBot') ? e.slackBot : loc.slackBot;
    return { channel: typeof channel === 'string' && channel ? channel : null, bot: bot === false ? false : true };
  }
  function activeLocs(env, ids) {
    return env.db.locations.filter(function (l) { return l.active !== false && (!ids || ids.indexOf(l.id) >= 0); });
  }
  function seenOf(env) { var s = obj(env.storage.get(KEY_SEEN, null)); return { counts: obj(s.counts), closed: obj(s.closed), init: !!s.init }; }

  P.demoSysApi.mailLocations = function (p, env) {
    var ids = Array.isArray(p.ids) ? p.ids.filter(function (x) { return typeof x === 'string'; }) : null;
    return { ok: true, items: activeLocs(env, ids).map(function (l) { var c = locConfig(env, l); return { id: l.id, name: l.name, channel: c.channel, bot: c.bot }; }) };
  };

  P.demoSysApi.mailVars = function (p, env) {
    var loc = typeof p.locationId === 'string' && has(env.ix.loc, p.locationId) ? env.ix.loc[p.locationId] : null;
    if (!loc) return C.fail('not_found', 'Такої локації немає.');
    var ids = Array.isArray(p.depIds) ? p.depIds.filter(function (x) { return typeof x === 'string'; }) : [];
    var d = P.demoMailVars.data(env, sysMe(loc), loc, ids.length ? ids : null);
    return { ok: true, vars: d.vars, audits: d.audits, pct: d.pct };
  };

  P.demoSysApi.mailAudit = function (p, env) {
    var a = typeof p.id === 'string' ? env.audits().filter(function (x) { return x.id === p.id; })[0] : null;
    if (!a) return C.fail('not_found', 'Такого аудиту немає.');
    var st = P.demoSenior.deptStats(env, [a], a.departmentId);   // ті самі правила, що в цифрах відділу (agg у mail-vars.js)
    return { ok: true, locationId: a.locationId, departmentId: a.departmentId, day: a.day, isTest: !!a.isTest, checked: st.checked, rejected: st.rejected, pct: C.pct(st.rejected, st.checked) };
  };

  P.demoSysApi.mailKdState = function (p, env) {
    var day = env.day(), from = P.demoMailVars.addDays(day, -SELF_DAYS), locations = [], closed = [];
    activeLocs(env, null).forEach(function (loc) {
      var kdNew = null;
      P.demoApis.forEach(function (api) {
        if (kdNew !== null || !has(api, 'srKdOverview')) return;
        try { var r = api.srKdOverview({ locationId: loc.id }, sysMe(loc), env); if (r && r.ok && r.totals) kdNew = Number(r.totals['new']) || 0; } catch (e) { kdNew = null; }
      });
      locations.push({ id: loc.id, name: loc.name, kdNew: kdNew });
      P.demoKd.selfClosed(env, loc.id, from, day).forEach(function (x) {
        closed.push({ id: loc.id + '|' + x.key, locationId: loc.id, locationName: loc.name, departmentId: x.departmentId, departmentName: x.departmentName,
          types: x.types.slice(0, 3), after: typeof x.typesAfter === 'number' ? P.fmt.pct(x.typesAfter) : '—', finishedOn: x.finishedOn });
      });
    });
    return { ok: true, day: day, locations: locations, selfClosed: closed, seen: seenOf(env) };
  };

  P.demoSysApi.mailKdMark = function (p, env) {
    var day = env.day(), old = P.demoMailVars.addDays(day, -SEEN_DAYS), s = seenOf(env);
    Object.keys(obj(p.counts)).forEach(function (id) { var n = p.counts[id]; if (has(env.ix.loc, id) && typeof n === 'number' && isFinite(n) && n >= 0) s.counts[id] = Math.floor(n); });
    (Array.isArray(p.closed) ? p.closed : []).forEach(function (id) { if (typeof id === 'string' && id.length <= 200) s.closed[id] = day; });
    Object.keys(s.closed).forEach(function (id) { if (!(s.closed[id] > old)) delete s.closed[id]; });
    Object.keys(s.closed).sort(function (a, b) { return s.closed[a] < s.closed[b] ? 1 : -1; }).slice(SEEN_MAX).forEach(function (id) { delete s.closed[id]; });
    if (p.init === true) s.init = true;   // перший круг сервера пройшов: наявне запамʼятовано, далі надсилаємо лише НОВЕ
    env.storage.set(KEY_SEEN, s);
    return { ok: true };
  };
})(typeof window !== 'undefined' ? window : globalThis);
