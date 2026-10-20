(function (root) {
  'use strict';
  var P = root.P = root.P || {};

  var STATE_TEXT = {
    guest: ' · гість простору — додати можна лише учасника простору',
    deleted: ' · акаунт вимкнено',
    other_team: ' · з іншого простору',
    bot: ' · бот'
  };
  var ROLE_LABELS = { auditor: 'Аудитор', senior_auditor: 'Старший аудитор', location_lead: 'Старший локації', manager: 'Керівник', admin: 'Адмін' };

  function real() { return !!(P.authSlack && typeof P.authSlack.real === 'function' && P.authSlack.real()); }
  function arr(v) { return Array.isArray(v) ? v : []; }

  function person(u) {
    var on = u.active !== false;
    return { id: u.id, slackId: String(u.slackId == null ? '' : u.slackId), name: u.name || '', role: u.role, roleLabel: u.roleLabel || ROLE_LABELS[u.role] || u.role,
      active: on, disabledBy: on ? null : (u.disabledBy || 'admin'), locationIds: arr(u.locationIds).slice(), createdAt: u.createdAt || null,
      lastSeenAt: u.lastSeenAt || null, canAddPeople: u.canAddPeople === true,
      addedBy: u.addedBy && u.addedBy.id ? { id: u.addedBy.id, name: u.addedBy.name || '', role: u.addedBy.role || '' } : null,
      canEdit: u.canEdit === true, canEnable: u.canEnable === true };
  }
  function access(a) {
    a = a || {};
    return { addPeople: a.addPeople === true, addRoles: arr(a.addRoles).slice(), addLimitPerDay: typeof a.addLimitPerDay === 'number' ? a.addLimitPerDay : null,
      addedToday: Number(a.addedToday) || 0 };
  }

  var T = P.authTeam = {
    list: function () {
      var back = real() ? P.authSlack.admin('users.list') : P.srv('peopleTeam', {});
      return Promise.resolve(back).then(function (r) {
        if (!r || !r.ok) return r || { ok: false, code: 'server', error: 'Не вдалося отримати список людей.' };
        return { ok: true, users: arr(r.users || r.items).map(person), access: access(r.access) };
      });
    },
    save: function (p0) {
      var p = {}; Object.keys(p0 || {}).forEach(function (k) { if (k !== 'knownName') p[k] = p0[k]; });
      if (p.id && (!String(p.slackId || '').trim() || String(p.slackId).indexOf('…') >= 0)) delete p.slackId;
      if (!real()) return P.srv('peopleTeamSave', p).then(function (r) { if (r && r.ok && !r.name && p0 && p0.knownName) r.name = p0.knownName; return r; });
      return P.authSlack.admin('users.save', p).then(function (r) {
        return r && r.ok ? { ok: true, id: r.id, name: p.name || (p0 && p0.knownName) || '', active: p.active === undefined ? null : p.active !== false, created: !p.id } : r;
      });
    },
    lookup: function (slackId) {
      if (!real()) return P.srv('slackLookup', { slackId: slackId });
      return P.authSlack.admin('lookup', { slackId: slackId }).then(function (r) {
        return r && r.ok ? { ok: true, slackId: r.slackId, name: r.name || null, state: r.state || 'active' } : r;
      });
    },
    lookupText: function (r) {
      if (!r || !r.ok) return (r && r.error) || 'Не вдалося перевірити.';
      if (!r.name) return 'Не знайдено';
      return 'У Slack це: ' + r.name + (Object.prototype.hasOwnProperty.call(STATE_TEXT, r.state) ? STATE_TEXT[r.state] : '');
    },
    locations: function (me, users) {
      var seen = {}, out = [];
      function add(id, name) { if (id && !Object.prototype.hasOwnProperty.call(seen, id)) { seen[id] = 1; out.push({ id: id, name: name || id }); } }
      arr(me && me.locations).forEach(function (l) { add(l.id, l.name); });
      arr(users).forEach(function (u) { arr(u.locationIds).forEach(function (id) { add(id); }); });
      return out;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = T;
})(typeof window !== 'undefined' ? window : globalThis);
