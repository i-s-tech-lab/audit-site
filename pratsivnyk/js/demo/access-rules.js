(function (root) {
  'use strict';
  var P = root.P = root.P || {};

  var ROLE_RANK = { auditor: 1, senior_auditor: 2, manager: 3, admin: 4 };
  var ASSIGNABLE_ROLES = ['auditor', 'senior_auditor', 'manager', 'admin'];
  var DELEGATE_ROLES = ['senior_auditor', 'manager'];
  var DELEGATE_ADDS_PER_DAY = 20;

  function has(o, k) { return o != null && Object.prototype.hasOwnProperty.call(o, k); }
  var isArr = Array.isArray;
  function isOn(x) { return !!x && x.active !== false; }
  function hasGrant(x) { return !!x && (x.canAddPeople === true || x.can_add_people === true); }
  function slackOf(x) { return String((x && (x.slackId != null ? x.slackId : x.slack_id)) || '').toUpperCase(); }
  function disabledOf(x) { return (x && (x.disabledBy != null ? x.disabledBy : x.disabled_by)) || null; }
  function sameSet(a, b) {
    var x = uniq(isArr(a) ? a : []), y = uniq(isArr(b) ? b : []);
    if (x.length !== y.length) return false;
    return x.every(function (v) { return y.indexOf(v) >= 0; });
  }
  function uniq(list) { return list.filter(function (v, i) { return list.indexOf(v) === i; }); }
  function bad(code, error, field) { return { ok: false, code: code, field: field || '', error: error }; }


  function rankOf(role) { return has(ROLE_RANK, role) ? ROLE_RANK[role] : 0; }

  function addableRoles(actorRole) {
    if (actorRole === 'admin') return ASSIGNABLE_ROLES.slice();
    if (actorRole === 'manager') return ['auditor', 'senior_auditor'];
    if (actorRole === 'senior_auditor') return ['auditor'];
    return [];
  }

  function actorScope(actor) {
    var a = actor || {};
    if (a.role === 'admin' || a.role === 'manager') return null;
    if (a.role === 'senior_auditor') return isArr(a.locationIds) ? a.locationIds.slice() : [];
    return [];
  }

  function accessOf(user) {
    var u = user || {};
    if (u.role === 'admin') return { addPeople: true, addRoles: ASSIGNABLE_ROLES.slice(), addLimitPerDay: null };
    if (DELEGATE_ROLES.indexOf(u.role) >= 0 && isOn(u) && hasGrant(u)) {
      return { addPeople: true, addRoles: addableRoles(u.role), addLimitPerDay: DELEGATE_ADDS_PER_DAY };
    }
    return { addPeople: false, addRoles: [], addLimitPerDay: DELEGATE_ADDS_PER_DAY };
  }


  function isCloseOnly(o) {
    var cur = o.cur, had = o.had, next = o.next;
    if (!cur || !next || !isOn(cur) || next.active !== false) return false;
    if (next.role !== cur.role) return false;
    if (slackOf(next) !== slackOf(cur)) return false;
    if (!isArr(next.locationIds) || !sameSet(next.locationIds, had)) return false;
    var name = next.name == null ? '' : String(next.name);
    return !name || name === String((cur && cur.name) || '');
  }

  function disabledAbove(cur, actorRole) { return rankOf(disabledOf(cur) || 'admin') > rankOf(actorRole); }

  function delegateSaveDecision(o) {
    var a = o.actor || {}, cur = o.cur, n = o.next || {}, hadIds = isArr(o.had) ? o.had : [];
    if (DELEGATE_ROLES.indexOf(a.role) < 0 || !isOn(a)) return bad('forbidden', 'Немає прав на цю дію.');
    if (cur && cur.id === a.id) return bad('forbidden', 'Свій доступ, роль і локації змінює адміністратор.');
    if (cur) {
      var r = rankOf(cur.role);
      if (!(r > 0 && r < rankOf(a.role))) return bad('forbidden', 'Змінювати можна лише людей з роллю, нижчою за вашу.');
    }
    var scope = actorScope(a);
    if (scope !== null && cur && (!hadIds.length || !hadIds.every(function (x) { return scope.indexOf(x) >= 0; }))) {
      return bad('forbidden', 'Ця людина має й інші локації — змінити її може адміністратор.');
    }
    if (isCloseOnly({ cur: cur, had: hadIds, next: n })) return { ok: true, closeOnly: true };
    if (!hasGrant(a)) return bad('forbidden', 'Додавати й змінювати людей можна з правом «Додавати людей» — його дає адміністратор.');
    if (n.canAddPeople !== undefined && n.canAddPeople !== null && !!n.canAddPeople !== hasGrant(cur)) {
      return bad('forbidden', 'Право «Додавати людей» дає лише адміністратор.', 'canAddPeople');
    }
    if (addableRoles(a.role).indexOf(n.role) < 0) return bad('forbidden', 'Можна дати лише роль, нижчу за вашу.', 'role');
    var ids = isArr(n.locationIds) ? n.locationIds : [];
    if (!ids.length) return bad('validation', 'Оберіть хоча б одну локацію.', 'locationIds');
    if (scope !== null && !ids.every(function (x) { return scope.indexOf(x) >= 0; })) return bad('forbidden', 'Можна призначати лише свої локації.', 'locationIds');
    if (cur && slackOf(n) !== slackOf(cur)) return bad('forbidden', 'Slack ID наявної людини змінює лише адміністратор.', 'slackId');
    if (cur && !isOn(cur) && n.active === true && disabledAbove(cur, a.role)) {
      return bad('forbidden', rankOf(disabledOf(cur) || 'admin') >= rankOf('admin')
        ? 'Доступ цій людині вимкнув адміністратор — увімкнути може лише адміністратор.'
        : 'Доступ цій людині вимкнув керівник — увімкнути може керівник або адміністратор.', 'active');
    }
    if (!cur && (Number(o.addedToday) || 0) >= DELEGATE_ADDS_PER_DAY) {
      return bad('rate', 'Сьогодні ви вже додали ' + DELEGATE_ADDS_PER_DAY + ' людей — більше можна завтра або попросіть адміністратора.');
    }
    return { ok: true, closeOnly: false };
  }

  function rowPermissions(o) {
    var a = o.actor || {}, r = o.row || {};
    var none = { canEdit: false, canEnable: false, canClose: false };
    if (a.role === 'admin') return { canEdit: true, canEnable: !isOn(r), canClose: isOn(r) && r.id !== a.id };
    if (DELEGATE_ROLES.indexOf(a.role) < 0 || !isOn(a)) return none;
    if (r.id === a.id) return none;
    var rr = rankOf(r.role);
    if (!(rr > 0 && rr < rankOf(a.role))) return none;
    var scope = actorScope(a), hadIds = isArr(o.had) ? o.had : [];
    if (scope !== null && (!hadIds.length || !hadIds.every(function (x) { return scope.indexOf(x) >= 0; }))) return none;
    var grant = hasGrant(a);
    return {
      canEdit: grant && addableRoles(a.role).indexOf(r.role) >= 0,
      canEnable: grant && !isOn(r) && !disabledAbove(r, a.role),
      canClose: isOn(r)
    };
  }


  function grantDecision(o) {
    if (o.actorRole !== 'admin') return bad('forbidden', 'Право «Додавати людей» дає лише адміністратор.', 'canAddPeople');
    if (!o.value) return { ok: true };
    if (DELEGATE_ROLES.indexOf(o.targetRole) < 0) return bad('validation', 'Це право буває лише в старшого аудитора й керівника.', 'canAddPeople');
    if (o.targetActive === false) return bad('validation', 'Спершу увімкніть людині доступ.', 'canAddPeople');
    return { ok: true };
  }

  function nextCanAddPeople(o) {
    var cur = o.cur;
    if (o.nextActive === false || DELEGATE_ROLES.indexOf(o.nextRole) < 0) return false;
    var hasGiven = o.given !== undefined && o.given !== null;
    if (cur && cur.role !== o.nextRole && !hasGiven) return false;
    return hasGiven ? !!o.given : hasGrant(cur);
  }

  function disabledByFor(o) {
    var cur = o.cur;
    if (o.nextActive) return null;
    if (cur && cur.active === false) {
      var prev = disabledOf(cur) || 'admin';
      if (!o.explicitOff) return prev;
      return rankOf(o.actorRole) >= rankOf(prev) ? o.actorRole : prev;
    }
    return o.actorRole;
  }


  var ADD_CHECK_TEXT = {
    deleted: 'У Slack цей акаунт вимкнено — додати не вийде.',
    bot: 'Це бот, а не людина.',
    guest: 'Це гість Slack-простору — додати можна лише учасника простору.',
    other_team: 'Ця людина з іншого Slack-простору.',
    not_found: 'У Slack такої людини немає — перевірте ID.',
    error: 'Не вдалося перевірити людину в Slack — спробуйте ще раз за хвилину.'
  };
  function addCheckDecision(state) {
    if (state === 'active') return { ok: true };
    return bad('validation', has(ADD_CHECK_TEXT, state) ? ADD_CHECK_TEXT[state] : ADD_CHECK_TEXT.error, 'slackId');
  }

  var DEMO_SLACK = {
    'U-DEMO-941': { state: 'guest', name: 'Гість Slack-простору' },
    'U-DEMO-942': { state: 'deleted', name: 'Колишній працівник' },
    'U-DEMO-943': { state: 'other_team', name: 'Людина з іншого простору' },
    'U-DEMO-944': { state: 'bot', name: 'Службовий бот' }
  };
  function slackStateOf(slackId) {
    var id = String(slackId == null ? '' : slackId).toUpperCase();
    return has(DEMO_SLACK, id) ? DEMO_SLACK[id].state : 'active';
  }
  function slackNameOf(slackId) {
    var id = String(slackId == null ? '' : slackId).toUpperCase();
    return has(DEMO_SLACK, id) ? DEMO_SLACK[id].name : null;
  }

  P.demoAccess = {
    ROLE_RANK: ROLE_RANK, ASSIGNABLE_ROLES: ASSIGNABLE_ROLES, DELEGATE_ROLES: DELEGATE_ROLES, DELEGATE_ADDS_PER_DAY: DELEGATE_ADDS_PER_DAY,
    DEMO_SLACK: DEMO_SLACK, ADD_CHECK_TEXT: ADD_CHECK_TEXT,
    rankOf: rankOf, addableRoles: addableRoles, actorScope: actorScope, accessOf: accessOf, isCloseOnly: isCloseOnly,
    delegateSaveDecision: delegateSaveDecision, rowPermissions: rowPermissions, grantDecision: grantDecision,
    nextCanAddPeople: nextCanAddPeople, disabledByFor: disabledByFor, addCheckDecision: addCheckDecision,
    slackStateOf: slackStateOf, slackNameOf: slackNameOf
  };
})(typeof window !== 'undefined' ? window : globalThis);
