(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm, K = P.mlKit, q = A.q, da = A.da;
  var flt = { q: '', loc: 'all' };   // пошук і локація живуть, поки відкрита сторінка

  P.cab.screen('/mailing/addr', { tab: 'mailing', title: 'Адресати розсилок', render: function (ctx) {
    var data = null, rules = null;
    function find(id) { return data.items.filter(function (x) { return x.id === id; })[0]; }
    function locOf(id) { return data.locations.filter(function (l) { return l.id === id; })[0] || null; }
    function locName(id) { var l = locOf(id); return l ? l.name : id; }
    function depName(a) {
      if (!a.departmentId) return 'уся локація';
      var l = locOf(a.locationId), d = l ? (l.departments || []).filter(function (x) { return x.id === a.departmentId; })[0] : null;
      return d ? d.name : a.departmentId;
    }
    function rulesOf(a) { return rules ? rules.filter(function (r) { return (r.to || []).some(function (t) { return t.type === 'user' && t.id === a.slackId; }); }) : null; }
    function shown() {
      var s = flt.q.trim().toLowerCase();
      return data.items.filter(function (a) {
        return (flt.loc === 'all' || a.locationId === flt.loc) && (!s || a.name.toLowerCase().indexOf(s) >= 0 || String(a.jobTitle || '').toLowerCase().indexOf(s) >= 0 || String(a.slackId).toLowerCase().indexOf(s) >= 0);
      });
    }
    function inRules(a) {
      var list = rulesOf(a);
      if (!list) return '<span class="hint">—</span>';
      if (!list.length) return '<span class="hint">ще в жодній</span>';
      return '<a href="#/mailing?q=' + encodeURIComponent(a.name) + '">' + list.length + ' ' + K.plural(list.length, ['розсилка', 'розсилки', 'розсилок']) + '</a>' + (a.active ? '' : ' <span class="hint">— не отримує</span>');
    }
    function row(a) {
      return '<tr class="rz-at__r' + (a.active ? '' : ' is-off') + '"><td data-l="Хто"><div class="rz-at__who"><span class="avatar" aria-hidden="true">' + esc(P.initials(a.name)) + '</span><div><b>' + esc(a.name) + '</b>' +
          (a.jobTitle ? '<span class="hint">' + esc(a.jobTitle) + '</span>' : '') + '</div></div></td>' +
        '<td data-l="Slack ID" class="rz-at__id">' + esc(K.maskId(a.slackId)) + '</td><td data-l="Де працює">' + esc(locName(a.locationId) + ' · ' + depName(a)) + '</td>' +
        '<td data-l="У розсилках">' + inRules(a) + '</td>' +
        '<td data-l="Отримує повідомлення"><span class="rz-at__on">' + A.sw(a.active, 'ad-on', da('id', a.id), (a.active ? 'Вимкнути' : 'Увімкнути') + ' повідомлення · ' + a.name) + (a.active ? 'Так' : 'Ні — вимкнено') + '</span></td>' +
        '<td class="rz-at__acts">' + A.pen('ad-edit', da('id', a.id), 'Змінити · ' + a.name) +
          '<button class="icon-btn" type="button" data-act="ad-del"' + da('id', a.id) + ' aria-label="Видалити · ' + esc(a.name) + '" title="Видалити">' + P.ic('delete') + '</button></td></tr>';
    }
    function drawList() {
      var box = q(ctx.el, '[data-ad-list]'); if (!box) return;
      var list = shown();
      box.innerHTML = list.length ? '<table class="table rz-at"><thead><tr><th>Хто</th><th>Slack ID</th><th>Де працює</th><th>У розсилках</th><th>Отримує повідомлення</th><th><span class="ui-sr-only">Дії</span></th></tr></thead><tbody>' +
        list.map(row).join('') + '</tbody></table>' : H.empty(data.items.length ? 'Нікого не знайдено' : 'Адресатів ще немає',
        data.items.length ? 'Змініть пошук чи локацію.' : 'Додайте тімліда чи іншу людину без доступу до кабінетів кнопкою «Додати адресата».');
      q(ctx.el, '[data-ad-n]').textContent = list.length === data.items.length ? '' : 'Показано ' + list.length + ' з ' + data.items.length;
    }
    function draw() {
      K.setCounts('addr', data.items.length);
      ctx.el.innerHTML = '<section class="rz">' + K.subnav('addr') +
        '<div class="rz-head"><div><h2 class="h2">Адресати розсилок · ' + data.items.length + A.help('admin.ml.addr') + '</h2>' +
          '<p class="h2-sub"><b>Люди, яким розсилка пише особисто, хоча вони не входять у кабінети.</b> Наприклад, тімліди відділів: їм потрібні повідомлення про аудити свого відділу, а кабінет — ні. ' +
          'Людей із доступом до кабінетів сюди додавати не треба — вони вже є в розсилці, у «Люди й доступи».</p></div>' + A.btnNew('ad-new', 'Додати адресата') + '</div>' +
        (data.items.length ? '<div class="card rz-tools"><label class="field rz-tools__q"><span class="label">Знайти адресата</span><input class="input" type="search" data-input="ad-q" value="' + esc(flt.q) + '" placeholder="Імʼя, посада або Slack ID"></label>' +
          '<label class="field rz-tools__loc"><span class="label">Локація</span><select class="input rz-sel" data-change="ad-loc"><option value="all">Усі локації</option>' + data.locations.map(function (l) {
            return '<option value="' + esc(l.id) + '"' + (l.id === flt.loc ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select></label></div>' : '') +
        '<section class="card rz-atbox"><p class="hint" data-ad-n></p><div data-ad-list></div></section>' +
        K.box('info', '<b>Вимкнути</b> — людина лишається в розсилках, але нічого не отримує, доки не ввімкнете знову. Зручно на час відпустки.<br>' +
          '<b>Видалити</b> — людина зникає зі списку назавжди, і повідомлення їй більше не йдуть. У розсилках на її місці зʼявиться «немає в списку» — приберіть її звідти.<br>' +
          '<b>Slack ID</b> показано скорочено (U…961), щоб не світити повний ID на екрані. Повний — у вікні «Змінити».') + '</section>';
      var nav = q(ctx.el, '.rz-subnav'); if (nav) nav.outerHTML = K.subnav('addr');
      drawList();
    }
    function load() {
      Promise.all([P.mlApi.call('mlAddrList', {}), P.mlApi.call('mlRules', {})]).then(function (res) {
        if (!ctx.alive()) return;
        var r = res[0];
        if (r.code === 'mail_auth') { ctx.el.innerHTML = '<section class="rz">' + K.subnav('addr') + P.mlApi.loginHtml(r.noCode ? '' : r.error) + '</section>'; return; }
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        data = r; rules = res[1] && res[1].ok ? res[1].items : null;
        if (res[1] && res[1].ok) K.setCounts('rules', res[1].items.length);
        draw();
      });
    }

    function depOptions(locId, cur) {
      var l = locOf(locId);
      return '<option value="">Уся локація</option>' + (l ? (l.departments || []) : []).map(function (d) {
        return '<option value="' + esc(d.id) + '"' + (d.id === cur ? ' selected' : '') + '>' + esc(d.name) + '</option>'; }).join('');
    }
    function lab(text, opt, key) { return '<span class="label">' + esc(text) + (opt ? ' <span class="rz-opt">— необовʼязково</span>' : '') + A.help(key) + '</span>'; }
    function fld(name, label, inner, hint, opt, key) { return '<label class="field" data-f="' + name + '">' + lab(label, opt, key) + inner + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</label>'; }
    function openEdit(a) {
      var st = { active: a ? a.active : true }, used = a ? rulesOf(a) : null;
      A.modal({ size: 'sm', title: a ? 'Змінити адресата · ' + a.name : 'Додати адресата',
        sub: 'Адресат — людина без доступу до кабінетів, якій розсилка пише особисто. Зміни діють одразу після «Зберегти».',
        body: '<div class="adm-form">' +
          '<div class="rz-grid rz-grid--2">' + fld('name', 'Імʼя', A.input('name', a ? a.name : '', ' autocomplete="off" maxlength="60" placeholder="Ірина Т."'), 'Як упізнаєте людину в списку й у полі «Кому». Імʼя та перша літера прізвища.') +
            fld('jobTitle', 'Посада', A.input('jobTitle', a ? a.jobTitle || '' : '', ' autocomplete="off" maxlength="40" placeholder="тімлід Пошиву"'), 'Показується під імʼям, щоб не сплутати двох людей з однаковим імʼям.', true) + '</div>' +
          '<div class="field" data-f="slackId">' + lab('Slack ID', false, 'admin.people.slackId') +
            '<div class="rz-addrow"><input class="input" name="slackId" value="' + esc(a ? a.slackId : '') + '" autocomplete="off" maxlength="40" placeholder="напр. U012345678" aria-label="Slack ID">' +
            '<button class="btn btn--secondary" type="button" data-act="ad-lookup">' + P.ic('search', 'ui-icon--sm') + 'Перевірити в Slack</button></div>' +
            '<div data-lookup-out aria-live="polite"></div>' +
            '<span class="hint"><b>Де взяти:</b> у Slack відкрийте профіль людини → «⋯» → «Скопіювати ID учасника». Починається з U або W, напр. U012345678. Саме на цей ID бот «Аудит» надсилатиме повідомлення.</span></div>' +
          '<div class="rz-grid rz-grid--2">' + fld('locationId', 'Локація', '<select class="input" name="locationId">' + (a ? '' : '<option value="">Оберіть локацію</option>') + data.locations.map(function (l) {
              return '<option value="' + esc(l.id) + '"' + (a && l.id === a.locationId ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select>', 'Де людина працює.') +
            fld('departmentId', 'Відділ', '<select class="input" name="departmentId">' + depOptions(a ? a.locationId : '', a ? a.departmentId : '') + '</select>', '«Уся локація» — якщо відповідає за весь цех.', true) + '</div>' +
          K.box('info', '<b>Локація й відділ тут — для довідки й пошуку.</b> Які саме аудити людина отримає, задає розсилка: крок 2 «Де» і крок 4 «Кому».') +
          '<div class="field" data-f="active"><span class="label">Отримує повідомлення</span>' + A.seg('active', [['true', 'Так'], ['false', 'Ні — вимкнено']], String(st.active)) +
            '<span class="hint">«Ні» — людина лишається в розсилках, але нічого не отримує. Зручно на час відпустки.</span></div>' +
          (a ? '<p class="hint">' + (used == null ? '' : used.length ? 'Розсилки з ' + esc(a.name) + ': ' + used.map(function (r) { return '«' + esc(r.title) + '»'; }).join(', ') + '.' : esc(a.name) + ' ще не входить у жодну розсилку — додайте в кроці 4 «Кому» потрібної розсилки.') + '</p>' : '') +
          '</div>',
        foot: (a ? '<button class="btn btn--quiet rz-btn-del" type="button" data-act="ad-del-in">' + P.ic('delete', 'ui-icon--sm') + 'Видалити адресата</button>' : '') +
          A.cancelBtn() + A.saveBtn(a ? 'Зберегти адресата' : 'Додати адресата', a ? 'save' : 'add'),
        onMount: function (el) {
          q(el, '.modal').className += ' rz-amodal';   // ширше за звичайне маленьке вікно: два поля в ряд і три кнопки внизу
          A.enterSubmits(el);
          q(el, '[name="locationId"]').addEventListener('change', function (e) { q(el, '[name="departmentId"]').innerHTML = depOptions(e.target.value, ''); });
        },
        on: {
          'adm-seg': function (t, e, layer) { st.active = A.segPick(layer, t) === 'true'; },
          'ad-del-in': function (t, e, layer) { remove(a, function () { layer.close(); }); },
          'ad-lookup': function (t, e, layer) {
            var out = q(layer.el, '[data-lookup-out]'), id = A.val(layer.el, 'slackId').trim();
            if (!id) { out.innerHTML = K.box('warn', 'Впишіть Slack ID, щоб перевірити, чий він.'); return; }
            t.disabled = true;
            P.authSlack.lookup(id).then(function (r) {
              t.disabled = false;
              out.innerHTML = !r.ok ? K.box('bad', esc(r.error || 'Не вдалося перевірити.')) : r.found ? K.box('ok', 'У Slack цей ID належить: <b>' + esc(r.name) + '</b>.')
                : K.box('bad', '<b>У Slack такої людини немає.</b> Перевірте ID — можливо, скопіювали не повністю.');
            });
          },
          'adm-save': function (t, e, layer) {
            var p = { name: A.val(layer.el, 'name'), jobTitle: A.val(layer.el, 'jobTitle'), slackId: A.val(layer.el, 'slackId'), locationId: A.val(layer.el, 'locationId') || null,
              departmentId: A.val(layer.el, 'departmentId') || null, active: st.active };
            if (a) p.id = a.id;
            t.disabled = true;
            P.mlApi.call('mlAddrSave', p).then(function (r) {
              t.disabled = false;
              if (!r.ok) { A.showErrors(layer.el, r); if (r.code === 'mail_auth') { layer.close(); if (ctx.alive()) load(); } return; }
              layer.close();
              P.toast('ok', (r.created ? 'Адресата додано · ' : 'Збережено · ') + r.item.name, r.created ? 'Тепер його можна обрати в кроці 4 «Кому» розсилки.' : '');
              if (ctx.alive()) load();
            });
          }
        } });
    }
    function toggle(t) {
      var a = find(t.getAttribute('data-id')); if (!a) return;
      t.disabled = true;
      P.mlApi.call('mlAddrSave', { id: a.id, name: a.name, jobTitle: a.jobTitle || '', slackId: a.slackId, locationId: a.locationId, departmentId: a.departmentId, active: !a.active }).then(function (r) {
        if (!ctx.alive()) return;
        t.disabled = false;
        if (!r.ok) { if (r.code === 'validation') P.toast('warn', 'Не збережено', r.error); else A.failToast(r); return; }
        P.toast('ok', (r.item.active ? 'Отримує повідомлення · ' : 'Вимкнено · ') + r.item.name, r.item.active ? '' : 'Лишається в розсилках, але нічого не отримує.');
        load();
      });
    }
    function remove(a, done) {
      P.confirm({ title: 'Видалити адресата · ' + a.name + '?', text: 'Людина зникне зі списку назавжди, і повідомлення їй більше не надсилатимуться. У розсилках, де вона є в «Кому», зʼявиться «немає в списку». Щоб лише призупинити — оберіть «Отримує повідомлення: Ні».', okLabel: 'Видалити', danger: true })
        .then(function (ok) {
          if (!ok) return;
          P.mlApi.call('mlAddrDelete', { id: a.id }).then(function (r) {
            if (!ctx.alive()) return;
            if (!r.ok) { A.failToast(r); if (r.code === 'not_found') load(); return; }
            if (done) done();
            P.toast('ok', 'Видалено · ' + r.name); load();
          });
        });
    }
    P.mlApi.bindLogin(ctx.el, function () { ctx.el.innerHTML = H.loading(); load(); });
    ctx.on('ad-new', function () { openEdit(null); });
    ctx.on('ad-edit', function (t) { var a = find(t.getAttribute('data-id')); if (a) openEdit(a); });
    ctx.on('ad-del', function (t) { var a = find(t.getAttribute('data-id')); if (a) remove(a); });
    ctx.on('ad-on', toggle);
    ctx.on('ad-q', function (t) { flt.q = t.value; drawList(); });
    ctx.on('ad-loc', function (t) { flt.loc = t.value; drawList(); });
    ctx.el.innerHTML = H.loading();
    load();
  } });
})(window);
