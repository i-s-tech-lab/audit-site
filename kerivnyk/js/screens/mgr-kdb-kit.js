(function (root) {
  'use strict';
  var P = root.P, esc = P.esc;
  function H() { return P.sr.h; }
  var X = P.mgrKdb = {};

  X.p = function (v) { return v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1).replace('.', ',') + '%'; };
  X.n1 = function (v) { if (v == null) return '—'; var r = Math.round(v * 10) / 10; return (r % 1 ? r.toFixed(1) : String(r)).replace('.', ','); };
  X.num = function (v) { return v == null ? '—' : H().num(v); };
  X.day = function (d) { return d ? H().dayShort(d) : '—'; };
  X.rng = function (a, b) {
    if (!a || !b) return '';
    var x = a.split('-'), y = b.split('-');
    return x[1] === y[1] ? +x[2] + '–' + +y[2] + '.' + y[1] : +x[2] + '.' + x[1] + '–' + +y[2] + '.' + y[1];
  };
  X.span = function (a, b) { return P.mgr.span(a, b); };
  X.days = function (v) {
    if (v == null) return '—';
    var r = Math.round(v * 10) / 10;
    return r % 1 ? X.n1(r) + ' дня' : P.mgr.dn(r);
  };
  X.signed = function (v) { if (v == null) return '—'; var r = Math.round(v * 10) / 10; return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(1).replace('.', ','); };
  X.dcls = function (v) { return v == null ? '' : v < 0 ? 'kb-dn' : v > 0 ? 'kb-up' : 'kb-zr'; };
  X.wl = function (w) { return 'за ' + w + ' ' + P.plural(w, 'тиждень', 'тижні', 'тижнів'); };
  X.acts = function (n) { return n + ' ' + P.plural(n, 'дія', 'дії', 'дій'); };
  X.weeks = function (q) { var w = +(q && q.w); return w === 4 || w === 13 ? w : 8; };
  X.LV_WORD = { fix: 'неправильно зроблене', repair: 'пошкоджене', scrap: 'зламане' };
  X.lvlDot = function (level) { return '<i class="kb-dot kb-lv--' + (X.LV_WORD[level] ? level : 'fix') + '"></i>'; };
  X.OUT = { helped: 'тримається', held_types: 'її види нижче', not_needed: 'не потрібно', not_helped: 'рецидив' };
  X.cause = function (id, label) { return P.mgr.causeName(id, label); };

  var GEN = ['понеділка', 'вівторка', 'середи', 'четверга', 'пʼятниці', 'суботи', 'неділі'];
  var ACC = ['понеділок', 'вівторок', 'середу', 'четвер', 'пʼятницю', 'суботу', 'неділю'];
  function wix(rules) { return Math.min(7, Math.max(1, (rules && rules.reviewWeekday) || 5)) - 1; }
  X.weekText = function (rules) { var i = wix(rules); return 'з ' + GEN[i] + ' по ' + ACC[(i + 6) % 7]; };
  X.startGen = function (rules) { return GEN[wix(rules)]; };

  X.help = function (k) { return P.help ? P.help.btn(k) : ''; };
  X.chip = function (kind, text) { return '<span class="kb-pill kb-pill--' + kind + '">' + (/^(open|rel|obs)$/.test(kind) ? '<i class="kb-dot"></i>' : '') + text + '</span>'; };
  X.arrow = function (start, now) {
    if (now == null) return start == null ? '—' : X.p(start) + ' → …';
    if (start == null) return X.p(now);
    var d = Math.round((now - start) * 10) / 10;
    return X.p(start) + ' → <b class="' + X.dcls(d) + '">' + X.p(now) + ' ' + (d < 0 ? '▼' : d > 0 ? '▲' : '=') + '</b>';
  };
  X.legend = function (items) {
    return '<div class="kb-lg">' + items.map(function (x) { return '<span>' + x[0] + esc(x[1]) + '</span>'; }).join('') + '</div>';
  };
  X.card = function (title, helpKey, sub, body, cls, sub2) {
    return '<section class="kb-card' + (cls ? ' ' + cls : '') + '"><div class="kb-ch"><h3 class="kb-ct">' + esc(title) + (helpKey ? X.help(helpKey) : '') + '</h3>' +
      (sub ? '<span class="kb-cs">' + sub + '</span>' : '') + '</div>' + (sub2 ? '<p class="kb-cs mkd-sub2">' + sub2 + '</p>' : '') + body + '</section>';
  };
  X.foot = function (html) { return '<p class="mkd-foot">' + html + '</p>'; };
  X.none = function (text) { return '<p class="kb-cs mkd-none">' + esc(text) + '</p>'; };
  X.table = function (head, rows, cls, label) {
    return '<div class="kb-scroll"><table class="mkd-t' + (cls ? ' ' + cls : '') + '"' + (label ? ' aria-label="' + esc(label) + '"' : '') + '><thead><tr>' +
      head.map(function (h) { return '<th' + (h[1] ? ' class="' + h[1] + '"' : '') + '>' + h[0] + '</th>'; }).join('') + '</tr></thead><tbody>' +
      rows.map(function (r) {
        if (r.group) return '<tr class="mkd-t__grp"><td colspan="' + head.length + '">' + r.group + '</td></tr>';
        return '<tr' + (r.cls ? ' class="' + r.cls + '"' : '') + '>' + r.cells.map(function (c) { return '<td' + (c[1] ? ' class="' + c[1] + '"' : '') + '>' + c[0] + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  };
  X.more = function (rows, n) {
    if (rows.length <= n) return { rows: rows, btn: '' };
    rows.forEach(function (r, i) { if (i >= n) r.cls = (r.cls ? r.cls + ' ' : '') + 'mkd-xr'; });
    return { rows: rows, btn: '<button type="button" class="kb-out mkd-morebtn" data-act="mkd-more" data-n="' + rows.length + '">Показати всі ' + rows.length + '</button>' };
  };
  X.nm = function (title, sub) { return '<span class="mkd-nm"><b>' + esc(title) + '</b>' + (sub ? '<span class="kb-cs">' + esc(sub) + '</span>' : '') + '</span>'; };

  X.periodBar = function (r, href) {
    var opts = [[4, '4 тижні'], [8, '8 тижнів'], [13, '13 тижнів']];
    return '<div class="mkd-per"><div class="mkd-per__l"><span class="kb-cs">Період</span><nav class="mkd-seg" aria-label="Період">' + opts.map(function (o) {
      var on = o[0] === r.weeks;
      return '<a class="mkd-seg__a' + (on ? ' mkd-seg__a--on' : '') + '" href="' + href(o[0]) + '"' + (on ? ' aria-current="true"' : '') + '>' + o[1] + '</a>';
    }).join('') + '</nav><span class="kb-cs">' + esc(X.span(r.from, r.to)) + ' · тиждень — ' + esc(X.weekText(r.rules)) + ' · норма браку ' + esc(String(r.threshold)) + '%</span></div>' +
      '<button type="button" class="kb-out" data-act="mkd-how">' + P.ic('info', 'ui-icon--sm') + 'Як працюють коригуючі дії</button></div>';
  };

  var OUTS = [['helped', 'mkd-o1', 'тримається'], ['held_types', 'mkd-o2', 'її види нижче'], ['not_needed', 'mkd-o3', 'не потрібно']];
  X.outBar = function (c) {
    c = c || {};
    var tot = (c.helped || 0) + (c.held_types || 0) + (c.not_needed || 0);
    return '<span class="mkd-ob" role="img" aria-label="' + esc(OUTS.map(function (o) { return o[2] + ' — ' + (c[o[0]] || 0); }).join(', ')) + '">' +
      (tot ? OUTS.filter(function (o) { return c[o[0]]; }).map(function (o) { return '<i class="' + o[1] + '" style="--w:' + (c[o[0]] / tot * 100).toFixed(1) + '%"></i>'; }).join('') : '') + '</span>';
  };
  X.outLegend = function (c) {
    c = c || {};
    return '<span class="mkd-ol">' + OUTS.map(function (o) { return '<span><i class="mkd-osw ' + o[1] + '"></i>' + o[2] + ' — ' + (c[o[0]] || 0) + '</span>'; }).join('') + '</span>';
  };

  X.spark = function (series, T, name) {
    series = series || [];
    var max = Math.max(8, Math.ceil(Math.max.apply(null, series.map(function (x) { return x.rate || 0; }).concat([T])) + 0.5));
    return '<span class="kb-spark" role="img" aria-label="' + esc('Брак «' + name + '» по тижнях: ' + series.map(function (x) { return X.p(x.rate); }).join(', ') + '; норма ' + T + '%') + '">' +
      series.map(function (x) {
        return '<i class="' + (x.rate != null && x.rate > T ? 'kb-hot' : '') + (x.current ? ' kb-dim' : '') + '" style="--h:' + (x.rate == null ? 0 : Math.min(100, x.rate / max * 100)).toFixed(1) + '%"></i>';
      }).join('') + '<b class="kb-spark__n" style="--y:' + (T / max * 100).toFixed(1) + '%"></b></span>';
  };

  var SEG = { early: 'kb-sg--early', open: 'kb-sg--open', extra: 'mkd-sg--extra', week1: 'kb-sg--w1', week2: 'kb-sg--w2', quiet: 'mkd-sg--quiet', relapse: 'kb-sg--rel' };
  var MARK = { helped: ['✓', 'kb-mk--done', 'тримається'], held_types: ['✓', 'kb-mk--part', 'її види нижче'], relapse: ['✕', 'kb-mk--rel', ''], not_needed: ['○', 'kb-mk--skip', 'не потрібно'] };
  var MARK_EARLY = ['✓', 'kb-mk--done mkd-mk--early', 'закрито достроково'], MARK_QUIET = ['✕', 'kb-mk--rel', '', 'брак повернувся в тихий нагляд'];
  function markOf(m) { return m.early ? MARK_EARLY : m.quiet ? MARK_QUIET : MARK[m.kind] || MARK.relapse; }
  var TAG = { early: 'достроково', parallel: 'паралельна', repeat: 'повторна' };
  var MON = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
  function dd(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); }
  function rngMon(a, b) {
    var x = a.split('-'), y = b.split('-');
    return x[1] === y[1] ? +x[2] + '–' + +y[2] + ' ' + MON[+y[1] - 1] : +x[2] + ' ' + MON[+x[1] - 1] + ' – ' + +y[2] + ' ' + MON[+y[1] - 1];
  }
  function segTexts(s, T) {
    if (s.kind === 'open') return ['без плану'];
    if (s.kind === 'extra') return ['дострокова: до звичайного розбору', 'до звичайного розбору', 'до розбору'];
    if (s.kind === 'relapse') return ['рецидив · новий план ще не записано', 'рецидив · новий план', 'рецидив'];
    if (s.kind === 'week1' || s.kind === 'week2' || s.kind === 'quiet') {
      var n = s.kind === 'week1' ? 'дні 1–7' : s.kind === 'week2' ? 'дні 8–14' : 'нагляд', w = s.kind === 'quiet' ? 'тихий нагляд' : n + ' після плану';
      if (s.running) return [w + ' · йде', n + ' · йде', n];
      if (s.deptRate != null && s.deptRate <= T) return [w + ' · брак відділу ' + X.p(s.deptRate), n + ' · брак відділу ' + X.p(s.deptRate), n + ' · ' + X.p(s.deptRate), n];
      return s.typesRate != null ? [w + ' · види браку в дії ' + X.p(s.typesRate), n + ' · види в дії ' + X.p(s.typesRate), n + ' · ' + X.p(s.typesRate), n] : [w, n];
    }
    return [];
  }
  X.fitSegs = function (el) {
    Array.prototype.forEach.call(el.querySelectorAll('[data-kb-fit]'), function (sg) {
      var alts = sg.getAttribute('data-kb-fit').split('|');
      for (var i = 0; i < alts.length; i++) { sg.textContent = alts[i]; if (sg.scrollWidth <= sg.clientWidth + 1) return; }
      sg.textContent = '';
    });
  };
  X.timeline = function (tl, T) {
    if (!tl || !tl.weeks || !tl.weeks.length) return '';
    var total = dd(tl.from, tl.to) + 1;
    var pos = function (d) { return Math.max(0, Math.min(total, dd(tl.from, d))) / total * 100; };
    var end = function (d) { return Math.max(0, Math.min(total, dd(tl.from, d) + 1)) / total * 100; };
    var today = end(tl.today), prev = null;
    var head = '<div class="kb-tl kb-tl--head"><span class="kb-cs">Відділ · дія</span><span class="kb-tl__weeks">' + tl.weeks.map(function (w) {
      return '<span' + (w.current ? ' class="kb-tl__cur"' : '') + '>' + esc(rngMon(w.start, w.end)) + (w.current ? ' · йде' : '') + '</span>';
    }).join('') + '</span></div>';
    var rows = (tl.rows || []).map(function (row) {
      var first = row.departmentId !== prev;
      prev = row.departmentId;
      var mdays = (row.marks || []).map(function (m) { return m.day; }), said = [];
      var segs = (row.segments || []).map(function (s) {
        var a = pos(s.from), b = end(s.to), w = Math.max(0.6, b - a), tx = segTexts(s, T), what = (tx[0] || 'відкрито достроково') + ' · ' + X.day(s.from) + '–' + X.day(s.to);
        said.push(what);
        return '<span class="kb-sg ' + (SEG[s.kind] || '') + (mdays.indexOf(s.from) >= 0 ? ' kb-sg--pad' : '') + '" style="--at:' + a.toFixed(2) + '%;--w:' + w.toFixed(2) + '%"' +
          ' title="' + esc(what) + '"' + (tx.length ? ' data-kb-fit="' + esc(tx.join('|')) + '"' : '') + '>' + esc(tx[0] || '') + '</span>';
      }).join('');
      var s0 = (row.segments || [])[0];
      if (s0 && s0.from === tl.today) segs = '<span class="kb-sg kb-sg--note" style="--at:' + Math.max(0, pos(s0.from) - 30).toFixed(2) + '%;--w:30%">відкрито сьогодні →</span>' + segs;
      var starts = (row.segments || []).map(function (s) { return s.from; });
      var marks = (row.marks || []).map(function (m) {
        var k = markOf(m), at = pos(m.day);
        return '<span class="kb-mk ' + k[1] + '" style="--at:' + at.toFixed(2) + '%" title="' + esc((k[3] || k[2] || 'рецидив') + ' · ' + X.day(m.day)) + '">' + k[0] + '</span>' +
          (k[2] && at < 92 && starts.indexOf(m.day) < 0 ? '<span class="kb-sg kb-sg--mt ' + k[1] + '" style="--at:' + (at + 1.6).toFixed(2) + '%;--w:' + Math.min(20, 98.4 - at).toFixed(2) + '%">' + esc(k[2] + ' ' + X.day(m.day)) + '</span>' : '');
      }).join('');
      return '<button type="button" class="kb-tl mkd-tlb' + (first ? ' kb-tl--first' : '') + '" data-act="mkd-act" data-key="' + esc(row.key) + '" aria-label="' + esc('Подивитись ' + row.departmentName + ' · дія №' + row.no) + '">' +
        '<span class="kb-tl__n"><b>' + esc(row.departmentName) + '</b> №' + row.no + (row.tag && TAG[row.tag] ? ' <span class="kb-cs">· ' + TAG[row.tag] + '</span>' : '') + '<span class="kb-tl__go">подивитись ›</span></span>' +
        '<span class="kb-tl__track" role="img" aria-label="' + esc(row.departmentName + ' №' + row.no + ': ' + said.join('; ')) + '"><i class="kb-tl__today" style="--at:' + today.toFixed(2) + '%"></i>' + segs + marks + '</span></button>';
    }).join('');
    var body = '<div class="kb-scroll"><div class="kb-tl__box">' + head + (rows || '<p class="kb-cs kb-tl__none">За ці тижні дій не було.</p>') + '</div></div>' +
      X.legend([['<i class="kb-sw kb-sg--early"></i>', 'відкрито достроково'], ['<i class="kb-sw kb-sg--open"></i>', 'без плану'], ['<i class="kb-sw mkd-sg--extra"></i>', 'дострокова: до звичайного розбору'],
        ['<i class="kb-sw kb-sg--w1"></i>', 'дні 1–7 після плану'], ['<i class="kb-sw kb-sg--w2"></i>', 'дні 8–14 після плану'], ['<i class="kb-sw mkd-sg--quiet"></i>', 'тихий нагляд після дострокового закриття'],
        ['<i class="kb-sw kb-sg--rel"></i>', 'рецидив — потрібен новий план'],
        ['<i class="kb-mk kb-mk--done kb-mk--lg">✓</i>', 'тримається'], ['<i class="kb-mk kb-mk--done mkd-mk--early kb-mk--lg">✓</i>', 'закрито достроково'], ['<i class="kb-mk kb-mk--rel kb-mk--lg">✕</i>', 'рецидив'],
        ['<i class="kb-ln kb-ln--today"></i>', 'сьогодні']]);
    return X.card('Дії по тижнях · ' + X.span(tl.from, tl.to), 'mkd.timeline', 'дні 1–7 і 8–14 — дні з аудитами · число на смузі — брак за ці дні · натисніть рядок — уся дія (лише перегляд)', body);
  };

  var ICO = { helped: ['✓', 'kb-mk--done'], held_types: ['✓', 'kb-mk--part'], not_needed: ['○', 'kb-mk--skip'] };
  X.effCard = function (e, weeks) {
    e = e || { items: [] };
    var items = e.items || [], vals = [];
    items.forEach(function (x) { if (x.before != null) vals.push(x.before); if (x.after != null) vals.push(x.after); });
    var max = Math.max(5, Math.ceil(Math.max.apply(null, vals.concat([0]))));
    var x = function (v) { return (Math.max(0, Math.min(max, v)) / max * 100).toFixed(2); };
    var ticks = [];
    for (var i = 0; i <= max; i++) ticks.push('<span>' + i + '%</span>');
    var rows = items.map(function (it) {
      var k = ICO[it.outcome] || ICO.helped, lo = it.before != null && it.after != null ? Math.min(it.before, it.after) : null, hi = lo != null ? Math.max(it.before, it.after) : null;
      return '<span class="kb-ef__n"><i class="kb-mk kb-mk--lg ' + k[1] + '">' + k[0] + '</i><span><b>' + esc(it.departmentName + ' №' + it.no) + '</b><span class="kb-cs">' + X.day(it.openedAt) + ' → ' + X.day(it.finishedOn) + ' · ' + (X.OUT[it.outcome] || '') + '</span></span></span>' +
        '<span class="kb-ef__trk">' + (lo != null ? '<i class="kb-ef__ln' + (it.outcome === 'not_needed' ? ' kb-ef__ln--skip' : it.after > it.before ? ' kb-ef__ln--up' : '') + '" style="--at:' + x(lo) + '%;--w:' + (x(hi) - x(lo)).toFixed(2) + '%"></i>' : '') +
        (it.before != null ? '<i class="kb-ef__b" style="--at:' + x(it.before) + '%"></i>' : '') + (it.after != null ? '<i class="kb-ef__a' + (it.outcome === 'not_needed' ? ' kb-ef__a--skip' : '') + '" style="--at:' + x(it.after) + '%"></i>' : '') + '</span>' +
        '<span class="kb-r">' + X.arrow(it.before, it.after) + '</span>';
    }).join('');
    var avg = e.avg && e.avg.before != null ? '<b class="kb-ef__tot">У середньому</b><span class="kb-ef__tot"></span><span class="kb-r kb-ef__tot">' + X.arrow(e.avg.before, e.avg.after) + '</span>' : '';
    var body = items.length ? '<div class="kb-ef" role="table" aria-label="Види браку в дії до і після для закритих дій"><span class="kb-cs">Дія · відкрито → закрито</span><span class="kb-ef__ax">' + ticks.join('') + '</span>' +
      '<span class="kb-cs kb-r">види браку в дії: до → після</span>' + rows + avg + '</div>' +
      X.legend([['<i class="kb-ef__kb"></i>', 'на початку дії'], ['<i class="kb-ef__ka"></i>', 'після'], ['<i class="kb-ln kb-ln--less"></i>', 'менше'], ['<i class="kb-mk kb-mk--skip kb-mk--lg">○</i>', 'старший позначив «не потрібно»']])
      : X.none('За ' + weeks + ' ' + P.plural(weeks, 'тиждень', 'тижні', 'тижнів') + ' закритих дій немає.');
    return X.card('Ефективність закритих дій · ' + weeks + ' ' + P.plural(weeks, 'тиждень', 'тижні', 'тижнів'), 'mkd.eff', e.from && e.to ? X.day(e.from) + ' — ' + X.day(e.to) : '', body);
  };

  if (!P.srKd) P.srKd = { board: { p: X.p, num: function (v) { return H().num(v); } } };
  X.openHow = function (ctx, locId) {
    var B = P.srKd && P.srKd.board;
    if (!B || !B.openHow || !locId) { P.toast('warn', 'Пояснення зараз недоступне'); return; }
    B.openHow({ loc: { id: locId }, alive: ctx.alive });
  };
  X.bind = function (ctx, locId) {
    ctx.on('mkd-how', function () { X.openHow(ctx, typeof locId === 'function' ? locId() : locId); });
    ctx.on('mkd-more', function (t) {
      var c = t.closest('.kb-card'), on = c && c.classList.toggle('mkd-showall');
      t.textContent = on ? 'Згорнути' : 'Показати всі ' + t.getAttribute('data-n');
    });
    ctx.on('mkd-act', function (t) { if (X.openAction) X.openAction(ctx, typeof locId === 'function' ? locId() : locId, t.getAttribute('data-key')); });
  };
})(window);
