(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon;
  P.demoApis = P.demoApis || [];

  var KEY_JOURNAL = 'demo:sr:mg:journal', KEY_TRASH = 'demo:sr:hist:trash';   // журнал старшого й кошик (чужі модулі — лише читаємо)
  var PAGE = 50, MAX_DAYS = 183, DEF_DAYS = 7, TRASH_DAYS = 30, DAY = 86400000;
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  var GLOBAL = [
    { id: 'locations', label: 'Локації', path: '/locations', area: 'Локації' },
    { id: 'people', label: 'Люди й доступи', path: '/people', area: 'Люди й доступи' },
    { id: 'rights', label: 'Що може роль', path: '/people/rights', area: 'Права ролей' },
    { id: 'rules', label: 'Правила', path: '/rules', area: 'Правила' },
    { id: 'mailing', label: 'Розсилки', path: '/mailing', area: 'Розсилки' }
  ];
  var LOCAL = [
    { id: 'depts', label: 'Відділи', section: 'depts' },
    { id: 'products', label: 'Вироби', section: 'products' },
    { id: 'defects', label: 'Види браку', section: 'defects' },
    { id: 'workers', label: 'Виробничі працівники', section: 'workers' },
    { id: 'team', label: 'Команда', section: 'team' }
  ];
  var ACTION = { add: 'додано', edit: 'змінено', merge: 'обʼєднано', delete: 'видалено' };
  var LEVEL = { fix: 'неправильно зроблене', repair: 'пошкоджене', scrap: 'зламане' };

  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function nm(map, id, fb) { return has(map, id) ? map[id].name : fb; }
  function on(x) { return x.active !== false; }
  function addDays(k, n) { return P.demoDates.addDays(k, n); }
  function daysBetween(a, b) { return Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / DAY); }
  function api(fn) { var h = null; P.demoApis.forEach(function (x) { if (!h && has(x, fn)) h = x[fn]; }); return h; }
  function locTypes(env, locId) { var t = {}; env.db.departments.forEach(function (d) { if (d.locationId === locId) t[d.deptTypeId] = true; }); return t; }
  function localItems(env, locId, id) {
    var t = locTypes(env, locId), db = env.db;
    if (id === 'depts') return db.departments.filter(function (d) { return d.locationId === locId; });
    if (id === 'products') return db.products.filter(function (x) { return t[x.deptTypeId]; });
    if (id === 'defects') return db.defectTypes.filter(function (x) { return t[x.deptTypeId]; });
    if (id === 'workers') return db.workers.filter(function (w) { return w.locationId === locId; });
    return db.users.filter(function (u) { return (u.role === 'auditor' || u.role === 'senior_auditor') && !u.legacy && u.locationIds.indexOf(locId) >= 0; });
  }
  function teamOn(u) { return on(u) && !u.accessOff; }

  function adminLast(env, area) {
    var x = P.demoAdmin.readLog(env).filter(function (r) { return r.area === area; })[0];
    return x ? { at: x.at, byName: x.byName, what: x.target + ' · ' + x.what } : null;
  }
  function mailLast(env, rules) {
    var log = adminLast(env, 'Розсилки'); if (log) return log;
    var x = rules.filter(function (r) { return r.updatedAt && r.updatedAt !== r.createdAt; }).sort(function (a, b) { return a.updatedAt < b.updatedAt ? 1 : -1; })[0];
    return x ? { at: x.updatedAt, byName: null, what: 'Розсилка «' + x.title + '»' } : null;
  }
  function localLast(env) {
    var cut = new Date(env.now().getTime() - 30 * DAY).toISOString(), out = {};
    arr(env.storage.get(KEY_JOURNAL, [])).forEach(function (x) {
      if (!x || typeof x.at !== 'string' || x.at < cut) return;
      var sec = x.section === 'merge' ? (arr(x.changes)[0] && arr(x.changes)[0].label === 'Вироби' ? 'products' : 'defects') : x.section;
      var k = x.locationId + ':' + sec;
      if (!out[k] || x.at > out[k].at) out[k] = { at: x.at, byName: String(x.byName || x.by || ''), what: (ACTION[x.action] || 'змінено') + ' · ' + String(x.what || '') };
    });
    return out;
  }

  function yes(b) { return b ? 'увімкнено' : 'вимкнено'; }
  function locNames(env, ids) { return ids.map(function (id) { return nm(env.ix.loc, id, id); }).join(', '); }
  var EXPORT = {
    locations: function (env) {
      return { columns: ['Назва', 'Стан', 'Slack-канал', 'Нагадування «запишіть аудит»', 'Відділів', 'Виробничих працівників'],
        rows: env.db.locations.map(function (l) {
          return [l.name, yes(on(l)), l.slackChannel || '', P.demoAdmin.remText(l.reminders), localItems(env, l.id, 'depts').filter(on).length, localItems(env, l.id, 'workers').filter(on).length];
        }) };
    },
    people: function (env) {
      return { columns: ['Імʼя', 'Роль', 'Локації', 'Доступ', 'Slack ID (скорочено)'],
        rows: env.db.users.map(function (u) {
          return [u.name, P.demoDict.roleLabels[u.role] || u.role, u.role === 'manager' || u.role === 'admin' ? 'усі локації' : locNames(env, u.locationIds), yes(!u.accessOff), C.maskSlackId(u.slackId)];
        }) };
    },
    rights: function (env) {
      var A = P.demoAdmin;
      return { columns: ['Роль'].concat(A.RIGHTS.map(function (r) { return r.label; })),
        rows: A.RIGHT_ROLES.concat(['admin']).map(function (role) {
          var can = C.canOf(role);
          return [P.demoDict.roleLabels[role] || role].concat(A.RIGHTS.map(function (r) { return can[r.key] ? 'можна' : 'не можна'; }));
        }) };
    },
    rules: function (env) {
      var A = P.demoAdmin;
      return { columns: ['Правило', 'Значення', 'Одиниця', 'За замовчуванням'],
        rows: A.RULES.map(function (r) {
          var v = A.GET[r.key](env.db), d = A.DEF[r.key];
          return [r.label, r.names ? r.names[v - 1] : v, r.names ? '' : r.unit, r.names ? r.names[d - 1] : d];
        }) };
    },
    mailing: function (env, loc, me) {
      var r = api('mlRules')({}, me, env), items = r && r.ok ? r.items : [];
      return { columns: ['Назва', 'Стан', 'Коли', 'Локації', 'Відділи', 'Кому', 'Умова'],
        rows: items.map(function (x) {
          return [x.title, yes(x.enabled), x.whenLabel, x.locLabel, x.depLabel, x.toLabels.map(function (t) { return t.label; }).join(', '), x.condLabel];
        }) };
    },
    depts: function (env, loc) {
      return { columns: ['Назва', 'Тип відділу', 'Норма вибірки на день, шт', 'Стан'],
        rows: localItems(env, loc.id, 'depts').map(function (d) {
          var n = env.db.norms.filter(function (x) { return x.departmentId === d.id; })[0];
          return [d.name, nm(env.ix.dt, d.deptTypeId, ''), n ? n.sampleTarget : '', yes(on(d))];
        }) };
    },
    products: function (env, loc) {
      return { columns: ['Назва', 'Тип відділу', 'Стан'],
        rows: localItems(env, loc.id, 'products').map(function (x) { return [x.name, nm(env.ix.dt, x.deptTypeId, ''), yes(on(x))]; }) };
    },
    defects: function (env, loc) {
      return { columns: ['Назва', 'Тип відділу', 'Рівень', 'Стан'],
        rows: localItems(env, loc.id, 'defects').map(function (x) { return [x.name, nm(env.ix.dt, x.deptTypeId, ''), LEVEL[x.level] || '', yes(on(x))]; }) };
    },
    workers: function (env, loc) {
      return { columns: ['Підпис', 'Відділ', 'Стан'],
        rows: localItems(env, loc.id, 'workers').map(function (w) { return [w.name, nm(env.ix.dep, w.departmentId, ''), yes(on(w))]; }) };
    },
    team: function (env, loc) {
      return { columns: ['Імʼя', 'Роль', 'Доступ', 'Slack ID (скорочено)'],
        rows: localItems(env, loc.id, 'team').map(function (u) { return [u.name, P.demoDict.roleLabels[u.role] || u.role, yes(teamOn(u)), C.maskSlackId(u.slackId)]; }) };
    }
  };

  function photosOf(a) { return a.defects.reduce(function (n, d) { return n + (Array.isArray(d.photos) && d.photos.length ? d.photos.length : d.photo ? 1 : 0); }, 0); }
  function row(env, a) {
    var ix = env.ix, checked = C.checkedOf(a), rejected = C.rejectedOf(a);
    return { id: a.id, createdAt: a.createdAt, day: a.day, locationId: a.locationId, locationName: nm(ix.loc, a.locationId, a.locationId),
      departmentId: a.departmentId, departmentName: nm(ix.dep, a.departmentId, a.departmentId), auditorId: a.auditorId, auditorName: nm(ix.user, a.auditorId, a.auditorId),
      orders: a.orders.slice(), checked: checked, rejected: rejected, pct: C.pct(rejected, checked), photos: photosOf(a), edited: !!a.updatedAt,
      updatedAt: a.updatedAt || null, updatedByName: a.updatedAt ? nm(ix.user, a.updatedBy || a.auditorId, a.updatedBy || a.auditorId) : null, trash: null };
  }
  function trashRow(env, t) {
    var a = t.audit || {};
    return { id: t.id, createdAt: a.createdAt || null, day: a.day || null, locationId: t.locationId, locationName: nm(env.ix.loc, t.locationId, t.locationId),
      departmentId: null, departmentName: a.departmentName || '—', auditorId: null, auditorName: a.auditorName || '—', orders: [], products: arr(a.products),
      checked: a.checked || 0, rejected: a.rejected || 0, pct: C.pct(a.rejected || 0, a.checked || 0), photos: null, edited: null, updatedAt: null, updatedByName: null,
      trash: { deletedAt: t.deletedAt, byName: nm(env.ix.user, t.by, t.by || '—'), reason: t.reason || '', until: new Date(Date.parse(t.deletedAt) + TRASH_DAYS * DAY).toISOString() } };
  }
  function filterLists(env, locId) {
    var db = env.db, t = locId ? locTypes(env, locId) : null, who = {};
    env.audits().forEach(function (a) { if (!locId || a.locationId === locId) who[a.auditorId] = 1; });
    return {
      locations: db.locations.map(function (l) { return { id: l.id, name: l.name, active: on(l) }; }),
      departments: db.departments.filter(function (d) { return !locId || d.locationId === locId; })
        .map(function (d) { return { id: d.id, name: d.name, locationId: d.locationId, locationName: nm(env.ix.loc, d.locationId, '') }; }),
      auditors: db.users.filter(function (u) { return who[u.id] || ((u.role === 'auditor' || u.role === 'senior_auditor') && (!locId || u.locationIds.indexOf(locId) >= 0)); })
        .map(function (u) { return { id: u.id, name: u.name }; }).sort(function (a, b) { return a.name.localeCompare(b.name, 'uk'); }),
      defectTypes: db.defectTypes.filter(function (x) { return !t || t[x.deptTypeId]; })
        .map(function (x) { return { id: x.id, name: x.name, deptTypeName: nm(env.ix.dt, x.deptTypeId, '') }; })
    };
  }
  function range(p, today) {
    var to = DAY_RE.test(p.to || '') && p.to <= today ? p.to : today;
    var from = DAY_RE.test(p.from || '') && p.from <= to ? p.from : addDays(to, -(DEF_DAYS - 1)), limited = false;
    if (daysBetween(from, to) + 1 > MAX_DAYS) { from = addDays(to, -(MAX_DAYS - 1)); limited = true; }
    return { from: from, to: to, limited: limited, days: daysBetween(from, to) + 1 };
  }

  P.demoApis.push({
    admDicts: function (p, me, env) {
      if (!P.demoAdmin.isAdmin(me)) return C.forbidden();
      var db = env.db, mail = api('mlRules')({}, me, env), rules = mail && mail.ok ? mail.items : [], last = localLast(env);
      var count = { locations: db.locations.length, people: db.users.filter(function (u) { return !u.accessOff; }).length,
        rights: P.demoAdmin.RIGHT_ROLES.length + 1, rules: P.demoAdmin.RULES.length, mailing: rules.length };
      return { ok: true, asOf: env.now().toISOString(),
        global: GLOBAL.map(function (g) {
          return { id: g.id, label: g.label, count: count[g.id], lastChange: g.id === 'mailing' ? mailLast(env, rules) : adminLast(env, g.area), path: g.path };
        }),
        locations: db.locations.map(function (l) {
          return { id: l.id, name: l.name, active: on(l), dicts: LOCAL.map(function (d) {
            var list = localItems(env, l.id, d.id), act = list.filter(d.id === 'team' ? teamOn : on).length;
            return { id: d.id, label: d.label, active: act, archived: list.length - act, lastChange: last[l.id + ':' + d.section] || null };
          }) };
        }) };
    },

    admDictExport: function (p, me, env) {
      if (!P.demoAdmin.isAdmin(me)) return C.forbidden();
      var isLocal = LOCAL.some(function (d) { return d.id === p.dict; }), isGlobal = GLOBAL.some(function (g) { return g.id === p.dict; });
      if (!isLocal && !isGlobal) return C.fail('validation', 'Такого довідника немає — оновіть сторінку.', [{ field: 'dict', message: 'Такого довідника немає — оновіть сторінку.' }]);
      var loc = isLocal ? (typeof p.locationId === 'string' && has(env.ix.loc, p.locationId) ? env.ix.loc[p.locationId] : null) : null;
      if (isLocal && !loc) return C.fail('not_found', 'Такої локації немає — оновіть сторінку.');
      var t = EXPORT[p.dict](env, loc, me);
      return { ok: true, filename: 'audit-' + p.dict + (loc ? '-' + loc.id.toLowerCase() : '') + '-' + env.day() + '.csv', columns: t.columns, rows: t.rows };
    },

    admAudits: function (p, me, env) {
      if (!P.demoAdmin.isAdmin(me)) return C.forbidden();
      var ix = env.ix, rg = range(p, env.day()), q = String(p.q == null ? '' : p.q).trim().toLowerCase().slice(0, 60);
      var locId = typeof p.locationId === 'string' && has(ix.loc, p.locationId) ? p.locationId : '';
      var dep = typeof p.departmentId === 'string' && has(ix.dep, p.departmentId) && (!locId || ix.dep[p.departmentId].locationId === locId) ? ix.dep[p.departmentId] : null;
      var aud = typeof p.auditorId === 'string' && has(ix.user, p.auditorId) ? ix.user[p.auditorId] : null;
      var def = typeof p.defectTypeId === 'string' && has(ix.def, p.defectTypeId) ? p.defectTypeId : '';
      var rows;
      if (p.trash === true) {
        var cut = new Date(env.now().getTime() - TRASH_DAYS * DAY).toISOString();
        rows = arr(env.storage.get(KEY_TRASH, [])).filter(function (t) { return t && t.deletedAt >= cut; })
          .sort(function (a, b) { return a.deletedAt < b.deletedAt ? 1 : a.deletedAt > b.deletedAt ? -1 : 0; }).map(function (t) { return trashRow(env, t); })
          .filter(function (r) {
            return (!locId || r.locationId === locId) && (!dep || r.departmentName === dep.name) && (!aud || r.auditorName === aud.name) &&
              (p.withDefects !== true || r.rejected > 0) && (!q || r.id.toLowerCase().indexOf(q) >= 0);
          });
      } else {
        rows = env.audits().filter(function (a) {
          if (a.day < rg.from || a.day > rg.to || (locId && a.locationId !== locId) || (dep && a.departmentId !== dep.id) || (aud && a.auditorId !== aud.id)) return false;
          if (def && !a.defects.some(function (d) { return d.defectTypeId === def; })) return false;
          if (p.withDefects === true && !C.rejectedOf(a)) return false;
          if (p.edited === true && !a.updatedAt) return false;
          return !q || a.id.toLowerCase().indexOf(q) >= 0 || a.orders.some(function (o) { return String(o).toLowerCase().indexOf(q) >= 0; });
        }).sort(C.newestFirst).map(function (a) { return row(env, a); });
      }
      var totals = { audits: rows.length, checked: 0, rejected: 0, pct: null, withPhotos: p.trash === true ? null : 0 };
      rows.forEach(function (r) { totals.checked += r.checked; totals.rejected += r.rejected; if (r.photos) totals.withPhotos++; });
      totals.pct = C.pct(totals.rejected, totals.checked);
      var pages = Math.max(1, Math.ceil(rows.length / PAGE)), page = Math.min(pages, Math.max(1, parseInt(p.page, 10) || 1));
      return { ok: true, from: rg.from, to: rg.to, days: rg.days, limited: rg.limited, maxDays: MAX_DAYS, trash: p.trash === true,
        items: rows.slice((page - 1) * PAGE, page * PAGE), total: rows.length, page: page, pages: pages, perPage: PAGE, totals: totals, filters: filterLists(env, locId) };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
