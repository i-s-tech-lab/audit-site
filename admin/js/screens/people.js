(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm, q = A.q, qa = A.qa, da = A.da;
  var flt = { q: '', role: '', loc: '' };   // фільтри живуть, поки відкрита сторінка (перехід між розділами їх не губить)

  function subnav(cur) {
    return '<nav class="pills adm-subnav" aria-label="Розділи вкладки">' + [['people', '/people', 'Люди'], ['rights', '/people/rights', 'Що може роль']].map(function (s) {
      return '<a class="pill' + (s[0] === cur ? ' pill--on' : '') + '" href="#' + s[1] + '"' + (s[0] === cur ? ' aria-current="page"' : '') + '>' + esc(s[2]) + '</a>';
    }).join('') + '</nav>';
  }
  P.admPeople = { subnav: subnav };

  P.cab.tab({ id: 'people', label: 'Люди й доступи', ic: 'people', path: '/people', order: 20 });
  P.cab.screen('/people', { tab: 'people', title: 'Люди й доступи', render: function (ctx) {
    var data = null;
    function find(id) { return data.items.filter(function (x) { return x.id === id; })[0]; }
    function locName(id) { var l = data.locations.filter(function (x) { return x.id === id; })[0]; return l ? l.name : id; }
    function shown() {
      var s = flt.q.trim().toLowerCase();
      return data.items.filter(function (u) {
        return (!flt.role || u.role === flt.role) && (!flt.loc || u.locationIds.indexOf(flt.loc) >= 0) &&
          (!s || u.name.toLowerCase().indexOf(s) >= 0 || String(u.slackId).toLowerCase().indexOf(s) >= 0 ||
            (u.slackFull && u.slackFull.toLowerCase().indexOf(s) >= 0));   // v1.6: справжній режим — і за повним Slack ID
      });
    }
    function row(u) {
      var locs = u.allLocations ? 'усі локації' : u.locationIds.map(locName).join(', ');
      return '<div class="adm-person' + (u.active ? '' : ' adm-person--off') + '"><span class="avatar" aria-hidden="true">' + esc(P.initials(u.name)) + '</span>' +
        '<div class="adm-person__main"><div class="adm-person__name"><b>' + esc(u.name) + '</b>' + H.badge(u.roleLabel, u.role === 'admin' ? 'brand' : '') +
          (u.isMe ? H.badge('це ви', 'info') : '') + (u.active ? '' : H.badge('доступ вимкнено', '')) + (u.seniorOff && u.active ? H.badge('доступ вимкнув старший', 'warn') : '') +
          (!u.active && u.disabledBy === 'senior_auditor' ? H.badge('вимкнув старший', 'warn') : '') + '</div>' +   // v1.6: справжній режим
        '<span class="adm-person__meta">Slack ' + esc(u.slackId) + ' · ' + esc(locs) + (u.lastAuditAt ? ' · останній аудит ' + esc(A.ago(u.lastAuditAt)) : '') + '</span></div>' +
        '<div class="adm-person__acts">' + (u.isMe ? '<span class="adm-dim adm-lockic" title="Свій доступ змінює інший адміністратор">' + P.ic('lock', 'ui-icon--sm') + '</span>'
          : A.sw(u.active, 'pp-access', da('id', u.id), (u.active ? 'Доступ увімкнено' : 'Доступ вимкнено') + ' · ' + u.name)) +
          A.pen('pp-edit', da('id', u.id), 'Редагувати · ' + u.name) + '</div></div>';
    }
    function drawList() {
      var box = q(ctx.el, '[data-pp-list]'); if (!box) return;
      var list = shown();
      box.innerHTML = list.length ? list.map(row).join('') : H.empty('Нікого не знайдено', 'Змініть пошук або фільтр.');
      q(ctx.el, '[data-pp-n]').textContent = list.length === data.items.length ? '' : 'Показано ' + list.length + ' з ' + data.items.length;
    }
    function draw() {
      var on = data.items.filter(function (u) { return u.active; }).length;
      if (flt.loc && !data.locations.some(function (l) { return l.id === flt.loc; })) flt.loc = '';
      ctx.el.innerHTML = '<section class="adm-col">' +
        A.head('Люди й доступи', on + ' з доступом · ' + (data.items.length - on) + ' вимкнено · ' + A.asOf(), A.btnNew('pp-new', 'Додати людину')) + subnav('people') +
        '<div class="adm-tools"><label class="search adm-search">' + P.ic('search', 'icon') + '<input class="input input--search" type="search" data-input="pp-q" value="' + esc(flt.q) + '" placeholder="Імʼя або Slack ID" aria-label="Пошук людини"></label>' +
          '<select class="input adm-select" data-change="pp-loc" aria-label="Локація"><option value="">Усі локації</option>' + data.locations.map(function (l) {
            return '<option value="' + esc(l.id) + '"' + (l.id === flt.loc ? ' selected' : '') + '>' + esc(l.name) + (l.active ? '' : ' (вимкнена)') + '</option>'; }).join('') + '</select></div>' +
        '<div class="adm-chips" role="group" aria-label="Роль">' + [{ id: '', label: 'Усі ролі', count: on }].concat(data.roles).map(function (r) {
          return '<button class="chip-pick' + (flt.role === r.id ? ' chip-pick--on' : '') + '" type="button" data-act="pp-role"' + da('role', r.id) + ' aria-pressed="' + (flt.role === r.id) + '">' + esc(r.label) + '<small>' + r.count + '</small></button>';
        }).join('') + A.help('admin.people.role') + '</div>' +
        '<section class="card adm-flat"><p class="hint" data-pp-n></p><div class="adm-people" data-pp-list></div>' +
        '<p class="hint">Вимкнений доступ: вхід закривається одразу, аудити людини лишаються в історії' + A.help('admin.people.access') + '. Керівник і адміністратор бачать усі локації.</p></section></section>';
      drawList();
    }
    function load() {
      P.authSlack.peopleAll().then(function (r) {   // v1.5: справжній режим — люди з сервера входу, тестовий — демо
        if (!ctx.alive()) return;
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        data = r; draw(); openRequested();
      });
    }
    var wantReq = ctx.query && ctx.query.req;
    function openRequested() {
      if (!wantReq) return;
      var id = wantReq; wantReq = null;
      try { root.history.replaceState(null, '', '#/people'); } catch (e) { /* без історії — форма однаково відкриється */ }
      P.authSlack.requests().then(function (r) {
        var it = r && r.ok ? (r.requests || []).filter(function (x) { return String(x.id) === String(id); })[0] : null;
        if (!ctx.alive()) return;
        if (!it) { P.toast('info', 'Цей запит уже оброблено', 'Його немає в списку «Хочуть увійти».'); return; }
        openEdit(null, { slackId: it.slackId, name: it.name, reqId: it.id });
      });
    }

    function openEdit(u, from) {
      var st = { role: u ? u.role : 'auditor', locs: u ? u.locationIds.slice() : (flt.loc ? [flt.loc] : []), active: u ? u.active : true };
      var roles = data.roles.filter(function (r) { return r.assignable || (u && r.id === u.role); });
      function locBlock() {
        if (st.role === 'manager' || st.role === 'admin') return '<span class="label">Локації' + A.help('admin.people.locs') + '</span><span class="select adm-locked">Усі локації' + P.ic('lock', 'icon icon--sm') + '</span>';
        return '<span class="label">Локації' + A.help('admin.people.locs') + '</span><div class="adm-chips">' + data.locations.map(function (l) {
          var on = st.locs.indexOf(l.id) >= 0;
          return '<button class="chip-pick' + (on ? ' chip-pick--on' : '') + '" type="button" data-act="pp-pick"' + da('id', l.id) + ' aria-pressed="' + on + '">' + (on ? P.ic('check', 'ui-icon--sm') : '') + esc(l.name) + '</button>';
        }).join('') + '</div>';
      }
      A.modal({ size: 'sm', title: u ? 'Редагувати людину' : 'Додати людину', sub: u ? esc(u.name) : '',
        body: '<div class="adm-form">' +
          A.field('name', 'Імʼя та перша літера прізвища', A.input('name', u ? u.name : (from ? from.name : ''), ' autocomplete="off" maxlength="60" placeholder="Олена К."')) +
          A.field('slackId', 'Slack ID', A.input('slackId', from ? from.slackId : '', ' autocomplete="off" maxlength="40" placeholder="' + (u ? esc(u.slackId) : 'Slack ID людини') + '"'),
            u ? 'Зараз: ' + u.slackId + '. Порожнє поле — без змін.' : 'Знайти: профіль у Slack → «⋯» → «Скопіювати ID учасника».', 'admin.people.slackId') +
          '<div class="field adm-lookup"><button class="btn btn--secondary btn--sm" type="button" data-act="pp-lookup" style="align-self:flex-start">' + P.ic('slack', 'ui-icon--sm') + 'Показати імʼя зі Slack</button>' +
            '<span class="hint" data-lookup-out aria-live="polite"></span></div>' +
          A.field('role', 'Роль', '<select class="input" name="role">' + roles.map(function (r) { return '<option value="' + esc(r.id) + '"' + (r.id === st.role ? ' selected' : '') + '>' + esc(r.label) + '</option>'; }).join('') + '</select>', '', 'admin.people.role') +
          '<div class="field" data-f="locationIds" data-pp-locs>' + locBlock() + '</div>' +
          (u ? '<div class="field" data-f="active"><span class="label">Доступ' + A.help('admin.people.access') + '</span>' + A.seg('active', [['true', 'Увімкнено'], ['false', 'Вимкнено']], String(st.active)) + '</div>' : '') +
          '</div>',
        foot: A.cancelBtn() + A.saveBtn(u ? 'Зберегти' : 'Додати людину', u ? 'save' : 'add'),
        onMount: function (el) {
          A.enterSubmits(el);
          q(el, '[name="role"]').addEventListener('change', function (e) { st.role = e.target.value; q(el, '[data-pp-locs]').innerHTML = locBlock(); });
        },
        on: {
          'pp-pick': function (t, e, layer) {
            var id = t.getAttribute('data-id'), i = st.locs.indexOf(id);
            if (i >= 0) st.locs.splice(i, 1); else st.locs.push(id);
            q(layer.el, '[data-pp-locs]').innerHTML = locBlock();
          },
          'adm-seg': function (t, e, layer) { st.active = A.segPick(layer, t) === 'true'; st.touched = true; },
          'pp-lookup': function (t, e, layer) {
            var out = q(layer.el, '[data-lookup-out]'), id = A.val(layer.el, 'slackId').trim();
            if (!id) { out.textContent = 'Впишіть Slack ID, щоб побачити імʼя.'; return; }
            t.disabled = true;
            P.authSlack.lookup(id).then(function (r) {
              t.disabled = false;
              out.textContent = !r.ok ? (r.error || 'Не вдалося перевірити.') : r.found ? 'У Slack це: ' + r.name : 'Не знайдено';
            });
          },
          'adm-save': function (t, e, layer) {
            var p = { name: A.val(layer.el, 'name'), slackId: A.val(layer.el, 'slackId'), role: st.role };
            if (st.role !== 'manager' && st.role !== 'admin') p.locationIds = st.locs.slice();
            if (u) { p.id = u.id; if (st.touched || st.active !== u.active) p.active = st.active; }
            t.disabled = true;
            P.authSlack.savePerson(p).then(function (r) {   // v1.5: «Додати» з запиту зберігає туди ж, куди закриває запит
              t.disabled = false;
              if (!r.ok) { A.showErrors(layer.el, r); return; }
              layer.close();
              P.toast('ok', (r.created ? 'Людину додано · ' : 'Збережено · ') + (r.name || (u ? u.name : '')), r.active === false ? 'Доступ вимкнено.' : '');
              if (from && from.reqId) P.authSlack.resolveRequest(from.reqId, 'added', r.id);   // запит «Хочуть увійти» виконано
              if (ctx.alive()) load();
            });
          }
        } });
    }
    function access(t) {
      var u = find(t.getAttribute('data-id'));
      function go() {
        t.disabled = true;
        P.authSlack.savePerson({ id: u.id, active: !u.active, knownName: u.name }).then(function (r) {
          if (!ctx.alive()) return;
          t.disabled = false;
          if (!r.ok) { if (r.code === 'validation') P.toast('warn', 'Не збережено', r.error); else A.failToast(r); return; }
          P.toast('ok', (r.active ? 'Доступ увімкнено · ' : 'Доступ вимкнено · ') + (r.name || u.name), r.active ? '' : 'Записані аудити лишились в історії.');
          load();
        });
      }
      if (!u.active) { go(); return; }
      P.confirm({ title: 'Вимкнути доступ · ' + u.name + '?', text: 'Вхід у додаток закриється одразу. Записані аудити лишаються в історії; увімкнути можна будь-коли.', okLabel: 'Вимкнути доступ', danger: true })
        .then(function (ok) { if (ok) go(); });
    }
    ctx.on('pp-new', function () { openEdit(null); });
    ctx.on('pp-edit', function (t) { openEdit(find(t.getAttribute('data-id'))); });
    ctx.on('pp-access', access);
    ctx.on('pp-role', function (t) { flt.role = t.getAttribute('data-role'); qa(ctx.el, '[data-act="pp-role"]').forEach(function (b) { var on = b === t; b.classList.toggle('chip-pick--on', on); b.setAttribute('aria-pressed', on); }); drawList(); });
    ctx.on('pp-loc', function (t) { flt.loc = t.value; drawList(); });
    ctx.on('pp-q', function (t) { flt.q = t.value; drawList(); });
    load();
  } });
})(window);
