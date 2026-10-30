(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon;
  P.demoApis = P.demoApis || []; P.demoSysApi = P.demoSysApi || {};

  var LIMIT = 500;                         // скільки битих записів віддаємо (загальна кількість — завжди повна)
  var KEY_LAST = 'demo:adm:broken:log';    // «минулого разу знайшли N» (…:log — у журнал змін не пишеться, див. journal.mjs SKIP_KEY_RE)
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  var RULES = [
    'Локація, відділ, виріб і вид браку є в довідниках',
    'Відділ належить локації, а виріб і вид браку підходять до відділу',
    'Кількість — ціле число від 1; відбраковано не більше, ніж перевірено; браку не більше, ніж перевірено',
    'Винні й перевірені працівники є в довіднику локації',
    'У записі є дата, і вона не з майбутнього',
    'Номер аудиту не повторюється',
    'У довідниках: відділ має локацію, виріб — відділ, вид браку — тип відділу'
  ];

  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function nm(map, id, fb) { return typeof id === 'string' && has(map, id) ? map[id].name : fb; }
  function q(s) { return '«' + s + '»'; }
  function isAdmin(me) { return !!(P.demoAdmin && P.demoAdmin.isAdmin(me)); }
  function low(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

  function isKnownLegacy(env, a) {
    var id = a.auditorId;
    if (id == null || id === '' || (typeof id === 'string' && id.indexOf('old_') === 0)) return true;
    var u = has(env.ix.user, id) ? env.ix.user[id] : null;
    if (u && u.legacy) return true;
    return typeof a.auditorSlackId === 'string' && a.auditorSlackId !== '' && !a.updatedAt;
  }

  function pick(a, path) {
    var cur = a, re = /([A-Za-z]+)|\[(\d+)\]/g, m;
    while ((m = re.exec(path)) && cur != null) cur = m[1] ? cur[m[1]] : cur[+m[2]];
    return cur;
  }
  function label(env, a, field) {
    var m = /^items\[(\d+)\]/.exec(field);
    if (m && a.items[+m[1]]) return 'Виріб ' + q(nm(env.ix.prod, a.items[+m[1]].productId, String(a.items[+m[1]].productId))) + ': ';
    m = /^defects\[(\d+)\]/.exec(field);
    if (m && a.defects[+m[1]]) return 'Брак ' + q(nm(env.ix.def, a.defects[+m[1]].defectTypeId, String(a.defects[+m[1]].defectTypeId))) + ': ';
    return '';
  }
  var COVERED = ['Оберіть локацію і відділ.', 'Оберіть виріб зі списку для цього відділу.',
    'Оберіть вид браку зі списку. Немає потрібного — попросіть старшого аудитора додати його на сайті.', 'Оберіть відділ, звідки брак.'];

  function textOf(env, a, e) {
    var f = String(e.field), msg = String(e.message);
    if (COVERED.indexOf(msg) >= 0 || f.indexOf('.photos') >= 0) return null;
    var lb = label(env, a, f), v = pick(a, f);
    if (msg.indexOf('Кількість — ціле число') === 0) return lb + 'кількість записана як «' + (v == null || v === '' ? 'порожньо' : v) + '», а має бути ціле число від 1 до 100 000.';
    if (msg.indexOf('Відбраковано — ціле число') === 0) return lb + 'відбраковано записано як «' + (v == null || v === '' ? 'порожньо' : v) + '», а має бути ціле число від 0.';
    if (msg.indexOf('Вкажіть хоча б один перевірений виріб') === 0) return 'У записі немає жодного виробу з кількістю більше нуля.';
    if (f === 'checkedWorkers') return msg.replace(/ Додайте його у списку вибору\.$/, '').replace('цієї локації', 'локації запису');
    return lb + (lb ? low(msg) : msg);
  }

  function utcAfter(createdAt, today) {
    var u = createdAt.slice(0, 10);
    if (u !== today) return u > today;
    if (createdAt.slice(11, 13) < '21') return false;   // Київ випереджає UTC щонайбільше на 3 год: до 21:00 UTC день той самий
    return P.fmt.dayKey(createdAt) > today;
  }

  function dateProblem(env, a, today) {
    var t = typeof a.createdAt === 'string' ? Date.parse(a.createdAt) : NaN, day = a.day;
    if (typeof day !== 'string' || !DAY_RE.test(day) || !isFinite(t)) return 'У записі немає дати або вона записана криво (день «' + (day == null ? '—' : day) + '», час «' + (a.createdAt == null ? '—' : a.createdAt) + '»).';
    if (day > today || utcAfter(a.createdAt, today)) return 'Дата запису з майбутнього: ' + day + '.';
    return null;
  }

  function dictProblems(env, a) {
    var ix = env.ix, out = [], loc = typeof a.locationId === 'string' && has(ix.loc, a.locationId) ? ix.loc[a.locationId] : null;
    var dep = typeof a.departmentId === 'string' && has(ix.dep, a.departmentId) ? ix.dep[a.departmentId] : null;
    if (!loc) out.push('Локації ' + q(a.locationId || '—') + ' немає в довідниках.');
    if (!dep) out.push('Відділу ' + q(a.departmentId || '—') + ' немає в довідниках.');
    else if (loc && dep.locationId !== loc.id) out.push('Відділ ' + q(dep.name) + ' не з локації ' + q(loc.name) + ' — він належить іншій локації.');
    arr(a.items).forEach(function (it) {
      var pid = it && it.productId, prod = typeof pid === 'string' && has(ix.prod, pid) ? ix.prod[pid] : null;
      if (!prod) out.push('Виробу ' + q(pid || '—') + ' немає в довіднику.');
      else if (dep && prod.deptTypeId !== dep.deptTypeId) out.push('Виріб ' + q(prod.name) + ' не підходить до відділу ' + q(dep.name) + ' (він для іншого типу відділу).');
    });
    arr(a.defects).forEach(function (d) {
      var tid = d && d.defectTypeId, def = typeof tid === 'string' && has(ix.def, tid) ? ix.def[tid] : null;
      var srcId = d && d.departmentId ? d.departmentId : a.departmentId, src = typeof srcId === 'string' && has(ix.dep, srcId) ? ix.dep[srcId] : null;
      if (srcId !== a.departmentId && (!src || (loc && src.locationId !== loc.id))) out.push('Відділ, звідки брак (' + q(srcId || '—') + '), не з цієї локації.');
      if (!def) out.push('Виду браку ' + q(tid || '—') + ' немає в довіднику.');
      else if (src && def.deptTypeId !== src.deptTypeId) out.push('Вид браку ' + q(def.name) + ' не підходить до відділу ' + q(src.name) + ' (він для іншого типу відділу).');
      arr(d && d.guilty).forEach(function (g) {
        var code = g ? g.workerCode : null;
        if (loc && code && !has(ix.worker, loc.id + ':' + code)) out.push('Винного працівника ' + q(code) + ' немає в довіднику локації ' + q(loc.name) + '.');
      });
    });
    return out;
  }

  function auditProblems(env, a, dupCount, idx, today) {
    var out = [];
    function add(t) { if (t && out.indexOf(t) < 0) out.push(t); }
    if (typeof a.id !== 'string' || !a.id) add('У запису немає номера.');
    if (dupCount > 1) add('Номер повторюється: у базі ще ' + (dupCount - 1) + ' ' + P.plural(dupCount - 1, 'запис', 'записи', 'записів') + ' з таким самим номером.');
    var dp = dictProblems(env, a);
    dp.forEach(add);
    var loc = typeof a.locationId === 'string' && has(env.ix.loc, a.locationId), dep = typeof a.departmentId === 'string' && has(env.ix.dep, a.departmentId);
    if (loc && dep && env.ix.dep[a.departmentId].locationId === a.locationId) {
      var items = arr(a.items).map(function (it) {
        return Object.assign({}, it, { rejected: it && it.rejectedGiven === false ? null : (it ? it.rejected : null) });
      });
      var defects = arr(a.defects).map(function (d) { return Object.assign({}, d, { photos: [], photo: null }); });   // фото — не про «биті» дані
      var payload = { locationId: a.locationId, departmentId: a.departmentId, orders: arr(a.orders), items: items, defects: defects,
        checkedWorkers: arr(a.checkedWorkers), comment: a.comment, noDefects: !!a.noDefects };
      P.demoValidateAudit(payload, { db: env.db, idx: idx }).forEach(function (e) { add(textOf(env, a, e)); });
    }
    add(dateProblem(env, a, today));
    return out;
  }

  function dictItems(env) {
    var db = env.db, ix = env.ix, out = [], typeUsed = {};
    db.departments.forEach(function (d) { typeUsed[d.deptTypeId] = true; });
    db.departments.forEach(function (d) {
      if (d.active === false || (typeof d.locationId === 'string' && has(ix.loc, d.locationId))) return;
      out.push({ kind: 'dict', id: d.id, title: 'Відділ ' + q(d.name), problems: ['Відділ без локації: локації ' + q(d.locationId || '—') + ' немає в довідниках.'] });
    });
    db.products.forEach(function (x) {
      if (x.active === false || typeUsed[x.deptTypeId]) return;
      out.push({ kind: 'dict', id: x.id, title: 'Виріб ' + q(x.name), problems: ['Виріб не належить жодному відділу: відділів цього типу немає.'] });
    });
    db.defectTypes.forEach(function (x) {
      if (x.active === false || (typeof x.deptTypeId === 'string' && has(ix.dt, x.deptTypeId))) return;
      out.push({ kind: 'dict', id: x.id, title: 'Вид браку ' + q(x.name), problems: ['Вид браку без типу відділу: типу ' + q(x.deptTypeId || '—') + ' немає в довідниках.'] });
    });
    return out;
  }

  function scan(env) {
    var all = env.db.audits, ids = {}, items = [], checked = 0, skipped = 0;
    var idx = P.demoValidateIndex(env.db), today = env.day();   // покажчики довідників — раз на всю перевірку
    all.forEach(function (a) { ids[a.id] = (ids[a.id] || 0) + 1; });
    all.slice().sort(C.newestFirst).forEach(function (a) {
      if (isKnownLegacy(env, a)) { skipped++; return; }
      checked++;
      var pr = auditProblems(env, a, ids[a.id], idx, today);
      if (!pr.length) return;
      var dep = nm(env.ix.dep, a.departmentId, null), loc = nm(env.ix.loc, a.locationId, null);
      items.push({ kind: 'audit', id: String(a.id == null ? '' : a.id), title: (dep || 'відділ невідомий') + ' · ' + (loc || 'локація невідома'), problems: pr,
        locationId: typeof a.locationId === 'string' ? a.locationId : null, locationName: loc, day: typeof a.day === 'string' ? a.day : null });
    });
    dictItems(env).forEach(function (d) { items.push(d); });
    return { ok: true, checkedAt: env.now().toISOString(), total: items.length, items: items.slice(0, LIMIT), truncated: items.length > LIMIT, limit: LIMIT,
      checked: checked, skipped: skipped, rules: RULES.slice() };
  }
  P.demoBroken = { scan: scan, RULES: RULES, LIMIT: LIMIT, KEY_LAST: KEY_LAST };

  P.demoApis.push({
    admBroken: function (p, me, env) {
      if (!isAdmin(me)) return C.forbidden();
      return scan(env);
    }
  });

  P.demoSysApi.brokenScan = function (p, env) {
    var r = scan(env), last = env.storage.get(KEY_LAST, null);
    var previous = last && typeof last.total === 'number' && isFinite(last.total) ? last.total : 0;   // перший раз — рахуємо від нуля
    env.storage.set(KEY_LAST, { total: r.total, at: r.checkedAt });
    return { ok: true, total: r.total, previous: previous, grew: r.total > previous, checkedAt: r.checkedAt };
  };
})(typeof window !== 'undefined' ? window : globalThis);
