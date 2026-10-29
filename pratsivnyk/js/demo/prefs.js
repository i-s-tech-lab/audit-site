(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var C = P.demoCommon;
  P.demoApis = P.demoApis || [];

  var THEMES = { light: 1, dark: 1 }, APPS = { cab: 1, worker: 1 };
  var SCOPE_RE = /^[^\u0000-\u001f<>"`\\]{1,100}$/, ID_RE = /^[^\u0000-\u001f<>"`\\]{1,80}$/;
  var MAX_SCOPES = 40, MAX_IDS = 200;

  function keyOf(me) { return 'demo:prefs:' + me.id; }
  function clean(raw) {
    var src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}, out = { v: 1, theme: {}, order: {} };
    var th = src.theme && typeof src.theme === 'object' ? src.theme : {};
    Object.keys(APPS).forEach(function (a) { if (typeof th[a] === 'string' && THEMES[th[a]]) out.theme[a] = th[a]; });
    var ord = src.order && typeof src.order === 'object' && !Array.isArray(src.order) ? src.order : {}, n = 0;
    Object.keys(ord).forEach(function (s) {
      if (n >= MAX_SCOPES || !SCOPE_RE.test(s) || !Array.isArray(ord[s])) return;
      var seen = {}, ids = ord[s].filter(function (id) { var ok = typeof id === 'string' && ID_RE.test(id) && !seen[id]; seen[id] = 1; return ok; });
      out.order[s] = ids.slice(0, MAX_IDS); n++;
    });
    return out;
  }
  function who(me) { return me && typeof me.id === 'string' && me.id ? me : null; }

  P.demoApis.push({
    prefsGet: function (p, me, env) {
      if (!who(me)) return C.auth();
      return { ok: true, prefs: clean(env.storage.get(keyOf(me), null)) };
    },
    prefsSave: function (p, me, env) {
      if (!who(me)) return C.auth();
      var cur = clean(env.storage.get(keyOf(me), null)), bad = [];
      if (p.theme !== undefined && (!p.theme || typeof p.theme !== 'object' || Array.isArray(p.theme))) bad.push('theme');
      if (p.order !== undefined && (!p.order || typeof p.order !== 'object' || Array.isArray(p.order))) bad.push('order');
      if (bad.length) return C.fail('validation', 'Налаштування не збережено — оновіть сторінку й спробуйте ще раз.', [{ field: bad[0], message: 'Незрозумілі дані.' }]);
      if (p.theme) Object.keys(p.theme).forEach(function (a) { if (APPS[a] && THEMES[p.theme[a]]) cur.theme[a] = p.theme[a]; });
      if (p.order) Object.keys(p.order).forEach(function (s) {
        var ids = p.order[s];
        if (!SCOPE_RE.test(s)) return;
        if (ids === null) { delete cur.order[s]; return; }
        if (!Array.isArray(ids)) return;
        if (!(s in cur.order) && Object.keys(cur.order).length >= MAX_SCOPES) return;
        var seen = {};
        cur.order[s] = ids.filter(function (id) { var ok = typeof id === 'string' && ID_RE.test(id) && !seen[id]; seen[id] = 1; return ok; }).slice(0, MAX_IDS);
      });
      env.storage.set(keyOf(me), cur);
      return { ok: true, prefs: cur };
    }
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = { clean: clean };
})(typeof window !== 'undefined' ? window : globalThis);
