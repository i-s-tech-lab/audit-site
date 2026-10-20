(function (root) {
  'use strict';
  var P = root.P = root.P || {};

  function check(w) {
    var t = w.top;
    if (t === w.self) return 'top';
    try { if (t.location.origin === w.location.origin) return 'same'; } catch (e) { /* чужий сайт */ }
    try { w.document.documentElement.style.visibility = 'hidden'; } catch (e) { /* без документа — нічого ховати */ }
    try { t.location.replace(w.location.href); } catch (e) { /* перехід заборонено — сторінка лишається схованою */ }
    return 'blocked';
  }

  P.frameGuard = { check: check };
  check(root);
})(typeof window !== 'undefined' ? window : globalThis);
