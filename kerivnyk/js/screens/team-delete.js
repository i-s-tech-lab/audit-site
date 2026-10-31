(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, T = P.authTeam;
  var CONFIRM_TEXT = 'Людина більше не зможе увійти й зникне зі списку. Її аудити й дії лишаються в історії. Повернути — додати її знову.';
  var MGR_HINT = 'Вимкнути керівника може адміністратор';
  var ASK_LABEL = 'Надіслати адміну запит на видалення';
  var REASON_MIN = 3, REASON_MAX = 500;

  function q(el, sel) { return el.querySelector(sel); }
  function icon(act, ic, label, id, tip) {
    return '<button class="icon-btn" type="button" data-act="' + act + '" data-id="' + esc(id) + '" aria-label="' + esc(label) + '" title="' + esc(tip) + '">' + P.ic(ic) + '</button>';
  }
  function btns(u) {
    if (u.canDelete) return icon('tm-del', 'delete', 'Видалити · ' + u.name, u.id, 'Видалити');
    if (u.canAskDelete && !u.deletePending) {
      return '<button class="btn btn--quiet btn--sm tm-ask" type="button" data-act="tm-ask" data-id="' + esc(u.id) + '" aria-label="' + esc(ASK_LABEL + ' · ' + u.name) + '" title="' + esc(ASK_LABEL) + '">' +
        P.ic('delete', 'ui-icon--sm') + esc(ASK_LABEL) + '</button>';
    }
    return u.deletePending ? '<span class="mgr-dim tm-pend">Запит на видалення надіслано</span>' : '';
  }
  function fail(r) { if (r && (r.code !== 'forbidden' || P.authSlack.real())) P.toast('danger', 'Не вдалося', (r && r.error) || ''); }

  function bind(ctx, o) {
    ctx.on('tm-del', function (t) {
      var u = o.find(t.getAttribute('data-id'));
      if (!u) return;
      P.confirm({ title: 'Видалити ' + u.name + '?', text: CONFIRM_TEXT, okLabel: 'Видалити', danger: true }).then(function (ok) {
        if (!ok) return;
        t.disabled = true;
        T.remove(u.id).then(function (r) {
          t.disabled = false;
          if (r && r.ok) P.toast('ok', 'Видалено · ' + u.name, ''); else fail(r);
          if (ctx.alive()) o.reload();
        });
      });
    });
    ctx.on('tm-ask', function (t) {
      var u = o.find(t.getAttribute('data-id'));
      if (!u) return;
      P.sr.modal({ size: 'sm', title: 'Запит на видалення', sub: esc(u.name),
        body: '<div class="tm-form"><p class="hint">Керівника видаляє адміністратор. Напишіть, чому його потрібно видалити, — адміністратор розгляне запит.</p>' +
          '<label class="field" data-f="reason"><span class="label">Причина</span><textarea class="input" name="reason" rows="4" maxlength="' + REASON_MAX + '"></textarea>' +
          '<span class="hint" data-tm-count>0 з ' + REASON_MAX + ' · від ' + REASON_MIN + ' знаків</span></label></div>',
        foot: '<button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button><button class="btn btn--primary" type="button" data-act="tm-ask-send">' + P.ic('check') + 'Надіслати</button>',
        onMount: function (el) {
          var box = q(el, '[name="reason"]'), cnt = q(el, '[data-tm-count]');
          q(el, '.modal').className += ' tm-modal';
          box.addEventListener('input', function () { cnt.textContent = box.value.length + ' з ' + REASON_MAX + ' · від ' + REASON_MIN + ' знаків'; });
        },
        on: {
          'tm-ask-send': function (b, e, layer) {
            var box = q(layer.el, '[name="reason"]'), reason = box.value.trim();
            if (reason.length < REASON_MIN || reason.length > REASON_MAX) {
              o.showErrors(layer.el, { ok: false, code: 'validation', error: 'Напишіть причину — від 3 до 500 знаків.', errors: [{ field: 'reason', message: 'Напишіть причину — від 3 до 500 знаків.' }] });
              return;
            }
            b.disabled = true;
            T.ask(u.id, reason).then(function (r) {
              b.disabled = false;
              if (!r || !r.ok) { o.showErrors(layer.el, r); return; }
              layer.close();
              P.toast('ok', 'Запит надіслано адміністратору', r.already ? 'Запит щодо цієї людини вже надіслано раніше.' : '');
              if (ctx.alive()) o.reload();
            });
          }
        } });
    });
  }

  P.teamDel = { btns: btns, bind: bind, MGR_HINT: MGR_HINT, CONFIRM_TEXT: CONFIRM_TEXT };
})(window);
