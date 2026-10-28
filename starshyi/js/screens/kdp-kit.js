(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, K = P.srKd, B = K.board;
  var X = K.pages = {};

  X.WEEKS = [4, 8, 13, 26];
  X.weeksOf = function (v) { var n = +v; return X.WEEKS.indexOf(n) >= 0 ? n : 8; };
  X.weeksLabel = function (n) { return K.plural(n, 'тиждень', 'тижні', 'тижнів'); };
  var MONG = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  X.dayLong = function (d) { var p = String(d).split('-'); return +p[2] + ' ' + MONG[+p[1] - 1]; };
  X.span = function (a, b) { return a && b ? X.dayLong(a) + ' — ' + X.dayLong(b) : ''; };

  var PATH = { list: '/kd/list', after: '/kd/stats' };
  X.url = function (page, s) {
    var q = [];
    if (s.dep) q.push('dep=' + encodeURIComponent(s.dep));
    if (page === 'list' && s.st && s.st !== 'all') q.push('st=' + encodeURIComponent(s.st));
    if (s.w && s.w !== 8) q.push('w=' + s.w);
    return '#' + PATH[page] + (q.length ? '?' + q.join('&') : '');
  };
  X.sync = function (page, s) {
    try { root.history.replaceState(null, '', X.url(page, s)); } catch (e) { /* без історії — не страшно */ }
  };

  X.top = function (r, page, st) {
    var s = r.tiles && r.tiles[0] ? r.tiles[0].series || [] : [], sel = st.dep || null;
    var links = { list: X.url('list', { dep: st.dep, w: st.w }), after: X.url('after', { dep: st.dep, w: st.w }) };
    return B.compactBar(r, sel) + B.ruleLine(r.week && r.week.start, r.threshold, page, links) + B.kdFromNote(r) + B.tiles(r, sel) +
      B.legend([['', 'Плитка показує дії лише цього відділу'], ['<i class="kb-sw kb-sw--slate"></i>', 'брак, % по тижнях' + (s.length ? ' з ' + B.day(s[0].start) : '')],
        ['<i class="kb-sw kb-sw--red"></i>', 'тиждень понад норму'], ['<i class="kb-sw kb-sw--dim"></i>', 'тиждень ще йде'], ['<i class="kb-ln kb-ln--norm"></i>', 'норма ' + r.threshold + '%']]);
  };
  X.adapt = function (ctx, page, s) {
    var el = ctx.el;
    Array.prototype.forEach.call(el.querySelectorAll('[data-kb-tiles] a.kb-tile, [data-kb-cbar] a.kb-cpt'), function (a) {
      var m = /^#\/kd\/dept\/([^/?]+)/.exec(a.getAttribute('href') || ''), id = m ? decodeURIComponent(m[1]) : '';
      a.setAttribute('href', X.url(page, { dep: id, st: page === 'list' ? s.st : null, w: s.w }));
      a.setAttribute('data-act', 'kdp-dep');
      a.setAttribute('data-id', id);
      if (a.classList.contains('kb-tile')) a.setAttribute('aria-pressed', String((id || null) === (s.dep || null)));
    });
    B.mountCompact(ctx);
  };
  X.weeksSwitch = function (label, w, note) {
    return '<div class="kdp-per"><span class="kb-cs">' + esc(label) + '</span><span class="kdp-seg" role="group" aria-label="' + esc(label) + '">' + X.WEEKS.map(function (n) {
      return '<button type="button" class="kdp-seg__b' + (n === w ? ' kdp-seg__b--on' : '') + '" data-act="kdp-w" data-v="' + n + '" aria-pressed="' + (n === w) + '">' + X.weeksLabel(n) + '</button>';
    }).join('') + '</span>' + (note ? '<span class="kb-cs">' + note + '</span>' : '') + '</div>';
  };

  X.obsDays = function (week) { return week === 2 ? 'дні 8–14 після плану' : 'дні 1–7 після плану'; };
  var STATE = { open: ['open', 'без плану'], relapse: ['rel', 'рецидив · новий план'], helped: ['done', '✓ тримається'],
    held_types: ['part', '✓ її види нижче'], not_needed: ['skip', '○ не потрібна'], not_helped: ['rel', '✕ закрито: рецидив'], self_closed: ['done', '✓ без участі старшого'] };
  X.obsText = function (x) {
    if (x.waiting) return 'план є · дні після плану ще не почались';
    return x.day != null ? x.day + ' з 14 днів після плану' : X.obsDays(x.week);
  };
  X.stateChip = function (x) {
    var state = x.state;
    if (state === 'observe') return B.chip('obs', esc(X.obsText(x)));
    if (x.analysis && (state === 'open' || state === 'relapse')) return B.chip(state === 'relapse' ? 'rel' : 'open', esc((state === 'relapse' ? 'рецидив · ' : '') + B.anText(x)));   // v1.3
    if (x.closedEarly && (state === 'helped' || state === 'held_types')) return B.chip(state === 'helped' ? 'done' : 'part', '✓ закрито достроково');
    var k = STATE[state];
    return k ? B.chip(k[0], k[1]) : B.chip('none', esc(String(state || '—')));
  };

  X.deptPair = function (a, b, partial, T) {
    if (a == null && b == null) return '<span class="kb-cs">—</span>';
    if (b == null) return B.p(a);
    return (partial ? '<span class="kb-cs">поки </span>' : '') + (a != null ? B.p(a) + ' → ' : '') + '<b class="' + (b > T ? 'kb-up' : '') + '">' + B.p(b) + '</b>';
  };
  X.typesPair = function (a, b, partial) {
    if (b == null) return a == null ? '<span class="kb-cs">—</span>' : '<span class="kb-cs">на початку</span> <b>' + B.p(a) + '</b>';
    return (partial ? '<span class="kb-cs">поки </span>' : '') + B.arrow(a, b);
  };
  X.ml = function (t) { return '<span class="kdp-ml">' + esc(t) + '</span>'; };
  X.kpi = function (label, value, sub, cls, helpKey) {
    return '<div class="kb-kpi' + (cls ? ' ' + cls : '') + '"><span class="kb-kpi__l">' + esc(label) + (helpKey ? B.help(helpKey) : '') + '</span>' +
      '<span class="kb-kpi__v">' + value + '</span>' + (sub ? '<span class="kb-kpi__s">' + sub + '</span>' : '') + '</div>';
  };
  X.spark = function (vals, T, name) {
    vals = vals || [];
    if (!vals.length) return '<span class="kb-cs">—</span>';
    var max = Math.max(8, Math.ceil(Math.max.apply(null, vals.map(function (v) { return v || 0; }).concat([T])) + 0.5));
    return '<span class="kb-spark kdp-spark" role="img" aria-label="' + esc('Брак «' + name + '» по тижнях: ' + vals.map(B.p).join(', ') + '; норма ' + T + '%') + '">' +
      vals.map(function (v, i) {
        return '<i class="' + (v != null && v > T ? 'kb-hot' : '') + (i === vals.length - 1 ? ' kb-dim' : '') + '" style="--h:' + (v == null ? 0 : Math.min(100, v / max * 100)).toFixed(1) + '%"></i>';
      }).join('') + '<b class="kb-spark__n" style="--y:' + (T / max * 100).toFixed(1) + '%"></b></span>';
  };

  X.SEG = {
    early: ['kb-sg--early', 'відкрито достроково', []],
    open: ['kb-sg--open', 'без плану', ['без плану']],
    analysis: ['kb-sg--analysis', 'аналіз — шукають причину', ['аналіз', '']],
    extra: ['kb-sg--extra', 'план є, до розбору — дні не рахуються', ['до розбору · дні не рахуються', 'до розбору', '']],
    week1: ['kb-sg--w1', 'дні 1–7 після плану', ['дні 1–7', '1–7']],
    week2: ['kb-sg--w2', 'дні 8–14 після плану', ['дні 8–14', '8–14']],
    quiet: ['kb-sg--quiet', 'тихий нагляд після дострокового закриття', ['тихий нагляд', 'нагляд', '']],
    relapse: ['kb-sg--rel', 'рецидив — потрібен новий план', ['рецидив · новий план', 'рецидив']]
  };
  X.MARK = { helped: ['✓', 'kb-mk--done', 'тримається'], held_types: ['✓', 'kb-mk--part', 'її види нижче'], relapse: ['✕', 'kb-mk--rel', 'рецидив'], not_needed: ['○', 'kb-mk--skip', 'не потрібна'],
    early: ['✓', 'kb-mk--done kb-mk--early', 'закрито достроково'], self_closed: ['✓', 'kb-mk--alone', 'без участі старшого'] };
  function segOf(s) { return X.SEG[s.kind] || ['kdp-sg--other', String(s.label || s.kind || ''), [String(s.label || s.kind || '')]]; }
  function markOf(m) { return (m.early ? X.MARK.early : X.MARK[m.kind]) || ['•', 'kb-mk--skip', String(m.label || m.kind || '')]; }
  X.strip = function (row, sc) {
    var total = B.days(sc.from, sc.to) + 1, said = [];
    var pos = function (d) { return Math.max(0, Math.min(total, B.days(sc.from, d))) / total * 100; };
    var end = function (d) { return Math.max(0, Math.min(total, B.days(sc.from, d) + 1)) / total * 100; };
    var mdays = (row.marks || []).map(function (m) { return m.day; });
    var segs = (row.segments || []).map(function (s) {
      var k = segOf(s), a = pos(s.from), w = Math.max(0.8, end(s.to) - a), alts = k[2].filter(Boolean);
      var pad = mdays.indexOf(s.from) >= 0 || mdays.indexOf(K.addDays(s.from, -1)) >= 0 || (row.clippedStart && s.from <= sc.from), padR = mdays.indexOf(K.addDays(s.to, 1)) >= 0 || mdays.indexOf(s.to) >= 0;
      said.push(k[1] + ' ' + B.day(s.from) + '–' + B.day(s.to) + (s.running ? ' (іде)' : ''));
      return '<span class="kb-sg kdp-sg ' + k[0] + (pad ? ' kdp-sg--pad' : '') + (padR ? ' kdp-sg--padr' : '') + '" style="--at:' + a.toFixed(2) + '%;--w:' + w.toFixed(2) + '%" title="' + esc(k[1] + ' · ' + B.day(s.from) + '–' + B.day(s.to)) + '"' +
        (alts.length ? ' data-kdp-fit="' + esc(alts.join('|')) + '"' : '') + '>' + esc(alts[0] || '') + '</span>';
    }).join('');
    var marks = (row.marks || []).map(function (m) {
      var k = markOf(m), t = (m.early ? 'закрито достроково · ' : '') + k[2] + ' · ' + B.day(m.day);
      said.push(t);
      return '<i class="kb-mk kdp-mk ' + k[1] + '" style="--at:' + pos(m.day).toFixed(2) + '%" title="' + esc(t) + '">' + k[0] + '</i>';
    }).join('');
    return '<span class="kb-tl__track kdp-strip" role="img" aria-label="' + esc('Хід дії: ' + (said.join('; ') || 'на цій шкалі етапів немає')) + '">' +
      '<i class="kb-tl__today" style="--at:' + end(sc.today).toFixed(2) + '%"></i>' + segs + marks +
      (row.clippedStart ? '<i class="kdp-clip" title="дія почалась раніше за шкалу">←</i>' : '') + '</span>';
  };
  X.stripLegend = function (rows) {
    var kinds = {}, marks = {}, clip = false;
    rows.forEach(function (r) {
      (r.segments || []).forEach(function (s) { kinds[s.kind] = s; });
      (r.marks || []).forEach(function (m) { marks[m.early ? 'early' : m.kind] = m; });
      if (r.clippedStart) clip = true;
    });
    var out = Object.keys(X.SEG).filter(function (k) { return kinds[k]; }).map(function (k) { return ['<i class="kb-sw ' + X.SEG[k][0] + '"></i>', X.SEG[k][1]]; });
    Object.keys(kinds).filter(function (k) { return !X.SEG[k]; }).forEach(function (k) { out.push(['<i class="kb-sw kdp-sg--other"></i>', segOf(kinds[k])[1]]); });
    Object.keys(marks).forEach(function (k) { var m = markOf(marks[k]); out.push(['<i class="kb-mk kb-mk--lg ' + m[1] + '">' + m[0] + '</i>', m[2]]); });
    out.push(['<i class="kb-ln kb-ln--today"></i>', 'сьогодні']);
    if (clip) out.push(['<b>←</b>', 'дія почалась раніше за шкалу']);
    return B.legend(out);
  };
  X.fit = function (el) {
    Array.prototype.forEach.call(el.querySelectorAll('[data-kdp-fit]'), function (sg) {
      var alts = sg.getAttribute('data-kdp-fit').split('|');
      for (var i = 0; i < alts.length; i++) { sg.textContent = alts[i]; if (sg.scrollWidth <= sg.clientWidth + 1) return; }
      sg.textContent = '';
    });
    Array.prototype.forEach.call(el.querySelectorAll('[data-kdp-wk]'), function (box) {
      var cells = box.children, over = function () { for (var i = 0; i < cells.length; i++) if (cells[i].scrollWidth > cells[i].clientWidth + 1) return true; return false; };
      if (!cells.length || !over()) return;
      box.classList.add('kdp-wk--thin');
      var need = 0, pitch = cells.length > 1 ? cells[1].getBoundingClientRect().left - cells[0].getBoundingClientRect().left : cells[0].clientWidth, step = 1;
      Array.prototype.forEach.call(cells, function (c) { c.textContent = c.getAttribute('data-s'); need = Math.max(need, c.scrollWidth); });
      while (step * pitch < need + 6 && step < cells.length) step *= 2;
      Array.prototype.forEach.call(cells, function (c, i) { c.textContent = (cells.length - 1 - i) % step ? '' : c.getAttribute('data-s'); });
    });
  };
  X.weekHead = function (weeks) {
    return '<span class="kdp-wkh" data-kdp-wk style="--n:' + weeks.length + '">' + weeks.map(function (w) {
      var s = w.current ? 'іде' : B.day(w.start);
      return '<span' + (w.current ? ' class="kb-tl__cur"' : '') + ' data-s="' + esc(s) + '">' + esc(B.rng(w.start, w.end) + (w.current ? ' · іде' : '')) + '</span>';
    }).join('') + '</span>';
  };
})(window);
