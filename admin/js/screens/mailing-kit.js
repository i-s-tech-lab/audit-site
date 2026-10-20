(function (root) {
  'use strict';
  var P = root.P, esc = P.esc;
  var DS = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var WD_IN = ['неділю', 'понеділок', 'вівторок', 'середу', 'четвер', 'пʼятницю', 'суботу'];
  var DATA = ['локація', 'перевірено', 'брак_шт', 'брак_%', 'аудитів', 'без_аудитів', 'найбільший_брак', 'топ_браку', 'кд_нових', 'кд_на_перевірці'];
  var PH = /\{([^{}\s]{1,20})\}/g;
  var counts = { rules: null, addr: null };   // лічильники в перемикачі розділів — оновлюють екрани після завантаження
  var chan = null;                             // назва тестового каналу (зі стану розсилки), коли відома

  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function plural(n, f) { var a = n % 10, b = n % 100; return f[a === 1 && b !== 11 ? 0 : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 1 : 2]; }
  function pct(x) { return String(x).replace('.', ',') + '%'; }

  function subnav(cur) {
    var items = [['rules', '/mailing', 'Розсилки', 'notification', counts.rules], ['addr', '/mailing/addr', 'Адресати', 'people', counts.addr], ['state', '/mailing/state', 'Стан і журнал', 'clock', null]];
    return '<nav class="pills adm-subnav rz-subnav" aria-label="Розділи розсилок">' + items.map(function (x) {
      var on = x[0] === cur;
      return '<a class="pill' + (on ? ' pill--on' : '') + '" href="#' + x[1] + '"' + (on ? ' aria-current="page"' : '') + '>' + P.ic(x[3], 'ui-icon--sm') + esc(x[2]) +
        (x[4] != null ? ' <span class="rz-subnav__n">' + x[4] + '</span>' : '') + '</a>';
    }).join('') + '</nav>';
  }

  function names(tpl) { var out = []; String(tpl || '').replace(PH, function (a, n) { out.push(n); return a; }); return out; }
  function needsData(r) {
    return r.when.kind === 'event' || (r.condition && r.condition.kind !== 'always') || names(r.template).some(function (n) { return DATA.indexOf(n) >= 0; });
  }
  function waitWhy(r, labels) {
    if (r.when.kind === 'event') return 'подію «' + eventName(r.when.event) + '» дасть база аудитів';
    var used = names(r.template).filter(function (n, i, a) { return DATA.indexOf(n) >= 0 && a.indexOf(n) === i; });
    if (used.length) return 'у тексті є цифри локацій: ' + used.slice(0, 3).map(function (n) { return '«' + ((labels && labels[n]) || n) + '»'; }).join(', ') + (used.length > 3 ? ' та ще ' + (used.length - 3) : '');
    if (r.condition && r.condition.kind !== 'always') return 'умова перевіряє цифри аудитів';
    return null;
  }

  function eventName(e) { return e === 'over' ? 'брак понад поріг' : e === 'kd' ? 'новий розбір коригуючих дій' : 'новий аудит'; }
  function daysText(days) {
    var s = (days || []).slice().sort(), k = s.join(',');
    return s.length === 7 ? 'щодня' : k === '1,2,3,4,5' ? 'пн–пт' : k === '1,2,3,4,5,6' ? 'пн–сб' : s.map(function (d) { return DS[d]; }).join(', ');
  }
  function daysOff(days) {
    var off = [1, 2, 3, 4, 5, 6, 0].filter(function (d) { return (days || []).indexOf(d) < 0; });
    return off.map(function (d) { return DS[d]; }).join(', ');
  }
  function everyText(n) { return n === 60 ? 'щогодини' : 'кожні ' + (n < 60 ? n + ' хв' : n / 60 + ' год'); }
  function lastSlot(w) {
    var from = +w.hour_from * 60, to = +w.hour_to * 60, n = +w.every_min || 60, m = from + Math.floor((to - from) / n) * n;
    return pad(Math.floor(m / 60)) + ':' + pad(m % 60);
  }
  function whenShort(r) {
    var w = r.when, d = daysText(w.days);
    if (w.kind === 'every') return cap(everyText(+w.every_min)) + ', ' + pad(w.hour_from) + ':00–' + pad(w.hour_to) + ':00, ' + (d || 'дні не обрано');
    if (w.kind === 'daily' && !(w.days || []).length) return 'Дні не обрано · о ' + w.at_time;
    if (w.kind === 'daily') return d === 'щодня' ? 'Щодня о ' + w.at_time : /–/.test(d) ? 'Щодня ' + d + ' о ' + w.at_time : 'У дні ' + d + ' о ' + w.at_time;
    if (w.kind === 'weekly') return 'Щотижня в ' + WD_IN[w.weekday] + ' о ' + w.at_time;
    if (w.event === 'over') return 'Щойно брак, % за сьогодні перевищить ' + pct(w.pct);
    if (w.event === 'kd') return 'Після нового розбору коригуючих дій (раз на тиждень)';
    return 'Одразу після запису аудиту';
  }
  function whenText(r) {
    var w = r.when;
    if (w.kind === 'every') return cap(everyText(+w.every_min)) + ', з ' + pad(w.hour_from) + ':00 до ' + pad(w.hour_to) + ':00 включно, ' + daysText(w.days) + ' — за Києвом';
    if (w.kind === 'event') return 'Після події: ' + (w.event === 'over' ? 'щойно брак, % локації за сьогодні вперше перевищить ' + pct(w.pct) + ' (раз на день)'
      : w.event === 'kd' ? 'готовий новий розбір коригуючих дій (раз на тиждень)' : 'щойно аудитор записав аудит в обраних відділах');
    return whenShort(r) + ' за Києвом';
  }
  function condText(r) {
    var c = r.condition || { kind: 'always' }, one = r.when.kind === 'event' && r.when.event === 'audit';
    if (c.kind === 'audits') return 'Лише якщо сьогодні були аудити — інакше цього разу не надсилається';
    if (c.kind === 'over') return 'Лише якщо брак ' + (one ? 'в аудиті' : 'за сьогодні') + ' понад ' + pct(c.pct) + ' — інакше не надсилається';
    return r.when.kind === 'event' ? 'Завжди — після кожної такої події' : 'Завжди — щоразу, коли настав час';
  }
  function condShort(r) {
    var c = r.condition || { kind: 'always' }, one = r.when.kind === 'event' && r.when.event === 'audit';
    return c.kind === 'audits' ? 'лише якщо сьогодні були аудити' : c.kind === 'over' ? 'лише якщо брак ' + (one ? 'в аудиті' : 'за сьогодні') + ' понад ' + pct(c.pct) : 'завжди';
  }
  function whereText(r) {
    var loc = cap(r.locLabel || (r.locations === 'all' ? 'усі локації' : (r.locations || []).join(', ')));
    var deps = Array.isArray(r.departments) ? r.departments : null;
    return loc + ' · ' + (!deps ? 'усі відділи' : (deps.length === 1 ? 'лише відділ ' : 'лише відділи ') + (r.depLabel || deps.join(', ')));
  }
  function whereNote(r) {
    if (!needsData(r)) return 'у тексті немає цифр локацій — тож піде одне спільне повідомлення';
    return r.locations === 'all' || (r.locations || []).length > 1 ? 'кожна локація — окремим повідомленням зі своїми цифрами' : '';
  }

  function people(data) {
    var ix = {}, loc = {}, dep = {};
    (data.locations || []).forEach(function (l) { loc[l.id] = l.name; (l.departments || []).forEach(function (x) { dep[x.id] = x.name; }); });
    (data.addressees || []).forEach(function (a) {
      var place = (loc[a.locationId] || a.locationId || '') + (a.departmentId ? ', ' + (dep[a.departmentId] || a.departmentId) : '');
      ix[a.id] = { name: a.name, kind: 'addr', active: a.active !== false, job: a.jobTitle || '', place: place,
        sub: 'особисто · адресат' + (a.jobTitle ? ' · ' + a.jobTitle : '') };
    });
    (data.users || []).forEach(function (u) {
      ix[u.id] = { name: u.name, kind: 'user', active: true, place: (u.locations || []).join(', '),
        sub: 'особисто · ' + u.roleLabel + ((u.locations || []).length ? ' · ' + u.locations.join(', ') : '') };
    });
    return ix;
  }
  function maskId(id) { return P.authSlack && P.authSlack.maskId ? P.authSlack.maskId(id) : String(id); }
  function recipChip(t, ix, i) {
    var cls, ic, name, sub, label;
    if (t.type === 'channel') { cls = 'ch'; ic = '<span class="rz-rc__hash" aria-hidden="true">#</span>'; name = esc(String(t.name).replace(/^#+/, '')); sub = 'канал'; label = '#' + t.name; }
    else {
      var p = ix[t.id];
      ic = P.ic('user', 'ui-icon--sm');
      if (!p) { cls = 'unk'; name = esc(maskId(t.id)); sub = 'немає в списку — приберіть'; label = maskId(t.id); }
      else if (!p.active) { cls = 'off'; name = '<s>' + esc(p.name) + '</s>'; sub = 'вимкнено — не отримує'; label = p.name; }
      else { cls = p.kind === 'addr' ? 'ad' : 'us'; name = esc(p.name); sub = p.sub; label = p.name; }
    }
    return '<span class="rz-rc rz-rc--' + cls + '">' + ic + '<b>' + name + '</b><em>' + esc(sub) + '</em>' +
      (i != null ? '<button class="rz-rc__x" type="button" data-act="rz-to-rm" data-i="' + i + '" aria-label="Прибрати ' + esc(label) + '">' + P.ic('close', 'ui-icon--sm') + '</button>' : '') + '</span>';
  }
  function toShort(r, ix, draft) {
    var to = r.to || [], ch = to.filter(function (t) { return t.type === 'channel'; }).map(function (t) { return '#' + t.name; });
    var ppl = to.filter(function (t) { return t.type === 'user'; }).map(function (t) { return ix[t.id] ? ix[t.id].name : maskId(t.id); });
    if (!to.length) return draft ? 'ще нікому — додайте канал або людину в кроці 4' : 'у тестовий канал' + (chan ? ' #' + chan : '') + ' (отримувачів не вказано)';
    var parts = [];
    if (ch.length) parts.push((ch.length === 1 ? 'у канал ' : 'у канали ') + ch.join(', '));
    if (ppl.length) parts.push(ppl.length <= 2 ? 'особисто: ' + ppl.join(' і ') : 'особисто ' + ppl.length + ' ' + plural(ppl.length, ['людині', 'людям', 'людям']));
    return parts.join(' і ');
  }
  function summary(r, ix, allowEmpty) {
    var s = '<b>' + esc(whenShort(r)) + '</b> — ' + esc(toShort(r, ix, !allowEmpty)) + '.';
    var wt = whereText(r).replace(' · ', ', ');
    s += ' Де: ' + esc(wt.charAt(0).toLowerCase() + wt.slice(1)) + '.';
    if (r.condition && r.condition.kind !== 'always') s += ' ' + esc(cap(condShort(r))) + '.';
    if (!r.enabled) s += ' <span class="rz-sum__off">Поки вимкнено — нічого не надсилається.</span>';
    return s;
  }

  function box(kind, html) {
    var ic = kind === 'warn' ? 'clock' : kind === 'ok' ? 'success' : kind === 'bad' ? 'error' : 'info';
    return '<div class="rz-box rz-box--' + kind + '">' + P.ic(ic, 'ui-icon--sm') + '<p>' + html + '</p></div>';
  }
  function sec(num, title, desc, inner, extra) {
    return '<section class="rz-sec"><div class="rz-sec__h"><span class="rz-num" aria-hidden="true">' + num + '</span><div><h3 class="rz-sec__t">' +
      esc(title) + (extra || '') + '</h3>' + (desc ? '<p class="rz-sec__d">' + desc + '</p>' : '') + '</div></div>' + inner + '</section>';
  }
  function safeVal(v) { return esc(String(v)).replace(/\*/g, '&#42;').replace(/_/g, '&#95;'); }
  function slackChips(tpl, links, vars) {
    var h = esc(tpl).replace(PH, function (all, n) {
      if (has(links, n)) return '<span class="rz-tk rz-tk--l">' + safeVal(links[n]) + ' ↗</span>';
      var v = has(vars, n) ? vars[n] : P.rzChips && P.rzChips.example ? P.rzChips.example(n) : null;
      return v == null || v === '' ? all : '<span class="rz-tk">' + safeVal(v) + '</span>';
    });
    return h.replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,!?])/gm, '$1<i>$2</i>').replace(/\n/g, '<br>');
  }
  function labels(options) {
    var m = {};
    ((options && options.groups) || []).forEach(function (g) { (g.items || []).forEach(function (x) { m[x[0]] = x[1]; }); });
    return m;
  }
  function channelName(s) {
    var n = String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 81).replace(/^#+/, '').toLowerCase().replace(/ /g, '-');
    return /^[a-zа-яіїєґʼ'0-9_.-]{1,80}$/.test(n) ? n : null;
  }

  P.mlKit = {
    subnav: subnav, setCounts: function (k, n) { counts[k] = n; }, chan: function (v) { if (arguments.length) chan = v || null; return chan; },
    needsData: needsData, waitWhy: waitWhy, daysText: daysText, daysOff: daysOff, everyText: everyText, lastSlot: lastSlot,
    whenShort: whenShort, whenText: whenText, condText: condText, condShort: condShort, whereText: whereText, whereNote: whereNote,
    people: people, recipChip: recipChip, toShort: toShort, summary: summary, maskId: maskId,
    box: box, sec: sec, slackChips: slackChips, labels: labels, channelName: channelName, plural: plural, cap: cap, eventName: eventName
  };
})(window);
