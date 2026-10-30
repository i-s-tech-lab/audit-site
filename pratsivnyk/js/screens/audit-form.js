(function (root) {
  'use strict';
  var P = root.P, AF = P.AF = P.AF || {}, C = AF.core, S = C.S, ACT = C.ACT;
  var itemByKey = C.itemByKey, defByKey = C.defByKey, newItem = C.newItem, active = C.active, changed = C.changed;
  var blank = C.blank, locHead = C.locHead, briefSync = C.briefSync, dropRepeatQuery = C.dropRepeatQuery, applyRepeat = C.applyRepeat;

  function onInput(e) {
    var t = e.target, kind = t.getAttribute('data-in');
    if (!kind) return;
    if (kind === 'comment') { S.F.comment = t.value; return changed(false); }
    var clean = t.value.replace(/\D+/g, ''), k = t.getAttribute('data-k');
    if (clean !== t.value) t.value = clean;
    if ((kind === 'qty' || kind === 'rejected') && itemByKey(k)) itemByKey(k)[kind] = clean;
    if (kind === 'gqty') { var dd = defByKey(k), gg = dd && dd.guilty[Number(t.getAttribute('data-j'))]; if (gg) gg.qty = clean; }
    changed(false);
  }
  function onPhotoFile(e) {
    var t = e.target;
    if (!t.hasAttribute || !t.hasAttribute('data-photo-in')) return;
    var form = S.F, d = defByKey(t.getAttribute('data-k')), files = Array.prototype.slice.call(t.files || []);
    t.value = '';
    if (!d || !files.length) return;
    d.photoBusy = true; changed(true);
    AF.photoAdd(d, files).then(function (res) {
      d.photoBusy = false;
      if (!active(form)) return;
      changed(true);
      if (res.added) P.toast('ok', res.added > 1 ? 'Фото додано: ' + res.added : 'Фото додано', 'У цьому браку: ' + d.photos.length + ' з ' + AF.PHOTO_MAX);
      if (res.failed) P.toast('warn', 'Фото не вдалося додати', 'Зробіть знімок ще раз або оберіть інше фото.');
      if (res.skipped) P.toast('info', 'До ' + AF.PHOTO_MAX + ' фото на один брак', 'Зайві знімки не додано.');
    });
  }
  function mount(host) {
    S.el = host;
    if (!S.F) return P.delegate(S.el, 'click', '[data-act="retry"]', function () { P.shell.rerender(); });
    P.delegate(S.el, 'click', '[data-a]', function (e, t) {   // галочки теж (data-a на самому полі)
      var a = t.getAttribute('data-a'), fn = ACT[a], ph = AF.photoActs[a];
      if (t.disabled) return;
      if (fn) fn(t); else if (ph) ph(t, S.F, defByKey, changed);
    });
    S.el.addEventListener('input', onInput);
    S.el.addEventListener('change', onPhotoFile);
    locHead();
    briefSync();
  }

  P.screen('/audit/new', {
    focus: true, back: '/home',
    title: function (ctx) { return { title: 'Новий аудит', sub: P.shell.locName(ctx.loc) }; },
    render: function (ctx) {
      AF.draft.flush();   // відкладена чернетка попередньої форми — записати до того, як читаємо памʼять
      var q = ctx.query, saved = AF.draft.fresh(ctx.me.id, ctx.loc);
      var at = q.draft && saved ? AF.draft.locOf(saved, ctx.loc) : (q.loc || ctx.loc);
      return P.srv('auditFormContext', { locationId: at }).then(function (fc) {
        if (!ctx.alive()) return '';   // поки чекали, людина пішла на інший екран — чужий стан не чіпаємо
        if (!fc.ok) { S.F = null; return P.state.error('Не вдалося відкрити форму', fc.error); }
        S.F = blank(ctx, fc);
        var draft = saved;
        if (draft && q.draft) { AF.restore(S.F, draft, newItem); return AF.view(S.F); }
        if (draft) { S.F.pendingDraft = draft; S.F.lockDraft = true; }
        if (q.dep && AF.dept(S.F, q.dep)) S.F.departmentId = q.dep;
        S.F.items = [newItem()];
        if (!q.rep) return AF.view(S.F);
        dropRepeatQuery();
        if (draft) { P.toast('info', 'Спершу вирішіть, що робити з чернеткою', 'Минулий аудит не підставлено.'); return AF.view(S.F); }
        var form = S.F;
        return P.srv('auditGet', { id: q.rep }).then(function (r) {
          if (!ctx.alive() || S.F !== form) return '';
          if (r.ok) { S.F.items = []; applyRepeat(r.audit, q.take); }
          else if (r.code !== 'forbidden') P.toast('warn', 'Не вдалося підставити минулий аудит', r.error || '');
          return AF.view(S.F);
        });
      });
    },
    mount: mount
  });

  P.screen('/audit/:id/edit', {
    focus: true,
    back: function (ctx) { return '/audit/' + ctx.params.id; },
    title: function (ctx) { return { title: 'Виправити аудит', sub: ctx.params.id }; },
    render: function (ctx) {
      AF.draft.flush();
      return P.srv('auditGet', { id: ctx.params.id }).then(function (r) {
        if (!ctx.alive()) return '';
        if (!r.ok) { S.F = null; return r.code === 'not_found' ? P.state.empty('search', 'Аудит не знайдено', '') : P.state.error('Не вдалося відкрити аудит', r.error); }
        var a = r.audit;
        if (!a.canEdit) { S.F = null; return P.state.empty('lock', 'Виправити вже не можна', 'Свій аудит можна виправити лише протягом ' + (a.editWindowMin || 15) + ' хв після запису.'); }
        return P.srv('auditFormContext', { locationId: a.locationId }).then(function (fc) {
          if (!ctx.alive()) return '';
          if (!fc.ok) { S.F = null; return P.state.error('Не вдалося відкрити форму', fc.error); }
          S.F = blank(ctx, fc);
          S.F.lockDraft = true;   // виправлення не пишемо в чернетку
          S.F.editLoc = a.locationId;   // де аудит записано: інша локація = перенесення (тоді й відділ новий)
          AF.fromAudit(S.F, a);
          if (!S.F.items.length) S.F.items = [newItem()];
          return AF.view(S.F);
        });
      });
    },
    mount: mount
  });
})(window);
