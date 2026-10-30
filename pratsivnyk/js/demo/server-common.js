(function (root) {
  'use strict';
  var P = root.P = root.P || {};

  var C = P.demoCommon = {
    LIMITS: { maxOrders: 5, maxProducts: 15, maxDefects: 30, maxGuiltyPerDefect: 15,
      maxQty: 100000, maxComment: 1000, editWindowMin: 15 },

    SESSION_DAYS: 7,

    SLACK_ID_RE: /^[UW][A-Z0-9]{8,10}$/,
    DEMO_SLACK_ID_RE: /^U-DEMO-[0-9]{3}$/,
    isSlackId: function (s) { s = String(s == null ? '' : s); return C.SLACK_ID_RE.test(s) || C.DEMO_SLACK_ID_RE.test(s); },
    maskSlackId: function (id) { id = String(id == null ? '' : id); return id.length > 4 ? id.charAt(0) + '…' + id.slice(-3) : id; },

    accessFor: function (u) {
      return P.demoAccess ? P.demoAccess.accessOf({ role: u.role, active: u.active !== false, canAddPeople: u.canAddPeople === true })
        : { addPeople: false, addRoles: [], addLimitPerDay: null };
    },

    fail: function (code, error, errors) {
      var r = { ok: false, code: code, error: error };
      if (errors) r.errors = errors;
      return r;
    },
    forbidden: function () { return C.fail('forbidden', 'Немає прав на цю дію.'); },
    auth: function () { return C.fail('auth', 'Потрібен вхід.'); },

    pct: function (rejected, checked) {
      return checked > 0 ? Math.round(rejected / checked * 1000) / 10 : null;
    },

    checkedOf: function (a) { return a.items.reduce(function (s, i) { return s + i.qty; }, 0); },
    rejectedOf: function (a) { return a.items.reduce(function (s, i) { return s + (i.rejected || 0); }, 0); },

    index: function (db) {
      var ix = { loc: {}, dep: {}, dt: {}, prod: {}, def: {}, user: {}, worker: {} };
      db.locations.forEach(function (x) { ix.loc[x.id] = x; });
      db.departments.forEach(function (x) { ix.dep[x.id] = x; });
      db.deptTypes.forEach(function (x) { ix.dt[x.id] = x; });
      db.products.forEach(function (x) { ix.prod[x.id] = x; });
      db.defectTypes.forEach(function (x) { ix.def[x.id] = x; });
      db.users.forEach(function (x) { ix.user[x.id] = x; });
      db.workers.forEach(function (x) { ix.worker[x.locationId + ':' + x.code] = x; });
      return ix;
    },

    canOf: function (role) {
      var can = {
        recordAudit: role === 'auditor' || role === 'senior_auditor' || role === 'admin',
        editCatalogs: role === 'senior_auditor' || role === 'admin',
        editOthersAudits: role === 'senior_auditor' || role === 'admin',
        viewAllLocations: role === 'manager' || role === 'admin',
        manageWhitelist: role === 'senior_auditor' || role === 'admin'
      };
      var o = C.roleOverrides && Object.prototype.hasOwnProperty.call(C.roleOverrides, role) ? C.roleOverrides[role] : null;
      if (o) Object.keys(can).forEach(function (k) { if (typeof o[k] === 'boolean') can[k] = o[k]; });
      return can;
    },

    buildMe: function (u, ix) {
      var role = u.role;
      return {
        id: u.id, name: u.name, role: role, roleLabel: P.demoDict.roleLabels[role], slackId: u.slackId || null,
        locations: u.locationIds.map(function (id) { return { id: id, name: ix.loc[id].name }; }),
        defaultLocationId: u.locationIds[0],
        can: C.canOf(role),
        rules: { editWindowMin: C.LIMITS.editWindowMin, sessionDays: C.SESSION_DAYS },
        access: C.accessFor(u)
      };
    },

    RANK: { auditor: 1, senior_auditor: 2, manager: 3, admin: 4 },
    lowerRoles: function (role) {
      var r = C.RANK[role] || 0;
      return Object.keys(C.RANK).filter(function (k) { return C.RANK[k] < r; }).sort(function (a, b) { return C.RANK[b] - C.RANK[a]; });
    },
    viewLower: function (u, ix, role, locId) {
      if (!(C.RANK[role] < C.RANK[u.role])) return C.buildMe(u, ix);
      var me = C.buildMe(u, ix), one = role === 'auditor' || role === 'senior_auditor';
      var loc = u.locationIds.indexOf(locId) >= 0 && Object.prototype.hasOwnProperty.call(ix.loc, locId) ? locId : u.locationIds[0];
      if (!loc || !Object.prototype.hasOwnProperty.call(ix.loc, loc)) return me;
      me.ownRole = u.role; me.ownRoleLabel = P.demoDict.roleLabels[u.role];
      me.allLocations = me.locations; me.viewLocationId = loc;
      me.role = role; me.roleLabel = P.demoDict.roleLabels[role]; me.can = C.canOf(role);
      me.access = C.accessFor({ role: role, active: u.active, canAddPeople: u.canAddPeople });
      if (one) me.locations = [{ id: loc, name: ix.loc[loc].name }];
      me.defaultLocationId = one ? loc : me.locations[0].id;
      return me;
    },

    viewAs: function (u, ix, role, locId) {
      var me = C.buildMe(u, ix), one = role === 'auditor' || role === 'senior_auditor';
      var loc = Object.prototype.hasOwnProperty.call(ix.loc, locId) ? locId : u.locationIds[0];   // лише справжня локація (не службове імʼя обʼєкта)
      me.admin = true; me.viewLocationId = loc; me.allLocations = me.locations;
      me.role = role; me.roleLabel = P.demoDict.roleLabels[role]; me.can = C.canOf(role);
      me.access = C.accessFor({ role: role, canAddPeople: true });   // v1.7: у перегляді «як роль» — права цієї ролі додавати людей
      if (one) me.locations = [{ id: loc, name: ix.loc[loc].name }];
      me.defaultLocationId = one ? loc : me.locations[0].id;
      return me;
    },

    hasLoc: function (me, locationId) {
      return me.locations.some(function (l) { return l.id === locationId; });
    },
    canRecordAt: function (me, locationId, ix) {
      return !!(me.can && me.can.recordAudit) && !!ix && Object.prototype.hasOwnProperty.call(ix.loc, locationId) &&
        (ix.loc[locationId].active !== false || C.hasLoc(me, locationId));
    },

    periodFrom: function (day, period) {
      var n = { today: 1, '7d': 7, '30d': 30, '90d': 90 }[period] || 7;
      return P.demoDates.addDays(day, -(n - 1));
    },

    newestFirst: function (a, b) {
      return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
