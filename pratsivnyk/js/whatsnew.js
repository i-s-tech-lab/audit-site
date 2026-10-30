(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var ROLE_OF = { auditor: 'auditor', senior_auditor: 'senior', manager: 'manager' };
  var MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

  function esc(s) { return P.esc ? P.esc(s) : String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function roleOfPage() {
    if (P.embed) return null;
    return Object.prototype.hasOwnProperty.call(ROLE_OF, P.demoViewRole) ? ROLE_OF[P.demoViewRole] : null;
  }
  function forRole(role, list) {
    return (Array.isArray(list) ? list : []).filter(function (n) { return n && Array.isArray(n.roles) && n.roles.indexOf(role) >= 0; });
  }
  function latest(role, list) { var l = forRole(role, list); return l.length ? l[0].id : null; }
  function unseen(role, list, seenId) {
    var l = forRole(role, list), i = -1;
    for (var k = 0; k < l.length; k++) if (l[k].id === seenId) { i = k; break; }
    return i < 0 ? l : l.slice(0, i);
  }
  function dateLabel(day) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || '');
    return m && MONTHS[+m[2] - 1] ? (+m[3]) + ' ' + MONTHS[+m[2] - 1] : '';
  }

  var KEY = function (role) { return 'lists.news:' + role; };
  function seenOf(role) { var l = P.prefs ? P.prefs.get(KEY(role), []) : []; return l && l[0] ? l[0] : null; }

  function bodyHtml(role, seenId) {
    var list = forRole(role, P.NEWS);
    var fresh = {}; unseen(role, P.NEWS, seenId).forEach(function (n) { fresh[n.id] = true; });
    var top = '<div class="news__top"><span>Зміни для вашого профілю</span>' + (P.help ? P.help.btn('news.what') : '') + '</div>';
    if (!list.length) return top + '<p class="news__empty">Поки що нічого нового.</p>';
    return top + list.map(function (n) {
      return '<article class="news__item' + (n.big ? ' news__item--big' : '') + '">' +
        '<div class="news__meta"><time class="news__date">' + esc(dateLabel(n.date)) + '</time>' + (fresh[n.id] ? '<span class="news__new">нове</span>' : '') + '</div>' +
        '<h3 class="news__title">' + esc(n.title) + '</h3>' +
        '<ul class="news__list">' + (n.items || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></article>';
    }).join('');
  }

  function refresh() {
    var role = roleOfPage();
    if (!role || !P.hdrTools) return;
    var ready = P.prefs && P.prefs.load ? P.prefs.load() : Promise.resolve();
    return ready.then(function () { P.hdrTools.dot(!!latest(role, P.NEWS) && latest(role, P.NEWS) !== seenOf(role)); });
  }

  function open() {
    var role = roleOfPage();
    if (!role) return;
    var ready = P.prefs && P.prefs.load ? P.prefs.load() : Promise.resolve();
    return ready.then(function () {
      var seen = seenOf(role), html = bodyHtml(role, seen), newest = latest(role, P.NEWS);
      if (P.sr && P.sr.drawer) P.sr.drawer({ title: 'Що нового', body: '<div class="news">' + html + '</div>' });
      else if (P.sheet) P.sheet.open({ title: 'Що нового', full: true, body: '<div class="news">' + html + '</div>' });
      if (newest && newest !== seen && P.prefs) P.prefs.set(KEY(role), [newest]);
      if (P.hdrTools) P.hdrTools.dot(false);
    });
  }

  P.news = { refresh: refresh, open: open, _latest: latest, _unseen: unseen };
  if (roleOfPage() && P.hdrTools) P.hdrTools.on('news', open);
})(typeof window !== 'undefined' ? window : globalThis);
