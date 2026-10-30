(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, f = P.fmt;
  var BACK_DAYS = 29;       // «сьогодні» + 29 днів назад = 30 днів
  var LIMIT = 200;          // стільки рядків сервер віддає за раз (максимум функції)
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  function toTime(day) { return Date.parse(day + 'T12:00:00Z'); }
  function addDays(day, n) { return new Date(toTime(day) + n * 86400000).toISOString().slice(0, 10); }
  function validDay(s) { return typeof s === 'string' && DAY_RE.test(s) && addDays(s, 0) === s; }
  function pickDay(q, today) {
    if (!validDay(q)) return today;
    var oldest = addDays(today, -BACK_DAYS);
    return q > today ? today : q < oldest ? oldest : q;
  }
  function kyivToday() { return f.dayKey(new Date().toISOString()); }
  function dayLabel(day, today) {
    if (day === today) return 'сьогодні';
    if (day === addDays(today, -1)) return 'вчора';
    return new Intl.DateTimeFormat('uk-UA', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(toTime(day)));
  }

  function dayBar(day, today) {
    var oldest = addDays(today, -BACK_DAYS);
    function arrow(act, icon, label, off) {
      return '<button class="ui-btn ui-btn--secondary ui-btn--icon" type="button" data-act="' + act + '" aria-label="' + label + '"' + (off ? ' disabled' : '') + '>' + P.ic(icon) + '</button>';
    }
    return '<div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-3)">' +
      arrow('day-prev', 'chevron-left', 'Попередній день', day <= oldest) +
      '<div style="text-align:center;min-width:0"><p style="margin:0;font-weight:var(--fw-semibold)">' + esc(dayLabel(day, today)) + '</p>' +
      '<p class="card-sub">' + esc(day.slice(8) + '.' + day.slice(5, 7) + '.' + day.slice(0, 4)) + '</p></div>' +
      arrow('day-next', 'chevron-right', 'Наступний день', day >= today) + '</div>';
  }

  function row(a, me) {
    var what = (a.products || []).concat(a.orders || []).filter(Boolean).join(' · ');
    var who = a.auditorId === me.id ? 'ви' : (a.auditorName || '—');
    return '<button class="mini-item" type="button" data-audit="' + esc(a.id) + '">' + P.ic('audit') +
      '<span class="mini-item__main"><span class="mini-item__title">' + f.time(a.createdAt) + ' · ' + esc(a.departmentName) + '</span>' +
      (what ? '<span class="mini-item__meta">' + esc(what) + '</span>' : '') +
      '<span class="mini-item__meta">перевіряв(ла): ' + esc(who) + ' · перевірено ' + f.num(a.checked) + ' шт · брак ' + f.num(a.rejected) + ' шт (' + f.pct(a.pct) + ')</span></span>' +
      P.ic('chevron-right') + '</button>';
  }

  P.screen('/audits', {
    back: '/home',
    title: function (ctx) { return { title: 'Аудити локації', sub: P.shell.locName(ctx.loc) }; },
    render: function (ctx) {
      var today = kyivToday(), q = ctx.query && ctx.query.day;
      var day = pickDay(q, today);
      return P.srv('auditListLocation', { locationId: ctx.loc, day: day, limit: LIMIT }).then(function (r) {
        if (!r.ok) return '<div class="stack">' + P.state.error('Не вдалося завантажити аудити', r.error) + '</div>';
        if (r.today) today = r.today;   // «сьогодні» за сервером — на нього орієнтується кнопка ›
        ctx.today = today;              // mount (той самий ctx) бере «сьогодні» звідси: кнопки днів рахуються за сервером
        var items = r.items || [], total = r.total == null ? items.length : r.total;
        var body = items.length
          ? '<div class="mini-list">' + items.map(function (a) { return row(a, ctx.me); }).join('') + '</div>' +
            (total > items.length ? '<p class="card-sub">Показано ' + items.length + ' з ' + f.num(total) + '.</p>' : '')
          : P.state.empty('audit', 'За цей день аудитів немає', day === today ? 'Аудити, які запишуть у цій локації, зʼявляться тут.' : 'Спробуйте інший день — кнопки зі стрілками вгорі.');
        return '<div class="stack"><section class="ui-card" aria-label="Аудити локації">' + dayBar(day, today) +
          '<p class="card-sub" style="text-align:center">' + f.num(total) + ' ' + P.plural(total, 'аудит', 'аудити', 'аудитів') + '</p>' + body + '</section></div>';
      });
    },
    mount: function (el, ctx) {
      var q = ctx.query && ctx.query.day, today = ctx.today || kyivToday();
      var day = pickDay(q, today);
      P.delegate(el, 'click', '[data-act="retry"]', function () { P.shell.rerender(); });
      function go(d) { P.router.go('/audits', d >= today ? {} : { day: d }); }
      P.delegate(el, 'click', '[data-act="day-prev"]', function () { go(addDays(day, -1)); });
      P.delegate(el, 'click', '[data-act="day-next"]', function () { go(addDays(day, 1)); });
      P.delegate(el, 'click', '[data-audit]', function (e, t) { P.router.go('/audit/' + t.getAttribute('data-audit'), { from: 'loc' }); });
    }
  });
})(window);
