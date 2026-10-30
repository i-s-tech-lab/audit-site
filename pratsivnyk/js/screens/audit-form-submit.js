(function (root) {
  'use strict';
  var AF = root.P.AF, P = root.P, C = AF.core, S = C.S;
  var MSG_QTY = C.MSG_QTY, itemByKey = C.itemByKey, active = C.active, draw = C.draw, drawSummary = C.drawSummary;

  function clientCheck() {
    var e = {}, lim = S.F.ctx.limits;
    if (!S.F.departmentId) e.departmentId = 'Оберіть відділ.';
    S.F.items.forEach(function (it, i) {
      if (!it.productId) e['items[' + i + '].productId'] = 'Оберіть виріб.';
      var q = Number(it.qty);
      if (!/^\d+$/.test(String(it.qty)) || q < 1 || q > lim.maxQty) e['items[' + i + '].qty'] = MSG_QTY;
    });
    if (!S.F.items.length) e.items = 'Вкажіть хоча б один перевірений виріб і скільки штук перевірено.';
    if (!S.F.mode) e.mode = 'Позначте: без браку чи є брак.';
    if (S.F.mode === 'defects') {
      if (!S.F.defects.length) e.defects = 'Додайте хоча б один вид браку або позначте «Без браку».';
      S.F.defects.forEach(function (d, i) {
        var pre = 'defects[' + i + ']';
        if (!d.itemKey || !itemByKey(d.itemKey)) e[pre + '.productId'] = 'Оберіть виріб.';
        if (d.other && !d.departmentId) e[pre + '.departmentId'] = 'Оберіть відділ, звідки брак.';
        if (!d.defectTypeId) e[pre + '.defectTypeId'] = 'Оберіть вид браку зі списку. Немає потрібного — попросіть старшого аудитора додати його на сайті.';
        if (!d.guilty.length) e[pre + '.guilty'] = 'Позначте, хто винний, або «Невідомий працівник».';
        d.guilty.forEach(function (g, j) {
          if (g.workerCode == null) e[pre + '.guilty[' + j + ']'] = 'Оберіть винного або «Невідомий працівник».';
          if (!/^\d+$/.test(String(g.qty)) || Number(g.qty) < 1) e[pre + '.guilty[' + j + '].qty'] = MSG_QTY;
        });
      });
    }
    return e;
  }
  function payload() {
    var p = {
      clientId: S.F.clientId, locationId: S.F.loc, departmentId: S.F.departmentId, orders: S.F.orders.slice(),
      items: S.F.items.map(function (it) {
        return { productId: it.productId, orderNo: it.orderNo || null, qty: Number(it.qty), rejected: it.rejected === '' ? null : Number(it.rejected) };
      }),
      checkedWorkers: S.F.workers.slice(), helpers: S.F.workers.filter(function (c) { return AF.isHelper(S.F, c); }),
      comment: S.F.comment.trim(), noDefects: S.F.mode === 'none',
      defects: S.F.mode !== 'defects' ? [] : S.F.defects.map(function (d) {
        var it = itemByKey(d.itemKey) || {};
        return { productId: it.productId || null, orderNo: it.orderNo || null, defectTypeId: d.defectTypeId,
          departmentId: d.other ? d.departmentId : null, photos: (d.photos || []).slice(0, AF.PHOTO_MAX),
          guilty: d.guilty.map(function (g) { return { workerCode: g.workerCode, qty: Number(g.qty) }; }) };
      })
    };
    if (S.F.editId) p.id = S.F.editId;
    return p;
  }
  function showErrors(map, text) {
    S.F.errors = map; draw();
    var bad = S.el.querySelector('.form-sec.is-invalid');
    if (bad) bad.scrollIntoView({ behavior: 'smooth', block: 'start' });
    P.toast('warn', 'Перевірте позначені поля', text || '');
  }
  function queue(form, sent, key) {
    var t = AF.totals(form), dep = AF.dept(form, form.departmentId);
    var q = P.offline.enqueue(form.uid, sent, (dep ? dep.name : '') + ' · перевірено ' + t.checked + ' шт · брак ' + t.rejected + ' шт');
    form.saving = false;
    if (!q.ok) {
      if (active(form)) drawSummary();
      return P.toast('danger', 'Не вдалося зберегти на телефоні', 'Памʼять телефона заповнена. Чернетку збережено — запишіть аудит, коли зʼявиться звʼязок.');
    }
    form.done = { queued: true, photosDropped: q.photosDropped };
    if (!form.lockDraft) P.store.del(key);
    P.toast('ok', 'Збережено на телефоні', 'Надішлеться саме, щойно зʼявиться звʼязок.' + (q.photosDropped ? ' Фото не вмістились у памʼять — аудит без фото.' : ''));
    if (active(form)) { draw(); root.scrollTo(0, 0); }
  }
  function submit() {
    var e = clientCheck();
    if (Object.keys(e).length) return showErrors(e);
    var form = S.F, key = AF.draft.key(S.F.uid, S.F.home), editing = !!S.F.editId, off = !!(P.offline && P.offline.isOff());
    if (off && editing) return P.toast('warn', 'Немає звʼязку', 'Зміни ще не збережено. Натисніть «Зберегти зміни», щойно звʼязок повернеться.');
    S.F.saving = true; drawSummary();
    var sent = payload();
    if (off) return queue(form, sent, key);
    P.srv(editing ? 'auditUpdate' : 'auditSubmit', sent).then(function (r) {
      form.saving = false;
      if (!r.ok && r.code === 'offline' && !editing && P.offline) return queue(form, sent, key);
      if (r.ok) {
        form.done = r;   // відкладений запис чернетки цієї форми тепер нічого не запише
        if (!form.lockDraft && !editing) P.store.del(key);
        P.toast('ok', editing ? 'Аудит виправлено' : 'Аудит записано', r.auditId);
        if (r.photosDropped) P.toast('warn', 'Фото не збережено', 'Памʼять телефона заповнена — аудит записано без фото.');
        if (P.embed && root.parent && root.parent !== root) {
          var chk = sent.items.reduce(function (s, i) { return s + (Number(i.qty) || 0); }, 0);
          var bad = sent.defects.reduce(function (s, d) { return s + d.guilty.reduce(function (a, g) { return a + (Number(g.qty) || 0); }, 0); }, 0);
          root.parent.postMessage({ type: 'audit:saved', id: r.auditId, edited: editing, time: P.fmt.time(r.createdAt || new Date().toISOString()),
            summary: 'перевірено ' + chk + ' шт · брак ' + bad + ' шт' }, root.location.origin);
        }
        if (active(form)) { draw(); root.scrollTo(0, 0); }   // якщо вже пішли з екрана — лише повідомлення
        return;
      }
      if (!active(form)) return;
      if (r.code === 'validation') {
        var map = {};
        (r.errors || []).forEach(function (x) { if (!map[x.field]) map[x.field] = x.message; });
        return showErrors(map, (r.errors && r.errors.length > 1) ? 'Помилок: ' + r.errors.length : '');
      }
      drawSummary();
      if (r.code !== 'forbidden') P.toast('danger', editing ? 'Не вдалося виправити аудит' : 'Не вдалося записати аудит', (r.error || '') + (editing ? '' : ' Чернетку збережено — спробуйте ще раз.'));
    });
  }
  C.submit = submit;
})(window);
