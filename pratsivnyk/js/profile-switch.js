(function (root) {
  'use strict';
  var P = root.P, esc = P.esc;

  var PROFILES = [
    { role: 'auditor', label: 'Аудитор', sub: 'Запис аудитів · вигляд для телефона', path: '../pratsivnyk/', ic: 'audit', loc: true },
    { role: 'senior_auditor', label: 'Старший аудитор', sub: 'Аналітика, коригуючі дії, керування', path: '../starshyi/', ic: 'chart', loc: true },
    { role: 'manager', label: 'Керівник', sub: 'Усі локації · статистика, відділи, звіт за місяць', path: '../kerivnyk/', ic: 'cockpit' },
    { role: 'admin', label: 'Адміністратор', sub: 'Усі локації · люди й доступи, правила, розсилки', path: '../admin/', ic: 'key' }
  ];
  function byRole(role) { return PROFILES.filter(function (p) { return p.role === role; })[0] || null; }
  var RANK = { auditor: 1, senior_auditor: 2, manager: 3, admin: 4 };
  function ownRole(me) { return me.admin ? 'admin' : me.ownRole || me.role; }
  function allowed(me) { var r = RANK[ownRole(me)] || 0; return PROFILES.filter(function (p) { return RANK[p.role] <= r; }); }

  function html(me) {
    if (!me) return '';
    var list = allowed(me);
    if (list.length < 2) return '';   // аудитор: профілів нижче немає
    var locs = me.allLocations || me.locations || [], cur = me.viewLocationId || me.defaultLocationId;
    var hint = me.admin ? 'Ви адміністратор — можете відкрити додаток так, як його бачить кожен.'
      : 'Можна працювати в профілі нижче під своїм іменем — наприклад, записувати аудити як аудитор. Повернутись — тут же.';
    return '<section class="ps" aria-label="Перемкнути профіль"><p class="ps__title">Перемкнути профіль</p>' +
      '<p class="ps__hint">' + esc(hint) + '</p>' +
      (locs.length > 1 ? '<label class="ps__loc"><span>Локація — для аудитора й старшого</span><select data-ps-loc data-prev="' + esc(cur) + '">' +
        locs.map(function (l) { return '<option value="' + esc(l.id) + '"' + (l.id === cur ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') +
        '</select></label>' : '') +
      '<div class="ps__list">' + list.map(function (p) {
        var on = p.role === me.role;
        return '<button class="ps__item' + (on ? ' ps__item--on' : '') + '" type="button" data-ps-role="' + p.role + '"' + (on ? ' aria-current="true"' : '') + '>' +
          '<span class="ps__ic">' + P.ic(p.ic) + '</span><span class="ps__text"><b>' + esc(p.label) + '</b><small>' + esc(p.sub) + '</small></span>' +
          (on ? '<span class="ps__now">ви тут</span>' : P.ic('chevron-right')) + '</button>';
      }).join('') + '</div></section>';
  }

  function setLoc(locationId) {
    return P.srv('authAdminView', { locationId: locationId }).then(function (r) {
      if (!r.ok) P.toast('danger', 'Не вдалося змінити локацію', r.error || 'Спробуйте ще раз.');
      return r.ok;
    });
  }
  function descend(role) {
    if (role === 'auditor') try { root.sessionStorage.setItem('pw-pc-ok', '1'); } catch (e) { /* без памʼяті — заставка з кнопкою */ }
    if (P.authSlack && P.authSlack.real()) return Promise.resolve(true);
    return P.srv('authDemoDescend', { role: role }).then(function (r) {
      if (!r.ok) P.toast('danger', 'Не вдалося відкрити профіль', r.error || 'Спробуйте ще раз.');
      return r.ok;
    });
  }
  function open(role, locationId, hash) {
    var p = byRole(role);
    if (!p) return Promise.resolve(false);
    var to = p.path + (hash ? '#' + String(hash).replace(/^#/, '') : '');
    return (locationId ? setLoc(locationId) : Promise.resolve(true)).then(function (ok) { return ok && descend(role); })
      .then(function (ok) { if (ok) root.location.href = to; return ok; });
  }

  function bind(el) {
    el.addEventListener('change', function (e) {
      var t = e.target;
      if (!t.getAttribute || t.getAttribute('data-ps-loc') == null) return;
      t.disabled = true;
      setLoc(t.value).then(function (ok) {
        if (!ok) { t.disabled = false; t.value = t.getAttribute('data-prev'); return; }   // сервер лишив стару локацію — показуємо її ж
        root.location.hash = ''; root.location.reload();
      });
    });
    el.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-ps-role]') : null;
      if (!b || !el.contains(b) || b.getAttribute('aria-current')) return;
      open(b.getAttribute('data-ps-role'));
    });
  }

  P.profileSwitch = { PROFILES: PROFILES, html: html, bind: bind, open: open, busy: null };

  if (root.addEventListener && !P.embed) root.addEventListener('storage', function (e) {
    var out = /^audit-demo:demo:me(:sr|:mgr|:adm)?$/.test(e.key || '') && e.newValue === null;
    if (!out && e.key !== 'audit-demo:demo:admin' && e.key !== 'audit:view-loc' && e.key !== 'audit-demo:demo:view-loc') return;
    if (P.profileSwitch.busy && P.profileSwitch.busy()) { P.toast('warn', 'Вхід змінили в іншій вкладці', 'Закрийте це вікно й оновіть сторінку — інакше дані запишуться від іншого імені.'); return; }
    root.location.hash = ''; root.location.reload();
  });
})(typeof window !== 'undefined' ? window : globalThis);
