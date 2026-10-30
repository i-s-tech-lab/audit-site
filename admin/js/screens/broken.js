(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm, da = A.da, q = A.q, doc = root.document;
  if (!P.cab) return;

  function isReal() { return !!(P.cab.real && P.cab.real()); }
  function recs(n) { return H.num(n) + ' ' + A.plural(n, ['запис', 'записи', 'записів']); }
  function when(iso) { return iso ? P.fmt.dateTime(iso) : '—'; }

  function copyId(id) {
    var nav = root.navigator;
    function fallback() { P.toast('info', 'Не вдалося скопіювати', 'Виділіть номер ' + id + ' і натисніть Ctrl+C.'); }
    if (nav && nav.clipboard && nav.clipboard.writeText) nav.clipboard.writeText(id).then(function () { P.toast('ok', 'Номер скопійовано', id); }, fallback);
    else fallback();
  }

  function historyLine(h) { return when(h.at) + ' · ' + h.byName + ' · ' + h.fnLabel + ' (' + h.opLabel + ')'; }

  function row(x) {
    var last = x.history && x.history[0] ? '<span class="adm-br-last">Остання зміна: ' + esc(historyLine(x.history[0])) + '</span>' : '';
    return '<li class="adm-br-row" data-act="br-open"' + da('id', x.id) + da('kind', x.kind) + '>' +
      '<div class="adm-br-top"><button class="link adm-br-open" type="button" data-act="br-open"' + da('id', x.id) + da('kind', x.kind) + '>' + esc(x.id) + '</button>' +
        '<button class="icon-btn adm-br-copy" type="button" data-act="br-copy"' + da('id', x.id) + ' aria-label="Скопіювати номер ' + esc(x.id) + '" title="Скопіювати номер">' + P.ic('export') + '</button>' +
        H.badge(x.kind === 'audit' ? 'аудит' : 'довідник', 'info') + '</div>' +
      '<p class="adm-br-meta">' + esc(x.title) + (x.day ? ' · ' + esc(P.fmt.date(x.day + 'T12:00:00Z')) : '') + '</p>' +
      '<ul class="adm-br-problems">' + x.problems.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' + last + '</li>';
  }

  function historyBody(r) {
    if (!r.items.length) return H.empty('Змін у журналі немає', 'Запис міг з\'явитись до того, як почали вести журнал змін, або його перенесли зі старої системи.');
    return '<ol class="adm-br-hist">' + r.items.map(function (e) {
      var ch = e.same ? '<p class="hint">Записано без видимої різниці (наприклад, змінився лише порядок).</p>'
        : e.changes.length ? '<ul class="adm-br-ch">' + e.changes.map(function (c) {
          return '<li><span class="adm-br-path">' + esc(c.path || 'увесь запис') + '</span><span class="adm-br-ba"><span class="adm-br-was">було: ' + esc(c.before) + '</span>' +
            '<span class="adm-br-now">стало: ' + esc(c.after) + '</span></span></li>';
        }).join('') + '</ul>' + ((e.hiddenChanges || e.more) ? '<p class="hint">І ще змін: ' + H.num(e.hiddenChanges + e.more) + ' — показано перші.</p>' : '') : '';
      return '<li class="adm-br-h"><b>' + esc(e.fnLabel) + '</b> <span class="adm-dim">· ' + esc(e.opLabel) + '</span><p class="hint">' + esc(when(e.at)) + ' · ' + esc(e.byName) + '</p>' + ch + '</li>';
    }).join('') + '</ol>' + (r.items.length >= r.limit ? '<p class="hint">Показано останні ' + r.limit + ' змін.</p>' : '');
  }
  function advice(kind) {
    return '<div class="adm-br-todo"><h3 class="adm-card-t">Що робити' + A.help('admin.broken.todo') + '</h3>' + (kind === 'audit'
      ? '<ol><li>Подивіться, що не так, і історію змін нижче: хто й коли записав чи виправив аудит.</li>' +
        '<li>Виправте сам запис: старший аудитор відкриває «Історія аудитів» → аудит → «Виправити». Помилився вид браку чи виріб — просто оберіть правильний.</li>' +
        '<li>Не можна виправити (наприклад, запису не було), — видаліть аудит у вкладці «Аудити»: він піде в кошик на 30 днів.</li>' +
        '<li>Якщо такі записи зʼявляються знову, скопіюйте номер і передайте розробнику — разом з історією змін він знайде причину.</li></ol>'
      : '<ol><li>Виправте довідник: вкладка «Довідники» → потрібна локація → «Редагувати».</li>' +
        '<li>Якщо це повторюється, скопіюйте номер і передайте розробнику.</li></ol>') + '</div>';
  }

  function openDrawer(x) {
    var real = isReal(), layer = P.sr.drawer({ title: x.kind === 'audit' ? 'Аудит ' + x.id : x.title, sub: esc(x.title + (x.day ? ' · ' + P.fmt.date(x.day + 'T12:00:00Z') : '')),
      body: '', on: { 'br-copy': function () { copyId(x.id); }, retry: function () { loadHistory(); } } });
    var problems = '<div><h3 class="adm-card-t">Що не так' + A.help('admin.broken.what') + '</h3><ul class="adm-br-problems">' + x.problems.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>' +
      '<p class="hint"><button class="btn btn--secondary btn--sm" type="button" data-act="br-copy">' + P.ic('export', 'ui-icon--sm') + 'Скопіювати номер</button></p></div>';
    function draw(hist) {
      layer.body(problems + '<div><h3 class="adm-card-t">Історія змін' + A.help('admin.broken.history') + '</h3><div data-br-hist>' + hist + '</div></div>' + advice(x.kind));
    }
    function loadHistory() {
      draw(H.loading());
      P.srv('admBrokenHistory', { id: x.id }).then(function (r) {
        if (layer.closed) return;
        draw(r && r.ok ? historyBody(r) : H.error(r || { ok: false, error: 'Не вдалося отримати історію.' }));
      });
    }
    if (x.kind !== 'audit') draw('<p class="hint">Для довідників історія змін — у вкладці «Довідники»: біля кожного довідника видно, хто й коли змінював його останнім.</p>');
    else if (!real) draw('<div class="banner">' + P.ic('info', 'icon') + '<div class="banner__body"><p class="banner__title">Історія змін є лише на справжньому сервері</p>' +
      '<p class="banner__text">Тут, на тестовому сайті, журнал змін не ведеться. На справжньому сервері біля кожного запису видно: хто, коли, яка дія і що було → що стало.</p></div></div>');
    else loadHistory();
  }

  P.cab.tab({ id: 'broken', label: 'Биті записи', ic: 'warning', path: '/broken', order: 36, real: ['admBroken', 'admBrokenHistory'] });   // real — видно, коли обидві функції є на двигуні сервера
  P.cab.screen('/broken', { tab: 'broken', title: 'Биті записи', render: function (ctx) {
    var data = null, failed = null, busy = false, seq = 0;

    function summary(r) {
      var checked = H.num(r.checked) + ' ' + A.plural(r.checked, ['аудит', 'аудити', 'аудитів']);
      return 'Перевірено ' + checked + ' і довідники · знайдено ' + H.num(r.total);
    }
    function draw() {
      var btn = '<button class="btn btn--primary" type="button" data-act="br-check"' + (busy ? ' disabled' : '') + '>' +
        (busy ? '<span class="ui-spinner ui-spinner--sm" aria-hidden="true"></span>Перевіряємо…' : P.ic('refresh') + 'Перевірити зараз') + '</button>';
      var body;
      if (failed) body = H.error(failed);
      else if (!data) body = H.loading();
      else {
        var r = data;
        body = '<div class="kpis">' + A.kpi(H.num(r.total), r.total === 1 ? 'битий запис' : 'биті записи', 'admin.broken.about') +
            A.kpi(H.num(r.checked), A.plural(r.checked, ['аудит перевірено', 'аудити перевірено', 'аудитів перевірено']), 'admin.broken.checked') + '</div>' +
          '<p class="hint adm-br-sum">' + esc(summary(r)) + ' · ' + esc(A.asOf()) + (r.skipped ? ' · ' + H.num(r.skipped) + ' перенесених зі старої системи не перевіряли' : '') +
            A.help('admin.broken.legacy') + '</p>' +
          (r.total ? '<section class="card adm-flat"><ul class="adm-br-list">' + r.items.map(row).join('') + '</ul>' +
            (r.truncated ? '<p class="hint">Показано перші ' + H.num(r.items.length) + ' з ' + H.num(r.total) + ' — виправте їх, і перевірте знову.</p>' : '') + '</section>'
            : H.empty('Усе гаразд — битих записів немає', 'Усі аудити й довідники відповідають правилам.')) +
          '<section class="card"><h3 class="adm-card-t">' + P.ic('list', 'ui-icon--sm') + 'Що перевіряємо' + A.help('admin.broken.rules') + '</h3>' +
            '<ul class="adm-br-rules">' + r.rules.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></section>';
      }
      ctx.el.innerHTML = '<section class="adm-col">' + A.head('Биті записи', 'Записи, які збереглись, але не відповідають правилам', btn, 'admin.broken.about') + body + '</section>';
    }
    function check(sinceClick) {
      var my = ++seq;
      busy = true; failed = null; draw();
      P.srv('admBroken', {}).then(function (r) {
        if (!ctx.alive() || my !== seq) return;
        busy = false;
        if (!r || !r.ok) { failed = r || { ok: false, error: 'Не вдалося отримати список.' }; data = null; draw(); return; }
        data = r; draw();
        if (sinceClick) P.toast(r.total ? 'warn' : 'ok', r.total ? 'Знайдено: ' + recs(r.total) : 'Усе гаразд', summary(r) + '.');
      });
    }
    function rowOf(id, kind) { return data ? data.items.filter(function (x) { return x.id === id && x.kind === kind; })[0] : null; }

    ctx.on('br-check', function () { if (!busy) check(true); });
    ctx.on('br-copy', function (t, e) { if (e && e.stopPropagation) e.stopPropagation(); copyId(t.getAttribute('data-id')); });
    ctx.on('br-open', function (t) {
      var x = rowOf(t.getAttribute('data-id'), t.getAttribute('data-kind'));
      if (x) openDrawer(x);
    });
    check(false);
  } });
})(window);
