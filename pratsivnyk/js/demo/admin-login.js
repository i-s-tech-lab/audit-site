(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, A = P.demoAdmin;
  P.demoApis = P.demoApis || [];

  var CHANNEL_ID = /^(?:[CG][A-Z0-9]{8,10}|C-DEMO-[0-9]{3})$/;     // ID каналу Slack: справжній або вигаданий (демо)
  var NOT_LISTED_MSG = 'Вас ще немає в списку доступу. Адміністратор уже бачить ваш запит — коли він вас додасть, натисніть «Увійти через Slack» ще раз.';
  var SEED_REQUESTS = [
    { id: 1, slackId: 'U-DEMO-901', name: 'Марія Т.', agoMin: 95 },
    { id: 2, slackId: 'U-DEMO-902', name: 'Ігор Б.', agoMin: 1560 }
  ];
  var GUEST = { slackId: 'U-DEMO-950', name: 'Гість зі Slack' };   // «людина не зі списку» у демо-вході

  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function squash(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function verr(errs) { return C.fail('validation', errs[0].message, errs); }

  function reqStore(env) {
    var s = obj(env.storage.get(A.K.requests, null));
    if (!Array.isArray(s.items)) {
      var t = env.now().getTime();
      s = { items: SEED_REQUESTS.map(function (r) { return { id: r.id, slackId: r.slackId, name: r.name, createdAt: new Date(t - r.agoMin * 60000).toISOString(), status: 'pending' }; }) };
    }
    s.items = s.items.filter(function (x) { return x && typeof x === 'object'; }).map(function (x) {
      var m = typeof x.id === 'string' ? /^rq_(\d+)$/.exec(x.id) : null, y = Object.assign({}, x);
      if (m) y.id = +m[1];
      if (!y.createdAt && y.at) y.createdAt = y.at;
      delete y.at;
      if (y.status === 'new') y.status = 'pending';   // v1.6: старі збережені запити
      return y;
    });
    return s;
  }
  function reqNextId(items) {
    var n = 0;
    items.forEach(function (x) { if (typeof x.id === 'number') n = Math.max(n, x.id); });
    return n + 1;
  }
  function noteUnknown(env) {
    if (P.demoAccessLog) P.demoAccessLog.note(env, { event: 'not_listed', slackId: GUEST.slackId });
  }

  P.demoApis.push({
    admAccessRequests: function (p, me, env) {
      if (!A.isAdmin(me)) return C.forbidden();
      var items = reqStore(env).items.filter(function (x) { return x.status === 'pending'; })
        .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0; })
        .map(function (x) { return { id: x.id, slackId: x.slackId, name: x.name, createdAt: x.createdAt, status: x.status }; });
      return { ok: true, requests: items };
    },

    admAccessResolve: function (p, me, env) {
      if (!A.isAdmin(me)) return C.forbidden();
      var st = reqStore(env), r = typeof p.id === 'string' || typeof p.id === 'number' ? st.items.filter(function (x) { return String(x.id) === String(p.id); })[0] : null;
      if (!r || r.status !== 'pending') return C.fail('not_found', 'Цього запиту вже немає — оновіть сторінку.');
      if (p.decision !== 'added' && p.decision !== 'rejected') return verr([{ field: 'decision', message: 'Оберіть: додати чи відхилити.' }]);
      r.status = p.decision; r.doneAt = env.now().toISOString(); r.by = me.id;
      if (p.decision === 'added' && typeof p.userId === 'string') r.userId = p.userId;
      env.storage.set(A.K.requests, st);
      A.log(env, me, 'Вхід через Slack', r.name, [['Запит на вхід', 'чекав на рішення', p.decision === 'added' ? 'додано до списку' : 'відхилено']]);
      return { ok: true, id: r.id, decision: p.decision, name: r.name };
    },

    admLoginButtonSend: function (p, me, env) {
      if (!A.isAdmin(me)) return C.forbidden();
      var dest;
      if (p.kind === 'channel') {
        var ch = squash(p.channelId).toUpperCase();
        if (!CHANNEL_ID.test(ch)) return verr([{ field: 'channelId', message: 'ID каналу — літера C або G і ще 8–10 великих літер чи цифр.' }]);
        dest = 'у канал ' + C.maskSlackId(ch);
      } else if (p.kind === 'person') {
        var u = typeof p.userId === 'string' ? A.allUsers(env).filter(function (x) { return x.id === p.userId; })[0] : null;
        if (!u || Object.prototype.hasOwnProperty.call(A.peopleStore(env.storage).off, u.id) || !u.slackId) return verr([{ field: 'userId', message: 'Оберіть людину зі списку.' }]);
        dest = 'особисто · ' + u.name;
      } else return verr([{ field: 'kind', message: 'Оберіть: у канал чи людині.' }]);
      A.log(env, me, 'Вхід через Slack', 'Кнопка входу', [['Кнопку входу надіслано', null, dest]]);
      return { ok: true, kind: p.kind, destination: dest };
    },

    slackLookup: function (p, me, env) {
      if (!A.isAdmin(me) && !(me.access && me.access.addPeople)) return C.forbidden();
      var id = squash(p.slackId).toUpperCase();
      if (!C.isSlackId(id)) return verr([{ field: 'slackId', message: P.demoPeople.SLACK_ID_MSG }]);
      var u = A.allUsers(env).filter(function (x) { return String(x.slackId).toUpperCase() === id; })[0];
      var name = u ? u.name : null;
      if (!name) { var r = reqStore(env).items.filter(function (x) { return x.slackId === id && x.status === 'pending'; })[0]; if (r) name = r.name; }
      if (!name) name = P.demoAccess.slackNameOf(id);
      return { ok: true, slackId: id, found: !!name, name: name, state: P.demoAccess.slackStateOf(id) };
    },

    authDemoUnknown: function (p, me, env) {
      env.reload();   // адміністратор міг додати гостя з іншої вкладки
      if (A.allUsers(env).some(function (x) { return x.slackId === GUEST.slackId; })) return C.fail('conflict', 'Цього гостя вже додано до списку — оберіть його серед користувачів угорі.');
      var st = reqStore(env), r = st.items.filter(function (x) { return x.slackId === GUEST.slackId; })[0];
      if (r && r.status === 'pending') { noteUnknown(env); return C.fail('not_listed', NOT_LISTED_MSG); }
      if (r) { r.status = 'pending'; r.createdAt = env.now().toISOString(); }
      else st.items.push({ id: reqNextId(st.items), slackId: GUEST.slackId, name: GUEST.name, createdAt: env.now().toISOString(), status: 'pending' });
      env.storage.set(A.K.requests, st);
      noteUnknown(env);
      return C.fail('not_listed', NOT_LISTED_MSG);
    }
  });

  A.GUEST = GUEST; A.NOT_LISTED_MSG = NOT_LISTED_MSG;
})(typeof window !== 'undefined' ? window : globalThis);
