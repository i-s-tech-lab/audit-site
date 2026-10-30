(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon;
  P.demoApis = P.demoApis || []; P.demoResetKeys = P.demoResetKeys || [];

  var KEY = 'demo:adm:backups';   // { policy, meta, manual: [ISO], verified: { id: ISO } }
  P.demoResetKeys.push(KEY);
  var MB = 1048576, GB = 1073741824, H = 3600000, D = 86400000;
  var DEF = { daily: 7, weekly: 4, monthly: 6, maxBytes: 2 * GB };
  var LIM = { daily: [1, 31], weekly: [0, 12], monthly: [0, 24], maxBytes: [100 * MB, 50 * GB] };
  var FIELDS = ['daily', 'weekly', 'monthly', 'maxBytes'];
  var DEF_AT = '20:00', AT_RE = /^([01]\d|2[0-3]):[0-5]\d$/, SLACK_TO_RE = /^[CGUW][A-Z0-9-]{6,20}$/;   // дефіс — для демо-ID на кшталт C-DEMO-01
  var MSG_AT = 'Час щоденної копії — у форматі ГГ:ХХ за Києвом, наприклад 20:00.';
  var MSG_TO = 'Куди — Slack-ID каналу (починається з C чи G) або людини (U чи W), наприклад C-DEMO-01.';
  var MSG_TO_NEED = 'Вкажіть, куди надсилати копію: Slack-ID каналу чи людини.';
  var LABEL = { daily: 'Щоденних копій', weekly: 'Щотижневих копій', monthly: 'Щомісячних копій', maxBytes: 'Місце для всіх копій',
    at: 'Час щоденної копії', slackOn: 'Копія в Slack', slackTo: 'Куди надсилати копію' };
  var MSG = { daily: 'Щоденних — ціле число від 1 до 31.', weekly: 'Щотижневих — ціле число від 0 до 12.',
    monthly: 'Щомісячних — ціле число від 0 до 24.', maxBytes: 'Місце для всіх копій — від 100 МБ (0,1 ГБ) до 50 ГБ.' };
  var SCHEMA = '0009_people_v3', HISTORY_DAYS = 183, DISK_GB = 476, DISK_USED_GB = 138;
  var STALE_H = 30;   // копія старша за стільки годин — head.state = 'stale' (як позначка в «Огляді»)
  var EXCLUDED = ['mail_private', 'sessions', 'login_tokens', 'auth_fail', 'mail_auth_fail'];
  var FILE = 'D:\\AuditBackups\\audit-РРРРММДДTГГХХССZ.dump';
  var RESTORE = [
    '# 1. Перевірити копію пробним відновленням (робоча база не змінюється)',
    'npm run db:restore-test -- ' + FILE,
    '# 2. Зупинити сервер Аудиту (база лишається увімкненою)',
    'Stop-Service audit-server',
    '# 3. Відновити копію поверх робочої бази audit (усе, що записано після копії, зникне)',
    '& C:\\AuditServer\\pgsql\\bin\\pg_restore.exe --clean --if-exists --no-owner --role=audit_app --single-transaction -h 127.0.0.1 -p 5432 -U postgres -d audit ' + FILE,
    '# 4. Запустити сервер знову',
    'Start-Service audit-server'
  ].join('\n');
  var RESTORE_NOTE = 'Лише через SSH, від адміністратора. pg_restore спитає пароль адміністратора бази (postgres). Після відновлення всім треба увійти знову: сесії в копію не потрапляють.';

  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function A() { return P.demoAdmin; }
  function hex(s, n) {
    var out = '', h = 2166136261;
    for (var round = 0; out.length < n; round++) {
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i) + round; h = Math.imul(h, 16777619) >>> 0; }
      out += ('0000000' + h.toString(16)).slice(-8);
    }
    return out.slice(0, n);
  }
  function fmtBytes(n) { return n < GB ? (n / MB).toFixed(1).replace('.', ',') + ' МБ' : (n / GB).toFixed(2).replace('.', ',') + ' ГБ'; }
  function addDays(day, n) { return new Date(Date.parse(day + 'T12:00:00Z') + n * D).toISOString().slice(0, 10); }
  function at03(day) { var a = day + 'T00:00:00.000Z'; return P.fmt.time(a) === '03:00' ? a : day + 'T01:00:00.000Z'; }
  function stamp(iso) { return 'audit-' + iso.slice(0, 19).replace(/[-:]/g, '') + 'Z'; }
  function isoWeek(iso) {
    var d = new Date(iso), t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    t.setUTCDate(t.getUTCDate() + 3 - ((t.getUTCDay() + 6) % 7));
    var y = t.getUTCFullYear();
    return y + '-W' + (Math.floor((t.getTime() - Date.UTC(y, 0, 1)) / (7 * D)) + 1);
  }
  function isInt(n, lim) { return typeof n === 'number' && Math.floor(n) === n && n >= lim[0] && n <= lim[1]; }
  function okPolicy(p) {
    p = obj(p);
    return FIELDS.every(function (k) { return isInt(p[k], LIM[k]); }) && (p.at === undefined || (typeof p.at === 'string' && AT_RE.test(p.at))) &&
      (p.slackOn === undefined || typeof p.slackOn === 'boolean') && (p.slackTo === undefined || p.slackTo === '' || (typeof p.slackTo === 'string' && SLACK_TO_RE.test(p.slackTo)));
  }

  function store(env) {
    var s = obj(env.storage.get(KEY, null));
    return { policy: okPolicy(s.policy) ? s.policy : null, meta: s.meta && typeof s.meta === 'object' ? s.meta : null,
      manual: Array.isArray(s.manual) ? s.manual.filter(function (x) { return typeof x === 'string'; }) : [], verified: obj(s.verified) };
  }
  function policyOf(st) {
    var p = st.policy || DEF;
    return { daily: p.daily, weekly: p.weekly, monthly: p.monthly, maxBytes: p.maxBytes, at: p.at || DEF_AT, slackOn: p.slackOn === true, slackTo: p.slackTo || '' };
  }
  function atKyiv(day, at) {
    var m = Date.parse(day + 'T00:00:00Z'), mins = Number(at.slice(0, 2)) * 60 + Number(at.slice(3, 5));
    for (var off = 3; off >= 2; off--) {
      var iso = new Date(m + (mins - off * 60) * 60000).toISOString();
      if (P.fmt.time(iso) === at) return iso;
    }
    return new Date(m + (mins - 120) * 60000).toISOString();
  }

  function auditStats(env) {
    var list = env.audits().slice().sort(function (a, b) { return a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0; });
    var at = [], items = [0], defects = [0];
    list.forEach(function (a, i) { at.push(a.createdAt); items.push(items[i] + (a.items || []).length); defects.push(defects[i] + (a.defects || []).length); });
    return { at: at, items: items, defects: defects };
  }
  function upTo(st, iso) { var lo = 0, hi = st.at.length; while (lo < hi) { var m = (lo + hi) >> 1; if (st.at[m] <= iso) lo = m + 1; else hi = m; } return lo; }
  function tablesAt(env, st, iso) {
    var n = upTo(st, iso), dd = Math.max(0, Math.round((Date.parse(iso) - Date.parse(addDays(env.today, -HISTORY_DAYS) + 'T00:00:00Z')) / D)), db = env.db;
    return [['audits', n], ['audit_items', st.items[n]], ['audit_defects', st.defects[n]], ['locations', db.locations.length],
      ['departments', db.departments.length], ['workers', db.workers.length], ['products', db.products.length], ['defect_types', db.defectTypes.length],
      ['app_users', db.users.length], ['user_locations', db.users.reduce(function (s, u) { return s + (u.locationIds || []).length; }, 0)],
      ['access_requests', 3], ['auth_log', 40 + dd * 6], ['mail_rules', 6], ['mail_outbox', 25 + dd * 9], ['schema_migrations', 9]]
      .map(function (t) { return { name: t[0], rows: t[1] }; });
  }

  function allDumps(env, st) {
    var now = env.now().toISOString(), out = [];
    for (var i = 0; i < HISTORY_DAYS; i++) {
      var day = addDays(env.today, -i), at = at03(day);
      if (at > now) continue;
      var ver = day.slice(8) === '01' ? new Date(Date.parse(at) + 70 * 60000).toISOString() : null;
      out.push({ id: stamp(at), at: at, manual: false, autoVerified: ver && ver <= now ? ver : null });
    }
    st.manual.forEach(function (at) { if (at <= now) out.push({ id: stamp(at), at: at, manual: true, autoVerified: null }); });
    return out.sort(function (a, b) { return a.at < b.at ? 1 : a.at > b.at ? -1 : 0; });
  }
  function gfs(list, pol, sizeOf, verOf) {
    var why = {};
    function mark(x, tag) { (why[x.id] = why[x.id] || []).push(tag); }
    function pick(keyOf, n, tag) {
      var seen = {}, cnt = 0;
      for (var i = 0; i < list.length; i++) {
        var k = keyOf(list[i].at);
        if (seen[k]) continue;
        if (cnt >= n) break;
        seen[k] = 1; cnt++; mark(list[i], tag);
      }
    }
    pick(function (a) { return a.slice(0, 10); }, pol.daily, 'daily');
    pick(isoWeek, pol.weekly, 'weekly');
    pick(function (a) { return a.slice(0, 7); }, pol.monthly, 'monthly');
    var nv = list.filter(verOf)[0], guard = {};
    if (list[0]) { mark(list[0], 'newest'); guard[list[0].id] = 1; }
    if (nv) { mark(nv, 'verified'); guard[nv.id] = 1; }
    var kept = list.filter(function (x) { return why[x.id]; }), total = kept.reduce(function (s, x) { return s + sizeOf(x); }, 0);
    for (var i = kept.length - 1; i >= 0 && total > pol.maxBytes; i--) {
      if (guard[kept[i].id]) continue;
      total -= sizeOf(kept[i]); delete why[kept[i].id];
    }
    return why;
  }
  function build(env, st, pol) {
    var stats = auditStats(env), list = allDumps(env, st), info = {};
    function facts(x) {
      if (!info[x.id]) {
        var t = tablesAt(env, stats, x.at), rows = t.reduce(function (s, r) { return s + r.rows; }, 0);
        info[x.id] = { tables: t, rows: rows, bytes: 3 * MB + rows * 2250 + parseInt(hex(x.id, 5), 16) % (256 * 1024) };
      }
      return info[x.id];
    }
    function verOf(x) { return st.verified[x.id] || x.autoVerified || null; }
    var why = gfs(list, pol, function (x) { return facts(x).bytes; }, verOf);
    return list.filter(function (x) { return why[x.id]; }).map(function (x) {
      var w = why[x.id], f = facts(x);
      return { id: x.id, at: x.at, kind: x.manual ? 'manual' : ['daily', 'weekly', 'monthly'].filter(function (k) { return w.indexOf(k) >= 0; })[0] || 'monthly',
        bytes: f.bytes, sha256: hex(x.id + ':sha', 12), ok: true, verifiedAt: verOf(x), tables: f.tables.length, rows: f.rows, schema: SCHEMA,
        protected: w.indexOf('newest') >= 0 ? 'newest' : w.indexOf('verified') >= 0 ? 'verified' : null, _tables: f.tables };
    });
  }
  function prune(st, items) {
    var ids = {};
    items.forEach(function (x) { ids[x.id] = 1; });
    st.manual = st.manual.filter(function (at) { return ids[stamp(at)]; });
    Object.keys(st.verified).forEach(function (id) { if (!ids[id]) delete st.verified[id]; });
  }
  function save(env, st) { env.storage.set(KEY, { policy: st.policy, meta: st.meta, manual: st.manual, verified: st.verified }); }
  function pub(x) { var o = {}; Object.keys(x).forEach(function (k) { if (k.charAt(0) !== '_') o[k] = x[k]; }); return o; }
  function totalOf(items) { return items.reduce(function (s, x) { return s + x.bytes; }, 0); }
  function diskFreePct(bytes) { return Math.round((DISK_GB - DISK_USED_GB - bytes / GB) / DISK_GB * 100); }
  function findItem(items, id) { return typeof id === 'string' ? items.filter(function (x) { return x.id === id; })[0] || null : null; }
  function headOf(items, nowIso) {
    var x = items[0];
    if (!x) return { state: 'none', at: null, bytes: null, ageH: null, error: null };
    var ageH = Math.round((Date.parse(nowIso) - Date.parse(x.at)) / H * 10) / 10;
    return { state: ageH > STALE_H ? 'stale' : 'ok', at: x.at, bytes: x.bytes, ageH: ageH, error: null };
  }
  function serverUnknown(env) {
    return { ok: true, real: true, asOf: env.now().toISOString(), services: [],
      health: { ok: null, version: null, release: null, uptimeSec: null, db: null, schema: null, mailTick: null },
      network: { domain: null, frontProxy: null, firewall: null, ports: [], cert: { issuer: null, validTo: null, daysLeft: null, rootValidTo: null } },
      resources: { diskFreePct: null, diskFreeGb: null, memUsedPct: null, cpuPct: null }, windows: { lastBoot: null, updatesPending: null },
      releases: [], errors24h: null, commands: [] };
  }

  function serverState(env, backupBytes) {
    var now = Math.floor(env.now().getTime() / 1000) * 1000, iso = function (t) { return new Date(t).toISOString(); };
    var boot = now - (3 * D + 5 * H + 17 * 60000), rel = [now - 26 * H - 10 * 60000, now - 5 * D - 3 * H];
    var relName = function (t) { return 'r-' + iso(t).slice(0, 19).replace(/[-:]/g, '') + '-' + hex('rel' + t, 7); };
    var srvSince = rel[0] + 20000, certTo = Date.parse(addDays(env.today, 52) + 'T09:41:00Z');
    var svc = function (id, label, since) { return { id: id, label: label, state: 'RUNNING', since: iso(since), account: 'NT SERVICE\\' + id }; };
    var free = diskFreePct(backupBytes);
    return {
      services: [svc('audit-postgres', 'База даних (Postgres)', boot + 40000), svc('audit-server', 'Сервер Аудиту (Node.js)', srvSince), svc('audit-caddy', 'Caddy (HTTPS)', boot + 55000)],
      health: { ok: true, version: '1.2', release: relName(rel[0]), uptimeSec: Math.round((now - srvSince) / 1000), db: 'ok', schema: { applied: 9, last: SCHEMA },
        mailTick: { at: iso(now - 35000), ok: true } },
      network: { domain: 'audit.example.test', frontProxy: '192.0.2.50', firewall: 'TCP 443 лише з 192.0.2.50',
        ports: [{ port: 443, who: 'Caddy (HTTPS)', from: 'лише головний Caddy 192.0.2.50' }, { port: 8080, who: 'Сервер Аудиту', from: 'лише цей ноутбук (127.0.0.1)' },
          { port: 5432, who: 'База даних', from: 'лише цей ноутбук (127.0.0.1)' }],
        cert: { issuer: 'внутрішній центр Caddy', validTo: iso(certTo), daysLeft: Math.floor((certTo - now) / D), rootValidTo: '2036-10-21T09:00:00.000Z' } },
      resources: { diskFreePct: free, diskFreeGb: Math.round(DISK_GB * free / 100), memUsedPct: 41, cpuPct: 6 },
      windows: { lastBoot: iso(boot), updatesPending: 1 },
      releases: [{ name: relName(rel[0]), at: iso(rel[0]), current: true }, { name: relName(rel[1]), at: iso(rel[1]), current: false }],
      errors24h: 2,
      commands: [
        { label: 'Змінити домен або головний Caddy', text: 'npm run server:prepare -- --domain <домен> --front-proxy <IP>' },
        { label: 'Перезапустити служби', text: 'Restart-Service audit-server -Force; Start-Service audit-caddy' },
        { label: 'Випустити нову версію', text: 'npm run server:deploy' },
        { label: 'Відновити з копії', text: RESTORE }
      ]
    };
  }

  P.demoApis.push({
    admBackups: function (p, me, env) {
      if (!A().isAdmin(me)) return C.forbidden();
      var st = store(env), pol = policyOf(st), items = build(env, st, pol), bytes = totalOf(items), now = env.now().toISOString(), next = atKyiv(env.today, pol.at);
      if (next <= now) next = atKyiv(addDays(env.today, 1), pol.at);
      return { ok: true, asOf: now, head: headOf(items, now), policy: pol, totals: { count: items.length, bytes: bytes, diskFreePct: diskFreePct(bytes) }, items: items.map(pub),
        schedule: { at: pol.at, next: next }, slack: null,   // slack — стан відправки дає лише справжній сервер
        offsite: { set: false, hint: 'Усі копії лежать на тому самому ноутбуці, що й база. Потрібен окремий диск або другий компʼютер, куди щодня копіюється тека копій.' },
        restore: { text: RESTORE, note: RESTORE_NOTE } };
    },
    admBackupNow: function (p, me, env) {
      if (!A().isAdmin(me)) return C.forbidden();
      var st = store(env), pol = policyOf(st), t = env.now().getTime(), before = build(env, st, pol).length;
      if (st.manual.some(function (at) { return Math.abs(Date.parse(at) - t) < 60000; })) return C.fail('too_soon', 'Копію щойно зроблено. Наступну можна зробити за хвилину.');
      var at = new Date(t).toISOString();
      st.manual.push(at);
      var items = build(env, st, pol), it = findItem(items, stamp(at));
      prune(st, items); save(env, st);
      if (!it) return C.fail('rotated', 'Копію зроблено, але правило зберігання її не лишило — перевірте «Місце для всіх копій».');
      return { ok: true, item: pub(it), removed: Math.max(0, before + 1 - items.length), message: 'Копію зроблено: ' + fmtBytes(it.bytes) + ', таблиць ' + it.tables + '.' };
    },
    admBackupVerify: function (p, me, env) {
      if (!A().isAdmin(me)) return C.forbidden();
      var st = store(env), it = findItem(build(env, st, policyOf(st)), p && p.id);
      if (!it) return C.fail('not_found', 'Такої копії вже немає — оновіть сторінку.');
      st.verified[it.id] = env.now().toISOString(); save(env, st);
      return { ok: true, id: it.id, verifiedAt: st.verified[it.id], tables: it.tables, rows: it.rows, message: 'Відновлення пройшло: ' + it.tables + ' таблиць, рядки збігаються.' };
    },
    admBackupView: function (p, me, env) {
      if (!A().isAdmin(me)) return C.forbidden();
      var st = store(env), it = findItem(build(env, st, policyOf(st)), p && p.id);
      if (!it) return C.fail('not_found', 'Такої копії вже немає — оновіть сторінку.');
      return { ok: true, id: it.id, at: it.at, kind: it.kind, bytes: it.bytes, schema: it.schema, verifiedAt: it.verifiedAt, tables: it._tables.slice(), excluded: EXCLUDED.slice() };
    },
    admBackupPolicy: function (p, me, env) {
      if (!A().isAdmin(me)) return C.forbidden();
      var st = store(env);
      return { ok: true, policy: policyOf(st), def: Object.assign({ at: DEF_AT, slackOn: false, slackTo: '' }, DEF), limits: JSON.parse(JSON.stringify(LIM)), changed: st.meta };
    },
    admBackupSlackNow: function (p, me) {
      if (!A().isAdmin(me)) return C.forbidden();
      return C.fail('not_ready', 'На тестовому сайті копія в Slack не надсилається — це робить лише справжній сервер.');
    },
    admBackupPolicySave: function (p, me, env) {
      if (!A().isAdmin(me)) return C.forbidden();
      p = obj(p);
      var st = store(env), was = policyOf(st), v = {}, errs = [], rows = [];
      FIELDS.forEach(function (k) {
        var n = typeof p[k] === 'string' && p[k].trim() !== '' ? Number(p[k].replace(',', '.')) : p[k];
        if (isInt(n, LIM[k])) v[k] = n; else errs.push({ field: k, message: MSG[k] });
      });
      v.at = was.at; v.slackOn = was.slackOn; v.slackTo = was.slackTo;
      if (p.at !== undefined) { var at = typeof p.at === 'string' ? p.at.trim() : ''; if (AT_RE.test(at)) v.at = at; else errs.push({ field: 'at', message: MSG_AT }); }
      if (p.slackOn !== undefined) { if (typeof p.slackOn === 'boolean') v.slackOn = p.slackOn; else errs.push({ field: 'slackOn', message: 'Надсилати в Slack — так чи ні.' }); }
      if (p.slackTo !== undefined) {
        var to = typeof p.slackTo === 'string' ? p.slackTo.trim() : '';
        if (to === '' || SLACK_TO_RE.test(to)) v.slackTo = to; else errs.push({ field: 'slackTo', message: MSG_TO });
      }
      if (!errs.length && v.slackOn && !v.slackTo) errs.push({ field: 'slackTo', message: MSG_TO_NEED });
      if (errs.length) return C.fail('validation', errs[0].message, errs);
      FIELDS.forEach(function (k) {
        if (v[k] !== was[k]) rows.push([LABEL[k], k === 'maxBytes' ? fmtBytes(was[k]) : String(was[k]), k === 'maxBytes' ? fmtBytes(v[k]) : String(v[k])]);
      });
      if (v.at !== was.at) rows.push([LABEL.at, was.at, v.at]);
      if (v.slackOn !== was.slackOn) rows.push([LABEL.slackOn, was.slackOn ? 'так' : 'ні', v.slackOn ? 'так' : 'ні']);
      if (v.slackTo !== was.slackTo) rows.push([LABEL.slackTo, was.slackTo || '—', v.slackTo || '—']);
      st.policy = FIELDS.every(function (k) { return v[k] === DEF[k]; }) && v.at === DEF_AT && !v.slackOn && !v.slackTo ? null : v;
      if (rows.length) st.meta = { at: env.now().toISOString(), by: me.id, byName: me.name, rows: rows };
      prune(st, build(env, st, policyOf(st))); save(env, st);
      A().log(env, me, 'Резервні копії', 'Правило зберігання', rows);
      return { ok: true, policy: policyOf(st), was: was, changed: rows.length };
    },
    admServer: function (p, me, env) {
      if (!A().isAdmin(me)) return C.forbidden();
      if (env.real) return serverUnknown(env);   // v1.1: справжні значення дає adm-system.mjs, тут вигадувати нічого
      var st = store(env), s = serverState(env, totalOf(build(env, st, policyOf(st))));
      return Object.assign({ ok: true, asOf: env.now().toISOString() }, s);
    }
  });

  P.demoSystem = { snapshot: function (env) {
    if (env.real) return null;   // v1.1: на справжньому сервері знімка з вигаданих значень немає
    var st = store(env), pol = policyOf(st), items = build(env, st, pol), bytes = totalOf(items), s = serverState(env, bytes);
    var last = items[0] || null, ver = items.map(function (x) { return x.verifiedAt; }).filter(Boolean).sort().pop() || null;
    return {
      backups: { count: items.length, totalBytes: bytes, last: last ? { at: last.at, ok: last.ok, bytes: last.bytes } : null, lastVerifiedAt: ver,
        policy: { daily: pol.daily, weekly: pol.weekly, monthly: pol.monthly, maxBytes: pol.maxBytes } },   // без Slack-ID: «Огляд» його не показує
      server: { ok: s.health.ok && s.services.every(function (x) { return x.state === 'RUNNING'; }), uptimeSec: s.health.uptimeSec, diskFreePct: s.resources.diskFreePct,
        errors24h: s.errors24h, certDaysLeft: s.network.cert.daysLeft, services: s.services.map(function (x) { return { id: x.id, label: x.label, state: x.state }; }) }
    };
  } };
})(typeof window !== 'undefined' ? window : globalThis);
