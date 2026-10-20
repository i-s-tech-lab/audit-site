(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, K = P.mlKit;
  var DS = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  var MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  var MAX_PER_DAY = 60, MAX_DAYS = 60, SHOW_ACTIONS = 30;   // дзеркала MAX_PER_RECIPIENT_DAY і SKIP_DAYS_MAX (сервер, mail-plan.mjs)

  if (P.help) {
    P.help.add({
      'admin.ml.days': { t: 'Дні без розсилок', d: 'У ці дні розсилки за розкладом (кожні N хвилин, щодня, щотижня) не надсилаються. Повідомлення після подій — надсилаються.\nДодайте свята й вихідні заводу. Минулі дні зникають зі списку самі. Усього — до ' + MAX_DAYS + ' днів.' },
      'admin.ml.changes': { t: 'Зміни розсилок', d: 'Останні дії з розсилками: що зберегли, увімкнули, видалили, коли. Slack-ID у записах скорочені.' }
    });
  }

  function dayText(date) {
    var p = String(date).split('-'), t = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return DS[t.getUTCDay()] + ', ' + +p[2] + ' ' + MONTHS[+p[1] - 1];
  }
  function cap(st) { return st && st.limits && st.limits.perRecipientDay || MAX_PER_DAY; }

  function mount(ctx, box, panelEl) {
    var days = [], today = '', st = null, editing = null, busy = false, shown = false, loadedAt = 0, errAdd = '', errEdit = '';

    function row(d) {
      if (editing === d.date) {
        return '<li class="rz-dayrow rz-dayrow--edit" data-dy-form="edit"><div class="rz-dayfields">' + field('Дата', '<input class="input" type="date" name="date" value="' + esc(d.date) + '"' + (today ? ' min="' + esc(today) + '"' : '') + '>') +
          field('Назва (необовʼязково)', '<input class="input" name="label" maxlength="40" value="' + esc(d.label || '') + '">') + '</div>' +
          (errEdit ? '<p class="err" role="alert">' + P.ic('error', 'ui-icon--sm') + esc(errEdit) + '</p>' : '') +
          '<div class="rz-btns"><button class="btn btn--primary btn--sm" type="button" data-act="dy-save">' + P.ic('save', 'ui-icon--sm') + 'Зберегти</button>' +
          '<button class="btn btn--quiet btn--sm" type="button" data-act="dy-cancel">Скасувати</button></div></li>';
      }
      var who = dayText(d.date) + (d.label ? ' · ' + d.label : '');
      return '<li class="rz-dayrow"><span class="rz-dayrow__t"><b>' + esc(dayText(d.date)) + '</b>' + (d.label ? ' · ' + esc(d.label) : '') + '</span>' +
        '<span class="rz-dayrow__a"><button class="icon-btn" type="button" data-act="dy-edit" data-date="' + esc(d.date) + '" aria-label="Змінити · ' + esc(who) + '" title="Редагувати">' + P.ic('edit') + '</button>' +
        '<button class="icon-btn" type="button" data-act="dy-del" data-date="' + esc(d.date) + '" aria-label="Прибрати · ' + esc(who) + '" title="Прибрати">' + P.ic('delete') + '</button></span></li>';
    }
    function field(label, inner) { return '<label class="field"><span class="label">' + esc(label) + '</span>' + inner + '</label>'; }
    function daysCard() {
      return '<section class="card rz-days"><div class="rz-scard__h"><h3 class="card-title">Дні без розсилок' + (P.help ? P.help.btn('admin.ml.days') : '') + '</h3>' +
        (days.length ? '<span class="badge">' + days.length + '</span>' : '') + '</div>' +
        '<p class="rz-days__d">У ці дні розсилки за розкладом не надсилаються; повідомлення після подій — надсилаються. Зручно для свят і вихідних заводу.</p>' +
        (days.length ? '<ul class="rz-daylist">' + days.map(row).join('') + '</ul>' : '<p class="hint">Таких днів немає — розсилки йдуть у дні, обрані в самій розсилці.</p>') +
        '<div class="rz-dayadd" data-dy-form="add"><div class="rz-dayfields">' + field('Дата', '<input class="input" type="date" name="date"' + (today ? ' min="' + esc(today) + '"' : '') + '>') +
        field('Назва (необовʼязково)', '<input class="input" name="label" maxlength="40" placeholder="Напр. Новий рік">') + '</div>' +
        '<button class="btn btn--secondary" type="button" data-act="dy-add">' + P.ic('add', 'ui-icon--sm') + 'Додати день</button></div>' +
        (errAdd ? '<p class="err" role="alert">' + P.ic('error', 'ui-icon--sm') + esc(errAdd) + '</p>' : '') +
        '<p class="hint">До ' + MAX_DAYS + ' днів; минулі зникають самі.</p></section>';
    }
    function actionsCard() {
      if (!st || !Array.isArray(st.actions)) return '';   // демо-сервер журналу дій не веде
      var list = st.actions.slice(0, SHOW_ACTIONS);
      return '<section class="card rz-chg"><div class="rz-scard__h"><h3 class="card-title">Зміни розсилок · останні ' + SHOW_ACTIONS + (P.help ? P.help.btn('admin.ml.changes') : '') + '</h3></div>' +
        (list.length ? '<ul class="rz-chglist">' + list.map(function (a) {
          return '<li><span class="rz-chg__t">' + esc(P.fmt.dateTime(a.at)) + '</span><span class="rz-chg__b"><b>' + esc(a.action || 'Зміна') + '</b>' + (a.detail ? '<span class="hint">' + esc(a.detail) + '</span>' : '') + '</span></li>';
        }).join('') + '</ul>' : '<p class="hint">Змін ще не було.</p>') + '</section>';
    }
    function draw() {
      box.innerHTML = K.box('info', 'Одному отримувачу — не більше ' + cap(st) + ' повідомлень на добу (усі розсилки разом).') + '<div class="rz-dgrid">' + daysCard() + actionsCard() + '</div>';
    }

    function load() {
      if (busy) return;
      busy = true; shown = true;
      Promise.all([P.mlApi.call('mlSkipDays', {}), P.mailProbe.call('status', {})]).then(function (res) {
        busy = false;
        if (!ctx.alive()) return;
        var r = res[0];
        if (!r.ok) { box.innerHTML = r.code === 'mail_auth' ? '' : '<section class="card">' + P.state.error('Не вдалося прочитати дні без розсилок', r.error) + '</section>'; shown = r.code !== 'mail_auth'; return; }
        days = r.items || []; today = r.today || ''; st = res[1] && res[1].ok ? res[1] : null; loadedAt = Date.now();
        if (editing && !days.some(function (d) { return d.date === editing; })) editing = null;
        draw();
      });
    }
    function sync() {
      if (!ctx.alive()) { if (mo) mo.disconnect(); return; }
      if (!panelEl.querySelector('.rz-sgrid')) { if (shown && !busy) { box.innerHTML = ''; shown = false; } return; }
      if (!shown || (Date.now() - loadedAt > 25000 && !editing && !box.contains(root.document.activeElement))) load();
    }
    var mo = typeof root.MutationObserver === 'function' ? new root.MutationObserver(sync) : null;
    if (mo) mo.observe(panelEl, { childList: true });
    sync();

    function val(form, name) { var i = form.querySelector('[name="' + name + '"]'); return i ? i.value : ''; }
    function saved(r, toast) {
      if (!r.ok) {
        if (r.code === 'mail_auth') { P.toast('warn', 'Введіть код розсилки', r.error); return false; }
        if (r.code === 'validation') return r.error;
        P.toast('danger', 'Не вдалося зберегти', r.error); return false;
      }
      days = r.items; today = r.today || today; editing = null; errAdd = ''; errEdit = '';
      P.toast('ok', toast); draw();
      return true;
    }
    ctx.on('dy-add', function (t) {
      var form = t.closest('[data-dy-form]'); if (!form || t.disabled) return;
      var d = val(form, 'date'), l = val(form, 'label');
      t.disabled = true;
      P.mlApi.call('mlSkipDaySave', { date: d, label: l }).then(function (r) {
        if (!ctx.alive()) return;
        t.disabled = false;
        var x = saved(r, 'День додано · ' + (d ? dayText(d) : ''));
        if (typeof x === 'string') { errAdd = x; draw(); var i = box.querySelector('.rz-dayadd [name="date"]'); if (i) { i.value = d; box.querySelector('.rz-dayadd [name="label"]').value = l; } }
      });
    });
    ctx.on('dy-edit', function (t) { editing = t.getAttribute('data-date'); errEdit = ''; errAdd = ''; draw(); var i = box.querySelector('.rz-dayrow--edit [name="date"]'); if (i) i.focus(); });
    ctx.on('dy-cancel', function () { editing = null; errEdit = ''; draw(); });
    ctx.on('dy-save', function (t) {
      var form = t.closest('[data-dy-form]'); if (!form || t.disabled) return;
      var d = val(form, 'date'), l = val(form, 'label'), old = editing;
      t.disabled = true;
      P.mlApi.call('mlSkipDaySave', { date: d, label: l, oldDate: old }).then(function (r) {
        if (!ctx.alive()) return;
        t.disabled = false;
        var x = saved(r, 'День змінено · ' + (d ? dayText(d) : ''));
        if (typeof x === 'string') { errEdit = x; draw(); var f = box.querySelector('.rz-dayrow--edit'); if (f) { f.querySelector('[name="date"]').value = d; f.querySelector('[name="label"]').value = l; } }
      });
    });
    ctx.on('dy-del', function (t) {
      var date = t.getAttribute('data-date'), item = days.filter(function (d) { return d.date === date; })[0]; if (!item) return;
      P.confirm({ title: 'Прибрати день «' + dayText(date) + (item.label ? ' · ' + item.label : '') + '»?', text: 'У цей день розсилки за розкладом знову надсилатимуться.', okLabel: 'Прибрати', danger: true })
        .then(function (ok) {
          if (!ok) return;
          P.mlApi.call('mlSkipDayDelete', { date: date }).then(function (r) { if (ctx.alive()) saved(r, 'День прибрано · ' + dayText(date)); });
        });
    });
    box.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !e.target.matches('input.input')) return;
      var form = e.target.closest('[data-dy-form]'), b = form && form.querySelector('[data-act="dy-add"],[data-act="dy-save"]');
      if (b && !b.disabled) { e.preventDefault(); b.click(); }
    });
  }

  P.mlDays = { mount: mount, dayText: dayText };
})(window);
