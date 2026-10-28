(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  if (!(P.demoKd && P.demoKd.board) && typeof module !== 'undefined' && typeof require === 'function') require('./senior-kd-board.js');
  var C = P.demoCommon, S = P.demoSenior, I = P.demoKd.internal, B = P.demoKd.board, PHASE_OF = I.PHASE_OF;
  var AFTER_WEEKS = 8, UNCOVERED_WEEKS = 4, LOAD_WEEKS = 13, UNCOVERED_TOP = 8;

  function has(o, k) { return typeof k === 'string' && o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function mean(list) { return list.reduce(function (s, v) { return s + v; }, 0) / list.length; }
  function daysBetween(a, b) { return Math.round((S.parseDay(b) - S.parseDay(a)) / 86400000); }
  function inPer(per, d) { return !!d && d >= per.from && d <= per.to; }
  function delta(after, before) { return after != null && before != null ? r1(after - before) : null; }
  function depName(b, a) { var d = b.cx.env.ix.dep[a.departmentId]; return d ? d.name : ''; }
  function closedIn(b, per) {
    return b.all.filter(function (a) { return B.CLOSED[a.status] && inPer(per, a.finishedOn); })
      .sort(function (x, y) { return x.finishedOn < y.finishedOn ? 1 : x.finishedOn > y.finishedOn ? -1 : 0; });
  }
  function spansSum(cx, depId, list) {
    var o = { checked: 0, rejected: 0, byType: {} };
    list.forEach(function (p) {
      var st = cx.range(depId, p.from, p.to);
      o.checked += st.checked; o.rejected += st.rejected;
      Object.keys(st.byType).forEach(function (t) { o.byType[t] = (o.byType[t] || 0) + st.byType[t]; });
    });
    return o;
  }
  function p2Done(a) { return !!(a.p2 && a.p2.done && !a.closedEarly); }
  function spanDays(p) { return p && p.from && p.to ? daysBetween(p.from, p.to) + 1 : 0; }
  function fakeMult(depId) { var s = 0; for (var i = 0; i < depId.length; i++) s += depId.charCodeAt(i); return s % 5 + 7; }


  function diffPlate(b, per) {
    var cx = b.cx;
    return b.all.filter(function (a) { return a.implementedAt && /^(helped|held_types|not_helped)$/.test(a.status) && inPer(per, a.finishedOn); })
      .sort(function (x, y) { return x.finishedOn < y.finishedOn ? 1 : x.finishedOn > y.finishedOn ? -1 : 0; })
      .map(function (a) {
        var v = I.view(cx, a), ids = I.itemIds(cx, a), dep = a.departmentId, useW2 = p2Done(a);
        var p = useW2 ? a.p2 : a.p1, base = cx.range(dep, a.baseFrom, a.baseTo);
        var aw = p && p.to ? cx.range(dep, p.from, p.to) : { checked: 0, rejected: 0, byType: {} };
        var types = { before: v.typesBefore, after: useW2 ? v.typesAfter2 : v.typesAfter };
        var other = { before: C.pct(base.rejected - I.sumOf(base.byType, ids), base.checked), after: C.pct(aw.rejected - I.sumOf(aw.byType, ids), aw.checked) };
        var dt = delta(types.after, types.before), dq = delta(other.after, other.before);
        return { key: a.key, no: b.nos[a.key], departmentName: v.departmentName, openedAt: B.rootOf(b, a).openedAt, finishedOn: a.finishedOn, outcome: a.status,
          types: types, other: other, diff: dt != null && dq != null ? r1(dt - dq) : null };
      });
  }
  function precisionPlate(b, per) {
    var cx = b.cx, out = [];
    b.all.filter(function (a) { return a.implementedAt && a.p1 && (inPer(per, a.implementedAt) || PHASE_OF[a.status] === 'observe'); }).forEach(function (a) {
      var ids = I.itemIds(cx, a), dep = a.departmentId, list = [[1, a.p1]];
      if (a.p2 && !a.closedEarly) list.push([2, a.p2]);
      list.forEach(function (x) {
        var p = x[1], start = p.from, end = p.done ? p.to : cx.today;
        if (start > cx.today) return;
        var st = cx.range(dep, start, end), rate = B.typesRate(cx, dep, ids, start, end);
        var bl = S.blur(rate, null, st.checked, null, cx.T), tb = a.typesBefore != null ? a.typesBefore : null, ch = delta(rate, tb);
        out.push({ key: a.key, no: b.nos[a.key], departmentName: depName(b, a), n: x[0], start: start, end: end, status: p.done ? 'done' : 'running', days: p.days,
          checked: st.checked, typesRate: rate, margin: bl ? bl.margin : null, lo: bl ? bl.lo : null, hi: bl ? bl.hi : null,
          typesBefore: tb, change: ch, bigger: ch != null && bl ? Math.abs(ch) > bl.margin : null });
      });
    });
    return out.sort(function (x, y) { return x.start < y.start ? 1 : x.start > y.start ? -1 : x.key < y.key ? -1 : 1; });
  }
  function afterPlate(b, per, eff) {
    var cx = b.cx, by = {};
    eff.items.forEach(function (x) { by[x.key] = x; });
    return closedIn(b, per).map(function (a) {
      var ids = I.itemIds(cx, a), n0 = cx.of(a.finishedOn), weekly = [], e = by[a.key] || { before: null, after: null };
      for (var k = 0; k < AFTER_WEEKS; k++) {
        var n = n0 + k;
        weekly.push(n <= cx.L ? B.typesRate(cx, a.departmentId, ids, cx.start(n), cx.end(n)) : null);
      }
      return { key: a.key, no: b.nos[a.key], departmentName: depName(b, a), finishedOn: a.finishedOn, outcome: a.status, before: e.before, atClose: e.after,
        weekly: weekly, plus4: weekly[3], plus8: weekly[7] };
    });
  }
  function piecesPlate(b, per) {
    var cx = b.cx, tot = { lessChecked: 0, lessProduced: 0 };
    var items = closedIn(b, per).filter(function (a) { return a.implementedAt && (a.status === 'helped' || a.status === 'held_types'); }).map(function (a) {
      var ids = I.itemIds(cx, a), ps = [a.p1, p2Done(a) ? a.p2 : null].filter(function (p) { return p && p.to; }), st = spansSum(cx, a.departmentId, ps);
      var before = a.typesBefore != null ? a.typesBefore : null, after = C.pct(I.sumOf(st.byType, ids), st.checked), produced = st.checked * fakeMult(a.departmentId);
      var ok = before != null && after != null;
      var lc = ok ? Math.round((before - after) / 100 * st.checked) : null, lp = ok ? Math.round((before - after) / 100 * produced) : null;
      if (ok) { tot.lessChecked += lc; tot.lessProduced += lp; }
      return { key: a.key, no: b.nos[a.key], departmentName: depName(b, a), before: before, after: after, checked: st.checked, lessChecked: lc,
        produced: produced, lessProduced: lp };
    });
    return { producedFake: true, items: items, total: tot };
  }


  function uncoveredPlate(b) {
    var cx = b.cx, ix = cx.env.ix, from = cx.start(cx.L - UNCOVERED_WEEKS + 1), to = cx.end(cx.L), total = 0, covered = 0, pairs = [];
    cx.deps.forEach(function (d) {
      var st = cx.range(d.id, from, to), act = B.activesOf(b, d.id), inAct = {};
      act.forEach(function (a) { I.itemIds(cx, a).forEach(function (t) { if (!has(inAct, t)) inAct[t] = a; }); });
      total += st.rejected;
      Object.keys(st.byType).forEach(function (t) {
        var pcs = st.byType[t];
        if (!(pcs > 0)) return;
        if (has(inAct, t)) covered += pcs;
        if (!has(ix.def, t)) return;
        pairs.push({ defectTypeId: t, name: ix.def[t].name, level: ix.def[t].level || 'fix', departmentId: d.id, departmentName: d.name, pieces: pcs,
          inAction: has(inAct, t) ? { key: inAct[t].key, no: b.nos[inAct[t].key] } : null });
      });
    });
    pairs.sort(function (x, y) { return y.pieces - x.pieces || (x.name < y.name ? -1 : x.name > y.name ? 1 : 0); });
    return { from: from, to: to, totalPieces: total, coveredPieces: covered, coveredShare: C.pct(covered, total), items: pairs.slice(0, UNCOVERED_TOP) };
  }
  function loadPlate(b) {
    var cx = b.cx, segs = b.all.map(function (a) { return B.segsOf(cx, a); }), weeks = [];
    var KIND = { open: 'open', early: 'open', analysis: 'open', relapse: 'relapse', extra: 'observe', week1: 'observe', week2: 'observe' };   // v1.3: аналіз — без плану
    for (var n = cx.L + 2 - LOAD_WEEKS; n <= cx.L + 1; n++) {
      var s = cx.start(n), e = cx.end(n), w = { start: s, end: e, current: n > cx.L, open: 0, relapse: 0, observe: 0, total: 0 };
      segs.forEach(function (list) {
        var last = null;
        list.forEach(function (sg) { if (has(KIND, sg.kind) && sg.from <= e && sg.to >= s && (!last || sg.from >= last.from)) last = sg; });
        if (last) { w[KIND[last.kind]]++; w.total++; }
      });
      weeks.push(w);
    }
    var mx = weeks.reduce(function (m, w) { return Math.max(m, w.total); }, 0), top = mx ? weeks.filter(function (w) { return w.total === mx; }) : [];
    var lastTop = top[top.length - 1];
    var off = function (u) { return typeof P.demoAccessOff === 'function' && cx.env.storage ? P.demoAccessOff(cx.env.storage, u.id) : false; };
    var seniors = (cx.env.db.users || []).filter(function (u) { return u.role === 'senior_auditor' && u.active !== false && !off(u) && (u.locationIds || []).indexOf(cx.loc.id) >= 0; }).length;
    return { seniors: seniors, weeks: weeks, max: { total: mx, weeks: top.map(function (w) { return w.start; }), needPlan: lastTop ? lastTop.open + lastTop.relapse : 0 } };
  }
  function durationPlate(b, per) {
    var items = closedIn(b, per).map(function (a) {
      var plan = !!a.implementedAt && !!a.p1;
      var o = { key: a.key, no: b.nos[a.key], departmentName: depName(b, a), outcome: a.status,
        noPlan: plan ? daysBetween(a.openedAt, a.implementedAt) : Math.max(0, daysBetween(a.openedAt, a.finishedOn)),
        wait: plan && a.extra ? spanDays(a.extra) : 0,
        week1: plan ? spanDays(a.p1) : 0, week2: plan && p2Done(a) ? spanDays(a.p2) : 0 };
      o.total = o.noPlan + o.wait + o.week1 + o.week2;
      o.withPlan = plan;
      return o;
    });
    var wp = items.filter(function (x) { return x.withPlan; }), avg = { n: wp.length };
    ['noPlan', 'wait', 'week1', 'week2', 'total'].forEach(function (k) { avg[k] = wp.length ? r1(mean(wp.map(function (x) { return x[k]; }))) : null; });
    items.forEach(function (x) { delete x.withPlan; });
    return { items: items, avg: avg };
  }
  function causeLabels() {
    var api = P.demoApis.filter(function (x) { return x && typeof x.srKdCauses === 'function'; })[0], out = {};
    ((api && api.srKdCauses().causes) || []).forEach(function (c) { out[c.id] = c.label; });
    return out;
  }
  function causeIn(v, t, labels) {
    if (!v.implementedAt) return null;
    var it = v.items.filter(function (x) { return x.defectTypeId === t; })[0];
    if (!it) return null;
    var c = v.causePerItem ? it.cause : (v.causes || [])[0];
    return c && has(labels, c) ? c : null;
  }
  function planText(s) { return String(s || '').trim().toLowerCase(); }
  function repeatsPlate(b, per) {
    var cx = b.cx, labels = causeLabels();
    return b.all.filter(function (a) { return a.repeatOf && has(b.byKey, a.repeatOf) && inPer(per, a.openedAt); })
      .sort(function (x, y) { return x.openedAt < y.openedAt ? 1 : x.openedAt > y.openedAt ? -1 : 0; })
      .map(function (a) {
        var o = b.byKey[a.repeatOf], vo = I.view(cx, o), va = I.view(cx, a), ids = I.itemIds(cx, o).slice();
        I.itemIds(cx, a).forEach(function (t) { if (ids.indexOf(t) < 0) ids.push(t); });
        var samePlan = !!a.implementedAt && planText(vo.plan) === planText(va.plan);
        return { key: a.key, no: b.nos[a.key], departmentName: va.departmentName, relapseDay: a.openedAt,
          original: { key: o.key, implementedAt: o.implementedAt || null, plan: vo.plan || null },
          repeat: { implementedAt: a.implementedAt || null, plan: a.implementedAt ? va.plan || '' : null },
          types: ids.map(function (t) {
            var def = cx.env.ix.def[t], c1 = causeIn(vo, t, labels), c2 = causeIn(va, t, labels);
            return { defectTypeId: t, name: def.name, cause1: c1, cause1Label: c1 ? labels[c1] : null, cause2: c2, cause2Label: c2 ? labels[c2] : null,
              verdict: !a.implementedAt ? 'no_plan' : c1 && c1 === c2 && samePlan ? 'same' : 'changed' };
          }) };
      });
  }
  function earlyPlate(b, per) {
    var cx = b.cx, sum = { done: 0, over: 0, notOver: 0 };
    var items = b.all.filter(function (a) { return a.early && inPer(per, a.openedAt); })
      .sort(function (x, y) { return x.openedAt < y.openedAt ? 1 : x.openedAt > y.openedAt ? -1 : 0; })
      .map(function (a) {
        var v = I.view(cx, a), sp = v.earlySplit ? v.earlySplit.before : { checked: 0, rate: null };
        var over = v.weekDone && v.weekRate != null ? v.weekRate > cx.T : null;
        if (v.weekDone) sum.done++;
        if (over === true) sum.over++; else if (over === false) sum.notOver++;
        return { key: a.key, no: b.nos[a.key], departmentName: v.departmentName, openedAt: a.openedAt, checkedBefore: sp.checked, rateBefore: sp.rate,
          weekRate: v.weekRate, weekDone: v.weekDone, over: over };
      });
    return { items: items, summary: sum };
  }

  function plates(b, per, eff) {
    eff = eff || B.efficiency(b, per.days);
    return { diff: diffPlate(b, per), precision: precisionPlate(b, per), after: afterPlate(b, per, eff), pieces: piecesPlate(b, per),
      uncovered: uncoveredPlate(b), load: loadPlate(b), duration: durationPlate(b, per), repeats: repeatsPlate(b, per), early: earlyPlate(b, per) };
  }

  P.demoMgrKd = { plates: plates, closedIn: closedIn, inPer: inPer, causeLabels: causeLabels, fakeMult: fakeMult };
})(typeof window !== 'undefined' ? window : globalThis);
