(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, K = P.mgr, T = P.authTeam;
  var ROLES = [['', 'Усі'], ['auditor', 'Аудитори'], ['senior_auditor', 'Старші аудитори']];
  var SHOWN = { auditor: 1, senior_auditor: 1 };   // кого показуємо в цій вкладці
  var OFF_BY = { admin: 'адміністратор', manager: 'керівник', senior_auditor: 'старший' };   // хто вимкнув доступ (disabledBy)
  var NO_RIGHT = 'Право «Додавати людей» для вас вимкнено — увімкнути його може адміністратор. Вимкнути доступ можна й без нього.';
  var CANT_ENABLE = 'Увімкнути доступ може керівник із правом «Додавати людей» або адміністратор';
  var flt = { q: '', loc: '', role: '' };   // фільтри живуть, поки відкрита сторінка

  function da(k, v) { return ' data-' + k + '="' + esc(v) + '"'; }
  function q(el, sel) { return el.querySelector(sel); }
  function qa(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }
  function sw(on, data, label, off) {
    return '<button class="toggle tm-sw' + (on ? ' toggle--on' : '') + '" type="button" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" aria-label="' + esc(label) +
      '" title="' + esc(label) + '" data-act="tm-access"' + data + (off ? ' disabled' : '') + '></button>';
  }
  function pen(data, label) { return '<button class="icon-btn" type="button" data-act="tm-edit"' + data + ' aria-label="' + esc(label) + '" title="Редагувати">' + P.ic('edit') + '</button>'; }
  function field(name, label, inner, hint) {
    return '<label class="field" data-f="' + name + '"><span class="label">' + esc(label) + '</span>' + inner + (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '</label>';
  }
  function val(el, name) { var i = q(el, '[name="' + name + '"]'); return i ? i.value : ''; }
  function showErrors(box, r) {
    if (box) {
      qa(box, '.tm-err').forEach(function (e) { e.remove(); });
      qa(box, '.input--invalid').forEach(function (e) { e.classList.remove('input--invalid'); });
    }
    if (!r || r.ok) return;
    if (r.code !== 'validation') { if (r.code !== 'forbidden' || P.authSlack.real()) P.toast('danger', 'Не вдалося зберегти', (r && r.error) || ''); return; }
    var shown = 0;
    (box ? r.errors || [] : []).forEach(function (e) {
      var f = q(box, '[data-f="' + e.field + '"]'); if (!f) return;
      var i = f.matches('.input') ? f : q(f, '.input'); if (i) i.classList.add('input--invalid');
      f.insertAdjacentHTML('beforeend', '<p class="err tm-err" role="alert">' + esc(e.message) + '</p>');
      shown++;
    });
    if (!shown) P.toast('warn', 'Не збережено', r.error);
  }

  P.cab.tab({ id: 'team', label: 'Люди', ic: 'people', path: '/team', order: 60, real: true });   // real — працює і на справжньому сервері
  P.cab.screen('/team', { tab: 'team', title: 'Люди й доступ', render: function (ctx) {
    var data = null, locs = [], TR = P.teamRequests;
    var reqs = TR.create({ box: function () { return q(ctx.el, '[data-tr-box]'); }, alive: ctx.alive });   // v1.1: картка «Хочуть увійти»
    function find(id) { return data.users.filter(function (x) { return x.id === id; })[0]; }
    function locName(id) { var l = locs.filter(function (x) { return x.id === id; })[0]; return l ? l.name : id; }
    function canAdd() { return data.access.addPeople; }
    function shown() {
      var s = flt.q.trim().toLowerCase();
      return data.users.filter(function (u) {
        return (!flt.role || u.role === flt.role) && (!flt.loc || u.locationIds.indexOf(flt.loc) >= 0) &&
          (!s || u.name.toLowerCase().indexOf(s) >= 0 || u.slackId.toLowerCase().indexOf(s) >= 0 || P.authSlack.maskId(u.slackId).toLowerCase().indexOf(s) >= 0);
      });
    }
    function swLabel(u) {
      if (u.active) return 'Доступ увімкнено · ' + u.name;
      if (u.canEnable) return 'Доступ вимкнено · ' + u.name;
      return canAdd() ? 'Доступ вимкнув адміністратор — увімкнути може лише адміністратор' : CANT_ENABLE;
    }
    function subline(u) {
      return 'Slack ' + P.authSlack.maskId(u.slackId) + (u.active ? '' : ' · ' + (OFF_BY[u.disabledBy] ? 'доступ вимкнув ' + OFF_BY[u.disabledBy] : 'доступ вимкнено'));
    }
    function acts(u) {
      return sw(u.active, da('id', u.id), swLabel(u), !u.active && !u.canEnable) + (u.canEdit ? pen(da('id', u.id), 'Редагувати · ' + u.name) : '');
    }
    function locsOf(u) { return u.locationIds.map(locName).join(', '); }
    function table(list) {
      return '<div class="tbl-box mgr-desk"><table class="tbl"><thead><tr><th>Людина</th><th>Роль</th><th>Локації</th><th>Доступ</th><th><span class="tm-vh">Дії</span></th></tr></thead><tbody>' +
        list.map(function (u) {
          return '<tr' + (u.active ? '' : ' class="tm-off"') + '><td><b>' + esc(u.name) + '</b><span class="sub">' + esc(subline(u)) + '</span></td><td>' + esc(u.roleLabel) + '</td><td>' + esc(locsOf(u)) + '</td>' +
            '<td>' + sw(u.active, da('id', u.id), swLabel(u), !u.active && !u.canEnable) + '</td><td>' + (u.canEdit ? pen(da('id', u.id), 'Редагувати · ' + u.name) : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    function cards(list) {
      return '<div class="mgr-cards mgr-phone">' + list.map(function (u) {
        return '<article class="mgr-card' + (u.active ? '' : ' tm-off') + '"><div class="tm-card"><div class="tm-card__who"><b>' + esc(u.name) + '</b>' +
          '<span class="mgr-dim mgr-block">' + esc(u.roleLabel + ' · ' + locsOf(u)) + '</span><span class="mgr-dim mgr-block">' + esc(subline(u)) + '</span></div>' +
          '<div class="tm-acts">' + acts(u) + '</div></div></article>';
      }).join('') + '</div>';
    }
    function list() {
      var box = q(ctx.el, '[data-tm-list]'), l = shown();
      if (!box) return;
      box.innerHTML = !data.users.length ? H.empty('Людей ще немає', canAdd() ? 'Додайте першу людину кнопкою угорі.' : '')
        : !l.length ? H.empty('Нікого не знайдено', 'Змініть пошук або фільтр.') : (l.length < data.users.length ? '<p class="hint">Показано ' + l.length + ' з ' + data.users.length + '</p>' : '') + table(l) + cards(l);
    }
    function frame() {
      var on = data.users.filter(function (u) { return u.active; }).length, acc = data.access;
      ctx.el.innerHTML = '<section class="tm-page"><div class="tm-head"><div><h2 class="h2">Люди й доступ</h2><p class="h2-sub">Аудитори й старші аудитори · ' + on + ' з доступом · ' + esc(K.asOf(new Date().toISOString())) + '</p></div>' +
        (canAdd() ? '<button class="btn btn--primary" type="button" data-act="tm-new">' + P.ic('add') + 'Додати людину</button>' : '') + '</div>' +
        (canAdd() ? TR.slot() : '') + '<div class="card mgr-gap mgr-gap--sm"><div class="mgr-bar">' + K.search('tm-q', flt.q, 'Імʼя або Slack ID') +
          K.select('tm-loc', [['', 'Усі локації']].concat(locs.map(function (l) { return [l.id, l.name]; })), flt.loc, 'Локація') + K.pills('tm-role', ROLES, flt.role, 'Роль') + '</div>' +
          '<p class="hint">' + (canAdd() ? (acc.addLimitPerDay ? 'Сьогодні додано: ' + acc.addedToday + ' з ' + acc.addLimitPerDay + '. ' : '') : esc(NO_RIGHT)) + '</p></div>' +
        '<section class="card" data-tm-list></section></section>';
      reqs.show();   // v1.1: картка запитів (вона й сама тягне запити в load)
    }
    function load() {
      T.list().then(function (r) {
        if (!ctx.alive()) return;
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        data = r; data.users = r.users.filter(function (u) { return SHOWN[u.role]; });
        locs = T.locations(ctx.me, data.users);
        if (flt.loc && !locs.some(function (l) { return l.id === flt.loc; })) flt.loc = '';
        frame(); list();
        if (canAdd()) reqs.refresh();
      });
    }

    function openEdit(u, rq) {
      var roles = data.access.addRoles.filter(function (r) { return SHOWN[r]; });
      var st = { role: u ? u.role : roles[0], locs: u ? u.locationIds.slice() : (flt.loc ? [flt.loc] : []), active: u ? u.active : true, touched: false };
      function locBlock() {
        return '<span class="label">Локації</span><div class="tm-chips">' + locs.map(function (l) {
          var on = st.locs.indexOf(l.id) >= 0;
          return '<button class="chip-pick' + (on ? ' chip-pick--on' : '') + '" type="button" data-act="tm-pick"' + da('id', l.id) + ' aria-pressed="' + on + '">' + (on ? P.ic('check', 'ui-icon--sm') : '') + esc(l.name) + '</button>';
        }).join('') + '</div>';
      }
      P.sr.modal({ size: 'sm', title: u ? 'Редагувати людину' : 'Додати людину', sub: u ? esc(u.name) : '',
        body: '<div class="tm-form">' +
          field('name', 'Імʼя та перша літера прізвища', '<input class="input" name="name" value="' + esc(u ? u.name : rq ? rq.name : '') + '" autocomplete="off" maxlength="60" placeholder="Олена К.">') +
          (u ? '<div class="field"><span class="label">Slack ID</span><span class="select tm-locked">' + esc(P.authSlack.maskId(u.slackId)) + P.ic('lock', 'icon icon--sm') + '</span><span class="hint">Slack ID наявної людини змінює адміністратор.</span></div>'
            : rq ? '<div class="field"><span class="label">Slack ID з запиту</span><span class="select tm-locked">' + esc(TR.idOf(rq)) + P.ic('lock', 'icon icon--sm') + '</span></div>'
            : field('slackId', 'Slack ID', '<input class="input" name="slackId" value="" autocomplete="off" maxlength="40" placeholder="Slack ID людини">', 'Знайти: профіль у Slack → «⋯» → «Скопіювати ID учасника».') +
              '<div class="field"><button class="btn btn--secondary btn--sm" type="button" data-act="tm-lookup" style="align-self:flex-start">' + P.ic('slack', 'ui-icon--sm') + 'Показати імʼя зі Slack</button>' +
              '<span class="hint" data-lookup-out aria-live="polite"></span></div>') +
          field('role', 'Роль', '<select class="input" name="role">' + roles.map(function (r) {
            return '<option value="' + esc(r) + '"' + (r === st.role ? ' selected' : '') + '>' + esc(r === 'auditor' ? 'Аудитор' : 'Старший аудитор') + '</option>'; }).join('') + '</select>') +
          '<div class="field" data-f="locationIds" data-tm-locs>' + locBlock() + '</div>' +
          (u ? '<div class="field" data-f="active"><span class="label">Доступ</span><div class="seg" role="radiogroup">' + [['true', 'Увімкнено'], ['false', 'Вимкнено']].map(function (o) {
            return '<button class="seg__btn' + (String(st.active) === o[0] ? ' seg__btn--on' : '') + '" type="button" aria-pressed="' + (String(st.active) === o[0]) + '" data-act="tm-seg"' + da('v', o[0]) + '>' + o[1] + '</button>'; }).join('') + '</div></div>' : '') +
          '</div>',
        foot: '<button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button><button class="btn btn--primary" type="button" data-act="tm-save">' + P.ic(u ? 'save' : 'add') + (u ? 'Зберегти' : 'Додати людину') + '</button>',
        onMount: function (el) {
          q(el, '.modal').className += ' tm-modal';
          q(el, '[name="role"]').addEventListener('change', function (e) { st.role = e.target.value; });
          el.addEventListener('keydown', function (e) {   // Enter у полі = «Зберегти»
            if (e.key !== 'Enter' || !e.target.matches('input.input')) return;
            e.preventDefault(); var b = q(el, '[data-act="tm-save"]'); if (b && !b.disabled) b.click();
          });
        },
        on: {
          'tm-pick': function (t, e, layer) {
            var id = t.getAttribute('data-id'), i = st.locs.indexOf(id);
            if (i >= 0) st.locs.splice(i, 1); else st.locs.push(id);
            q(layer.el, '[data-tm-locs]').innerHTML = locBlock();
          },
          'tm-seg': function (t, e, layer) {
            st.active = t.getAttribute('data-v') === 'true'; st.touched = true;
            qa(layer.el, '[data-act="tm-seg"]').forEach(function (b) { var on = b === t; b.classList.toggle('seg__btn--on', on); b.setAttribute('aria-pressed', on); });
          },
          'tm-lookup': function (t, e, layer) {
            var out = q(layer.el, '[data-lookup-out]'), id = val(layer.el, 'slackId').trim();
            if (!id) { out.textContent = 'Впишіть Slack ID, щоб побачити імʼя.'; return; }
            t.disabled = true;
            T.lookup(id).then(function (r) { t.disabled = false; out.textContent = T.lookupText(r); });
          },
          'tm-save': function (t, e, layer) {
            var p = { name: val(layer.el, 'name'), role: st.role, locationIds: st.locs.slice() };
            if (u) { p.id = u.id; if (st.touched) p.active = st.active; } else if (rq) p.requestId = rq.id; else p.slackId = val(layer.el, 'slackId');
            t.disabled = true;
            T.save(p).then(function (r) {
              t.disabled = false;
              if (!r.ok) { showErrors(layer.el, r); return; }
              layer.close();
              if (r.created) TR.saved(r, r.name); else P.toast('ok', 'Збережено · ' + (r.name || (u ? u.name : '')), r.active === false ? 'Доступ вимкнено.' : '');
              if (ctx.alive()) load();
            });
          }
        } });
    }
    function access(t) {
      var u = find(t.getAttribute('data-id'));
      function go() {
        t.disabled = true;
        T.save({ id: u.id, active: !u.active, knownName: u.name }).then(function (r) {
          if (!ctx.alive()) return;
          t.disabled = false;
          if (!r.ok) { showErrors(null, r); return; }
          P.toast('ok', (r.active ? 'Доступ увімкнено · ' : 'Доступ вимкнено · ') + (r.name || u.name), r.active ? '' : 'Записані аудити лишились в історії.');
          load();
        });
      }
      if (!u.active) { go(); return; }
      P.confirm({ title: 'Вимкнути доступ · ' + u.name + '?', text: 'Вхід у додаток закриється одразу. Записані аудити лишаються в історії.', okLabel: 'Вимкнути доступ', danger: true })
        .then(function (ok) { if (ok) go(); });
    }
    ctx.on('tm-new', function () { openEdit(null); });
    ctx.on('tm-edit', function (t) { openEdit(find(t.getAttribute('data-id'))); });
    ctx.on('tr-add', function (t) { var rq = reqs.find(t.getAttribute('data-id')); if (rq && canAdd()) openEdit(null, rq); });   // v1.1: «Додати» в картці запитів
    ctx.on('tr-reject', function (t) { P.teamRequests.reject(reqs.find(t.getAttribute('data-id'))).then(function (ok) { if (ok && ctx.alive()) reqs.refresh(); }); });   // v1.2
    ctx.on('tm-access', access);
    ctx.on('tm-q', function (t) { flt.q = t.value; list(); });
    ctx.on('tm-loc', function (t) { flt.loc = t.value; list(); });
    ctx.on('tm-role', function (t) { flt.role = t.getAttribute('data-v'); frame(); list(); });
    load();
  } });
})(window);
