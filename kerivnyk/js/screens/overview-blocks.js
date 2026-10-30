(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var OV = P.mgrOv = P.mgrOv || {};
  var SHORT = 10;    // «Брак на 100 перевірених»: стільки рядків видно до кнопки «Усі N»
  var MAX_BACK = 365;   // як на сервері: дні не старші за стільки днів до сьогодні
  var CMP = null, perAll = false;

  function esc(s) { return P.esc ? P.esc(s) : String(s); }
  function H() { return P.sr.h; }
  function K() { return P.mgr; }

  function addDays(d, n) { var t = new Date(Date.parse(d + 'T00:00:00Z')); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
  function dow(d) { return (new Date(Date.parse(d + 'T00:00:00Z')).getUTCDay() + 6) % 7; }
  function oneDec(v) { return v == null ? '—' : (Math.round(v * 10) / 10).toLocaleString('uk-UA', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }

  function presets(today) {
    var first = today.slice(0, 8) + '01', lastPrev = addDays(first, -1), mon = addDays(today, -dow(today));
    return {
      month: { a: { from: first, to: today }, b: { from: lastPrev.slice(0, 8) + '01', to: lastPrev } },
      week: { a: { from: mon, to: today }, b: { from: addDays(mon, -7), to: addDays(mon, -1) } },
      d30: { a: { from: addDays(today, -29), to: today }, b: { from: addDays(today, -59), to: addDays(today, -30) } }
    };
  }
  var PRESET_NAMES = [['month', 'Цей місяць ↔ минулий місяць'], ['week', 'Цей тиждень ↔ минулий тиждень'], ['d30', 'Останні 30 днів ↔ попередні 30 днів'], ['custom', 'Свої дати']];

  function diffPp(a, b) {
    if (a == null || b == null) return null;
    var v = Math.round((a - b) * 10) / 10;
    if (!v) return { v: 0, text: '0,0 п.п.' };
    var abs = oneDec(Math.abs(v));
    return v > 0 ? { v: v, text: '▲ +' + abs + ' п.п.' } : { v: v, text: '▼ −' + abs + ' п.п.' };
  }

  function per100Rows(depts) {
    return (depts || []).slice().sort(function (x, y) {
      var xn = x.pct == null, yn = y.pct == null;
      if (xn !== yn) return xn ? 1 : -1;
      return (yn ? 0 : y.pct - x.pct) || (x.name < y.name ? -1 : x.name > y.name ? 1 : 0);
    });
  }
  function nocheckRows(depts) {
    return (depts || []).slice().sort(function (x, y) { return y.daysNoAudit - x.daysNoAudit || (x.name < y.name ? -1 : x.name > y.name ? 1 : 0); });
  }
  function periodProblem(p, label, today) {
    if (!p || !p.from || !p.to) return label + ': вкажіть обидві дати.';
    if (p.from > p.to) return label + ': початок не може бути пізніше за кінець.';
    if (p.from > today) return label + ': початок періоду ще не настав.';
    if (p.from < addDays(today, -MAX_BACK)) return label + ': можна взяти дні не старші за ' + MAX_BACK + ' днів.';
    return '';
  }

  function head(title, helpKey, sub, boxHtml) {
    return wrap('<h2 class="card-title">' + esc(title) + K().help(helpKey) + '</h2>' + (sub ? '<p class="hint">' + sub + '</p>' : ''), boxHtml);
  }
  function wrap(inner, boxHtml) { return '<div class="ov-head"><div>' + inner + '</div>' + (boxHtml || '') + '</div>'; }
  function errHtml(id, r) { return H().error(r).replace('data-act="retry"', 'data-act="ov-retry" data-id="' + esc(id) + '"'); }
  function dateField(per, k, v, today) {
    return '<label class="date ov-date">' + P.ic('calendar', 'ui-icon--sm') + '<span class="mgr-dim">' + (k === 'from' ? 'з' : 'по') + '</span>' +
      '<input type="date" data-change="ov-cmp-date" data-p="' + per + '" data-k="' + k + '" value="' + esc(v || '') + '" min="' + addDays(today, -MAX_BACK) + '" max="' + today +
      '" aria-label="' + (per === 'a' ? 'Період A' : 'Період B') + ': ' + (k === 'from' ? 'перший день' : 'останній день') + '"></label>';
  }
  function controls(st, today) {
    return '<div class="ov-ctl"><label class="ov-ctl__f"><span class="label">Готова пара періодів</span><select class="input mgr-select ov-preset" data-change="ov-cmp-preset" aria-label="Готова пара періодів">' +
      PRESET_NAMES.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === st.preset ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></label>' +
      ['a', 'b'].map(function (per) {
        return '<div class="ov-ctl__f" role="group" aria-label="Період ' + per.toUpperCase() + '"><span class="label">Період ' + per.toUpperCase() + '</span><div class="ov-per">' +
          dateField(per, 'from', st[per].from, today) + dateField(per, 'to', st[per].to, today) + '</div></div>';
      }).join('') + '</div>';
  }
  function pair(x, y, f) { return '<td class="n">' + f(x) + '</td><td class="n">' + f(y) + '</td>'; }
  function table(r) {
    var h = H(), num = function (o) { return h.num(o); }, pct = function (o) { return h.pct(o); };
    function row(name, a, b, strong) {
      var d = diffPp(a.pct, b.pct);
      return '<tr' + (strong ? ' class="ov-total"' : '') + '><td>' + (strong ? '<b>' + esc(name) + '</b>' : esc(name)) + '</td>' +
        pair(a.audits, b.audits, num) + pair(a.checked, b.checked, num) + pair(a.rejected, b.rejected, num) + pair(a.pct, b.pct, pct) +
        '<td class="n ov-diff">' + (d ? esc(d.text) : '<span class="mgr-dim">—</span>') + '</td></tr>';
    }
    var ab = '<th class="n">A</th><th class="n">B</th>';
    return '<div class="tbl-box ov-tbox"><table class="tbl mgr-tbl ov-ctbl"><thead><tr><th rowspan="2">Відділ</th><th class="n" colspan="2">Аудитів</th>' +
      '<th class="n" colspan="2">Перевірено, шт</th><th class="n" colspan="2">Брак, шт</th><th class="n" colspan="2">Брак, %</th>' +
      '<th class="n" rowspan="2">Різниця, п.п. (B→A)</th></tr><tr>' + ab + ab + ab + ab + '</tr></thead><tbody>' +
      r.rows.map(function (x) { return row(x.name, x.a, x.b, false); }).join('') + row('Усього', r.total.a, r.total.b, true) + '</tbody></table></div>';
  }
  function nocheckList(rows) {
    return '<ol class="ov-rank">' + rows.map(function (d) {
      var part = d.workDays ? Math.round(d.daysNoAudit / d.workDays * 100) : 0;
      return '<li><span class="ov-rank__t"><b>' + esc(d.name) + '</b>' + (d.active ? '' : ' ' + H().badge('вимкнено')) + '</span>' +
        '<span class="ov-rank__v">' + K().dn(d.daysNoAudit) + ' без перевірок з ' + H().num(d.workDays) + '</span>' +
        '<span class="ov-rank__bar" aria-hidden="true"><i style="width:' + part + '%"></i></span></li>';
    }).join('') + '</ol>';
  }
  function per100Table(rows) {
    var h = H();
    return '<div class="tbl-box ov-tbox"><table class="tbl mgr-tbl ov-ptbl"><thead><tr><th>Відділ · локація</th><th class="n">Брак на 100 перевірених</th>' +
      '<th class="n">Перевірено, шт</th><th class="n">Брак, шт</th></tr></thead><tbody>' + rows.map(function (d) {
        return '<tr><td>' + esc(d.name) + (d.active === false ? ' ' + h.badge('вимкнено') : '') + '<br><span class="mgr-dim">' + esc(d.locationName) + '</span></td>' +
          '<td class="n">' + (d.pct == null ? '<span class="mgr-dim">—</span>' : '<b>' + oneDec(d.pct) + '</b>') + '</td>' +
          '<td class="n">' + h.num(d.checked) + '</td><td class="n">' + h.num(d.rejected) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  OV.mount = function (ctx, o) {
    var drawn = {}, req = { compare: 0, nocheck: 0, per100: 0 }, per = { data: null };
    var today = P.cab && P.cab.today ? P.cab.today() : P.fmt.dayKey(new Date());
    if (!CMP) { var pr = presets(today).month; CMP = { preset: 'month', a: pr.a, b: pr.b }; }
    function sec(id) { return ctx.el.querySelector('#ov-' + id); }
    function bx(id) { return (o.box && o.box[id]) || ''; }
    var scope = o.loc.name, span = K().span(o.period.from, o.period.to);

    function drawCompare() {
      var el = sec('compare');
      if (!el) return;
      el.innerHTML = head('Порівняння двох періодів', 'mgr.ov.compare', esc(scope) + ' · відділи цієї локації · брак, % і різниця — лише числа', bx('compare')) +
        controls(CMP, today) + '<p class="hint" data-ov="cmp-cap"></p><div data-ov="cmp-res"></div>';
      loadCompare();
    }
    function loadCompare() {
      var el = sec('compare'), res = el && el.querySelector('[data-ov="cmp-res"]'), cap = el && el.querySelector('[data-ov="cmp-cap"]');
      if (!res) return;
      var my = ++req.compare, why = periodProblem(CMP.a, 'Період A', today) || periodProblem(CMP.b, 'Період B', today);
      if (cap) cap.innerHTML = why ? '' : 'A — ' + esc(K().span(CMP.a.from, CMP.a.to)) + ' · B — ' + esc(K().span(CMP.b.from, CMP.b.to));
      if (why) { res.innerHTML = '<p class="hint ov-why" role="alert">' + esc(why) + '</p>'; return; }
      res.innerHTML = H().loading();
      P.srv('mgrCompare', { locationId: o.loc.id, a: CMP.a, b: CMP.b }).then(function (r) {
        if (!ctx.alive() || my !== req.compare) return;
        if (!r.ok) { res.innerHTML = r.code === 'validation' ? '<p class="hint ov-why" role="alert">' + esc(r.error) + '</p>' : errHtml('compare', r); return; }
        res.innerHTML = r.rows.length ? table(r) : H().empty('У локації немає відділів', 'Коли адміністратор додасть відділи, тут зʼявляться їхні числа.');
      });
    }

    function drawNocheck() {
      var el = sec('nocheck');
      if (!el) return;
      var my = ++req.nocheck, top = head('Дні без перевірок', 'mgr.ov.nocheck', esc(scope) + ' · ' + esc(span), bx('nocheck'));
      el.innerHTML = top + H().loading();
      P.srv('mgrDeptTiles', { from: o.period.from, to: o.period.to, locationIds: [o.loc.id] }).then(function (r) {
        if (!ctx.alive() || my !== req.nocheck) return;
        if (!r.ok) { el.innerHTML = top + errHtml('nocheck', r); return; }
        var l = r.locations[0], rows = l ? nocheckRows(l.depts) : [];
        if (!rows.length) { el.innerHTML = top + H().empty('Відділів немає', 'У цій локації за період немає відділів із числами.'); return; }
        if (!l.workDays) { el.innerHTML = top + H().empty('Аудитів за період не було', scope + ' · ' + span + ' — рахувати дні без перевірок нема з чого.'); return; }
        el.innerHTML = head('Дні без перевірок', 'mgr.ov.nocheck', esc(scope) + ' · ' + esc(span) + ' · днів з аудитами в локації — ' + H().num(l.workDays), bx('nocheck')) + nocheckList(rows);
      });
    }

    function drawPer100() {
      var el = sec('per100');
      if (!el) return;
      var my = ++req.per100, top = head('Брак на 100 перевірених', 'mgr.ov.per100', 'Відділи всіх локацій · ' + esc(span), bx('per100'));
      el.innerHTML = top + H().loading();
      P.srv('mgrDepts', { from: o.period.from, to: o.period.to }).then(function (r) {
        if (!ctx.alive() || my !== req.per100) return;
        if (!r.ok) { el.innerHTML = top + errHtml('per100', r); return; }
        per.data = r.depts;
        paintPer100();
      });
    }
    function paintPer100() {
      var el = sec('per100');
      if (!el || !per.data) return;
      var rows = per100Rows(per.data), top = head('Брак на 100 перевірених', 'mgr.ov.per100', 'Відділи всіх локацій · ' + esc(span), bx('per100'));
      if (!rows.length) { el.innerHTML = top + H().empty('Відділів немає', 'За період немає відділів із числами.'); return; }
      el.innerHTML = top + per100Table(perAll ? rows : rows.slice(0, SHORT)) + (rows.length > SHORT ?
        '<button class="btn btn--secondary btn--sm ov-more" type="button" data-act="ov-per-all" aria-expanded="' + perAll + '">' + (perAll ? 'Згорнути список' : 'Усі ' + H().num(rows.length)) + '</button>' : '');
    }

    var DRAW = { compare: drawCompare, nocheck: drawNocheck, per100: drawPer100 };
    ctx.on('ov-retry', function (t) { var id = t.getAttribute('data-id'); if (DRAW[id]) DRAW[id](); });
    ctx.on('ov-per-all', function () { perAll = !perAll; paintPer100(); });
    ctx.on('ov-cmp-preset', function (t) {
      var v = t.value;
      if (v === 'custom') { CMP.preset = 'custom'; return; }
      var pr = presets(today)[v];
      if (!pr) return;
      CMP = { preset: v, a: pr.a, b: pr.b };
      ['a', 'b'].forEach(function (p) {
        ['from', 'to'].forEach(function (k) { var inp = ctx.el.querySelector('input[data-p="' + p + '"][data-k="' + k + '"]'); if (inp) inp.value = CMP[p][k]; });
      });
      loadCompare();
    });
    ctx.on('ov-cmp-date', function (t) {
      var p = t.getAttribute('data-p'), k = t.getAttribute('data-k');
      if (!CMP[p] || (k !== 'from' && k !== 'to')) return;
      CMP[p] = Object.assign({}, CMP[p]); CMP[p][k] = t.value; CMP.preset = 'custom';
      var sel = ctx.el.querySelector('[data-change="ov-cmp-preset"]');
      if (sel) sel.value = 'custom';
      loadCompare();
    });

    return {
      show: function (id) { if (DRAW[id] && !drawn[id]) { drawn[id] = true; DRAW[id](); } },
      start: function () { Object.keys(DRAW).forEach(function (id) { if (!o.visible || o.visible(id)) { drawn[id] = true; DRAW[id](); } }); }
    };
  };

  OV.wrap = wrap;
  OV._h = { presets: presets, diffPp: diffPp, per100Rows: per100Rows, nocheckRows: nocheckRows, periodProblem: periodProblem, oneDec: oneDec, addDays: addDays, SHORT: SHORT };
  if (typeof module !== 'undefined' && module.exports) module.exports = OV;
})(typeof window !== 'undefined' ? window : globalThis);
