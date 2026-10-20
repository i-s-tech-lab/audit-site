(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  P.demoApis = P.demoApis || [];
  if (typeof module !== 'undefined' && typeof require === 'function') {
    if (!P.demoMgrKd) require('./manager-kd-plates.js');
    if (!P.demoMgr) require('./manager.js');
  }
  var C = P.demoCommon, S = P.demoSenior, I = P.demoKd.internal, B = P.demoKd.board, MK = P.demoMgrKd, PHASE_OF = I.PHASE_OF;
  var WEEKS = [4, 8, 13], WEEKS_DEF = 8, SERIES_WEEKS = 8;
  var CELL_OF = { relapse: 'relapse', open: 'open', early: 'open', extra: 'wait', week1: 'observe', week2: 'observe', quiet: 'observe' };
  var CELL_RANK = { relapse: 4, open: 3, wait: 2, observe: 1 };

  function M() { return P.demoMgr; }
  function has(o, k) { return typeof k === 'string' && o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function minDay(a, b) { return a < b ? a : b; }
  function short(l) { return { id: l.id, name: l.name }; }

  function weeksArg(v) {
    var n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,2}$/.test(v) ? Number(v) : NaN;
    return WEEKS.indexOf(n) >= 0 ? n : WEEKS_DEF;
  }
  function periodOf(env, weeks) { var today = env.day(), days = 7 * weeks; return { weeks: weeks, days: days, from: S.addDays(today, -(days - 1)), to: today }; }
  function rulesOf() { return { threshold: S.KD.THRESHOLD, early: S.KD.EARLY_MIN, pareto: S.KD.PARETO, reviewWeekday: S.KD.REVIEW_DAY }; }
  function locArg(p, env) {
    var id = p.locationId;
    return has(env.ix.loc, id) ? { loc: env.ix.loc[id] } : { err: C.fail('not_found', 'Такої локації немає — оновіть сторінку.') };
  }
  function phaseOf(b, a) {
    var ph = B.phaseUi(a);
    return { phase: ph, week: B.obsWeek(a), waiting: ph === 'observe' && !!a.implementedAt && !!a.p1 && (B.inExtra(b.cx, a) || a.p1.from > b.cx.today) };
  }
  function locWeek(cx, n) {
    var c = 0, r = 0, s = cx.start(n), e = cx.end(n);
    cx.deps.forEach(function (d) { var w = cx.range(d.id, s, e); c += w.checked; r += w.rejected; });
    return { start: s, end: e, rate: C.pct(r, c), current: n > cx.L };
  }


  function nowOf(b) {
    var o = { open: 0, relapse: 0, observe: 0, total: 0 };
    b.all.forEach(function (a) { if (I.isActive(a)) { o[B.phaseUi(a)]++; o.total++; } });
    return o;
  }
  function closedOf(b, per) {
    var o = { total: 0, helped: 0, held_types: 0, not_needed: 0, early: 0 };
    MK.closedIn(b, per).forEach(function (a) { o[a.status]++; o.total++; if (a.closedEarly) o.early++; });
    return o;
  }
  function typesAvgOf(eff) {
    return { before: eff.avg.before, after: eff.avg.after, n: eff.items.filter(function (x) { return x.before != null && x.after != null; }).length };
  }
  function summary(b, per, eff) {
    var cx = b.cx, opened = b.all.filter(function (a) { return MK.inPer(per, a.openedAt); }), depts = {}, series = [];
    opened.forEach(function (a) { depts[a.departmentId] = 1; });
    for (var n = cx.L + 2 - SERIES_WEEKS; n <= cx.L + 1; n++) series.push(locWeek(cx, n));
    return { now: nowOf(b), opened: opened.length, openedDepts: Object.keys(depts).length, relapses: opened.filter(function (a) { return !!a.repeatOf; }).length,
      closed: closedOf(b, per), typesAvg: typesAvgOf(eff), daysToPlan: I.periodSum(cx, b.all, per.from, per.to).implementedDaysAvg, series: series };
  }


  function sorted(b, depId) {
    return b.cx.kds(depId).slice().sort(function (a, c) { return a.openedAt < c.openedAt ? -1 : a.openedAt > c.openedAt ? 1 : a.key < c.key ? -1 : 1; });
  }
  function streaksOf(b, per) {
    var out = [];
    b.cx.deps.forEach(function (d) {
      var list = sorted(b, d.id), last = list[list.length - 1];
      if (!last) return;
      var no = b.nos[last.key], act = list.filter(I.isActive).length;
      if (!(no >= 2) || !(act || (B.CLOSED[last.status] && MK.inPer(per, last.finishedOn)))) return;
      var start = 0;
      list.forEach(function (a, i) { if (b.nos[a.key] === 1 && !(a.repeatOf && has(b.nos, a.repeatOf))) start = i; });
      var serie = list.slice(start);
      out.push({ locationId: b.cx.loc.id, locationName: b.cx.loc.name, departmentId: d.id, departmentName: d.name, no: no, since: serie[0].openedAt,
        relapses: serie.filter(function (a) { return !!a.repeatOf; }).length, activeNow: act });
    });
    return out;
  }
  function returningOf(b, per) {
    var cx = b.cx, ix = cx.env.ix, out = [];
    cx.deps.forEach(function (d) {
      var by = {}, order = [];
      sorted(b, d.id).filter(function (a) { return MK.inPer(per, a.openedAt); }).forEach(function (a) {
        I.itemIds(cx, a).forEach(function (t) {
          if (!has(by, t)) { by[t] = []; order.push(t); }
          by[t].push(a);
        });
      });
      order.filter(function (t) { return by[t].length >= 2; }).forEach(function (t) {
        var last = by[t][by[t].length - 1], ph = phaseOf(b, last), def = ix.def[t];
        out.push({ defectTypeId: t, name: def.name, level: def.level || 'fix', locationId: cx.loc.id, locationName: cx.loc.name, departmentId: d.id, departmentName: d.name,
          count: by[t].length, lastKey: last.key, lastNo: b.nos[last.key],
          last: { phase: ph.phase, week: ph.week, waiting: ph.waiting, status: ph.phase === 'final' ? last.status : null } });
      });
    });
    return out;
  }
  function sameDeptsOf(env, preps, per) {
    return (env.db.deptTypes || []).map(function (dt) {
      var cells = preps.map(function (b) {
        var d = b.cx.deps.filter(function (x) { return x.deptTypeId === dt.id && x.active !== false; })[0] || b.cx.deps.filter(function (x) { return x.deptTypeId === dt.id; })[0];
        if (!d) return { locationId: b.cx.loc.id, departmentId: null, rate: null, opened: null, closedOk: null, relapses: null };
        var st = b.cx.range(d.id, per.from, per.to), mine = b.cx.kds(d.id);
        var opened = mine.filter(function (a) { return MK.inPer(per, a.openedAt); });
        return { locationId: b.cx.loc.id, departmentId: d.id, rate: C.pct(st.rejected, st.checked), opened: opened.length,
          closedOk: mine.filter(function (a) { return (a.status === 'helped' || a.status === 'held_types') && MK.inPer(per, a.finishedOn); }).length,
          relapses: opened.filter(function (a) { return !!a.repeatOf; }).length };
      });
      return { deptTypeId: dt.id, name: dt.name, cells: cells };
    }).filter(function (r) { return r.cells.some(function (c) { return c.departmentId; }); });
  }


  function lastWeek(cx) {
    var w = locWeek(cx, cx.L);
    return { start: w.start, end: w.end, rate: w.rate, deptsOver: cx.deps.filter(function (d) { return cx.wk(d.id, cx.L).over; }).length, depts: cx.deps.length };
  }
  function whoName(cx, a) { var u = a.who && has(cx.env.ix.user, a.who) ? cx.env.ix.user[a.who] : null; return u ? u.name : null; }
  function execOf(b, per) {
    var cx = b.cx;
    return cx.deps.map(function (d) {
      var mine = cx.kds(d.id), impl = mine.filter(function (a) { return MK.inPer(per, a.implementedAt); }), who = [];
      impl.forEach(function (a) { var n = whoName(cx, a); if (n && who.indexOf(n) < 0) who.push(n); });
      return { departmentId: d.id, name: d.name,
        actives: B.activesOf(b, d.id).map(function (a) {
          var ph = phaseOf(b, a);
          return { key: a.key, no: b.nos[a.key], phase: ph.phase, week: ph.week, waiting: ph.waiting, day: B.obsDay(a), extra: ph.waiting && !!a.extra,
            closedEarly: !!a.closedEarly, early: !!a.early, parallel: a.parallelWith.length > 0,
            repeat: !!a.repeatOf, openedAt: B.rootOf(b, a).openedAt, relapseDay: a.repeatOf ? a.openedAt : null, implementedAt: a.implementedAt || null };
        }),
        count: mine.filter(function (a) { return a.openedAt <= per.to && (I.isActive(a) || (a.finishedOn && a.finishedOn >= per.from)); }).length,
        daysToPlan: I.periodSum(cx, mine, per.from, per.to).implementedDaysAvg, who: who,
        relapses: mine.filter(function (a) { return a.repeatOf && MK.inPer(per, a.openedAt); }).length,
        notNeeded: mine.filter(function (a) { return a.status === 'not_needed' && MK.inPer(per, a.finishedOn); }).length };
    });
  }
  function heatOf(b) {
    var cx = b.cx, ns = [], weeks = [];
    for (var n = cx.L + 2 - SERIES_WEEKS; n <= cx.L + 1; n++) { ns.push(n); weeks.push({ start: cx.start(n), end: cx.end(n), current: n > cx.L }); }
    return { weeks: weeks, rows: cx.deps.map(function (d) {
      var segs = [];
      cx.kds(d.id).forEach(function (a) { segs = segs.concat(B.segsOf(cx, a)); });
      return { departmentId: d.id, name: d.name, cells: ns.map(function (n) {
        var s = cx.start(n), e = minDay(cx.end(n), cx.today), best = null;
        segs.forEach(function (sg) {
          var k = CELL_OF[sg.kind];
          if (sg.from <= e && sg.to >= s && k && (!best || CELL_RANK[k] > CELL_RANK[best])) best = k;
        });
        return { rate: cx.wk(d.id, n).rate, state: best };
      }) };
    }) };
  }
  function notNeededOf(b, per) {
    return MK.closedIn(b, per).filter(function (a) { return a.status === 'not_needed'; }).map(function (a) {
      var d = b.cx.env.ix.dep[a.departmentId];
      return { key: a.key, no: b.nos[a.key], departmentName: d ? d.name : '', openedAt: B.rootOf(b, a).openedAt, finishedOn: a.finishedOn,
        reason: a.notNeeded && typeof a.notNeeded.reason === 'string' ? a.notNeeded.reason : null };
    });
  }
  function outcomeOf(a) {
    return a.status === 'helped' || a.status === 'held_types' ? a.status : a.status === 'not_helped' ? 'relapse' : PHASE_OF[a.status] === 'observe' ? 'running' : null;
  }
  function outs() { return { helped: 0, held_types: 0, relapse: 0, running: 0 }; }
  function causesOf(b, per) {
    var cx = b.cx, labels = MK.causeLabels(), by = {}, order = Object.keys(labels), total = 0;
    b.all.filter(function (a) { return MK.inPer(per, a.implementedAt); }).forEach(function (a) {
      var v = I.view(cx, a), oc = outcomeOf(a), list = [];
      if (v.causePerItem) (a.items || []).forEach(function (t) { var it = v.items.filter(function (x) { return x.defectTypeId === t; })[0]; if (it && it.cause) list.push(it.cause); });
      else (a.causes || []).forEach(function (c) { if (has(labels, c)) list.push(c); });
      list.forEach(function (c) {
        var x = by[c] = by[c] || { id: c, label: labels[c], count: 0, outcomes: outs() };
        x.count++; total++;
        if (oc) x.outcomes[oc]++;
      });
    });
    var items = order.filter(function (c) { return has(by, c); }).map(function (c) { return by[c]; });
    return { total: total, items: items.sort(function (x, y) { return y.count - x.count; }) };
  }
  function whoOf(b, per) {
    var cx = b.cx, by = {}, out = [];
    b.all.filter(function (a) { return MK.inPer(per, a.implementedAt); }).forEach(function (a) {
      var name = whoName(cx, a);
      if (!name) return;
      var k = a.who + '|' + a.departmentId, d = cx.env.ix.dep[a.departmentId], oc = outcomeOf(a);
      if (!has(by, k)) { by[k] = Object.assign({ userId: a.who, name: name, departmentName: d ? d.name : '', plans: 0 }, outs()); out.push(by[k]); }
      by[k].plans++;
      if (oc) by[k][oc]++;
    });
    return out.sort(function (x, y) { return y.plans - x.plans || (x.name < y.name ? -1 : x.name > y.name ? 1 : 0); });
  }

  var api = {
    mgrKdBoard: function (p, me, env) {
      var X = M();
      if (!X || !X.can(me)) return C.forbidden();
      var per = periodOf(env, weeksArg(p.weeks)), preps = env.db.locations.map(function (l) { return B.prep(env, l); });
      var streaks = [], returning = [];
      var locations = preps.map(function (b) {
        streaks = streaks.concat(streaksOf(b, per));
        returning = returning.concat(returningOf(b, per));
        return Object.assign(short(b.cx.loc), summary(b, per, B.efficiency(b, per.days)));
      });
      streaks.sort(function (x, y) { return y.no - x.no || (x.since < y.since ? -1 : x.since > y.since ? 1 : 0); });
      returning.sort(function (x, y) { return y.count - x.count; });
      return { ok: true, today: env.day(), threshold: S.KD.THRESHOLD, weeks: per.weeks, from: per.from, to: per.to, rules: rulesOf(),
        locations: locations, streaks: streaks, returning: returning, sameDepts: sameDeptsOf(env, preps, per) };
    },

    mgrKdLoc: function (p, me, env) {
      var X = M();
      if (!X || !X.can(me)) return C.forbidden();
      var r = locArg(p, env); if (r.err) return r.err;
      var per = periodOf(env, weeksArg(p.weeks)), b = B.prep(env, r.loc), cx = b.cx, eff = B.efficiency(b, per.days), sm = summary(b, per, eff);
      return { ok: true, today: cx.today, threshold: cx.T, weeks: per.weeks, from: per.from, to: per.to, rules: rulesOf(),
        location: short(r.loc), locations: env.db.locations.map(short),
        kpi: { now: sm.now, opened: sm.opened, openedDepts: sm.openedDepts, relapses: sm.relapses, closed: sm.closed, typesAvg: sm.typesAvg,
          daysToPlan: sm.daysToPlan, week: lastWeek(cx) },
        timeline: B.timeline(b), exec: execOf(b, per), heat: heatOf(b), efficiency: eff, notNeeded: notNeededOf(b, per),
        causes: causesOf(b, per), who: whoOf(b, per), plates: MK.plates(b, per, eff) };
    },

    mgrKdAction: function (p, me, env) {
      var X = M();
      if (!X || !X.can(me)) return C.forbidden();
      var r = locArg(p, env); if (r.err) return r.err;
      var b = B.prep(env, r.loc), a = has(b.byKey, p.key) ? b.byKey[p.key] : null;
      if (!a) return C.fail('not_found', 'Такої коригуючої дії немає. Оновіть сторінку.');
      return { ok: true, today: b.cx.today, threshold: b.cx.T, location: short(r.loc), kd: B.pageKd(b, a, false) };
    }
  };

  P.demoApis.push(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
