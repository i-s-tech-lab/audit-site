(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  P.demoApis = P.demoApis || [];

  var LEVEL_LABELS = { fix: 'неправильно зроблене', repair: 'пошкоджене', scrap: 'зламане' };
  var ROLE_TAGS = { auditor: 'аудитор', senior_auditor: 'старший', manager: 'керівник', admin: 'адміністратор' };
  var ORDER_DAYS = 60, KD_DAYS = 60, AUDIT_LIMIT = 10;

  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function dm(day) { var p = String(day).split('-'); return p[2] + '.' + p[1]; }
  function dmy(day) { var p = String(day).split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
  function addDays(day, n) {
    var p = String(day).split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * 86400000).toISOString().slice(0, 10);
  }
  function row(k, id, t, s, tags, loc) {
    var o = { k: k, id: String(id), t: String(t), s: String(s || ''), tags: tags };
    if (loc) o.loc = loc;
    return o;
  }
  function off(x) { return x.active === false ? ' · вимкнено' : ''; }
  function locName(env, id) { return has(env.ix.loc, id) ? env.ix.loc[id].name : id; }
  function byName(a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; }

  function locNames(env, u) { return u.locationIds.filter(function (id) { return has(env.ix.loc, id); }).map(function (id) { return env.ix.loc[id].name; }).join(', '); }

  function people(env, locIds, role, k, tag) {
    var set = {}; locIds.forEach(function (id) { set[id] = 1; });
    return env.db.users.filter(function (u) {
      return u.role === role && !u.legacy && u.locationIds.some(function (id) { return set[id]; });
    }).map(function (u) {
      var own = u.locationIds.filter(function (id) { return set[id]; });
      return row(k, u.id, u.name, locNames(env, u) + off(u), [tag], own[0]);
    });
  }
  function depts(env, locIds) {
    var set = {}; locIds.forEach(function (id) { set[id] = 1; });
    return env.db.departments.filter(function (d) { return set[d.locationId] && d.active !== false; })
      .map(function (d) { return row('dept', d.id, d.name, locName(env, d.locationId), ['відділ'], d.locationId); });
  }
  function defects(env, deptTypes) {
    return env.db.defectTypes.filter(function (t) { return t.active !== false && (!deptTypes || deptTypes[t.deptTypeId]); }).map(function (t) {
      var lv = has(LEVEL_LABELS, t.level) ? LEVEL_LABELS[t.level] : null, dt = has(env.ix.dt, t.deptTypeId) ? env.ix.dt[t.deptTypeId].name : '';
      return row('defect', t.id, t.name, [dt, lv].filter(Boolean).join(' · '), lv ? ['вид браку', lv] : ['вид браку']);
    });
  }
  function products(env, deptTypes) {
    return env.db.products.filter(function (x) { return x.active !== false && (!deptTypes || deptTypes[x.deptTypeId]); }).map(function (x) {
      return row('product', x.id, x.name, has(env.ix.dt, x.deptTypeId) ? env.ix.dt[x.deptTypeId].name : '', ['виріб']);
    });
  }
  function typesOf(env, locIds) {
    var set = {}, t = {}; locIds.forEach(function (id) { set[id] = 1; });
    env.db.departments.forEach(function (d) { if (set[d.locationId]) t[d.deptTypeId] = true; });
    return t;
  }
  function actions(env, locIds, withLoc) {
    var out = [];
    if (!P.demoKd || typeof P.demoKd.locSummary !== 'function') return out;
    var today = env.day(), from = addDays(today, -(KD_DAYS - 1));
    locIds.forEach(function (id) {
      var r;
      try { r = P.demoKd.locSummary(env, id, from, today); } catch (e) { return; }   // збій КД однієї локації не ховає решту пошуку
      if (!r || !r.ok) return;
      (r.actions || []).forEach(function (a) {
        var tags = ['коригуюча дія', 'кд'];
        if (a.state === 'relapse') tags.push('рецидив');
        out.push(row('kd', a.key, a.departmentName + ' · тиждень ' + dm(a.weekStart) + '–' + dm(a.weekEnd),
          (withLoc ? locName(env, id) + ' · ' : '') + (a.statusLabel || ''), tags, id));
      });
    });
    return out;
  }

  function seniorIndex(me, env) {
    var locIds = me.locations.map(function (l) { return l.id; }).filter(function (id) { return has(env.ix.loc, id); });
    var multi = locIds.length > 1, set = {}, types = typesOf(env, locIds), edge = addDays(env.day(), -ORDER_DAYS), out = [];
    locIds.forEach(function (id) { set[id] = 1; });
    out = out.concat(people(env, locIds, 'auditor', 'auditor', 'аудитор'), people(env, locIds, 'senior_auditor', 'senior', 'старший'));
    env.db.workers.filter(function (w) { return set[w.locationId]; }).forEach(function (w) {
      var dep = has(env.ix.dep, w.departmentId) ? env.ix.dep[w.departmentId].name : '';
      out.push(row('worker', w.code, w.name, [dep, multi ? locName(env, w.locationId) : ''].filter(Boolean).join(' · ') + off(w), ['працівник'], w.locationId));
    });
    out = out.concat(depts(env, locIds), defects(env, types), products(env, types));
    env.db.orders.filter(function (o) { return set[o.locationId] && (!o.lastDay || o.lastDay >= edge); }).forEach(function (o) {
      out.push(row('order', o.no, o.no, [o.customer, o.lastDay ? 'до ' + dm(o.lastDay) : '', multi ? locName(env, o.locationId) : ''].filter(Boolean).join(' · '), ['замовлення'], o.locationId));
    });
    return out.concat(actions(env, locIds, multi));
  }
  function managerIndex(me, env) {
    var locIds = me.locations.map(function (l) { return l.id; }).filter(function (id) { return has(env.ix.loc, id) && env.ix.loc[id].active !== false; }), out = [];
    locIds.forEach(function (id) { out.push(row('loc', id, locName(env, id), '', ['локація'], id)); });
    out = out.concat(depts(env, locIds), people(env, locIds, 'auditor', 'auditor', 'аудитор'), people(env, locIds, 'senior_auditor', 'senior', 'старший'));
    return out.concat(actions(env, locIds, true));
  }
  function adminIndex(env) {
    var out = [], locIds = env.db.locations.map(function (l) { return l.id; });
    env.db.locations.forEach(function (l) { out.push(row('loc', l.id, l.name, l.active === false ? 'вимкнена' : '', ['локація'], l.id)); });
    env.db.users.filter(function (u) { return !u.legacy && has(ROLE_TAGS, u.role); }).forEach(function (u) {
      out.push(row('person', u.id, u.name, [P.demoDict && P.demoDict.roleLabels ? P.demoDict.roleLabels[u.role] : u.role, locNames(env, u)].filter(Boolean).join(' · ') + off(u),
        [ROLE_TAGS[u.role]], u.locationIds[0]));
    });
    return out.concat(depts(env, locIds), defects(env, null), products(env, null));
  }

  function auditLookup(q, me, env) {
    q = String(q == null ? '' : q).trim().toLowerCase();
    if (q.length < 2 || q.length > 60) return { ok: true, items: [] };
    var C = P.demoCommon, all = me.role === 'admin' || !!(me.can && me.can.viewAllLocations);   // перевірка 30.10: як mgr* / sinceLast
    var list = env.audits().filter(function (a) {
      return String(a.id).toLowerCase().indexOf(q) >= 0 && (all || C.hasLoc(me, a.locationId));
    }).sort(C.newestFirst).slice(0, AUDIT_LIMIT);
    return { ok: true, items: list.map(function (a) {
      var dep = has(env.ix.dep, a.departmentId) ? env.ix.dep[a.departmentId].name : '';
      return row('audit', a.id, a.id, [dmy(a.day), dep, locName(env, a.locationId)].filter(Boolean).join(' · '), ['аудит'], a.locationId);
    }) };
  }

  P.demoApis.push({
    searchIndex: function (p, me, env) {
      var C = P.demoCommon;
      if (!me) return C.auth();
      if (me.role === 'auditor') return C.forbidden();
      p = p || {};
      if (typeof p.audit === 'string') return auditLookup(p.audit, me, env);
      if (me.role === 'senior_auditor' && typeof p.locationId === 'string' && C.hasLoc(me, p.locationId)) {
        me = Object.assign({}, me, { locations: me.locations.filter(function (l) { return l.id === p.locationId; }) });
      }
      var items = me.role === 'senior_auditor' ? seniorIndex(me, env) : me.role === 'manager' ? managerIndex(me, env) : me.role === 'admin' ? adminIndex(env) : null;
      if (!items) return C.forbidden();
      items.sort(byName);
      var locs = me.role === 'senior_auditor' ? me.locations : env.db.locations;
      return { ok: true, items: items, locations: locs.map(function (l) { return { id: l.id, name: l.name }; }) };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
