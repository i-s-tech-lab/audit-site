(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, K = P.srKd, B = K.board;
  var OUT = { helped: 'тримається', held_types: 'її види нижче', not_needed: 'не потрібна', self_closed: 'без участі старшого' };

  P.sr.screen('/kd', { tab: 'kd', title: 'Коригуючі дії', period: false, render: function (ctx) {
    var data = null;
    B.bind(ctx, function (t) { return find(B.refOf(t)); });
    ctx.on('kb-list', function (t) { openList(ctx, data, t.getAttribute('data-v')); });
    ctx.on('kb-tw', function (t) { K.openTypeWindow(ctx, t.getAttribute('data-dep'), t.getAttribute('data-type')); });   // вид браку в «Що зараз у роботі»
    ctx.on('retry', function () { ctx.reload(); });
    P.srv('srKdBoard', { locationId: ctx.loc.id }).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { ctx.el.innerHTML = H().error(r); return; }
      data = r;
      if (B.kdWait(r)) { ctx.el.innerHTML = '<div class="kb">' + B.ruleLine(r.week && r.week.start, r.threshold, 'main') + B.kdFromNote(r) + '</div>'; return; }
      ctx.el.innerHTML = '<div class="kb">' + B.compactBar(r, null) + B.ruleLine(r.week && r.week.start, r.threshold, 'main') + B.kdFromNote(r) + B.tiles(r, null) + B.tilesLegend(r) +
        counters(r) + timeline(r) +
        '<div class="kb-g2"><div class="kb-col">' + weekCard(r) + effCard(r) + '</div><div class="kb-col">' + queueCard(r) + causesCard(r) + '</div></div>' + workCard(r) + '</div>';
      B.mountCompact(ctx);
      fitSegs(ctx.el);
    });
    function find(ref) { return ((data && data.queue) || []).filter(function (q) { return ref.id ? q.id === ref.id : q.key === ref.key; })[0] || null; }
  } });
  function H() { return P.sr.h; }

  function names(list) {
    var t = list.slice(0, 3).map(function (x) { return x.departmentName + ' №' + x.no; }).join(' · ');
    return t + (list.length > 3 ? ' · +' + (list.length - 3) : '');
  }
  function observing(r) {
    var out = [];
    (r.tiles || []).forEach(function (d) { (d.actives || []).forEach(function (a) { if (a.phase === 'observe') out.push(Object.assign({ departmentId: d.departmentId, departmentName: d.name }, a)); }); });
    return out;
  }
  function counters(r) {
    var c = r.counts || {}, cl = c.closed || {}, q = r.queue || [], obs = observing(r), up = r.upcoming || [];
    var open = q.filter(function (x) { return x.kind === 'open'; }), rel = q.filter(function (x) { return x.kind === 'relapse'; });
    var next = up.length ? up.map(function (u) { return u.day; }).sort()[0] : null;
    var tot = cl.total || 0, w = function (n) { return (tot ? n / tot * 100 : 0).toFixed(1); };
    var card = function (v, cls, label, val, sub, extra) {
      return '<button type="button" class="kb-kc kb-kc--' + cls + '" data-act="kb-list" data-v="' + v + '"><span class="kb-kc__l">' + esc(label) + '</span><span class="kb-kc__v">' + val + '</span>' +
        (extra || '') + '<span class="kb-kc__s">' + sub + '</span><span class="kb-kc__go">список ›</span></button>';
    };
    return '<div class="kb-kcs">' +
      card('open', 'open', 'Без плану', c.open || 0, esc(open.length ? names(open) : 'дій без плану немає')) +
      card('rel', 'rel', 'Рецидив', c.relapse || 0, esc(rel.length ? names(rel) + ' — потрібен новий план' : 'рецидивів немає')) +
      card('obs', 'obs', 'На спостереженні', c.observe || 0, esc(obs.length ? names(obs) + (next ? ' · найближчий підсумок ≈ ' + B.wd(next) : '') : 'зараз немає')) +
      card('done', 'done', 'Закрито за 8 тижнів', tot,
        '<b class="kb-dn">✓ ' + (cl.helped || 0) + '</b> тримається' + (cl.early ? ' (з них достроково ' + cl.early + ')' : '') + ' · <b class="kb-part">✓ ' + (cl.held_types || 0) + '</b> її види нижче · <b class="kb-zr">○ ' + (cl.not_needed || 0) + '</b> не потрібна' +
          (cl.self_closed ? ' · <b class="kb-dn">✓ ' + cl.self_closed + '</b> без участі старшого' : ''),
        tot ? '<span class="kb-kc__bar" role="img" aria-label="' + esc(cl.helped + ' тримається, ' + cl.held_types + ' її види нижче, ' + cl.not_needed + ' не потрібна') + '"><i class="kb-kc__b1" style="--w:' + w(cl.helped || 0) + '%"></i>' +
          '<i class="kb-kc__b2" style="--w:' + w(cl.held_types || 0) + '%"></i><i class="kb-kc__b3" style="--w:' + w(cl.not_needed || 0) + '%"></i></span>' : '') + '</div>';
  }
  function lrow(href, name, tag, tagCls, chips, btn) {
    return '<div class="kb-lrow"><a class="kb-lrow__a" href="' + href + '"><b>' + esc(name) + '</b><span class="kb-cs ' + (tagCls || '') + '">' + esc(tag) + '</span></a>' +
      '<span class="kb-mchips">' + chips.map(function (x) { return '<span class="kb-mchip">' + x + '</span>'; }).join('') + '</span>' + btn + '</div>';
  }
  function goBtn(href) { return '<a class="kb-go" href="' + href + '">Відкрити ›</a>'; }
  function openList(ctx, r, v) {
    if (!r) return;
    var q = r.queue || [], rows = '', title = '', sub = '', T = r.threshold;
    var planBtn = function (x, label) { return r.canWrite ? '<button type="button" class="kb-go" data-act="kb-plan"' + B.ref(x) + '>' + label + '</button>' : goBtn(B.href(x.departmentId, x.key)); };
    if (v === 'open' || v === 'rel') {
      var list = q.filter(function (x) { return x.kind === (v === 'open' ? 'open' : 'relapse'); });
      title = (v === 'open' ? 'Без плану · ' : 'Рецидив · ') + list.length;
      sub = v === 'open' ? 'дії, де ще немає впровадженого плану' : 'план не допоміг — потрібен новий';
      rows = list.map(function (x) { return lrow(B.href(x.departmentId, x.key), x.departmentName + ' №' + x.no, qTag(x, r.today), v === 'open' ? 'kb-t-open' : 'kb-t-rel', qChips(x), planBtn(x, v === 'open' ? 'Записати план ›' : 'Записати новий план ›')); }).join('');
      var an = list.filter(function (x) { return x.analysis; }).length;
      if (an) sub += ' · аналіз іде: ' + an;
    } else if (v === 'obs') {
      var obs = observing(r), up = r.upcoming || [];
      title = 'На спостереженні · ' + obs.length; sub = 'план впроваджено — дивимось 14 днів, коли у відділі були аудити';
      rows = obs.map(function (a) {
        var u = up.filter(function (x) { return x.key === a.key; })[0];
        return lrow(B.href(a.departmentId, a.key), a.departmentName + ' №' + a.no, B.obsText(a) + (u ? ' · підсумок ' + (u.week === 1 ? 'днів 1–7 ' : 'днів 8–14 ') + (u.estimated ? '≈ ' : '') + B.wd(u.day) : ''), 'kb-t-obs',
          u ? ['види браку в дії ' + B.arrow(u.typesBefore, u.typesRateNow), 'брак відділу поки ' + B.p(u.deptRateNow) + ' · норма ' + T + '%'].concat(closeChip(u)) : [], goBtn(B.href(a.departmentId, a.key)));
      }).join('');
    } else {
      var e = r.efficiency || { items: [] };
      title = 'Закрито за 8 тижнів · ' + ((r.counts && r.counts.closed && r.counts.closed.total) || e.items.length);
      sub = e.from && e.to ? B.day(e.from) + ' — ' + B.day(e.to) : '';
      rows = e.items.map(function (x) {
        var dep = B.depOfKey(x.key);
        return lrow(B.href(dep, x.key), x.departmentName + ' №' + x.no, B.day(x.openedAt) + ' → ' + B.day(x.finishedOn) + ' · ' + (x.early ? 'закрито достроково' : x.outcome === 'self_closed' ? 'закрито без участі старшого' : OUT[x.outcome] || ''), 'kb-t-' + x.outcome,
          ['види браку в дії ' + B.arrow(x.before, x.after)], goBtn(B.href(dep, x.key)));
      }).join('');
    }
    var m = P.sr.modal({ title: title, sub: esc(sub), body: '<div class="kb-lst">' + (rows || '<p class="kb-cs kb-lst__none">Зараз таких дій немає.</p>') + '</div>',
      on: { 'kb-plan': function (t) { m.close(); K.openPlan(ctx, B.refOf(t)); } } });
  }

  var SEG = { early: 'kb-sg--early', open: 'kb-sg--open', analysis: 'kb-sg--analysis', wait: 'kb-sg--wait', extra: 'kb-sg--extra', week1: 'kb-sg--w1', week2: 'kb-sg--w2', quiet: 'kb-sg--quiet', relapse: 'kb-sg--rel' };
  var MARK = { helped: ['✓', 'kb-mk--done', 'тримається'], held_types: ['✓', 'kb-mk--part', 'її види нижче'], relapse: ['✕', 'kb-mk--rel', ''], not_needed: ['○', 'kb-mk--skip', 'не потрібна'],
    early: ['✓', 'kb-mk--done kb-mk--early', 'закрито достроково'], self_closed: ['✓', 'kb-mk--alone', 'без участі старшого'] };
  var TAG = { early: 'достроково', parallel: 'паралельна', repeat: 'повторна' };
  function segTexts(s, T) {
    if (s.kind === 'open') return ['без плану'];
    if (s.kind === 'analysis') return ['аналіз · план ще не записано', 'аналіз', ''];
    if (s.kind === 'wait') return ['впроваджено ' + B.day(s.from), 'план ' + B.day(s.from)];
    if (s.kind === 'extra') return ['до розбору · дні не рахуються', 'до розбору', ''];
    if (s.kind === 'quiet') return s.running ? ['тихий нагляд · йде', 'тихий нагляд', 'нагляд'] : ['тихий нагляд', 'нагляд'];
    if (s.kind === 'relapse') return ['рецидив · новий план ще не записано', 'рецидив · новий план', 'рецидив'];
    if (s.kind === 'week1' || s.kind === 'week2') {
      var n = s.kind === 'week1' ? '1–7' : '8–14', w = 'дні ' + n;
      if (s.running) return [w + ' · йде', n + ' · йде', n];
      if (s.deptRate != null && s.deptRate <= T) return [w + ' · брак відділу ' + B.p(s.deptRate), n + ' · брак відділу ' + B.p(s.deptRate), n + ' · ' + B.p(s.deptRate), n];
      return s.typesRate != null ? [w + ' · види браку в дії ' + B.p(s.typesRate), n + ' · види в дії ' + B.p(s.typesRate), n + ' · ' + B.p(s.typesRate), n] : [w, n];
    }
    return [];
  }
  function fitSegs(el) {
    Array.prototype.forEach.call(el.querySelectorAll('[data-kb-fit]'), function (sg) {
      var alts = sg.getAttribute('data-kb-fit').split('|');
      for (var i = 0; i < alts.length; i++) { sg.textContent = alts[i]; if (sg.scrollWidth <= sg.clientWidth + 1) return; }
      sg.textContent = '';
    });
  }
  function timeline(r) {
    var tl = r.timeline;
    if (!tl || !tl.weeks || !tl.weeks.length) return '';
    var T = r.threshold, total = B.days(tl.from, tl.to) + 1;
    var pos = function (d) { return Math.max(0, Math.min(total, B.days(tl.from, d))) / total * 100; };
    var end = function (d) { return Math.max(0, Math.min(total, B.days(tl.from, d) + 1)) / total * 100; };
    var today = end(tl.today), prev = null;
    var head = '<div class="kb-tl kb-tl--head"><span class="kb-cs">Відділ · дія</span><span class="kb-tl__weeks">' + tl.weeks.map(function (w) {
      return '<span' + (w.current ? ' class="kb-tl__cur"' : '') + '>' + esc(B.rngMon(w.start, w.end)) + (w.current ? ' · йде' : '') + '</span>';
    }).join('') + '</span></div>';
    var rows = (tl.rows || []).map(function (row) {
      var first = row.departmentId !== prev;
      prev = row.departmentId;
      var mdays = (row.marks || []).map(function (m) { return m.day; }), said = [];
      var segs = (row.segments || []).map(function (s) {
        var a = pos(s.from), b = end(s.to), w = Math.max(0.6, b - a), tx = segTexts(s, T), what = (tx[0] || 'відкрито достроково') + ' · ' + B.day(s.from) + '–' + B.day(s.to);
        said.push(what);
        return '<span class="kb-sg ' + (SEG[s.kind] || '') + (mdays.indexOf(s.from) >= 0 ? ' kb-sg--pad' : '') + '" style="--at:' + a.toFixed(2) + '%;--w:' + w.toFixed(2) + '%"' +
          ' title="' + esc(what) + '"' + (tx.length ? ' data-kb-fit="' + esc(tx.join('|')) + '"' : '') + '>' + esc(tx[0] || '') + '</span>';
      }).join('');
      var s0 = (row.segments || [])[0];
      if (s0 && s0.from === tl.today) segs = '<span class="kb-sg kb-sg--note" style="--at:' + Math.max(0, pos(s0.from) - 30).toFixed(2) + '%;--w:30%">відкрито сьогодні →</span>' + segs;
      var marks = (row.marks || []).map(function (m) {
        var k = (m.early ? MARK.early : MARK[m.kind]) || MARK.relapse, at = pos(m.day);
        return '<span class="kb-mk ' + k[1] + '" style="--at:' + at.toFixed(2) + '%" title="' + esc((k[2] || 'рецидив') + ' · ' + B.day(m.day)) + '">' + k[0] + '</span>' +
          (k[2] && at < 92 && !(row.segments || []).some(function (s) { return s.from === m.day; }) ? '<span class="kb-sg kb-sg--mt ' + k[1] + '" style="--at:' + (at + 1.6).toFixed(2) + '%;--w:' + Math.min(20, 98.4 - at).toFixed(2) + '%">' + esc(k[2] + ' ' + B.day(m.day)) + '</span>' : '');
      }).join('');
      return '<a class="kb-tl' + (first ? ' kb-tl--first' : '') + '" href="' + B.href(row.departmentId, row.key) + '" aria-label="' + esc('Відкрити ' + row.departmentName + ' · дія №' + row.no) + '">' +
        '<span class="kb-tl__n"><b>' + esc(row.departmentName) + '</b> №' + row.no + (row.tag && TAG[row.tag] ? ' <span class="kb-cs">· ' + TAG[row.tag] + '</span>' : '') + '<span class="kb-tl__go">відкрити ›</span></span>' +
        '<span class="kb-tl__track" role="img" aria-label="' + esc(row.departmentName + ' №' + row.no + ': ' + said.join('; ')) + '"><i class="kb-tl__today" style="--at:' + today.toFixed(2) + '%"></i>' + segs + marks + '</span></a>';
    }).join('');
    var body = '<div class="kb-scroll"><div class="kb-tl__box">' + head +
      (rows || '<p class="kb-cs kb-tl__none">За ці тижні дій не було.</p>') + '</div></div>' +
      B.legend([['<i class="kb-sw kb-sg--early"></i>', 'відкрито достроково'], ['<i class="kb-sw kb-sg--open"></i>', 'без плану'], ['<i class="kb-sw kb-sg--extra"></i>', 'план є, до розбору — дні не рахуються'],
        ['<i class="kb-sw kb-sg--w1"></i>', 'дні 1–7 після плану'], ['<i class="kb-sw kb-sg--w2"></i>', 'дні 8–14'], ['<i class="kb-sw kb-sg--quiet"></i>', 'тихий нагляд після дострокового закриття'],
        ['<i class="kb-sw kb-sg--analysis"></i>', 'аналіз — шукають причину'],
        ['<i class="kb-sw kb-sg--rel"></i>', 'рецидив — потрібен новий план'], ['<i class="kb-mk kb-mk--done kb-mk--lg">✓</i>', 'тримається'], ['<i class="kb-mk kb-mk--done kb-mk--early kb-mk--lg">✓</i>', 'закрито достроково'],
        ['<i class="kb-mk kb-mk--alone kb-mk--lg">✓</i>', 'закрито без участі старшого'],
        ['<i class="kb-mk kb-mk--rel kb-mk--lg">✕</i>', 'рецидив'], ['<i class="kb-ln kb-ln--today"></i>', 'сьогодні']]);
    return B.card('Дії по тижнях · ' + K.range(tl.from, tl.to), 'kd.b.timeline', 'число на смузі — брак за ці дні · натисніть рядок — сторінка цієї дії', body);
  }

  function weekCard(r) {
    var list = r.weekTable || [], T = r.threshold, w = r.week;
    if (!w) return '';
    var max = Math.max(8, Math.ceil(Math.max.apply(null, list.map(function (x) { return Math.max(x.hi || 0, x.rate || 0); }).concat([T])) / 2) * 2);
    var x = function (v) { return (Math.max(0, Math.min(max, v || 0)) / max * 100).toFixed(2); };
    var pa = K.addDays(w.start, -7), pb = K.addDays(w.end, -7);
    var rows = list.map(function (d) {
      var hot = d.rate != null && d.rate > T, dl = d.rate != null && d.prevRate != null ? Math.round((d.rate - d.prevRate) * 10) / 10 : null;
      return '<b>' + esc(d.name) + '</b><span class="kb-wk__trk" style="--at:' + x(T) + '%">' +
        '<i class="kb-wk__bar' + (hot ? ' kb-hot' : '') + '" style="--w:' + x(d.rate) + '%"></i>' +
        (d.lo != null && d.hi != null ? '<i class="kb-wk__frm" style="--at:' + x(d.lo) + '%;--w:' + (x(d.hi) - x(d.lo)).toFixed(2) + '%"></i>' : '') +
        '<i class="kb-wk__norm" style="--at:' + x(T) + '%"></i>' + (d.prevRate != null ? '<i class="kb-wk__prev" style="--at:' + x(d.prevRate) + '%"></i>' : '') + '</span>' +
        '<b class="kb-r' + (hot ? ' kb-up' : ' kb-mut') + '">' + B.p(d.rate) + '</b><span class="kb-r">' + B.num(d.rejected) + ' шт</span><span class="kb-r kb-hide-m">' + B.num(d.checked) + ' шт</span>' +
        '<span class="kb-r kb-hide-m ' + (dl == null ? '' : dl > 0 ? 'kb-up' : dl < 0 ? 'kb-dn' : 'kb-zr') + '">' + (dl == null ? '—' : (dl > 0 ? '▲ ' : dl < 0 ? '▼ ' : '= ') + B.n1(Math.abs(dl))) + '</span>';
    }).join('');
    var ticks = [0, 2, 4, 6, 8].concat(max > 8 ? [max] : []).filter(function (v) { return v !== T && v <= max; });
    var axis = '<span></span><span class="kb-wk__ax">' + ticks.map(function (v) { return '<span style="--at:' + x(v) + '%">' + v + '%</span>'; }).join('') +
      '<span class="kb-wk__axn" style="--at:' + x(T) + '%">' + T + '%</span></span><span></span><span></span><span class="kb-hide-m"></span><span class="kb-hide-m"></span>';
    var body = '<div class="kb-wk" role="table" aria-label="' + esc('Брак відділів за ' + K.range(w.start, w.end)) + '"><span class="kb-wt-h">Відділ</span><span class="kb-wt-h">брак відділу, %<span class="kb-hide-m"> · рамка — точність, риска — минулий тиждень</span></span>' +
      '<span class="kb-wt-h kb-r">брак</span><span class="kb-wt-h kb-r">браковано</span><span class="kb-wt-h kb-r kb-hide-m">перевірено</span><span class="kb-wt-h kb-r kb-hide-m">до ' + esc(B.rng(pa, pb)) + '</span>' +
      (rows || '<span class="kb-cs kb-wk__none">Відділів немає.</span>') + (rows ? axis : '') + '</div>' +
      B.legend([['<i class="kb-sw kb-sw--red"></i>', 'понад норму'], ['<i class="kb-sw kb-sw--mut"></i>', 'не вище норми'], ['<i class="kb-sw kb-sw--frm"></i>', 'рамка — де справжній брак найімовірніше'],
        ['<i class="kb-ln kb-ln--prev"></i>', 'минулий тиждень'], ['<i class="kb-ln kb-ln--norm"></i>', 'норма ' + T + '%']]);
    return B.card('Брак відділів за тиждень ' + K.range(w.start, w.end), 'kd.b.week', 'різниця — у відсоткових пунктах', body);
  }

  var ICO = { helped: ['✓', 'kb-mk--done'], held_types: ['✓', 'kb-mk--part'], not_needed: ['○', 'kb-mk--skip'], self_closed: ['✓', 'kb-mk--alone'] };
  function effCard(r) {
    var e = r.efficiency || { items: [] }, items = e.items || [];
    var vals = [];
    items.forEach(function (x) { if (x.before != null) vals.push(x.before); if (x.after != null) vals.push(x.after); });
    var max = Math.max(5, Math.ceil(Math.max.apply(null, vals.concat([0]))));
    var x = function (v) { return (Math.max(0, Math.min(max, v)) / max * 100).toFixed(2); };
    var ticks = [];
    for (var i = 0; i <= max; i++) ticks.push('<span>' + i + '%</span>');
    var rows = items.map(function (it) {
      var k = ICO[it.outcome] || ICO.helped, lo = it.before != null && it.after != null ? Math.min(it.before, it.after) : null, hi = lo != null ? Math.max(it.before, it.after) : null;
      return '<span class="kb-ef__n"><i class="kb-mk kb-mk--lg ' + k[1] + (it.early ? ' kb-mk--early' : '') + '">' + k[0] + '</i><span><b>' + esc(it.departmentName + ' №' + it.no) + '</b><span class="kb-cs">' + B.day(it.openedAt) + ' → ' + B.day(it.finishedOn) + ' · ' + (it.early ? 'закрито достроково' : it.outcome === 'self_closed' ? 'закрито без участі старшого' : OUT[it.outcome] || '') + '</span></span></span>' +
        '<span class="kb-ef__trk">' + (lo != null ? '<i class="kb-ef__ln' + (it.outcome === 'not_needed' ? ' kb-ef__ln--skip' : it.after > it.before ? ' kb-ef__ln--up' : '') + '" style="--at:' + x(lo) + '%;--w:' + (x(hi) - x(lo)).toFixed(2) + '%"></i>' : '') +
        (it.before != null ? '<i class="kb-ef__b" style="--at:' + x(it.before) + '%"></i>' : '') + (it.after != null ? '<i class="kb-ef__a' + (it.outcome === 'not_needed' ? ' kb-ef__a--skip' : '') + '" style="--at:' + x(it.after) + '%"></i>' : '') + '</span>' +
        '<span class="kb-r">' + B.arrow(it.before, it.after) + '</span>';
    }).join('');
    var avg = e.avg && e.avg.before != null ? '<b class="kb-ef__tot">У середньому</b><span class="kb-ef__tot"></span><span class="kb-r kb-ef__tot">' + B.arrow(e.avg.before, e.avg.after) + '</span>' : '';
    var body = items.length ? '<div class="kb-ef" role="table" aria-label="Види браку в дії до і після для закритих дій"><span class="kb-cs">Дія · відкрито → закрито</span><span class="kb-ef__ax">' + ticks.join('') + '</span>' +
      '<span class="kb-cs kb-r">види браку в дії: до → після</span>' + rows + avg + '</div>' +
      B.legend([['<i class="kb-ef__kb"></i>', 'до дії'], ['<i class="kb-ef__ka"></i>', 'після'], ['<i class="kb-ln kb-ln--less"></i>', 'менше'], ['<i class="kb-mk kb-mk--done kb-mk--early kb-mk--lg">✓</i>', 'закрито достроково'], ['<i class="kb-mk kb-mk--alone kb-mk--lg">✓</i>', 'без участі старшого'], ['<i class="kb-mk kb-mk--skip kb-mk--lg">○</i>', 'дія не потрібна']])
      : '<p class="kb-cs">За 8 тижнів закритих дій немає.</p>';
    return B.card('Ефективність закритих дій · 8 тижнів', 'kd.b.eff', e.from && e.to ? B.day(e.from) + ' — ' + B.day(e.to) : '', body);
  }

  function qTag(x, today) {
    if (x.kind === 'relapse') return 'рецидив · потрібен новий план' + (x.analysis ? ' · ' + B.anText(x) : '');
    var tags = [x.early ? 'достроково' : '', x.parallel ? 'паралельна' : '', B.anText(x)].filter(Boolean);
    return tags.concat([x.openedAt === today ? 'сьогодні' : 'відкрито ' + B.day(x.openedAt)]).join(' · ');
  }
  function qChips(x) {
    var out = [K.plural(x.typesCount || 0, 'вид браку', 'види браку', 'видів браку'), B.num(x.pieces) + ' шт', Math.round(x.deptShare || 0) + '% браку відділу'];
    if (x.kind === 'relapse' && x.typesBefore != null) out.push('види в дії ' + B.arrow(x.typesBefore, x.typesAfter));
    else if (x.early && x.earlyChecked != null) out.push('з ' + B.wdShort(K.addDays(x.key.split('|')[1] || x.openedAt, 0)) + ' ' + B.num(x.earlyChecked) + ' шт · ' + B.p(x.earlyRate));
    else out.push('брак відділу ' + B.p(x.deptRate));
    return out;
  }
  var UP_W = { 1: 'підсумок днів 1–7', 2: 'підсумок днів 8–14' };
  function closeChip(u) {
    var c = u && u.close;
    if (!c || u.week !== 1 || !c.checked) return [];
    var n = (c.minOk ? 1 : 0) + (c.deptOk ? 1 : 0) + (c.typesOk ? 1 : 0);
    return ['дострокове закриття: поки <b>' + n + ' з 3</b> умов'];
  }
  function queueCard(r) {
    var q = r.queue || [], T = r.threshold;
    var rows = q.map(function (x) {
      var href = B.href(x.departmentId, x.key);
      return '<div class="kb-q kb-q--' + (x.kind === 'relapse' ? 'rel' : 'open') + '"><a class="kb-q__a" href="' + href + '"><b>' + esc(x.departmentName + ' №' + x.no) + '</b><span class="kb-cs">' + esc(qTag(x, r.today)) + '</span></a>' +
        (r.canWrite ? '<span class="kb-q__b"><button type="button" class="kb-out kb-out--sm" data-act="kb-an"' + B.ref(x) + '>' + (x.analysis ? 'Нотатка аналізу' : 'Почати аналіз') + '</button>' +
          '<button type="button" class="kb-go" data-act="kb-plan"' + B.ref(x) + '>Записати план ›</button></span>' : '<span></span>') +
        '<span class="kb-mchips">' + qChips(x).map(function (c) { return '<span class="kb-mchip">' + c + '</span>'; }).join('') + '</span></div>';
    }).join('');
    var up = (r.upcoming || []).map(function (u) {
      return '<a class="kb-rrow" href="' + B.href(B.depOfKey(u.key), u.key) + '"><b>' + (u.estimated ? '≈ ' : '') + esc(B.wd(u.day)) + '</b><span class="kb-rrow__t">' +
        esc(u.departmentName + ' №' + u.no + ' · ' + (UP_W[u.week] || '') + (u.extra ? ' · до розбору дні не рахуються' : ' · минуло ' + u.days + ' з 7 днів')) + '</span><span></span>' +
        '<span class="kb-mchips"><span class="kb-mchip kb-mchip--q">брак відділу поки <b>' + B.p(u.deptRateNow) + '</b> · норма ' + T + '%</span>' +
        '<span class="kb-mchip kb-mchip--q">види браку в дії поки <b>' + B.p(u.typesRateNow) + '</b> · до дії ' + B.p(u.typesBefore) + '</span>' +
        closeChip(u).map(function (x) { return '<span class="kb-mchip kb-mchip--q">' + x + '</span>'; }).join('') + '</span></a>';
    }).join('');
    var closed = (r.recentClosed || []).map(function (c) {
      var k = c.outcome === 'helped' || c.outcome === 'self_closed' ? 'done' : c.outcome === 'held_types' ? 'part' : 'skip';
      return '<a class="kb-chipl" href="' + B.href(B.depOfKey(c.key), c.key) + '">' + B.chip(k, (k === 'skip' ? '○ ' : '✓ ') + esc(c.departmentName + ' №' + c.no + ' · ' + (c.early ? 'закрито достроково' : c.outcome === 'self_closed' ? 'закрито без участі старшого' : OUT[c.outcome] || '') + ' · ' + B.day(c.day))) + '</a>';
    }).join('');
    var body = (rows || '<p class="kb-cs">Дій без плану немає.</p>') +
      (up ? '<span class="kb-sub">НАЙБЛИЖЧІ РЕЗУЛЬТАТИ</span>' + up : '') +
      (closed ? '<span class="kb-sub">НЕЩОДАВНО ЗАКРИТО</span><div class="kb-chips">' + closed + '</div>' : '');
    return B.card('Ваша черга · ' + q.length, 'kd.b.queue', 'дії, де потрібен впроваджений план', body);
  }

  function causesCard(r) {
    var c = r.causes || { items: [] }, items = c.items || [], max = Math.max.apply(null, items.map(function (x) { return x.count; }).concat([1]));
    var body = items.length ? '<div class="kb-cz">' + items.map(function (x) {
      return '<span>' + esc(x.label) + '</span><span class="kb-cz__trk"><i style="--w:' + (x.count / max * 100).toFixed(1) + '%"></i></span><span class="kb-r"><b>' + x.count + '</b> · ' + Math.round(x.share || 0) + '%</span>';
    }).join('') + '</div><span class="kb-cs">Число — скільки разів причину записали; % — частка від усіх ' + c.total + '.</span>'
      : '<p class="kb-cs">За 8 тижнів планів не записано.</p>';
    return B.card('Причини браку в планах · 8 тижнів', 'kd.b.causes', items.length ? 'записано ' + K.plural(c.total, 'причину', 'причини', 'причин') + ' у ' + K.plural(c.plans, 'плані', 'планах', 'планах') : '', body);
  }

  function tspark(t, kd, mx, kind) {
    var vals = t.weekly || [], n = vals.length;
    if (!n) return '<span></span>';
    var X = function (p) { return 8 + p * (112 / Math.max(1, n - 1)); }, Y = function (v) { return 26 - (v || 0) / mx * 21; };
    var ox = Math.min(Math.max(X(kd.openPos != null ? kd.openPos : 0), 2), 126);
    var last = vals[n - 1], st = t.start;   // колір останньої точки — як у стрілки «на початку → зараз»
    var lc = last != null && st != null && last < st - 0.04 ? 'kb-sp--dn' : last != null && st != null && last > st + 0.04 ? 'kb-sp--up' : 'kb-sp--zr';
    var pts = vals.map(function (v, i) { return v == null ? null : X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).filter(Boolean).join(' ');
    var o = '<svg class="kb-sp" viewBox="0 0 128 30" role="img" aria-label="' + esc('Брак виду по тижнях: ' + vals.map(B.n1).join(', ')) + '">' +
      '<rect class="kb-sp__pre" x="0" y="1" width="' + ox.toFixed(1) + '" height="28" rx="3"></rect>' +
      '<line class="kb-sp__open kb-sp__open--' + kind + '" x1="' + ox.toFixed(1) + '" y1="1" x2="' + ox.toFixed(1) + '" y2="29"></line>' +
      '<polyline class="kb-sp__ln" points="' + pts + '"></polyline>';
    vals.slice(0, -1).forEach(function (v, i) { if (v != null) o += '<circle class="kb-sp__pt" cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="1.8"></circle>'; });
    if (last != null) o += '<circle class="kb-sp__last ' + lc + '" cx="' + X(n - 1).toFixed(1) + '" cy="' + Y(last).toFixed(1) + '" r="3.3"></circle>';
    if (kd.relapsePos != null) o += '<text class="kb-sp__rel" x="' + X(kd.relapsePos).toFixed(1) + '" y="9">✕</text>';
    return o + '</svg>';
  }
  function kdLabel(kd, today) {
    var op = kd.openedAt === today ? 'відкрито сьогодні' : 'відкрито ' + B.day(kd.openedAt);
    if (kd.phase === 'observe') return op + ' · на спостереженні · ' + B.obsText(kd);
    if (kd.phase === 'relapse') return op + (kd.relapseDay ? ' · рецидив ' + B.day(kd.relapseDay) : ' · рецидив') + (kd.analysis ? ' · ' + B.anText(kd) : '');
    return [op, kd.analysis ? B.anText(kd) : 'без плану', kd.parallel ? 'паралельна' : '', kd.early ? 'достроково' : ''].filter(Boolean).join(' · ');
  }
  function kdBlock(d, kd, today) {
    var kind = B.kindOf(kd.phase), types = kd.types || [], late = kd.startIdx != null && kd.startIdx >= (kd.weeks || []).length - 1;
    var mx = Math.max.apply(null, [0.5].concat(types.map(function (t) { return Math.max.apply(null, (t.weekly || []).map(function (v) { return v || 0; }).concat([0])); }))) * 1.1;
    var from = kd.weeks && kd.weeks.length ? B.day(kd.weeks[0]) : '';
    var rows = types.map(function (t) {
      return '<span class="kb-wt__n">' + B.lvlDot(t.level) + '<button type="button" class="kb-wt__btn" data-act="kb-tw" data-dep="' + esc(d.departmentId) + '" data-type="' + esc(t.defectTypeId) + '">' + esc(t.name) + '</button></span>' + tspark(t, kd, mx, kind) +
        '<span class="kb-r kb-nw">' + (late ? 'зараз <b>' + B.p(t.now) + '</b>' : B.arrow(t.start, t.now)) + '</span>';
    }).join('');
    var tot = kd.totals || {};
    return '<div class="kb-wkd kb-wkd--' + kind + '"><a class="kb-wkd__h" href="' + B.href(d.departmentId, kd.key) + '"><span class="kb-pill kb-pill--' + kind + 'f">№' + kd.no + '</span><span class="kb-wkd__l">' + esc(kdLabel(kd, today)) + '</span></a>' +
      '<span class="kb-wt"><span class="kb-wt-h">вид браку</span><span class="kb-wt-h">по тижнях' + (from ? ' · ' + esc(from) + ' → зараз' : '') + '</span><span class="kb-wt-h kb-r">початок → зараз</span>' + rows +
      '<b class="kb-wt__tot">Разом</b><span class="kb-wt__tot"></span><span class="kb-r kb-nw kb-wt__tot">' + (late ? 'зараз <b>' + B.p(tot.now) + '</b>' : B.arrow(tot.start, tot.now)) + '</span></span></div>';
  }
  function workCard(r) {
    var list = r.work || [], T = r.threshold, w = r.week, wl = w ? 'брак ' + B.rng(w.start, w.end) : 'брак';
    if (!list.length) return '';
    var panels = list.map(function (d) {
      var kds = d.kds || [], n = kds.length, span = Math.min(Math.max(n, 1), 3);
      var inner = n ? '<div class="kb-wkds" style="--w:' + span + '">' + kds.map(function (k) { return kdBlock(d, k, r.today); }).join('') + '</div>' : B.pareto(d.pareto);
      return '<div class="kb-wdept kb-wdept--' + span + '"><div class="kb-wdept__h"><span><b>' + esc(d.name) + '</b><span class="kb-cs">' + esc(wl) + ' <b class="' + (d.rate != null && d.rate > T ? 'kb-up' : '') + '">' + B.p(d.rate) + '</b></span></span>' +
        '<span class="kb-cs">' + (n ? B.acts(n) : 'дій немає') + '</span></div>' + inner + '</div>';
    }).join('');
    var body = '<div class="kb-wgrid">' + panels + '</div>' +
      B.legend([['<i class="kb-sw kb-sw--pre"></i>', 'до відкриття дії'], ['<i class="kb-ln kb-ln--open"></i>', 'відкрито'], ['<b class="kb-up">✕</b>', 'рецидив'],
        ['<i class="kb-dot kb-dot--ok"></i>', 'поточний тиждень (іде)'], ['<b class="kb-dn">▼</b>', 'менше, ніж на початку дії'], ['<b class="kb-up">▲</b>', 'більше'],
        [B.lvlDot('scrap'), 'зламане'], [B.lvlDot('repair'), 'пошкоджене'], [B.lvlDot('fix'), 'неправильно зроблене']]);
    return B.card('Що зараз у роботі — види браку в діях', 'kd.b.work', 'усі відділи · брак виду, % від перевірених', body);
  }
})(window);
