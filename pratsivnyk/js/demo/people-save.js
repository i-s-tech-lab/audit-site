(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, A = P.demoAdmin, X = P.demoAccess;
  P.demoApis = P.demoApis || []; P.demoGenHooks = P.demoGenHooks || [];

  var K_SR_USERS = 'demo:sr:mg:users';    // правки людей старшого (senior-manage.js): { add: [...], edit: { id: {name, slackId, active} } }
  var ALL_LOC = { manager: 1, admin: 1 };  // ці ролі завжди мають усі локації
  var SLACK_ID_MSG = 'Slack ID — літера U або W і ще 8–10 великих літер чи цифр.';
  var DM_FAIL_ID = 'U-DEMO-945';           // у цієї вигаданої людини «Slack не приймає повідомлення» — показ збою кнопки входу
  var DM_FAIL_MSG = 'Slack відповів помилкою: cannot_dm_user';
  var DM_FAIL_PUBLIC = 'Повідомлення в Slack не вдалося надіслати.';   // не-адміну технічну причину не показуємо (як на сервері)
  var REQ_GONE = 'Цей запит уже оброблено — оновіть сторінку.';

  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function squash(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function verr(errs) { return C.fail('validation', errs[0].message, errs); }
  function locNames(env, ids) { return ids.map(function (id) { return env.ix.loc[id] ? env.ix.loc[id].name : id; }).join(', '); }
  function srStore(env) { var s = obj(env.storage.get(K_SR_USERS, null)); s.add = arr(s.add); s.edit = obj(s.edit); return s; }
  function failOf(d) {
    return d.code === 'validation' ? C.fail('validation', d.error, [{ field: d.field, message: d.error }]) : C.fail(d.code, d.error);
  }

  function actorOf(me) {
    return { id: me.id, role: me.role, active: true, canAddPeople: !!(me.access && me.access.addPeople),
      locationIds: arr(me.locations).map(function (l) { return l.id; }) };
  }
  function curOf(u) {
    return { id: u.id, role: u.role, active: u.active !== false, disabledBy: u.disabledBy || null, name: u.name, slackId: u.slackId,
      canAddPeople: u.canAddPeople === true };
  }
  function addedToday(env, meId) {
    var cut = new Date(env.now().getTime() - 86400000).toISOString(), n = 0;
    A.peopleStore(env.storage).add.concat(srStore(env).add).forEach(function (x) {
      if (x && x.addedBy === meId && typeof x.addedAt === 'string' && x.addedAt >= cut) n++;
    });
    return n;
  }

  function takeRequest(env, me, p, isNew, delegate) {
    if (p.requestId === undefined || p.requestId === null || p.requestId === '') return { rq: null };
    var bad = function (m) { return { err: verr([{ field: 'requestId', message: m }]) }; };
    if (!isNew) return bad('Запит стосується лише нової людини.');
    if (typeof p.requestId !== 'number' || p.requestId <= 0 || Math.floor(p.requestId) !== p.requestId) return bad('Немає такого запиту.');
    if (delegate && !(me.access && me.access.addPeople)) return { err: C.forbidden() };
    var rq = A.reqFind(env, p.requestId);
    return rq && (!delegate || X.slackStateOf(rq.slackId) === 'active') ? { rq: rq } : { err: C.fail('not_found', REQ_GONE) };
  }

  function save(env, me, p, mode) {
    var delegate = mode === 'delegate';
    if (!delegate && !A.isAdmin(me)) return C.forbidden();
    env.reload();
    var st = A.peopleStore(env.storage), all = A.allUsers(env), u = null, errs = [], v = {};
    if (p.id !== undefined) {
      u = typeof p.id === 'string' ? all.filter(function (x) { return x.id === p.id; })[0] : null;
      if (!u) return C.fail('not_found', 'Цієї людини немає в списку — оновіть сторінку.');
    }
    var tk = takeRequest(env, me, p, !u, delegate);
    if (tk.err) return tk.err;
    var rq = tk.rq;
    var allowGuest = !delegate && p.allowGuest === true;   // гостя Slack-простору додає лише адмін
    if (p.allowGuest !== undefined && p.allowGuest !== null && typeof p.allowGuest !== 'boolean') errs.push({ field: 'allowGuest', message: 'Позначка «гість Slack-простору» має бути «так» або «ні».' });
    var wasOn = !u || (delegate ? u.active !== false : !has(st.off, u.id));
    if (!u || p.name !== undefined) {
      var name = squash(p.name);
      if (name.length < 2 || name.length > 60) errs.push({ field: 'name', message: 'Імʼя — від 2 до 60 знаків, наприклад «Олена К.».' }); else v.name = name;
    }
    var rawSlack = rq ? rq.slackId : p.slackId;
    var keepMasked = delegate && !!u && squash(rawSlack).toUpperCase() === C.maskSlackId(u.slackId).toUpperCase();
    if (!u || (rawSlack !== undefined && squash(rawSlack) !== '' && !keepMasked)) {
      var slackId = squash(rawSlack).toUpperCase();
      if (!C.isSlackId(slackId)) errs.push({ field: 'slackId', message: SLACK_ID_MSG });
      else if (delegate && u && slackId !== String(u.slackId || '').toUpperCase()) v.slackId = slackId;
      else if (all.some(function (x) { return x !== u && String(x.slackId).toUpperCase() === slackId; })) errs.push({ field: 'slackId', message: 'Цей Slack ID уже є в списку.' });
      else if (!u || slackId !== String(u.slackId || '').toUpperCase()) {
        var chk = X.addCheckDecision(X.slackStateOf(slackId), { allowGuest: allowGuest });
        if (chk.ok) v.slackId = slackId; else errs.push({ field: 'slackId', message: chk.error });
      } else v.slackId = slackId;
    }
    var role = u ? u.role : null;
    if (!u || p.role !== undefined) {
      if (A.ROLES.indexOf(p.role) >= 0 || (u && p.role === u.role)) role = p.role;
      else errs.push({ field: 'role', message: 'Оберіть роль зі списку.' });
    }
    var locIds = u ? u.locationIds.slice() : [];
    if (role && has(ALL_LOC, role)) locIds = env.db.locations.map(function (l) { return l.id; });
    else if (!u || p.locationIds !== undefined || (u && has(ALL_LOC, u.role))) {
      var seen = {};
      locIds = arr(p.locationIds).filter(function (id) { if (typeof id !== 'string' || !has(env.ix.loc, id) || seen[id]) return false; seen[id] = 1; return true; });
      if (!locIds.length) errs.push({ field: 'locationIds', message: 'Оберіть хоча б одну локацію.' });
    }
    var on = wasOn;
    if (p.active !== undefined) { if (typeof p.active !== 'boolean') errs.push({ field: 'active', message: 'Оберіть: доступ увімкнено чи вимкнено.' }); else on = p.active; }
    if (!delegate) {
      var selfSlack = !!u && u.id === me.id && v.slackId !== undefined && v.slackId !== String(u.slackId || '').toUpperCase();
      if (u && u.id === me.id && (!on || role !== 'admin' || selfSlack)) errs.push({ field: !on ? 'active' : selfSlack ? 'slackId' : 'role', message: 'Свою роль, доступ і Slack ID змінює інший адміністратор.' });
      else if (u && u.role === 'admin' && wasOn && (!on || role !== 'admin') &&
        !all.some(function (x) { return x !== u && x.role === 'admin' && !has(st.off, x.id); })) {
        errs.push({ field: !on ? 'active' : 'role', message: 'Це єдиний адміністратор із доступом. Спершу додайте ще одного адміністратора.' });
      }
    }
    var given = p.canAddPeople;
    if (given !== undefined && !delegate) {
      if (typeof given !== 'boolean') errs.push({ field: 'canAddPeople', message: 'Оберіть: право є чи немає.' });
      else { var gd = X.grantDecision({ actorRole: 'admin', targetRole: role, value: given }); if (!gd.ok) errs.push({ field: gd.field, message: gd.error }); }
    }
    if (errs.length) return verr(errs);
    if (!delegate && !u) { var lim = X.addLimitDecision(addedToday(env, me.id)); if (!lim.ok) return failOf(lim); }
    if (delegate) {
      var dec = X.delegateSaveDecision({ actor: actorOf(me), cur: u ? curOf(u) : null, had: u ? u.locationIds : [],
        next: { role: role, slackId: v.slackId !== undefined ? v.slackId : (u ? u.slackId : ''), locationIds: locIds, active: on, name: v.name, canAddPeople: given },
        addedToday: addedToday(env, me.id) });
      if (!dec.ok) return failOf(dec);
    }
    var rows = [], L = P.demoDict.roleLabels, id = u ? u.id : null, sr = srStore(env), srDirty = false, at = env.now().toISOString();
    var grant = X.nextCanAddPeople({ cur: u ? { role: u.role, canAddPeople: u.canAddPeople } : null, nextRole: role, given: delegate ? undefined : given, byAdmin: !delegate });
    if (!u) {
      var n = 0;
      all.concat(st.add).forEach(function (x) { var m = /^u_new(\d+)$/.exec(x.id); if (m) n = Math.max(n, +m[1]); });
      id = 'u_new' + (n + 1);
      var rec = { id: id, name: v.name, role: role, slackId: v.slackId, locationIds: locIds, addedAt: at, addedBy: me.id };
      rec.canAddPeople = grant;   // v1.2: записуємо завжди — явне «Ні» адміна для старшого / керівника не губиться
      st.add.push(rec);
      rows.push(['Нова людина', null, L[role] + ' · ' + locNames(env, locIds)]);
      if (grant) rows.push(['Право «Додавати людей»', 'немає', 'є']);
    } else {
      var prof = {};
      if (has(v, 'name') && v.name !== u.name) { prof.name = v.name; rows.push(['Імʼя', u.name, v.name]); }
      if (has(v, 'slackId') && v.slackId !== u.slackId) { prof.slackId = v.slackId; rows.push(['Slack ID', C.maskSlackId(u.slackId), C.maskSlackId(v.slackId)]); }
      if (Object.keys(prof).length) { sr.edit[id] = Object.assign(obj(sr.edit[id]), prof); srDirty = true; }
      var e = obj(st.edit[id]);
      if (role !== u.role) { e.role = role; rows.push(['Роль', L[u.role], L[role]]); }
      if (locIds.join() !== u.locationIds.join()) { e.locationIds = locIds; rows.push(['Локації', locNames(env, u.locationIds), locNames(env, locIds)]); }
      if (grant !== (u.canAddPeople === true) || role !== u.role) e.canAddPeople = grant;   // v1.2: зміна ролі фіксує право (явне «Ні» теж)
      if (grant !== (u.canAddPeople === true)) rows.push(['Право «Додавати людей»', u.canAddPeople === true ? 'є' : 'немає', grant ? 'є' : 'немає']);
      st.edit[id] = e;
      if (on !== wasOn) rows.push(['Доступ', wasOn ? 'увімкнено' : 'вимкнено', on ? 'увімкнено' : 'вимкнено']);
    }
    var prevOff = has(st.off, id) ? obj(st.off[id]) : null;
    if (on) {
      delete st.off[id];
      if (delegate && !wasOn && obj(sr.edit[id]).active === false) { sr.edit[id].active = true; srDirty = true; }
    } else if (delegate && me.role !== 'manager') {
      if (wasOn) { sr.edit[id] = Object.assign(obj(sr.edit[id]), { active: false }); srDirty = true; }
    } else {
      var byRole = X.disabledByFor({ actorRole: delegate ? me.role : 'admin', cur: u ? { active: wasOn, disabledBy: u.disabledBy || (prevOff && prevOff.byRole) || null } : null,
        nextActive: false, explicitOff: p.active === false });
      st.off[id] = prevOff && (prevOff.byRole || 'admin') === byRole ? prevOff : { at: at, by: me.id, byRole: byRole };
    }
    env.storage.set(A.K.people, st);
    if (srDirty) env.storage.set(K_SR_USERS, sr);
    A.log(env, me, 'Люди й доступи', u ? u.name : v.name, rows);
    if (!u) A.reqClose(env, me, v.slackId, id);   // запит «Хочуть увійти» цієї людини закривається сам
    var w = !u && on ? welcome(env, me, v.name, v.slackId) : { dm: 'skipped' };
    env.reload();
    var x = A.allUsers(env).filter(function (y) { return y.id === id; })[0];
    return Object.assign({ ok: true, id: id, name: x.name, active: on, created: !u }, w);
  }

  function welcome(env, me, name, slackId) {
    var bad = String(slackId).toUpperCase() === DM_FAIL_ID;
    A.log(env, me, 'Вхід через Slack', name, [bad ? ['Кнопку входу в Slack не надіслано', null, DM_FAIL_MSG] : ['Кнопку входу надіслано в Slack', null, 'особисто']]);
    return bad ? { dm: 'failed', dmError: A.isAdmin(me) ? DM_FAIL_MSG : DM_FAIL_PUBLIC } : { dm: 'sent' };   // v1.3: причину бачить лише адмін
  }

  function srGate(env, me, u, next) {
    if (me.role === 'admin') return null;
    var d = X.delegateSaveDecision({ actor: actorOf(me), cur: u ? curOf(u) : null, had: u ? u.locationIds : [], next: next, addedToday: addedToday(env, me.id) });
    return d.ok ? null : failOf(d);
  }
  function srReq(env, me, p) {
    var t = takeRequest(env, me, p, !p.id, me.role !== 'admin');
    if (t.err) return t;
    var raw = t.rq ? t.rq.slackId : p.slackId;
    if (!p.id && raw != null) {
      var chk = X.addCheckDecision(X.slackStateOf(squash(raw).toUpperCase()), { allowGuest: A.isAdmin(me) && p.allowGuest === true });
      if (!chk.ok) return { err: verr([{ field: 'slackId', message: chk.error }]) };
    }
    return { p: t.rq ? Object.assign({}, p, { slackId: t.rq.slackId }) : p };
  }
  function srDone(env, me, x, isNew) {
    if (!isNew) return { dm: 'skipped' };
    A.reqClose(env, me, x.slackId, x.id);
    return x.active !== false ? welcome(env, me, x.name, x.slackId) : { dm: 'skipped' };
  }
  function srRow(me, u) {
    var row = { id: u.id, role: u.role, active: u.active !== false, disabledBy: u.disabledBy || null };
    return { disabledBy: row.disabledBy, canEnable: X.rowPermissions({ actor: actorOf(me), row: row, had: u.locationIds }).canEnable };
  }
  function srAccess(env, me) {
    return { canAdd: !!(me.access && me.access.addPeople), addedToday: addedToday(env, me.id), limit: me.access ? me.access.addLimitPerDay : null };
  }
  function srLog(env, me, loc, was, x, isNew) {
    var rows = [];
    if (isNew) rows.push(['Нова людина', null, P.demoDict.roleLabels.auditor + ' · ' + loc.name]);
    else {
      if (was.name !== x.name) rows.push(['Імʼя', was.name, x.name]);
      if (was.slackId !== C.maskSlackId(x.slackId)) rows.push(['Slack ID', was.slackId, C.maskSlackId(x.slackId)]);
      if (was.active !== (x.active !== false)) rows.push(['Доступ', was.active ? 'увімкнено' : 'вимкнено', x.active !== false ? 'увімкнено' : 'вимкнено']);
    }
    A.log(env, me, 'Люди й доступи', x.name, rows);
  }

  P.demoApis.push({
    adminPersonSave: function (p, me, env) { return save(env, me, p, 'admin'); },

    peopleTeam: function (p, me, env) {
      var admin = A.isAdmin(me);
      if (!admin && X.DELEGATE_ROLES.indexOf(me.role) < 0) return C.forbidden();
      var actor = actorOf(me), scope = X.actorScope(actor), all = A.allUsers(env), byId = {}, last = {};
      all.forEach(function (u) { byId[u.id] = u; });
      env.audits().forEach(function (a) { if (!last[a.auditorId] || a.createdAt > last[a.auditorId]) last[a.auditorId] = a.createdAt; });
      var users = all.filter(function (u) {
        if (admin) return true;
        if (!(X.rankOf(u.role) > 0 && X.rankOf(u.role) < X.rankOf(me.role))) return false;   // лише нижчі за мене (себе й вищих — ні)
        return scope === null || arr(u.locationIds).some(function (l) { return scope.indexOf(l) >= 0; });
      }).map(function (u) {
        var by = u.addedBy && has(byId, u.addedBy) ? byId[u.addedBy] : null, c = curOf(u);
        var perm = X.rowPermissions({ actor: actor, row: c, had: u.locationIds });
        return { id: u.id, slackId: admin || u.role === 'auditor' ? String(u.slackId || '') : C.maskSlackId(u.slackId), name: u.name, role: u.role,
          roleLabel: P.demoDict.roleLabels[u.role] || u.role, active: c.active, disabledBy: c.active ? null : c.disabledBy || 'admin',
          locationIds: arr(u.locationIds).slice(), createdAt: u.addedAt || null, lastSeenAt: last[u.id] || null, canAddPeople: c.canAddPeople,
          addedBy: by ? { id: by.id, name: by.name, role: by.role } : null, canEdit: perm.canEdit, canEnable: perm.canEnable };
      }).sort(function (a, b) { return a.name.localeCompare(b.name, 'uk'); });
      return { ok: true, users: users, access: Object.assign({}, me.access || X.accessOf({}), { addedToday: addedToday(env, me.id) }) };
    },

    peopleTeamSave: function (p, me, env) { return save(env, me, p, A.isAdmin(me) ? 'admin' : 'delegate'); }
  });

  P.demoPeople = { save: save, addedToday: addedToday, actorOf: actorOf, curOf: curOf, failOf: failOf, SLACK_ID_MSG: SLACK_ID_MSG,
    srGate: srGate, srReq: srReq, srDone: srDone, srRow: srRow, srAccess: srAccess, srLog: srLog };
})(typeof window !== 'undefined' ? window : globalThis);
