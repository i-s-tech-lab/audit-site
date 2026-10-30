(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var C = P.demoCommon;
  P.demoApis = P.demoApis || [];

  var THEMES = { light: 1, dark: 1 }, APPS = { cab: 1, worker: 1 };
  var SCOPE_RE = /^[^\u0000-\u001f<>"`\\]{1,100}$/, ID_RE = /^[^\u0000-\u001f<>"`\\]{1,80}$/;
  var MAX_SCOPES = 40, MAX_IDS = 200;
  var MAPS = ['order', 'lists'];   // v1.2: розділи «scope → список id» з однаковими межами

  function ids(list) {
    var seen = {};
    return list.filter(function (id) { var ok = typeof id === 'string' && ID_RE.test(id) && !seen[id]; seen[id] = 1; return ok; }).slice(0, MAX_IDS);
  }

  function keyOf(me) { return 'demo:prefs:' + me.id; }
  function clean(raw) {
    var src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}, out = { v: 1, theme: {}, order: {}, lists: {} };
    var th = src.theme && typeof src.theme === 'object' ? src.theme : {};
    Object.keys(APPS).forEach(function (a) { if (typeof th[a] === 'string' && THEMES[th[a]]) out.theme[a] = th[a]; });
    MAPS.forEach(function (k) {
      var box = src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) ? src[k] : {}, n = 0;
      Object.keys(box).forEach(function (s) {
        if (n >= MAX_SCOPES || !SCOPE_RE.test(s) || !Array.isArray(box[s])) return;
        out[k][s] = ids(box[s]); n++;
      });
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
      MAPS.forEach(function (k) { if (p[k] !== undefined && (!p[k] || typeof p[k] !== 'object' || Array.isArray(p[k]))) bad.push(k); });
      if (bad.length) return C.fail('validation', 'Налаштування не збережено — оновіть сторінку й спробуйте ще раз.', [{ field: bad[0], message: 'Незрозумілі дані.' }]);
      if (p.theme) Object.keys(p.theme).forEach(function (a) { if (APPS[a] && THEMES[p.theme[a]]) cur.theme[a] = p.theme[a]; });
      MAPS.forEach(function (k) {
        if (p[k]) Object.keys(p[k]).forEach(function (s) {
          var list = p[k][s];
          if (!SCOPE_RE.test(s)) return;
          if (list === null) { delete cur[k][s]; return; }
          if (!Array.isArray(list)) return;
          if (!(s in cur[k]) && Object.keys(cur[k]).length >= MAX_SCOPES) return;
          cur[k][s] = ids(list);
        });
      });
      env.storage.set(keyOf(me), cur);
      return { ok: true, prefs: cur };
    }
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = { clean: clean };
})(typeof window !== 'undefined' ? window : globalThis);
