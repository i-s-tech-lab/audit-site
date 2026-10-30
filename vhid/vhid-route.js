(function (root) {
  'use strict';
  var P = root.P = root.P || {};

  var CABINET = { auditor: '../pratsivnyk/', senior_auditor: '../starshyi/', manager: '../kerivnyk/', admin: '../admin/' };
  var ID_RE = /^[A-Za-z0-9_.\-]{1,64}$/;
  var LOC_RE = /^[A-Za-z0-9_.\-]{1,40}$/;

  function param(search, name) {
    var m = String(search || '').replace(/^\?/, '').split('&');
    for (var i = 0; i < m.length; i++) {
      var kv = m[i], j = kv.indexOf('='), k = j >= 0 ? kv.slice(0, j) : kv;
      if (k !== name) continue;
      try { return decodeURIComponent(j >= 0 ? kv.slice(j + 1).replace(/\+/g, ' ') : ''); } catch (e) { return ''; }
    }
    return null;
  }

  function parse(search) {
    var a = param(search, 'a'), c = param(search, 'check');
    var good = a != null && ID_RE.test(a);
    return { audit: good ? a : '', badAudit: a != null && !good, check: c === '1' };
  }

  function cabinet(role) {
    return Object.prototype.hasOwnProperty.call(CABINET, role) ? CABINET[role] : null;
  }

  function auditPath(role, id, locationId) {
    if (!ID_RE.test(String(id || ''))) return null;
    if (role === 'auditor') return CABINET.auditor + '#/audit/' + encodeURIComponent(id);
    if (role === 'senior_auditor' || role === 'manager' || role === 'admin') {
      var loc = typeof locationId === 'string' && LOC_RE.test(locationId) ? '&loc=' + encodeURIComponent(locationId) : '';
      return CABINET.senior_auditor + '#/history?audit=' + encodeURIComponent(id) + loc;
    }
    return null;
  }

  P.vhidRoute = { parse: parse, cabinet: cabinet, auditPath: auditPath, CABINET: CABINET };
  if (typeof module !== 'undefined' && module.exports) module.exports = P.vhidRoute;
})(typeof window !== 'undefined' ? window : globalThis);
