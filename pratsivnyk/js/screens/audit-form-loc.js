(function (root) {
  'use strict';
  var AF = root.P.AF, P = root.P, C = AF.core, S = C.S;
  var pick = C.pick, ask = C.ask, active = C.active, draw = C.draw, blank = C.blank;

  function dirty() {
    return !!(S.F.departmentId || S.F.orders.length || S.F.workers.length || S.F.defects.length || S.F.comment.trim() ||
      S.F.items.some(function (i) { return i.productId || i.qty || i.rejected; }));
  }
  function locHead() {
    var sub = root.document.getElementById('top-sub');
    if (!sub || !S.F) return;
    sub.hidden = false;
    if (S.F.done) { sub.textContent = S.F.ctx.location.name; return; }   // аудит записано — локація вже лише підпис
    sub.innerHTML = '<button type="button" class="top-loc" aria-haspopup="dialog" aria-label="Локація: ' + P.esc(S.F.ctx.location.name) + '. Змінити">' +
      '<span class="top-loc__name">' + P.esc(S.F.ctx.location.name) + '</span>' + P.ic('chevron-down', 'ui-icon--sm') + '</button>' +
      (S.F.editId ? '<span class="top-loc__id">' + P.esc(S.F.editId) + '</span>' : '');   // у «Виправити» — і номер аудиту, як було
    sub.firstChild.onclick = function () { if (S.F && !S.F.done && !S.F.saving) pickLoc(); };
  }
  function pickLoc() {
    var list = S.F.ctx.locations || [S.F.ctx.location];
    pick({ title: 'Локація аудиту', value: S.F.loc, options: list.map(function (l) { return { value: l.id, title: l.name, meta: l.id === S.F.home ? 'ваша локація' : '' }; }) },
      function (v) {
        if (v === S.F.loc) return;
        var name = (list.filter(function (l) { return l.id === v; })[0] || {}).name || '';
        if (!dirty()) return switchLoc(v);
        ask({ title: 'Змінити локацію на «' + name + '»?', danger: true, okLabel: 'Змінити й очистити',
          text: 'Усе, що ви вже записали в цьому аудиті, зникне: відділ, замовлення, вироби, працівники, брак і коментар. У кожної локації свої відділи й люди.' },
          function () { switchLoc(v); });
      });
  }
  var locSeq = 0;   // номер останнього вибору локації: відповідь на старіший вибір не застосовуємо
  function switchLoc(v) {
    var old = S.F, my = ++locSeq;
    if (old.editId && v === old.editLoc) return P.shell.rerender();
    P.srv('auditFormContext', { locationId: v }).then(function (fc) {
      if (my !== locSeq || !active(old)) return;
      if (!fc.ok) { if (fc.code !== 'forbidden') P.toast('danger', 'Не вдалося відкрити локацію', fc.error || ''); return; }
      var n = blank(old.shell, fc);
      n.editId = old.editId; n.editLoc = old.editLoc; n.lockDraft = old.lockDraft; n.pendingDraft = old.pendingDraft;
      if (old.editId) n.clientId = old.clientId;
      n.items = [{ key: P.uid('it'), productId: null, orderNo: null, qty: '', rejected: '' }];
      S.F = n;
      if (!n.editId && !n.lockDraft) { AF.draft.flush(); AF.draft.del(n.uid, n.home); }   // спершу дописати відкладене, інакше воно поверне стару
      S.F.errors = {}; draw();
      root.scrollTo(0, 0);
      P.toast('ok', 'Локація: ' + fc.location.name, old.editId ? 'Оберіть відділ — аудит переїде сюди, коли збережете зміни.' : 'Оберіть відділ.');
    });
  }
  C.locHead = locHead;
})(window);
