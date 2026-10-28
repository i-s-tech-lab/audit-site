(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, K = P.srKd, B = K.board;
  var PHASE = { open: 'Без плану', relapse: 'Рецидив · потрібен новий план' };
  var FINAL = { helped: 'Закрито: тримається', held_types: 'Закрито: її види браку нижче, ніж до дії', not_needed: 'Дія не потрібна', not_helped: 'Закрито: рецидив',
    self_closed: 'Закрито без участі старшого' };

  var def = { tab: 'kd', title: 'Коригуючі дії', period: false, render: function (ctx) {
    var depId = ctx.params.id, key = ctx.params.key || null, data = null, req = 0, q = ctx.query || {};
    var st = { t: q.t || '', p: null, ask: !!q.t }, tdata = null, treq = 0, first = true;
    ctx.soft = load;   // після запису K.done перечитує сторінку без стрибка
    B.bind(ctx, function () { return data && data.kd; });
    K.bindActions(ctx, function (t) { return K.finder([data && data.kd].concat(tdata ? tdata.history : []))(t); });   // кнопки в розгорнутому виді браку
    ctx.on('kb-type', function (t) { var id = t.getAttribute('data-type'); st.t = st.t === id ? '' : id; st.p = null; tdata = null; drawTypes(); });
    ctx.on('kd-show', function (t) { st.p = +t.getAttribute('data-n'); tdata = null; showType(); });
    ctx.on('kd-route', function (t) { K.openRouteOf(ctx, depId, t.getAttribute('data-type')); });
    ctx.on('kd-worker', function (t) { if (P.srPeople) P.srPeople.openWorker(ctx, t.getAttribute('data-code')); });
    ctx.on('retry', function () { load(); });
    if (!key && /^\d{1,6}$/.test(q.p || '')) fromPeriod(+q.p); else load();
    function fromPeriod(n) {
      P.srv('srKdDept', { locationId: ctx.loc.id, departmentId: depId, period: n }).then(function (r) {
        if (!ctx.alive()) return;
        var a = r.ok ? r.kd || r.cover : null;
        if (a) {
          key = a.key || depId + '|' + a.periodStart;
          try { root.history.replaceState(null, '', B.href(depId, key) + (st.t ? '?t=' + encodeURIComponent(st.t) : '')); } catch (e) { /* без історії — не страшно */ }
        }
        load();
      });
    }
    function drawTypes() {
      var box = ctx.el.querySelector('[data-kb-types]');
      if (!box || !data || !data.kd) return;
      box.innerHTML = typesCard(data.kd, data, st.t);
      if (st.t) showType();
    }
    function showType() {
      var my = ++treq, panel = ctx.el.querySelector('[data-kb-panel]');
      if (!panel) return;
      var paint = function (r) { var el = ctx.el.querySelector('[data-kb-panel]'); if (!el) return; el.innerHTML = K.typePanel(r, { today: data.today }); K.typePanelMount(el, r); };
      if (tdata) { paint(tdata); return; }
      panel.innerHTML = P.sr.h.loading();
      P.srv('srKdType', { locationId: ctx.loc.id, departmentId: depId, defectTypeId: st.t, period: st.p }).then(function (r) {
        if (!ctx.alive() || my !== treq) return;
        if (!r.ok) { var el = ctx.el.querySelector('[data-kb-panel]'); if (el) el.innerHTML = P.sr.h.error(r); return; }
        tdata = r; paint(r);
      });
    }
    function load() {
      var my = ++req;
      if (data) ctx.el.classList.add('kd-busy');
      P.srv('srKdPage', { locationId: ctx.loc.id, departmentId: depId, key: key }).then(function (r) {
        if (!ctx.alive() || my !== req) return;
        ctx.el.classList.remove('kd-busy');
        if (!r.ok) { data = null; ctx.el.innerHTML = '<div class="kb"><a class="kb-out kb-back" href="#/kd">← Усі відділи</a>' + P.sr.h.error(r) + '</div>'; return; }
        data = r;
        if (B.kdWait(r)) { ctx.el.innerHTML = '<div class="kb"><a class="kb-out kb-back" href="#/kd">← Усі відділи</a>' + B.kdFromNote(r) + '</div>'; return; }
        ctx.el.innerHTML = '<div class="kb">' + B.compactBar(r, r.dept.id) + B.ruleLine(B.weekOf(r.tiles) && B.weekOf(r.tiles).start, r.threshold, null, { list: '#/kd/list?dep=' + encodeURIComponent(r.dept.id), after: '#/kd/stats?dep=' + encodeURIComponent(r.dept.id) }) + B.kdFromNote(r) + B.tiles(r, r.dept.id) +
          kdRow(r, !!(r.kd && (r.actives.length || key))) + (r.kd && (r.actives.length || key) ? page(r) : empty(r)) + '</div>';
        B.mountCompact(ctx);
        var inKd = !!(r.kd && (r.kd.types || []).some(function (x) { return x.defectTypeId === st.t; }));
        if (st.t && !inKd) { if (st.ask) K.openTypeWindow(ctx, depId, st.t); st.t = ''; tdata = null; }
        st.ask = false;
        drawTypes();
        if (first && inKd) { var row = ctx.el.querySelector('[data-kb-panel]'); if (row) row.scrollIntoView({ block: 'start' }); }
        first = false;
      });
    }
  } };
  P.sr.screen('/kd/dept/:id', def);
  P.sr.screen('/kd/dept/:id/:key', def);

  function obsText(a) { return a.extra ? 'до розбору — дні ще не рахуються' : (a.obsDay || 0) + ' з 14 днів'; }
  function actText(a) {
    if (a.phase === 'observe') return '№' + a.no + ' · на спостереженні · ' + obsText(a);
    if (a.phase === 'relapse') return '№' + a.no + ' · рецидив · ' + (a.analysis ? B.anText(a) : 'потрібен новий план');
    return '№' + a.no + ' · ' + (a.analysis ? B.anText(a) : 'без плану') + (a.early ? ' · достроково' : '');
  }
  function kdRow(r, shown) {
    var kd = r.kd, sel = kd ? kd.key : null, list = r.actives || [];
    var chips = list.map(function (a) {
      return '<a class="kb-kdi' + (a.key === sel ? ' kb-kdi--on' : '') + '" href="' + B.href(r.dept.id, a.key) + '"><i class="kb-dot kb-dot--' + B.kindOf(a.phase) + '"></i>' + esc(actText(a)) + '</a>';
    }).join('');
    if (shown && kd.phaseUi === 'final' && !list.some(function (a) { return a.key === sel; })) {
      chips += '<a class="kb-kdi kb-kdi--on" href="' + B.href(r.dept.id, kd.key) + '">' + (kd.status === 'not_needed' ? '○' : '✓') + ' №' + kd.no + ' · ' + (kd.closedEarly ? 'закрито достроково ' : kd.selfClosed ? 'закрито без участі старшого ' : 'закрито ') + B.day(kd.finishedOn || kd.notNeededAt) + '</a>';
    }
    (r.quiet || []).forEach(function (x) { if (!shown || x.key !== sel) chips += '<a class="kb-kdi" href="' + B.href(r.dept.id, x.key) + '">' + B.quietChip(x) + '</a>'; });
    return '<div class="kb-kdrow"><span class="kb-cs kb-b">Відкриті дії відділу «' + esc(r.dept.name) + '»:</span>' + (chips || '<span class="kb-cs">зараз немає</span>') +
      '<span class="kb-cs">закриті дії зі списку прибираються · нумерація — з першої відкритої дії підряд</span></div>';
  }

  function empty(r) {
    var kd = r.kd;
    var last = kd ? '<a class="kb-out" href="' + B.href(r.dept.id, kd.key) + '">Остання закрита дія: №' + kd.no + ' · ' + esc((kd.closedEarly ? 'закрито достроково' : FINAL[kd.status] || 'закрито').toLowerCase()) +
      (kd.finishedOn ? ' · ' + B.day(kd.finishedOn) : '') + ' ›</a>' : '<span class="kb-cs">Закритих дій у відділі ще не було.</span>';
    return '<div class="kb-title"><h1>' + esc(r.dept.name) + ' · зараз дій немає</h1></div>' +
      B.card('Види браку відділу за останній завершений тиждень', 'kd.pareto', '', B.pareto(r.pareto) + '<div class="kb-row">' + last + '</div>');
  }

  function isEarly(kd) { return !!kd.early; }
  function liveWeek(kd) { return (kd.weeks || []).filter(function (w) { return w.status !== 'done'; })[0] || null; }
  function perName(w, big) { var t = w.kind === 'quiet' ? 'тихий нагляд' : w.n === 1 ? 'дні 1–7' : 'дні 8–14'; return big ? t.charAt(0).toUpperCase() + t.slice(1) : t; }
  function quietOf(kd) { return (kd.weeks || []).filter(function (w) { return w.kind === 'quiet'; })[0] || null; }
  function est(w) { return w && w.estimated ? '≈ ' : ''; }
  function phasePill(kd) {
    if (kd.closedEarly) {
      var q = quietOf(kd), qp = '';
      if (q && q.status === 'running') qp = '<span class="kb-pill kb-pill--quiet">тихий нагляд · ' + q.days + ' з 7 днів</span>';
      else if (q && q.status === 'done') qp = kd.quietReturned ? B.chip('rel', 'тихий нагляд: брак повернувся' + (kd.repeatedBy ? ' → повторна дія' : '')) : '<span class="kb-pill kb-pill--quiet">тихий нагляд пройдено</span>';
      return B.chip('done', 'Закрито достроково — після 7 днів · ' + B.day(kd.finishedOn)) + qp;
    }
    if (kd.phaseUi === 'final') return B.chip(kd.status === 'not_needed' ? 'skip' : kd.status === 'not_helped' ? 'rel' : kd.status === 'held_types' ? 'part' : 'done', esc(FINAL[kd.status] || 'Закрито') + (kd.finishedOn ? ' · ' + B.day(kd.finishedOn) : ''));
    if (kd.analysis) return B.chip(kd.phaseUi === 'relapse' ? 'rel' : 'open', (kd.phaseUi === 'relapse' ? 'Рецидив · ' : '') + 'Аналіз · ' + kd.analysis.days + '-й день');
    if (kd.phaseUi === 'observe') {
      var w = liveWeek(kd);
      if (kd.inExtra) return '<span class="kb-pill kb-pill--teal"><i class="kb-dot"></i>План є · до звичайного розбору дні не рахуються · спостереження з ' + esc(B.wd(kd.obsStart)) + '</span>';
      return '<span class="kb-pill kb-pill--teal"><i class="kb-dot"></i>На спостереженні · ' + (w ? perName(w) : 'дні 8–14') + ' · минуло ' + (kd.obsDay || 0) + ' з 14 днів з аудитами</span>';
    }
    return B.chip(kd.phaseUi === 'relapse' ? 'rel' : 'open', PHASE[kd.phaseUi] || 'Без плану');
  }
  function page(r) {
    var kd = r.kd, T = r.threshold, btns = '';
    if (r.canWrite && kd.canAnalysis) btns += '<button type="button" class="kb-out" data-act="kb-an"' + B.ref(kd) + '>' + (kd.analysis ? 'Нотатка аналізу' : 'Почати аналіз') + '</button>';   // v3.6
    if (r.canWrite && kd.canPlan) btns += '<button type="button" class="kb-main" data-act="kb-plan"' + B.ref(kd) + '>Записати план</button>';
    if (r.canWrite && kd.canNotNeeded) btns += '<button type="button" class="kb-out" data-act="kb-nn"' + B.ref(kd) + '>Позначити «Не потрібно»</button>';
    var pills = phasePill(kd) + (isEarly(kd) ? B.chip('open', 'відкрито достроково · ' + B.day(kd.openedAt)).replace('kb-pill--open', 'kb-pill--soft') : '') +
      (kd.repeatOf ? '<span class="kb-pill kb-pill--none">повторна — ' + (kd.onRelapse ? 'відкрита одразу після рецидиву' : 'після рецидиву') + '</span>' : '') + (!kd.repeatOf && kd.parallelWith && kd.parallelWith.length ? '<span class="kb-pill kb-pill--none">паралельна</span>' : '');   // повторна — без «паралельна» (одна дія, той самий №)
    return '<div class="kb-title"><h1>' + esc(kd.departmentName || r.dept.name) + ' · коригуюча дія №' + kd.no + '</h1>' + pills + (btns ? '<span class="kb-title__b">' + btns + '</span>' : '') + '</div>' +
      B.stages(kd) + anLine(kd) +
      '<div class="kb-kpis">' + kpis(kd, T) + '</div>' +
      '<div class="kb-g2">' + dailyCard(kd, T, r.today) + resultCard(kd, T, r.today) + '</div>' +
      '<div class="kb-g2"><div class="kb-col" data-kb-types></div><div class="kb-col">' + compCard(kd, T) + moreCard(kd, r.today, T) + '</div></div>';
  }

  function anLine(kd) {
    var a = kd.analysis;
    if (!a) return '';
    return '<p class="kb-an"><b>Аналіз ' + (a.to ? esc(B.rng(a.from, a.to)) : 'з ' + esc(B.wd(a.from)) + ' · ' + a.days + '-й день') + '</b>' + (a.byName ? ' · почав(ла) ' + esc(a.byName) : '') +
      (a.note ? ' · що перевіряють: «' + esc(a.note) + '»' : '') + B.help('kd.p.analysis') + '</p>';
  }

  function kpi(label, value, sub, cls, helpKey) {
    return '<div class="kb-kpi' + (cls ? ' kb-kpi--' + cls : '') + '"><span class="kb-kpi__l">' + esc(label) + (helpKey ? B.help(helpKey) : '') + '</span><span class="kb-kpi__v">' + value + '</span><span class="kb-kpi__s">' + sub + '</span></div>';
  }
  function startOf(kd) {
    if (kd.typesBefore != null) return kd.typesBefore;
    var t = kd.types || [];
    return t.length ? Math.round(t.reduce(function (s, x) { return s + (x.start || 0); }, 0) * 10) / 10 : null;
  }
  function startRange(kd) {
    return { from: kd.startFrom || kd.periodStart, to: kd.startTo || kd.periodEnd, pieces: kd.startPieces != null ? kd.startPieces : null };
  }
  function weekKpi(kd, n, start) {
    var w = (kd.weeks || []).filter(function (x) { return x.n === n; })[0];
    var label = w ? perName(w, true) + (w.kind === 'quiet' ? ' після закриття' : ' після плану') + (w.status === 'running' ? ', поки' : '') : n === 1 ? 'Дні 1–7 після плану' : 'Дні 8–14 після плану';
    var hk = n === 1 ? 'kd.p.after' : '';
    if (!w) return kpi(label, '—', kd.implementedAt ? (kd.status === 'not_helped' ? 'рецидив у днях 1–7 — далі не рахуємо' : '') : 'після впровадженого плану', '', hk);
    if (w.status === 'future') return kpi(label, '—', 'почнеться ' + est(w) + esc(B.wd(w.start)) + (kd.inExtra && n === 1 ? ' · до розбору дні не рахуються' : ''), '', hk);
    var cls = w.status === 'running' ? '' : w.verdict === 'relapse' ? 'bad' : w.typesRate != null && start != null && w.typesRate < start ? 'good' : '';
    return kpi(label, B.now(start, w.typesRate), (w.status === 'running' ? 'минуло ' + w.days + ' з 7 днів · ' : '') + 'види браку в дії · брак відділу ' + B.p(w.deptRate), cls, hk);
  }
  function kpis(kd, T) {
    var sp = kd.earlySplit, start = startOf(kd), out = [];
    out.push(kpi('Відкрито', esc(B.wd(kd.openedAt)), kd.onRelapse ? 'одразу після рецидиву · брак ' + B.p(kd.rate) + ' за ' + esc(B.rng(kd.openFrom, kd.openTo))
      : isEarly(kd) && sp && sp.before ? 'достроково · з ' + esc(B.wdShort(kd.periodStart)) + ' ' + B.num(sp.before.checked) + ' шт · <b>' + B.p(sp.before.rate) + '</b>'
      : 'на розборі · брак ' + B.p(kd.rate) + ' за ' + esc(B.rng(kd.periodStart, kd.periodEnd)), 'open', 'kd.p.opened'));
    if (kd.status === 'not_needed') out.push(kpi('Дія не потрібна', esc(B.wd(kd.notNeededAt)), esc(kd.notNeededReason || '')));
    else if (kd.selfClose) out.push(kpi('Закрито без участі старшого', esc(B.wd(kd.finishedOn)), 'аналізу й плану не було · брак упав за ' + esc(B.rng(kd.selfClose.from, kd.selfClose.to)), 'good', 'kd.p.self'));
    else out.push(kpi('План впроваджено', kd.implementedAt ? esc(B.wd(kd.implementedAt)) : '—', kd.implementedAt ? 'цього дня — фото «до дії»' + (kd.whoName ? ' · відповідає ' + esc(kd.whoName) : '') : 'ще не записано'));
    var sr = startRange(kd), plan = !!kd.implementedAt;
    out.push(kpi(plan ? 'Види браку в дії — до дії (фото)' : 'Види браку в дії — на початку', B.p(start), (plan ? 'фото: ' : '') + esc(B.rng(sr.from, sr.to)) + (sr.pieces != null ? ' · ' + B.num(sr.pieces) + ' шт' : ''), 'blue', 'kd.p.photo'));
    out.push(weekKpi(kd, 1, start));
    out.push(weekKpi(kd, 2, start));
    var lw = liveWeek(kd);
    if (kd.closedEarly) out.push(kpi('Результат', 'закрито достроково', 'після 7 днів · ' + esc(B.wd(kd.finishedOn)), 'good'));
    else if (kd.selfClose) out.push(kpi('Види браку в дії — після', B.now(start, kd.selfClose.typesRate), 'за ' + esc(B.rng(kd.selfClose.from, kd.selfClose.to)) + ' · брак відділу ' + B.p(kd.selfClose.deptRate), 'good'));
    else if (kd.phaseUi === 'final') out.push(kpi('Результат', esc((FINAL[kd.status] || 'закрито').replace('Закрито: ', '')), kd.finishedOn ? 'закрито ' + esc(B.wd(kd.finishedOn)) : ''));
    else if (lw) out.push(kpi('Результат', est(lw) + esc(B.wd(K.addDays(lw.end, 1))), 'після ' + (lw.n === 1 ? '7-го' : '14-го') + ' дня з аудитами' + (lw.estimated ? ' · дата — оцінка' : '')));
    else out.push(kpi('Результат', '—', 'після плану — 14 днів з аудитами'));
    return out.join('');
  }

  var STG = { before: ['kb-st--pre', ''], early: ['kb-st--open', 'Відкрита дія · без плану'], open: ['kb-st--open', 'Відкрита дія · без плану'], analysis: ['kb-st--analysis', 'Аналіз'], extra: ['kb-st--extra', 'До розбору'],
    week1: ['kb-st--w1', 'Дні 1–7 після плану'], week2: ['kb-st--w2', 'Дні 8–14'], quiet: ['kb-st--quiet', 'Тихий нагляд'] };
  function svgText(x, y, cls, txt, anchor) { return '<text class="' + cls + '" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + esc(txt) + '</text>'; }
  function stageText(kd, s, today) {
    var lab = STG[s.kind] ? STG[s.kind][1] : '', sub = [];
    if (s.kind === 'open' || s.kind === 'early') {
      if (!kd.implementedAt) sub.push('з ' + B.day(s.from));
      else sub.push(B.rng(s.from, s.to) + ' · план ' + B.day(kd.implementedAt));
    }
    if (s.kind === 'extra') { sub.push('дні не рахуються'); sub.push(B.rng(s.from, s.to)); }
    if (s.kind === 'analysis') sub.push(kd.implementedAt ? B.rng(s.from, s.to) + ' · план ' + B.day(kd.implementedAt) : 'з ' + B.day(s.from));   // v3.6
    var w = (kd.weeks || []).filter(function (x) { return (s.kind === 'week1' && x.n === 1) || ((s.kind === 'week2' || s.kind === 'quiet') && x.n === 2); })[0];
    if (w) {
      if (w.status === 'running') { lab = perName(w, true) + ' · ' + w.days + ' з 7'; sub.push('поки: брак відділу ' + B.p(w.deptRate)); sub.push('види браку в дії ' + B.p(w.typesRate)); }
      else if (w.status === 'done') sub.push('брак відділу ' + B.p(w.deptRate) + ' · види браку в дії ' + B.p(w.typesRate));
      else sub.push('з ' + est(w) + B.day(w.start));
    }
    return { lab: lab, sub: sub };
  }
  var OBS_Y = 299;
  function dailySvg(kd, T, today) {
    var d = kd.daily || {}, days = d.days || [], n = days.length;
    if (!n) return '<p class="kb-cs">Даних по днях немає.</p>';
    var x0 = 61, x1 = 772, step = n > 1 ? (x1 - x0) / (n - 1) : 0, X = function (i) { return x0 + step * i; };
    var vals = [];
    days.forEach(function (x) { if (!x.future) { if (x.dept != null) vals.push(x.dept); if (x.types != null) vals.push(x.types); } });
    var M = Math.max(8, Math.ceil((Math.max.apply(null, vals.concat([T])) + 0.6) / 2) * 2), Y = function (v) { return 276 - v / M * 216; };
    var ix = function (day, last) {   // індекс дня на осі (найближчий у межах), last — шукати з кінця
      var i, best = -1;
      for (i = 0; i < n; i++) { if (last ? days[i].day <= day : days[i].day >= day) { best = i; if (!last) break; } }
      return best < 0 ? (last ? 0 : n - 1) : best;
    };
    var openX = d.openDay ? Math.max(40, X(ix(d.openDay)) - step / 2) : null, planX = d.planDay ? X(ix(d.planDay)) + step / 2 : null;   // обидві — на межі днів (між блоками)
    var taken = [], labels = [];
    var boxOf = function (x, y, anchor, txt) {
      var w = txt.length * 6.2 + 4, a = anchor === 'end' ? x - w : anchor === 'middle' ? x - w / 2 : x;
      a = Math.max(38, Math.min(798 - w, a));
      return { a: a, b: a + w, c: y - 10, d: y + 3, y: y };
    };
    var free = function (bx) { return bx.c >= 12 && bx.d <= 290 && !taken.some(function (q) { return bx.a < q.b && bx.b > q.a && bx.c < q.d && bx.d > q.c; }); };
    var stText = function (x, y, cls, txt) { taken.push(boxOf(x, y, 'start', txt)); return svgText(x, y, cls, txt); };
    var lab = function (tries, cls, txt, pri, must) { labels.push({ tries: tries, cls: cls, text: txt, pri: pri, must: !!must }); };
    var placeLabels = function () {
      return labels.sort(function (p, q) { return q.pri - p.pri; }).map(function (l) {
        var hit = null;
        l.tries.some(function (t) { var bx = boxOf(t.x, t.y, t.anchor, l.text); if (free(bx)) hit = bx; return !!hit; });
        if (!hit && l.must) hit = boxOf(l.tries[0].x, l.tries[0].y, l.tries[0].anchor, l.text);
        if (!hit) return '';
        taken.push(hit);
        return svgText(hit.a + 2, hit.y, l.cls, l.text);
      }).join('');
    };
    var o = ['<svg class="kb-day" viewBox="0 0 800 364" role="img" aria-label="' + esc('Дія №' + kd.no + ': брак відділу і види браку в дії за останні 7 днів, по днях, на тлі етапів; під графіком — номери днів спостереження') + '">'];
    var blocks = (d.stages || []).map(function (s) {
      var a = Math.max(40, X(ix(s.from)) - step / 2 + (s.kind === 'before' ? 0 : 1.5)), b = Math.min(796, X(ix(s.to, true)) + step / 2 - 1.5);
      return { s: s, x: a, w: Math.max(0, b - a) };
    });
    blocks.forEach(function (b) { o.push('<rect class="' + (STG[b.s.kind] ? STG[b.s.kind][0] : 'kb-st--pre') + '" x="' + b.x.toFixed(1) + '" y="18" width="' + b.w.toFixed(1) + '" height="264" rx="10"></rect>'); });
    for (var g = 0, gs = M > 12 ? 4 : 2; g <= M; g += gs) {
      o.push('<line class="kb-day__grid" x1="40" y1="' + Y(g).toFixed(1) + '" x2="796" y2="' + Y(g).toFixed(1) + '"></line>');
      o.push(svgText(34, Y(g) + 4, 'kb-day__ax', Math.round(g) + '%', 'end'));
    }
    var fi = -1;
    days.forEach(function (x, i) { if (fi < 0 && x.future) fi = i; });
    if (fi >= 0) {
      var fx = X(fi) - step / 2;
      o.push('<rect class="kb-day__fut" x="' + fx.toFixed(1) + '" y="18" width="' + (796 - fx).toFixed(1) + '" height="264"></rect>');
      if (796 - fx > 56) { o.push(svgText((fx + 796) / 2, 274, 'kb-day__ax', 'попереду', 'middle')); taken.push(boxOf((fx + 796) / 2, 274, 'middle', 'попереду')); }
    }
    blocks.forEach(function (b) {
      if (b.s.kind === 'before') {   // повторна дія: до рецидиву йшла перша спроба з тим самим № — підписуємо, а не «дії ще не було»
        if (kd.repeatOf && b.w >= 90) { o.push(stText(b.x + 8, 35, 'kb-day__st kb-day__b', '№' + kd.no + ' · перша спроба')); o.push(stText(b.x + 8, 50, 'kb-day__st', 'до рецидиву ' + (d.openDay ? B.day(d.openDay) : ''))); }
        return;
      }
      if (b.w < 70) {   // вузький етап: лише коротка назва, якщо вміщається
        var short = { extra: 'до розбору', quiet: 'нагляд', week1: 'дні 1–7', week2: 'дні 8–14', analysis: 'аналіз' }[b.s.kind];
        if (short && b.w >= short.length * 5.6 + 10) o.push(stText(b.x + 5, 35, 'kb-day__st kb-day__b kb-day__st--' + b.s.kind, short));
        return;
      }
      var t = stageText(kd, b.s, today), cls = 'kb-day__st kb-day__st--' + b.s.kind, lx = b.x + 8, room = b.w - 12;
      if (b.s.kind === 'early') t.lab = kd.implementedAt ? 'Відкрито достроково' : 'Відкрито достроково · без плану';
      if (t.lab.length * 6 > room + 10 && b.s.kind === 'open' && 'Відкрита дія'.length * 6 <= room + 10) { t.lab = 'Відкрита дія'; t.sub.unshift('без плану'); }
      if (t.lab.length * 6 > room + 10 && b.s.kind === 'early' && !kd.implementedAt && 'Відкрито достроково'.length * 6 <= room + 10) { t.lab = 'Відкрито достроково'; t.sub.unshift('без плану'); }
      if (t.lab.length * 6 > room + 10) t.lab = { early: 'достроково', open: 'без плану', extra: 'до розбору' }[b.s.kind] || t.lab;
      if (t.lab.length * 6 > room + 16) return;
      t.sub = t.sub.filter(function (line) { return line.length * 5.6 <= room + (b.s.kind === 'open' || b.s.kind === 'early' ? 0 : 12); });
      if (openX != null && openX >= b.x - 2 && openX < b.x + 40) lx = openX + 6;   // підпис не налазить на лінію відкриття
      o.push(stText(lx, 35, cls + ' kb-day__b', t.lab));
      t.sub.forEach(function (line, k) { o.push(stText(lx, 50 + 13 * k, cls, line)); });
    });
    o.push('<line class="kb-day__norm" x1="40" y1="' + Y(T).toFixed(1) + '" x2="796" y2="' + Y(T).toFixed(1) + '"></line>');
    lab([{ x: 792, y: Y(T) - 6, anchor: 'end' }, { x: 792, y: Y(T) + 14, anchor: 'end' }, { x: 44, y: Y(T) - 6, anchor: 'start' }, { x: 44, y: Y(T) + 14, anchor: 'start' }], 'kb-day__normt', 'норма ' + T + '%', 5, true);
    var start = startOf(kd);
    if (kd.typesBefore != null) {
      var bx = planX != null ? planX : 40;
      o.push('<line class="kb-day__base" x1="' + bx.toFixed(1) + '" y1="' + Y(start).toFixed(1) + '" x2="796" y2="' + Y(start).toFixed(1) + '"></line>');
      lab([{ x: 792, y: Y(start) + 15, anchor: 'end' }, { x: 792, y: Y(start) - 6, anchor: 'end' }, { x: bx + 4, y: Y(start) - 6, anchor: 'start' }, { x: bx + 4, y: Y(start) + 15, anchor: 'start' }], 'kb-day__baset', 'до дії ' + B.p(start), 4, true);
      if (kd.earlyClose || (kd.weeks || []).some(function (w) { return w.n === 1 && w.close; })) {
        var hv = Math.round(start / 2 * 10) / 10, p1 = (kd.weeks || [])[0], hx1 = p1 ? Math.min(796, X(ix(p1.end, true)) + step / 2) : 796;
        o.push('<line class="kb-day__half" x1="' + bx.toFixed(1) + '" y1="' + Y(hv).toFixed(1) + '" x2="' + hx1.toFixed(1) + '" y2="' + Y(hv).toFixed(1) + '"></line>');
        var ha = hx1 - bx > 140 ? 'end' : 'start', hxx = Math.max(bx + 4, hx1 - 4);
        lab([{ x: hxx, y: Y(hv) + 14, anchor: ha }, { x: hxx, y: Y(hv) - 6, anchor: ha }, { x: bx + 4, y: Y(hv) + 14, anchor: 'start' }, { x: bx + 4, y: Y(hv) - 6, anchor: 'start' }], 'kb-day__halft', '½ до дії ' + B.p(hv), 3, true);
      }
    }
    var pts = function (f) { return days.map(function (x, i) { return x.future || x[f] == null ? null : [X(i), Y(x[f]), i]; }).filter(Boolean); };
    var dp = pts('dept'), tp = pts('types');
    if (dp.length) {
      o.push('<polygon class="kb-day__area" points="' + dp[0][0].toFixed(1) + ',276 ' + dp.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + ' ' + dp[dp.length - 1][0].toFixed(1) + ',276"></polygon>');
      o.push('<polyline class="kb-day__dept" points="' + dp.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"></polyline>');
    }
    if (tp.length) {
      o.push('<polyline class="kb-day__types" points="' + tp.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' ') + '"></polyline>');
      tp.forEach(function (p) { o.push('<circle class="kb-day__pt" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.3"></circle>'); });
    }
    var openLab = null, planLab = null;
    if (d.openDay) {
      var sp = kd.earlySplit;
      o.push('<line class="kb-day__open" x1="' + openX.toFixed(1) + '" y1="10" x2="' + openX.toFixed(1) + '" y2="282"></line>');
      openLab = 'відкрито ' + B.day(d.openDay) + (isEarly(kd) && sp && sp.before ? ' · з ' + B.wdShort(kd.periodStart) + ' ' + B.num(sp.before.checked) + ' шт · ' + B.p(sp.before.rate) : '');
    }
    if (planX != null) {
      o.push('<line class="kb-day__plan" x1="' + planX.toFixed(1) + '" y1="10" x2="' + planX.toFixed(1) + '" y2="282"></line>');
      planLab = 'план ' + B.day(d.planDay) + ' · фото «до дії»';
    }
    var tw = function (t) { return t.length * 5.7; };
    if (openLab && planLab && Math.abs(planX - openX) < 230) {
      var oe = Math.max(openX - 5, 4 + tw(openLab)), ps = Math.max(planX + 5, oe + 12);
      o.push(svgText(oe, 10, 'kb-day__opent', openLab, 'end'));
      if (ps + tw(planLab) > 798) o.push(svgText(798, 10, 'kb-day__plant', planLab, 'end')); else o.push(svgText(ps, 10, 'kb-day__plant', planLab, 'start'));
    } else {
      if (openLab) o.push(svgText(Math.min(Math.max(openX, 110), 690), 10, 'kb-day__opent', openLab, 'middle'));
      if (planLab) o.push(svgText(Math.min(Math.max(planX, 90), 710), 10, 'kb-day__plant', planLab, 'middle'));
    }
    var CHK = { p1: 'після 7-го дня', p2: 'після 14-го дня', quiet: 'кінець нагляду', self: 'закрито без участі старшого' };
    (d.checks || []).forEach(function (c) {
      var i = ix(c.day, true);
      if (c.day < days[0].day || c.day > days[n - 1].day) return;
      var cx = Math.min(796, X(i) + step / 2);
      o.push('<line class="kb-day__chk' + (c.done ? '' : ' kb-day__chk--est') + '" x1="' + cx.toFixed(1) + '" y1="18" x2="' + cx.toFixed(1) + '" y2="' + (OBS_Y + 22) + '"></line>');
      o.push(svgText(cx - 4, OBS_Y + 20, 'kb-day__chkt', (c.est ? '≈ ' : '') + CHK[c.kind], 'end'));
    });
    var ti = d.todayDay && d.todayDay <= days[n - 1].day ? ix(d.todayDay, true) : -1;
    if (ti >= 0 && !days[ti].future) o.push('<line class="kb-day__today" x1="' + X(ti).toFixed(1) + '" y1="18" x2="' + X(ti).toFixed(1) + '" y2="282"></line>');
    var marks = [];
    if (d.openDay) marks.push(ix(d.openDay));
    (kd.weeks || []).forEach(function (w) { if (w.status === 'done') marks.push(ix(w.end, true)); });
    if (dp.length) marks.push(dp[dp.length - 1][2]);
    var lastI = dp.length ? dp[dp.length - 1][2] : -1;
    marks.filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (i) {
      var x = days[i], last = i === lastI, xi = X(i);
      if (x.future) return;
      var at = function (dy) { return [{ x: xi, y: dy, anchor: 'middle' }, { x: xi - 4, y: dy, anchor: 'end' }, { x: xi + 4, y: dy, anchor: 'start' }]; };
      if (x.dept != null) { var yd = Y(x.dept); lab(at(yd - 7).concat(at(yd + 15), at(yd - 19), at(yd + 27)), 'kb-day__vd', (last ? 'відділ ' : '') + B.p(x.dept), last ? 9 : 2, last); }
      if (x.types != null) { var yt = Y(x.types); lab(at(yt + 15).concat(at(yt - 7), at(yt + 27), at(yt - 19)), 'kb-day__vt', (last ? 'види дії ' : '') + B.p(x.types), last ? 8 : 1, last); }
    });
    o.push(placeLabels());
    if (d.photo || (d.obs && d.obs.length)) o.push(svgText(34, OBS_Y + 4, 'kb-day__ax', 'день', 'end'));
    if (d.photo && d.photo.to >= days[0].day) {
      var pa = Math.max(42, X(ix(d.photo.from)) - step / 2 + 2), pb = Math.min(794, X(ix(d.photo.to, true)) + step / 2 - 2);
      o.push('<path class="kb-day__photo" d="M' + pa.toFixed(1) + ',' + (OBS_Y - 5) + ' v10 M' + pa.toFixed(1) + ',' + OBS_Y + ' H' + pb.toFixed(1) + ' M' + pb.toFixed(1) + ',' + (OBS_Y - 5) + ' v10"></path>');
      o.push(svgText((pa + pb) / 2, OBS_Y + 3.5, 'kb-day__phott', (pb - pa > 170 ? 'фото «до дії» ' : '«до» ') + B.p(d.photo.rate) + (pb - pa > 240 ? ' · ' + B.num(d.photo.pieces) + ' шт з ' + B.num(d.photo.checked) : ''), 'middle'));
    }
    var seen = {};
    (d.obs || []).forEach(function (x) {
      if (x.day < days[0].day || x.day > days[n - 1].day) return;
      var i = ix(x.day), cls = 'kb-day__on kb-day__on--' + (x.running ? 'run' : x.period === 'q' ? 'q' : x.period === 2 ? '2' : '1');
      seen[x.day] = 1;
      o.push('<circle class="' + cls + '" cx="' + X(i).toFixed(1) + '" cy="' + OBS_Y + '" r="' + (step < 18 ? 6 : 7.5) + '"></circle>');
      o.push(svgText(X(i), OBS_Y + 3.5, 'kb-day__ont' + (x.running ? ' kb-day__ont--run' : ''), x.running ? '…' : String(x.no), 'middle'));
    });
    (d.stages || []).forEach(function (s) {
      if (!/^(week1|week2|quiet)$/.test(s.kind)) return;
      days.forEach(function (x, i) { if (!x.future && x.day >= s.from && x.day <= s.to && !seen[x.day] && x.day !== d.todayDay) o.push('<circle class="kb-day__off" cx="' + X(i).toFixed(1) + '" cy="' + OBS_Y + '" r="2.2"></circle>'); });
    });
    var every = n > 24 ? 2 : 1, starts = (d.stages || []).map(function (s) { return s.from; });
    days.forEach(function (x, i) {
      if (i % every && i !== ti) return;
      if (ti >= 0 && step < 42 && Math.abs(i - ti) === 1) return;   // «сьогодні» широке — сусідні підписи днів не накладаються
      var bold = starts.indexOf(x.day) >= 0 || x.day === d.openDay;
      o.push(svgText(X(i), 338, 'kb-day__x' + (bold ? ' kb-day__b' : '') + (i === ti ? ' kb-day__xt' : ''), i === ti ? 'сьогодні' : B.wdShort(x.day), 'middle'));
      o.push(svgText(X(i), 352, 'kb-day__xd', B.day(x.day), 'middle'));
    });
    o.push('</svg>');
    return '<div class="kb-scroll"><div class="kb-day__box-w">' + o.join('') + '</div></div>';
  }
  function sinceNote(kd, start) {
    var lw = liveWeek(kd), dw = (kd.weeks || []).filter(function (w) { return w.status === 'done'; }).pop();
    if (!(lw && lw.status === 'running' && dw && dw.typesRate != null && lw.typesRate != null)) return '';
    var dd = Math.round((lw.typesRate - dw.typesRate) * 10) / 10;
    return '<div class="kb-mchips"><span class="kb-mchip kb-mchip--since"><b>види браку в дії з ' + esc(B.day(dw.end)) + ':</b> ' + B.p(dw.typesRate) + ' → ' + B.p(lw.typesRate) +
      ' (' + (dd > 0 ? '+' : dd < 0 ? '−' : '') + B.n1(Math.abs(dd)) + ' в. п.)' + (start != null ? ' · до дії ' + B.p(start) : '') + '</span></div>';
  }
  function dailyCard(kd, T, today) {
    var start = startOf(kd), d = kd.daily || {}, st = (d.stages || []).map(function (s) { return s.kind; }), plan = !!kd.implementedAt;
    var lg = [['<i class="kb-ln kb-ln--dept"></i>', 'брак відділу'], ['<i class="kb-ln kb-ln--types"></i>', 'види браку в дії'], ['<i class="kb-ln kb-ln--norm"></i>', 'норма ' + T + '%'],
      ['<i class="kb-ln kb-ln--base"></i>', 'види браку в дії до дії' + (kd.typesBefore != null ? ' — ' + B.p(start) : '')], ['<i class="kb-ln kb-ln--open"></i>', 'відкриття дії']];
    if (plan) lg.push(['<i class="kb-ln kb-ln--plan"></i>', 'план — останній день фото «до дії»']);
    if (plan && kd.typesBefore != null && (kd.weeks || []).some(function (w) { return w.n === 1 && w.close; })) lg.push(['<i class="kb-ln kb-ln--half"></i>', '½ до дії — межа дострокового закриття']);
    lg.push(['<i class="kb-sw kb-sw--pre"></i>', kd.repeatOf ? 'перша спроба дії — до рецидиву' : 'дії ще не було'], ['<i class="kb-sw kb-sw--stage"></i>', 'етап дії']);
    if (st.indexOf('analysis') >= 0) lg.push(['<i class="kb-sw kb-sw--analysis"></i>', 'аналіз — шукають причину']);
    if (st.indexOf('extra') >= 0) lg.push(['<i class="kb-sw kb-sw--extra"></i>', 'до звичайного розбору — дні не рахуються']);
    if (st.indexOf('quiet') >= 0) lg.push(['<i class="kb-sw kb-sw--quiet"></i>', 'тихий нагляд після дострокового закриття']);
    if (plan) lg.push(['<i class="kb-on kb-on--1">1</i>', 'день спостереження — лише дні з аудитами'], ['<i class="kb-on kb-on--off"></i>', 'день без аудитів — не рахується'], ['<i class="kb-ln kb-ln--chk"></i>', 'перевірка після 7-го і 14-го дня (≈ — оцінка)']);
    return B.card('Брак по днях на тлі етапів', 'kd.p.daily', 'лінії — брак за останні 7 днів до кожного дня', dailySvg(kd, T, today) + sinceNote(kd, start) + B.legend(lg));
  }

  function mini(v, cls, m, mcls, dim) {
    var x = function (a) { return (Math.max(0, Math.min(8, a || 0)) / 8 * 100).toFixed(2); };
    return '<span class="kb-trk"><i class="' + cls + (dim ? ' kb-dim' : '') + '" style="--w:' + x(v) + '%"></i>' + (m != null ? '<b class="' + mcls + '" style="--at:' + x(m) + '%"></b>' : '') + '</span>';
  }
  function vchip(kind, text) { return '<span class="kb-pill kb-pill--v' + kind + '">' + esc(text) + '</span>'; }
  function closeBlock(c, T, start) {
    if (!c) return '';
    var run = !c.final, ok = function (v) { return '<b class="kb-ec__ok kb-ec__ok--' + (v ? 'y' : 'n') + '">' + (v ? '✓' : '✕') + '</b>'; };
    var lo = c.typesRate != null && c.hi != null ? Math.max(0, Math.round((2 * c.typesRate - c.hi) * 10) / 10) : null;
    var max = Math.max(2, (start || 0) * 1.15, (c.hi || 0) * 1.15), x = function (v) { return (Math.max(0, Math.min(max, v || 0)) / max * 100).toFixed(2); };
    var trk = '<span class="kb-ec__t">' + (lo != null ? '<i class="kb-ec__f" style="--at:' + x(lo) + '%;--w:' + (x(c.hi) - x(lo)).toFixed(2) + '%"></i>' : '') +
      (c.half != null ? '<b class="kb-ec__half" style="--at:' + x(c.half) + '%"></b>' : '') + (start != null ? '<b class="kb-ec__base" style="--at:' + x(start) + '%"></b>' : '') +
      (c.typesRate != null ? '<i class="kb-ec__d" style="--at:' + x(c.typesRate) + '%"></i>' : '') + '</span>';
    var rows = '<div class="kb-ec">' +
      ok(c.minOk) + '<span>перевірено щонайменше ' + B.num(c.min) + ' шт</span><b class="kb-r">' + B.num(c.checked) + ' шт</b>' +
      ok(c.deptOk) + '<span>брак відділу не вище ' + T + '%</span><b class="kb-r">' + B.p(c.deptRate) + '</b>' +
      ok(c.typesOk) + '<span>види браку в дії впали щонайменше вдвічі — навіть верхній край рамки</span><b class="kb-r">' + B.p(c.hi) + (c.typesOk ? ' ≤ ' : ' > ') + B.p(c.half) + '</b>' +
      '<span></span>' + trk + '<span class="kb-cs kb-r">рамка ' + B.n1(lo) + '–' + B.p(c.hi) + '</span></div>';
    var n = (c.minOk ? 1 : 0) + (c.deptOk ? 1 : 0) + (c.typesOk ? 1 : 0);
    var res = run ? '<span class="kb-cs">Поки виконано ' + n + ' з 3 умов. Підсумок — після 7-го дня з аудитами.</span>'
      : c.ok ? ''
      : '<span class="kb-cs">Виконано ' + n + ' з 3 умов — дія йде далі: дні 8–14.</span>';
    return '<div class="kb-ecb"><div class="kb-ch"><b>③ Дострокове закриття після 7-го дня' + B.help('kd.p.close') + '</b>' + (run ? vchip('wait', 'поки') : vchip(c.ok ? 'good' : 'wait', c.ok ? 'закрито' : 'не всі умови')) + '</div>' +
      rows + B.legend([['<i class="kb-ec__kf"></i>', 'рамка — де справжній брак видів дії найімовірніше'], ['<i class="kb-ec__kd"></i>', 'види браку в дії'], ['<i class="kb-ln kb-ln--half"></i>', '½ до дії'], ['<i class="kb-ln kb-ln--base"></i>', 'до дії']]) + res + '</div>';
  }
  function weekBox(w, kd, T, today, w1) {
    var run = w.status === 'running', start = w.typesBefore != null ? w.typesBefore : startOf(kd), q = w.kind === 'quiet', name = perName(w, true) + (q ? ' після дострокового закриття' : ' після плану');
    if (w.status === 'future') return '<div class="kb-wbox kb-wbox--fut"><div class="kb-ch"><b>' + name + ' · ' + est(w) + esc(B.rng(w.start, w.end)) + '</b>' + vchip('wait', 'почнеться ' + est(w) + B.wd(w.start)) + '</div>' +
      (w.n === 1 && kd.inExtra ? '<span class="kb-cs">Дію відкрили посеред тижня, план записано до розбору: дні до розбору не рахуються, 14 днів — з ' + esc(B.wd(w.start)) + '.</span>' : '') + '</div>';
    var deptHot = w.deptRate != null && w.deptRate > T, typesLow = w.typesRate != null && start != null && w.typesRate < start;
    var head = '<div class="kb-ch"><b>' + name + ' · ' + esc(B.rng(w.start, w.end)) + (run && w.estimated ? ' (кінець — оцінка)' : '') + '</b>' + (run ? vchip('run', 'іде · ' + w.days + ' з 7 днів') : vchip('done', 'завершено')) + '</div>';
    var r1 = '<div class="kb-vr"><span>① брак відділу</span>' + mini(w.deptRate, 'kb-trk__red', T, 'kb-trk__norm', run) + '<b class="' + (deptHot ? 'kb-up' : '') + '">' + B.p(w.deptRate) + '</b>' +
      (run ? vchip('wait', (deptHot ? 'поки понад ' : 'поки не вище ') + T + '%') : vchip(deptHot ? 'bad' : 'good', (deptHot ? 'понад ' : 'не вище ') + T + '%')) + '</div>';
    var r2 = '<div class="kb-vr"><span>② види браку в дії</span>' + mini(w.typesRate, 'kb-trk__blue', start, 'kb-trk__base', run) + '<b class="kb-blue">' + B.p(w.typesRate) + '</b>' +
      (run ? vchip('wait', (typesLow ? 'поки нижче ' : 'поки не нижче ') + B.p(start)) : vchip(typesLow ? 'good' : deptHot ? 'bad' : 'wait', (typesLow ? 'нижче, ніж ' : 'не нижче, ніж ') + B.p(start))) + '</div>';
    var res = '', s = B.p(start);
    if (q) {
      if (!run) res = kd.quietReturned ? '<div class="kb-res kb-res--bad"><b>✕ Брак повернувся</b> — брак відділу &gt; ' + T + '% і види браку в дії ≥ ' + s + (kd.repeatedBy ? ' → відкрито повторну дію з тим самим №' : '') + '</div>'
        : '<div class="kb-res kb-res--good"><b>✓ Тихий нагляд пройдено</b> — дія лишається закритою</div>';
      else res = '<div class="kb-res kb-res--good"><b>✓ Дія лишається закритою</b> — брак відділу ≤ ' + T + '% <b>або</b> види браку в дії &lt; ' + s + '</div>' +
        '<div class="kb-res kb-res--bad"><b>✕ Брак повернувся → повторна дія, той самий №</b> — брак відділу &gt; ' + T + '% <b>і</b> види браку в дії ≥ ' + s + '</div>' +
        '<span class="kb-cs">Нова дія, відкрита в ці дні, теж буде повторною до цієї.</span>';
      return '<div class="kb-wbox kb-wbox--' + (run ? 'qrun' : 'qdone') + '">' + head + r1 + r2 + res + '</div>';
    }
    if (!run) {
      var V = { norm: ['good', '✓ у нормі'], types_lower: ['good', '= не рецидив'], relapse: ['bad', '✕ рецидив'] }[w.verdict];
      var next = w.n === 1 ? (w.verdict === 'relapse' ? (kd.repeatedBy ? ' → наступного ранку відкрито повторну дію' : '') : kd.closedEarly ? ' → виконано всі три умови ③ → закрито достроково.' : ' → дні 8–14.')
        : w.verdict === 'relapse' ? (kd.repeatedBy ? ' → наступного ранку відкрито повторну дію' : '') : w.verdict === 'norm' && w1 && w1.verdict === 'norm' ? ' → закрито: тримається.' : ' → закрито: її види нижче.';
      if (V) res = '<div class="kb-res kb-res--' + V[0] + '"><b>' + V[1] + next + '</b></div>';
    } else if (w.n === 2 && w1 && w1.verdict !== 'norm') {
      res = '<div class="kb-res kb-res--part"><b>✓ Закрито: її види нижче</b> — брак відділу ≤ ' + T + '% <b>або</b> види браку в дії &lt; ' + s + '</div>' +
        '<div class="kb-res kb-res--bad"><b>✕ Рецидив</b> — брак відділу &gt; ' + T + '% <b>і</b> види браку в дії ≥ ' + s + '</div>' +
        (w1.deptRate != null ? '<span class="kb-cs">«Тримається» вже не буде: у днях 1–7 брак відділу був ' + B.p(w1.deptRate) + '.</span>' : '');
    } else if (w.n === 2) {
      res = '<div class="kb-res kb-res--good"><b>✓ Закрито: тримається</b> — брак відділу ≤ ' + T + '%</div>' +
        '<div class="kb-res kb-res--part"><b>✓ Закрито: її види нижче</b> — брак відділу &gt; ' + T + '%, а види браку в дії &lt; ' + s + '</div>' +
        '<div class="kb-res kb-res--bad"><b>✕ Рецидив</b> — брак відділу &gt; ' + T + '% <b>і</b> види браку в дії ≥ ' + s + '</div>';
    } else {
      res = '<div class="kb-res kb-res--good"><b>→ Дні 8–14</b> — брак відділу ≤ ' + T + '% <b>або</b> види браку в дії &lt; ' + s + '</div>' +
        '<div class="kb-res kb-res--good"><b>✓ Закрито достроково</b> — виконано всі три умови ③</div>' +
        '<div class="kb-res kb-res--bad"><b>✕ Рецидив</b> — брак відділу &gt; ' + T + '% <b>і</b> види браку в дії ≥ ' + s + '</div>';
    }
    return '<div class="kb-wbox kb-wbox--' + (run ? 'run' : 'done') + '">' + head + r1 + r2 + (w.n === 1 ? closeBlock(w.close, T, start) : '') + res + '</div>';
  }
  function resultCard(kd, T, today) {
    var ws = kd.weeks || [], w1 = ws.filter(function (w) { return w.n === 1; })[0];
    var body = ws.length ? ws.map(function (w) { return weekBox(w, kd, T, today, w1); }).join('')
      : kd.selfClose ? B.selfBlock(kd, T)   // v3.6: закрито без участі старшого — факти й числа
      : '<p class="kb-cs">' + (kd.status === 'not_needed' ? 'Дію позначено «Не потрібно» — днів спостереження немає.' : 'Плану ще немає: 14 днів спостереження (лише дні, коли у відділі були аудити) почнуться наступного дня після запису впровадженого плану.' +
        (kd.analysis ? '' : ' Поки аналіз не почато і плану немає, дія може закритись сама, коли брак упаде.')) + '</p>';
    return B.card('Результат по днях спостереження', 'kd.p.result', 'рахуємо лише дні з аудитами · спершу брак відділу, потім види браку в дії', body);
  }

  function typesCard(kd, r, open) {
    var types = kd.types || [], plan = !!kd.implementedAt, start = startOf(kd);
    var lw = liveWeek(kd), nowLbl = lw && lw.status !== 'future' ? perName(lw) + (lw.status === 'running' ? ', поки' : '') : 'поточний тиждень';
    var sr = startRange(kd), from = sr.from, to = sr.to;
    var rows = types.map(function (t) {
      var on = t.defectTypeId === open;
      return '<span><button type="button" class="kb-tp__btn" data-act="kb-type" data-type="' + esc(t.defectTypeId) + '" aria-expanded="' + on + '">' + esc(t.name) +
        P.ic(on ? 'chevron-up' : 'chevron-down', 'ui-icon--sm') + '</button><span class="kb-lvl">' + B.lvlDot(t.level) + esc(P.sr.LEVELS[t.level] || '') + '</span></span>' +
        (plan ? '<span class="kb-hide-m">' + (t.causeLabel ? '<b>' + esc(t.causeLabel) + '</b>' + (t.causeNote ? ' — ' + esc(t.causeNote) : '') : '<span class="kb-cs">причину не вказано</span>') + '</span>' : '') +
        '<span class="kb-r">' + B.p(t.start) + '</span><span class="kb-r">' + B.now(t.start, t.now) + '</span>' +
        (on ? '<div class="kb-tp__panel" data-kb-panel></div>' : '');
    }).join('');
    var nowSum = types.length ? Math.round(types.reduce(function (s, t) { return s + (t.now || 0); }, 0) * 10) / 10 : null;
    var tot = types.length ? '<span class="kb-tp__tot"><b>Разом</b></span>' + (plan ? '<span class="kb-tp__tot kb-hide-m kb-cs">за цим рядком — результат дії</span>' : '') +
      '<span class="kb-tp__tot kb-r"><b>' + B.p(start) + '</b></span><span class="kb-tp__tot kb-r">' + B.now(start, nowSum) + '</span>' : '';
    var sub = plan ? 'план · ' + B.wd(kd.implementedAt) + (kd.whoName ? ' · відповідає ' + kd.whoName : '') : kd.selfClosed ? 'види на момент відкриття' : kd.phaseUi === 'final' ? '' : 'список ще може змінитись';
    var body = types.length ? '<div class="kb-tp' + (plan ? '' : ' kb-tp--np') + '" role="table" aria-label="' + esc('Види браку дії №' + kd.no) + '">' +
      '<span class="kb-tp__h">Вид браку</span>' + (plan ? '<span class="kb-tp__h kb-hide-m">Причина</span>' : '') +
      '<span class="kb-tp__h kb-r">' + (plan ? 'до дії (фото)' : 'на початку') + (from && to ? ' · ' + esc(B.rng(from, to)) : '') + '</span><span class="kb-tp__h kb-r">зараз · ' + esc(nowLbl) + '</span>' + rows + tot + '</div>'
      : '<p class="kb-cs">Видів браку в дії немає.</p>';
    if (plan && kd.plan) body += '<p class="kb-plan"><b>Що зроблено:</b> ' + esc(kd.plan) + '</p>';
    if (!plan && r.canWrite && kd.canPlan) body += '<div class="kb-row"><button type="button" class="kb-main" data-act="kb-plan"' + B.ref(kd) + '>Записати впроваджений план</button><span class="kb-cs">після плану — 14 днів з аудитами спостереження</span></div>';
    body += B.legend([['<b class="kb-dn">0,9% ▼</b>', plan ? 'менше, ніж до дії' : 'менше, ніж на початку'], ['<b class="kb-up">0,4% ▲</b>', 'більше'], [B.lvlDot('scrap'), 'зламане'], [B.lvlDot('repair'), 'пошкоджене'],
      [B.lvlDot('fix'), 'неправильно зроблене'], ['', '% — від перевірених · натисніть вид браку — усе про нього']]);
    return B.card((types.length === 1 ? 'Ваш ' : 'Ваші ') + K.plural(types.length, 'вид браку', 'види браку', 'видів браку'), 'kd.p.types', esc(sub), body);
  }

  var CST = { open: ['kb-tag--open', 'відкрито'], plan: ['kb-tag--open', 'план пишуть'], week1: ['kb-tag--w1', 'дні 1–7'], week2: ['kb-tag--w2', 'дні 8–14'], quiet: ['kb-tag--q', 'нагляд'] };
  function compCard(kd, T) {
    var c = kd.composition || [];
    if (!c.length) return '';
    var max = Math.max(T, Math.max.apply(null, c.map(function (x) { return x.rate || 0; }))), S = 66 / max;
    var cols = c.map(function (x) {
      var t = Math.min(x.typesRate || 0, x.rate || 0), oth = Math.max(0, (x.rate || 0) - t), st = CST[x.stage];
      var tag = st ? '<span class="kb-tag ' + st[0] + '">' + (x.current && x.stage !== 'open' ? st[1] + ' · іде' : st[1]) + '</span>' : '';
      return '<span class="kb-cp__c' + (x.current ? ' kb-dim' : '') + '">' + tag + '<b class="' + (x.rate != null && x.rate > T ? 'kb-up' : '') + '">' + B.p(x.rate) + '</b>' +
        '<i class="kb-cp__o" style="--h:' + (oth * S).toFixed(1) + '%">' + (oth * S >= 9 ? B.n1(oth) : '') + '</i><i class="kb-cp__t" style="--h:' + (t * S).toFixed(1) + '%">' + (t * S >= 9 ? B.n1(t) : '') + '</i></span>';
    }).join('');
    var body = '<div class="kb-cp" role="img" aria-label="' + esc('Брак відділу по тижнях: ' + c.map(function (x) { return B.p(x.rate); }).join(', ') + '; види браку в дії: ' + c.map(function (x) { return B.p(x.typesRate); }).join(', ')) + '">' +
      '<i class="kb-cp__norm" style="--y:' + (T * S).toFixed(1) + '%"></i>' + cols + '</div>' +
      '<div class="kb-cp__x">' + c.map(function (x) { return '<span>' + esc(B.rng(x.start, x.end)) + '</span>'; }).join('') + '</div>' +
      B.legend([['<i class="kb-sw kb-sw--blue"></i>', 'види браку в дії №' + kd.no], ['<i class="kb-sw kb-sw--beige"></i>', 'інші види браку'], ['<i class="kb-ln kb-ln--norm"></i>', 'норма ' + T + '%'],
        ['<b class="kb-up">' + B.p(T + 0.6) + '</b>', '— понад норму'], ['<i class="kb-sw kb-sw--blue kb-dim"></i>', 'тиждень іде']]);
    return B.card('Склад браку відділу по тижнях', 'kd.p.comp', 'синє — види браку в дії №' + kd.no + ', бежеве — інші', body);
  }

  function details(title, body) {
    return '<details class="kb-more"><summary><span class="kb-chev">' + P.ic('chevron-right', 'ui-icon--sm') + '</span>' + esc(title) + '</summary><div class="kb-more__b">' + body + '</div></details>';
  }
  function earlyBlock(kd, T) {
    var days = kd.early && kd.early.days ? kd.early.days : [];
    if (!days.length) return '';
    var max = Math.max(10, Math.ceil(Math.max.apply(null, days.map(function (x) { return x.hi || x.rate || 0; }))));
    var x = function (v) { return (Math.max(0, Math.min(max, v || 0)) / max * 100).toFixed(2); };
    return '<div class="kb-early">' + days.map(function (d) {
      return '<span><b class="' + (d.opened ? 'kb-up' : '') + '">' + esc(B.wd(d.day)) + '</b> · ' + B.num(d.checked) + ' шт</span>' +
        '<span class="kb-early__t"><b class="kb-early__n" style="--at:' + x(T) + '%"></b>' + (d.lo != null && d.hi != null ? '<i class="kb-early__f' + (d.opened ? ' kb-early__f--on' : '') + '" style="--at:' + x(d.lo) + '%;--w:' + (x(d.hi) - x(d.lo)).toFixed(2) + '%"></i>' : '') +
        '<i class="kb-early__d' + (d.opened ? ' kb-early__d--on' : '') + '" style="--at:' + x(d.rate) + '%"></i></span>' +
        '<span class="' + (d.opened ? 'kb-up kb-b' : '') + '">' + B.p(d.rate) + (d.lo != null ? ' · рамка ' + B.n1(d.lo) + '–' + B.p(d.hi) : '') + (d.opened ? ' → відкрито' : '') + '</span>';
    }).join('') + '<span></span><span class="kb-early__ax"><span>0%</span><span>' + Math.round(max / 2) + '%</span><span>' + max + '%</span></span><span></span></div>';
  }
  function changesBlock(kd) {
    var ch = kd.changes || [], pc = function (x) { return esc(x.name) + ', ' + B.num(x.pieces) + ' шт'; };
    if (!ch.length) return '<p class="kb-cs">Змін списку не було.</p>';
    return '<div class="kb-jr">' + ch.map(function (c) {
      return '<b>' + esc(B.wd(c.day)) + '</b><span>' + [(c.added || []).length ? '<b>+ ' + c.added.map(pc).join(' · ') + '</b>' : '', (c.removed || []).length ? '− ' + c.removed.map(pc).join(' · ') : ''].filter(Boolean).join('; ') + '</span>';
    }).join('') + (kd.implementedAt ? '<b>' + esc(B.wd(kd.implementedAt)) + '</b><span>План записано — список заморожено.</span>' : '') + '</div>';
  }
  var NST = { open: 'тиждень дії', plan: 'здебільшого план пишуть', week1: 'здебільшого дні 1–7', week2: 'здебільшого дні 8–14', quiet: 'здебільшого тихий нагляд' };
  function numbersBlock(kd, today) {
    var list = kd.numbers || [];
    if (!list.length) return '<p class="kb-cs">Чисел по тижнях ще немає.</p>';
    return '<div class="kb-scroll"><table class="kb-tbl"><thead><tr><th>Тиждень</th><th class="kb-r">Перевірено</th><th class="kb-r">Брак відділу</th><th class="kb-r">Види браку в дії</th><th class="kb-r">Інші види</th></tr></thead><tbody>' +
      list.map(function (x) {
        var run = x.end >= today;
        return '<tr><td>' + esc(B.rng(x.start, x.end)) + (NST[x.stage] ? ' · ' + NST[x.stage] : '') + (run ? ' · поки' : '') + '</td><td class="kb-r">' + B.num(x.checked) + ' шт</td>' +
          '<td class="kb-r">' + B.p(x.rate) + ' · ' + B.num(x.rejected) + ' шт</td><td class="kb-r">' + B.p(x.typesRate) + (x.typesPieces != null ? ' · ' + B.num(x.typesPieces) + ' шт' : '') + '</td><td class="kb-r">' + B.p(x.otherRate) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function moreCard(kd, today, T) {
    var ch = kd.changes || [];
    var early = earlyBlock(kd, T);
    return '<section class="kb-card kb-card--more"><div class="kb-ch"><h3 class="kb-ct">Подробиці</h3></div>' +
      (early ? details('Чому відкрили посеред тижня — ' + B.wd(kd.openedAt), early) : '') +
      details('Зміни списку ' + (kd.implementedAt ? 'до плану' : 'з відкриття') + ' · ' + (ch.length ? K.plural(ch.length, 'зміна', 'зміни', 'змін') : 'змін не було'), changesBlock(kd)) +
      details('Усі числа по тижнях', numbersBlock(kd, today)) + '</section>';
  }
})(window);
