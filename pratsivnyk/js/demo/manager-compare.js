(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  P.demoApis = P.demoApis || [];
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  var MAX_BACK = 365;   // найстаріший день, який можна взяти, — стільки днів до сьогодні

  function M() { return P.demoMgr; }

  function bad(field, message) { return { err: C.fail('validation', message, [{ field: field, message: message }]) }; }

  function realDay(s) {
    if (typeof s !== 'string' || !DAY_RE.test(s)) return false;
    var d = new Date(Date.parse(s + 'T00:00:00Z'));
    return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }

  function period(raw, name, today) {
    var label = name === 'a' ? 'Період A' : 'Період B';
    if (!raw || typeof raw !== 'object') return bad(name, label + ': вкажіть дати «з» і «по».');
    if (!realDay(raw.from) || !realDay(raw.to)) return bad(name, label + ': дати мають бути у вигляді 2026-10-30.');
    var from = raw.from, to = raw.to > today ? today : raw.to;
    if (from > to) return bad(name, label + ': початок періоду не може бути пізніше за кінець.');
    if (from < S.addDays(today, -MAX_BACK)) return bad(name, label + ': можна взяти дні не старші за ' + MAX_BACK + ' днів.');
    return { from: from, to: to };
  }

  function figures(env, list, deps) {
    var s = M().stats(env, list, deps);
    return { audits: s.audits, checked: s.checked, rejected: s.rejected, pct: s.pct };
  }

  var api = {
    mgrCompare: function (p, me, env) {
      var X = M();
      if (!X || !X.can(me)) return C.forbidden();
      p = p || {};
      var sel = X.locOf(p, env);
      if (sel.err) return sel.err;
      if (!sel.loc) return bad('locationId', 'Оберіть локацію.').err;
      var today = env.day(), a = period(p.a, 'a', today), b = period(p.b, 'b', today);
      if (a.err) return a.err;
      if (b.err) return b.err;
      var deps = X.depsIn(env, sel.loc.id), la = X.auditsIn(env, sel.loc.id, a.from, a.to), lb = X.auditsIn(env, sel.loc.id, b.from, b.to);
      var rows = deps.map(function (d) {
        return { id: d.id, name: d.name, active: d.active !== false, a: figures(env, la, [d]), b: figures(env, lb, [d]) };
      }).filter(function (r) { return r.active || r.a.audits || r.a.rejected || r.b.audits || r.b.rejected; });   // вимкнений відділ — лише якщо в періодах були його числа
      rows.forEach(function (r) { delete r.active; });
      return { ok: true, location: X.short(sel.loc), a: a, b: b, rows: rows, total: { a: figures(env, la, deps), b: figures(env, lb, deps) } };
    }
  };

  P.demoApis.push(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
