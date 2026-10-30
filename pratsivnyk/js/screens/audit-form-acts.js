(function (root) {
  'use strict';
  var AF = root.P.AF, P = root.P, C = AF.core, S = C.S;
  var NONE = C.NONE, UNKNOWN_OPT = C.UNKNOWN_OPT, WORKER_PH = C.WORKER_PH, newItem = C.newItem, newDefect = C.newDefect, ownGuilty = C.ownGuilty;
  var itemByKey = C.itemByKey, defByKey = C.defByKey, typeFor = C.typeFor, draw = C.draw, paintBrief = C.paintBrief, briefSync = C.briefSync;
  var changed = C.changed, pick = C.pick, ask = C.ask, recentIds = C.recentIds, withRecent = C.withRecent;
  var pickProduct = C.pickProduct, depName = C.depName, workerOptions = C.workerOptions, setWorkers = C.setWorkers;
  var quickAdd = C.quickAdd, createChecked = C.createChecked, submit = C.submit;

  var ACT = C.ACT = {
    dept: function (t) {
      var v = t.getAttribute('data-v');
      if (v === S.F.departmentId) return;
      if (S.F.editId && !AF.moved(S.F)) return P.toast('warn', 'Відділ змінити не можна', 'Запишіть новий аудит в іншому відділі.');
      var dirty = S.F.items.some(function (i) { return i.productId; }) || S.F.workers.length || S.F.defects.length;
      var go = function () { S.F.departmentId = v; S.F.items = [newItem()]; S.F.workers = []; S.F.helpers = []; S.F.defects = []; S.F.mode = null; changed(true); };
      if (!dirty || !S.F.departmentId) return go();
      ask({ title: 'Змінити відділ?', text: 'Вироби, працівники й брак цього аудиту буде очищено.', okLabel: 'Змінити' }, go);
    },
    'order-add': function () {
      var used = S.F.orders, opts = [];
      S.F.ctx.orderBlocks.forEach(function (b) { if (used.indexOf(b.name) < 0) opts.push({ value: b.name, title: b.name, list: b.orders, group: 'Блоки замовлень' }); });
      S.F.ctx.orders.forEach(function (o) { if (used.indexOf(o.no) < 0) opts.push({ value: o.no, title: o.no, group: 'Замовлення' }); });
      pick({ title: 'Замовлення', cols: 2, options: withRecent(opts, recentIds(S.F.departmentId, 'orders')), placeholder: 'Номер замовлення або блоку', emptyText: 'Замовлень поки немає' }, function (v) {
        if (S.F.orders.length >= S.F.ctx.limits.maxOrders || S.F.orders.indexOf(v) >= 0) return;
        S.F.orders.push(v);
        if (S.F.orders.length === 1) S.F.items.forEach(function (i) { if (!i.orderNo) i.orderNo = v; });
        changed(true);
      });
    },
    'order-del': function (t) {
      var v = t.getAttribute('data-v');
      S.F.orders = S.F.orders.filter(function (o) { return o !== v; });
      S.F.items.forEach(function (i) { if (i.orderNo === v || S.F.orders.length === 0) i.orderNo = S.F.orders.length === 1 ? S.F.orders[0] : null; });
      changed(true);
    },
    'item-add': function () { var it = newItem(); S.F.items.push(it); changed(true); pickProduct(it); },
    'item-product': function (t) { var it = itemByKey(t.getAttribute('data-k')); if (it) pickProduct(it); },
    'item-order': function (t) {
      var it = itemByKey(t.getAttribute('data-k'));
      if (it) pick({ title: 'Замовлення виробу', value: it.orderNo, options: S.F.orders.map(function (o) { return { value: o, title: o }; }) },
        function (v) { it.orderNo = v; changed(true); });
    },
    'item-del': function (t) {
      var k = t.getAttribute('data-k'), linked = S.F.defects.some(function (d) { return d.itemKey === k; });
      var go = function () { S.F.items = S.F.items.filter(function (i) { return i.key !== k; }); S.F.defects = S.F.defects.filter(function (d) { return d.itemKey !== k; }); changed(true); };
      if (!linked) return go();
      ask({ title: 'Прибрати виріб?', text: 'Брак, записаний на цей виріб, теж буде прибрано.', okLabel: 'Прибрати', danger: true }, go);
    },
    'worker-add': function () {
      var dn = depName(S.F.departmentId);
      pick({ title: 'Перевірені працівники', multi: true, search: true, cols: 2, values: S.F.workers.map(function (c) { return c === '' ? NONE : c; }), placeholder: WORKER_PH,
        emptyText: 'У відділі ще немає працівників', hint: S.F.ctx.canAddWorker ? 'Немає в списку — впишіть у пошук і додайте.' : '',
        create: !S.F.ctx.canAddWorker ? null : [{ id: 'own', label: function (q) { return 'Додати «' + q + '» у відділ «' + dn + '»'; } },
          { id: 'help', label: function (q) { return 'Додати «' + q + '» — допомога з іншого відділу'; } }],
        options: workerOptions() },
        function (v) {
          var made = v && v.create ? v : null;
          setWorkers((made ? made.picked : v).map(function (c) { return c === NONE ? '' : c; }));
          changed(true);
          if (made) createChecked(made.q, made.create === 'help');
        });
    },
    'worker-help': function (t) {
      var c = t.getAttribute('data-v'), i = S.F.helpers.indexOf(c);
      if (t.checked && i < 0) S.F.helpers.push(c);
      if (!t.checked && i >= 0) S.F.helpers.splice(i, 1);
      changed(true);   // перемальовуємо все: підпис «· допомога» є ще й біля винного в картці браку
    },
    'worker-del': function (t) {
      var c = t.getAttribute('data-v');
      S.F.workers = S.F.workers.filter(function (x) { return x !== c; });
      S.F.helpers = S.F.helpers.filter(function (x) { return x !== c; });
      S.F.defects.forEach(function (d) { if (!d.other && c) d.guilty = d.guilty.filter(function (g) { return g.workerCode !== c; }); });
      changed(true);
    },
    mode: function (t) {
      S.F.mode = t.getAttribute('data-v');
      if (S.F.mode === 'defects' && !S.F.defects.length) S.F.defects.push(newDefect());
      changed(true);
    },
    'def-add': function () { S.F.defects.push(newDefect()); changed(true); },
    'def-del': function (t) { var k = t.getAttribute('data-k'); S.F.defects = S.F.defects.filter(function (d) { return d.key !== k; }); changed(true); },
    'def-owner': function (t) {
      var d = defByKey(t.getAttribute('data-k')), other = t.getAttribute('data-v') === 'other';
      if (!d || d.other === other) return;
      d.other = other; d.departmentId = null; d.defectTypeId = null;
      d.guilty = other ? [{ workerCode: '', qty: d.guilty[0] ? d.guilty[0].qty : '' }] : ownGuilty();
      changed(true);
      if (other) ACT['def-dept'](t);
    },
    'def-dept': function (t) {
      var d = defByKey(t.getAttribute('data-k'));
      if (!d) return;
      pick({ title: 'Звідки брак', value: d.departmentId,
        options: S.F.ctx.departments.filter(function (x) { return x.id !== S.F.departmentId; }).map(function (x) { return { value: x.id, title: x.name }; }) },
        function (v) {
          if (v === d.departmentId) return;
          d.departmentId = v; d.defectTypeId = null;
          d.guilty.forEach(function (g) { var w = AF.worker(S.F, g.workerCode); if (g.workerCode && (!w || w.departmentId !== v)) g.workerCode = ''; });
          changed(true);
        });
    },
    'def-item': function (t) {
      var d = defByKey(t.getAttribute('data-k')), ready = S.F.items.filter(function (i) { return i.productId; });
      if (!d) return;
      if (!ready.length) return P.toast('warn', 'Спершу додайте перевірений виріб');
      pick({ title: 'На якому виробі брак', value: d.itemKey, options: ready.map(function (i) { return { value: i.key, title: AF.itemLabel(S.F, i), meta: 'перевірено ' + (i.qty || '?') + ' шт' }; }) },
        function (v) { d.itemKey = v; changed(true); });
    },
    'def-type': function (t) {
      var d = defByKey(t.getAttribute('data-k'));
      if (!d) return;
      if (d.other && !d.departmentId) return P.toast('warn', 'Спершу оберіть, звідки брак');
      var dt = typeFor(d);
      pick({ title: 'Вид браку', value: d.defectTypeId, placeholder: 'Пошук виду браку',
        emptyText: 'Немає видів браку для цього відділу. Попросіть старшого аудитора додати.',
        options: S.F.ctx.defectTypes.filter(function (x) { return x.deptTypeId === dt; }).map(function (x) { return { value: x.id, title: x.name, meta: AF.lvlLabel(x.level), tone: x.level || 'fix' }; }) },
        function (v) { d.defectTypeId = v; changed(true); });
    },
    'def-worker': function (t) {
      var d = defByKey(t.getAttribute('data-k')), g = d && d.guilty[Number(t.getAttribute('data-j'))];
      if (!g || !d.other) return;
      if (!d.departmentId) return P.toast('warn', 'Спершу оберіть, звідки брак');
      var src = d.departmentId, sn = depName(src);
      pick({ title: 'Винний', search: true, cols: 2, value: g.workerCode || NONE, placeholder: WORKER_PH, hint: S.F.ctx.canAddWorker ? 'Немає в списку — впишіть у пошук і додайте.' : '',
        create: !S.F.ctx.canAddWorker ? null : [{ id: 'own', label: function (q) { return 'Додати «' + q + '» у відділ «' + sn + '»'; } }],
        options: withRecent([UNKNOWN_OPT].concat(S.F.ctx.workers.filter(function (w) { return w.departmentId === src; })
          .map(function (w) { return { value: w.code, title: w.name }; })),
          recentIds(S.F.departmentId, 'workers').concat(recentIds(src, 'workers')), 'Усі працівники') },
        function (v) {
          if (v && v.create) return quickAdd(v.q, src).then(function (w) {
            if (!w) return;
            if (w.departmentId !== src) return P.toast('warn', 'Працівник «' + w.name + '» — з відділу «' + depName(w.departmentId) + '»', 'Брак записано на відділ «' + sn + '».');
            g.workerCode = w.code; changed(true);
          });
          g.workerCode = v === NONE ? '' : v; changed(true);
        });
    },
    'g-pick': function (t) {
      var d = defByKey(t.getAttribute('data-k')), c = t.getAttribute('data-v');
      if (!d || d.other) return;
      if (c === NONE) c = '';
      var at = -1;
      d.guilty.forEach(function (g, j) { if (g.workerCode === c) at = j; });
      if (at >= 0) { d.guilty.splice(at, 1); return changed(true); }
      if (d.guilty.length >= S.F.ctx.limits.maxGuiltyPerDefect) return P.toast('warn', 'Не більше ' + S.F.ctx.limits.maxGuiltyPerDefect + ' винних на один вид браку');
      d.guilty.push({ workerCode: c, qty: '' });
      changed(true);
      var inp = S.el.querySelector('[data-in="gqty"][data-k="' + d.key + '"][data-j="' + (d.guilty.length - 1) + '"]');
      if (inp) inp.focus();
    },
    'brief-retry': function () { AF.briefRetry(S.F); paintBrief(); briefSync(); },
    'g-add': function (t) { var d = defByKey(t.getAttribute('data-k')); if (d && d.other) { d.guilty.push({ workerCode: '', qty: '' }); changed(true); } },
    'g-del': function (t) { var d = defByKey(t.getAttribute('data-k')); if (d && d.guilty.length > 1) { d.guilty.splice(Number(t.getAttribute('data-j')), 1); changed(true); } },
    'draft-continue': function () {
      if (AF.draft.locOf(S.F.pendingDraft, S.F.home) !== S.F.loc) return P.router.go('/audit/new', { draft: '1', n: Date.now() });
      AF.restore(S.F, S.F.pendingDraft, newItem); S.F.pendingDraft = null; S.F.lockDraft = false; draw();
    },
    'draft-new': function () { AF.draft.del(S.F.uid, S.F.home); S.F.pendingDraft = null; S.F.lockDraft = false; draw(); },
    save: function () { submit(); },
    again: function () { P.router.go('/audit/new', { loc: S.F.loc, dep: S.F.departmentId, n: Date.now() }); },
    view: function () { P.router.go('/audit/' + S.F.done.auditId); },
    home: function () { P.router.go('/home'); }
  };
})(window);
