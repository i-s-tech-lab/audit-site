(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  P.demoApis = P.demoApis || [];
  if (!(P.demoKd && P.demoKd.board) && typeof module !== 'undefined' && typeof require === 'function') require('./senior-kd-board.js');
  var C = P.demoCommon, S = P.demoSenior, I = P.demoKd.internal, B = P.demoKd.board;
  var WEEKS = [4, 8, 13, 26], WEEKS_DEF = 8, SCALE_MIN = 9;
  var ACTIVE_RANK = { relapse: 0, open: 1, observe: 2 };
  var STATES = ['open', 'relapse', 'observe', 'helped', 'held_types', 'not_needed', 'not_helped'];

  function has(o, k) { return typeof k === 'string' && o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function minDay(a, b) { return a < b ? a : b; }
  function maxDay(a, b) { return a > b ? a : b; }
  function inPer(per, d) { return !!d && d >= per.from && d <= per.to; }
  function cmpDay(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

  function weeksArg(v) {
    var n = typeof v === 'number' ? v : typeof v === 'string' && /^\d{1,2}$/.test(v) ? Number(v) : NaN;
    return WEEKS.indexOf(n) >= 0 ? n : WEEKS_DEF;
  }
  function periodOf(cx, weeks) { var days = 7 * weeks; return { weeks: weeks, days: days, from: S.addDays(cx.today, -(days - 1)), to: cx.today }; }
  function boardTop(p, me, env) {
    var api = P.demoApis.filter(function (x) { return x && typeof x.srKdBoard === 'function'; })[0];
    return api.srKdBoard(p, me, env);
  }
  function causeLabels() {
    var api = P.demoApis.filter(function (x) { return x && typeof x.srKdCauses === 'function'; })[0], out = {};
    ((api && api.srKdCauses().causes) || []).forEach(function (c) { out[c.id] = c.label; });
    return out;
  }
  function chainsOf(b) {
    var by = {}, out = [];
    b.all.forEach(function (a) {
      var r = B.rootOf(b, a);
      if (!has(by, r.key)) { by[r.key] = { root: r, list: [] }; out.push(by[r.key]); }
      by[r.key].list.push(a);
    });
    out.forEach(function (c) { c.last = c.list[c.list.length - 1]; });
    return out;
  }
  function stateOf(a) { return I.isActive(a) ? B.phaseUi(a) : a.status; }
  function waitingOf(cx, a) { return a.status === 'check' && !!a.implementedAt && (B.inExtra(cx, a) || !!(a.p1 && a.p1.from > cx.today)); }
  function deptStartOf(cx, a) { var sp = B.startSpan(cx, a); return I.rangeRate(cx, a.departmentId, sp.from, sp.to).rate; }


  function compareOf(b, a, eff) {
    var cx = b.cx, dep = a.departmentId, ids = I.itemIds(cx, a), st0 = B.startRange(cx, a), dStart = deptStartOf(cx, a);
    if (I.isActive(a)) {
      var cw = cx.wk(dep, cx.L + 1), cur = cx.range(dep, cw.start, cw.end);
      return { typesStart: C.pct(I.sumOf(st0.byType, ids), st0.checked), typesNow: C.pct(I.sumOf(cur.byType, ids), cw.checked), typesNowPartial: true,
        deptStart: dStart, deptNow: cw.rate, deptNowPartial: true };
    }
    var v = I.view(cx, a), e = has(eff, a.key) ? eff[a.key] : null, w2 = v.typesAfter2 != null, deptNow;
    if (a.status === 'not_needed') {
      var k = cx.nextData(dep, cx.of(a.finishedOn) + 1);
      deptNow = k == null ? null : cx.wk(dep, k).rate;
    } else deptNow = w2 ? v.after2 : v.after;
    return { typesStart: e ? e.before : v.typesBefore, typesNow: e ? e.after : w2 ? v.typesAfter2 : v.typesAfter, typesNowPartial: false,
      deptStart: dStart, deptNow: deptNow, deptNowPartial: false };
  }
  function listRow(b, c, sc, eff) {
    var cx = b.cx, r = c.root, a = c.last, v = I.view(cx, a), st = stateOf(a), segs = [], marks = [], relapseDay = null;
    c.list.forEach(function (x) {
      B.segsOf(cx, x).forEach(function (s) {
        if (s.to < sc.from || s.from > sc.to) return;
        segs.push({ kind: s.kind, from: maxDay(s.from, sc.from), to: minDay(s.to, sc.to), running: s.running });
      });
      B.marksOf(x).forEach(function (m) {
        if (m.kind === 'relapse') relapseDay = m.day;
        if (m.day >= sc.from && m.day <= sc.to) marks.push(m);
      });
    });
    if (a.repeatOf) relapseDay = a.openedAt;
    return Object.assign({ key: a.key, no: b.nos[r.key], departmentId: a.departmentId, departmentName: v.departmentName,
      group: I.isActive(a) ? 'active' : 'closed', state: st, week: st === 'observe' ? B.obsWeek(a) : null, day: B.obsDay(a), waiting: waitingOf(cx, a),
      closedEarly: !!a.closedEarly,
      tags: { early: c.list.some(function (x) { return !!x.early; }), parallel: c.list.some(function (x) { return x.parallelWith.length > 0; }), repeat: c.list.length > 1 },
      openedAt: r.openedAt, relapseDay: relapseDay, finishedOn: I.isActive(a) ? null : a.finishedOn || null,
      types: { count: v.items.length, pieces: v.items.reduce(function (s, it) { return s + it.pieces; }, 0), names: v.items.map(function (it) { return it.name; }) },
      segments: segs, marks: marks, clippedStart: r.openedAt < sc.from }, compareOf(b, a, eff));
  }
  function listRows(b, per, sc) {
    var eff = {}, order = {};
    B.efficiency(b, per.days).items.forEach(function (x) { eff[x.key] = x; });
    b.cx.deps.forEach(function (d, i) { order[d.id] = i; });
    var rows = chainsOf(b).filter(function (c) { return I.isActive(c.last) || inPer(per, c.last.finishedOn); })
      .map(function (c) { return listRow(b, c, sc, eff); });
    return rows.sort(function (x, y) {
      if (x.group !== y.group) return x.group === 'active' ? -1 : 1;
      if (x.group === 'active') return ACTIVE_RANK[x.state] - ACTIVE_RANK[y.state] || cmpDay(x.openedAt, y.openedAt) || order[x.departmentId] - order[y.departmentId] || x.no - y.no;
      return cmpDay(y.finishedOn, x.finishedOn) || cmpDay(y.openedAt, x.openedAt) || order[x.departmentId] - order[y.departmentId];
    });
  }
  function scaleOf(cx, weeks) {
    var n0 = cx.L + 2 - Math.max(SCALE_MIN, weeks + 1), ws = [];
    for (var n = n0; n <= cx.L + 1; n++) ws.push({ start: cx.start(n), end: cx.end(n), current: n > cx.L });
    return { from: ws[0].start, to: ws[ws.length - 1].end, today: cx.today, weeks: ws };
  }
  function stateCounts(rows) {
    var o = { all: rows.length };
    STATES.forEach(function (s) { o[s] = 0; });
    rows.forEach(function (r) { o[r.state]++; });
    return o;
  }


  function week1Of(cx, a) { return !a.implementedAt ? null : a.week1Verdict || (waitingOf(cx, a) ? 'wait' : 'running'); }
  function week2Of(a) {
    if (a.week1Verdict !== 'norm' && a.week1Verdict !== 'types_lower') return null;
    if (a.closedEarly) return a.quietReturned ? 'relapse' : 'helped';
    if (a.status === 'helped' || a.status === 'held_types') return a.status;
    if (a.status === 'not_helped' && a.relapseStage === 2) return 'relapse';
    return 'running';
  }
  function causesOf(a, v, labels) {
    if (!a.implementedAt) return [];
    if (v.causePerItem) return v.items.filter(function (it) { return it.cause; }).map(function (it) { return { defectTypeId: it.defectTypeId, cause: it.cause, causeLabel: it.causeLabel }; });
    return (a.causes || []).filter(function (c) { return has(labels, c); }).map(function (c) { return { defectTypeId: null, cause: c, causeLabel: labels[c] }; });
  }
  function partial(w, val) { return !!(w && w.pending && val != null); }
  function quietOf(cx, a) {
    if (!a.closedEarly) return null;
    return B.segsOf(cx, a).filter(function (s) { return s.kind === 'quiet'; })[0] || null;
  }
  function afterItem(b, c, labels) {
    var cx = b.cx, a = c.root, v = I.view(cx, a), q = quietOf(cx, a), last = c.last, fin = stateOf(last);
    return { key: a.key, no: b.nos[a.key], departmentId: a.departmentId, departmentName: v.departmentName, openedAt: a.openedAt,
      early: !!a.early, parallel: a.parallelWith.length > 0, closedEarly: !!a.closedEarly,
      planned: !!a.implementedAt, implementedAt: v.implementedAt, daysToPlan: v.daysToImplement,
      week1: week1Of(cx, a), week2: week2Of(a), final: fin, finalWeek: fin === 'observe' ? B.obsWeek(last) : null, finalWaiting: waitingOf(cx, last),
      before: v.typesBefore, after1: v.typesAfter, after1Partial: partial(v.result, v.typesAfter), after2: v.typesAfter2, after2Partial: partial(v.hold, v.typesAfter2),
      deptBefore: deptStartOf(cx, a), deptAfter1: v.result && v.result.checked ? v.result.rate : null, deptAfter2: v.hold && v.hold.checked ? v.hold.rate : null,
      quiet: q ? q.typesRate : null, quietPartial: !!(q && q.running), deptQuiet: q ? q.deptRate : null,
      causes: causesOf(a, v, labels) };
  }

  var api = {
    srKdListBoard: function (p, me, env) {
      var top = boardTop(p, me, env); if (!top.ok) return top;
      var b = B.prep(env, S.loc(p, me, env).loc), cx = b.cx, per = periodOf(cx, weeksArg(p.weeks)), sc = scaleOf(cx, per.weeks), rows = listRows(b, per, sc);
      return { ok: true, today: cx.today, threshold: cx.T, canWrite: top.canWrite, weeks: per.weeks, from: per.from, to: per.to, week: top.week,
        tiles: top.tiles, counts: top.counts, scale: sc, rows: rows, stateCounts: stateCounts(rows) };
    },

    srKdAfter: function (p, me, env) {
      var top = boardTop(p, me, env); if (!top.ok) return top;
      var b = B.prep(env, S.loc(p, me, env).loc), cx = b.cx, per = periodOf(cx, weeksArg(p.weeks)), labels = causeLabels(), series = {};
      top.tiles.forEach(function (t) { series[t.departmentId] = t.series.map(function (x) { return x.rate; }); });
      var items = chainsOf(b).filter(function (c) { return inPer(per, c.root.openedAt); }).map(function (c) { return afterItem(b, c, labels); })
        .sort(function (x, y) { return cmpDay(x.openedAt, y.openedAt) || (x.key < y.key ? -1 : x.key > y.key ? 1 : 0); });
      return { ok: true, today: cx.today, threshold: cx.T, weeks: per.weeks, from: per.from, to: per.to, week: top.week, tiles: top.tiles, counts: top.counts,
        departments: cx.deps.map(function (d) { return { id: d.id, name: d.name }; }), items: items, series: series };
    }
  };

  P.demoApis.push(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
