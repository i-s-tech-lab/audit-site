(function (root) {
  'use strict';
  var P = root.P, K = P.mlKit;

  P.cab.screen('/mailing/state', { tab: 'mailing', title: 'Стан розсилки і журнал', render: function (ctx) {
    ctx.el.innerHTML = '<div class="rz">' + K.subnav('state') +
      '<div class="rz-head"><div><h2 class="h2">Стан розсилки і журнал' + P.help.btn('admin.ml.probe') + '</h2>' +
      '<p class="h2-sub">Чи все працює і що вже пішло в Slack. Повідомлення справді йдуть у Slack: пробні — лише в один тестовий канал, розсилки — тим, кого вказано в «Кому».</p></div></div>' +
      '<div class="rz" data-rz-state></div></div>';
    P.mailPanel.mount(ctx.el.querySelector('[data-rz-state]'));
  } });
})(window);
