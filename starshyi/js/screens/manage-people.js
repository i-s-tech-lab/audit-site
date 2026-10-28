(function (root) {
  'use strict';
  var P = root.P, H = P.sr.h, esc = P.esc, M = P.srMg;
  var q = M.q, qa = M.qa, da = M.da;

  if (P.help && P.help.add) P.help.add({ 'sr.mg.slackId': { t: 'Slack ID', d: 'Особистий код людини в Slack. За ним додаток впізнає, хто увійшов, — пошта для цього не потрібна.\nДе знайти: у Slack відкрийте профіль людини → «⋯» → «Скопіювати ID учасника».', ex: 'Кнопка «Показати імʼя зі Slack» одразу покаже, чий це код.' } });

  M.section('team', 'Аудитори', function (v) {
    var data = null, TR = P.teamRequests;
    var reqs = TR.create({ box: function () { return q(v.col, '[data-tr-box]'); }, alive: v.ctx.alive });   // v1.7: картка «Хочуть увійти»
    function load() {
      if (!P.authSlack.real()) { v.get('srMgTeam', function (r) { data = r; draw(); }); return; }
      P.authTeam.list().then(function (r) {
        if (!v.ctx.alive()) return;
        if (!r.ok) { v.col.innerHTML = H.error(r); return; }
        data = { ok: true, location: { id: v.loc, name: v.ctx.loc.name }, access: { canAdd: r.access.addPeople, addedToday: r.access.addedToday, limit: r.access.addLimitPerDay },
          items: r.users.filter(function (u) { return u.role === 'auditor' && u.locationIds.indexOf(v.loc) >= 0; }).map(function (u) {
            return { id: u.id, name: u.name, slackId: P.authSlack.maskId(u.slackId), active: u.active, disabledBy: u.disabledBy, lastAuditAt: null, login: null,
              addedAt: u.createdAt, canEnable: u.canEnable };
          }) };
        draw();
        if (v.wantNew && v.openNew) { v.wantNew = false; v.openNew(); }
      });
    }
    function save(p) {
      var body = Object.assign({}, p);
      if (!P.authSlack.real()) { delete body.knownName; return v.call('srMgUserSave', body); }
      if (!body.id) { body.role = 'auditor'; body.locationIds = [v.loc]; }
      return P.authTeam.save(body);
    }
    function find(id) { return data.items.filter(function (x) { return x.id === id; })[0]; }
    var OFF_BY = { admin: 'адміністратор', manager: 'керівник', senior_auditor: 'старший' };   // хто вимкнув доступ (disabledBy)
    var CANT_ENABLE = 'Увімкнути доступ може старший із правом «Додавати людей» або адміністратор';
    function canAdd() { return !!(data.access && data.access.canAdd); }
    function swLabel(u) {
      if (u.active) return 'Доступ увімкнено · ' + u.name;
      if (u.canEnable) return 'Доступ вимкнено · ' + u.name;
      if (!canAdd()) return CANT_ENABLE;
      return u.disabledBy === 'manager' ? 'Доступ вимкнув керівник — увімкнути може керівник або адміністратор' : 'Доступ вимкнув адміністратор — увімкнути може лише адміністратор';
    }
    function row(u) {
      var login = !u.login ? '—' : u.login.kind === 'never' ? H.badge('ще не входив', 'info') : u.login.kind === 'expired' ? H.badge('треба увійти знову', 'warn') : 'до ' + H.dayShort(u.login.until);
      var locked = !u.active && !u.canEnable;   // вимкнений, а вмикати цій людині не можна
      var sw = M.sw(u.active, 'mg-access', da('id', u.id), swLabel(u));
      return '<tr' + (u.active ? '' : ' class="mg-off"') + '><td><b>' + esc(u.name) + '</b>' +
        (!u.active ? '<span class="sub">' + (OFF_BY[u.disabledBy] ? 'доступ вимкнув ' + OFF_BY[u.disabledBy] : 'доступ вимкнено') + '</span>' : u.addedAt ? '<span class="sub">' + M.added(u.addedAt) + '</span>' : '') + '</td>' +
        '<td>' + esc(u.slackId) + '</td><td class="mg-nowrap">' + M.ago(u.lastAuditAt) + '</td><td>' + login + '</td>' +
        '<td>' + (locked ? sw.replace('<button ', '<button disabled ') : sw) + '</td>' +
        '<td>' + (canAdd() ? M.pen('mg-edit', da('id', u.id), 'Редагувати ' + u.name) : '') + '</td></tr>';
    }
    function draw() {
      var acc = data.access || {};
      v.col.innerHTML = M.head('Аудитори', data.location.name + ' · вхід через Slack', canAdd() ? M.btnNew('Новий аудитор') : '') + (canAdd() ? TR.slot() : '') +
        '<section class="card">' + (canAdd() && acc.limit ? '<p class="hint">Сьогодні додано: ' + acc.addedToday + ' з ' + acc.limit + '.</p>' : '') +
        (data.items.length ? '<div class="tbl-box"><table class="tbl"><thead><tr><th>Аудитор</th><th>Slack ID</th><th>Останній аудит</th><th>Вхід діє' + M.hq('sr.mg.login') + '</th><th>Доступ' + M.hq('sr.mg.access') + '</th><th><span class="mg-vh">Дії</span></th></tr></thead><tbody>' +
          data.items.map(row).join('') + '</tbody></table></div>'
          : H.empty('Аудиторів ще немає', '')) +
        '<p class="hint">Вимкнений доступ: вхід закрито, аудити людини лишаються в історії.' + (canAdd() ? '' : ' Право «Додавати людей» для вас вимкнено — увімкнути його може адміністратор. Вимкнути доступ можна й без нього.') + '</p></section>';
      if (canAdd()) reqs.refresh();   // v1.7: запити підтягуємо після малювання
    }
    function openEdit(u, rq) {
      var st = { active: u ? u.active : true };
      M.modal({ size: 'sm', title: u ? 'Редагувати аудитора' : 'Новий аудитор', sub: u ? esc(u.name) : '',
        body: '<div class="mg-form">' +
          M.field('name', 'Імʼя та перша літера прізвища', M.input('name', u ? u.name : rq ? rq.name : '', ' autocomplete="off" maxlength="60" placeholder="Петро Л."')) +
          (rq ? M.locked('Slack ID з запиту', TR.idOf(rq)) : M.field('slackId', 'Slack ID', M.input('slackId', '', ' autocomplete="off" maxlength="40" placeholder="' + (u ? esc(u.slackId) : 'Slack ID людини') + '"'),
            u ? 'Зараз: ' + u.slackId + '. Порожнє поле — без змін.' : 'Знайти: профіль у Slack → «⋯» → «Скопіювати ID учасника».', 'sr.mg.slackId') +
          '<div class="field"><button class="btn btn--secondary btn--sm" type="button" data-act="mg-lookup" style="align-self:flex-start">' + P.ic('slack', 'ui-icon--sm') + 'Показати імʼя зі Slack</button>' +
            '<span class="hint" data-lookup-out aria-live="polite"></span></div>') +
          '<div class="pair">' + M.locked('Роль', 'Аудитор') + M.locked('Локація', v.ctx.loc.name) + '</div>' +
          (u ? '<div class="field"><span class="label">Доступ' + M.hq('sr.mg.access') + '</span>' + M.seg('active', [[true, 'Увімкнено'], [false, 'Вимкнено']], st.active) + '</div>' : '') +
          '<p class="hint">Вхід — через Slack, раз на тиждень. Старших аудиторів може додати керівник, керівників — лише адміністратор.</p></div>',
        foot: M.cancelBtn() + '<button class="btn btn--primary" type="button" data-act="mg-save">' + P.ic(u ? 'save' : 'add') + (u ? 'Зберегти' : rq ? 'Додати людину' : 'Додати аудитора') + '</button>',
        onMount: function (el) { M.enterSubmits(el, 'mg-save'); },
        on: {
          'mg-seg': function (t, e, layer) { st.active = t.getAttribute('data-v') === 'true'; qa(layer.el, '[data-k="active"]').forEach(function (b) { b.classList.toggle('seg__btn--on', b === t); }); },
          'mg-lookup': function (t, e, layer) {
            var out = q(layer.el, '[data-lookup-out]'), id = M.val(layer.el, 'slackId').trim();
            if (!id) { out.textContent = 'Впишіть Slack ID, щоб побачити імʼя.'; return; }
            t.disabled = true;
            P.authTeam.lookup(id).then(function (r) { t.disabled = false; out.textContent = P.authTeam.lookupText(r); });
          },
          'mg-save': function (t, e, layer) {
            var p = { name: M.val(layer.el, 'name') }, sid = rq ? '' : M.val(layer.el, 'slackId').trim();
            if (rq) p.requestId = rq.id;   // v1.7: Slack ID бере сервер із запиту
            else if (!u || sid) p.slackId = sid;   // v1.5: Slack ID наявного аудитора шлемо, лише коли його вписали (порожнє — без змін)
            if (u) { p.id = u.id; p.active = st.active; }
            t.disabled = true;
            save(p).then(function (r) {
              t.disabled = false;
              if (!r.ok) { M.showErrors(layer.el, r); return; }
              layer.close();
              if (r.created) TR.saved(r, r.name); else P.toast('ok', 'Зміни збережено · ' + r.name, r.active ? '' : 'Доступ вимкнено.');
              if (v.ctx.alive()) load();
            });
          }
        } });
    }
    v.openNew = function () { if (canAdd()) openEdit(null); };   // v1.5: без права «Додавати людей» нового аудитора не додати
    v.ctx.on('mg-new', function () { if (canAdd()) openEdit(null); });
    v.ctx.on('mg-edit', function (t) { openEdit(find(t.getAttribute('data-id'))); });
    v.ctx.on('tr-add', function (t) { var rq = reqs.find(t.getAttribute('data-id')); if (rq && canAdd()) openEdit(null, rq); });   // v1.7: «Додати» в картці запитів
    v.ctx.on('tr-reject', function (t) { P.teamRequests.reject(reqs.find(t.getAttribute('data-id'))).then(function (ok) { if (ok && v.ctx.alive()) reqs.refresh(); }); });   // v1.8
    v.ctx.on('mg-access', function (t) {
      var u = find(t.getAttribute('data-id'));
      function go() {
        t.disabled = true;
        save({ id: u.id, active: !u.active, knownName: u.name }).then(function (r) {
          if (!v.ctx.alive()) return;
          if (!r.ok) { t.disabled = false; M.failToast(r); return; }
          P.toast('ok', (r.active ? 'Доступ увімкнено · ' : 'Доступ вимкнено · ') + r.name, r.active ? '' : 'Записані аудити лишились в історії.');
          load();
        });
      }
      if (!u.active) { go(); return; }
      P.confirm({ title: 'Вимкнути доступ · ' + u.name + '?', text: 'Вхід у додаток буде закрито. Записані аудити лишаються в історії.', okLabel: 'Вимкнути доступ', danger: true })
        .then(function (ok) { if (ok) go(); });
    });
    load();
  });

  var NEW = '@new';   // значення фільтра «Додані аудиторами»
  M.section('workers', 'Виробничі працівники', function (v) {
    var data = null, st = { q: '', dep: '', edit: null };
    function load() { v.get('srMgWorkers', function (r) { data = r; if (st.dep === NEW && !r.pending) st.dep = ''; draw(); }); }
    function find(code) { return data.items.filter(function (x) { return x.code === code; })[0]; }
    function deps() { return data.departments; }
    function depOptions(cur) { return deps().map(function (d) { return '<option value="' + esc(d.id) + '"' + (d.id === cur ? ' selected' : '') + '>' + esc(d.name) + (d.active ? '' : ' (вимкнено)') + '</option>'; }).join(''); }
    function shown() {
      var s = st.q.trim().toLowerCase();
      return data.items.filter(function (w) { return (st.dep === NEW ? w.pending : !st.dep || w.departmentId === st.dep) && (!s || w.name.toLowerCase().indexOf(s) >= 0); });
    }
    function toggle(w) { return M.sw(w.active, 'mg-on', da('code', w.code), (w.active ? 'Є у формі аудиту' : 'Немає у формі аудиту') + ' · ' + w.name); }
    function row(w) {
      if (st.edit === w.code) {
        return '<tr class="sel" data-mg-editrow>' +
          '<td data-f="name"><input class="input" name="name" value="' + esc(w.name) + '" aria-label="Працівник, як підписаний у цеху" maxlength="40" style="min-width:170px;height:44px"></td>' +
          '<td data-f="departmentId"><select class="input" name="departmentId" aria-label="Відділ" style="min-width:150px;height:44px">' + depOptions(w.departmentId) + '</select></td>' +
          '<td class="n">' + H.num(w.audits30) + '</td><td>' + toggle(w) + '</td>' +
          '<td><div class="mg-rowacts"><button class="btn btn--primary btn--sm" type="button" data-act="mg-row-save">' + P.ic('check', 'ui-icon--sm') + 'Зберегти</button>' +
          '<button class="btn btn--quiet btn--sm" type="button" data-act="mg-row-cancel">Скасувати</button></div></td></tr>';
      }
      var sub = w.pending ? '<span class="sub"><span class="badge badge--info mg-flag">додав аудитор' + (w.addedByName ? ' ' + esc(w.addedByName) : '') + (w.addedAt ? ' · ' + H.dayShort(P.fmt.dayKey(w.addedAt)) : '') + '</span></span>'
        : !w.active ? '<span class="sub">немає у формі аудиту</span>' : w.addedAt ? '<span class="sub">' + M.added(w.addedAt) + '</span>' : '';
      return '<tr' + (w.active ? '' : ' class="mg-off"') + '><td><b>' + esc(w.name) + '</b>' + sub + '</td>' +
        '<td>' + esc(w.departmentName) + '</td><td class="n">' + H.num(w.audits30) + '</td><td>' + toggle(w) + '</td>' +
        '<td><div class="mg-rowacts">' + (w.pending ? '<button class="btn btn--secondary btn--sm" type="button" data-act="mg-confirm"' + da('code', w.code) + '>' + P.ic('check', 'ui-icon--sm') + 'Підтверджено</button>' : '') +
        M.pen('mg-edit', da('code', w.code), 'Редагувати ' + w.name) + '</div></td></tr>';
    }
    function tbody() {
      var list = shown();
      return list.length ? list.map(row).join('') : '<tr><td colspan="5">' + H.empty(data.items.length ? 'Нікого не знайдено' : 'Працівників ще немає', '') + '</td></tr>';
    }
    function countHint() { return 'Показано ' + shown().length + ' з ' + data.items.length; }
    function draw() {
      var pills = [['', 'Усі']].concat(deps().map(function (d) { return [d.id, d.name]; }));
      if (data.pending) pills.push([NEW, 'Додані аудиторами · ' + data.pending]);
      v.col.innerHTML = M.head('Виробничі працівники', 'Кого обирають в аудиті · ' + data.location.name + ' · ' + M.cnt(data.items.length, ['людина', 'людини', 'людей']), M.btnNew('Новий виробничий працівник'), 'sr.mg.workers') +
        '<section class="card"><div class="mg-tools"><div class="search" style="flex:1;min-width:220px">' + P.ic('search', 'icon') +
        '<input class="input" data-input="mg-q" value="' + esc(st.q) + '" placeholder="Працівник, напр. q5" aria-label="Пошук працівника за назвою" style="padding-left:46px"></div>' +
        '<span class="pills mg-pills">' + pills.map(function (o) {
          return '<button class="pill' + (st.dep === o[0] ? ' pill--on' : '') + (o[0] === NEW ? ' mg-pill-new' : '') + '" type="button" aria-pressed="' + (st.dep === o[0]) + '" data-act="mg-dep"' + da('id', o[0]) + '>' + esc(o[1]) + '</button>'; }).join('') + '</span></div>' +
        '<div class="tbl-box"><table class="tbl"><thead><tr><th>Працівник</th><th>Відділ</th><th class="n">Аудитів за 30 днів' + M.hq('sr.mg.audits30') + '</th><th>У формі аудиту' + M.hq('sr.mg.inForm') + '</th><th><span class="mg-vh">Дії</span></th></tr></thead><tbody data-mg-body>' + tbody() + '</tbody></table></div>' +
        '<p class="hint" data-mg-hint>' + countHint() + '</p></section>';
    }
    function redrawRows() { var b = q(v.col, '[data-mg-body]'); if (b) b.innerHTML = tbody(); var h = q(v.col, '[data-mg-hint]'); if (h) h.textContent = countHint(); }
    function save(code, p, done) {
      return v.call('srMgWorkerSave', Object.assign({ code: code }, p)).then(function (r) { if (v.ctx.alive()) done(r); return r; });
    }
    function openNew() {
      var first = deps().filter(function (d) { return d.active; })[0] || deps()[0];
      M.modal({ size: 'sm', title: 'Новий виробничий працівник', sub: esc(v.ctx.loc.name),
        body: '<div class="mg-form">' + M.field('name', 'Працівник (як підписаний у цеху, напр. q5)', M.input('name', '', ' autocomplete="off" maxlength="40" placeholder="q5"'), '', 'term.worker') +
          '<label class="field" data-f="departmentId"><span class="label">Відділ</span><select class="input" name="departmentId">' + depOptions(first && first.id) + '</select></label></div>',
        foot: M.cancelBtn() + '<button class="btn btn--primary" type="button" data-act="mg-save">' + P.ic('add') + 'Додати працівника</button>',
        onMount: function (el) { M.enterSubmits(el, 'mg-save'); },
        on: { 'mg-save': function (t, e, layer) {
          t.disabled = true;
          v.call('srMgWorkerSave', { name: M.val(layer.el, 'name'), departmentId: M.val(layer.el, 'departmentId') }).then(function (r) {
            t.disabled = false;
            if (!r.ok) { M.showErrors(layer.el, r); return; }
            layer.close(); P.toast('ok', 'Працівника додано · ' + r.name, 'Є у формі аудиту.');
            if (v.ctx.alive()) load();
          });
        } } });
    }
    v.openNew = openNew;
    v.ctx.on('mg-new', openNew);
    v.ctx.on('mg-q', function (t) { st.q = t.value; redrawRows(); });
    v.ctx.on('mg-dep', function (t) { st.dep = t.getAttribute('data-id'); st.edit = null; draw(); });
    v.ctx.on('mg-edit', function (t) { st.edit = t.getAttribute('data-code'); redrawRows(); var i = q(v.col, '[data-mg-editrow] input'); if (i) i.focus(); });
    v.ctx.on('mg-row-cancel', function () { st.edit = null; redrawRows(); });
    v.ctx.on('mg-row-save', function (t) {
      var tr = q(v.col, '[data-mg-editrow]'), w = find(st.edit);
      t.disabled = true;
      save(w.code, { name: M.val(tr, 'name'), departmentId: M.val(tr, 'departmentId') }, function (r) {
        t.disabled = false;
        if (!r.ok) { M.showErrors(tr, r); return; }
        st.edit = null; P.toast('ok', 'Зміни збережено · ' + r.name); load();
      });
    });
    v.ctx.on('mg-confirm', function (t) {
      var w = find(t.getAttribute('data-code')); t.disabled = true;
      save(w.code, { confirmed: true }, function (r) {
        if (!r.ok) { t.disabled = false; M.failToast(r); return; }
        P.toast('ok', 'Підтверджено · ' + r.name); load();
      });
    });
    v.ctx.on('mg-on', function (t) {
      var w = find(t.getAttribute('data-code')); t.disabled = true;
      save(w.code, { active: !w.active }, function (r) {
        if (!r.ok) { t.disabled = false; M.failToast(r); return; }
        P.toast('ok', (r.active ? 'Знову у формі аудиту · ' : 'Прибрано з форми аудиту · ') + r.name, r.active ? '' : 'Аудити з цим працівником лишились в історії.');
        load();
      });
    });
    load();
  });
})(window);
