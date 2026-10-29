(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var plus = P.cabPlus = {};

  plus.visible = function (items, real, realOk) {
    return (Array.isArray(items) ? items : []).filter(function (it) {
      if (!it) return false;
      return real ? !!realOk && !!realOk(it.real) : true;
    });
  };

  plus.href = function (item) {
    if (item.href) return item.href;
    var q = item.query || {};
    var qs = Object.keys(q).filter(function (k) { return q[k] != null && q[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]); }).join('&');
    return '#' + item.go + (qs ? '?' + qs : '');
  };

  plus.button = function (items) {
    if (!items || !items.length) return '';
    return '<button class="plus" type="button" data-act="cab-plus" aria-haspopup="menu" aria-label="Додати">' + P.ic('add') + '<span class="sr-hide-phone">Додати</span></button>';
  };

  function menuItem(act, item) {
    return '<button class="menu__item" type="button" data-act="' + act + '" style="border:0;background:transparent;width:100%;text-align:left;font:inherit;cursor:pointer">' +
      '<span class="menu__ic">' + P.ic(item.ic || 'add') + '</span><span><span class="menu__t">' + P.esc(item.title) + '</span>' +
      (item.sub ? '<span class="menu__s">' + P.esc(item.sub) + '</span>' : '') + '</span></button>';
  }

  plus.open = function (anchor, items) {
    var on = {};
    items.forEach(function (it, i) {
      on['cab-plus-' + i] = function (t, e, layer) {
        layer.close();
        if (it.href) root.location.href = it.href; else P.router.go(it.go, it.query);
      };
    });
    P.sr.menu(anchor, { width: 380, body: items.map(function (it, i) { return menuItem('cab-plus-' + i, it); }).join(''), on: on });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = plus;
})(typeof window !== 'undefined' ? window : globalThis);
