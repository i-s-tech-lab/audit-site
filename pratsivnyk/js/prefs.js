(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var THEME_KEY = { cab: 'theme:sr', worker: 'theme' };   // ключі P.store, які читає вбудований скрипт index.html
  var DELAY_MS = 600;

  var ROOTS = { theme: 1, order: 1, lists: 1 };   // v1.2
  var prefs = { theme: {}, order: {}, lists: {} }, loading = null, pending = null, timer = null;
  var whoLoaded = null, touched = Object.create(null);

  function split(path) { var i = String(path).indexOf('.'); return i < 0 ? [String(path), null] : [path.slice(0, i), path.slice(i + 1)]; }
  function flush() {
    timer = null;
    var patch = pending; pending = null;
    if (!patch) return;
    P.srv('prefsSave', patch).then(function (r) { if (r && r.ok && r.prefs) merge(r.prefs); }, function () { /* мовчки: це лише зручність */ });
  }
  function merge(src) {
    if (!src || typeof src !== 'object') return;
    var keep = { theme: prefs.theme, order: prefs.order, lists: prefs.lists };
    Object.keys(ROOTS).forEach(function (k) { prefs[k] = src[k] && typeof src[k] === 'object' ? src[k] : {}; });
    Object.keys(touched).forEach(function (path) {
      var p = split(path), v = keep[p[0]] ? keep[p[0]][p[1]] : undefined;
      if (v === undefined) delete prefs[p[0]][p[1]]; else prefs[p[0]][p[1]] = v;
    });
  }

  P.prefs = {
    load: function (who) {
      if (who && whoLoaded && who !== whoLoaded) P.prefs._reset();
      if (who) whoLoaded = who;
      if (!loading) loading = P.srv('prefsGet', {}).then(function (r) { if (r && r.ok) merge(r.prefs); return prefs; }, function () { return prefs; });
      return loading;
    },
    get: function (path, def) {
      var p = split(path), box = prefs[p[0]];
      if (!box || p[1] === null || !Object.prototype.hasOwnProperty.call(box, p[1])) return def;
      var v = box[p[1]];
      return Array.isArray(v) ? v.slice() : v;
    },
    set: function (path, value) {
      var p = split(path);
      if (!Object.prototype.hasOwnProperty.call(ROOTS, p[0]) || !p[1]) return;
      touched[path] = 1;
      pending = pending || {};
      pending[p[0]] = pending[p[0]] || {};
      pending[p[0]][p[1]] = Array.isArray(value) ? value.slice() : value;
      if (value === null) delete prefs[p[0]][p[1]]; else prefs[p[0]][p[1]] = Array.isArray(value) ? value.slice() : value;
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, DELAY_MS);
    },
    applyTheme: function (app) {
      var t = P.prefs.get('theme.' + app, null);
      if (t !== 'light' && t !== 'dark') return null;
      root.document.documentElement.setAttribute('data-theme', t);
      if (P.store && THEME_KEY[app]) P.store.set(THEME_KEY[app], t);
      return t;
    },
    setTheme: function (app, t) {
      if (t !== 'light' && t !== 'dark') return;
      root.document.documentElement.setAttribute('data-theme', t);
      if (P.store && THEME_KEY[app]) P.store.set(THEME_KEY[app], t);
      P.prefs.set('theme.' + app, t);
    },
    _reset: function () { prefs = { theme: {}, order: {}, lists: {} }; loading = null; pending = null; touched = Object.create(null); whoLoaded = null; if (timer) clearTimeout(timer); timer = null; },
    _flush: flush
  };
})(typeof window !== 'undefined' ? window : globalThis);
