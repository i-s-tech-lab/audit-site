(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, K = P.srKd;
  var B = K.board = {};
  B.help = function (k) { return P.help ? P.help.btn(k) : ''; };

  B.p = function (v) { return v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1).replace('.', ',') + '%'; };
  B.n1 = function (v) { return v == null ? '—' : (Math.round(v * 10) / 10).toFixed(1).replace('.', ','); };
  B.num = H.num;
  B.day = H.dayShort;
  var WD = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var MON = ['січ', 'лют', 'бер', 'кві', 'тра', 'чер', 'лип', 'сер', 'вер', 'жов', 'лис', 'гру'];
  function dt(d) { return new Date(Date.parse(d + 'T12:00:00Z')); }
  B.wdIx = function (d) { return dt(d).getUTCDay(); };
  B.wd = function (d) { return d ? WD[B.wdIx(d)] + ' ' + B.day(d) : '—'; };
  B.wdShort = function (d) { return WD[B.wdIx(d)]; };
  B.rng = function (a, b) { return a && b ? K.rangeShort(a, b) : ''; };
  B.rngMon = function (a, b) {
    var x = a.split('-'), y = b.split('-');
    return x[1] === y[1] ? +x[2] + '–' + +y[2] + ' ' + MON[+y[1] - 1] : +x[2] + ' ' + MON[+x[1] - 1] + ' – ' + +y[2] + ' ' + MON[+y[1] - 1];
  };
  B.days = function (a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000); };
  B.acts = function (n) { return K.plural(n, 'дія', 'дії', 'дій'); };
  B.depOfKey = function (key) { return String(key || '').split('|')[0]; };
  B.href = function (depId, key) { return '#/kd/dept/' + encodeURIComponent(depId) + (key ? '/' + encodeURIComponent(key) : ''); };
  B.keyOf = function (a) { return a.key || a.departmentId + '|' + a.periodStart; };
  B.hrefOf = function (a, typeId) { return B.href(a.departmentId, B.keyOf(a)) + (typeId ? '?t=' + encodeURIComponent(typeId) : ''); };

  B.arrow = function (start, now) {
    if (now == null) return B.p(start);
    if (start == null) return 'зараз <b>' + B.p(now) + '</b>';
    var d = Math.round((now - start) * 10) / 10;
    var c = d < 0 ? 'kb-dn' : d > 0 ? 'kb-up' : 'kb-zr', a = d < 0 ? '▼' : d > 0 ? '▲' : '=';
    return B.p(start) + ' → <b class="' + c + '">' + B.p(now) + ' ' + a + '</b>';
  };
  B.now = function (start, now) {
    if (now == null) return '—';
    var d = start == null ? 0 : Math.round((now - start) * 10) / 10;
    return '<b class="' + (d < 0 ? 'kb-dn' : d > 0 ? 'kb-up' : 'kb-zr') + '">' + B.p(now) + ' ' + (d < 0 ? '▼' : d > 0 ? '▲' : '=') + '</b>';
  };
  B.chip = function (kind, text) { return '<span class="kb-pill kb-pill--' + kind + '">' + (/^(open|rel|obs)$/.test(kind) ? '<i class="kb-dot"></i>' : '') + text + '</span>'; };
  B.kindOf = function (phase) { return phase === 'relapse' ? 'rel' : phase === 'observe' ? 'obs' : phase === 'open' ? 'open' : 'done'; };
  B.lvlDot = function (level) { return '<i class="kb-dot kb-lv--' + (P.sr.LEVELS[level] ? level : 'fix') + '"></i>'; };
  B.legend = function (items) {
    return '<div class="kb-lg">' + items.map(function (x) { return '<span>' + x[0] + esc(x[1]) + '</span>'; }).join('') + '</div>';
  };
  B.card = function (title, helpKey, sub, body, cls) {
    return '<section class="kb-card' + (cls ? ' ' + cls : '') + '"><div class="kb-ch"><h3 class="kb-ct">' + esc(title) + (helpKey ? B.help(helpKey) : '') + '</h3>' +
      (sub ? '<span class="kb-cs">' + sub + '</span>' : '') + '</div>' + body + '</section>';
  };

  B.ref = function (a) { return a.id ? ' data-id="' + esc(a.id) + '"' : ' data-key="' + esc(a.key) + '"'; };
  B.refOf = function (t) { var id = t.getAttribute('data-id'); return id ? { id: id } : { key: t.getAttribute('data-key') }; };
  B.bind = function (ctx, find) {
    ctx.on('kb-plan', function (t) { K.openPlan(ctx, B.refOf(t)); });
    ctx.on('kb-nn', function (t) { K.openNotNeeded(ctx, B.refOf(t), find ? find(t) : null); });
    ctx.on('kb-how', function () { B.openHow(ctx); });
  };

  var GEN = ['неділі', 'понеділка', 'вівторка', 'середи', 'четверга', 'пʼятниці', 'суботи'];
  var ACC = ['неділю', 'понеділок', 'вівторок', 'середу', 'четвер', 'пʼятницю', 'суботу'];
  var NAV = [['main', 'Головна', '#/kd'], ['list', 'Список дій', '#/kd/list'], ['after', 'Що після дій', '#/kd/stats']];
  B.ruleLine = function (weekStart, T, page, links) {
    var i = weekStart ? B.wdIx(weekStart) : 5;
    var nav = NAV.map(function (n) {
      var on = n[0] === page, href = (links && links[n[0]]) || n[2];
      return '<a class="kdp-nav__a' + (on ? ' kdp-nav__a--on' : '') + '" href="' + esc(href) + '"' + (on ? ' aria-current="page"' : '') + '>' + n[1] + '</a>';
    }).join('');
    return '<div class="kb-rule"><span class="kb-rule__t">Тиждень — з ' + GEN[i] + ' по ' + ACC[(i + 6) % 7] + ' · норма браку ' + esc(String(T)) + '% · розбір що' + GEN[i] + ' зранку</span>' +
      '<span class="kb-rule__b"><nav class="kdp-nav" aria-label="Сторінки коригуючих дій">' + nav + '</nav>' +
      '<button type="button" class="kb-out" data-act="kb-how">' + P.ic('info', 'ui-icon--sm') + 'Як працюють коригуючі дії</button></span></div>';
  };

  B.weekOf = function (tiles) {
    var s = tiles && tiles[0] ? tiles[0].series || [] : [];
    var done = s.filter(function (x) { return !x.current; });
    return done.length ? { start: done[done.length - 1].start, end: done[done.length - 1].end } : null;
  };
  function spark(series, T, name) {
    var max = Math.max(8, Math.ceil(Math.max.apply(null, series.map(function (x) { return x.rate || 0; }).concat([T])) + 0.5));
    return '<span class="kb-spark" role="img" aria-label="' + esc('Брак «' + name + '» по тижнях: ' + series.map(function (x) { return B.p(x.rate); }).join(', ') + '; норма ' + T + '%') + '">' +
      series.map(function (x) {
        return '<i class="' + (x.rate != null && x.rate > T ? 'kb-hot' : '') + (x.current ? ' kb-dim' : '') + '" style="--h:' + (x.rate == null ? 0 : Math.min(100, x.rate / max * 100)).toFixed(1) + '%"></i>';
      }).join('') + '<b class="kb-spark__n" style="--y:' + (T / max * 100).toFixed(1) + '%"></b></span>';
  }
  B.obsText = function (a) { return a.extra ? 'до розбору' : (a.obsDay || 0) + ' з 14 днів'; };
  function tileChips(acts, quiet) {
    var q = (quiet || []).map(function (x) { return B.quietChip(x); }).join('');
    if (!acts.length) return q || B.chip('none', 'зараз дій немає');
    return tileActs(acts) + q;
  }
  B.quietChip = function (x) { return '<span class="kb-pill kb-pill--quiet">✓ №' + x.no + ' · тихий нагляд ' + x.days + ' з 7</span>'; };
  function tileActs(acts) {
    if (acts.length > 3) return groupChips(acts);
    return acts.map(function (a) {
      var t = a.phase === 'observe' ? B.obsText(a) : a.phase === 'relapse' ? 'рецидив · новий план' : 'без плану' + (a.early ? ' · достроково' : '');
      return B.chip(B.kindOf(a.phase), '№' + a.no + ' · ' + t);
    }).join('');
  }
  function groupChips(acts) {
    var c = { open: 0, relapse: 0, observe: 0 };
    acts.forEach(function (a) { if (c[a.phase] != null) c[a.phase]++; });
    return (c.open ? B.chip('open', c.open + ' без плану') : '') + (c.relapse ? B.chip('rel', c.relapse + ' рецидив') : '') + (c.observe ? B.chip('obs', c.observe + ' на спостереженні') : '');
  }
  B.groupChips = function (counts) {
    return (counts.open ? B.chip('open', counts.open + ' без плану') : '') + (counts.relapse ? B.chip('rel', counts.relapse + ' рецидив') : '') +
      (counts.observe ? B.chip('obs', counts.observe + ' на спостереженні') : '') || B.chip('none', 'зараз дій немає');
  };
  function badge(acts) {
    if (!acts.length) return '<span class="kb-pill kb-pill--none">дій немає</span>';
    var hot = acts.some(function (a) { return a.phase === 'open' || a.phase === 'relapse'; });
    return '<span class="kb-pill kb-pill--' + (hot ? 'open' : 'obs') + '">' + B.acts(acts.length) + '</span>';
  }
  var ON = '<span class="kb-pill kb-pill--on">обрано</span>';
  B.tiles = function (r, sel) {
    var T = r.threshold, w = r.week || B.weekOf(r.tiles), wl = w ? 'брак ' + B.rng(w.start, w.end) : '', c = r.counts || {};
    var all = '<a class="kb-tile' + (sel ? '' : ' kb-tile--on') + '" href="#/kd"><span class="kb-tile__h">Усі відділи' + (sel ? '' : ' ' + ON) + '</span>' +
      '<span class="kb-tile__v"><b class="kb-tile__pct">' + (c.activeAll || 0) + '</b><span class="kb-cs">відкритих дій у цеху</span></span>' +
      '<span class="kb-chips">' + B.groupChips(c) + '</span>' +
      '<span class="kb-cs kb-tile__foot">закрито за 8 тижнів: <b>' + ((c.closed && c.closed.total) || 0) + '</b></span></a>';
    return '<div class="kb-tiles" data-kb-tiles>' + all + (r.tiles || []).map(function (d) {
      var on = d.departmentId === sel, acts = d.actives || [];
      return '<a class="kb-tile' + (on ? ' kb-tile--on' : '') + '" href="' + B.href(d.departmentId) + '"><span class="kb-tile__h">' + esc(d.name) + ' ' + (on ? ON : badge(acts)) + '</span>' +
        '<span class="kb-tile__v"><b class="kb-tile__pct' + (d.rate != null && d.rate > T ? ' kb-hot' : '') + '">' + B.p(d.rate) + '</b><span class="kb-cs">' + esc(wl) + '</span></span>' +
        '<span class="kb-cs">' + B.num(d.rejected) + ' з ' + B.num(d.checked) + ' шт</span>' + spark(d.series || [], T, d.name) +
        '<span class="kb-chips">' + tileChips(acts, d.quiet) + '</span></a>';
    }).join('') + '</div>';
  };
  B.tilesLegend = function (r) {
    var s = r.tiles && r.tiles[0] ? r.tiles[0].series || [] : [];
    return B.legend([['', 'Плитка перемикає сторінку на відділ; при прокрутці плитки стають рядком угорі'],
      ['<i class="kb-sw kb-sw--slate"></i>', 'брак, % по тижнях' + (s.length ? ' з ' + B.day(s[0].start) : '')], ['<i class="kb-sw kb-sw--red"></i>', 'тиждень понад норму'],
      ['<i class="kb-sw kb-sw--dim"></i>', 'тиждень ще йде'], ['<i class="kb-ln kb-ln--norm"></i>', 'норма ' + r.threshold + '%']]);
  };

  B.compactBar = function (r, sel) {
    var T = r.threshold, c = r.counts || {};
    var n = function (acts) {
      if (!acts.length) return '';
      var hot = acts.some(function (a) { return a.phase === 'open' || a.phase === 'relapse'; });
      return '<i class="kb-cpt__n kb-cpt__n--' + (hot ? 'open' : 'obs') + '">' + acts.length + '</i>';
    };
    return '<div class="kb-cbar" data-kb-cbar aria-hidden="true"><div class="kb-cbar__in"><span class="kb-cbar__t">Коригуючі дії ·</span>' +
      '<a class="kb-cpt' + (sel ? '' : ' kb-cpt--on') + '" href="#/kd" tabindex="-1">Усі відділи' + (c.activeAll ? '<i class="kb-cpt__n kb-cpt__n--open">' + c.activeAll + '</i>' : '') + '</a>' +
      (r.tiles || []).map(function (d) {
        return '<a class="kb-cpt' + (d.departmentId === sel ? ' kb-cpt--on' : '') + '" href="' + B.href(d.departmentId) + '" tabindex="-1">' + esc(d.name) +
          ' <b class="' + (d.rate != null && d.rate > T ? 'kb-up' : '') + '">' + B.p(d.rate) + '</b>' + n(d.actives || []) + '</a>';
      }).join('') + '</div></div>';
  };
  B.mountCompact = function (ctx) {
    var doc = root.document, tb = doc.querySelector('.sr-tabsbar');
    var bar = ctx.el.querySelector('[data-kb-cbar]'), tiles = ctx.el.querySelector('[data-kb-tiles]');
    if (!bar || !tiles) return;
    if (ctx.kbScroll) { root.removeEventListener('scroll', ctx.kbScroll); root.removeEventListener('resize', ctx.kbScroll); }
    var on = function () {
      if (!ctx.alive() || !bar.isConnected) { root.removeEventListener('scroll', on); root.removeEventListener('resize', on); return; }
      var top = tb ? Math.max(0, tb.getBoundingClientRect().bottom) : 0, show = tiles.getBoundingClientRect().bottom < top + 4;
      bar.style.top = top + 'px';   // висота вкладок різна на ПК і телефоні — беремо з екрана (як шапка старої сторінки відділу)
      if (bar.classList.contains('kb-cbar--on') !== show) {
        bar.classList.toggle('kb-cbar--on', show); bar.setAttribute('aria-hidden', show ? 'false' : 'true');
        Array.prototype.forEach.call(bar.querySelectorAll('a'), function (a) { a.setAttribute('tabindex', show ? '0' : '-1'); });
      }
    };
    ctx.kbScroll = on;
    root.addEventListener('scroll', on, { passive: true });
    root.addEventListener('resize', on, { passive: true });
    on();
  };

  B.pareto = function (p) {
    if (!p || !p.items || !p.items.length) return '<p class="kb-cs">Дій немає · браку за останній завершений тиждень не записано.</p>';
    var max = Math.max.apply(null, p.items.map(function (x) { return x.pieces || 0; }).concat([1]));
    var last = -1;
    p.items.forEach(function (x, i) { if (x.in70) last = i; });
    var rows = p.items.map(function (x, i) {
      return '<span class="kb-par__n">' + B.lvlDot(x.level) + esc(x.name) + '</span>' +
        '<span class="kb-par__b"><i class="' + (x.in70 ? 'kb-lvf--' + (P.sr.LEVELS[x.level] ? x.level : 'fix') : 'kb-par__x') + '" style="--w:' + (x.pieces / max * 70).toFixed(1) + '%"></i><b>' + B.num(x.pieces) + ' шт</b></span>' +
        '<span class="kb-r kb-cs">' + Math.round(x.cumShare || 0) + '%</span>' +
        (i === last ? '<span class="kb-par__cut">↑ ці види дають ' + Math.round(x.cumShare || 0) + '% штук браку — з них почалася б дія</span>' : '');
    }).join('');
    return '<div class="kb-par"><span class="kb-par__t">Дій немає · Парето за ' + esc(B.rng(p.week.start, p.week.end)) + ' · ' + B.num(p.pieces) + ' шт браку</span>' +
      '<div class="kb-par__g"><span class="kb-wt-h">вид браку</span><span class="kb-wt-h">штук за тиждень</span><span class="kb-wt-h kb-r">разом</span>' + rows + '</div></div>';
  };
})(window);
