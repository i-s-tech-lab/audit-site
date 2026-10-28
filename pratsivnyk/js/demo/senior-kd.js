(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  if (!P.demoKdRules && typeof module !== 'undefined' && typeof require === 'function') require('./senior-kd-rules.js');
  var RU = P.demoKdRules;
  var KD = S.KD, KEY = 'demo:sr:kd3:actions', KD2_KEY = 'demo:sr:kd2:actions', OLD_KEY = 'demo:sr:kd:actions';
  var DEPT_BARS = 12, MINI_BARS = 7, MAX_BACK = 26, PERIOD_LIST = 16, ROUTE_BACK = 13;
  var OBS = 7;
  var GEN = { threshold: 5, wd: 5, early: 500, pareto: 70 };
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  function isDay(s) {
    if (typeof s !== 'string' || !DAY_RE.test(s)) return false;
    var y = +s.slice(0, 4), m = +s.slice(5, 7), d = +s.slice(8, 10);
    return m >= 1 && m <= 12 && d >= 1 && d <= new Date(Date.UTC(y, m, 0)).getUTCDate();
  }

  var CAUSES = [
    { id: 'skill', label: 'Не знав / не вміє' },
    { id: 'discipline', label: 'Знав, але не зробив' },
    { id: 'tool', label: 'Інструмент чи оснастка' },
    { id: 'material', label: 'Матеріал' },
    { id: 'organization', label: 'Організація роботи' },
    { id: 'other', label: 'Інше' }
  ];
  var CAUSE_IX = Object.create(null);
  CAUSES.forEach(function (c) { CAUSE_IX[c.id] = c; });
  function isPlain(o) { return o != null && typeof o === 'object' && !Array.isArray(o); }
  function perItem(a) { return isPlain(a.itemCauses) && Object.keys(a.itemCauses).length > 0; }
  function causeOf(a, t) { return perItem(a) && has(a.itemCauses, t) && has(CAUSE_IX, a.itemCauses[t]) ? a.itemCauses[t] : null; }
  function deriveCauses(ids, itemCauses, pieces) {
    var out = [];
    ids.map(function (t, i) { return { c: has(itemCauses, t) ? itemCauses[t] : null, p: (pieces && pieces[t]) || 0, i: i }; })
      .filter(function (x) { return has(CAUSE_IX, x.c); }).sort(function (a, b) { return b.p - a.p || a.i - b.i; })
      .forEach(function (x) { if (out.indexOf(x.c) < 0) out.push(x.c); });
    return out;
  }
  var STATUS_LABELS = { pre: 'відкрито достроково · тиждень ще йде',
    'new': 'понад норму, не почато', check: 'впроваджено · дні 1–7 спостереження', hold: 'під наглядом · дні 8–14',
    helped: 'закрито: тримається', held_types: 'закрито: її види браку нижче, ніж до дії', not_helped: 'рецидив',
    not_needed: 'дія не потрібна', none: 'дій не було', self_closed: 'закрито достроково без участі старшого' };
  var CLOSED_EARLY_LABEL = 'закрито достроково: брак видів дії впав щонайменше вдвічі';
  var STATE_OF = { pre: 'pre', 'new': 'over', check: 'watch', hold: 'hold', helped: 'done', held_types: 'part',
    not_helped: 'relapse', not_needed: 'skip', self_closed: 'alone' };
  var PHASE_OF = { pre: 'open', 'new': 'open', check: 'observe', hold: 'observe', helped: 'final', held_types: 'final',
    not_helped: 'final', not_needed: 'final', self_closed: 'final' };
  var NOTE_MAX = 300;
  var ONGOING = { pre: 1, over: 1, watch: 1, hold: 1 };
  var NO_END = 1e9;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function has(o, k) { return typeof k === 'string' && o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function r1(x) { return Math.round(x * 10) / 10; }
  function mean(list) { return list.length ? list.reduce(function (s, v) { return s + v; }, 0) / list.length : 0; }
  function daysBetween(a, b) { return Math.round((S.parseDay(b) - S.parseDay(a)) / 86400000); }

  function kdStart(env) {
    if (!env || env.real !== true) return { real: false, from: null, min: null };
    var v = env.db && env.db.settings ? env.db.settings.kdFrom : null;
    return isDay(v) ? { real: true, from: v, min: v } : { real: true, from: null, min: '9999-12-31' };
  }
  function liveRules() { return { threshold: KD.THRESHOLD, wd: KD.REVIEW_DAY, early: KD.EARLY_MIN, pareto: KD.PARETO }; }
  function rulesOut(R) {
    return { threshold: R.threshold, early: R.early, pareto: R.pareto, cycleDays: KD.CYCLE_DAYS, reviewWeekday: R.wd, reviewWeekdayName: S.WEEKDAYS[R.wd - 1],
      earlyRates: RU.earlyRates(R.threshold, R.early), paretoOrder: RU.LEVEL_ORDER.slice() };
  }


  function makeCx(env, loc, R, stored) {
    R = R || liveRules();
    var today = env.day(), byDay = Object.create(null), first = null;
    env.audits().forEach(function (a) {
      if (a.locationId !== loc.id) return;
      (byDay[a.day] = byDay[a.day] || []).push(a);
      if (!first || a.day < first) first = a.day;
    });
    var cx = { env: env, loc: loc, R: R, T: R.threshold, today: today, byDay: byDay,
      deps: env.db.departments.filter(function (d) { return d.locationId === loc.id; }),
      start: function (n) { return S.periodStart(n, R.wd); }, end: function (n) { return S.periodEnd(n, R.wd); },
      of: function (day) { return S.periodOf(day, R.wd); } };
    cx.L = cx.of(today) - 1;
    cx.n0 = first ? Math.max(cx.of(first), cx.L - MAX_BACK) : cx.L;
    cx.kdMin = kdStart(env).min;
    cx.canOpen = function (d) { return !cx.kdMin || (!!d && d >= cx.kdMin); };
    cx.stored = (stored || env.db.kdActions || []).filter(function (a) {
      return a && a.locationId === loc.id && has(env.ix.dep, a.departmentId) && isDay(a.weekStart) && isDay(a.weekEnd);
    });
    var dmemo = Object.create(null), rmemo = Object.create(null), kmemo = Object.create(null);
    cx.day = function (depId, day) {
      var k = depId + '|' + day;
      if (!dmemo[k]) {
        var list = byDay[day] || [], st = S.deptStats(env, list, depId);
        st.audits = list.filter(function (a) { return a.departmentId === depId; }).length;
        dmemo[k] = st;
      }
      return dmemo[k];
    };
    cx.range = function (depId, from, to) {
      var k = depId + '|' + from + '|' + to;
      if (rmemo[k]) return rmemo[k];
      var o = { checked: 0, rejected: 0, audits: 0, byType: {}, byLevel: { fix: 0, repair: 0, scrap: 0 } };
      for (var d = from, guard = 0; d <= to && guard < 400; d = S.addDays(d, 1), guard++) {
        if (!byDay[d]) continue;
        var x = cx.day(depId, d);
        o.checked += x.checked; o.rejected += x.rejected; o.audits += x.audits;
        Object.keys(x.byType).forEach(function (t) { o.byType[t] = (o.byType[t] || 0) + x.byType[t]; });
        o.byLevel.fix += x.byLevel.fix; o.byLevel.repair += x.byLevel.repair; o.byLevel.scrap += x.byLevel.scrap;
      }
      return (rmemo[k] = o);
    };
    cx.wk = function (depId, n) {
      var start = cx.start(n), end = cx.end(n), st = cx.range(depId, start, end), cur = n > cx.L;
      var rate = C.pct(st.rejected, st.checked);
      return { n: n, start: start, end: end, current: n === cx.L + 1, future: start > today, days: KD.CYCLE_DAYS,
        daysDone: cur ? Math.max(0, Math.min(KD.CYCLE_DAYS, daysBetween(start, today) + 1)) : KD.CYCLE_DAYS,
        audits: st.audits, checked: st.checked, rejected: st.rejected, rate: rate,
        levels: { fix: st.byLevel.fix, repair: st.byLevel.repair, scrap: st.byLevel.scrap }, over: rate != null && rate > R.threshold };
    };
    cx.earlyDay = function (depId, n, list) {
      var start = cx.start(n), end = cx.end(n), c = 0, r = 0;
      for (var d = start; d < end && d < today; d = S.addDays(d, 1)) {
        if (!byDay[d]) continue;
        var x = cx.day(depId, d); c += x.checked; r += x.rejected;
        if (cx.canOpen(d) && RU.earlyOk(c, r, R.threshold, R.early) && !list.some(function (a) { return activeAt(a, d); })) return d;
      }
      return null;
    };
    cx.nextData = function (depId, n) {
      for (var k = n; k <= cx.L; k++) if (cx.range(depId, cx.start(k), cx.end(k)).checked > 0) return k;
      return null;
    };
    cx.kds = function (depId, decide) {
      if (!decide && kmemo[depId]) return kmemo[depId];
      var at = Object.create(null), list = [], from = cx.n0;
      cx.stored.forEach(function (a) { if (a.departmentId !== depId) return; var n = cx.of(a.weekStart); at[n] = a; if (n < from) from = n; });
      for (var n = Math.max(from, cx.L - 60); n <= cx.L + 1; n++) {
        var rec = at[n] || null, c, v = null;
        if (!rec) {
          var rl = relapseIn(cx, list, n), day = null;
          if (rl) {
            c = ctxAt(cx, list, n);
            if (!c.cover && cx.canOpen(rl.open) && paretoIds(cx.env, cx.range(depId, rl.from, rl.day).byType, R.pareto, busyTypes(list, { key: null }, rl.open)).length) {
              v = fresh(cx, depId, n, rl.open, false, c); v.onRelapse = true; v.baseStart = rl.from; v.repeatOf = rl.a.key;   // v4.1: саме ця дія
            }
          }
          if (!v) day = cx.earlyDay(depId, n, list);
          if (day) v = fresh(cx, depId, n, day, true, quietRep(list, day, ctxEarly(list, day)));
          else if (!v && n <= cx.L && cx.canOpen(cx.start(n + 1)) && cx.wk(depId, n).over) {
            c = ctxAt(cx, list, n);
            var wt = cx.range(depId, cx.start(n), cx.end(n)).byType;
            if (!c.cover && !hotObs(cx, list, n) && paretoIds(cx.env, wt, R.pareto, busyTypes(list, { key: null }, cx.start(n + 1))).length) {
              v = fresh(cx, depId, n, cx.start(n + 1), false, quietRep(list, cx.start(n + 1), c));
            }
          }
          if (!v) continue;
          rec = decide ? decide(v, cx, list) : null;
          if (!rec) { list.push(evalAction(cx, v, list)); continue; }
          rec = Object.assign(clone(rec), { repeatOf: v.repeatOf, parallelWith: v.parallelWith });
        } else {
          c = ctxAt(cx, list, n);
          if (c.cover && !c.cover.id && PHASE_OF[c.cover.status] === 'open') list.splice(list.indexOf(c.cover), 1);
          if (rec.early && isDay(rec.openedAt)) c = ctxEarly(list, rec.openedAt);
          if (isDay(rec.openedAt)) c = quietRep(list, rec.openedAt, c);   // v4.0: відкрита в тихий нагляд — повторна
          rec = Object.assign(clone(rec), { repeatOf: c.repeatOf, parallelWith: c.parallelWith });
        }
        list.push(evalAction(cx, rec, list));
      }
      if (!decide) kmemo[depId] = list;
      return list;
    };
    cx.all = function () { return cx.deps.reduce(function (out, d) { return out.concat(cx.kds(d.id)); }, []); };
    cx.lmemo = Object.create(null);   // живі списки пунктів (live) за ключем КД
    return cx;
  }

  function fresh(cx, depId, n, day, early, c) {
    return { id: null, status: 'new', locationId: cx.loc.id, departmentId: depId, n: n, weekStart: cx.start(n), weekEnd: cx.end(n),
      key: depId + '|' + cx.start(n), openedAt: day, early: early, repeatOf: c.repeatOf, parallelWith: c.parallelWith };
  }
  function activeAt(a, d) { return a.openedAt <= d && !(a.finishedOn && a.finishedOn <= d); }
  function phaseAt(cx, a, m) {
    if (m < a.n) return null;
    if (m <= a.coverEnd) return 'cover';
    if (!a.implementedAt) return 'final';
    if (a.relapseN === m) return 'relapse';
    if (a.finishedOn && a.finishedOn <= cx.start(m + 1)) return 'final';
    return 'observe';
  }
  function ctxAt(cx, list, m) {
    var o = { cover: null, repeatOf: null, parallelWith: [] };
    list.forEach(function (a) {
      var ph = phaseAt(cx, a, m);
      if (ph === 'cover') o.cover = a; else if (ph === 'relapse') o.repeatOf = a.key; else if (ph === 'observe') o.parallelWith.push(a.key);
    });
    return o;
  }
  function ctxEarly(list, d) {
    return { cover: null, repeatOf: null, parallelWith: list.filter(function (a) { return activeAt(a, d); }).map(function (a) { return a.key; }) };
  }
  function countOver(cx, depId, from, to) {
    var n = 0;
    for (var m = from; m <= Math.min(to, cx.L); m++) if (cx.wk(depId, m).over) n++;
    return n;
  }
  function knownIds(cx, list) { return Array.isArray(list) ? list.filter(function (t) { return has(cx.env.ix.def, t); }) : null; }
  function sumOf(byType, ids) { return ids.reduce(function (s, t) { return s + (byType[t] || 0); }, 0); }

  function evalAction(cx, rec, list) {
    var o = clone(rec), dep = rec.departmentId, T = cx.T;
    o.n = cx.of(rec.weekStart); o.key = dep + '|' + rec.weekStart; o.overWeeks = 0; o.coverEnd = NO_END;
    if (!isDay(o.openedAt)) o.openedAt = rec.early ? rec.weekStart : cx.start(o.n + 1);
    o.repeatOf = rec.repeatOf || null; o.parallelWith = Array.isArray(rec.parallelWith) ? rec.parallelWith : [];
    o.analysisAt = isDay(rec.analysisAt) ? [[rec.analysisAt, o.openedAt].sort()[1], cx.today].sort()[0] : null;
    if (o.analysisAt && isDay(rec.implementedAt) && rec.implementedAt < o.analysisAt) o.analysisAt = [rec.implementedAt, o.openedAt].sort()[1];
    var items = knownIds(cx, rec.items) || [], excl = knownIds(cx, rec.excludedTypes), fz;
    if (rec.notNeeded) {
      var at = isDay(rec.notNeeded.at) ? rec.notNeeded.at : o.openedAt;
      if (at > cx.today) at = cx.today;
      o.status = 'not_needed'; o.finishedOn = at;
      if (isPlain(o.notNeeded)) o.notNeeded.at = at;
      if (!items.length || !excl) { fz = freeze(cx, o, at < cx.today ? at : cx.today, list); if (!items.length) items = fz.ids; if (!excl) excl = fz.excl; }
      o.items = items; o.excludedTypes = excl;
      for (o.coverEnd = o.n; cx.start(o.coverEnd + 2) < at;) o.coverEnd++;   // тижні, розібрані до рішення «не потрібно»
      o.overWeeks = countOver(cx, dep, o.n, o.coverEnd);
      return o;
    }
    if (!isDay(rec.implementedAt)) {
      o.implementedAt = null;
      o.status = rec.early && o.n > cx.L ? 'pre' : 'new';
      o.items = null;   // живий список — live()
      var sc = o.analysisAt ? null : selfClose(cx, o, list);
      if (sc) {
        o.status = 'self_closed'; o.finishedOn = sc.day; o.selfClose = sc;
        o.items = sc.ids.slice(); o.excludedTypes = sc.excl.slice(); o.typesBefore = sc.typesBefore;
        for (o.coverEnd = o.n; cx.start(o.coverEnd + 2) < sc.day;) o.coverEnd++;   // тижні, розібрані до самозакриття (як у «не потрібно»)
        o.overWeeks = countOver(cx, dep, o.n, o.coverEnd);
        return o;
      }
      o.overWeeks = countOver(cx, dep, o.n, cx.L);
      return o;
    }
    var impl = o.implementedAt = [[rec.implementedAt, o.openedAt].sort()[1], cx.today].sort()[0];
    var k = cx.of(impl);
    if (cx.start(k) < impl) k++;   // розбори тижнів, у яких ще були дні до плану, «тримає» сама дія (П7)
    k = Math.max(k, o.n + 1);                    // …і щонайменше розбір її власного тижня
    o.coverEnd = k - 1;
    if (!items.length || !excl) { fz = freeze(cx, o, impl, list); if (!items.length) items = fz.ids; if (!excl) excl = fz.excl; }
    o.items = items; o.excludedTypes = excl;
    o.baseFrom = isDay(rec.baseStart) && rec.baseStart <= impl ? rec.baseStart : rec.weekStart; o.baseTo = impl;
    var base = cx.range(dep, o.baseFrom, o.baseTo);
    o.typesBefore = C.pct(sumOf(base.byType, items), base.checked);
    o.overWeeks = countOver(cx, dep, o.n, k - 1);
    var d1 = S.addDays(impl, 1), s1 = cx.start(o.n + 1);
    o.obsStart = d1 < s1 && !rec.onRelapse ? s1 : d1;
    o.extra = o.obsStart > d1 ? { from: d1, to: S.addDays(o.obsStart, -1) } : null;
    var ds = auditDays(cx, dep, o.obsStart, 2 * OBS);
    var verdict = function (p) {
      var st = cx.range(dep, p.from, p.to);
      return RU.weekVerdict(C.pct(st.rejected, st.checked), C.pct(sumOf(st.byType, items), st.checked), o.typesBefore, T);
    };
    var relapsed = function (stage, p) {
      o.status = 'not_helped'; o.relapseStage = stage; o.relapseDay = p.to; o.relapseFrom = p.from; o.relapseN = cx.of(p.to);
      o.finishedOn = S.addDays(p.to, 1);
      return o;
    };
    o.p1 = obsPeriod(cx, dep, o.obsStart, ds.slice(0, OBS));
    if (!o.p1.done) { o.status = 'check'; o.r1n = cx.of(o.p1.end); return o; }
    o.r1n = cx.of(o.p1.to); o.week1Verdict = verdict(o.p1);
    if (o.week1Verdict === 'relapse') return relapsed(1, o.p1);
    var next = S.addDays(o.p1.to, 1), p1s = cx.range(dep, o.p1.from, o.p1.to);
    o.earlyClose = RU.earlyClose({ checked: p1s.checked, rejected: p1s.rejected, typesPieces: sumOf(p1s.byType, items) }, o.typesBefore, T, cx.R.early);
    o.p2 = obsPeriod(cx, dep, next, ds.slice(OBS, 2 * OBS));
    o.r2n = cx.of(o.p2.end);
    if (o.earlyClose.ok) {
      o.status = 'helped'; o.closedEarly = true; o.finishedOn = next;
      if (o.p2.done) {
        o.quietVerdict = verdict(o.p2);
        if (o.quietVerdict === 'relapse') { o.quietReturned = true; o.relapseDay = o.p2.to; o.relapseFrom = o.p2.from; o.relapseN = cx.of(o.p2.to); }
      }
      return o;
    }
    o.holdSince = next;
    if (!o.p2.done) { o.status = 'hold'; return o; }
    o.finishedOn = S.addDays(o.p2.to, 1); o.week2Verdict = verdict(o.p2);
    if (o.week2Verdict === 'relapse') return relapsed(2, o.p2);
    o.status = RU.finalOf(o.week1Verdict, o.week2Verdict);
    return o;
  }

  function auditDays(cx, dep, from, max) {
    var out = [];
    for (var d = from, g = 0; d < cx.today && out.length < max && g < 400; d = S.addDays(d, 1), g++) if (cx.byDay[d] && cx.day(dep, d).audits > 0) out.push(d);
    return out;
  }
  function usualDays(cx, dep) {
    cx.umemo = cx.umemo || Object.create(null);
    if (cx.umemo[dep]) return cx.umemo[dep];
    var cnt = [0, 0, 0, 0, 0, 0, 0];
    for (var i = 1; i <= 28; i++) { var d = S.addDays(cx.today, -i); if (cx.byDay[d] && cx.day(dep, d).audits > 0) cnt[new Date(S.parseDay(d)).getUTCDay()]++; }
    var any = cnt.some(function (x) { return x >= 2; });
    return (cx.umemo[dep] = cnt.map(function (x) { return any ? x >= 2 : true; }));
  }
  function projectDay(cx, dep, from, left) {
    var u = usualDays(cx, dep), d = from > cx.today ? from : cx.today;
    for (var g = 0; g < 60; g++, d = S.addDays(d, 1)) if (u[new Date(S.parseDay(d)).getUTCDay()] && --left <= 0) return d;
    return d;
  }
  function obsPeriod(cx, dep, from, days) {
    var n = days.length, done = n >= OBS;
    return { from: from, to: n ? days[n - 1] : null, days: n, done: done, end: done ? days[n - 1] : projectDay(cx, dep, from, OBS - n), est: !done, list: days.slice() };
  }
  function relapseIn(cx, list, n) {
    for (var i = 0; i < list.length; i++) {
      var a = list[i], rn = a.relapseDay ? cx.of(a.relapseDay) : null;
      if (rn == null || rn > n || rn < n - 1 || list.some(function (x) { return x.repeatOf === a.key; })) continue;
      var open = S.addDays(a.relapseDay, 1);
      if (open < cx.start(n)) open = cx.start(n);
      return { a: a, day: a.relapseDay, from: a.relapseFrom, open: open };
    }
    return null;
  }
  function quietOf(list, day) {
    var hit = list.filter(function (a) { return a.closedEarly && a.finishedOn <= day && !(a.p2 && a.p2.done && day > S.addDays(a.p2.to, 1)); }).pop();
    return hit ? hit.key : null;
  }
  function quietRep(list, day, c) { if (!c.repeatOf) { var q = quietOf(list, day); if (q) c.repeatOf = q; } return c; }
  function hotObs(cx, list, n) {
    var s = cx.start(n), e = cx.end(n);
    return list.some(function (a) {
      if (phaseAt(cx, a, n) !== 'observe' || !(a.typesBefore > 0) || !a.p1) return false;
      var p = a.p1.done && a.p1.to < e && a.p2 ? a.p2 : a.p1, f = p.from > s ? p.from : s;
      if (f > e) return false;
      var st = cx.range(a.departmentId, f, e);
      return st.checked > 0 && (C.pct(sumOf(st.byType, a.items || []), st.checked) || 0) >= a.typesBefore;
    });
  }

  function selfClose(cx, o, list) {
    var D = o.openedAt, first = S.addDays(D, RU.SELF_CLOSE_DAYS);
    if (first >= cx.today) return null;
    var dep = o.departmentId, sp = openSpan(cx, o), ex = busyTypes(list || [], o, D), base = cx.range(dep, sp.from, sp.to);
    var ids = paretoIds(cx.env, base.byType, cx.R.pareto, ex), before = C.pct(sumOf(base.byType, ids), base.checked);
    if (!(before > 0)) return null;
    var c = 0, r = 0, pcs = 0, from = S.addDays(D, 1);
    var last = S.addDays(D, RU.SELF_CLOSE_MAX_DAYS);
    for (var d = from, g = 0; d < cx.today && d <= last && g < 400; d = S.addDays(d, 1), g++) {
      if (cx.byDay[d]) { var x = cx.day(dep, d); c += x.checked; r += x.rejected; pcs += sumOf(x.byType, ids); }
      if (d < first) continue;
      var ok = RU.selfCloseOk(daysBetween(D, d), { checked: c, rejected: r, typesPieces: pcs }, before, cx.T, cx.R.early);
      if (ok.ok) return { day: S.addDays(d, 1), from: from, to: d, days: ok.days, ids: ids, excl: ex, typesBefore: before, baseFrom: sp.from, baseTo: sp.to, check: ok };
    }
    return null;
  }

  function paretoIds(env, byType, pct, excl) {
    var skip = Object.create(null);
    (excl || []).forEach(function (t) { skip[t] = 1; });
    var list = Object.keys(byType).filter(function (t) { return has(env.ix.def, t) && !skip[t] && byType[t] > 0; }).map(function (t) {
      var d = env.ix.def[t];
      return { id: t, pieces: byType[t], level: d.level || 'fix', name: d.name };
    });
    return RU.pareto(list, pct);
  }
  function busyTypes(list, self, day) {
    var out = [];
    list.forEach(function (a) {
      if (a === self || a.key === self.key || !a.implementedAt || a.implementedAt > day || !activeAt(a, day)) return;
      (a.items || []).forEach(function (t) { if (out.indexOf(t) < 0) out.push(t); });
    });
    return out;
  }
  function baseStartOf(a) { return isDay(a.baseStart) ? a.baseStart : a.weekStart; }
  function freeze(cx, a, day, list) {
    var excl = busyTypes(list || [], a, day), st = cx.range(a.departmentId, baseStartOf(a), day);
    return { ids: paretoIds(cx.env, st.byType, cx.R.pareto, excl), excl: excl };
  }
  function live(cx, a) {
    var key = a.key || a.departmentId + '|' + a.weekStart;
    if (cx.lmemo[key]) return cx.lmemo[key];
    var env = cx.env, dep = a.departmentId, list = cx.kds(dep), from = baseStartOf(a), to = cx.today, pct = cx.R.pareto;
    var b = a.early ? a.openedAt : a.onRelapse ? S.addDays(a.openedAt, -1) : a.weekEnd;
    if (b > to) b = to;
    var st = cx.range(dep, from, b), acc = { checked: st.checked, rejected: st.rejected, byType: clone(st.byType) };
    var ex = busyTypes(list, a, a.openedAt), ids = paretoIds(env, acc.byType, pct, ex), changes = [];
    var pc = function (t) { return { defectTypeId: t, name: env.ix.def[t].name, pieces: acc.byType[t] || 0 }; };
    for (var d = S.addDays(b, 1), g = 0; d <= to && g < 400; d = S.addDays(d, 1), g++) {
      if (!cx.byDay[d]) continue;
      var x = cx.day(dep, d);
      acc.checked += x.checked; acc.rejected += x.rejected;
      Object.keys(x.byType).forEach(function (t) { acc.byType[t] = (acc.byType[t] || 0) + x.byType[t]; });
      var nx = paretoIds(env, acc.byType, pct, ex);
      var add = nx.filter(function (t) { return ids.indexOf(t) < 0; }), rem = ids.filter(function (t) { return nx.indexOf(t) < 0; });
      if (add.length || rem.length) changes.push({ day: d, added: add.map(pc), removed: rem.map(pc) });
      ids = nx;
    }
    return (cx.lmemo[key] = { ids: ids, excl: ex, changes: changes, from: from, to: to, checked: acc.checked, rejected: acc.rejected });
  }
  function itemIds(cx, a) {
    if (PHASE_OF[a.status] === 'open') return live(cx, a).ids;
    return (a.items || []).filter(function (t) { return has(cx.env.ix.def, t); });
  }


  function pubWeek(cx, depId, n) { var w = cx.wk(depId, n); w.pending = n > cx.L; return w; }

  function perSt(cx, dep, p) { return cx.range(dep, p.from, p.done ? p.to : cx.today); }
  function pubPer(cx, dep, p, st) {
    var rate = C.pct(st.rejected, st.checked);
    return { n: cx.of(p.end), start: p.from, end: p.end, estimated: !!p.est, days: p.days, need: OBS, current: !p.done && p.from <= cx.today,
      future: p.from > cx.today, pending: !p.done, audits: st.audits, checked: st.checked, rejected: st.rejected, rate: rate,
      levels: { fix: st.byLevel.fix, repair: st.byLevel.repair, scrap: st.byLevel.scrap }, over: rate != null && rate > cx.T };
  }
  function openSpan(cx, a) {
    if (a.onRelapse && isDay(a.baseStart)) return { from: a.baseStart, to: [S.addDays(a.openedAt, -1), cx.today].sort()[0] };
    return { from: a.weekStart, to: [a.early ? a.openedAt : a.weekEnd, cx.today].sort()[0] };
  }

  function rangeRate(cx, depId, from, to) {
    if (!from || !to || from > to) return { checked: 0, rejected: 0, rate: null };
    var st = cx.range(depId, from, to);
    return { checked: st.checked, rejected: st.rejected, rate: C.pct(st.rejected, st.checked) };
  }

  function analysisView(cx, a) {
    if (!a.analysisAt) return null;
    var ix = cx.env.ix, by = typeof a.analysisBy === 'string' && has(ix.user, a.analysisBy) ? ix.user[a.analysisBy] : null;
    var to = a.implementedAt || (PHASE_OF[a.status] === 'final' ? a.finishedOn || null : null);
    return { from: a.analysisAt, to: to, days: daysBetween(a.analysisAt, to || cx.today) + 1, by: a.analysisBy || null, byName: by ? by.name : null,
      note: typeof a.analysisNote === 'string' ? a.analysisNote : '' };
  }
  function selfView(sc) {
    var k = sc.check;
    return { day: sc.day, from: sc.from, to: sc.to, days: sc.days, typesBefore: sc.typesBefore, baseFrom: sc.baseFrom, baseTo: sc.baseTo,
      checked: k.checked, min: k.min, minOk: k.minOk, deptRate: k.deptRate, deptOk: k.deptOk, typesRate: k.typesRate, hi: k.hi, half: k.half,
      typesOk: k.typesOk, daysOk: k.daysOk, needDays: RU.SELF_CLOSE_DAYS, maxDays: RU.SELF_CLOSE_MAX_DAYS };
  }

  function view(cx, a) {
    var ix = cx.env.ix, depId = a.departmentId, dep = ix.dep[depId], u = a.who && has(ix.user, a.who) ? ix.user[a.who] : null;
    var os = openSpan(cx, a), bw = cx.range(depId, os.from, a.onRelapse ? os.to : a.weekEnd);
    var s1 = a.p1 ? perSt(cx, depId, a.p1) : null, s2 = a.p2 ? perSt(cx, depId, a.p2) : null;
    var w1 = s1 ? pubPer(cx, depId, a.p1, s1) : null, w2 = s2 && !a.closedEarly ? pubPer(cx, depId, a.p2, s2) : null;
    var qw = s2 && a.closedEarly ? pubPer(cx, depId, a.p2, s2) : null;
    var t1 = s1 ? s1.byType : {}, t2 = w2 ? s2.byType : {};
    var phase = PHASE_OF[a.status], lv = phase === 'open' ? live(cx, a) : null, ids = itemIds(cx, a), cum = 0;
    var lt = a.notNeeded ? [a.notNeeded.at || a.openedAt, cx.today].sort()[0] : a.implementedAt;
    var rf = lv ? lv.from : a.implementedAt ? a.baseFrom : a.weekStart, rt = lv ? lv.to : a.implementedAt ? a.baseTo : lt;
    if (a.selfClose) { rf = a.selfClose.baseFrom; rt = a.selfClose.baseTo; }   // v4.2: закрита без участі старшого — дні «до» (момент відкриття)
    var ir = cx.range(depId, rf, rt);
    var items = ids.map(function (t) {
      var pcs = ir.byType[t] || 0, def = ix.def[t];
      cum += pcs;
      var it = { defectTypeId: t, name: def.name, level: def.level || 'fix', pieces: pcs, share: C.pct(pcs, ir.rejected), cumShare: C.pct(cum, ir.rejected),
        before: C.pct(pcs, ir.checked), after: null, afterPieces: null, after2: null, after2Pieces: null, delta: null,
        cause: causeOf(a, t), causeLabel: causeOf(a, t) ? CAUSE_IX[causeOf(a, t)].label : null,
        causeNote: causeOf(a, t) === 'other' && isPlain(a.itemNotes) && typeof a.itemNotes[t] === 'string' ? a.itemNotes[t] : '' };
      if (w1 && w1.checked) { it.afterPieces = t1[t] || 0; it.after = C.pct(it.afterPieces, w1.checked); }
      if (w2 && w2.checked) { it.after2Pieces = t2[t] || 0; it.after2 = C.pct(it.after2Pieces, w2.checked); }
      if (w1 && !w1.pending && it.after != null && it.before != null) it.delta = r1(it.after - it.before);
      return it;
    });
    var rate = C.pct(bw.rejected, bw.checked), openTo = os.to;
    var split = a.early ? { before: rangeRate(cx, depId, a.weekStart, openTo),
      after: rangeRate(cx, depId, S.addDays(a.openedAt, 1), [a.weekEnd, cx.today].sort()[0]) } : null;
    var below = !!a.early && a.weekEnd < cx.today && rate != null && rate <= cx.T;
    var an = analysisView(cx, a);
    return { id: a.id || null, key: depId + '|' + a.weekStart, status: a.status,
      statusLabel: an && phase === 'open' ? 'аналіз · ' + an.days + '-й день' : a.status === 'new' && below ? 'відкрито достроково, не почато' : a.closedEarly ? CLOSED_EARLY_LABEL : STATUS_LABELS[a.status], state: STATE_OF[a.status], phase: phase,
      analysis: an, selfClosed: a.status === 'self_closed', selfClose: a.selfClose ? selfView(a.selfClose) : null,
      locationId: cx.loc.id, departmentId: depId, departmentName: dep ? dep.name : '', period: a.n, periodStart: a.weekStart, periodEnd: a.weekEnd,
      current: a.weekEnd >= cx.today, openedAt: a.openedAt, early: !!a.early, overWeeks: a.overWeeks || 0,
      weekRate: rate, weekDone: a.weekEnd < cx.today, earlyBelow: below,
      earlySplit: split,
      audits: bw.audits, checked: bw.checked, rejected: bw.rejected, rate: rate, over: rate != null && rate > cx.T,
      levels: { fix: bw.byLevel.fix, repair: bw.byLevel.repair, scrap: bw.byLevel.scrap },
      items: items, itemsShare: C.pct(cum, ir.rejected), pareto: cx.R.pareto,
      changes: lv ? lv.changes : [], openRate: rangeRate(cx, depId, os.from, openTo).rate, nowRate: lv ? C.pct(lv.rejected, lv.checked) : null,
      liveFrom: lv ? lv.from : a.weekStart, liveTo: lv ? lv.to : lt || null,
      typesBefore: a.typesBefore != null ? a.typesBefore : null, baseFrom: a.baseFrom || null, baseTo: a.baseTo || null,
      typesAfter: w1 && w1.checked ? C.pct(sumOf(t1, ids), w1.checked) : null, typesAfter2: w2 && w2.checked ? C.pct(sumOf(t2, ids), w2.checked) : null,
      week1Verdict: a.week1Verdict || null, week2Verdict: a.week2Verdict || null,
      repeatOf: a.repeatOf || null, parallelWith: (a.parallelWith || []).slice(), excludedTypes: (lv ? lv.excl : a.excludedTypes || []).slice(),
      name: items.length ? items.map(function (x) { return x.name; }).join(' · ') : 'брак відділу', defectTypeId: items.length ? items[0].defectTypeId : null,
      causes: perItem(a) ? deriveCauses(ids, a.itemCauses, ir.byType) : a.causes || [], causeNote: perItem(a) ? '' : a.causeNote || '', causePerItem: perItem(a), plan: a.plan || '', who: a.who || null, whoName: u ? u.name : null,
      implementedAt: a.implementedAt || null, recordedAt: a.recordedAt || null, notNeededReason: a.notNeeded ? a.notNeeded.reason : null,
      notNeededAt: a.notNeeded ? a.notNeeded.at : null, finishedOn: a.finishedOn || null, holdSince: a.holdSince || null,
      daysToImplement: a.implementedAt && a.openedAt ? daysBetween(a.openedAt, a.implementedAt) : null,
      result: w1, hold: w2, after: w1 && !w1.pending ? w1.rate : null, after2: w2 && !w2.pending ? w2.rate : null,
      relapseStage: a.relapseStage || null, relapsePeriod: a.relapseN != null ? a.relapseN : null,
      obsStart: a.obsStart || null, extra: a.extra ? clone(a.extra) : null, obsDays: OBS, photoFrom: a.baseFrom || null, photoTo: a.baseTo || null,
      closedEarly: !!a.closedEarly, earlyClose: a.earlyClose ? clone(a.earlyClose) : null, quiet: qw, quietVerdict: a.quietVerdict || null,
      quietReturned: !!a.quietReturned, relapseDay: a.relapseDay || null, onRelapse: !!a.onRelapse, openFrom: os.from, openTo: os.to };
  }
  function openAt(cx, depId, n) { return cx.kds(depId).filter(function (a) { return PHASE_OF[a.status] === 'open' && a.n === n; })[0] || null; }
  function isActive(a) { return PHASE_OF[a.status] === 'open' || PHASE_OF[a.status] === 'observe'; }
  function activeNow(cx, depId) { return cx.kds(depId).filter(isActive); }
  function coverAt(cx, depId, n, except) {
    var list = cx.kds(depId).filter(function (a) { var ph = phaseAt(cx, a, n); return a !== except && (ph === 'cover' || ph === 'observe' || ph === 'relapse'); });
    return list[list.length - 1] || null;
  }

  function series(cx, depId, from, to) {
    var by = Object.create(null), out = [];
    cx.kds(depId).forEach(function (a) { by[a.n] = a; });
    for (var n = Math.max(from, to - MAX_BACK - DEPT_BARS); n <= to; n++) {
      var w = cx.wk(depId, n), a = by[n];
      w.kdState = a ? STATE_OF[a.status] : null; w.kdEarly = a ? !!a.early : false; w.relapse = cx.kds(depId).filter(function (x) { return x.relapseN === n; }).length;
      out.push(w);
    }
    return out;
  }
  function typeSeries(cx, depId, typeId, from, to) {
    var inKd = Object.create(null), out = [];
    cx.kds(depId).forEach(function (a) { if (itemIds(cx, a).indexOf(typeId) >= 0) inKd[a.n] = STATE_OF[a.status]; });
    for (var n = Math.max(from, to - MAX_BACK - DEPT_BARS); n <= to; n++) {
      var w = cx.wk(depId, n), st = cx.range(depId, w.start, w.end), pcs = has(st.byType, typeId) ? st.byType[typeId] : 0;
      out.push({ n: n, start: w.start, end: w.end, current: w.current, daysDone: w.daysDone, days: w.days, checked: w.checked, rejected: w.rejected,
        pieces: pcs, rate: C.pct(pcs, w.checked), share: C.pct(pcs, w.rejected), kdState: has(inKd, String(n)) ? inKd[n] : null });
    }
    return out;
  }
  function chartWindow(cx, n) {
    var from = cx.L - DEPT_BARS + 1;
    return n < from ? { from: n - 2, to: Math.min(cx.L + 1, n + DEPT_BARS - 3) } : { from: from, to: cx.L + 1 };
  }
  function periodArg(cx, v) {
    if (v == null || v === '') return cx.L;
    var n = typeof v === 'number' ? v : /^\d{1,6}$/.test(String(v)) ? Number(v) : NaN;
    return n === Math.floor(n) && n >= Math.max(0, cx.L - MAX_BACK) && n <= cx.L + 1 ? n : null;
  }
  function depOf(cx, id) { var d = has(cx.env.ix.dep, id) ? cx.env.ix.dep[id] : null; return d && d.locationId === cx.loc.id ? d : null; }
  function typeOf(cx, id) { return has(cx.env.ix.def, id) ? cx.env.ix.def[id] : null; }

  function routeOf(cx, depId, typeId, from) {
    var kds = cx.kds(depId).filter(function (a) { return itemIds(cx, a).indexOf(typeId) >= 0; }), ev = [], busy = Object.create(null);
    var lead = Math.max(cx.n0, from - 4);
    kds.forEach(function (a) {
      var add = function (day, pr, kind, n) { if (day) { ev.push({ day: day, pr: pr, kind: kind, n: n, a: a }); busy[day] = 1; } };
      var s1 = cx.start(a.n + 1), before = function (d) { return !!d && d < s1; };
      add(a.openedAt, 2, a.early ? 'pre' : 'over', a.n);
      if (a.early && a.n <= cx.L && !before(a.implementedAt) && !(a.notNeeded && before(a.notNeeded.at))) add(s1, 2, 'over', a.n);
      if (a.implementedAt) add(a.implementedAt, 3, 'watch', a.n);
      if (a.notNeeded) add(a.notNeeded.at, 4, 'skip', a.n);
      if (a.status === 'self_closed') add(a.finishedOn, 4, 'alone', a.n);   // v4.2: закрито без участі старшого
      if (a.p1 && a.p1.done) add(S.addDays(a.p1.to, 1), 0, a.relapseStage === 1 ? 'relapse' : a.closedEarly ? 'done' : 'hold', cx.of(a.p1.to));
      if (a.p2 && a.p2.done && !a.closedEarly) add(S.addDays(a.p2.to, 1), 0, a.status === 'helped' ? 'done' : a.status === 'held_types' ? 'part' : 'relapse', cx.of(a.p2.to));
    });
    var alive = function (day) { return kds.some(function (a) { return a.openedAt < day && !(a.finishedOn && a.finishedOn <= day); }); };
    for (var n = lead; n <= cx.L; n++) { var d = cx.start(n + 1); if (!busy[d] && !alive(d)) ev.push({ day: d, pr: 1, kind: 'ok', n: n }); }
    ev = ev.filter(function (e) { return e.day <= cx.today; }).sort(function (x, y) { return x.day < y.day ? -1 : x.day > y.day ? 1 : x.pr - y.pr; });
    var steps = [];
    ev.forEach(function (e) {
      var last = steps[steps.length - 1];
      if (last && last.state === e.kind) return;
      var w = cx.wk(depId, e.n), st = cx.range(depId, w.start, w.end), pcs = has(st.byType, typeId) ? st.byType[typeId] : 0;
      steps.push({ state: e.kind, day: e.day, n: e.n, start: w.start, end: w.end, rate: C.pct(pcs, w.checked), pieces: pcs, checked: w.checked, kdId: e.a ? e.a.id || null : null });
    });
    var startDay = cx.start(from + 1), firstI = 0;
    for (var i = 0; i < steps.length; i++) if (steps[i].day <= startDay) firstI = i;
    steps = steps.slice(firstI);
    if (steps.length && steps[0].day < startDay) { steps[0].asOf = true; steps[0].day = startDay; }   // стан діяв ще до початку маршруту
    return steps;
  }
  function routeFrom(cx, depId, typeId) {
    var from = cx.L - ROUTE_BACK + 1;
    cx.kds(depId).forEach(function (a) { if (a.n - 1 < from && itemIds(cx, a).indexOf(typeId) >= 0) from = a.n - 1; });
    return Math.max(cx.n0, cx.L - MAX_BACK, from);
  }
  function typeState(cx, depId, typeId) {
    var mine = cx.kds(depId).filter(function (a) { return itemIds(cx, a).indexOf(typeId) >= 0; });
    var cur = mine.filter(isActive).pop() || mine[mine.length - 1] || null;
    if (!cur) return { status: 'none', state: 'ok', label: STATUS_LABELS.none, id: null, key: null, period: null, start: null, end: null, count: 0 };
    return { status: cur.status, state: STATE_OF[cur.status], label: STATUS_LABELS[cur.status], id: cur.id || null, key: cur.departmentId + '|' + cur.weekStart,
      period: cur.n, start: cur.weekStart, end: cur.weekEnd, count: mine.length };
  }

  function details(cx, depId, typeId, from, to) {
    var ix = cx.env.ix, locId = cx.loc.id, W = Object.create(null), A = Object.create(null), prods = Object.create(null),
      orders = Object.create(null), byDay = Object.create(null), mine = Object.create(null), withType = 0, total = 0, audits = 0;
    for (var day = from, g = 0; day <= to && g < 400; day = S.addDays(day, 1), g++) (cx.byDay[day] || []).forEach(function (a) {
      var q = 0, touches = a.departmentId === depId, helpers = Array.isArray(a.helpers) ? a.helpers : [];
      a.defects.forEach(function (d) {
        if (S.sourceDept(a, d) !== depId) return;
        touches = true;
        if (typeId && d.defectTypeId !== typeId) return;
        var pcs = S.pieces(d), ord = d.orderNo || '';
        q += pcs;
        prods[d.productId] = (prods[d.productId] || 0) + pcs;
        orders[ord] = (orders[ord] || 0) + pcs;
        d.guilty.forEach(function (gg) {
          var w = W[gg.workerCode] = W[gg.workerCode] || { qty: 0, audits: {}, helperQty: 0 };
          w.qty += gg.qty || 0; w.audits[a.id] = 1;
          if (a.departmentId === depId && helpers.indexOf(gg.workerCode) >= 0) w.helperQty += gg.qty || 0;
        });
      });
      if (touches) mine[a.auditorId] = (mine[a.auditorId] || 0) + 1;
      if (a.departmentId === depId) {
        audits++;
        var x = byDay[a.day] = byDay[a.day] || { pieces: 0, checked: 0, audits: 0 };
        x.checked += C.checkedOf(a); x.audits++;
      }
      if (!q) return;
      withType++; total += q;
      var u = A[a.auditorId] = A[a.auditorId] || { qty: 0, audits: 0 };
      u.qty += q; u.audits++;
      (byDay[a.day] = byDay[a.day] || { pieces: 0, checked: 0, audits: 0 }).pieces += q;
    });
    function top(map, make) {
      return Object.keys(map).map(function (k) { return make(k, map[k]); }).sort(function (a, b) { return b.qty - a.qty || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); });
    }
    var share = function (q) { return C.pct(q, total); }, days = [];
    for (var k = from, g2 = 0; k <= to && g2 < 400; k = S.addDays(k, 1), g2++) {
      var y = byDay[k] || { pieces: 0, checked: 0, audits: 0 };
      days.push({ day: k, pieces: y.pieces, checked: y.checked, audits: y.audits, future: k > cx.today });
    }
    return {
      workers: top(W, function (c, w) {
        var known = ix.worker[locId + ':' + c];
        return { code: c, name: c === '' ? 'Невідомий працівник' : known ? known.name : c, qty: w.qty, share: share(w.qty), audits: Object.keys(w.audits).length,
          helper: w.helperQty > 0, helperQty: w.helperQty };
      }),
      auditors: top(A, function (id, u) { return { id: id, name: has(ix.user, id) ? ix.user[id].name : id, qty: u.qty, share: share(u.qty), audits: u.audits, auditsAll: mine[id] || u.audits }; }),
      products: top(prods, function (id, q) { return { id: id, name: has(ix.prod, id) ? ix.prod[id].name : 'Невідомий виріб', qty: q, share: share(q) }; }),
      orders: top(orders, function (no, q) { return { no: no || null, name: no || 'Без замовлення', qty: q, share: share(q) }; }),
      days: days, auditsWith: withType, auditsTotal: audits };
  }

  function reviewOf(cx) {
    return { n: cx.L, start: cx.start(cx.L), end: cx.end(cx.L), reviewDay: cx.start(cx.L + 1), nextStart: cx.start(cx.L + 1), nextEnd: cx.end(cx.L + 1),
      readyOn: cx.start(cx.L + 2) };
  }
  function since(cx, days) { return S.addDays(cx.today, -(days - 1)); }
  function totals(cx) {
    var from = since(cx, 30), all = cx.all(), n = function (st, recent) { return all.filter(function (a) { return a.status === st && (!recent || a.finishedOn >= from); }).length; };
    return { 'new': n('new'), check: n('check'), hold: n('hold'), helped30: n('helped', true), notHelped30: n('not_helped', true), notNeeded30: n('not_needed', true),
      pre: n('pre'), heldTypes30: n('held_types', true), selfClosed30: n('self_closed', true) };
  }
  function stateCounts(list, from) {
    var c = { over: 0, watch: 0, hold: 0, done: 0, relapse: 0, skip: 0, pre: 0, part: 0, alone: 0 };
    list.forEach(function (a) { var s = STATE_OF[a.status]; if (ONGOING[s] || !from || a.finishedOn >= from) c[s]++; });
    return c;
  }
  function people(cx, me) {
    var list = cx.env.db.users.filter(function (u) { return u.locationIds.indexOf(cx.loc.id) >= 0 && u.role === 'senior_auditor' && !u.accessOff; });
    if (!list.some(function (u) { return u.id === me.id; }) && cx.env.ix.user[me.id]) list.unshift(cx.env.ix.user[me.id]);
    return list.map(function (u) { return { id: u.id, name: u.name, roleLabel: P.demoDict.roleLabels[u.role], me: u.id === me.id }; });
  }


  function genEnv(db, today) {
    var ix = { dep: {}, def: {}, user: {}, worker: {}, prod: {}, loc: {} };
    db.departments.forEach(function (d) { ix.dep[d.id] = d; });
    db.defectTypes.forEach(function (t) { ix.def[t.id] = t; });
    return { db: db, ix: ix, day: function () { return today; }, audits: function () { return db.audits; } };
  }
  function gStat(g, depId, from, to) { return S.deptStats(g.env, g.db.audits.filter(function (a) { return a.day >= from && a.day <= to; }), depId); }
  function gAudits(g, depId, from, to) { return g.db.audits.filter(function (a) { return a.departmentId === depId && a.day >= from && a.day <= to; }); }
  function gItems(g, depId, from, to) { return paretoIds(g.env, gStat(g, depId, from, to).byType, GEN.pareto, []); }
  function addPieces(list, rnd, typeId, k, culprit) {
    for (var guard = 0; k > 0 && guard < 600; guard++) {
      var slots = [];
      list.forEach(function (a) { a.items.forEach(function (it) { if (it.qty > it.rejected) slots.push([a, it]); }); });
      if (!slots.length) return;
      var s = rnd.pick(slots), a = s[0], it = s[1];
      var q = Math.min(k, it.qty - it.rejected, rnd.int(1, 3));
      var w = culprit && a.checkedWorkers.indexOf(culprit) >= 0 && rnd.chance(0.7) ? culprit : rnd.pick(a.checkedWorkers);
      var row = a.defects.filter(function (d) { return d.productId === it.productId && d.orderNo === it.orderNo && d.defectTypeId === typeId && !d.departmentId; })[0];
      if (!row) { row = { productId: it.productId, orderNo: it.orderNo, defectTypeId: typeId, photo: null, guilty: [] }; a.defects.push(row); }
      var gg = row.guilty.filter(function (x) { return x.workerCode === w; })[0];
      if (gg) gg.qty += q; else row.guilty.push({ workerCode: w, qty: q });
      it.rejected += q; a.noDefects = false; k -= q;
    }
  }
  function push(g, dep, from, to, target, aFrom, aTo, types) {
    types = types || g.types;
    for (var round = 0; round < 6; round++) {
      var st = gStat(g, dep.id, from, to), want = Math.ceil(target / 100 * st.checked) - st.rejected;
      if (!st.checked || want <= 0) return;
      var list = gAudits(g, dep.id, aFrom || from, aTo || to);
      if (!list.length) list = gAudits(g, dep.id, from, to);
      var strict = list.filter(function (a) { return !g.lenient[a.auditorId]; });
      if (strict.length) list = strict;
      var room = 0;
      list.forEach(function (a) { a.items.forEach(function (it) { room += it.qty - it.rejected; }); });
      if (room < want * 2) list[list.length - 1].items[0].qty += want * 2 - room;
      var first = Math.ceil(want * 0.6);
      addPieces(list, g.rnd, types[0].id, first, g.culprit);
      addPieces(list, g.rnd, (types[1] || types[0]).id, want - first, g.culprit);
    }
  }
  function cap(g, dep, from, to, max) {
    for (var d = from; d <= to; d = S.addDays(d, 1)) {
      var st = gStat(g, dep.id, d, d), list = gAudits(g, dep.id, d, d);
      if (!st.rejected || !list.length || C.pct(st.rejected, st.checked) <= max) continue;
      var need = Math.ceil(st.rejected * 100 / max) - st.checked, items = [];
      list.forEach(function (a) { a.items.forEach(function (it) { items.push(it); }); });
      items.forEach(function (it, i) { it.qty += Math.floor(need / items.length) + (i < need % items.length ? 1 : 0); });
    }
  }
  function thin(g, dep, from, to, aFrom, aTo, max) {
    var st = gStat(g, dep.id, from, to), items = [];
    if (!st.checked || C.pct(st.rejected, st.checked) <= max) return;
    gAudits(g, dep.id, aFrom, aTo).forEach(function (a) { a.items.forEach(function (it) { items.push(it); }); });
    if (!items.length) return;
    var need = Math.ceil(st.rejected * 100 / max) - st.checked + 1;
    items.forEach(function (it, i) { it.qty += Math.floor(need / items.length) + (i < need % items.length ? 1 : 0); });
  }
  function bulk(g, dep, from, to, min) {
    var st = gStat(g, dep.id, from, to), items = [];
    if (st.checked >= min) return;
    gAudits(g, dep.id, from, to).forEach(function (a) { a.items.forEach(function (it) { items.push(it); }); });
    var need = min - st.checked;
    items.forEach(function (it, i) { it.qty += Math.floor(need / items.length) + (i < need % items.length ? 1 : 0); });
  }
  var GEN_PLAN = { skill: 'Провели інструктаж біля робочого місця, показали правильний прийом.', discipline: 'Нагадали про перевірку виробу перед здачею; тімлід перевіряє першу партію зміни.',
    tool: 'Замінили голки й налаштували натяг нитки на двох машинах.', material: 'Замінили партію ниток на іншого постачальника.', organization: 'Переставили стіл контролю ближче до лінії.' };
  var GEN_SKIP = ['Разовий збій машини — полагодили того ж дня.', 'Партія з браком від постачальника — повернули.'];
  var GEN_NOTE = 'Перевіряємо голки й натяг нитки на машинах 3 і 5, дивимось партію тканини.';

  var PLANS = ['early', 'parallel', 'relapse', 'history', 'early_week'];
  function gPastDays(g, depId) {
    g.past = g.past || {};
    if (g.past[depId]) return g.past[depId];
    var seen = Object.create(null), out = [];
    g.db.audits.forEach(function (a) { if (a.departmentId === depId && a.day < g.today && !seen[a.day]) { seen[a.day] = 1; out.push(a.day); } });
    return (g.past[depId] = out.sort().reverse());
  }
  function gNextDays(g, depId, from, n) {
    return gPastDays(g, depId).filter(function (d) { return d >= from; }).sort().slice(0, n);
  }
  function gItemsEx(g, depId, from, to, excl) { return paretoIds(g.env, gStat(g, depId, from, to).byType, GEN.pareto, excl || []); }
  function shape(g, dep, kind) {
    var L = g.L, id = dep.id, dec = g.dec, s = function (o) { return S.periodStart(L + o, GEN.wd); }, e = function (o) { return S.periodEnd(L + o, GEN.wd); };
    var j = function (a, b) { return Math.round(g.rnd.between(a, b) * 10) / 10; }, at = function (o) { return id + '|' + (L + o); };
    var impl = function (o, plus, causes) { return function (v, cx, list) { return seedRec(g, v, { implementedAt: S.addDays(s(o), plus), causes: causes }, list); }; };
    var skip = function (v, cx, list) { return seedRec(g, v, { notNeeded: GEN_SKIP[0] }, list); }, open = function () { return null; };
    var anl = function (v, cx, list) { return seedRec(g, v, { analysis: GEN_NOTE }, list); };   // v4.2: аналіз триває
    var quiet = function (a, b) { cap(g, dep, s(a), e(b), 4.5); };
    var over = function (o, lo, hi) { push(g, dep, s(o), e(o), j(lo, hi)); };
    var past = function (k) { var d = gPastDays(g, id); return d[Math.min(k, d.length) - 1] || null; };
    var W = function (day) { return S.periodOf(day, GEN.wd); }, ws = function (n) { return S.periodStart(n, GEN.wd); }, we = function (n) { return S.periodEnd(n, GEN.wd); };
    var implAt = function (day, causes) { return function (v, cx, list) { return seedRec(g, v, { implementedAt: day, causes: causes }, list); }; };
    var types = function (ids) { return ids.map(function (t) { return g.env.ix.def[t]; }).filter(Boolean); };
    var others = function (ids) { return g.allTypes.filter(function (t) { return ids.indexOf(t.id) < 0; }); };
    var steady = function (f, t, ids, bf, bt) {
      if (!ids.length) return;
      cap(g, dep, f, t, 2.4);
      var b0 = gStat(g, id, bf, bt), st = gStat(g, id, f, t), sum = function (x) { return ids.reduce(function (n, k) { return n + (x.byType[k] || 0); }, 0); };
      var want = Math.ceil((b0.checked ? sum(b0) / b0.checked : 0) * 0.65 * st.checked) - sum(st);
      var strict = gAudits(g, id, f, t).filter(function (a) { return !g.lenient[a.auditorId]; });
      if (want > 0 && strict.length) { var h = Math.ceil(want / 2); addPieces(strict, g.rnd, ids[0], h, g.culprit); addPieces(strict, g.rnd, ids[1] || ids[0], want - h, g.culprit); }
    };
    var hotWeek = function (n, list) {
      if (!list.length) return;
      push(g, dep, ws(n), we(n), j(6.6, 7.2), S.addDays(ws(n), 1), we(n), g.rnd.sample(list, Math.min(2, list.length)));
    };
    var overTo = function (n, day) { push(g, dep, ws(n), we(n), j(6.4, 6.9)); if (day >= ws(n + 1)) push(g, dep, ws(n + 1), day, j(6.4, 6.9)); };
    var earlyWeek = function (o, decide) {
      var days = [], cum = 0, d0 = null;
      gAudits(g, id, s(o), S.addDays(e(o), -1)).forEach(function (a) { if (days.indexOf(a.day) < 0) days.push(a.day); });
      days.sort();
      if (days.length < 2) return;
      for (var i = 0; i < days.length - 1 && !d0; i++) { cum += gStat(g, id, days[i], days[i]).checked; if (cum >= 550) d0 = days[i]; }
      if (!d0) { d0 = days[days.length - 2]; bulk(g, dep, s(o), d0, 550); }
      push(g, dep, s(o), d0, j(8.2, 9.0));
      cap(g, dep, S.addDays(d0, 1), e(o), 2);
      thin(g, dep, s(o), e(o), S.addDays(d0, 1), e(o), 4.5);
      dec[at(o)] = decide || open;
    };
    var preTo = [S.addDays(g.today, -1), S.addDays(e(1), -1)].sort()[0];
    var hN, hImpl, hIds, xImpl, xN, rN, rImpl, rIds, d, zImpl, zN, zIds;
    var cov = function (day, n) { var k = W(day); if (ws(k) < day) k++; return Math.max(k, n + 1) - 1; };
    switch (kind) {
      case 'early': {
        quiet(-9, -7);
        over(-6, 6.4, 6.9); dec[at(-6)] = impl(-5, 1, ['tool']);
        var pre = preTo >= s(1) && gStat(g, id, s(1), preTo).checked >= GEN.early;
        cap(g, dep, s(-5), e(pre ? 0 : -1), 4.2);
        var eIds = gItems(g, id, s(-6), S.addDays(s(-5), 1)), eOth = others(eIds);
        if (eOth.length) push(g, dep, S.addDays(s(-5), 2), e(-5), j(8.6, 9.0), null, null, g.rnd.sample(eOth, Math.min(2, eOth.length)));
        if (pre) { push(g, dep, s(1), preTo, j(8.2, 9.0)); dec[at(1)] = anl; } else earlyWeek(0, anl);
        break;
      }
      case 'parallel': {
        quiet(-10, -8);
        over(-7, 6.4, 6.9); dec[at(-7)] = impl(-6, 0, ['tool']);
        var xc = [S.addDays(past(2), -1), past(1), g.today].filter(Boolean), pick = null;
        for (var k = 14; k >= 9 && !pick; k--) {
          var hk = past(k);
          if (!hk) continue;
          for (var c = 0; c < xc.length && !pick; c++) if (W(xc[c]) - 1 > cov(hk, W(hk) - 1)) pick = { h: hk, x: xc[c] };
        }
        if (!pick) break;
        hImpl = pick.h; xImpl = pick.x; hN = W(hImpl) - 1; xN = W(xImpl) - 1;
        cap(g, dep, s(-6), S.addDays(ws(hN), -1), 4.2);
        overTo(hN, hImpl); dec[id + '|' + hN] = implAt(hImpl, ['skill', 'organization']);
        hIds = gItems(g, id, ws(hN), hImpl);
        cap(g, dep, S.addDays(hImpl, 1), g.today, 4.2);
        d = gNextDays(g, id, S.addDays(hImpl, 1), 7);
        if (d.length >= 7) steady(d[0], d[6], hIds, ws(hN), hImpl);
        hotWeek(xN, others(hIds));
        dec[id + '|' + xN] = implAt(xImpl, ['material']);
        break;
      }
      case 'relapse':
        quiet(-9, -7);
        over(-6, 5.6, 6.0); dec[at(-6)] = skip;
        rImpl = past(16);
        if (!rImpl) break;
        rN = W(rImpl) - 1;
        cap(g, dep, s(-5), S.addDays(ws(rN), -1), 4.2);
        if (ws(rN) > S.addDays(s(-4), 6)) {
          push(g, dep, s(-5), e(-5), j(5.6, 6.0), e(-5), e(-5)); dec[at(-5)] = open;
          cap(g, dep, s(-4), e(-4), 1.0); bulk(g, dep, S.addDays(s(-4), 1), S.addDays(s(-4), 2), 600);
        }
        overTo(rN, rImpl); dec[id + '|' + rN] = implAt(rImpl, ['tool']);
        rIds = gItems(g, id, ws(rN), rImpl);
        cap(g, dep, S.addDays(rImpl, 1), g.today, 4.2);
        d = gNextDays(g, id, S.addDays(rImpl, 1), 14);
        if (d.length >= 7) steady(d[0], d[6], rIds, ws(rN), rImpl);
        if (d.length >= 14 && rIds.length) {
          push(g, dep, d[7], d[13], j(8.0, 8.6), null, null, types(rIds));
          var b0 = gStat(g, id, ws(rN), rImpl), w0 = gStat(g, id, d[7], d[13]), sumIds = function (st) { return rIds.reduce(function (n, t) { return n + (st.byType[t] || 0); }, 0); };
          var more = Math.ceil(((b0.checked ? sumIds(b0) / b0.checked * 100 : 0) + 0.8) / 100 * w0.checked) - sumIds(w0);
          var strict = gAudits(g, id, d[7], d[13]).filter(function (x) { return !g.lenient[x.auditorId]; });
          if (more > 0 && strict.length) addPieces(strict, g.rnd, rIds[0], more, g.culprit);
        }
        g.keepOpen[id] = rN;   // повторна після рецидиву R (тиждень пізніше за тиждень R) лишається без плану
        break;
      case 'history':
        quiet(-12, -10);
        over(-9, 6.4, 6.9); dec[at(-9)] = impl(-8, 1, ['discipline']);
        var r0Ids = gItems(g, id, s(-9), S.addDays(s(-8), 1)), r0 = gNextDays(g, id, S.addDays(s(-8), 2), 14);
        if (r0.length >= 14) {
          steady(r0[0], r0[6], r0Ids, s(-9), S.addDays(s(-8), 1));
          push(g, dep, r0[7], r0[13], j(8.0, 8.6), null, null, types(r0Ids));
          cap(g, dep, S.addDays(r0[13], 1), g.today, 4.2);
          g.implNext[id] = 1;   // повторна Q0 — план наступного дня після відкриття
        }
        zImpl = past(11);
        if (zImpl) {
          zN = W(zImpl) - 1;
          overTo(zN, zImpl); dec[id + '|' + zN] = implAt(zImpl, ['organization']);
          zIds = gItems(g, id, ws(zN), zImpl);
          d = gNextDays(g, id, S.addDays(zImpl, 1), 7);
          if (d.length) cap(g, dep, d[0], d[d.length - 1], 1.0);
        }
        break;
      case 'early_week':
        quiet(-9, -7);
        over(-6, 6.4, 6.9); dec[at(-6)] = impl(-5, 0, ['tool']);
        cap(g, dep, s(-5), e(-1), 4.2);
        earlyWeek(0, function (v, cx, list) { return seedRec(g, v, { implementedAt: S.addDays(v.openedAt, 1), causes: ['organization'] }, list); });
        break;
    }
  }
  function seedRec(g, v, o, list) {
    var rec = { id: 'KD_' + v.departmentId + '_' + v.weekStart, locationId: v.locationId,
      departmentId: v.departmentId, weekStart: v.weekStart, weekEnd: v.weekEnd, openedAt: v.openedAt, early: v.early,
      onRelapse: v.onRelapse || undefined, baseStart: v.baseStart || undefined, items: [], excludedTypes: [], causes: [], causeNote: '', plan: '', who: g.senior, implementedAt: null,
      recordedAt: null, recordedBy: g.senior, startedAt: null, notNeeded: null, seeded: true }, day;
    if (o.analysis) {
      day = [S.addDays(v.openedAt, 1), g.today].sort()[0];
      rec.analysisAt = rec.recordedAt = day; rec.analysisBy = g.senior; rec.analysisNote = o.analysis;
      g.db.kdSeed.push(rec);
      return rec;
    }
    if (o.notNeeded) { day = [S.addDays(v.openedAt, 1), g.today].sort()[0]; rec.notNeeded = { reason: o.notNeeded, at: day, by: g.senior }; rec.recordedAt = rec.startedAt = day; }
    else {
      day = [o.implementedAt, g.today].sort()[0];
      if (day < v.openedAt) day = v.openedAt;
      rec.implementedAt = rec.recordedAt = rec.startedAt = day;
      rec.causes = o.causes; rec.plan = GEN_PLAN[o.causes[0]];
    }
    var fz = freeze(g.cx, v, day, list);
    rec.items = fz.ids; rec.excludedTypes = fz.excl;
    if (rec.implementedAt && fz.ids.length) {
      var pcs = g.cx.range(v.departmentId, baseStartOf(v), day).byType, ic = {};
      fz.ids.slice().sort(function (a, b) { return (pcs[b] || 0) - (pcs[a] || 0); }).forEach(function (t, i) { ic[t] = o.causes[i % o.causes.length]; });
      rec.itemCauses = ic; rec.itemNotes = {}; rec.causes = deriveCauses(fz.ids, ic, pcs);
    }
    g.db.kdSeed.push(rec);
    return rec;
  }
  function genHook(db, ctx) {
    var today = ctx.today, rnd = P.demoDates.makeRnd((ctx.seed || 0) + 4501), env = genEnv(db, today);
    var L = S.lastFullPeriod(today, GEN.wd);
    db.kdSeed = [];
    db.locations.forEach(function (loc) {
      var deps = db.departments.filter(function (d) { return d.locationId === loc.id && d.active !== false; });
      var g = { db: db, env: env, rnd: rnd, L: L, today: today, dec: {}, senior: 'u_sen_' + loc.id.slice(4).toLowerCase(), lenient: {}, keepOpen: {}, implNext: {} };
      db.users.forEach(function (u) { if (u.lenient) g.lenient[u.id] = 1; });
      var usual = function (d) { var st = gStat(g, d.id, S.periodStart(L - 8, GEN.wd), S.periodEnd(L, GEN.wd)); return C.pct(st.rejected, st.checked) || 0; };
      var nTypes = function (d) { return db.defectTypes.filter(function (t) { return t.deptTypeId === d.deptTypeId && t.active !== false; }).length; };
      var order = deps.map(function (d) { return { d: d, u: usual(d), n: nTypes(d) }; }).sort(function (a, b) { return a.u - b.u || (a.d.id < b.d.id ? -1 : 1); });
      var ri = PLANS.indexOf('relapse'), best = 0;
      order.forEach(function (x, i) { if (i < PLANS.length && x.n > order[best].n) best = i; });
      if (ri < order.length && order[best].n > order[ri].n) { var tmp = order[ri]; order[ri] = order[best]; order[best] = tmp; }
      order.forEach(function (x, i) {
        var kind = PLANS[i];
        if (!kind) return;
        var dep = x.d, types = db.defectTypes.filter(function (t) { return t.deptTypeId === dep.deptTypeId && t.active !== false; });
        var ws = db.workers.filter(function (w) { return w.departmentId === dep.id; });
        if (types.length < 2 || !ws.length) return;
        var top = RU.LEVEL_ORDER.map(function (lv) { return types.filter(function (t) { return (t.level || 'fix') === lv; }); }).filter(function (x) { return x.length >= 2; })[0] || types;
        g.allTypes = types; g.types = rnd.sample(top, 2); g.culprit = rnd.pick(ws).code;
        shape(g, dep, kind);
        (db.kdScenarios = db.kdScenarios || {})[dep.id] = kind;   // для перевірки засіву (тести, налагодження)
      });
      g.cx = makeCx(env, loc, GEN, []);
      deps.forEach(function (d) {
        g.cx.kds(d.id, function (v, cx, list) {
          var k = d.id + '|' + v.n;
          if (has(g.dec, k)) return g.dec[k](v, cx, list);
          if (v.onRelapse && has(g.keepOpen, d.id) && v.n > g.keepOpen[d.id]) return null;
          if (v.onRelapse && g.implNext[d.id]) return seedRec(g, v, { implementedAt: S.addDays(v.openedAt, 1), causes: ['discipline'] }, list);
          if (v.n > L - 1) return null;   // свіжі перевищення лишаються без рішення
          if (rnd.chance(0.15)) return seedRec(g, v, { notNeeded: rnd.pick(GEN_SKIP) }, list);
          var cs = rnd.sample(Object.keys(GEN_PLAN), rnd.int(1, 2));
          return seedRec(g, v, { implementedAt: S.addDays(v.openedAt, rnd.int(0, 2)), causes: cs }, list);
        });
      });
    });
  }

  function loadHook(db, ctx) {
    var saved = ctx.storage.get(KEY, {}) || {};
    if (typeof saved !== 'object' || Array.isArray(saved)) saved = {};
    db.kdActions = (db.kdSeed || []).filter(function (a) { return !has(saved, a.id); }).map(clone)
      .concat(Object.keys(saved).map(function (id) { return saved[id]; }).filter(function (a) { return a && typeof a === 'object'; }));
  }


  function periodSum(cx, list, from, to) {
    var inR = function (d) { return !!d && d >= from && d <= to; };
    var opened = list.filter(function (a) { return inR(a.openedAt); }), impl = list.filter(function (a) { return inR(a.implementedAt); });
    var d = impl.map(function (a) { return daysBetween(a.openedAt, a.implementedAt); });
    var res = { belowAfter1: 0, notBelowAfter1: 0, pending: 0 }, held = { done: 0, relapse: 0, pending: 0, part: 0 }, before = [], after = [], cause = Object.create(null);
    impl.forEach(function (a) {
      if (a.status === 'check') res.pending++;
      else if (a.week1Verdict !== 'norm') res.notBelowAfter1++;
      else { res.belowAfter1++; held[a.status === 'helped' ? 'done' : a.status === 'held_types' ? 'part' : a.status === 'hold' ? 'pending' : 'relapse']++; }
      if (a.status !== 'check') view(cx, a).items.forEach(function (it) { if (it.before != null && it.after != null) { before.push(it.before); after.push(it.after); } });
      if (perItem(a)) (a.items || []).forEach(function (t) { var c = causeOf(a, t); if (c) cause[c] = (cause[c] || 0) + 1; });
      else (a.causes || []).forEach(function (c) { if (has(CAUSE_IX, c)) cause[c] = (cause[c] || 0) + 1; });
    });
    return { opened: opened.length, earlyOpened: opened.filter(function (a) { return a.early; }).length, implemented: impl.length,
      implementedDaysAvg: d.length ? r1(mean(d)) : null, notImplemented: opened.filter(function (a) { return PHASE_OF[a.status] === 'open'; }).length,
      notNeeded: opened.filter(function (a) { return a.status === 'not_needed'; }).length, results: res, held: held,
      selfClosed: opened.filter(function (a) { return a.status === 'self_closed'; }).length,   // v4.2: з відкритих — закрились без участі старшого
      effect: { items: before.length, avgBefore: before.length ? r1(mean(before)) : null, avgAfter: after.length ? r1(mean(after)) : null,
        avgDeltaPp: before.length ? r1(mean(after) - mean(before)) : null },
      causes: CAUSES.filter(function (c) { return cause[c.id]; }).map(function (c) { return { id: c.id, label: c.label, n: cause[c.id] }; }) };
  }
  function rangeOf(p, env) {
    var today = env.day(), to = DAY_RE.test(p.to || '') && p.to <= today ? p.to : today;
    var from = DAY_RE.test(p.from || '') && p.from <= to ? p.from : S.addDays(to, -29);
    if (from < S.addDays(to, -365)) from = S.addDays(to, -365);
    return { from: from, to: to };
  }
  function locSummary(env, locId, from, to) {
    var loc = has(env.ix.loc, locId) ? env.ix.loc[locId] : null;
    if (!loc) return C.fail('not_found', 'Локацію не знайдено.');
    var rg = rangeOf({ from: from, to: to }, env), cx = makeCx(env, loc), all = cx.all(), ps = periodSum(cx, all, rg.from, rg.to), T = cx.T;
    var st = stateCounts(all.filter(function (a) { return !a.finishedOn || a.finishedOn <= rg.to; }), rg.from);
    st.done = all.filter(function (a) { return a.status === 'helped' && a.finishedOn >= rg.from && a.finishedOn <= rg.to; }).length;
    st.relapse = all.filter(function (a) { return a.status === 'not_helped' && a.finishedOn >= rg.from && a.finishedOn <= rg.to; }).length;
    st.skip = all.filter(function (a) { return a.status === 'not_needed' && a.finishedOn >= rg.from && a.finishedOn <= rg.to; }).length;
    st.part = all.filter(function (a) { return a.status === 'held_types' && a.finishedOn >= rg.from && a.finishedOn <= rg.to; }).length;
    var alone = selfClosedIn(cx, all, rg.from, rg.to);   // v4.2: закриті без участі старшого в періоді
    st.alone = alone.length;
    var weeks = [];
    for (var n = cx.of(rg.from); n <= cx.of(rg.to); n++) {
      var c = 0, r = 0, s = cx.start(n), e = cx.end(n), inW = function (d) { return !!d && d >= s && d <= e; };
      cx.deps.forEach(function (d) { var w = cx.range(d.id, s, e); c += w.checked; r += w.rejected; });
      weeks.push({ n: n, start: s, end: e, current: n > cx.L, rate: C.pct(r, c), checked: c, rejected: r,
        opened: all.filter(function (a) { return inW(a.openedAt); }).length, implemented: all.filter(function (a) { return inW(a.implementedAt); }).length,
        belowAfter: all.filter(function (a) { return a.r1n === n && n <= cx.L && a.week1Verdict === 'norm'; }).length,
        relapse: all.filter(function (a) { return a.relapseN === n; }).length });
    }
    var depts = cx.deps.map(function (d) {
      var mine = all.filter(function (a) { return a.departmentId === d.id; }), w = cx.wk(d.id, cx.L);
      return { id: d.id, name: d.name, weekRate: w.rate, weekChecked: w.checked, over: w.over, open: mine.filter(function (a) { return a.status === 'new'; }).length,
        watch: mine.filter(function (a) { return a.status === 'check'; }).length, hold: mine.filter(function (a) { return a.status === 'hold'; }).length,
        relapse: mine.filter(function (a) { return a.status === 'not_helped' && a.finishedOn >= rg.from && a.finishedOn <= rg.to; }).length,
        pre: mine.filter(function (a) { return a.status === 'pre'; }).length,
        part: mine.filter(function (a) { return a.status === 'held_types' && a.finishedOn >= rg.from && a.finishedOn <= rg.to; }).length,
        selfClosed: alone.filter(function (x) { return x.departmentId === d.id; }).length };
    });
    var actions = all.filter(function (a) { return a.openedAt <= rg.to && !(a.finishedOn && a.finishedOn < rg.from); }).map(function (a) {
      var v = view(cx, a), cur = a.status === 'check' ? v.result : a.status === 'hold' ? v.hold : null;
      return { id: v.id, key: v.key, departmentId: v.departmentId, departmentName: v.departmentName, weekStart: v.periodStart, weekEnd: v.periodEnd,
        resultDay: cur ? S.addDays(cur.end, 1) : null, resultEstimated: cur ? !!cur.estimated : false,
        closedEarly: !!a.closedEarly, obsStart: a.obsStart || null,
        selfClosed: v.selfClosed, analysis: v.analysis,   // v4.2: закрито без участі старшого · етап «аналіз»
        openedAt: v.openedAt, early: v.early, earlyBelow: v.earlyBelow, weekRate: v.weekRate, weekDone: v.weekDone, implementedAt: v.implementedAt, daysToImplement: v.daysToImplement,
        finishedOn: v.finishedOn,   // v3.3: коли стан став остаточним — керівник рахує «закрито за період» і «знизили» по одних і тих самих діях
        cause: v.causes.length && has(CAUSE_IX, v.causes[0]) ? CAUSE_IX[v.causes[0]].label : null, done: v.plan || null, before: v.rate, after: v.after, after2: v.after2,
        state: v.state, phase: v.phase, statusLabel: v.statusLabel, repeatOf: v.repeatOf, parallelWith: v.parallelWith,
        typesBefore: v.typesBefore, typesAfter: v.typesAfter, typesAfter2: v.typesAfter2, week1Verdict: v.week1Verdict, week2Verdict: v.week2Verdict,
        items: v.items.map(function (it) { return { defectTypeId: it.defectTypeId, name: it.name, level: it.level, share: it.share, before: it.before, after: it.after }; }) };
    }).sort(function (a, b) { return a.openedAt < b.openedAt ? 1 : a.openedAt > b.openedAt ? -1 : 0; });
    return { ok: true, location: { id: loc.id, name: loc.name }, from: rg.from, to: rg.to, today: cx.today,
      cycle: { days: KD.CYCLE_DAYS, reviewWeekday: cx.R.wd, reviewWeekdayName: S.WEEKDAYS[cx.R.wd - 1] }, threshold: T, early: cx.R.early, pareto: cx.R.pareto,
      states: st, period: { opened: ps.opened, earlyOpened: ps.earlyOpened, implemented: ps.implemented, implementedDaysAvg: ps.implementedDaysAvg,
        notImplemented: ps.notImplemented, notNeeded: ps.notNeeded, results: ps.results, held: ps.held, selfClosed: ps.selfClosed },
      effect: ps.effect, causes: ps.causes, depts: depts, weeks: weeks, actions: actions, selfClosed: alone };
  }
  function selfClosedIn(cx, all, from, to) {
    return all.filter(function (a) { return a.status === 'self_closed' && a.finishedOn >= from && a.finishedOn <= to; })
      .sort(function (x, y) { return x.finishedOn < y.finishedOn ? 1 : x.finishedOn > y.finishedOn ? -1 : 0; })
      .map(function (a) {
        var s = a.selfClose, dep = cx.env.ix.dep[a.departmentId];
        return { key: a.key, departmentId: a.departmentId, departmentName: dep ? dep.name : '', openedAt: a.openedAt, finishedOn: a.finishedOn,
          from: s.from, to: s.to, days: s.days, typesBefore: s.typesBefore, typesAfter: s.check.typesRate, deptRate: s.check.deptRate, checked: s.check.checked,
          types: (a.items || []).filter(function (t) { return has(cx.env.ix.def, t); }).map(function (t) { return cx.env.ix.def[t].name; }) };
      });
  }


  function writable(p, me, env) {
    if (!S.canManage(me)) return { err: C.forbidden() };
    var r = S.loc(p, me, env); if (r.err) return r;
    return { cx: makeCx(env, r.loc) };
  }
  function findAction(cx, id) { return typeof id === 'string' ? cx.all().filter(function (a) { return a.id === id; })[0] || null : null; }
  function openKd(cx, p) {
    var depId = p.departmentId, period = p.period;
    if (typeof p.key === 'string' && p.key) {
      var parts = p.key.split('|');
      depId = parts[0];
      period = parts.length === 2 && DAY_RE.test(parts[1]) && cx.start(cx.of(parts[1])) === parts[1] ? cx.of(parts[1]) : NaN;
    }
    var dep = depOf(cx, depId), n = periodArg(cx, period);
    if (!dep) return { err: C.fail('not_found', 'Відділ не знайдено. Оновіть сторінку.') };
    if (n == null) return { err: C.fail('not_found', 'Такого тижня немає. Оновіть сторінку.') };
    var kd = openAt(cx, dep.id, n);
    if (!kd) return { err: C.fail('conflict', 'Для цього тижня відділу коригуючої дії немає або рішення вже записано. Оновіть сторінку — побачите, як є зараз.') };
    return { kd: kd, dep: dep };
  }
  function dayFits(cx, kd, day) { return isDay(day) && day >= kd.openedAt && day <= cx.today; }
  function planItems(cx, kd, day, editing, lock) {
    var recalc = dayFits(cx, kd, day) && (!editing || (!lock && day !== kd.implementedAt));
    var fz = recalc ? freeze(cx, kd, day, cx.kds(kd.departmentId)) : null;
    return { fz: fz, ids: fz ? fz.ids : itemIds(cx, kd) };
  }
  function itemCauseErrors(cx, p, ids) {
    var errs = [], ic = p.itemCauses, nt = isPlain(p.itemNotes) ? p.itemNotes : {}, def = cx.env.ix.def;
    if (Object.keys(ic).some(function (t) { return !has(def, t); })) errs.push({ field: 'itemCauses', message: 'Серед видів браку є невідомий. Оновіть сторінку й спробуйте ще раз.' });
    ids.forEach(function (t) {
      var c = has(ic, t) ? ic[t] : null, note = has(nt, t) && typeof nt[t] === 'string' ? nt[t].trim() : '';
      if (typeof c !== 'string' || !has(CAUSE_IX, c)) errs.push({ field: 'itemCauses.' + t, message: 'Оберіть для «' + def[t].name + '» одну причину зі списку.' });
      else if (c === 'other' && note.length < 3) errs.push({ field: 'itemNotes.' + t, message: 'Поясніть, що сталося, — ви обрали «Інше».' });
      else if (c === 'other' && note.length > 300) errs.push({ field: 'itemNotes.' + t, message: 'Коротше, будь ласка: до 300 знаків.' });
    });
    return errs;
  }
  function planErrors(cx, me, p, kd, lockDay, ids) {
    var errs = [], causes = Array.isArray(p.causes) ? p.causes : [];
    if (isPlain(p.itemCauses) && ids.length) errs = itemCauseErrors(cx, p, ids);
    else {
      if (!causes.length) errs.push({ field: 'causes', message: ids.length ? 'Оберіть причину — хоча б одну.' : 'У дії немає видів браку — оберіть причину для всієї дії (хоча б одну).' });
      else if (causes.some(function (c) { return typeof c !== 'string' || !has(CAUSE_IX, c); }) || causes.length !== causes.filter(function (c, i) { return causes.indexOf(c) === i; }).length)
        errs.push({ field: 'causes', message: 'Оберіть причини зі списку, кожну один раз.' });
      if (causes.indexOf('other') >= 0 && String(p.causeNote || '').trim().length < 3) errs.push({ field: 'causeNote', message: 'Поясніть, що сталося, — ви обрали «Інше».' });
      else if (String(p.causeNote || '').trim().length > 300) errs.push({ field: 'causeNote', message: 'Коротше, будь ласка: до 300 знаків.' });
    }
    var planText = String(p.plan || '').trim();
    if (planText.length < 3) errs.push({ field: 'plan', message: 'Напишіть, що зроблено, — хоча б кілька слів.' });
    else if (planText.length > 1000) errs.push({ field: 'plan', message: 'Коротше, будь ласка: до 1000 знаків.' });
    if (!people(cx, me).some(function (u) { return u.id === p.who; })) errs.push({ field: 'who', message: 'Оберіть, хто відповідає.' });
    var day = p.day;
    if (lockDay) { if (day != null && day !== '' && day !== kd.implementedAt) errs.push({ field: 'day', message: 'Перший тиждень після впровадження вже минув — дату впровадження змінити не можна.' }); }
    else if (!isDay(day)) errs.push({ field: 'day', message: 'Оберіть дату впровадження.' });
    else if (day < kd.openedAt || day > cx.today) errs.push({ field: 'day', message: 'Дата — від дня, коли відкрили коригуючу дію (' + kd.openedAt.split('-').reverse().join('.') + '), до сьогодні.' });
    return errs;
  }
  function setCauses(cx, rec, p, ids) {
    var old = !isPlain(p.itemCauses) || !ids.length, nt = isPlain(p.itemNotes) ? p.itemNotes : {}, ic = {}, notes = {};
    if (old && !ids.length) {
      rec.causes = p.causes.slice(); rec.causeNote = String(p.causeNote || '').trim(); delete rec.itemCauses; delete rec.itemNotes;
      return;
    }
    ids.forEach(function (t) {
      var c = old ? p.causes[0] : p.itemCauses[t];
      ic[t] = c;
      if (c === 'other') notes[t] = String(old ? p.causeNote || '' : nt[t] || '').trim();
    });
    var pcs = cx.range(rec.departmentId, baseStartOf(rec), rec.implementedAt).byType;
    rec.itemCauses = ic; rec.itemNotes = notes; rec.causes = deriveCauses(ids, ic, pcs);
    var big = ids.filter(function (t) { return ic[t] === 'other'; }).sort(function (a, b) { return (pcs[b] || 0) - (pcs[a] || 0); })[0];
    rec.causeNote = big ? notes[big] : '';
  }
  function save(env, rec) {
    var keep = ['id', 'locationId', 'departmentId', 'weekStart', 'weekEnd', 'openedAt', 'early', 'onRelapse', 'baseStart', 'items', 'excludedTypes', 'causes', 'causeNote', 'itemCauses', 'itemNotes', 'plan', 'who',
      'implementedAt', 'recordedAt', 'recordedBy', 'startedAt', 'notNeeded', 'seeded', 'analysisAt', 'analysisBy', 'analysisNote'], o = {};
    keep.forEach(function (k) { if (rec[k] !== undefined) o[k] = rec[k]; });
    var all = S.get(env, KEY, {}) || {};
    if (typeof all !== 'object' || Array.isArray(all)) all = {};
    all[o.id] = o; S.set(env, KEY, all);
    var list = env.db.kdActions = env.db.kdActions || [], i;
    for (i = 0; i < list.length && list[i].id !== o.id; i++) { /* шукаємо */ }
    list[i] = o;
    return o;
  }
  function after(env, loc, id) {
    var cx = makeCx(env, loc);
    return { ok: true, action: view(cx, findAction(cx, id)), totals: totals(cx) };
  }
  function newRec(cx, kd, me) {
    var was = kd.id ? cx.stored.filter(function (s) { return s.id === kd.id; })[0] : null;
    if (was) { var r = clone(was); r.recordedAt = cx.today; r.recordedBy = me.id; return r; }
    return { id: 'KD_' + kd.departmentId + '_' + kd.weekStart, locationId: cx.loc.id, departmentId: kd.departmentId, weekStart: kd.weekStart, weekEnd: kd.weekEnd,
      openedAt: kd.openedAt, early: kd.early, onRelapse: kd.onRelapse || undefined, baseStart: kd.baseStart || undefined, items: [], excludedTypes: [], causes: [], causeNote: '', plan: '', who: null, implementedAt: null,
      recordedAt: cx.today, recordedBy: me.id, startedAt: cx.today, notNeeded: null };
  }

  function remapDefect(env, fromIds, toId) {
    var set = Object.create(null), all = S.get(env, KEY, {}) || {}, n = 0;
    if (typeof all !== 'object' || Array.isArray(all)) all = {};
    (fromIds || []).forEach(function (id) { if (typeof id === 'string' && id !== toId) set[id] = 1; });
    var hitList = function (l) { return Array.isArray(l) && l.some(function (t) { return has(set, t); }); };
    var hitMap = function (m) { return isPlain(m) && Object.keys(m).some(function (t) { return has(set, t); }); };
    var hit = function (a) { return a && (hitList(a.items) || hitList(a.excludedTypes) || hitMap(a.itemCauses) || hitMap(a.itemNotes)); };
    var remap = function (l) { var out = []; l.forEach(function (t) { var x = has(set, t) ? toId : t; if (out.indexOf(x) < 0) out.push(x); }); return out; };
    var remapMap = function (m) { var out = {}; Object.keys(m).forEach(function (t) { var x = has(set, t) ? toId : t; if (!has(out, x)) out[x] = m[t]; }); return out; };
    (env.db.kdSeed || []).forEach(function (a) { if (hit(a) && !has(all, a.id)) all[a.id] = clone(a); });
    Object.keys(all).forEach(function (id) {
      var a = all[id];
      if (!hit(a)) return;
      if (Array.isArray(a.items)) a.items = remap(a.items);
      if (Array.isArray(a.excludedTypes)) a.excludedTypes = remap(a.excludedTypes);
      if (isPlain(a.itemCauses)) {
        a.itemCauses = remapMap(a.itemCauses);
        if (Array.isArray(a.causes)) a.causes = a.causes.filter(function (c) { return Object.keys(a.itemCauses).some(function (t) { return a.itemCauses[t] === c; }); });
      }
      if (isPlain(a.itemNotes)) a.itemNotes = remapMap(a.itemNotes);
      n++;
    });
    if (n) { S.set(env, KEY, all); env.reload(); }
    return n;
  }
  P.demoKd = {
    remapDefect: remapDefect,
    kdFrom: function (env) { var k = kdStart(env); return { real: k.real, from: k.from }; },
    withKdFrom: function (env, out) { var k = kdStart(env); if (k.real && out && out.ok) out.kdFrom = k.from; return out; },
    locSummary: function (env, locId, from, to) { return locSummary(env, locId, from, to); },
    selfClosed: function (env, locId, from, to) {
      if (!has(env.ix.loc, locId)) return [];
      var cx = makeCx(env, env.ix.loc[locId]), rg = rangeOf({ from: from, to: to }, env);
      return selfClosedIn(cx, cx.all(), rg.from, rg.to);
    },
    deptNow: function (env, locId, depId) {
      if (!has(env.ix.loc, locId)) return null;
      var cx = makeCx(env, env.ix.loc[locId]);
      if (!depOf(cx, depId)) return null;
      var act = activeNow(cx, depId);
      if (!act.length) return null;
      var all = act.map(function (a) { var x = view(cx, a); x.threshold = cx.T; return x; }), v = clone(all[all.length - 1]);
      v.all = all;
      return v;
    }
  };

  function canSummary(me, locId) {
    if (me.role === 'manager' || me.role === 'admin') return C.hasLoc(me, locId) || !!(me.can && me.can.viewAllLocations);
    return me.role === 'senior_auditor' && C.hasLoc(me, locId);
  }
  var RANK = { 'new': 0, pre: 1, check: 2, hold: 3 };
  function byRank(a, b) {
    var ra = has(RANK, a.status) ? RANK[a.status] : 5, rb = has(RANK, b.status) ? RANK[b.status] : 5;
    return ra - rb || b.period - a.period || (a.departmentName < b.departmentName ? -1 : 1);
  }

  P.demoApis.push({
    srKdCauses: function () { return { ok: true, causes: clone(CAUSES) }; },

    srKdOverview: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), from = since(cx, 30), R = cx.R;
      var depts = cx.deps.map(function (d, order) {
        var kds = cx.kds(d.id), last = cx.wk(d.id, cx.L), cur = cx.wk(d.id, cx.L + 1), act = activeNow(cx, d.id).map(function (a) { return view(cx, a); });
        return { id: d.id, name: d.name, order: order, last: last, cur: cur, earlyLeft: Math.max(0, R.early - cur.checked), earlyOff: act.length > 0,
          series: series(cx, d.id, cx.L - MINI_BARS + 1, cx.L), kd: act.length ? act[act.length - 1] : null, kds: act,
          states: stateCounts(kds, from), total: kds.length };
      }).sort(function (a, b) {
        var oa = a.kds.some(function (x) { return x.phase === 'open'; }), ob = b.kds.some(function (x) { return x.phase === 'open'; });
        return ob - oa || !!b.kd - !!a.kd || a.order - b.order;
      });
      var sum = { depts: depts.length, audits: 0, checked: 0, rejected: 0, over: 0 };
      depts.forEach(function (d) { sum.audits += d.last.audits; sum.checked += d.last.checked; sum.rejected += d.last.rejected; if (d.last.over) sum.over++; });
      sum.rate = C.pct(sum.rejected, sum.checked);
      return { ok: true, review: reviewOf(cx), rules: rulesOut(R), totals: totals(cx), states: stateCounts(cx.all(), from), sum: sum, depts: depts,
        actionsTotal: cx.all().length, threshold: R.threshold, today: cx.today };
    },

    srKdDept: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), dep = depOf(cx, p.departmentId);
      if (!dep) return C.fail('not_found', 'Відділ не знайдено. Поверніться до всіх відділів.');
      var n = periodArg(cx, p.period);
      if (n == null) return C.fail('not_found', 'Такого тижня немає. Оберіть тиждень зі списку.');
      var per = cx.wk(dep.id, n), st = cx.range(dep.id, per.start, per.end), win = chartWindow(cx, n), kds = cx.kds(dep.id);
      var mine = kds.filter(function (a) { return a.n === n; })[0] || null, cov = coverAt(cx, dep.id, n, mine);
      var par = paretoIds(env, st.byType, cx.R.pareto, []), ids = {};
      env.db.defectTypes.forEach(function (t) { if (t.deptTypeId === dep.deptTypeId) ids[t.id] = 1; });
      Object.keys(st.byType).forEach(function (t) { if (has(env.ix.def, t)) ids[t] = 1; });
      var types = Object.keys(ids).map(function (id) {
        var t = env.ix.def[id], pcs = st.byType[id] || 0, route = routeOf(cx, dep.id, id, routeFrom(cx, dep.id, id));
        return { defectTypeId: id, name: t.name, level: t.level || 'fix', active: t.active !== false, pieces: pcs, rate: C.pct(pcs, per.checked),
          share: C.pct(pcs, per.rejected), pareto: par.indexOf(id) >= 0, inKd: !!mine && itemIds(cx, mine).indexOf(id) >= 0,
          dyn: typeSeries(cx, dep.id, id, n - MINI_BARS + 1, n), state: typeState(cx, dep.id, id), route: route.slice(-4), routeLen: route.length };
      }).filter(function (x) { return x.active || x.state.status !== 'none' || x.dyn.some(function (y) { return y.pieces > 0; }); })
        .sort(function (a, b) { return b.pieces - a.pieces || (a.name < b.name ? -1 : 1); });
      var periods = [];
      for (var k = cx.L + 1; k > cx.L + 1 - PERIOD_LIST && k >= 0; k--) periods.push(cx.wk(dep.id, k));
      if (n < periods[periods.length - 1].n) periods.push(cx.wk(dep.id, n));
      periods = periods.map(function (x) { return { n: x.n, start: x.start, end: x.end, current: x.current, rate: x.rate, over: x.over }; });
      var uc = 0, ur = 0;
      for (var q = Math.max(0, n - 3); q <= n; q++) { var su = cx.wk(dep.id, q); uc += su.checked; ur += su.rejected; }
      var actions = kds.map(function (a) { return view(cx, a); }).sort(byRank);
      return { ok: true, review: reviewOf(cx), rules: rulesOut(cx.R), dept: { id: dep.id, name: dep.name }, threshold: cx.T, canWrite: S.canManage(me), today: cx.today,
        period: per, blur: S.blur(per.rate, C.pct(ur, uc), per.checked, null, cx.T), decide: n >= cx.L, minPeriod: Math.max(0, cx.L - MAX_BACK), maxPeriod: cx.L + 1,
        periods: periods, series: series(cx, dep.id, win.from, win.to), kd: mine ? view(cx, mine) : null,
        cover: cov ? view(cx, cov) : null, pareto: par, types: types, actions: actions, states: stateCounts(kds) };
    },

    srKdType: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), dep = depOf(cx, p.departmentId), t = typeOf(cx, p.defectTypeId);
      if (!dep) return C.fail('not_found', 'Відділ не знайдено. Поверніться до всіх відділів.');
      var n = periodArg(cx, p.period);
      if (n == null) return C.fail('not_found', 'Такого тижня немає. Оберіть тиждень зі списку.');
      var per = cx.wk(dep.id, n), st = cx.range(dep.id, per.start, per.end);
      if (!t || (t.deptTypeId !== dep.deptTypeId && !has(st.byType, t.id))) return C.fail('not_found', 'Такого виду браку у відділі не знайдено. Оновіть сторінку.');
      var pcs = st.byType[t.id] || 0, prev = cx.wk(dep.id, n - 1), pst = cx.range(dep.id, prev.start, prev.end), ppcs = pst.byType[t.id] || 0;
      var d = details(cx, dep.id, t.id, per.start, per.end), win = chartWindow(cx, n), par = paretoIds(env, st.byType, cx.R.pareto, []);
      var withDefect = Object.keys(st.byType).filter(function (id) { return st.byType[id] > 0; });
      var history = cx.kds(dep.id).filter(function (a) { return itemIds(cx, a).indexOf(t.id) >= 0; }).map(function (a) { return view(cx, a); }).reverse();
      return { ok: true, dept: { id: dep.id, name: dep.name }, type: { id: t.id, name: t.name, level: t.level || 'fix', active: t.active !== false },
        threshold: cx.T, rules: rulesOut(cx.R), canWrite: S.canManage(me), today: cx.today, decide: n >= cx.L, period: per,
        pieces: pcs, checked: per.checked, rate: C.pct(pcs, per.checked), share: C.pct(pcs, per.rejected), pareto: par.indexOf(t.id) >= 0,
        prev: { n: prev.n, start: prev.start, end: prev.end, pieces: ppcs, checked: prev.checked, rate: C.pct(ppcs, prev.checked) },
        rank: pcs ? 1 + withDefect.filter(function (id) { return st.byType[id] > pcs; }).length : null, rankOf: withDefect.length,
        series: typeSeries(cx, dep.id, t.id, win.from, win.to),
        workers: d.workers, auditors: d.auditors, products: d.products, orders: d.orders, days: d.days, auditsWith: d.auditsWith, auditsTotal: d.auditsTotal,
        history: history, state: typeState(cx, dep.id, t.id), route: routeOf(cx, dep.id, t.id, routeFrom(cx, dep.id, t.id)) };
    },

    srKdItem: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), a;
      if (p.id) { a = findAction(cx, p.id); if (!a) return C.fail('not_found', 'Коригуючу дію не знайдено. Оновіть сторінку.'); }
      else if (typeof p.key === 'string' && (a = cx.all().filter(function (x) { return x.key === p.key; })[0])) { /* знайдено за ключем */ }
      else { var o = openKd(cx, p); if (o.err) return o.err; a = o.kd; }
      var v = view(cx, a), d = details(cx, a.departmentId, null, a.weekStart, a.weekEnd);
      v.series = series(cx, a.departmentId, Math.min(cx.L - DEPT_BARS + 1, a.n - 2), cx.L + 1);
      v.workers = d.workers; v.auditors = d.auditors; v.products = d.products; v.auditsTotal = d.auditsTotal;
      v.items.forEach(function (it) { var x = details(cx, a.departmentId, it.defectTypeId, a.weekStart, a.weekEnd); it.workers = x.workers.slice(0, 5); it.products = x.products.slice(0, 3); it.auditsWith = x.auditsWith; });
      return { ok: true, item: v, review: reviewOf(cx), rules: rulesOut(cx.R), causes: clone(CAUSES), people: people(cx, me), today: cx.today,
        threshold: cx.T, canWrite: S.canManage(me) };
    },

    srKdList: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), dep = typeof p.departmentId === 'string' && p.departmentId ? p.departmentId : null;
      var all = cx.all().filter(function (a) { return !dep || a.departmentId === dep; }).map(function (a) { return view(cx, a); });
      var counts = { 'new': 0, check: 0, hold: 0, helped: 0, not_helped: 0, not_needed: 0, pre: 0, held_types: 0, self_closed: 0, all: all.length };
      all.forEach(function (a) { counts[a.status]++; });
      var state = has(counts, p.state) ? p.state : 'all';
      return { ok: true, state: state, counts: counts, items: all.filter(function (a) { return state === 'all' || a.status === state; }).sort(byRank),
        review: reviewOf(cx), rules: rulesOut(cx.R), today: cx.today, threshold: cx.T,
        departments: cx.deps.map(function (d) { return { id: d.id, name: d.name }; }) };
    },

    srKdStats: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var cx = makeCx(env, r.loc), days = Number(p.days) === 90 ? 90 : 30, from = since(cx, days), ids = p.departmentIds, set = null;
      if (!(ids == null || ids === '' || (Array.isArray(ids) && !ids.length))) {
        if (!Array.isArray(ids) || ids.length > 100 || ids.some(function (id) { return !depOf(cx, id); })) return C.fail('not_found', 'Такого відділу в локації немає. Оновіть сторінку.');
        set = Object.create(null); ids.forEach(function (id) { set[id] = 1; });
      }
      var deps = cx.deps.filter(function (d) { return !set || set[d.id]; }), all = [];
      deps.forEach(function (d) { all = all.concat(cx.kds(d.id)); });
      var weeks = [];
      for (var n = cx.of(from); n <= cx.L + 1; n++) weeks.push(n);
      var byWeek = weeks.map(function (x) {
        var o = { n: x, start: cx.start(x), end: cx.end(x), current: x > cx.L, checked: 0, rejected: 0, overDepts: 0 };
        deps.forEach(function (d) { var w = cx.wk(d.id, x); o.checked += w.checked; o.rejected += w.rejected; if (w.over && x <= cx.L) o.overDepts++; });
        o.rate = C.pct(o.rejected, o.checked);
        var mine = all.filter(function (a) { return a.n === x; });
        o.states = stateCounts(mine); o.opened = mine.length; o.early = mine.filter(function (a) { return a.early; }).length;
        o.relapse = all.filter(function (a) { return a.relapseN === x; }).length;
        o.items = mine.map(function (a) { var v = view(cx, a); return { id: v.id, key: v.key, departmentId: v.departmentId, departmentName: v.departmentName, rate: v.rate, state: v.state, early: v.early, earlyBelow: v.earlyBelow, name: v.name }; });
        o.earlyBelow = o.items.filter(function (i) { return i.earlyBelow; }).length;
        return o;
      });
      var ps = periodSum(cx, all, from, cx.today);
      ps.relapse = all.filter(function (a) { return a.status === 'not_helped' && a.finishedOn >= from; }).length;
      ps.weeks = weeks.length; ps.waiting = all.filter(function (a) { return a.status === 'new'; }).length;
      var stDepts = deps.map(function (d) {
        var kds = cx.kds(d.id), inWin = kds.filter(function (a) { return a.openedAt >= from || !a.finishedOn || a.finishedOn >= from; });
        var deltas = [];
        inWin.forEach(function (a) { if (PHASE_OF[a.status] !== 'open' && a.status !== 'check' && a.status !== 'not_needed') view(cx, a).items.forEach(function (it) { if (it.delta != null) deltas.push({ d: it.delta, b: it.before }); }); });
        var tids = {};
        env.db.defectTypes.forEach(function (t) { if (t.deptTypeId === d.deptTypeId) tids[t.id] = 1; });
        kds.forEach(function (a) { itemIds(cx, a).forEach(function (t) { tids[t] = 1; }); });
        var lw = cx.wk(d.id, cx.L), lst = cx.range(d.id, lw.start, lw.end), rf = cx.of(from) - 1;
        var types = Object.keys(tids).filter(function (id) { return has(env.ix.def, id); }).map(function (id) {
          var t = env.ix.def[id], pcs = lst.byType[id] || 0, withIt = kds.filter(function (a) { return itemIds(cx, a).indexOf(id) >= 0; });
          var last = withIt[withIt.length - 1], lv = last ? view(cx, last) : null, li = lv ? lv.items.filter(function (it) { return it.defectTypeId === id; })[0] : null;
          return { defectTypeId: id, name: t.name, level: t.level || 'fix', active: t.active !== false, rate: C.pct(pcs, lw.checked), pieces: pcs, share: C.pct(pcs, lw.rejected),
            kds: withIt.filter(function (a) { return inWin.indexOf(a) >= 0; }).length,
            last: lv ? { id: lv.id, key: lv.key, period: lv.period, periodStart: lv.periodStart, periodEnd: lv.periodEnd, status: lv.status, state: lv.state,
              before: li.before, after: li.after, after2: li.after2, delta: li.delta, result: lv.result } : null,
            route: routeOf(cx, d.id, id, rf) };
        }).filter(function (x) { return x.active || x.last || x.pieces > 0; }).sort(function (a, b) { return (b.rate || 0) - (a.rate || 0) || (a.name < b.name ? -1 : 1); });
        return { id: d.id, name: d.name, weekRate: lw.rate, over: lw.over, states: stateCounts(inWin, from), total: inWin.length,
          effect: deltas.length ? { n: deltas.length, pp: r1(mean(deltas.map(function (x) { return x.d; }))),
            rel: Math.round(mean(deltas.filter(function (x) { return x.b; }).map(function (x) { return x.d / x.b * 100; }))) } : null, types: types };
      });
      return { ok: true, days: days, from: from, review: reviewOf(cx), rules: rulesOut(cx.R), today: cx.today, threshold: cx.T,
        departments: cx.deps.map(function (d) { return { id: d.id, name: d.name }; }), departmentIds: set ? Object.keys(set) : [],
        kpi: ps, byWeek: byWeek, depts: stDepts };
    },

    srKdWorker: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var w = typeof p.code === 'string' && has(env.ix.worker, r.loc.id + ':' + p.code) ? env.ix.worker[r.loc.id + ':' + p.code] : null;
      if (!w) return C.fail('not_found', 'Працівника не знайдено. Оновіть сторінку.');
      var rg = rangeOf(p, env), pieces = Object.create(null);
      S.audits(env, r.loc.id, rg.from, rg.to).forEach(function (a) {
        a.defects.forEach(function (d) { d.guilty.forEach(function (g) { if (g.workerCode === w.code && g.qty > 0) pieces[d.defectTypeId] = (pieces[d.defectTypeId] || 0) + g.qty; }); });
      });
      var cx = makeCx(env, r.loc), items = has(cx.env.ix.dep, w.departmentId) && depOf(cx, w.departmentId) ? cx.kds(w.departmentId).filter(function (a) {
        return a.openedAt <= rg.to && !(a.finishedOn && a.finishedOn < rg.from) && itemIds(cx, a).some(function (t) { return has(pieces, t); });
      }).map(function (a) {
        var v = view(cx, a), mineT = v.items.filter(function (it) { return has(pieces, it.defectTypeId); });
        v.defectTypeId = mineT[0].defectTypeId; v.workerTypes = mineT.map(function (it) { return it.name; });
        return v;
      }).sort(byRank) : [];
      var types = Object.keys(pieces).filter(function (id) { return has(env.ix.def, id); }).map(function (id) {
        return { id: id, name: env.ix.def[id].name, pieces: pieces[id], actions: items.filter(function (a) { return a.items.some(function (it) { return it.defectTypeId === id; }); }).length };
      }).sort(function (a, b) { return b.pieces - a.pieces || (a.name < b.name ? -1 : 1); });
      return { ok: true, from: rg.from, to: rg.to, today: cx.today, threshold: cx.T,
        worker: { name: w.name, departmentId: w.departmentId, departmentName: env.ix.dep[w.departmentId] ? env.ix.dep[w.departmentId].name : '' },
        types: types, items: items };
    },

    kdLocSummary: function (p, me, env) {
      var id = typeof p.locationId === 'string' ? p.locationId : '';
      if (!has(env.ix.loc, id)) return C.fail('not_found', 'Локацію не знайдено.');
      if (!canSummary(me, id)) return C.forbidden();
      return locSummary(env, id, p.from, p.to);
    },

    srKdPlanItems: function (p, me, env) {
      var w = writable(p, me, env); if (w.err) return w.err;
      var cx = w.cx, editing = !!p.id, kd, lock = false;
      if (editing) {
        kd = findAction(cx, p.id);
        if (!kd) return C.fail('not_found', 'Коригуючу дію не знайдено. Оновіть сторінку.');
        if (kd.status === 'not_needed') return C.fail('conflict', 'У цієї коригуючої дії немає плану: її позначено «дія не потрібна».');
        if (!kd.implementedAt) return C.fail('conflict', 'Для цієї коригуючої дії ще не записано впроваджений план.');
        lock = kd.status !== 'check';
      } else {
        var o = openKd(cx, p); if (o.err) return o.err;
        kd = o.kd;
      }
      var pi = planItems(cx, kd, p.day, editing, lock), day = pi.fz ? p.day : editing ? kd.implementedAt : cx.today;
      var st = cx.range(kd.departmentId, baseStartOf(kd), day), def = cx.env.ix.def;   // v4.0: ті самі дні, що й заморожування (база дії)
      return { ok: true, day: day, items: pi.ids.map(function (t) {
        var pcs = st.byType[t] || 0;
        return { defectTypeId: t, name: def[t].name, level: def[t].level || 'fix', pieces: pcs, share: C.pct(pcs, st.rejected) };
      }) };
    },

    srKdImplement: function (p, me, env) {
      var w = writable(p, me, env); if (w.err) return w.err;
      var cx = w.cx, o = openKd(cx, p); if (o.err) return o.err;
      var pi = planItems(cx, o.kd, p.day, false, false), fz = pi.fz;
      var errs = planErrors(cx, me, p, o.kd, false, pi.ids);
      if (errs.length) return C.fail('validation', 'Перевірте поля — дещо не заповнено.', errs);
      var rec = newRec(cx, o.kd, me);
      rec.plan = String(p.plan).trim(); rec.who = p.who; rec.implementedAt = p.day;
      rec.items = fz.ids; rec.excludedTypes = fz.excl;
      setCauses(cx, rec, p, rec.items);
      save(env, rec);
      return after(env, cx.loc, rec.id);
    },

    srKdEditPlan: function (p, me, env) {
      var w = writable(p, me, env); if (w.err) return w.err;
      var cx = w.cx, a = findAction(cx, p.id);
      if (!a) return C.fail('not_found', 'Коригуючу дію не знайдено. Оновіть сторінку.');
      if (a.status === 'not_needed') return C.fail('conflict', 'У цієї коригуючої дії немає плану: її позначено «дія не потрібна».');
      if (!a.implementedAt) return C.fail('conflict', 'Для цієї коригуючої дії ще не записано впроваджений план.');
      var lock = a.status !== 'check';
      var pi = planItems(cx, a, p.day, true, lock), fz = pi.fz;
      var errs = planErrors(cx, me, p, a, lock, pi.ids);
      if (errs.length) return C.fail('validation', 'Перевірте поля — дещо не заповнено.', errs);
      var rec = clone(a);
      rec.plan = String(p.plan).trim(); rec.who = p.who;
      if (fz) { rec.implementedAt = p.day; rec.items = fz.ids; rec.excludedTypes = fz.excl; }
      setCauses(cx, rec, p, pi.ids);
      save(env, rec);
      return after(env, cx.loc, rec.id);
    },

    srKdNotNeeded: function (p, me, env) {
      var w = writable(p, me, env); if (w.err) return w.err;
      var cx = w.cx, reason = String(p.reason || '').trim(), rec, kd = null;
      if (reason.length < 3) return C.fail('validation', 'Напишіть причину.', [{ field: 'reason', message: 'Напишіть коротко, чому дія не потрібна.' }]);
      if (reason.length > 300) return C.fail('validation', 'Причина задовга.', [{ field: 'reason', message: 'Коротше, будь ласка: до 300 знаків.' }]);
      if (p.id) {
        var a = findAction(cx, p.id);
        if (!a) return C.fail('not_found', 'Коригуючу дію не знайдено. Оновіть сторінку.');
        if (PHASE_OF[a.status] === 'open') kd = a;
        else if (a.status !== 'not_needed') return C.fail('conflict', a.status === 'self_closed' ? 'Ця дія вже закрилась сама (без участі старшого) — позначати її не потрібно.' : 'Для цієї коригуючої дії вже записано впроваджений план, тому позначити «дія не потрібна» не можна.');
        else { rec = clone(a); rec.notNeeded = { reason: reason, at: a.notNeeded.at, by: me.id }; }
      } else {
        var o = openKd(cx, p); if (o.err) return o.err;
        kd = o.kd;
      }
      if (kd) {
        var lv = live(cx, kd);
        rec = newRec(cx, kd, me); rec.who = me.id; rec.notNeeded = { reason: reason, at: cx.today, by: me.id };
        rec.items = lv.ids.slice(); rec.excludedTypes = lv.excl.slice();
      }
      save(env, rec);
      return after(env, cx.loc, rec.id);
    },

    srKdAnalysis: function (p, me, env) {
      var w = writable(p, me, env); if (w.err) return w.err;
      var cx = w.cx, note = p.note == null ? '' : typeof p.note === 'string' ? p.note.trim() : null, kd;
      if (note === null) return C.fail('validation', 'Перевірте нотатку.', [{ field: 'note', message: 'Нотатка — це текст. Оновіть сторінку й спробуйте ще раз.' }]);
      if (note.length > NOTE_MAX) return C.fail('validation', 'Нотатка задовга.', [{ field: 'note', message: 'Коротше, будь ласка: до ' + NOTE_MAX + ' знаків.' }]);
      if (p.id) {
        kd = findAction(cx, p.id);
        if (!kd) return C.fail('not_found', 'Коригуючу дію не знайдено. Оновіть сторінку.');
        if (PHASE_OF[kd.status] !== 'open') return C.fail('conflict', 'Аналіз можна почати лише в дії без плану. Оновіть сторінку — побачите, як є зараз.');
      } else {
        var o = openKd(cx, p); if (o.err) return o.err;
        kd = o.kd;
      }
      var rec = newRec(cx, kd, me), had = isDay(rec.analysisAt), old = typeof rec.analysisNote === 'string' ? rec.analysisNote : '';
      if (had && !p.edit && old && note && note !== old) return C.fail('conflict', 'Аналіз уже почато, у нього є нотатка. Оновіть сторінку — побачите її й зможете змінити.');
      if (!had) { rec.analysisAt = cx.today; rec.analysisBy = me.id; }
      if (p.edit || !had || !old) rec.analysisNote = note;
      save(env, rec);
      return after(env, cx.loc, rec.id);
    }
  });

  P.demoKd.internal = { makeCx: makeCx, view: view, itemIds: itemIds, isActive: isActive, activeAt: activeAt, depOf: depOf,
    periodSum: periodSum, paretoIds: paretoIds, sumOf: sumOf, rangeRate: rangeRate, PHASE_OF: PHASE_OF, STATE_OF: STATE_OF,
    OBS: OBS, auditDays: auditDays, projectDay: projectDay, baseStartOf: baseStartOf };

  P.demoGenHooks.push(genHook);
  P.demoLoadHooks.push(loadHook);
  P.demoResetKeys.push(KEY, KD2_KEY, OLD_KEY);
})(typeof window !== 'undefined' ? window : globalThis);

