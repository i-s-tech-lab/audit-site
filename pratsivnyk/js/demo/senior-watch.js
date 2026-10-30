(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  P.demoApis = P.demoApis || [];
  var DAY_RE = /^\d{4}-\d{2}-\d{2}$/, MAX = 200;

  function has(o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k); }
  function nm(map, id, fb) { return map[id] ? map[id].name : fb; }
  function lvOf(env, typeId) { var t = env.ix.def[typeId]; return (t && t.level) || 'fix'; }
  function range(p, env) {
    var today = env.day(), to = DAY_RE.test(p.to || '') && p.to <= today ? p.to : today;
    var from = DAY_RE.test(p.from || '') && p.from <= to ? p.from : S.addDays(to, -29);
    if (from < S.addDays(to, -365)) from = S.addDays(to, -365);
    return { from: from, to: to };
  }
  function listOf(v) {
    var seen = {};
    return (Array.isArray(v) ? v : []).filter(function (x) { var ok = typeof x === 'string' && x !== '' && !seen[x]; seen[x] = 1; return ok; }).slice(0, MAX);
  }
  function byPiecesDesc(a, b) { return b.pieces - a.pieces || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0); }

  var api = {
    srWatch: function (p, me, env) {
      var r = S.loc(p, me, env); if (r.err) return r.err;
      var loc = r.loc, depId = '';
      if (p.departmentId != null && p.departmentId !== '') {
        if (!has(env.ix.dep, p.departmentId) || env.ix.dep[p.departmentId].locationId !== loc.id) return C.fail('not_found', 'Такого відділу в цій локації немає.');
        depId = p.departmentId;
      }
      var st = p.stars && typeof p.stars === 'object' ? p.stars : {};
      var rg = range(p, env), list = S.audits(env, loc.id, rg.from, rg.to);
      var deptTypes = {};
      env.db.departments.forEach(function (d) { if (d.locationId === loc.id) deptTypes[d.deptTypeId] = 1; });

      var types = {};
      listOf(st.type).forEach(function (id) {
        var t = has(env.ix.def, id) ? env.ix.def[id] : null;
        if (t && deptTypes[t.deptTypeId]) types[id] = { id: id, name: t.name, level: lvOf(env, id), pieces: 0 };
      });
      var workers = {};
      listOf(st.worker).forEach(function (entry) {
        var cut = entry.indexOf(':'), scoped = cut > 0 && has(env.ix.loc, entry.slice(0, cut));
        if (scoped && entry.slice(0, cut) !== loc.id) return;   // зірочка працівника з іншої локації — тут не показуємо
        var code = scoped ? entry.slice(cut + 1) : entry;
        var w = env.ix.worker[loc.id + ':' + code];
        if (w && (!depId || w.departmentId === depId)) workers[code] = { code: code, name: w.name, pieces: 0, checked: 0 };
      });
      var known = {};
      Object.keys(env.ix.prod).forEach(function (id) { known[env.ix.prod[id].name] = 1; });
      var products = {};
      listOf(st.product).forEach(function (name) { if (has(known, name)) products[name] = { name: name, pieces: 0, checked: 0 }; });

      list.forEach(function (a) {
        a.defects.forEach(function (d) {
          if (depId && S.sourceDept(a, d) !== depId) return;
          var q = S.pieces(d), pn = nm(env.ix.prod, d.productId, 'Невідомий виріб');
          if (has(types, d.defectTypeId)) types[d.defectTypeId].pieces += q;
          if (has(products, pn)) products[pn].pieces += q;
        });
        Object.keys(workers).forEach(function (code) {
          a.defects.forEach(function (d) { d.guilty.forEach(function (g) { if (g.workerCode === code && g.qty) workers[code].pieces += g.qty; }); });
          if (a.checkedWorkers.indexOf(code) >= 0) workers[code].checked += C.checkedOf(a) / a.checkedWorkers.length;
        });
        if (!depId || a.departmentId === depId) {
          a.items.forEach(function (i) { var pn = nm(env.ix.prod, i.productId, 'Невідомий виріб'); if (has(products, pn)) products[pn].checked += i.qty; });
        }
      });

      var orders = {}, wanted = {};
      listOf(st.order).forEach(function (no) { wanted[no] = 1; });
      env.db.orders.forEach(function (o) { if (o.locationId === loc.id && has(wanted, o.no)) orders[o.no] = { no: o.no, checked: 0, pieces: 0 }; });
      if (Object.keys(orders).length) {
        S.audits(env, loc.id).forEach(function (a) {
          a.orders.forEach(function (no, k) {
            if (!has(orders, no) || a.orders.indexOf(no) !== k) return;   // замовлення двічі в одному аудиті — рахуємо раз
            if (!depId || a.departmentId === depId) a.items.forEach(function (i) { if (i.orderNo === no) orders[no].checked += i.qty; });
            a.defects.forEach(function (d) {
              if (d.orderNo !== no || (depId && S.sourceDept(a, d) !== depId)) return;
              orders[no].pieces += S.pieces(d);
            });
          });
        });
      }

      function arr(o) { return Object.keys(o).map(function (k) { return o[k]; }); }
      return { ok: true, from: rg.from, to: rg.to,
        types: arr(types).sort(byPiecesDesc),
        workers: arr(workers).map(function (w) { w.checked = Math.round(w.checked); return w; }).sort(byPiecesDesc),
        products: arr(products).sort(byPiecesDesc),
        orders: arr(orders).sort(function (a, b) { return b.checked - a.checked || (a.no < b.no ? -1 : 1); }) };
    }
  };

  P.demoApis.push(api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
