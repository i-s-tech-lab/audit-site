(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon, S = P.demoSenior;
  P.demoApis = P.demoApis || []; P.demoResetKeys = P.demoResetKeys || []; P.demoSysApi = P.demoSysApi || {};

  var KEY = 'demo:adm:slackPosts';           // { on, intro, introCount, at, by }
  var KEY_TRASH = 'demo:sr:hist:trash';      // кошик старшого (senior-history.js): видалені аудити
  P.demoResetKeys.push(KEY);
  var MAX_INTRO = 1500, COUNT_MAX = 10, DEF_COUNT = 3;
  var DEF_INTRO = '👋 *«Аудит» тепер на сайті.* Записувати аудити можна з телефона чи компʼютера. Під кожним аудитом — кнопка «Відкрити в Аудиті»: ' +
    'вона відкриє його у вашому кабінеті. Щоб увійти перший раз, напишіть боту /audit — він надішле посилання.';

  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function nm(map, id, fb) { return map[id] ? map[id].name : fb; }
  function isAdmin(me) { return !!me && me.role === 'admin'; }

  function settings(env) {
    var s = obj(env.storage.get(KEY, null));
    var n = s.introCount;
    return { on: s.on === true, intro: typeof s.intro === 'string' ? s.intro : DEF_INTRO,
      introCount: typeof n === 'number' && Math.floor(n) === n && n >= 0 && n <= COUNT_MAX ? n : DEF_COUNT };
  }
  function locInfo(env, id) {
    var l = Object.prototype.hasOwnProperty.call(env.ix.loc, id) ? env.ix.loc[id] : null;
    return { id: id, name: l ? l.name : id, slackChannel: l && l.slackChannel ? l.slackChannel : null, slackBot: !(l && l.slackBot === false) };
  }
  function brief(s) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > 80 ? s.slice(0, 79) + '…' : s; }

  P.demoApis.push({
    admSlackPosts: function (p, me, env) {
      if (!isAdmin(me)) return C.forbidden();
      var s = settings(env);
      return { ok: true, on: s.on, intro: s.intro, introCount: s.introCount, defaultIntro: DEF_INTRO,
        limits: { introMax: MAX_INTRO, countMax: COUNT_MAX },
        locations: env.db.locations.map(function (l) {
          var i = locInfo(env, l.id);
          return { id: l.id, name: l.name, active: l.active !== false, channel: i.slackChannel, bot: i.slackBot };
        }), demo: !env.real };
    },

    admSlackPostsSave: function (p, me, env) {
      if (!isAdmin(me)) return C.forbidden();
      var cur = settings(env), next = { on: cur.on, intro: cur.intro, introCount: cur.introCount }, errs = [];
      if (p.on !== undefined) { if (typeof p.on !== 'boolean') errs.push({ field: 'on', message: 'Оберіть: пости увімкнено чи вимкнено.' }); else next.on = p.on; }
      if (p.intro !== undefined) {
        if (typeof p.intro !== 'string') errs.push({ field: 'intro', message: 'Допис — це текст.' });
        else if (p.intro.trim().length > MAX_INTRO) errs.push({ field: 'intro', message: 'Допис задовгий — до ' + MAX_INTRO + ' знаків. Скоротіть його.' });
        else next.intro = p.intro.trim();
      }
      if (p.introCount !== undefined) {
        var n = typeof p.introCount === 'string' && /^\s*\d{1,3}\s*$/.test(p.introCount) ? Number(p.introCount) : p.introCount;
        if (typeof n !== 'number' || Math.floor(n) !== n || n < 0 || n > COUNT_MAX) errs.push({ field: 'introCount', message: 'Скільки перших постів — ціле число від 0 до ' + COUNT_MAX + '.' });
        else next.introCount = n;
      }
      if (errs.length) return C.fail('validation', errs[0].message, errs);
      var rows = [];
      if (next.on !== cur.on) rows.push(['Пости в каналах', cur.on ? 'увімкнено' : 'вимкнено', next.on ? 'увімкнено' : 'вимкнено']);
      if (next.intro !== cur.intro) rows.push(['Допис над постом', brief(cur.intro), brief(next.intro)]);
      if (next.introCount !== cur.introCount) rows.push(['Скільки перших постів з дописом', cur.introCount, next.introCount]);
      env.storage.set(KEY, { on: next.on, intro: next.intro, introCount: next.introCount, at: env.now().toISOString(), by: me.id });
      if (P.demoAdmin && P.demoAdmin.log) P.demoAdmin.log(env, me, 'Пости в Slack', 'Пости в каналах', rows);
      return { ok: true, on: next.on, intro: next.intro, introCount: next.introCount };
    }
  });

  P.demoSysApi.auditPostData = function (p, env) {
    var id = String(p && p.id || ''), crit = env.db.settings.criticalPct;
    var a = env.audits().filter(function (x) { return x.id === id; })[0];
    if (!a) {
      var t = S.get(env, KEY_TRASH, []).filter(function (x) { return x && x.id === id; })[0];
      if (!t) return C.fail('not_found', 'Аудит не знайдено.');
      return { ok: true, audit: { id: id, deleted: true, isTest: false, locationId: t.locationId }, criticalPct: crit, location: locInfo(env, t.locationId) };
    }
    var ix = env.ix, user = ix.user[a.auditorId], checked = C.checkedOf(a), rejected = C.rejectedOf(a), defects = [];
    a.defects.forEach(function (d) {
      d.guilty.forEach(function (g) {
        defects.push({ defectTypeName: nm(ix.def, d.defectTypeId, 'Невідомий вид браку'), workerCode: g.workerCode || '', qty: g.qty });
      });
    });
    return { ok: true, criticalPct: crit, location: locInfo(env, a.locationId), audit: {
      id: a.id, deleted: false, isTest: a.isTest !== false, locationId: a.locationId, locationName: nm(ix.loc, a.locationId, a.locationId),
      departmentId: a.departmentId, departmentName: nm(ix.dep, a.departmentId, a.departmentId),
      auditorName: user ? user.name : (a.auditorName || ''), auditorSlackId: (user && user.slackId) || a.auditorSlackId || '',
      createdAt: a.createdAt, checked: checked, rejected: rejected, pct: C.pct(rejected, checked), comment: a.comment || '',
      items: a.items.map(function (i) { return { productName: nm(ix.prod, i.productId, 'Невідомий виріб'), orderNo: i.orderNo || '', qty: i.qty }; }),
      defects: defects } };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P.demoApis[P.demoApis.length - 1];
})(typeof window !== 'undefined' ? window : globalThis);
