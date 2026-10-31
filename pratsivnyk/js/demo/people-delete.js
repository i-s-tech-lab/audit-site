(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, A = P.demoAdmin, X = P.demoAccess;
  P.demoApis = P.demoApis || []; P.demoResetKeys = P.demoResetKeys || [];

  var K_REQ = 'demo:adm:deletes';   // { seq, items: [{ id, targetId, askedBy, reason, status, createdAt, handledBy, handledAt }] }
  P.demoResetKeys.push(K_REQ);
  var K_NOTIFY = 'demo:mgr:notify';   // налаштування сповіщень керівників (manager-notify.js): { userId: { id: { enabled, locs } } }
  var GONE = 'Такої людини немає — оновіть сторінку.';
  var REQ_GONE = 'Цей запит вже оброблено — оновіть сторінку.';

  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function store(env) { var s = obj(env.storage.get(K_REQ, null)); return { seq: typeof s.seq === 'number' ? s.seq : 0, items: arr(s.items) }; }
  function liveUser(env, id) {
    return typeof id === 'string' ? A.allUsers(env).filter(function (u) { return u.id === id && u.deleted !== true; })[0] || null : null;
  }
  function pendingIds(env) {
    var out = {};
    store(env).items.forEach(function (r) { if (r && r.status === 'pending') out[r.targetId] = true; });
    return out;
  }
  function removePerson(env, me, u, st) {
    var ps = A.peopleStore(env.storage), at = env.now().toISOString();
    var prev = u.disabledBy || null, by = prev && X.rankOf(prev) > X.rankOf(me.role) ? prev : me.role;
    ps.del[u.id] = { at: at, by: me.id, byRole: me.role, disabledBy: by };
    ps.edit[u.id] = Object.assign(obj(ps.edit[u.id]), { canAddPeople: false });   // видалений більше не додає людей (право зникає разом із доступом)
    delete ps.off[u.id];
    env.storage.set(A.K.people, ps);
    st.items.forEach(function (r) { if (r.targetId === u.id && r.status === 'pending') { r.status = 'done'; r.handledBy = me.id; r.handledAt = at; } });
    env.storage.set(K_REQ, st);
    var nt = obj(env.storage.get(K_NOTIFY, null));   // особисті налаштування сповіщень видаленого керівника зникають
    if (has(nt, u.id)) { delete nt[u.id]; env.storage.set(K_NOTIFY, nt); }
    A.log(env, me, 'Люди й доступи', u.name, [['Видалено', null, P.demoDict.roleLabels[u.role] || u.role]]);
  }
  function anyUser(env, id) {
    return typeof id === 'string' ? A.allUsers(env).filter(function (u) { return u.id === id; })[0] || null : null;
  }
  function cleanReason(raw) {
    if (typeof raw !== 'string') return raw;
    var s = raw.replace(/\s+/g, ' ').replace(/[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, '').trim();
    return Array.from(s).slice(0, 500).join('').trim();
  }
  function curOf(u) { return P.demoPeople.curOf(u); }

  P.demoApis.push({
    personDelete: function (p, me, env) {
      if (!A.isAdmin(me) && X.DELEGATE_ROLES.indexOf(me.role) < 0) return C.forbidden();
      env.reload();
      var u = liveUser(env, p.id);
      if (!u) return C.fail('not_found', GONE);
      var d = X.deleteDecision({ actor: P.demoPeople.actorOf(me), cur: curOf(u), had: u.locationIds });
      if (!d.ok) return P.demoPeople.failOf(d);
      removePerson(env, me, u, store(env));
      env.reload();
      return { ok: true };
    },

    deleteAsk: function (p, me, env) {
      if (me.role !== 'manager') return C.forbidden();
      env.reload();
      var u = liveUser(env, p.id);
      if (!u) return C.fail('not_found', GONE);
      var reason = cleanReason(p.reason);   // спершу чистимо (довше за 500 — обрізаємо), потім перевіряємо 3–500
      var d = X.deleteAskDecision({ actor: P.demoPeople.actorOf(me), cur: curOf(u), had: u.locationIds, reason: reason });
      if (!d.ok) return P.demoPeople.failOf(d);
      var st = store(env);
      if (st.items.some(function (r) { return r.targetId === u.id && r.status === 'pending'; })) return { ok: true, already: true };
      st.seq += 1;
      st.items.push({ id: st.seq, targetId: u.id, askedBy: me.id, reason: reason, status: 'pending', createdAt: env.now().toISOString(), handledBy: null, handledAt: null });
      env.storage.set(K_REQ, st);
      A.log(env, me, 'Люди й доступи', u.name, [['Запит на видалення', null, 'надіслано адміну']]);
      return { ok: true };
    },

    deleteRequests: function (p, me, env) {
      if (!A.isAdmin(me)) return C.forbidden();
      env.reload();
      var items = [];
      store(env).items.forEach(function (r) {
        var t = r.status === 'pending' ? liveUser(env, r.targetId) : null;
        if (!t) return;
        var by = anyUser(env, r.askedBy);
        items.push({ id: r.id, createdAt: r.createdAt, reason: r.reason,
          target: { id: t.id, name: t.name, role: t.role, locationIds: arr(t.locationIds).slice(), allLocations: t.allLocations === true },
          askedBy: by ? { id: by.id, name: by.name } : null });
      });
      items.sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id; });
      return { ok: true, items: items };
    },

    deleteResolve: function (p, me, env) {
      if (!A.isAdmin(me)) return C.forbidden();
      if (p.decision !== 'done' && p.decision !== 'rejected') return C.fail('validation', 'Оберіть: видалити чи відхилити.', [{ field: 'decision', message: 'Оберіть: видалити чи відхилити.' }]);
      env.reload();
      var st = store(env), r = st.items.filter(function (x) { return x.id === p.id && x.status === 'pending'; })[0];
      if (!r) return C.fail('not_found', REQ_GONE);
      var t = liveUser(env, r.targetId), at = env.now().toISOString();
      if (p.decision === 'done' && t) {
        var d = X.deleteDecision({ actor: P.demoPeople.actorOf(me), cur: curOf(t), had: t.locationIds });
        if (!d.ok) return P.demoPeople.failOf(d);
        removePerson(env, me, t, st);   // сам закриває й цей запит як 'done'
      } else {
        r.status = p.decision; r.handledBy = me.id; r.handledAt = at;
        env.storage.set(K_REQ, st);
      }
      A.log(env, me, 'Люди й доступи', t ? t.name : '—', [['Запит на видалення', null, p.decision === 'done' ? 'виконано' : 'відхилено']]);
      env.reload();
      return { ok: true };
    }
  });

  P.demoPeopleDelete = { pendingIds: pendingIds, K_REQ: K_REQ };
})(typeof window !== 'undefined' ? window : globalThis);
