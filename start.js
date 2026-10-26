(function (root) {
  'use strict';
  var P = root.P;
  if (!P || !P.ic || !P.mountIcons) return;
  P.mountIcons();
  var spots = root.document.querySelectorAll('[data-ic]');
  for (var i = 0; i < spots.length; i++) {
    spots[i].innerHTML = P.ic(spots[i].getAttribute('data-ic'), spots[i].getAttribute('data-ic-cls') || '');
  }
})(window);
