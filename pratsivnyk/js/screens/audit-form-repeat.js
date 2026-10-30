(function (root) {
  'use strict';
  var AF = root.P.AF, P = root.P, C = AF.core, S = C.S;
  var newItem = C.newItem;

  function dropRepeatQuery() {
    var h = root.location.hash, i = h.indexOf('?');
    if (!root.history || !root.history.replaceState || i < 0) return;
    var rest = h.slice(i + 1).split('&').filter(function (kv) { return kv && !/^(rep|take)=/.test(kv); });
    root.history.replaceState(null, '', root.location.pathname + root.location.search + h.slice(0, i) + (rest.length ? '?' + rest.join('&') : ''));
  }
  function applyRepeat(a, take) {
    var want = String(take || '').split(',');
    if (want.indexOf('d') >= 0 && AF.dept(S.F, a.departmentId)) S.F.departmentId = a.departmentId;
    if (want.indexOf('o') >= 0) {
      var known = {};
      S.F.ctx.orders.forEach(function (o) { known[o.no] = true; });
      (a.orders || []).forEach(function (o) {
        if (known[o] && S.F.orders.indexOf(o) < 0 && S.F.orders.length < S.F.ctx.limits.maxOrders) S.F.orders.push(o);
      });
    }
    var dep = AF.dept(S.F, S.F.departmentId);
    if (want.indexOf('p') >= 0 && dep) {
      (a.items || []).forEach(function (it) {
        var p = AF.product(S.F, it.productId);
        if (!p || p.deptTypeId !== dep.deptTypeId || S.F.items.length >= S.F.ctx.limits.maxProducts) return;
        S.F.items.push({ key: P.uid('it'), productId: p.id, qty: '', rejected: '',
          orderNo: it.orderNo && S.F.orders.indexOf(it.orderNo) >= 0 ? it.orderNo : (S.F.orders.length === 1 ? S.F.orders[0] : null) });
      });
    }
    if (!S.F.items.length) S.F.items = [newItem()];
  }
  C.dropRepeatQuery = dropRepeatQuery; C.applyRepeat = applyRepeat;
})(window);
