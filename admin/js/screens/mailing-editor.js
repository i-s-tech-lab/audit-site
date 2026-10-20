(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, K = P.mlKit;
  var DEP_NONE = 'Оберіть хоча б один відділ.';   // той самий текст дає сервер (validRule): показуємо одразу, не чекаючи «Зберегти»
  var PH_HELP = { 'Сьогодні': 'admin.ml.ph.today', 'Відділи': 'admin.ml.ph.depts', 'Коригуючі дії': 'admin.ml.ph.kd', 'Посилання': 'admin.ml.ph.links' };
  var PH_DESC = { 'Сьогодні': 'цифри за сьогодні по обраних відділах', 'Відділи': 'відділ з найбільшим % браку й найчастіші види браку',
    'Коригуючі дії': 'скільки дій зараз у кожному стані', 'Посилання': 'посилання на наш сайт', 'Час': 'коли пішло повідомлення' };

  function da(k, v) { return ' data-' + k + '="' + esc(v) + '"'; }
  function q(el, sel) { return el.querySelector(sel); }
  function qa(el, sel) { return Array.prototype.slice.call(el.querySelectorAll(sel)); }
  function help(key) { return key ? P.help.btn(key) : ''; }
  function field(name, label, inner, extra) { return '<div class="field" data-f="' + name + '"><span class="label">' + esc(label) + (extra || '') + '</span>' + inner + '</div>'; }
  function seg(k, opts, cur) {
    return '<div class="seg rz-seg" role="radiogroup">' + opts.map(function (o) {
      return '<button class="seg__btn' + (o[0] === cur ? ' seg__btn--on' : '') + '" type="button" aria-pressed="' + (o[0] === cur) + '" data-act="rz-seg"' + da('k', k) + da('v', o[0]) + '>' + esc(o[1]) + '</button>';
    }).join('') + '</div>';
  }
  function chipPick(on, act, attrs, text) {
    return '<button class="chip-pick rz-pick' + (on ? ' chip-pick--on' : '') + '" type="button" aria-pressed="' + on + '" data-act="' + act + '"' + attrs + '>' + (on ? P.ic('check', 'ui-icon--sm') : '') + esc(text) + '</button>';
  }

  function draft(r) {
    r = JSON.parse(JSON.stringify(r || {}));
    var w = Object.assign({ kind: 'daily', every_min: 60, hour_from: 9, hour_to: 18, days: [1, 2, 3, 4, 5], at_time: '18:00', weekday: 1, event: 'audit', pct: 5 }, r.when || {});
    return { title: r.title || '', enabled: r.enabled === true, locations: r.locations === 'all' || !Array.isArray(r.locations) ? 'all' : r.locations,
      departments: Array.isArray(r.departments) ? r.departments : 'all', when: w, to: Array.isArray(r.to) ? r.to : [], condition: Object.assign({ kind: 'always', pct: 5 }, r.condition || {}), template: r.template || '' };
  }

  function open(o) {
    var data = o.data, id = o.id || null, d = draft(o.rule), layer, pv, to;
    var ce = null, vars = null, varsKey = '';   // редактор тексту з фішками і цифри-приклади з перегляду
    var ceHist = {};   // історія скасування тексту — на все вікно (форма перемальовується, а Ctrl+Z лишається)
    if (!id) d.enabled = false;   // нова розсилка — вимкнена, доки адмін сам не ввімкне
    var ix = K.people(data), labels = K.labels(data.options), locName = {}, dep = {}, depLoc = {};
    data.locations.forEach(function (l) { locName[l.id] = l.name; (l.departments || []).forEach(function (x) { dep[x.id] = x.name; depLoc[x.id] = l.id; }); });
    var allowEmpty = !!id && !((o.rule && o.rule.to) || []).length;
    to = P.mlTo.create({ draft: d, data: data, ix: ix, allowEmpty: allowEmpty, root: function () { return layer.el; },
      onAdd: function (t) { d.to.push(t); drawForm(); var i = q(layer.el, '[data-rz-to-q]'); if (i) i.focus(); } });

    function labelled() {
      var one = Array.isArray(d.locations) && d.locations.length === 1;
      return Object.assign({}, d, { locLabel: d.locations === 'all' ? 'усі локації' : d.locations.map(function (x) { return locName[x] || x; }).join(', '),
        depLabel: Array.isArray(d.departments) ? d.departments.map(function (x) { return (dep[x] || x) + (one || !depLoc[x] ? '' : ' (' + locName[depLoc[x]] + ')'); }).join(', ') : 'усі відділи' });
    }

    function whereHtml() {
      var some = d.locations !== 'all', ds = d.departments !== 'all';
      var groups = data.locations.filter(function (l) { return (d.locations === 'all' || d.locations.indexOf(l.id) >= 0) && (l.departments || []).length; });
      return field('locations', 'Локації', seg('loc', [['all', 'Усі локації'], ['some', 'Вибрані']], some ? 'some' : 'all') +
          (some ? '<div class="chips">' + data.locations.map(function (l) { return chipPick(d.locations.indexOf(l.id) >= 0, 'rz-loc', da('id', l.id), l.name); }).join('') + '</div>' : ''), help('admin.ml.locs')) +
        field('departments', 'Відділи', seg('dep', [['all', 'Усі відділи обраних локацій'], ['some', 'Вибрані відділи']], ds ? 'some' : 'all') +
          '<p class="hint">Оберіть «Вибрані відділи», щоб розсилка стосувалась, наприклад, лише Пошиву — так роблять для тімліда відділу. Подія «Новий аудит» тоді спрацює лише на аудити цих відділів.</p>' +
          (ds ? groups.map(function (l) {
            return '<div class="rz-depgrp"><span class="rz-depgrp__t">' + esc(l.name) + '</span><div class="chips">' + l.departments.map(function (x) {
              return chipPick(d.departments.indexOf(x.id) >= 0, 'rz-dep', da('id', x.id), x.name); }).join('') + '</div></div>'; }).join('') : ''), help('admin.ml.depts'));
    }
    function condHtml() {
      var c = d.condition, one = d.when.kind === 'event' && d.when.event === 'audit', ev = d.when.kind === 'event';
      return '<div class="rz-rlist" role="radiogroup" aria-label="Умова" data-f="condition">' +
        P.mlWhen.radio('rz-cond', 'always', c.kind === 'always', 'Завжди', ev ? 'Надсилати після кожної такої події.' : 'Надсилати щоразу за розкладом, навіть якщо аудитів не було.') +
        P.mlWhen.radio('rz-cond', 'audits', c.kind === 'audits', 'Лише якщо сьогодні були аудити', 'День без жодного аудиту в обраних відділах — пропустити, щоб не слати порожній звіт.') +
        P.mlWhen.radio('rz-cond', 'over', c.kind === 'over', 'Лише якщо брак, % ' + (one ? 'в аудиті' : 'за сьогодні') + ' понад поріг',
          'Напр., понад 5% — тоді повідомлення приходить лише в ті дні, коли брак понад поріг.', '<div class="rz-f" data-f="cond_pct">' + P.mlWhen.pctRow('cond_pct', c.pct, 'Поріг') + '</div>') + '</div>';
    }
    function textHtml() {
      return '<div class="rz-tplbox" data-f="template" data-rz-tpl></div>' +
        K.box('info', '<b>Як працювати з плашками:</b> натисніть — побачите, що це за вставка, і зможете замінити чи прибрати; перетягніть — переставите в інше місце. ' +
          'Плашка показує приклад, тож одразу видно, скільки місця займе число. <b>*Зірочки*</b> навколо слів — жирний у Slack, <b>_підкреслення_</b> — курсив.') +
        '<div class="rz-pal"><span class="label">Вставки — натисніть, щоб додати туди, де курсор, або перетягніть у текст</span>' + data.options.groups.map(function (g) {
          var link = g.title === 'Посилання';
          return '<div class="rz-palg"><div class="rz-palg__t"><b>' + esc(g.title) + help(PH_HELP[g.title]) + '</b>' + (PH_DESC[g.title] ? '<span>' + esc(PH_DESC[g.title]) + '</span>' : '') + '</div><div class="chips">' + g.items.map(function (x) {
            return '<button class="chip-pick rz-chip' + (link ? ' rz-chip--l' : '') + '" type="button" draggable="true" data-act="rz-ph"' + da('v', x[0]) + da('rz-drag', x[0]) +
              ' title="Натисніть — вставити туди, де курсор, або перетягніть у текст · {' + esc(x[0]) + '}">' + esc(x[1]) + '</button>'; }).join('') + '</div></div>';
        }).join('') + '</div>';
    }
    function formHtml() {
      return K.sec(1, 'Назва розсилки', 'Щоб упізнати її в списку. У Slack назва не показується — люди бачать лише текст із кроку 6.',
          field('title', 'Назва', '<input class="input" data-rz="title" value="' + esc(d.title) + '" maxlength="80" placeholder="Напр. Денний звіт цеху">' +
            '<span class="hint">До 80 знаків. Наприклад: «Денний звіт цеху», «Тімліду Пошиву — аудити з браком».</span>')) +
        K.sec(2, 'Де — для яких локацій і відділів', 'Цифри у вставках (перевірено, брак, відділи без аудитів) рахуються лише по тому, що оберете тут. Кожна локація отримує своє повідомлення.', whereHtml()) +
        K.sec(3, 'Коли надсилати', 'Час — завжди за Києвом. Оберіть один із чотирьох способів; під ним зʼявляться його налаштування.', P.mlWhen.html(d, data), help('admin.ml.when')) +
        K.sec(4, 'Кому надсилати — канал або людина', '<b>Канал</b> — повідомлення побачать усі учасники каналу Slack. <b>Людина</b> — отримає його особисто, від бота «Аудит». Можна змішувати, до 10 отримувачів.', to.html(), help('admin.ml.to')) +
        K.sec(5, 'Умова — коли надсилати, а коли пропустити', 'Розклад каже «коли», а умова — «чи варто». Якщо умова не виконалась, цього разу повідомлення просто не піде.', condHtml(), help('admin.ml.cond')) +
        K.sec(6, 'Текст повідомлення', 'Пишіть як звичайне повідомлення. <b>Помаранчева плашка</b> — вставка: у Slack замість неї буде справжнє число. <b>Синя</b> — посилання на наш сайт.', textHtml(), help('admin.ml.placeholders'));
    }
    function drawForm() { q(layer.el, '[data-rz-form]').innerHTML = formHtml(); pv.locations(d.locations); mountText(); side(); }
    function mountText() {
      ce = P.rzChips.mount(q(layer.el, '[data-rz-tpl]'), { value: d.template, groups: data.options.groups, links: data.options.links || {}, max: 1500, history: ceHist,
        placeholder: 'Напр. Перевірено {перевірено} шт · брак {брак_%}',
        sample: function (n) { return vars && Object.prototype.hasOwnProperty.call(vars, n) ? vars[n] : null; },
        onChange: function (v) { d.template = v; pv.update(d); side(); } });
    }
    function side() {
      var s = q(layer.el, '[data-rz-sum]'), w = q(layer.el, '[data-rz-wait]'), n = q(layer.el, '[data-rz-sendnote]');
      if (s) s.innerHTML = K.summary(labelled(), ix, allowEmpty);
      var why = K.waitWhy(d, labels);
      if (w) w.innerHTML = why ? K.box('warn', '<b>Поки чекатиме бази даних:</b> ' + esc(why) + '. Правило збережеться й запрацює саме, щойно база буде.') : '';
      if (n) n.textContent = P.mlPreview.sendHint();
    }
    function headHtml() {
      var ev = d.when.kind === 'event';
      return '<div class="rz-onbox' + (d.enabled ? ' is-on' : '') + '" data-rz-onbox><button class="toggle' + (d.enabled ? ' toggle--on' : '') + '" type="button" role="switch" aria-checked="' + d.enabled +
        '" aria-label="Розсилка ' + (d.enabled ? 'увімкнена — вимкнути' : 'вимкнена — увімкнути') + '" data-act="rz-on"></button><div><b>' + (d.enabled ? 'Увімкнено' : 'Вимкнено') + '</b><span class="hint">' +
        (d.enabled ? (ev ? 'надсилається після події' : 'надсилається за розкладом') : 'не надсилається, доки не ввімкнете') + '</span></div></div>';
    }

    function onField(t) {
      var k = t.getAttribute('data-rz'), v = t.value;
      if (k === 'title') d.title = v;
      else if (k === 'cond_pct') d.condition.pct = v;
      else if (k === 'every_min' || k === 'hour_from' || k === 'hour_to' || k === 'weekday') { d.when[k] = +v; if (t.tagName === 'SELECT') { drawForm(); return; } }
      else if (k) d.when[k] = v;   // at_time, pct
      side();
    }
    function dropDeps() {
      if (!Array.isArray(d.departments)) return;
      d.departments = d.departments.filter(function (x) { return d.locations === 'all' || d.locations.indexOf(depLoc[x]) >= 0; });
    }
    function depsChanged() {
      drawForm(); pv.update(d);
      if (Array.isArray(d.departments) && !d.departments.length) showErrors({ code: 'validation', errors: [{ field: 'departments', message: DEP_NONE }] });
    }
    function showErrors(r) {
      qa(layer.el, '.rz-err').forEach(function (e) { e.remove(); });
      if (r.code !== 'validation') { if (r.code !== 'forbidden') P.toast('danger', 'Не вдалося зберегти', r.error); return; }
      var first = null, lost = [];
      (r.errors || []).forEach(function (e) {
        var f = q(layer.el, '[data-rz-form] [data-f="' + e.field + '"]');
        if (!f) { lost.push(e.message); return; }
        f.insertAdjacentHTML('beforeend', '<p class="err rz-err" role="alert">' + P.ic('error', 'ui-icon--sm') + esc(e.message) + '</p>');
        if (!first) first = f;
      });
      if (first && first.scrollIntoView) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (lost.length) P.toast('warn', 'Не збережено', lost[0]);
    }
    function save(t) {
      t.disabled = true;
      P.mlApi.call('mlRuleSave', { id: id, rule: d }).then(function (r) {
        t.disabled = false;
        if (!r.ok) { showErrors(r); return; }
        layer.close();
        P.toast('ok', (r.created ? 'Створено · ' : 'Збережено · ') + r.item.title, r.item.whenLabel + (r.item.enabled ? '' : ' · вимкнено — не надсилається'));
        if (o.onSaved) o.onSaved(r);
      });
    }

    layer = P.sr.modal({ title: id ? 'Розсилка · ' + d.title : 'Нова розсилка',
      sub: 'Шість кроків зверху вниз. Поруч (на телефоні — під кроками) одразу видно, що й кому піде. Нічого не надішлеться, поки не натиснете «Зберегти» і розсилка не буде увімкнена.', head: headHtml(),
      body: '<div class="rz-ed"><div class="rz-ed__form" data-rz-form></div><aside class="rz-ed__side" aria-label="Підсумок і перегляд">' +
        '<div class="rz-side"><span class="rz-side__t">Підсумок — що буде</span><p class="rz-sum" data-rz-sum></p></div>' +
        '<div class="rz-side" data-rz-prev></div><div data-rz-wait></div>' +
        '<div class="rz-side"><span class="rz-side__t">Перевірити перед збереженням</span><button class="btn btn--secondary" type="button" data-act="rz-test">' + P.ic('slack', 'ui-icon--sm') +
          'Надіслати пробне в ' + (K.chan() ? '#' + esc(K.chan()) : 'тестовий канал') + '</button><p class="hint" data-rz-sendnote></p></div></aside></div>',
      foot: '<p class="hint rz-ed__foot">Зміни ще не збережено. Правило збережеться в Supabase одразу після «Зберегти».</p><button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button>' +
        '<button class="btn btn--primary" type="button" data-act="rz-save">' + P.ic('save', 'ui-icon--sm') + 'Зберегти розсилку</button>',
      onMount: function (el) {
        q(el, '.modal').className += ' rz-modal';
        el.addEventListener('input', function (e) {
          if (e.target.hasAttribute('data-rz')) onField(e.target);
          else if (e.target.hasAttribute('data-rz-to-q')) to.input(e.target);
        });
        el.addEventListener('change', function (e) { if (e.target.hasAttribute('data-rz')) onField(e.target); });
        el.addEventListener('focusin', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-rz-to-q')) to.focus(e.target); });
        el.addEventListener('focusout', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-rz-to-q')) to.blur(); });
        el.addEventListener('keydown', function (e) { if (e.target.hasAttribute && e.target.hasAttribute('data-rz-to-q')) to.key(e); });
        el.addEventListener('mousedown', function (e) { if (e.target.closest('[data-rz-dd]')) e.preventDefault(); });
      },
      on: {
        'rz-on': function () { d.enabled = !d.enabled; q(layer.el, '[data-rz-onbox]').outerHTML = headHtml(); side(); },
        'rz-seg': function (t) {
          var k = t.getAttribute('data-k'), v = t.getAttribute('data-v');
          if (k === 'loc') { d.locations = v === 'all' ? 'all' : (d.locations !== 'all' ? d.locations : [data.locations[0].id]); dropDeps(); }
          else if (k === 'dep') d.departments = v === 'all' ? 'all' : (d.departments === 'all' ? [] : d.departments);
          depsChanged();
        },
        'rz-kind': function (t) { d.when.kind = t.getAttribute('data-v'); drawForm(); q(layer.el, '[data-rz-onbox]').outerHTML = headHtml(); },
        'rz-event': function (t) { d.when.event = t.getAttribute('data-v'); drawForm(); },
        'rz-cond': function (t) { d.condition.kind = t.getAttribute('data-v'); drawForm(); },
        'rz-loc': function (t) { var x = t.getAttribute('data-id'), i = d.locations.indexOf(x); if (i >= 0) d.locations.splice(i, 1); else d.locations.push(x); dropDeps(); depsChanged(); },
        'rz-dep': function (t) { var x = t.getAttribute('data-id'), i = d.departments.indexOf(x); if (i >= 0) d.departments.splice(i, 1); else d.departments.push(x); depsChanged(); },
        'rz-day': function (t) { var x = +t.getAttribute('data-d'), i = d.when.days.indexOf(x); if (i >= 0) d.when.days.splice(i, 1); else d.when.days.push(x); drawForm(); },
        'rz-to-rm': function (t) { d.to.splice(+t.getAttribute('data-i'), 1); drawForm(); },
        'rz-to-pick': function (t) { to.pick(t); },
        'rz-ph': function (t) { if (ce) ce.insert(t.getAttribute('data-v')); },
        'rz-test': function (t) { pv.send(t, d, showErrors); },
        'rz-save': save
      } });
    pv = P.mlPreview.mount(q(layer.el, '[data-rz-prev]'), data);
    pv.onVars(function (v) { var k = JSON.stringify(v); if (k === varsKey) return; varsKey = k; vars = v; if (ce) ce.refresh(); });
    drawForm();
    pv.update(d);
    return layer;
  }

  P.mlEditor = { open: open };
})(window);
