(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, A = P.adm, H = P.sr.h, da = A.da, q = A.q;
  var ROLE = { auditor: 'Аудитор', senior_auditor: 'Старший аудитор', manager: 'Керівник', admin: 'Адміністратор' };
  var CONFIRM_TEXT = 'Людина більше не зможе увійти й зникне зі списку. Її аудити й дії лишаються в історії. Повернути — додати її знову.';
  var NOTE = 'Налаштовує сам керівник у своєму кабінеті («Мої сповіщення»). Тут — лише перегляд.';

  function rowBtns(u) {
    function btn(act, ic, label) { return '<button class="icon-btn" type="button" data-act="' + act + '"' + da('id', u.id) + ' aria-label="' + esc(label + ' · ' + u.name) + '" title="' + esc(label) + '">' + P.ic(ic) + '</button>'; }
    var gap = '<span class="icon-btn" aria-hidden="true" style="visibility:hidden"></span>';
    return (u.role === 'manager' ? btn('pp-notify', 'notification', 'Сповіщення') : gap) + (u.canDelete && !u.isMe ? btn('pp-del', 'delete', 'Видалити') : gap);
  }
  function fail(r) { if (r && (r.code !== 'forbidden' || P.authSlack.real())) P.toast('danger', 'Не вдалося видалити', (r && r.error) || ''); }
  function confirmDelete(name) { return P.confirm({ title: 'Видалити ' + name + '?', text: CONFIRM_TEXT, okLabel: 'Видалити', danger: true }); }

  function locsText(t, locName) { return t.allLocations ? 'усі локації' : (t.locationIds || []).map(locName).join(', '); }
  function card(items, locName) {
    return '<section class="card adm-flat"><h3 class="h3">Запити на видалення · ' + items.length + '</h3>' +
      '<p class="hint">Керівники просять видалити керівника. Рішення — за вами; видалена людина більше не входить.</p><div class="adm-people">' + items.map(function (x) {
        var t = x.target;
        return '<div class="adm-person"><span class="avatar" aria-hidden="true">' + esc(P.initials(t.name)) + '</span><div class="adm-person__main">' +
          '<div class="adm-person__name"><b>' + esc(t.name) + '</b>' + H.badge(ROLE[t.role] || t.role, '') + '</div>' +
          '<span class="adm-person__meta">' + esc(locsText(t, locName)) + ' · просить: ' + esc(x.askedBy ? x.askedBy.name : '—') + ' · ' + esc(A.ago(x.createdAt)) + '</span>' +
          '<span class="adm-person__meta">Причина: ' + esc(x.reason) + '</span></div>' +
          '<div class="adm-person__acts"><button class="btn btn--danger btn--sm" type="button" data-act="dr-done"' + da('id', x.id) + '>Видалити</button>' +
          '<button class="btn btn--secondary btn--sm" type="button" data-act="dr-no"' + da('id', x.id) + '>Відхилити</button></div></div>';
      }).join('') + '</div></section>';
  }

  function notifLocs(locs, list) {
    if (locs === 'all' || !Array.isArray(locs)) return 'усі його локації';
    return locs.map(function (id) { var l = list.filter(function (x) { return x.id === id; })[0]; return l ? l.name : id; }).join(', ');
  }
  function notifyBody(r) {
    if (!r || !r.ok) return '<p class="hint">' + esc(P.authSlack.notReady(r) ? 'Сповіщення керівника на справжньому сервері ще не підключено.' : (r && r.error) || 'Не вдалося отримати сповіщення.') + '</p>';
    var locs = r.locations || [], rules = r.rules || [];
    function line(title, on, where) { return '<li><b>' + esc(title) + '</b> — ' + (on ? 'надсилається' : 'не надсилається') + ' · ' + esc(where) + '</li>'; }
    var items = [];
    if (r.kdSelf) items.push('<li><b>Коригуючу дію закрито без участі старшого</b> — ' + (r.kdSelf.enabled ? 'увімкнено' : 'вимкнено') + ' · ' + esc(notifLocs(r.kdSelf.locs, locs)) + '</li>');
    rules.forEach(function (x) { items.push(line(x.title, x.enabled && x.ruleOn !== false, notifLocs(x.locs, locs))); });
    return '<ul class="adm-notif" style="margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px">' + items.join('') + '</ul>' +
      (items.length ? '' : '<p class="hint">Для цього керівника поки немає сповіщень.</p>') + '<p class="hint">' + esc(NOTE) + '</p>';
  }

  function bind(ctx, o) {
    var reqs = [];
    function show() { var b = q(ctx.el, '[data-pp-reqs]'); if (!b) return; b.innerHTML = reqs.length ? card(reqs, o.locName) : ''; b.hidden = !reqs.length; }
    function refresh() {
      return Promise.resolve(P.authSlack.deleteList()).then(function (r) { if (!ctx.alive()) return; reqs = r && r.ok ? r.items || [] : []; show(); });
    }
    function done() { if (!ctx.alive()) return; o.reload(); refresh(); }
    ctx.on('pp-del', function (t) {
      var u = o.find(t.getAttribute('data-id'));
      if (!u) return;
      confirmDelete(u.name).then(function (ok) {
        if (!ok) return;
        t.disabled = true;
        P.authSlack.deletePerson(u.id).then(function (r) {
          t.disabled = false;
          if (r && r.ok) P.toast('ok', 'Видалено · ' + u.name, ''); else fail(r);
          done();
        });
      });
    });
    ctx.on('dr-done', function (t) {
      var x = reqs.filter(function (y) { return String(y.id) === t.getAttribute('data-id'); })[0];
      if (!x) return;
      confirmDelete(x.target.name).then(function (ok) {
        if (!ok) return;
        P.authSlack.deleteResolve(x.id, 'done').then(function (r) { if (r && r.ok) P.toast('ok', 'Видалено · ' + x.target.name, ''); else fail(r); done(); });
      });
    });
    ctx.on('dr-no', function (t) {
      var x = reqs.filter(function (y) { return String(y.id) === t.getAttribute('data-id'); })[0];
      if (!x) return;
      P.authSlack.deleteResolve(x.id, 'rejected').then(function (r) { if (r && r.ok) P.toast('ok', 'Запит відхилено · ' + x.target.name, 'Людина лишається в списку.'); else fail(r); done(); });
    });
    ctx.on('pp-notify', function (t) {
      var u = o.find(t.getAttribute('data-id'));
      if (!u) return;
      Promise.resolve(P.srv('admNotifyOf', { id: u.id })).then(function (r) {
        if (!ctx.alive()) return;
        A.modal({ size: 'sm', title: 'Сповіщення · ' + u.name, sub: 'лише перегляд', body: notifyBody(r), foot: A.cancelBtn().replace('Скасувати', 'Закрити') });
      });
    });
    return { slot: function () { return '<div data-pp-reqs hidden></div>'; }, show: show, refresh: refresh };
  }

  P.admPeopleDel = { rowBtns: rowBtns, bind: bind, notifyBody: notifyBody, CONFIRM_TEXT: CONFIRM_TEXT };
})(window);
