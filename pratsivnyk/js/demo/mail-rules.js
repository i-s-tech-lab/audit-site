(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  P.demoApis = P.demoApis || []; P.demoResetKeys = P.demoResetKeys || [];

  var KEY = 'demo:ml:rules', KEY_ADDR = 'demo:ml:addr';
  P.demoResetKeys.push(KEY); P.demoResetKeys.push(KEY_ADDR);
  var EVERY = [5, 10, 15, 30, 60, 120, 180, 240, 360, 720];
  var KINDS = { every: 1, daily: 1, weekly: 1, event: 1 }, CONDS = { always: 1, audits: 1, over: 1 };
  var EVENTS = { audit: 'одразу після запису аудиту', over: 'щойно брак, % за сьогодні перевищить', kd: 'щойно готовий новий розбір коригуючих дій (раз на тиждень)' };
  var WD = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'];
  var WD_IN = ['неділю', 'понеділок', 'вівторок', 'середу', 'четвер', 'пʼятницю', 'суботу'];
  var DS = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  var LINKS = { 'кабінет_старшого': 'Кабінет старшого', 'форма_аудиту': 'Форма аудиту' };
  var GROUPS = [
    { title: 'Сьогодні', items: [['локація', 'локація'], ['перевірено', 'перевірено, шт'], ['брак_шт', 'брак, шт'], ['брак_%', 'брак, %'], ['аудитів', 'аудитів'], ['без_аудитів', 'відділи без аудитів']] },
    { title: 'Відділи', items: [['найбільший_брак', 'відділ з найбільшим % браку'], ['топ_браку', 'найчастіші види браку']] },
    { title: 'Коригуючі дії', items: [['кд_нових', 'понад норму, не почато'], ['кд_на_перевірці', 'йде тиждень після впровадження']] },
    { title: 'Посилання', items: [['кабінет_старшого', 'кабінет старшого'], ['форма_аудиту', 'форма аудиту']] },
    { title: 'Час', items: [['день', 'день'], ['дата', 'дата'], ['час', 'час']] }
  ];
  var KNOWN = {}; GROUPS.forEach(function (g) { g.items.forEach(function (x) { KNOWN[x[0]] = 1; }); });
  var PH = /\{([^{}\s]{1,20})\}/g;
  var DEP_ID = /^[A-Za-z0-9_-]{1,40}$/, SLACK_ID_MSG = 'Slack ID — літера U або W і ще 8–10 великих літер чи цифр.';
  var MAX_TO = 10, MAX_RULES = 50, RULES_LIMIT = 'Розсилок уже 50 — видаліть зайві', CAPS = { noAudits: 10, topDefects: 5, auditors: 5, orders: 5 };   // скільки елементів у списках перегляду (як LIST_CAPS у mail-core.mjs)

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function squash(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function numOf(v) { return typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN; }
  function isInt(n, min, max) { return typeof n === 'number' && Math.floor(n) === n && n >= min && n <= max; }
  function hhmm(s) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s || '')) ? String(s) : null; }
  function admin(me) { return me.role === 'admin'; }
  function pctOf(v) { var n = typeof v === 'string' ? (v.trim() === '' ? NaN : Number(v.replace(',', '.'))) : v; return typeof n === 'number' && isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 10) / 10 : null; }
  function pctText(x) { return String(x).replace('.', ',') + '%'; }
  function daysText(days) {
    var k = days.slice().sort().join(',');
    return days.length === 7 ? 'щодня' : k === '1,2,3,4,5' ? 'пн–пт' : k === '1,2,3,4,5,6' ? 'пн–сб' : days.slice().sort().map(function (d) { return DS[d]; }).join(', ');
  }

  function presets(env) {
    var seniors = env.db.users.filter(function (u) { return u.role === 'senior_auditor' && u.active !== false && u.slackId; }).map(function (u) { return { type: 'user', id: u.slackId }; });
    var W = function (o) { return Object.assign({ kind: 'daily', every_min: 60, hour_from: 9, hour_to: 18, days: [1, 2, 3, 4, 5], at_time: '18:00', weekday: 1, event: 'audit', pct: 5 }, o); };
    return [
      { key: 'remind', title: 'Нагадування «запишіть аудит»', enabled: true, locations: 'all', departments: 'all', when: W({ kind: 'every' }), to: [{ type: 'channel', name: 'аудит-нагадування' }],
        condition: { kind: 'always', pct: 5 }, template: '🔔 *Час записати аудит* · {час}\n{локація} · аудитів сьогодні: {аудитів} · без аудитів: {без_аудитів}\n{форма_аудиту}' },
      { key: 'daily', title: 'Денний звіт цеху', enabled: true, locations: 'all', departments: 'all', when: W({ days: [1, 2, 3, 4, 5, 6] }), to: [{ type: 'channel', name: 'якість-цехів' }],
        condition: { kind: 'audits', pct: 5 }, template: '📊 *Денний звіт · {локація} · {день}, {дата}*\n*Перевірено {перевірено} шт · брак {брак_шт} шт ({брак_%})*\n' +
          'Без аудитів сьогодні: {без_аудитів}\nНайбільший % браку: {найбільший_брак}\nНайчастіші види браку: {топ_браку}\nКоригуючі дії: понад норму, не почато — {кд_нових} · йде тиждень після впровадження — {кд_на_перевірці}\n{кабінет_старшого}' },
      { key: 'kd', title: 'Сигнал коригуючих дій', enabled: true, locations: 'all', departments: 'all', when: W({ kind: 'event', event: 'kd' }), to: seniors,
        condition: { kind: 'always', pct: 5 }, template: '🛠 *Новий розбір коригуючих дій · {локація}*\nПонад норму, не почато: {кд_нових} · йде тиждень після впровадження: {кд_на_перевірці}\n{кабінет_старшого}' },
      { key: 'weekly', title: 'Тижневий підсумок керівникам', enabled: false, locations: 'all', departments: 'all', when: W({ kind: 'weekly', at_time: '09:00' }), to: [{ type: 'channel', name: 'керівники' }],
        condition: { kind: 'always', pct: 5 }, template: '📅 *Тижневий підсумок · {локація} · {дата}*\nКоригуючі дії: понад норму, не почато — {кд_нових} · йде тиждень після впровадження — {кд_на_перевірці}\n{кабінет_старшого}' },
      { key: 'over', title: 'Старшим — брак за сьогодні понад критичний рівень', enabled: true, locations: 'all', departments: 'all', when: W({ kind: 'event', event: 'over', pct: env.db.settings.criticalPct || 5 }), to: seniors,   // поріг — критичний рівень з правил адміна
        condition: { kind: 'always', pct: 5 }, template: '⚠️ *Брак за сьогодні понад критичний рівень · {локація}* · {час}\nЗа сьогодні: перевірено {перевірено} шт · брак {брак_шт} шт ({брак_%})\n{кабінет_старшого}' },
      { key: 'audit', title: 'Пост про кожен аудит із браком', enabled: true, locations: 'all', departments: 'all', when: W({ kind: 'event', event: 'audit' }), to: [{ type: 'channel', name: 'якість-цехів' }],
        condition: { kind: 'over', pct: 0 }, template: '📝 *Новий аудит із браком · {локація}* · {час}\nЗа сьогодні: перевірено {перевірено} шт · брак {брак_шт} шт ({брак_%})\n{кабінет_старшого}' }
    ];
  }
  function upgrade(st, env) {
    var changed = false;
    st.items.forEach(function (r) {
      if (!has(r, 'departments')) { r.departments = 'all'; changed = true; }
      var seen = {}, to = [], ruleChanged = false;
      (Array.isArray(r.to) ? r.to : []).forEach(function (t) {
        if (t && t.type === 'user' && !C.isSlackId(t.id)) {
          var u = typeof t.id === 'string' && has(env.ix.user, t.id) ? env.ix.user[t.id] : null;
          ruleChanged = true;
          if (!u || !u.slackId) return;
          t = { type: 'user', id: u.slackId };
        }
        var k = t && t.type === 'user' ? '@' + t.id : null;
        if (k && seen[k]) { ruleChanged = true; return; }
        if (k) seen[k] = 1;
        to.push(t);
      });
      if (ruleChanged) { r.to = to; changed = true; }
    });
    return changed;
  }
  function load(env) {
    var st = env.storage.get(KEY, null);
    if (st && Array.isArray(st.items)) { if (upgrade(st, env)) env.storage.set(KEY, st); return st; }
    var at = env.now().toISOString(), seq = 0;
    st = { items: presets(env).map(function (x) { var r = clone(x); delete r.key; r.id = 'ml_' + pad(++seq); r.createdAt = at; r.updatedAt = at; return r; }) };
    st.seq = seq;
    env.storage.set(KEY, st);
    return st;
  }
  function save(env, st) { env.storage.set(KEY, st); }
  function find(st, id) { return st.items.filter(function (r) { return r.id === id; })[0] || null; }

  var ADDR_GEN = { 'Розкрій': 'Розкрою', 'Пошив': 'Пошиву', 'Оздоблення': 'Оздоблення', 'ВТК': 'ВТК', 'Пакування': 'Пакування' };   // посада «тімлід Пошиву»
  function depsOf(env, locId) {
    return env.db.departments.filter(function (d) { return d.locationId === locId && d.active !== false; }).map(function (d) { return { id: d.id, name: d.name }; });
  }
  function seedAddr(env) {
    var at = env.now().toISOString(), want = ['Пошив', 'Розкрій', 'Пакування'], who = ['Ірина Т.', 'Олег П.', 'Наталя С.'], items = [];
    env.db.locations.slice(0, 3).forEach(function (l, i) {
      var deps = depsOf(env, l.id), d = deps.filter(function (x) { return x.name === want[i]; })[0] || deps[0];
      items.push({ id: 'ad_' + pad(i + 1), name: who[i], jobTitle: 'тімлід ' + (d ? ADDR_GEN[d.name] || d.name : l.name), slackId: 'U-DEMO-96' + (i + 1),
        locationId: l.id, departmentId: d ? d.id : null, active: true, createdAt: at, updatedAt: at });
    });
    return { items: items, seq: items.length };
  }
  function addrLoad(env) {
    var st = env.storage.get(KEY_ADDR, null);
    if (st && Array.isArray(st.items)) {
      st.items.forEach(function (a) {
        var m = !a.jobTitle && /^U-DEMO-96[1-3]$/.test(a.slackId) && /^Тімлід (\S+) · (.+)$/.exec(a.name || '');
        if (m) { a.name = m[2]; a.jobTitle = 'тімлід ' + m[1]; }
      });
      return st;
    }
    st = seedAddr(env);
    env.storage.set(KEY_ADDR, st);
    return st;
  }
  function people(env) {
    var m = {};
    addrLoad(env).items.forEach(function (a) { m[a.slackId] = { name: a.name, kind: 'addr', active: a.active !== false }; });
    env.db.users.forEach(function (u) { if (u.slackId) m[u.slackId] = { name: u.name, kind: 'user', active: true }; });
    return m;
  }

  function channelName(s) { var n = squash(s, 81).replace(/^#+/, '').toLowerCase().replace(/ /g, '-'); return /^[a-zа-яіїєґʼ'0-9_.-]{1,80}$/.test(n) ? n : null; }
  function check(x, env) {
    x = x && typeof x === 'object' ? x : {};
    var e = [], out = {}, w = x.when && typeof x.when === 'object' ? x.when : {}, c = x.condition && typeof x.condition === 'object' ? x.condition : {};
    function err(f, m) { e.push({ field: f, message: m }); }
    out.title = squash(x.title, 81);
    if (!out.title) err('title', 'Напишіть назву розсилки.'); else if (out.title.length > 80) err('title', 'Назва — до 80 знаків.');
    out.enabled = x.enabled === true;
    if (x.locations === 'all') out.locations = 'all';
    else {
      out.locations = (Array.isArray(x.locations) ? x.locations : []).filter(function (id, i, a) { return typeof id === 'string' && has(env.ix.loc, id) && a.indexOf(id) === i; });
      if (!out.locations.length) err('locations', 'Оберіть хоча б одну локацію.');
    }
    if (x.departments == null || x.departments === 'all') out.departments = 'all';
    else {
      var deps = (Array.isArray(x.departments) ? x.departments : []).filter(function (id, i, a) { return a.indexOf(id) === i; });
      out.departments = [];
      if (!deps.length) err('departments', 'Оберіть хоча б один відділ.');
      else if (deps.some(function (id) { return typeof id !== 'string' || !DEP_ID.test(id); })) err('departments', 'Відділ не прочитано — оновіть сторінку.');
      else if (deps.some(function (id) { return !has(env.ix.dep, id) || (out.locations !== 'all' && out.locations.length > 0 && out.locations.indexOf(env.ix.dep[id].locationId) < 0); })) err('departments', 'Відділ не з обраних локацій — оновіть вибір.');
      else out.departments = deps;
    }
    var o = { kind: has(KINDS, w.kind) ? w.kind : null };
    if (!o.kind) err('kind', 'Оберіть, коли надсилати.');
    var em = numOf(w.every_min);
    o.every_min = EVERY.indexOf(em) >= 0 ? em : 60;
    if (o.kind === 'every' && EVERY.indexOf(em) < 0) err('every_min', 'Оберіть інтервал зі списку.');
    var hf = numOf(w.hour_from), ht = numOf(w.hour_to), hoursOk = isInt(hf, 0, 23) && isInt(ht, 0, 23);
    o.hour_from = hoursOk ? hf : 9; o.hour_to = hoursOk ? ht : 18;
    if (o.kind === 'every') {
      if (!hoursOk) err('hours', 'Оберіть години «з» і «до».');
      else if (o.hour_from > o.hour_to) err('hours', 'Година «з» має бути не пізніше за «до».');
    }
    o.days = (Array.isArray(w.days) ? w.days : []).map(numOf).filter(function (d, i, a) { return isInt(d, 0, 6) && a.indexOf(d) === i; }).sort();
    if ((o.kind === 'every' || o.kind === 'daily') && !o.days.length) err('days', 'Оберіть хоча б один день.');
    o.at_time = hhmm(w.at_time) || '18:00';
    if ((o.kind === 'daily' || o.kind === 'weekly') && !hhmm(w.at_time)) err('at_time', 'Час — у форматі 18:00.');
    var wd = numOf(w.weekday);
    o.weekday = isInt(wd, 0, 6) ? wd : 1;
    if (o.kind === 'weekly' && !isInt(wd, 0, 6)) err('weekday', 'Оберіть день тижня.');
    o.event = has(EVENTS, w.event) ? w.event : 'audit';
    if (o.kind === 'event' && !has(EVENTS, w.event)) err('event', 'Оберіть подію.');
    o.pct = pctOf(w.pct);
    if (o.kind === 'event' && o.event === 'over' && o.pct == null) err('event_pct', 'Поріг — число від 0 до 100.');
    if (o.pct == null) o.pct = 5;
    out.when = o;
    var to = [], seen = {}, known = people(env);
    (Array.isArray(x.to) ? x.to : []).forEach(function (t) {
      if (!t || typeof t !== 'object') return;
      if (t.type === 'channel') {
        var n = channelName(t.name);
        if (!n) { err('to', 'Назва каналу — літери, цифри, «-» чи «_», без пробілів: #якість-цеху.'); return; }
        if (!seen['#' + n]) { seen['#' + n] = 1; to.push({ type: 'channel', name: n }); }
      } else if (t.type === 'user') {
        var who = typeof t.id === 'string' && has(known, t.id) ? known[t.id] : null;
        if (!who) { err('to', 'Такої людини немає серед користувачів — оновіть сторінку.'); return; }
        if (!seen['@' + t.id]) { seen['@' + t.id] = 1; to.push({ type: 'user', id: t.id }); }
      }
    });
    if (to.length > MAX_TO) err('to', 'Отримувачів — до 10.');
    else if (!to.length && !e.some(function (z) { return z.field === 'to'; })) err('to', 'Додайте канал або людину.');
    out.to = to;
    out.condition = { kind: has(CONDS, c.kind) ? c.kind : null, pct: pctOf(c.pct) };
    if (!out.condition.kind) err('condition', 'Оберіть умову.');
    if (out.condition.kind === 'over' && out.condition.pct == null) err('cond_pct', 'Поріг — число від 0 до 100.');
    if (out.condition.pct == null) out.condition.pct = 5;
    var tpl = String(x.template == null ? '' : x.template).replace(/\r\n?/g, '\n').trim();
    out.template = tpl;
    if (!tpl) err('template', 'Напишіть текст повідомлення.');
    else if (tpl.length > 1500) err('template', 'Текст — до 1500 знаків.');
    else {
      var bad = []; tpl.replace(PH, function (all, n) { if (!KNOWN[n] && bad.indexOf(all) < 0) bad.push(all); return all; });
      if (bad.length) err('template', 'Такої вставки немає: ' + bad.slice(0, 3).join(' ') + '. Оберіть вставку зі списку під текстом.');
    }
    return e.length ? { errors: e } : { rule: out };
  }

  function checkAddr(x, env, st, curId) {
    x = x && typeof x === 'object' ? x : {};
    var e = [], out = {};
    function err(f, m) { e.push({ field: f, message: m }); }
    out.name = squash(x.name, 61);
    if (out.name.length < 2 || out.name.length > 60) err('name', 'Імʼя — від 2 до 60 знаків.');
    out.jobTitle = squash(x.jobTitle, 41);   // v2.2: посада — необовʼязково
    if (out.jobTitle.length > 40) err('jobTitle', 'Посада — до 40 знаків.');
    out.slackId = squash(x.slackId, 41).toUpperCase();
    if (!C.isSlackId(out.slackId)) err('slackId', SLACK_ID_MSG);
    else if (env.db.users.some(function (u) { return String(u.slackId || '').toUpperCase() === out.slackId; })) err('slackId', 'Ця людина вже є серед користувачів — оберіть її в «Кому» напряму.');
    else if (st.items.some(function (a) { return a.id !== curId && a.slackId === out.slackId; })) err('slackId', 'Цей Slack-ID уже є серед адресатів.');
    var loc = x.locationId, locOk = typeof loc === 'string' && has(env.ix.loc, loc);
    out.locationId = locOk ? loc : null;
    if (!locOk) err('locationId', 'Оберіть локацію.');
    var dep = x.departmentId == null || x.departmentId === '' ? null : x.departmentId;
    out.departmentId = dep;
    if (dep !== null && (typeof dep !== 'string' || !DEP_ID.test(dep) || (locOk && (!has(env.ix.dep, dep) || env.ix.dep[dep].locationId !== loc)))) err('departmentId', 'Відділ не з цієї локації — оновіть вибір.');
    out.active = x.active !== false;
    return e.length ? { errors: e } : { addressee: out };
  }

  function scheduleLabel(r) {
    var w = r && r.when ? r.when : r;
    if (w.kind === 'every') return (w.every_min === 60 ? 'щогодини' : 'кожні ' + (w.every_min < 60 ? w.every_min + ' хв' : w.every_min / 60 + ' год')) + ' · ' + pad(w.hour_from) + ':00–' + pad(w.hour_to) + ':00 · ' + daysText(w.days);
    if (w.kind === 'daily') return (w.days.length === 7 ? 'щодня' : daysText(w.days)) + ' о ' + w.at_time;
    if (w.kind === 'weekly') return 'щотижня в ' + WD_IN[w.weekday] + ' о ' + w.at_time;
    return EVENTS[w.event] + (w.event === 'over' ? ' ' + pctText(w.pct) : '');
  }
  function condLabel(r) {
    var c = r.condition, one = r.when.kind === 'event' && r.when.event === 'audit';
    if (c.kind === 'audits') return 'лише якщо сьогодні були аудити';
    if (c.kind === 'over') return 'лише якщо брак ' + (one ? 'в аудиті' : 'за сьогодні') + ' понад ' + pctText(c.pct);
    return 'завжди';
  }
  function toLabel(env, t, known) {
    if (t.type === 'channel') return { type: 'channel', label: '#' + t.name };
    var u = has(known, t.id) ? known[t.id] : null;
    return { type: 'user', id: t.id, label: (u ? u.name + (u.kind === 'addr' && !u.active ? ' (вимкнено)' : '') : 'Немає в списку') + ' · особисто' };
  }
  function depLabel(env, r) {
    if (!Array.isArray(r.departments)) return 'усі відділи';
    var oneLoc = r.locations !== 'all' && r.locations.length === 1;
    return r.departments.map(function (id) {
      var d = env.ix.dep[id];
      if (!d) return id;
      return oneLoc || !env.ix.loc[d.locationId] ? d.name : d.name + ' (' + env.ix.loc[d.locationId].name + ')';
    }).join(', ');
  }
  function view(env, r) {
    var locs = r.locations === 'all' ? null : r.locations.map(function (id) { return env.ix.loc[id] ? env.ix.loc[id].name : id; }), known = people(env);
    return Object.assign(clone(r), { whenLabel: scheduleLabel(r), condLabel: condLabel(r), locLabel: locs ? locs.join(', ') : 'усі локації', depLabel: depLabel(env, r),
      toLabels: r.to.map(function (t) { return toLabel(env, t, known); }) });
  }

  function vars(env, me, loc, depIds) {
    var today = env.day(), list = S.audits(env, loc.id, today, today);
    var deps = env.db.departments.filter(function (d) { return d.locationId === loc.id && d.active !== false && (!depIds || depIds.indexOf(d.id) >= 0); });
    if (depIds) { var inSet = {}; deps.forEach(function (d) { inSet[d.id] = 1; }); list = list.filter(function (a) { return has(inSet, a.departmentId); }); }
    var checked = 0, rejected = 0, types = {}, worst = null, none = [];
    deps.forEach(function (d) {
      var st = S.deptStats(env, list, d.id);
      checked += st.checked; rejected += st.rejected;
      Object.keys(st.byType).forEach(function (id) { types[id] = (types[id] || 0) + st.byType[id]; });
      if (!list.some(function (a) { return a.departmentId === d.id; })) none.push(d.name);
      var pc = C.pct(st.rejected, st.checked);
      if (pc != null && (!worst || pc > worst.pct)) worst = { name: d.name, pct: pc };
    });
    var top = Object.keys(types).sort(function (a, b) { return types[b] - types[a]; }).slice(0, CAPS.topDefects)
      .map(function (id) { return (env.ix.def[id] ? env.ix.def[id].name : 'Невідомий вид браку') + ' ' + P.fmt.num(types[id]); });
    var kd = null;
    P.demoApis.forEach(function (api) {
      if (kd || !has(api, 'srKdOverview')) return;
      try { var r = api.srKdOverview({ locationId: loc.id }, me, env); if (r && r.ok && r.totals) kd = r.totals; } catch (e) { kd = null; }
    });
    var p = today.split('-'), dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])), pc = C.pct(rejected, checked);
    return { 'локація': loc.name, 'перевірено': P.fmt.num(checked), 'брак_шт': P.fmt.num(rejected), 'брак_%': pc == null ? '—' : P.fmt.pct(pc),
      'аудитів': P.fmt.num(list.length), 'без_аудитів': none.slice(0, CAPS.noAudits).join(', ') || 'немає', 'найбільший_брак': worst ? worst.name + ' — ' + P.fmt.pct(worst.pct) : '—',
      'топ_браку': top.join(' · ') || 'немає', 'кд_нових': kd ? String(kd.new || 0) : '—', 'кд_на_перевірці': kd ? String(kd.review != null ? kd.review : kd.check || 0) : '—',
      'день': WD[dt.getUTCDay()], 'дата': +p[2] + ' ' + MONTHS[+p[1] - 1], 'час': P.fmt.time(env.now().toISOString()) };
  }
  function render(tpl, v) { return String(tpl || '').replace(PH, function (all, n) { return has(v, n) ? v[n] : all; }); }

  function idOf(p) { return typeof p.id === 'string' ? p.id : ''; }
  P.mailRules = { scheduleLabel: scheduleLabel, condLabel: condLabel };
  P.demoApis.push({
    mlRules: function (p, me, env) {
      if (!admin(me)) return C.forbidden();
      var st = load(env);
      return { ok: true, now: env.now().toISOString(), items: st.items.map(function (r) { return view(env, r); }),
        locations: env.db.locations.map(function (l) { return { id: l.id, name: l.name, departments: depsOf(env, l.id) }; }),
        users: env.db.users.filter(function (u) { return u.slackId; }).map(function (u) { return { id: u.slackId, name: u.name, roleLabel: P.demoDict.roleLabels[u.role] || u.role,
          locations: u.locationIds.map(function (id) { return env.ix.loc[id] ? env.ix.loc[id].name : id; }) }; }),
        addressees: addrLoad(env).items.map(function (a) { return { id: a.slackId, name: a.name, jobTitle: a.jobTitle || '', locationId: a.locationId, departmentId: a.departmentId || null, active: a.active !== false }; }),
        presets: presets(env).map(function (x) { return { key: x.key, title: x.title, whenLabel: scheduleLabel(x), rule: x }; }),
        options: { every: EVERY, groups: GROUPS, links: LINKS } };
    },
    mlRuleSave: function (p, me, env) {
      if (!admin(me)) return C.forbidden();
      var st = load(env), cur = p.id ? find(st, idOf(p)) : null;
      if (p.id && !cur) return C.fail('not_found', 'Такої розсилки вже немає — оновіть сторінку.');
      var v = check(p.rule, env);
      if (v.errors) return C.fail('validation', v.errors[0].message, v.errors);
      if (!cur && st.items.length >= MAX_RULES) return C.fail('validation', RULES_LIMIT, [{ field: 'limit', message: RULES_LIMIT }]);
      var at = env.now().toISOString(), r = Object.assign(v.rule, { id: cur ? cur.id : 'ml_' + pad(++st.seq), createdAt: cur ? cur.createdAt : at, updatedAt: at });
      if (cur) st.items[st.items.indexOf(cur)] = r; else st.items.push(r);
      save(env, st);
      return { ok: true, id: r.id, created: !cur, item: view(env, r) };
    },
    mlRuleOn: function (p, me, env) {
      if (!admin(me)) return C.forbidden();
      var st = load(env), r = find(st, idOf(p));
      if (!r) return C.fail('not_found', 'Такої розсилки вже немає — оновіть сторінку.');
      r.enabled = !!p.enabled; r.updatedAt = env.now().toISOString();
      save(env, st);
      return { ok: true, id: r.id, enabled: r.enabled, title: r.title };
    },
    mlRuleCopy: function (p, me, env) {
      if (!admin(me)) return C.forbidden();
      var st = load(env), r = find(st, idOf(p));
      if (!r) return C.fail('not_found', 'Такої розсилки вже немає — оновіть сторінку.');
      if (st.items.length >= MAX_RULES) return C.fail('validation', RULES_LIMIT);
      var at = env.now().toISOString(), c = Object.assign(clone(r), { id: 'ml_' + pad(++st.seq), title: (r.title.slice(0, 71) + ' (копія)'), enabled: false, createdAt: at, updatedAt: at });
      st.items.splice(st.items.indexOf(r) + 1, 0, c);
      save(env, st);
      return { ok: true, id: c.id, item: view(env, c) };
    },
    mlRuleDelete: function (p, me, env) {
      if (!admin(me)) return C.forbidden();
      var st = load(env), r = find(st, idOf(p));
      if (!r) return C.fail('not_found', 'Такої розсилки вже немає — оновіть сторінку.');
      st.items.splice(st.items.indexOf(r), 1);
      save(env, st);
      return { ok: true, id: r.id, title: r.title };
    },
    mlRulePreview: function (p, me, env) {
      if (!admin(me)) return C.forbidden();
      if (typeof p.locationId !== 'string' || !has(env.ix.loc, p.locationId)) return C.fail('not_found', 'Такої локації немає.');
      var ids = Array.isArray(p.departments) ? p.departments.filter(function (id) { return typeof id === 'string'; }) : [];
      var loc = env.ix.loc[p.locationId], v = vars(env, me, loc, ids.length ? ids : null), tpl = String(p.template == null ? '' : p.template).slice(0, 1500);
      return { ok: true, at: env.now().toISOString(), location: { id: loc.id, name: loc.name }, vars: v, text: render(tpl, v), onlyDepartments: ids.length > 0 };
    },

    mlAddrList: function (p, me, env) {
      if (!admin(me)) return C.forbidden();
      return { ok: true, items: addrLoad(env).items.map(function (a) { return Object.assign({ jobTitle: '' }, clone(a)); }),
        locations: env.db.locations.map(function (l) { return { id: l.id, name: l.name, departments: depsOf(env, l.id) }; }) };
    },
    mlAddrSave: function (p, me, env) {
      if (!admin(me)) return C.forbidden();
      var st = addrLoad(env), cur = p.id ? st.items.filter(function (a) { return a.id === idOf(p); })[0] || null : null;
      if (p.id && !cur) return C.fail('not_found', 'Такого адресата вже немає — оновіть сторінку.');
      var v = checkAddr(p, env, st, cur ? cur.id : null);
      if (v.errors) return C.fail('validation', v.errors[0].message, v.errors);
      var at = env.now().toISOString(), a = Object.assign(v.addressee, { id: cur ? cur.id : 'ad_' + pad(++st.seq), createdAt: cur ? cur.createdAt : at, updatedAt: at });
      if (cur) st.items[st.items.indexOf(cur)] = a; else st.items.push(a);
      env.storage.set(KEY_ADDR, st);
      return { ok: true, id: a.id, created: !cur, item: clone(a) };
    },
    mlAddrDelete: function (p, me, env) {
      if (!admin(me)) return C.forbidden();
      var st = addrLoad(env), a = st.items.filter(function (x) { return x.id === idOf(p); })[0];
      if (!a) return C.fail('not_found', 'Такого адресата вже немає — оновіть сторінку.');
      st.items.splice(st.items.indexOf(a), 1);
      env.storage.set(KEY_ADDR, st);
      return { ok: true, id: a.id, name: a.name };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
