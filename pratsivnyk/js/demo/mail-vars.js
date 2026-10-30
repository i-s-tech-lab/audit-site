(function (root) {
  'use strict';
  var P = root.P = root.P || {};

  var TZ = 'Europe/Kyiv';
  var WD = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'];
  var MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  var MONTHS_NOM = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];
  var EVERY = [5, 10, 15, 30, 60, 120, 180, 240, 360, 720];
  var CAPS = { noAudits: 10, topDefects: 5 };   // скільки елементів у списках перегляду (як LIST_CAPS у mail-core.mjs)
  var MAX_PER_RECIPIENT_DAY = 60, SKIP_DAYS_MAX = 60, SKIP_LABEL_MAX = 40;
  var LINKS = { 'кабінет_старшого': 'Кабінет старшого', 'форма_аудиту': 'Форма аудиту' };
  var GROUPS = [
    { title: 'Сьогодні', items: [['локація', 'локація'], ['перевірено', 'перевірено, шт'], ['брак_шт', 'брак, шт'], ['брак_%', 'брак, %'], ['аудитів', 'аудитів'], ['без_аудитів', 'відділи без аудитів'], ['відділів_з_аудитами', 'відділів з аудитами']] },
    { title: 'Вчора', items: [['вчора_перевірено', 'перевірено вчора, шт'], ['вчора_брак_%', 'брак вчора, %'], ['вчора_аудитів', 'аудитів вчора']] },
    { title: 'Минулий тиждень', items: [['тиж_перевірено', 'перевірено за тиждень, шт'], ['тиж_брак_%', 'брак за тиждень, %'], ['тиж_аудитів', 'аудитів за тиждень']] },
    { title: 'Відділи', items: [['найбільший_брак', 'відділ з найбільшим % браку'], ['топ_браку', 'найчастіші види браку']] },
    { title: 'Коригуючі дії', items: [['кд_нових', 'понад норму, не почато'], ['кд_на_перевірці', 'йде тиждень після впровадження']] },
    { title: 'Посилання', items: [['кабінет_старшого', 'кабінет старшого'], ['форма_аудиту', 'форма аудиту']] },
    { title: 'Час', items: [['день', 'день'], ['дата', 'дата'], ['час', 'час'], ['вчора', 'вчорашня дата'], ['тиждень', 'номер тижня'], ['місяць', 'місяць'], ['минулий_тиждень', 'дати минулого тижня']] }
  ];
  var TIME = ['день', 'дата', 'час', 'вчора', 'тиждень', 'місяць', 'минулий_тиждень'];
  var DATA = ['локація', 'перевірено', 'брак_шт', 'брак_%', 'аудитів', 'без_аудитів', 'відділів_з_аудитами', 'вчора_перевірено', 'вчора_брак_%', 'вчора_аудитів',
    'тиж_перевірено', 'тиж_брак_%', 'тиж_аудитів', 'найбільший_брак', 'топ_браку', 'кд_нових', 'кд_на_перевірці'];

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function squash(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max); }

  function kyivParts(now) {
    var d = now instanceof Date ? now : new Date(now);
    var p = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(d).reduce(function (o, x) { o[x.type] = x.value; return o; }, {});
    var y = +p.year, m = +p.month, day = +p.day, hh = +p.hour % 24, mm = +p.minute;
    return { y: y, m: m, d: day, dayKey: y + '-' + pad(m) + '-' + pad(day), dow: new Date(Date.UTC(y, m - 1, day)).getUTCDay(), minutes: hh * 60 + mm, hhmm: pad(hh) + ':' + pad(mm) };
  }
  function utcOf(key) { var p = key.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function addDays(key, n) { var t = utcOf(key); t.setUTCDate(t.getUTCDate() + n); return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); }
  function dowOf(key) { return utcOf(key).getUTCDay(); }
  function isoWeek(key) {
    var t = utcOf(key);
    t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7));   // четвер цього тижня
    var j4 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((t - j4) / 86400000 - 3 + ((j4.getUTCDay() + 6) % 7)) / 7);
  }
  function lastWeek(key) { var mon = addDays(key, -((dowOf(key) + 6) % 7)); return { from: addDays(mon, -7), to: addDays(mon, -1) }; }
  function rangeText(a, b) {
    var x = a.split('-'), y = b.split('-');
    return x[1] === y[1] ? +x[2] + '–' + +y[2] + ' ' + MONTHS[+y[1] - 1] : +x[2] + ' ' + MONTHS[+x[1] - 1] + ' – ' + +y[2] + ' ' + MONTHS[+y[1] - 1];
  }
  function timeVars(now) {
    var k = kyivParts(now), yd = addDays(k.dayKey, -1), w = lastWeek(k.dayKey), yp = yd.split('-');
    return { 'день': WD[k.dow], 'дата': k.d + ' ' + MONTHS[k.m - 1], 'час': k.hhmm, 'вчора': +yp[2] + ' ' + MONTHS[+yp[1] - 1], 'тиждень': String(isoWeek(k.dayKey)),
      'місяць': MONTHS_NOM[k.m - 1], 'минулий_тиждень': rangeText(w.from, w.to) };
  }

  function agg(env, loc, deps, from, to) {
    var S = P.demoSenior, C = P.demoCommon, inSet = {};
    deps.forEach(function (d) { inSet[d.id] = 1; });
    var list = S.audits(env, loc.id, from, to).filter(function (a) { return has(inSet, a.departmentId); });
    var o = { list: list, checked: 0, rejected: 0, types: {}, worst: null, none: [], withAudit: 0 };
    deps.forEach(function (d) {
      var st = S.deptStats(env, list, d.id), pc = C.pct(st.rejected, st.checked);
      o.checked += st.checked; o.rejected += st.rejected;
      Object.keys(st.byType).forEach(function (id) { o.types[id] = (o.types[id] || 0) + st.byType[id]; });
      if (list.some(function (a) { return a.departmentId === d.id; })) o.withAudit++; else o.none.push(d.name);
      if (pc != null && (!o.worst || pc > o.worst.pct)) o.worst = { name: d.name, pct: pc };
    });
    return o;
  }
  function data(env, me, loc, depIds) {
    var C = P.demoCommon, today = env.day(), yd = addDays(today, -1), w = lastWeek(today);
    var deps = env.db.departments.filter(function (d) { return d.locationId === loc.id && d.active !== false && (!depIds || depIds.indexOf(d.id) >= 0); });
    var t = agg(env, loc, deps, today, today), y = agg(env, loc, deps, yd, yd), wk = agg(env, loc, deps, w.from, w.to);
    var top = Object.keys(t.types).sort(function (a, b) { return t.types[b] - t.types[a]; }).slice(0, CAPS.topDefects)
      .map(function (id) { return (env.ix.def[id] ? env.ix.def[id].name : 'Невідомий вид браку') + ' ' + P.fmt.num(t.types[id]); });
    var kd = null;
    P.demoApis.forEach(function (api) {
      if (kd || !has(api, 'srKdOverview')) return;
      try { var r = api.srKdOverview({ locationId: loc.id }, me, env); if (r && r.ok && r.totals) kd = r.totals; } catch (e) { kd = null; }
    });
    var pct = function (a) { var x = C.pct(a.rejected, a.checked); return x == null ? '—' : P.fmt.pct(x); };
    var vars = Object.assign({ 'локація': loc.name, 'перевірено': P.fmt.num(t.checked), 'брак_шт': P.fmt.num(t.rejected), 'брак_%': pct(t),
      'аудитів': P.fmt.num(t.list.length), 'без_аудитів': t.none.slice(0, CAPS.noAudits).join(', ') || 'немає', 'відділів_з_аудитами': t.withAudit + ' з ' + deps.length,
      'вчора_перевірено': P.fmt.num(y.checked), 'вчора_брак_%': pct(y), 'вчора_аудитів': P.fmt.num(y.list.length),
      'тиж_перевірено': P.fmt.num(wk.checked), 'тиж_брак_%': pct(wk), 'тиж_аудитів': P.fmt.num(wk.list.length),
      'найбільший_брак': t.worst ? t.worst.name + ' — ' + P.fmt.pct(t.worst.pct) : '—', 'топ_браку': top.join(' · ') || 'немає',
      'кд_нових': kd ? String(kd.new || 0) : '—', 'кд_на_перевірці': kd ? String(kd.review != null ? kd.review : kd.check || 0) : '—' }, timeVars(env.now()));
    return { vars: vars, audits: t.list.length, pct: C.pct(t.rejected, t.checked) };
  }
  function vars(env, me, loc, depIds) { return data(env, me, loc, depIds).vars; }

  function kyivOffset(ms) {
    var base = Math.floor(ms / 60000) * 60000, k = kyivParts(new Date(base));
    return (Date.UTC(k.y, k.m - 1, k.d, Math.floor(k.minutes / 60), k.minutes % 60) - base) / 60000;
  }
  function kyivToUtc(key, minutes) {
    var p = key.split('-'), local = Date.UTC(+p[0], +p[1] - 1, +p[2]) + minutes * 60000;
    var guess = local - kyivOffset(local) * 60000;
    return local - kyivOffset(guess) * 60000;
  }
  function minutesOf(hhmm) { var m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(hhmm || '')); return m ? +m[1] * 60 + +m[2] : null; }
  function slotAt(rule, now) {
    if (!rule || !rule.enabled || !rule.when) return null;
    var w = rule.when, k = kyivParts(now), days = Array.isArray(w.days) ? w.days : [];
    if (w.kind === 'every') {
      var n = +w.every_min, from = +w.hour_from * 60;
      if (days.indexOf(k.dow) < 0 || EVERY.indexOf(n) < 0 || k.minutes < from) return null;
      var start = from + Math.floor((k.minutes - from) / n) * n;
      return start > +w.hour_to * 60 || k.minutes - start >= Math.min(n, 15) ? null : k.dayKey + 'T' + start;
    }
    if (w.kind === 'daily' || w.kind === 'weekly') {
      if (w.kind === 'daily' ? days.indexOf(k.dow) < 0 : k.dow !== +w.weekday) return null;
      var t = minutesOf(w.at_time);
      return t == null || k.minutes < t || k.minutes >= t + 60 ? null : k.dayKey + 'T' + w.at_time;
    }
    return null;
  }
  function slotMoment(rule, key, t) {
    var shows = function (ms) { var p = kyivParts(new Date(ms)); return p.dayKey === key && p.minutes === t; };
    var at = kyivToUtc(key, t);
    if (shows(at - 3600000)) at -= 3600000;
    if (shows(at)) return at;
    while (kyivParts(new Date(at - 60000)).dayKey === key && kyivParts(new Date(at - 60000)).minutes >= t) at -= 60000;
    return slotAt(rule, new Date(at)) ? at : null;
  }
  function daySlots(w) {
    if (w.kind === 'every') {
      var n = +w.every_min, from = +w.hour_from * 60, to = +w.hour_to * 60, out = [];
      if (EVERY.indexOf(n) < 0 || !(from >= 0) || !(to >= from)) return out;
      for (var m = from; m <= to; m += n) out.push(m);
      return out;
    }
    var t = minutesOf(w.at_time);
    return t == null ? [] : [t];
  }
  function nextSendAt(rule, now, skipDays) {
    var w = rule && rule.enabled && rule.when;
    if (!w || ['every', 'daily', 'weekly'].indexOf(w.kind) < 0) return null;
    var skip = {}, nowMs = +(now instanceof Date ? now : new Date(now)), k = kyivParts(now), days = Array.isArray(w.days) ? w.days : [];
    if (!isFinite(nowMs)) return null;
    (Array.isArray(skipDays) ? skipDays : []).forEach(function (x) { var d = x && typeof x === 'object' ? x.date : x; if (d) skip[d] = 1; });
    var slots = daySlots(w);
    for (var i = 0; i <= 14; i++) {
      var key = addDays(k.dayKey, i), dow = dowOf(key);
      if (w.kind === 'weekly' ? dow !== +w.weekday : days.indexOf(dow) < 0) continue;
      if (skip[key]) continue;
      for (var j = 0; j < slots.length; j++) {
        var at = slotMoment(rule, key, slots[j]);
        if (at != null && at > nowMs) return new Date(at).toISOString();
      }
    }
    return null;
  }
  function perDayMax(rule) {
    var w = rule && rule.when;
    if (!w) return null;
    if (w.kind === 'daily' || w.kind === 'weekly') return 1;
    return w.kind === 'every' ? daySlots(w).length || null : null;
  }

  function realDate(s) { s = String(s == null ? '' : s); return /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s; }
  function validSkipDay(x, existing, todayKey, oldDate) {
    x = x && typeof x === 'object' ? x : {};
    var list = Array.isArray(existing) ? existing : [], date = String(x.date == null ? '' : x.date).trim();
    if (!realDate(date)) return { error: 'Дата — у форматі РРРР-ММ-ДД.', field: 'date' };
    if (date < todayKey) return { error: 'Цей день уже минув.', field: 'date' };
    if (date > addDays(todayKey, 365)) return { error: 'Не далі ніж на рік уперед.', field: 'date' };
    if (list.some(function (d) { return d && d.date === date && d.date !== oldDate; })) return { error: 'Цей день уже є в списку.', field: 'date' };
    var label = String(x.label == null ? '' : x.label).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
    if (label.length > SKIP_LABEL_MAX) return { error: 'Назва — до 40 знаків.', field: 'label' };
    if (!list.some(function (d) { return d && d.date === oldDate; }) && list.length >= SKIP_DAYS_MAX) return { error: 'Днів без розсилок — до ' + SKIP_DAYS_MAX + '.', field: 'date' };
    return { item: { date: date, label: label } };
  }
  function pruneSkipDays(list, todayKey) {
    var seen = {}, out = [];
    (Array.isArray(list) ? list : []).forEach(function (x) {
      var date = x && typeof x === 'object' ? x.date : x;
      if (!realDate(date) || date < todayKey || seen[date]) return;
      seen[date] = 1;
      out.push({ date: date, label: x && typeof x === 'object' && typeof x.label === 'string' ? x.label.slice(0, SKIP_LABEL_MAX) : '' });
    });
    return out.sort(function (a, b) { return a.date < b.date ? -1 : 1; }).slice(0, SKIP_DAYS_MAX);
  }

  P.demoMailVars = { GROUPS: GROUPS, LINKS: LINKS, TIME: TIME, DATA: DATA, MONTHS: MONTHS, WD: WD, EVERY: EVERY, MAX_PER_RECIPIENT_DAY: MAX_PER_RECIPIENT_DAY, SKIP_DAYS_MAX: SKIP_DAYS_MAX,
    kyivParts: kyivParts, addDays: addDays, timeVars: timeVars, vars: vars, data: data, nextSendAt: nextSendAt, perDayMax: perDayMax, validSkipDay: validSkipDay, pruneSkipDays: pruneSkipDays };
})(typeof window !== 'undefined' ? window : globalThis);
