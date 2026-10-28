(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var NO_NAME = 'Аудитор зі старої системи';
  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }

  function fnv(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  function cleanName(s) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 80); }

  P.demoLinkLegacy = function (db, base, fresh) {
    var bySlack = {}, ghosts = {};
    db.users.forEach(function (u) { if (u.slackId) bySlack[String(u.slackId).toUpperCase()] = u; });
    function link(a) {
      var id = typeof a.auditorId === 'string' ? a.auditorId : '', m = /^old_s_([A-Z0-9]+)$/.exec(id);
      if (id && id.indexOf('old_') !== 0) return;   // звичайний автор з нової системи
      var sid = m ? m[1] : String(a.auditorSlackId || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{1,30}$/.test(sid)) sid = '';
      if (sid && has(bySlack, sid)) { a.auditorId = bySlack[sid].id; return; }
      var name = cleanName(a.auditorName);
      var key = sid ? 's_' + sid : /^old_n_[0-9a-f]{8}$/.test(id) && !name ? id.slice(4) : 'n_' + fnv(name.toLowerCase() || '—');
      var g = ghosts[key];
      if (!g) {
        g = ghosts[key] = { id: 'old_' + key, name: name || NO_NAME, role: 'auditor', slackId: null, locationIds: [],
          canAddPeople: false, active: false, accessOff: true, legacy: true };
        db.users.push(g);
      } else if (name && g.name === NO_NAME) g.name = name;
      if (a.locationId && g.locationIds.indexOf(a.locationId) < 0) g.locationIds.push(a.locationId);
      a.auditorId = g.id;
    }
    base.forEach(link); fresh.forEach(link);
  };
})(typeof window !== 'undefined' ? window : globalThis);
