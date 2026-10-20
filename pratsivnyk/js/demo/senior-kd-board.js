(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  if (!(P.demoKd && P.demoKd.internal) && typeof module !== 'undefined' && typeof require === 'function') require('./senior-kd.js');
  var C = P.demoCommon, S = P.demoSenior, RU = P.demoKdRules, I = P.demoKd.internal, PHASE_OF = I.PHASE_OF;
  var TILE_BARS = 7, TL_WEEKS = 5, WORK_WEEKS = 6, COMP_WEEKS = 7;
  var CLOSED_DAYS = 56, RECENT_DAYS = 14, DAILY_MAX = 182;
  var CLOSED = { helped: 1, held_types: 1, not_needed: 1 };

  function has(o, k) { return typeof k === 'string' && o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function r2(x) { return Math.round(x * 100) / 100; }
  function mean(list) { return list.reduce(function (s, v) { return s + v; }, 0) / list.length; }
  function minDay(a, b) { return a < b ? a : b; }
  function maxDay(a, b) { return a > b ? a : b; }
  function since(cx, days) { return S.addDays(cx.today, -(days - 1)); }
  function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
  function typesRate(cx, depId, ids, from, to) {
    if (!from || !to || from > to) return null;
    var st = cx.range(depId, from, to);
    return C.pct(I.sumOf(st.byType, ids), st.checked);
  }


  function numberCx(cx) {
    var out = {};
    cx.deps.forEach(function (d) {
      var list = cx.kds(d.id).slice().sort(function (a, b) { return a.openedAt < b.openedAt ? -1 : a.openedAt > b.openedAt ? 1 : a.key < b.key ? -1 : 1; });
      var last = 0, end = null;
      list.forEach(function (a) {
        if (a.repeatOf && has(out, a.repeatOf)) out[a.key] = out[a.repeatOf];
        else { last = end != null && end >= a.openedAt ? last + 1 : 1; out[a.key] = last; }
        var e = a.finishedOn || cx.today;
        if (end == null || e > end) end = e;
      });
    });
    return out;
  }


  function prep(env, loc) {
    var cx = I.makeCx(env, loc), all = cx.all(), byKey = {};
    all.forEach(function (a) { byKey[a.key] = a; });
    return { cx: cx, nos: numberCx(cx), all: all, byKey: byKey };
  }
  function rootOf(b, a) {
    for (var x = a, g = 0; x.repeatOf && has(b.byKey, x.repeatOf) && g < 100; g++) x = b.byKey[x.repeatOf];
    return x;
  }
  function phaseUi(a) {
    var ph = PHASE_OF[a.status];
    return ph === 'open' ? (a.repeatOf ? 'relapse' : 'open') : ph;
  }
  function obsWeek(a) { return a.status === 'check' ? 1 : a.status === 'hold' ? 2 : null; }
  function obsDay(a) { return a.status === 'check' && a.p1 ? a.p1.days : a.status === 'hold' && a.p2 ? 7 + a.p2.days : null; }
  function inExtra(cx, a) { return !!(a.extra && a.status === 'check' && cx.today >= a.extra.from && cx.today <= a.extra.to); }
  function activesOf(b, depId) {
    return b.cx.kds(depId).filter(I.isActive).sort(function (x, y) { return b.nos[x.key] - b.nos[y.key] || (x.openedAt < y.openedAt ? -1 : 1); });
  }
  function weekBar(cx, depId, n) { var w = cx.wk(depId, n); return { start: w.start, end: w.end, rate: w.rate, current: n > cx.L }; }

  function quietList(b, depId) {
    return b.cx.kds(depId).filter(function (a) { return a.closedEarly && a.p2 && !a.p2.done; }).map(function (a) { return { key: a.key, no: b.nos[a.key], days: a.p2.days }; });
  }
  function tiles(b) {
    var cx = b.cx;
    return cx.deps.map(function (d) {
      var w = cx.wk(d.id, cx.L), series = [];
      for (var n = cx.L + 2 - TILE_BARS; n <= cx.L + 1; n++) series.push(weekBar(cx, d.id, n));
      return { departmentId: d.id, name: d.name, rate: w.rate, rejected: w.rejected, checked: w.checked, over: w.over, prevRate: cx.wk(d.id, cx.L - 1).rate,
        series: series, actives: activesOf(b, d.id).map(function (a) {
          return { key: a.key, id: a.id || null, no: b.nos[a.key], phase: phaseUi(a), early: !!a.early, parallel: a.parallelWith.length > 0, repeat: !!a.repeatOf, week: obsWeek(a),
            obsDay: obsDay(a), extra: inExtra(cx, a) };
        }), quiet: quietList(b, d.id) };
    });
  }
  function counts(b) {
    var cx = b.cx, from = since(cx, CLOSED_DAYS), c = { open: 0, relapse: 0, observe: 0, activeAll: 0, closed: { total: 0, helped: 0, held_types: 0, not_needed: 0, early: 0 } };
    b.all.forEach(function (a) {
      if (I.isActive(a)) { c[phaseUi(a)]++; c.activeAll++; } else if (CLOSED[a.status] && a.finishedOn >= from && a.finishedOn <= cx.today) {
        c.closed[a.status]++; c.closed.total++;
        if (a.closedEarly) c.closed.early++;   // v2.0: з «тримається» — скільки закрито достроково (після 7 днів)
      }
    });
    return c;
  }
  function paretoOf(cx, depId) {
    var w = cx.wk(depId, cx.L), st = cx.range(depId, w.start, w.end), ix = cx.env.ix;
    var list = Object.keys(st.byType).filter(function (t) { return has(ix.def, t) && st.byType[t] > 0; }).map(function (t) {
      return { id: t, pieces: st.byType[t], level: ix.def[t].level || 'fix', name: ix.def[t].name };
    });
    var in70 = I.paretoIds(cx.env, st.byType, cx.R.pareto, []), cum = 0;
    return { week: { start: w.start, end: w.end }, pieces: st.rejected, items: RU.pareto(list, 100).map(function (t) {
      cum += st.byType[t];
      return { defectTypeId: t, name: ix.def[t].name, level: ix.def[t].level || 'fix', pieces: st.byType[t], cumShare: C.pct(cum, st.rejected), in70: in70.indexOf(t) >= 0 };
    }) };
  }


  function stopOf(a) { return a.implementedAt || (a.status === 'not_needed' ? a.finishedOn : null) || null; }
  function openEndOf(cx, a) {
    if (a.implementedAt) return a.implementedAt;
    if (a.status === 'not_needed') return maxDay(a.finishedOn, a.openedAt);
    return cx.today;
  }
  function segsOf(cx, a) {
    var out = [], today = cx.today, dep = a.departmentId, ids = I.itemIds(cx, a), stop = stopOf(a);
    var add = function (kind, from, to, running) {
      if (!from || !to || from > to) return;
      out.push({ kind: kind, from: from, to: to, running: !!running, deptRate: I.rangeRate(cx, dep, from, to).rate, typesRate: typesRate(cx, dep, ids, from, to) });
    };
    var openEnd = openEndOf(cx, a), noPlan = a.repeatOf ? 'relapse' : 'open';
    if (a.early) {
      add('early', a.openedAt, minDay(openEnd, a.weekEnd), !stop && a.weekEnd >= today);
      add(noPlan, S.addDays(a.weekEnd, 1), openEnd, !stop);
    } else add(noPlan, a.openedAt, openEnd, !stop);
    if (!a.implementedAt || !a.p1) return out;
    if (a.extra) add('extra', a.extra.from, minDay(a.extra.to, today), a.extra.to >= today);
    var per = function (kind, p) { if (p && p.from <= today) add(kind, p.from, p.done ? p.to : today, !p.done); };
    per('week1', a.p1);
    per(a.closedEarly ? 'quiet' : 'week2', a.p2);
    return out;
  }
  function markOf(a) {
    if (!a.finishedOn) return null;
    var kind = a.status === 'not_helped' ? 'relapse' : a.status;
    if (!/^(helped|held_types|relapse|not_needed)$/.test(kind)) return null;
    return a.closedEarly ? { day: a.finishedOn, kind: kind, early: true } : { day: a.finishedOn, kind: kind };
  }
  function marksOf(a) {
    var out = [], m = markOf(a);
    if (m) out.push(m);
    if (a.quietReturned && a.p2 && a.p2.to) out.push({ day: S.addDays(a.p2.to, 1), kind: 'relapse', quiet: true });
    return out;
  }
  function timeline(b) {
    var cx = b.cx, n0 = cx.L + 2 - TL_WEEKS, from = cx.start(n0), to = cx.end(cx.L + 1), weeks = [], rows = [], chains = {};
    for (var n = n0; n <= cx.L + 1; n++) weeks.push({ start: cx.start(n), end: cx.end(n), current: n > cx.L });
    b.all.forEach(function (a) { var r = rootOf(b, a); (chains[r.key] = chains[r.key] || { root: r, list: [] }).list.push(a); });
    cx.deps.forEach(function (d) {
      var mine = Object.keys(chains).map(function (k) { return chains[k]; }).filter(function (c) { return c.root.departmentId === d.id; });
      mine.sort(function (x, y) { return b.nos[x.root.key] - b.nos[y.root.key] || (x.root.openedAt < y.root.openedAt ? -1 : 1); });
      mine.forEach(function (c) {
        var segs = [], marks = [], last = c.list[c.list.length - 1], r = c.root;
        c.list.forEach(function (a) {
          segsOf(cx, a).forEach(function (s) {
            if (s.to < from || s.from > to) return;
            s.from = maxDay(s.from, from); s.to = minDay(s.to, to); segs.push(s);
          });
          marksOf(a).forEach(function (m) { if (m.day >= from && m.day <= to) marks.push(m); });
        });
        if (!segs.length) return;   // жодного дня дії на шкалі (позначка в перший день шкали — лише кінець дії, що вже минула)
        rows.push({ key: last.key, no: b.nos[r.key], departmentId: d.id, departmentName: d.name,
          tag: r.early ? 'early' : r.parallelWith.length ? 'parallel' : c.list.length > 1 ? 'repeat' : null, segments: segs, marks: marks });
      });
    });
    return { from: from, to: to, today: cx.today, weeks: weeks, rows: rows };
  }


  function weekTable(b) {
    var cx = b.cx;
    return cx.deps.map(function (d) {
      var w = cx.wk(d.id, cx.L), uc = 0, ur = 0;
      for (var q = cx.L - 3; q <= cx.L; q++) { var su = cx.wk(d.id, q); uc += su.checked; ur += su.rejected; }
      var bl = S.blur(w.rate, C.pct(ur, uc), w.checked, null, cx.T);
      return { departmentId: d.id, name: d.name, rate: w.rate, rejected: w.rejected, checked: w.checked, prevRate: cx.wk(d.id, cx.L - 1).rate,
        lo: bl ? bl.lo : null, hi: bl ? bl.hi : null };
    });
  }
  function queue(b) {
    var cx = b.cx, out = [];
    cx.deps.forEach(function (d) {
      activesOf(b, d.id).filter(function (a) { return PHASE_OF[a.status] === 'open'; }).forEach(function (a) {
        var v = I.view(cx, a), o = a.repeatOf && has(b.byKey, a.repeatOf) ? b.byKey[a.repeatOf] : null, ov = o ? I.view(cx, o) : null;
        out.push({ key: a.key, id: a.id || null, no: b.nos[a.key], departmentId: d.id, departmentName: d.name, kind: a.repeatOf ? 'relapse' : 'open',
          early: !!a.early, parallel: a.parallelWith.length > 0, openedAt: a.openedAt, typesCount: v.items.length,
          pieces: v.items.reduce(function (s, it) { return s + it.pieces; }, 0), deptShare: v.itemsShare, deptRate: v.nowRate,
          typesBefore: ov ? ov.typesBefore : null, typesAfter: ov ? (o.relapseStage === 2 ? ov.typesAfter2 : ov.typesAfter) : null,
          earlyChecked: v.earlySplit ? v.earlySplit.before.checked : null, earlyRate: v.earlySplit ? v.earlySplit.before.rate : null });
      });
    });
    return out.sort(function (x, y) { return (y.kind === 'relapse') - (x.kind === 'relapse') || (x.openedAt < y.openedAt ? -1 : x.openedAt > y.openedAt ? 1 : 0); });
  }
  function closeSoFar(cx, a, ids) {
    if (!a.p1 || a.p1.from > cx.today) return null;
    var st = cx.range(a.departmentId, a.p1.from, a.p1.done ? a.p1.to : cx.today);
    return RU.earlyClose({ checked: st.checked, rejected: st.rejected, typesPieces: I.sumOf(st.byType, ids) }, a.typesBefore, cx.T, cx.R.early);
  }
  function upcoming(b) {
    var cx = b.cx, out = [];
    cx.deps.forEach(function (d) {
      activesOf(b, d.id).filter(function (a) { return PHASE_OF[a.status] === 'observe'; }).forEach(function (a) {
        var p = a.status === 'check' ? a.p1 : a.p2, on = p.from <= cx.today, to = p.done ? p.to : cx.today, ids = I.itemIds(cx, a);
        out.push({ day: S.addDays(p.end, 1), estimated: !!p.est, key: a.key, no: b.nos[a.key], departmentName: d.name, week: obsWeek(a),
          days: p.days, need: I.OBS, extra: inExtra(cx, a), from: p.from,
          deptRateNow: on ? I.rangeRate(cx, d.id, p.from, to).rate : null, typesRateNow: on ? typesRate(cx, d.id, ids, p.from, to) : null,
          typesBefore: a.typesBefore != null ? a.typesBefore : null, close: a.status === 'check' ? closeSoFar(cx, a, ids) : null });
      });
    });
    return out.sort(function (x, y) { return x.day < y.day ? -1 : x.day > y.day ? 1 : 0; });
  }
  function closedSince(b, days) {
    var from = since(b.cx, days);
    return b.all.filter(function (a) { return CLOSED[a.status] && a.finishedOn >= from && a.finishedOn <= b.cx.today; })
      .sort(function (x, y) { return x.finishedOn < y.finishedOn ? 1 : x.finishedOn > y.finishedOn ? -1 : 0; });
  }
  function startSpan(cx, a) {
    if (!a.implementedAt && a.onRelapse && a.status !== 'not_needed' && a.baseStart) return { from: a.baseStart, to: minDay(S.addDays(a.openedAt, -1), cx.today) };
    var to = a.implementedAt && a.baseFrom ? a.baseTo : a.status === 'not_needed' ? a.finishedOn : a.weekEnd;
    return { from: a.implementedAt && a.baseFrom ? a.baseFrom : I.baseStartOf(a), to: minDay(to, cx.today) };
  }
  function startRange(cx, a) { var sp = startSpan(cx, a); return cx.range(a.departmentId, sp.from, sp.to); }
  function workKd(b, a) {
    var cx = b.cx, dep = a.departmentId, r = rootOf(b, a), ids = I.itemIds(cx, a), n0 = cx.L + 2 - WORK_WEEKS, ns = [], ix = cx.env.ix;
    for (var n = n0; n <= cx.L + 1; n++) ns.push(n);
    var pos = function (day) { var k = cx.of(day); return clamp(k - n0 + (S.parseDay(day) - S.parseDay(cx.start(k))) / 86400000 / 7, 0, WORK_WEEKS - 1 / 7); };
    var st0 = startRange(cx, a), cw = cx.wk(dep, cx.L + 1), cur = cx.range(dep, cw.start, cw.end);
    return { key: a.key, no: b.nos[a.key], phase: phaseUi(a), early: !!a.early, parallel: a.parallelWith.length > 0, repeat: !!a.repeatOf,
      obsDay: obsDay(a), extra: inExtra(cx, a), implementedAt: a.implementedAt || null, openedAt: r.openedAt, relapseDay: a.repeatOf ? a.openedAt : null, weeks: ns.map(function (k) { return cx.start(k); }),
      openPos: r2(pos(r.openedAt)), relapsePos: a.repeatOf ? r2(pos(a.openedAt)) : null, startIdx: clamp(a.n - n0, 0, WORK_WEEKS - 1),
      startFrom: startSpan(cx, a).from, startTo: startSpan(cx, a).to,
      types: ids.map(function (t) {
        var weekly = ns.map(function (k) { var w = cx.wk(dep, k); return C.pct(cx.range(dep, w.start, w.end).byType[t] || 0, w.checked); });
        return { defectTypeId: t, name: ix.def[t].name, level: ix.def[t].level || 'fix', weekly: weekly, start: C.pct(st0.byType[t] || 0, st0.checked), now: weekly[weekly.length - 1] };
      }), totals: { start: C.pct(I.sumOf(st0.byType, ids), st0.checked), now: C.pct(I.sumOf(cur.byType, ids), cw.checked) } };
  }
  function work(b) {
    var cx = b.cx;
    return cx.deps.map(function (d) {
      var act = activesOf(b, d.id);
      return { departmentId: d.id, name: d.name, rate: cx.wk(d.id, cx.L).rate, kds: act.map(function (a) { return workKd(b, a); }), pareto: act.length ? null : paretoOf(cx, d.id) };
    });
  }
  function efficiency(b, days) {
    days = days || CLOSED_DAYS;
    var cx = b.cx, items = closedSince(b, days).map(function (a) {
      var v = I.view(cx, a), ids = I.itemIds(cx, a), before = v.typesBefore, after = v.typesAfter2 != null ? v.typesAfter2 : v.typesAfter;
      if (a.status === 'not_needed') {
        var k = cx.nextData(a.departmentId, cx.of(a.finishedOn) + 1);
        before = typesRate(cx, a.departmentId, ids, a.weekStart, minDay(a.finishedOn, cx.today));
        after = k == null ? null : typesRate(cx, a.departmentId, ids, cx.start(k), cx.end(k));
      }
      return { key: a.key, no: b.nos[a.key], departmentName: v.departmentName, openedAt: rootOf(b, a).openedAt, finishedOn: a.finishedOn, outcome: a.status, early: !!a.closedEarly, before: before, after: after };
    });
    var both = items.filter(function (x) { return x.before != null && x.after != null; });
    return { from: since(cx, days), to: cx.today, items: items,
      avg: { before: both.length ? r1(mean(both.map(function (x) { return x.before; }))) : null, after: both.length ? r1(mean(both.map(function (x) { return x.after; }))) : null } };
  }
  function causes(b, days) {
    var ps = I.periodSum(b.cx, b.all, since(b.cx, days || CLOSED_DAYS), b.cx.today), total = ps.causes.reduce(function (s, c) { return s + c.n; }, 0);
    return { plans: ps.implemented, total: total, items: ps.causes.slice().sort(function (x, y) { return y.n - x.n; }).map(function (c) {
      return { id: c.id, label: c.label, count: c.n, share: C.pct(c.n, total) };
    }) };
  }


  function p2Of(cx, a) {
    if (a.p2) return a.p2;
    if (a.status !== 'check' || !a.p1) return null;
    var from = S.addDays(a.p1.end, 1);
    return { from: from, to: null, days: 0, done: false, end: I.projectDay(cx, a.departmentId, from, I.OBS), est: true, list: [] };
  }
  function endDay(cx, a) {
    if (a.status === 'not_needed') return maxDay(a.weekEnd, a.finishedOn);
    if (a.implementedAt && a.p1) {
      if (a.status === 'not_helped' && a.relapseStage === 1) return a.p1.to;
      var p2 = p2Of(cx, a);
      return p2 ? (p2.done ? p2.to : p2.end) : a.p1.end;
    }
    return cx.end(cx.L + 1);
  }
  function endWeek(cx, a) { return Math.min(cx.L + 1, Math.max(a.n, cx.of(endDay(cx, a)))); }
  function week2Of(a) { return a.r2n != null ? a.r2n : a.status === 'check' && a.r1n != null ? a.r1n + 1 : null; }
  function stageOf(cx, a, n) {
    if (n === a.n) return 'open';
    if (!a.implementedAt || !a.p1) return null;
    var s = cx.start(n), e = cx.end(n), over = function (p) {
      if (!p) return 0;
      var f = maxDay(p.from, s), t = minDay(p.done ? p.to : p.end, e);
      return f > t ? 0 : Math.round((S.parseDay(t) - S.parseDay(f)) / 864e5) + 1;
    };
    var p2 = a.status === 'not_helped' && a.relapseStage === 1 ? null : p2Of(cx, a), k1 = over(a.p1), k2 = over(p2);
    var k0 = over({ from: a.openedAt, to: a.implementedAt, done: true });   // v2.1: дні без плану (план пишуть) у цьому тижні
    if (!k0 && !k1 && !k2) return null;
    if (k0 > k1 && k0 > k2) return 'plan';
    return k2 >= k1 ? (a.closedEarly ? 'quiet' : 'week2') : 'week1';
  }

  function daily(cx, a, ids) {
    var dep = a.departmentId, to = endDay(cx, a), start = minDay(a.weekStart, I.baseStartOf(a)), from = maxDay(start, S.addDays(to, -DAILY_MAX)), days = [], stages = [], today = cx.today;
    for (var d = from, g = 0; d <= to && g < 400; d = S.addDays(d, 1), g++) {
      if (d > today) { days.push({ day: d, dept: null, types: null, future: true }); continue; }
      days.push({ day: d, dept: I.rangeRate(cx, dep, S.addDays(d, -6), d).rate, types: typesRate(cx, dep, ids, S.addDays(d, -6), d), future: false });
    }
    var add = function (kind, f, t) { f = maxDay(f, from); t = minDay(t, to); if (f <= t) stages.push({ from: f, to: t, kind: kind }); };
    var openEnd = openEndOf(cx, a), p2 = a.status === 'not_helped' && a.relapseStage === 1 ? null : p2Of(cx, a);
    add('before', from, S.addDays(a.openedAt, -1));
    if (a.early) { add('early', a.openedAt, minDay(openEnd, a.weekEnd)); add('open', S.addDays(a.weekEnd, 1), openEnd); } else add('open', a.openedAt, openEnd);
    var photo = null, obs = [], checks = [];
    if (a.implementedAt && a.p1) {
      if (a.extra) add('extra', a.extra.from, a.extra.to);
      add('week1', a.p1.from, a.p1.done ? a.p1.to : a.p1.end);
      if (p2) add(a.closedEarly ? 'quiet' : 'week2', p2.from, p2.done ? p2.to : p2.end);
      var bs = cx.range(dep, a.baseFrom, a.baseTo);
      photo = { from: a.baseFrom, to: a.baseTo, rate: a.typesBefore, pieces: I.sumOf(bs.byType, ids), checked: bs.checked };
      a.p1.list.forEach(function (x, i) { obs.push({ day: x, no: i + 1, period: 1 }); });
      if (p2) p2.list.forEach(function (x, i) { obs.push(a.closedEarly ? { day: x, no: i + 1, period: 'q' } : { day: x, no: 8 + i, period: 2 }); });
      var cur = !a.p1.done ? a.p1 : p2 && !p2.done ? p2 : null;
      if (cur && cur.from <= today && cx.byDay[today] && cx.day(dep, today).audits > 0) obs.push({ day: today, no: null, period: cur === a.p1 ? 1 : a.closedEarly ? 'q' : 2, running: true });
      checks.push({ day: a.p1.done ? a.p1.to : a.p1.end, kind: 'p1', done: a.p1.done, est: !a.p1.done });
      if (p2) checks.push({ day: p2.done ? p2.to : p2.end, kind: a.closedEarly ? 'quiet' : 'p2', done: p2.done, est: !p2.done });
    }
    return { days: days, openDay: a.openedAt, planDay: a.implementedAt || null, todayDay: today, stages: stages, photo: photo, obs: obs, checks: checks };
  }
  function resultWeeks(cx, a, ids) {
    if (!a.implementedAt || !a.p1) return [];
    var out = [], mk = function (no, kind, p, verdict) {
      var on = p.from <= cx.today, st = cx.range(a.departmentId, p.from, p.done ? p.to : cx.today), tp = I.sumOf(st.byType, ids);
      var status = p.done ? 'done' : on ? 'running' : 'future';
      out.push({ n: no, kind: kind, start: p.from, end: p.done ? p.to : p.end, estimated: !p.done, status: status, days: p.days, need: I.OBS,
        checked: on ? st.checked : null, deptRate: on ? C.pct(st.rejected, st.checked) : null, typesPieces: on ? tp : null,
        typesRate: on ? C.pct(tp, st.checked) : null, typesBefore: a.typesBefore != null ? a.typesBefore : null, verdict: status === 'done' ? verdict || null : null });
    };
    mk(1, 'p1', a.p1, a.week1Verdict);
    out[0].close = a.earlyClose ? Object.assign({ final: true }, a.earlyClose) : (function (c) { return c ? Object.assign({ final: false }, c) : null; })(closeSoFar(cx, a, ids));
    var p2 = a.status === 'not_helped' && a.relapseStage === 1 ? null : p2Of(cx, a);
    if (p2) mk(2, a.closedEarly ? 'quiet' : 'p2', p2, a.closedEarly ? a.quietVerdict : a.week2Verdict);
    return out;
  }
  function weekRows(cx, a, ids) {
    var last = endWeek(cx, a), out = [];
    for (var n = last - COMP_WEEKS + 1; n <= last; n++) {
      var w = cx.wk(a.departmentId, n), st = cx.range(a.departmentId, w.start, w.end), tp = I.sumOf(st.byType, ids);
      out.push({ n: n, start: w.start, end: w.end, checked: w.checked, rejected: w.rejected, rate: w.rate, typesPieces: tp, typesRate: C.pct(tp, w.checked),
        otherRate: C.pct(w.rejected - tp, w.checked), current: n === cx.L + 1, stage: stageOf(cx, a, n) });
    }
    return out;
  }
  function earlyDays(cx, a) {
    if (!a.early) return null;
    var c = 0, r = 0, days = [];
    for (var d = a.weekStart, g = 0; d <= minDay(a.openedAt, cx.today) && g < 14; d = S.addDays(d, 1), g++) {
      var x = cx.byDay[d] ? cx.day(a.departmentId, d) : { checked: 0, rejected: 0 };
      c += x.checked; r += x.rejected;
      var rate = C.pct(r, c), bl = S.blur(rate, null, c, null, cx.T);
      days.push({ day: d, checked: c, rate: rate, lo: bl ? bl.lo : null, hi: bl ? bl.hi : null, opened: d === a.openedAt });
    }
    return { days: days };
  }
  function pageKd(b, a, canWrite) {
    var cx = b.cx, v = I.view(cx, a), ids = I.itemIds(cx, a), open = PHASE_OF[a.status] === 'open';
    var sp = startSpan(cx, a), st0 = startRange(cx, a), cw = cx.wk(a.departmentId, cx.L + 1), cur = cx.range(a.departmentId, cw.start, cw.end);
    var run = a.p1 && !a.p1.done && a.p1.from <= cx.today ? a.p1 : a.p2 && !a.p2.done && a.p2.from <= cx.today ? a.p2 : null;
    if (run) { cur = cx.range(a.departmentId, run.from, cx.today); cw = { checked: cur.checked }; }
    var rows = weekRows(cx, a, ids);
    return Object.assign(v, { no: b.nos[a.key], phaseUi: phaseUi(a), canNotNeeded: canWrite && open, canPlan: canWrite && open,
      startFrom: sp.from, startTo: sp.to, startPieces: I.sumOf(st0.byType, ids), startChecked: st0.checked,
      daily: daily(cx, a, ids), weeks: resultWeeks(cx, a, ids),
      composition: rows.map(function (x) { return { start: x.start, end: x.end, rate: x.rate, typesRate: x.typesRate, current: x.current, stage: x.stage }; }),
      types: v.items.map(function (it) {
        return { defectTypeId: it.defectTypeId, name: it.name, level: it.level, cause: it.cause, causeLabel: it.causeLabel, causeNote: it.causeNote,
          start: C.pct(st0.byType[it.defectTypeId] || 0, st0.checked), now: C.pct(cur.byType[it.defectTypeId] || 0, cw.checked) };
      }),
      early: earlyDays(cx, a),
      repeatedBy: (function () { var x = b.all.filter(function (y) { return y.repeatOf === a.key; })[0]; return x ? { key: x.key, openedAt: x.openedAt } : null; })(),
      obsDay: obsDay(a), inExtra: inExtra(cx, a),
      numbers: rows.map(function (x) { return { start: x.start, end: x.end, checked: x.checked, rate: x.rate, rejected: x.rejected, typesRate: x.typesRate, typesPieces: x.typesPieces, otherRate: x.otherRate, stage: x.stage }; }) });
  }

  P.demoKd.numbers = function (x, locId) {
    var cx = x && typeof x.kds === 'function' ? x : x && x.ix && has(x.ix.loc, locId) ? I.makeCx(x, x.ix.loc[locId]) : null;
    return cx ? numberCx(cx) : {};
  };

  P.demoKd.board = { prep: prep, numberCx: numberCx, rootOf: rootOf, phaseUi: phaseUi, obsWeek: obsWeek, activesOf: activesOf,
    counts: counts, timeline: timeline, segsOf: segsOf, markOf: markOf, startSpan: startSpan, startRange: startRange,
    typesRate: typesRate, closedSince: closedSince, efficiency: efficiency, causes: causes, week2Of: week2Of, pageKd: pageKd,
    CLOSED: CLOSED, CLOSED_DAYS: CLOSED_DAYS,
    obsDay: obsDay, inExtra: inExtra, marksOf: marksOf, p2Of: p2Of, endDay: endDay, quietList: quietList, closeSoFar: closeSoFar };

  P.demoApis.push({
    srKdBoard: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var b = prep(env, r.loc), cx = b.cx;
      return { ok: true, today: cx.today, threshold: cx.T, canWrite: S.canManage(me), week: { start: cx.start(cx.L), end: cx.end(cx.L) },
        tiles: tiles(b), counts: counts(b), timeline: timeline(b), weekTable: weekTable(b), queue: queue(b), upcoming: upcoming(b),
        recentClosed: closedSince(b, RECENT_DAYS).map(function (a) { return { key: a.key, no: b.nos[a.key], departmentName: cx.env.ix.dep[a.departmentId].name, outcome: a.status, early: !!a.closedEarly, day: a.finishedOn }; }),
        work: work(b), efficiency: efficiency(b), causes: causes(b) };
    },

    srKdPage: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var b = prep(env, r.loc), cx = b.cx, dep = I.depOf(cx, p.departmentId);
      if (!dep) return C.fail('not_found', 'Відділ не знайдено. Поверніться до всіх відділів.');
      var list = cx.kds(dep.id), act = activesOf(b, dep.id), a, canWrite = S.canManage(me);
      if (p.key != null && p.key !== '') {
        a = typeof p.key === 'string' ? list.filter(function (x) { return x.key === p.key; })[0] : null;
        if (!a) return C.fail('not_found', 'Такої коригуючої дії у відділі немає. Оновіть сторінку.');
      } else {
        a = act[0] || list.filter(function (x) { return PHASE_OF[x.status] === 'final'; }).sort(function (x, y) {
          return x.finishedOn < y.finishedOn ? -1 : x.finishedOn > y.finishedOn ? 1 : x.openedAt < y.openedAt ? -1 : x.openedAt > y.openedAt ? 1 : 0;
        }).pop() || null;
      }
      return { ok: true, today: cx.today, threshold: cx.T, canWrite: canWrite, dept: { id: dep.id, name: dep.name }, tiles: tiles(b), counts: counts(b),
        actives: act.map(function (x) { return { key: x.key, id: x.id || null, no: b.nos[x.key], phase: phaseUi(x), week: obsWeek(x), early: !!x.early, obsDay: obsDay(x), extra: inExtra(cx, x) }; }),
        quiet: quietList(b, dep.id), kd: a ? pageKd(b, a, canWrite) : null, pareto: act.length ? null : paretoOf(cx, dep.id) };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
