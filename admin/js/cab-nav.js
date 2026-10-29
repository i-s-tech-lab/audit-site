(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var nav = P.cabNav = {};
  var OTHER = 'Інше';

  nav.group = function (tabs, groups) {
    var byId = {}, used = {}, out = [];
    (tabs || []).forEach(function (t) { byId[t.id] = t; });
    (Array.isArray(groups) ? groups : []).forEach(function (g) {
      var list = [];
      (g && Array.isArray(g.tabs) ? g.tabs : []).forEach(function (id) {
        if (byId[id] && !used[id]) { used[id] = true; list.push(byId[id]); }
      });
      if (list.length) out.push({ label: g.label, tabs: list });
    });
    var rest = (tabs || []).filter(function (t) { return !used[t.id]; });
    if (rest.length) out.push({ label: OTHER, tabs: rest });
    return out;
  };

  function item(t, activeId, close) {
    var on = t.id === activeId;
    return '<a class="cab-side__item' + (on ? ' cab-side__item--on' : '') + '" href="#' + P.esc(t.path) + '"' + (on ? ' aria-current="page"' : '') + (close ? ' data-ov-close' : '') + '>' +
      P.ic(t.ic) + '<span class="cab-side__t">' + P.esc(t.label) + '</span>' +
      (t.count > 0 ? '<span class="cab-side__n">' + P.esc(t.count) + '</span>' : '') + '</a>';
  }

  function groupsHtml(groups, activeId, close) {
    return groups.map(function (g) {
      return '<div class="cab-side__grp" role="group" aria-label="' + P.esc(g.label) + '"><p class="cab-side__lbl" aria-hidden="true">' + P.esc(g.label) + '</p>' +
        g.tabs.map(function (t) { return item(t, activeId, close); }).join('') + '</div>';
    }).join('');
  }

  nav.html = function (groups, activeId) {
    return '<nav class="cab-side" aria-label="Розділи">' + groupsHtml(groups, activeId, false) + '</nav>';
  };

  nav.bar = function (currentLabel) {
    return '<div class="sr-tabsbar cab-sec"><div class="wrap"><button class="tool cab-sec__btn" type="button" data-act="cab-sections" aria-haspopup="dialog" aria-label="Розділи — зараз «' + P.esc(currentLabel) + '»">' +
      P.ic('list', 'ui-icon--sm') + '<span class="cab-sec__t">' + P.esc(currentLabel) + '</span>' + P.ic('chevron-down', 'ui-icon--sm') + '</button></div></div>';
  };

  nav.open = function (groups, activeId) {
    P.sr.drawer({ title: 'Розділи', body: (P.help && P.help.has && P.help.has('admin.nav.side') ? '<p class="hint" style="margin:0">Як це влаштовано' + P.help.btn('admin.nav.side') + '</p>' : '') + '<nav class="cab-side cab-side--drawer" aria-label="Розділи">' + groupsHtml(groups, activeId, true) + '</nav>' });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = nav;
})(typeof window !== 'undefined' ? window : globalThis);
