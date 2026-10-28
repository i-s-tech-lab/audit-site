(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon;
  P.demoSysApi = P.demoSysApi || {};

  var PREFIX = 'demo:prod:';
  var MAX_ROWS = 20000, MAX_SPAN_DAYS = 800;
  var SAFE_ID = /^[A-Za-z0-9_-]{1,40}$/;
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function clean(s, max) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, max || 80); }
  function r3(n) { return Math.round(n * 1000) / 1000; }
  function qty(x) { return typeof x === 'number' && isFinite(x) && x >= 0 && x <= 1e9 ? x : 0; }
  function tables(env, locId) { return P.demoManage && P.demoManage.prodTables ? P.demoManage.prodTables(env, locId) : []; }
  function keyOf(locId, tableId) { return PREFIX + locId + ':' + tableId; }
  function depMap(t) { var o = {}; arr(t.depts).forEach(function (x) { if (x && x.departmentId && x.doneCol) o[x.departmentId] = !!x.planCol; }); return o; }

  function sig(t) {
    var s = JSON.stringify([t.url, t.sheet, t.headerRow, t.dataRow, t.dateCol, t.orderCol,
      arr(t.depts).map(function (x) { return [x.departmentId, x.doneCol, x.planCol || '']; })]);
    var a = 0x811c9dc5, b = 0x01000193 ^ 0x5bd1e995;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      a = Math.imul(a ^ c, 0x01000193) >>> 0;
      b = Math.imul(b ^ c, 0x01000193) >>> 0;
      b = (b ^ (b >>> 13)) >>> 0;
    }
    return ('0000000' + a.toString(16)).slice(-8) + ('0000000' + b.toString(16)).slice(-8);
  }
  function factsOf(env, locId, t) {
    var f = env.storage.get(keyOf(locId, t.id), null);
    return f && f.sig === sig(t) && f.okAt && f.days ? f : null;
  }
  function add(out, day, dep, done, plan) {
    if (!has(out, day)) out[day] = {};
    if (!has(out[day], dep)) out[day][dep] = { done: 0, plan: null };
    var c = out[day][dep];
    c.done = r3(c.done + qty(done));
    if (plan != null) c.plan = r3((c.plan || 0) + qty(plan));
  }
  function dayList(from, to) {
    var out = [], k = from;
    while (k <= to && out.length < MAX_SPAN_DAYS) { out.push(k); k = P.demoDates.addDays(k, 1); }
    return out;
  }

  function demoCounts(env, locId) {
    var n = {};
    tables(env, locId).forEach(function (t) {
      var m = depMap(t);
      Object.keys(m).forEach(function (dep) { if (!has(n, dep)) n[dep] = [0, 0]; n[dep][0]++; if (m[dep]) n[dep][1]++; });
    });
    return n;
  }
  function demoBy(env, locId, orders, from, to) {
    var out = {}, n = demoCounts(env, locId), deps = Object.keys(n);
    dayList(from, to).forEach(function (day) {
      if (P.demoDates.dow(day) === 0) return;   // неділя — вихідний
      deps.forEach(function (dep) {
        var dp = orders.reduce(function (s, o) { return s + (o.firstDay <= day && day <= o.lastDay ? ((o.daily || {})[dep] || 0) : 0); }, 0);
        add(out, day, dep, dp * n[dep][0], n[dep][1] ? dp * n[dep][1] : null);
      });
    });
    return out;
  }
  function locOrders(env, locId) { return env.db.orders.filter(function (o) { return o.locationId === locId; }); }

  P.demoProd = {
    byDay: function (env, locId, from, to) {
      if (!env.real) return demoBy(env, locId, locOrders(env, locId), from, to);
      var out = {};
      tables(env, locId).forEach(function (t) {
        var f = factsOf(env, locId, t), m = depMap(t); if (!f) return;
        Object.keys(f.days).forEach(function (day) {
          if (day < from || day > to) return;
          var dd = f.days[day];
          Object.keys(dd).forEach(function (dep) { if (has(m, dep)) add(out, day, dep, dd[dep][0], m[dep] ? dd[dep][1] : null); });
        });
      });
      return out;
    },
    byOrder: function (env, locId, orderNo, from, to) {
      var no = clean(orderNo, 60);
      if (!env.real) return demoBy(env, locId, locOrders(env, locId).filter(function (o) { return o.no === no; }), from, to);
      var out = {};
      tables(env, locId).forEach(function (t) {
        if (!factsOf(env, locId, t)) return;
        var g = env.storage.get(keyOf(locId, t.id) + ':orders', null), m = depMap(t);
        if (!g || g.sig !== sig(t) || !g.orders || !has(g.orders, no)) return;
        var od = g.orders[no];
        Object.keys(od).forEach(function (day) {
          if (day < from || day > to) return;
          Object.keys(od[day]).forEach(function (dep) { if (has(m, dep)) add(out, day, dep, od[day][dep][0], m[dep] ? od[day][dep][1] : null); });
        });
      });
      return out;
    },
    byOrders: function (env, locId, nos, from, to) {
      var out = {};
      arr(nos).forEach(function (no) { out[clean(no, 60)] = {}; });
      if (!env.real) { Object.keys(out).forEach(function (no) { out[no] = P.demoProd.byOrder(env, locId, no, from, to); }); return out; }
      tables(env, locId).forEach(function (t) {
        if (!factsOf(env, locId, t)) return;
        var g = env.storage.get(keyOf(locId, t.id) + ':orders', null), m = depMap(t);
        if (!g || g.sig !== sig(t) || !g.orders) return;
        Object.keys(out).forEach(function (no) {
          if (!has(g.orders, no)) return;
          var od = g.orders[no];
          Object.keys(od).forEach(function (day) {
            if (day < from || day > to) return;
            Object.keys(od[day]).forEach(function (dep) { if (has(m, dep)) add(out[no], day, dep, od[day][dep][0], m[dep] ? od[day][dep][1] : null); });
          });
        });
      });
      return out;
    },
    sources: function (env, locId, depId) {
      var out = [];
      tables(env, locId).forEach(function (t) {
        var m = depMap(t); if (!has(m, depId)) return;
        var f = env.real ? env.storage.get(keyOf(locId, t.id), null) : null;
        out.push({ tableId: t.id, mark: t.mark, label: t.label, plan: m[depId], ready: !env.real || !!factsOf(env, locId, t),
          failed: !!(f && f.sig === sig(t) && f.status === 'error') });
      });
      return out;
    },
    connected: function (env, locId, depId) { return P.demoProd.sources(env, locId, depId).length > 0; },
    ready: function (env, locId, depId) { return P.demoProd.sources(env, locId, depId).some(function (s) { return s.ready; }); },
    status: function (env, locId) {
      return tables(env, locId).map(function (t) {
        var base = { tableId: t.id, mark: t.mark, label: t.label, title: t.title };
        if (!env.real) {
          var at = P.demoDates.kyivToIso(env.day(), 6 * 60 + 2);
          return Object.assign(base, { status: 'ok', readAt: at, okAt: at, rows: null, skipped: null, cut: false, code: null, error: null });
        }
        var f = env.storage.get(keyOf(locId, t.id), null), same = !!(f && f.sig === sig(t));
        return Object.assign(base, { status: same ? f.status : 'never', readAt: same ? f.readAt : null, okAt: same ? f.okAt || null : null,
          rows: same ? f.rows : null, skipped: same ? f.skipped || null : null, cut: same && !!f.cut, code: same ? f.code || null : null,
          error: same ? f.error || null : null });
      });
    },
    lastOkAt: function (env, locId) {
      var best = null;
      P.demoProd.status(env, locId).forEach(function (s) { if (s.okAt && (!best || s.okAt > best)) best = s.okAt; });
      return best;
    },
    specs: function (env, locId) {
      return tables(env, locId).map(function (t) {
        if (!/^https:\/\/\S+$/.test(String(t.url || ''))) return null;   // адресу перевірив і звів до одного вигляду сервер
        var names = {}, header = {};
        arr(t.columns).forEach(function (c) { names[c.col] = c.name; });
        [t.dateCol, t.orderCol].concat(arr(t.depts).reduce(function (a, x) { return a.concat([x.doneCol, x.planCol]); }, [])).forEach(function (c) {
          if (c && has(names, c)) header[c] = names[c];
        });
        return { tableId: t.id, label: t.label, url: t.url, sheet: t.sheet, headerRow: t.headerRow, dataRow: t.dataRow, dateCol: t.dateCol,
          orderCol: t.orderCol, depts: arr(t.depts).map(function (x) { return { departmentId: x.departmentId, doneCol: x.doneCol, planCol: x.planCol || null }; }),
          header: header, sig: sig(t) };
      }).filter(Boolean);
    },
    forget: function (env, locId, tableId) {
      if (!SAFE_ID.test(String(locId)) || !SAFE_ID.test(String(tableId))) return;
      env.storage.del(keyOf(locId, tableId)); env.storage.del(keyOf(locId, tableId) + ':orders');
    }
  };

  P.demoSysApi.srProdTables = function (p, env) {
    var locs = env.db.locations.filter(function (l) { return !p.locationId || l.id === p.locationId; });
    return { ok: true, locations: locs.map(function (l) { return { locationId: l.id, tables: P.demoProd.specs(env, l.id) }; })
      .filter(function (x) { return x.tables.length; }) };
  };

  P.demoSysApi.srProdApply = function (p, env) {
    var loc = typeof p.locationId === 'string' && has(env.ix.loc, p.locationId) ? env.ix.loc[p.locationId] : null;
    if (!loc) return C.fail('not_found', 'Локацію не знайдено.');
    var t = tables(env, loc.id).filter(function (x) { return x.id === p.tableId; })[0];
    if (!t || p.sig !== sig(t)) return { ok: true, stale: true };
    if (!SAFE_ID.test(loc.id) || !SAFE_ID.test(t.id)) return C.fail('validation', 'Цю таблицю не можна зберегти.');
    var key = keyOf(loc.id, t.id), s = sig(t), at = typeof p.readAt === 'string' && !isNaN(Date.parse(p.readAt)) ? p.readAt : env.now().toISOString();
    if (p.error) {
      var old = env.storage.get(key, null);
      var f = old && old.sig === s ? old : { v: 1, tableId: t.id, sig: s, okAt: null, rows: null, skipped: null, cut: false, days: {} };
      f.status = 'error'; f.readAt = at; f.code = clean(p.code, 30) || 'server'; f.error = clean(p.error, 300);
      env.storage.set(key, f);
      return { ok: true, status: 'error' };
    }
    var m = depMap(t), deps = Object.keys(m), days = {}, orders = {}, n = 0;
    function put(o, dep, done, plan) {
      if (!has(o, dep)) o[dep] = [0, m[dep] ? 0 : null];
      o[dep][0] = r3(o[dep][0] + done);
      if (m[dep]) o[dep][1] = r3(o[dep][1] + plan);
    }
    arr(p.rows).slice(0, MAX_ROWS).forEach(function (r) {
      if (!r || !DAY_RE.test(r.day) || !r.v || typeof r.v !== 'object') return;
      var order = clean(r.order, 60);
      if (order === '__proto__') order = '';
      n++;
      deps.forEach(function (dep) {
        var x = has(r.v, dep) && Array.isArray(r.v[dep]) ? r.v[dep] : null; if (!x) return;
        var done = qty(x[0]), plan = qty(x[1]);
        if (!has(days, r.day)) days[r.day] = {};
        put(days[r.day], dep, done, plan);
        if (!order) return;
        if (!has(orders, order)) orders[order] = {};
        if (!has(orders[order], r.day)) orders[order][r.day] = {};
        put(orders[order][r.day], dep, done, plan);
      });
    });
    var sk = p.skipped || {};
    env.storage.set(key, { v: 1, tableId: t.id, sig: s, status: 'ok', code: null, error: null, readAt: at, okAt: at, rows: n,
      skipped: { date: qty(sk.date), num: qty(sk.num) }, cut: !!p.cut, days: days });
    env.storage.set(key + ':orders', { sig: s, orders: orders });
    return { ok: true, status: 'ok', rows: n };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P.demoProd;
})(typeof window !== 'undefined' ? window : globalThis);
