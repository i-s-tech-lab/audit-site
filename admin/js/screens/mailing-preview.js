(function (root) {
  'use strict';
  var P = root.P, esc = P.esc;

  function slackHtml(text, links) {
    var h = esc(text).replace(/\{([^{}\s]{1,20})\}/g, function (all, n) {
      return Object.prototype.hasOwnProperty.call(links, n) ? '<span class="rz-link">' + esc(links[n]) + '</span>' : all;
    });
    return h.replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s).,!?])/gm, '$1<i>$2</i>').replace(/\n/g, '<br>');
  }
  function locsOf(data, l) { return data.locations.filter(function (x) { return l === 'all' || !l || !l.length || l.indexOf(x.id) >= 0; }); }
  function textFor(d, locId) { return P.mlApi.call('mlRulePreview', { locationId: locId, template: d.template, departments: d.departments }); }
  function sendHint() {
    var ch = P.mlKit.chan();
    return P.mailProbe && P.mailProbe.has()
      ? 'Піде лише в тестовий канал' + (ch ? ' #' + ch : '') + ', з позначкою «цифри вигадані». Отримувачі з кроку 4 нічого не отримають. Не частіше разу на хвилину.'
      : 'Щоб надіслати в Slack, спершу введіть код розсилки на сторінці «Розсилки».';
  }

  function testSend(btn, d, locId, showErrors) {
    if (!P.mailProbe || !P.mailProbe.has()) { P.toast('info', 'Спершу введіть код розсилки', 'Форма коду — на сторінці «Розсилки».'); return; }
    if (!String(d.template).trim()) { showErrors({ code: 'validation', errors: [{ field: 'template', message: 'Напишіть текст повідомлення.' }] }); return; }
    btn.disabled = true;
    textFor(d, locId).then(function (r) {
      if (!r || !r.ok) return r || { ok: false, code: 'server', error: 'Не вдалося порахувати цифри — спробуйте ще раз.' };
      return P.mailProbe.call('sendPreview', { title: d.title, text: r.text });
    }).then(function (r) {
      btn.disabled = false;
      if (r.ok && r.sent) P.toast('ok', 'Пробне — надіслано' + (r.channelName ? ' в #' + r.channelName : ''), 'Перевірте тестовий канал у Slack.');
      else if (r.ok) P.toast('warn', 'Пробне — у черзі', (r.warning ? r.warning + ' ' : '') + 'Надішлеться автоматично — натискати ще раз не треба.');
      else if (r.code === 'validation' && r.errors) showErrors(r);
      else P.toast('danger', 'Пробне не надіслано', r.error);
    });
  }

  function mount(el, data) {
    var cur = data.locations.length ? data.locations[0].id : null, draft = null, timer = null, seq = 0, last = null, onVars = null;

    el.innerHTML = '<div class="rz-side__h"><span class="rz-side__t">Як виглядатиме в Slack' + P.help.btn('admin.ml.preview') + '</span>' +
      '<select class="input rz-sel rz-sel--sm" data-rz-ploc aria-label="Цифри якої локації показати"></select></div>' +
      '<div data-rz-pv>' + P.state.loading('Рахую цифри…') + '</div><p class="hint" data-rz-pvnote></p>';
    var box = el.querySelector('[data-rz-pv]'), note = el.querySelector('[data-rz-pvnote]'), sel = el.querySelector('[data-rz-ploc]');
    sel.addEventListener('change', function () { cur = sel.value; run(); });

    function setLocations(l) {
      var list = locsOf(data, l);
      if (!list.some(function (x) { return x.id === cur; })) { cur = list.length ? list[0].id : null; if (draft) run(); }
      sel.innerHTML = list.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === cur ? ' selected' : '') + '>Цифри: ' + esc(x.name) + '</option>'; }).join('');
      sel.hidden = list.length < 2;
    }
    function fetchNow() { var my = ++seq; return textFor(draft, cur).then(function (r) { return my === seq ? r : null; }); }
    function run() {
      clearTimeout(timer);
      fetchNow().then(function (r) {
        if (!r || !root.document.body.contains(el)) return;
        if (!r.ok) { box.innerHTML = '<p class="err" role="alert">' + P.ic('error', 'ui-icon--sm') + esc(r.error || 'Не вдалося порахувати цифри.') + '</p>'; note.textContent = ''; return; }
        last = r;
        if (onVars) onVars(r.vars || {});   // ті самі цифри — прикладами у фішках редактора тексту
        box.innerHTML = '<div class="rz-slack"><span class="rz-slack__ava" aria-hidden="true">А</span><div class="rz-slack__msg">' +
          '<p class="rz-slack__who"><b>Аудит</b> <span class="hint">бот · ' + esc(P.fmt.time(r.at)) + '</span></p>' +
          (String(r.text).trim() ? '<div class="rz-slack__text">' + slackHtml(r.text, data.options.links) + '</div>' : '<p class="hint">Тут зʼявиться текст повідомлення з кроку 6.</p>') + '</div></div>';
        note.innerHTML = 'Цифри тут — <b>вигадані</b>, для прикладу: дані «' + esc(r.location.name) + '»' + (r.onlyDepartments ? ' лише по вибраних відділах' : '') +
          ' за сьогодні, станом на ' + esc(P.fmt.time(r.at)) + '. Справжні зʼявляться, коли буде база аудитів.';
      });
    }
    function update(d) { draft = d; clearTimeout(timer); timer = setTimeout(run, last ? 250 : 0); }

    return { locations: setLocations, update: update,
      send: function (btn, d, showErrors) { draft = d; testSend(btn, d, cur, showErrors); },
      onVars: function (fn) { onVars = fn; if (fn && last) fn(last.vars || {}); } };
  }

  function sendRule(btn, r, data) {
    var l = locsOf(data, r.locations)[0];
    testSend(btn, r, l ? l.id : null, function (x) { P.toast('warn', 'Пробне не надіслано', (x.errors && x.errors[0] && x.errors[0].message) || x.error); });
  }
  function vars(r, data) {
    var l = locsOf(data, r.locations)[0];
    if (!l) return Promise.resolve({});
    return textFor(r, l.id).then(function (x) { return x && x.ok ? x.vars || {} : {}; });
  }

  P.mlPreview = { mount: mount, slackHtml: slackHtml, sendRule: sendRule, vars: vars, sendHint: sendHint };
})(window);
