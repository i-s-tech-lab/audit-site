(function (root) {
  'use strict';
  var P = root.P, AF = P.AF = P.AF || {};
  var C = AF.core = {};
  var S = C.S = { F: null, el: null };   // F — поточна форма, el — вузол екрана; змінюються лише в audit-form*.js
  var MSG_QTY = 'Кількість — ціле число від 1 до 100 000.';
  var NONE = '__none';   // пункт «Невідомий працівник» у списках (у даних — порожній код '')
  var UNKNOWN_OPT = { value: NONE, title: 'Невідомий працівник', meta: 'коли не знаєте, хто саме' };
  var WORKER_PH = 'Працівник, наприклад q5';   // підказка пошуку: у цеху людей знають за підписом, не за службовим кодом
  C.MSG_QTY = MSG_QTY; C.NONE = NONE; C.UNKNOWN_OPT = UNKNOWN_OPT; C.WORKER_PH = WORKER_PH;

  function itemByKey(k) { return S.F.items.filter(function (x) { return x.key === k; })[0]; }
  function defByKey(k) { return S.F.defects.filter(function (x) { return x.key === k; })[0]; }
  function newItem() { return { key: P.uid('it'), productId: null, orderNo: S.F && S.F.orders.length === 1 ? S.F.orders[0] : null, qty: '', rejected: '' }; }
  function newDefect() {
    var ready = S.F.items.filter(function (i) { return i.productId; });
    return { key: P.uid('df'), itemKey: ready.length === 1 ? ready[0].key : null, defectTypeId: null, other: false, departmentId: null,
      guilty: ownGuilty(), photos: [] };
  }
  function ownGuilty() { return S.F.workers.length === 1 ? [{ workerCode: S.F.workers[0], qty: '' }] : []; }
  function typeFor(d) { var dep = AF.dept(S.F, d && d.other ? d.departmentId : S.F.departmentId); return dep && dep.deptTypeId; }
  function active(form) { return S.F && S.F === form && S.F.alive && S.F.alive() && S.el && S.el.isConnected; }
  function draw() { S.el.innerHTML = S.F.done ? AF.doneView(S.F, S.F.done) : AF.view(S.F); C.locHead(); briefSync(); }
  function paintBrief() { var host = S.el.querySelector('[data-dept-info]'); if (host) host.outerHTML = AF.briefHtml(S.F); }
  function briefSync() { AF.briefSync(S.F, function (form) { if (active(form)) paintBrief(); }); }
  function drawSummary() { var bar = S.el.querySelector('.action-bar'); if (bar) bar.outerHTML = AF.summaryHtml(S.F); }
  function changed(redraw) { S.F.errors = {}; if (redraw) draw(); else drawSummary(); AF.draft.save(S.F); }
  C.itemByKey = itemByKey; C.defByKey = defByKey; C.newItem = newItem; C.newDefect = newDefect; C.ownGuilty = ownGuilty; C.typeFor = typeFor;
  C.active = active; C.draw = draw; C.paintBrief = paintBrief; C.briefSync = briefSync; C.drawSummary = drawSummary; C.changed = changed;

  function pick(opts, apply) { var form = S.F; return P.picker(opts).then(function (v) { if (v && active(form)) apply(v); }); }
  function ask(o, apply) { var form = S.F; return P.confirm(o).then(function (ok) { if (ok && active(form)) apply(); }); }
  function recentIds(depId, kind) {
    var r = S.F.ctx.recent && S.F.ctx.recent[depId];
    return r && Array.isArray(r[kind]) ? r[kind] : [];
  }
  function withRecent(opts, ids, restGroup) {
    var head = opts.filter(function (o) { return o.value === NONE; }), rest = opts.filter(function (o) { return o.value !== NONE; });
    var recent = [];
    ids.forEach(function (id) {
      var o = rest.filter(function (x) { return x.value === id; })[0];
      if (o && recent.indexOf(o) < 0) recent.push(o);
    });
    return head.concat(recent.map(function (o) { return Object.assign({}, o, { group: 'Нещодавні' }); }),
      rest.filter(function (o) { return recent.indexOf(o) < 0; }).map(function (o) {
        return recent.length && !o.group && restGroup ? Object.assign({}, o, { group: restGroup }) : o;
      }));
  }
  C.pick = pick; C.ask = ask; C.recentIds = recentIds; C.withRecent = withRecent;

  function blank(ctx, fc) {
    return { clientId: P.uid('aud'), uid: ctx.me.id, home: ctx.loc, shell: ctx, loc: fc.location ? fc.location.id : ctx.loc, ctx: fc, alive: ctx.alive, departmentId: null,
      orders: [], items: [], workers: [], helpers: [], comment: '', mode: null, defects: [], errors: {}, saving: false, done: null,
      pendingDraft: null, lockDraft: false, editId: null };
  }
  C.blank = blank;
})(window);
