(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon;
  P.demoApis = P.demoApis || []; P.demoResetKeys = P.demoResetKeys || [];

  var KEY = 'demo:mgr:notify', KD = 'kd-self';
  P.demoResetKeys.push(KEY);
  var MSG_GONE = 'Цієї розсилки вже немає — оновіть сторінку.', MSG_NO_LOC = 'Оберіть хоча б одну локацію.', MSG_BAD_LOC = 'Такої локації у вас немає — оновіть сторінку.';
  var MSG_ENABLED = 'Оберіть: увімкнути чи вимкнути.';

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function isStr(x) { return typeof x === 'string'; }
  function defOf(id, addressed) { return { enabled: id === KD || addressed === true, locs: 'all' }; }

  function whenText(w) {
    try { return P.mailRules && w && typeof w === 'object' ? String(P.mailRules.scheduleLabel(w)) : ''; } catch (e) { return ''; }
  }
  function listed(r, mineIds) {
    return r.locations === 'all' || (Array.isArray(r.locations) && r.locations.some(function (id) { return mineIds.indexOf(id) >= 0; }));
  }
  function allowedIds(r, mineIds) {
    return !r || r.locations === 'all' || !Array.isArray(r.locations) ? mineIds.slice() : mineIds.filter(function (id) { return r.locations.indexOf(id) >= 0; });
  }
  function effective(row, def, okIds) {
    if (!row || typeof row !== 'object' || typeof row.enabled !== 'boolean') return { enabled: def.enabled, locs: def.locs };
    var locs = 'all';
    if (Array.isArray(row.locs)) {
      locs = row.locs.filter(function (id, i, a) { return isStr(id) && okIds.indexOf(id) >= 0 && a.indexOf(id) === i; });
      if (!locs.length) locs = 'all';   // v1.2: усі обрані локації зникли — «усі мої», а не порожньо (інакше вмикач не збереже)
    }
    return { enabled: row.enabled, locs: locs };
  }
  function cleanRules(rules) {
    return (Array.isArray(rules) ? rules : []).filter(function (r) { return r && typeof r === 'object' && isStr(r.id) && r.id; }).map(function (r) {
      return { id: r.id, title: isStr(r.title) ? r.title : '', enabled: r.enabled === true, when: r.when, locations: r.locations === 'all' ? 'all' : Array.isArray(r.locations) ? r.locations.filter(isStr) : [], addressed: r.addressed === true, targeted: r.targeted === true };
    });
  }
  function build(a) {
    var mine = (Array.isArray(a.mine) ? a.mine : []).map(function (l) { return { id: l.id, name: l.name }; });
    var mineIds = mine.map(function (l) { return l.id; }), prefs = a.prefs && typeof a.prefs === 'object' ? a.prefs : {};
    var rules = cleanRules(a.rules).filter(function (r) { return r.targeted && listed(r, mineIds); }).map(function (r) {
      var def = defOf(r.id, r.addressed), ok = allowedIds(r, mineIds), x = effective(has(prefs, r.id) ? prefs[r.id] : null, def, ok);
      return { id: r.id, title: r.title, ruleOn: r.enabled, when: whenText(r.when), addressed: r.addressed, enabled: x.enabled, locs: x.locs,
        ruleLocs: r.locations === 'all' ? 'all' : mine.filter(function (l) { return r.locations.indexOf(l.id) >= 0; }) };
    });
    return { sending: a.sending === true, locations: mine, kdSelf: a.isAdmin ? null : effective(has(prefs, KD) ? prefs[KD] : null, defOf(KD), mineIds), rules: rules };
  }
  function check(a) {
    var inp = a.input && typeof a.input === 'object' ? a.input : {}, id = isStr(inp.id) ? inp.id : '';
    var mineIds = (Array.isArray(a.mine) ? a.mine : []).map(function (l) { return l.id; }), def = null, ok = mineIds, errors = [];
    function err(f, m) { errors.push({ field: f, message: m }); }
    if (id === KD) { if (!a.isAdmin) def = defOf(KD); }
    else if (id) {
      var r = cleanRules(a.rules).filter(function (x) { return x.id === id && x.targeted && listed(x, mineIds); })[0];
      if (r) { def = defOf(id, r.addressed); ok = allowedIds(r, mineIds); }
    }
    if (!def) return { errors: [{ field: 'id', message: MSG_GONE }] };
    if (typeof inp.enabled !== 'boolean') err('enabled', MSG_ENABLED);
    var locs = 'all';
    if (inp.locs !== 'all') {
      var list = Array.isArray(inp.locs) ? inp.locs.filter(function (x, i, arr) { return arr.indexOf(x) === i; }) : [];
      if (!list.length) err('locs', MSG_NO_LOC);
      else if (list.some(function (x) { return !isStr(x) || ok.indexOf(x) < 0; })) err('locs', MSG_BAD_LOC);
      else locs = list;
    }
    if (errors.length) return { errors: errors };
    return { row: { id: id, enabled: inp.enabled, locs: locs }, isDefault: inp.enabled === def.enabled && locs === 'all' };
  }

  function gate(me) { return !!me && (me.role === 'manager' || me.role === 'admin' || me.admin === true); }
  function isAdminMe(me) { return !!me && (me.role === 'admin' || me.admin === true); }
  function demoRules(env, slackId) {
    var items = [];
    try { items = P.mailRules && typeof P.mailRules.readRules === 'function' ? P.mailRules.readRules(env) : []; } catch (e) { items = []; }
    return (Array.isArray(items) ? items : []).map(function (x) {
      return { id: x.id, title: x.title, enabled: x.enabled === true, when: x.when, locations: x.locations, targeted: Array.isArray(x.to) && x.to.length > 0,
        addressed: !!slackId && (x.to || []).some(function (t) { return t && t.type === 'user' && t.id === slackId; }) };
    });
  }
  function readAll(env) { var s = env.storage.get(KEY, {}); return s && typeof s === 'object' && !Array.isArray(s) ? s : {}; }
  function prefsOf(all, userId) { return has(all, userId) && all[userId] && typeof all[userId] === 'object' ? all[userId] : {}; }
  function viewOf(env, me) {
    return Object.assign({ ok: true }, build({ mine: me.locations, rules: demoRules(env, me.slackId), prefs: prefsOf(readAll(env), me.id), isAdmin: isAdminMe(me), sending: false }));
  }
  function targetOf(env, id) {
    var u = isStr(id) && has(env.ix.user, id) ? env.ix.user[id] : null;
    if (!u || u.role !== 'manager' || u.deleted === true) return null;
    return { id: u.id, name: u.name, slackId: u.slackId || null,
      mine: (u.locationIds || []).filter(function (l) { return has(env.ix.loc, l); }).map(function (l) { return { id: l, name: env.ix.loc[l].name }; }) };
  }
  function noTarget() { return C.fail('not_found', 'Керівника не знайдено — оновіть сторінку.'); }
  function invalid(v) { return C.fail('validation', v.errors[0].message, v.errors); }

  P.mgrNotifyCore = { build: build, check: check, whenText: whenText };
  P.demoApis.push({
    mgrNotify: function (p, me, env) {
      if (!gate(me)) return C.forbidden();
      return viewOf(env, me);
    },
    mgrNotifySave: function (p, me, env) {
      if (!gate(me)) return C.forbidden();
      var v = check({ mine: me.locations, rules: demoRules(env, me.slackId), input: p, isAdmin: isAdminMe(me) });
      if (v.errors) return invalid(v);
      var all = readAll(env), mine = Object.assign({}, prefsOf(all, me.id));
      if (v.isDefault) delete mine[v.row.id]; else mine[v.row.id] = { enabled: v.row.enabled, locs: v.row.locs };
      if (Object.keys(mine).length) all[me.id] = mine; else delete all[me.id];
      env.storage.set(KEY, all);
      return viewOf(env, me);
    },
    admNotifyOf: function (p, me, env) {
      if (!isAdminMe(me)) return C.forbidden();
      var t = targetOf(env, p.id);
      if (!t) return noTarget();
      return Object.assign({ ok: true }, build({ mine: t.mine, rules: demoRules(env, t.slackId), prefs: prefsOf(readAll(env), t.id), isAdmin: false, sending: false }), { person: { id: t.id, name: t.name } });
    },

    mgrNotifyBuild: function (p, me) {
      if (!gate(me)) return C.forbidden();
      return Object.assign({ ok: true }, build({ mine: me.locations, rules: p.rules, prefs: p.prefs, isAdmin: isAdminMe(me), sending: false }));
    },
    mgrNotifyCheck: function (p, me) {
      if (!gate(me)) return C.forbidden();
      var v = check({ mine: me.locations, rules: p.rules, input: p.input, isAdmin: isAdminMe(me) });
      return v.errors ? invalid(v) : { ok: true, row: v.row, isDefault: v.isDefault };
    },
    mgrNotifyBuildFor: function (p, me, env) {
      if (!isAdminMe(me)) return C.forbidden();
      var t = targetOf(env, p.id);
      if (!t) return noTarget();
      return Object.assign({ ok: true }, build({ mine: t.mine, rules: p.rules, prefs: p.prefs, isAdmin: false, sending: false }), { person: { id: t.id, name: t.name } });
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
