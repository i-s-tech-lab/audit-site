(function (root) {
  'use strict';
  var AF = root.P.AF, P = root.P, C = AF.core, S = C.S;
  var NONE = C.NONE, UNKNOWN_OPT = C.UNKNOWN_OPT, typeFor = C.typeFor, pick = C.pick, active = C.active, changed = C.changed;
  var recentIds = C.recentIds, withRecent = C.withRecent;

  function pickProduct(it) {
    var t = typeFor(null);
    if (!t) return P.toast('warn', 'Спершу оберіть відділ');
    return pick({ title: 'Виріб', value: it.productId, placeholder: 'Пошук виробу',
      options: withRecent(S.F.ctx.products.filter(function (p) { return p.deptTypeId === t; }).map(function (p) { return { value: p.id, title: p.name }; }),
        recentIds(S.F.departmentId, 'products'), 'Усі вироби') },
      function (v) { it.productId = v; changed(true); });
  }
  function depName(id) { var d = AF.dept(S.F, id); return d ? d.name : ''; }
  function workerOptions() {
    var own = [], other = [];
    S.F.ctx.workers.forEach(function (w) {
      if (w.departmentId === S.F.departmentId) own.push({ value: w.code, title: w.name, group: depName(S.F.departmentId) });
      else if (depName(w.departmentId)) other.push({ value: w.code, title: w.name, meta: depName(w.departmentId), group: 'Інші відділи — допомога' });
    });
    other.sort(function (a, b) { return a.meta < b.meta ? -1 : a.meta > b.meta ? 1 : 0; });
    return withRecent([UNKNOWN_OPT].concat(own, other), recentIds(S.F.departmentId, 'workers'));
  }
  function setWorkers(v) {
    S.F.workers = v;
    S.F.helpers = S.F.helpers.filter(function (c) { return v.indexOf(c) >= 0; });
    S.F.defects.forEach(function (d) { if (!d.other) d.guilty = d.guilty.filter(function (g) { return g.workerCode === '' || v.indexOf(g.workerCode) >= 0; }); });
  }
  function quickAdd(name, departmentId) {
    var form = S.F;
    return P.srv('workerQuickAdd', { locationId: S.F.loc, departmentId: departmentId, name: name }).then(function (r) {
      if (!active(form)) return null;
      if (!r.ok) {
        if (r.code !== 'forbidden') P.toast('danger', 'Не вдалося додати працівника', (r.errors && r.errors[0] ? r.errors[0].message : r.error) || '');
        return null;
      }
      var w = r.worker;
      if (!AF.worker(form, w.code)) form.ctx.workers.push({ code: w.code, name: w.name, departmentId: w.departmentId });
      P.toast('ok', r.existed ? 'Такий працівник уже є · ' + w.name : 'Працівника додано · ' + w.name, depName(w.departmentId));
      return w;
    });
  }
  function createChecked(name, help) {
    var add = function (departmentId) {
      quickAdd(name, departmentId).then(function (w) {
        if (!w) return;
        if (S.F.workers.indexOf(w.code) < 0) S.F.workers.push(w.code);
        changed(true);
      });
    };
    if (!help) return add(S.F.departmentId);
    pick({ title: 'З якого відділу «' + name + '»', options: S.F.ctx.departments.filter(function (x) { return x.id !== S.F.departmentId; }).map(function (x) { return { value: x.id, title: x.name }; }),
      emptyText: 'У локації немає інших відділів' }, add);
  }
  C.pickProduct = pickProduct; C.depName = depName; C.workerOptions = workerOptions; C.setWorkers = setWorkers;
  C.quickAdd = quickAdd; C.createChecked = createChecked;
})(window);
