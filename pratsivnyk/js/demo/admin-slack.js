(function (root) {
  'use strict';
  var P = root.P = root.P || {}, C = P.demoCommon;
  P.demoApis = P.demoApis || [];

  var FIELDS = [
    { key: 'SLACK_BOT_TOKEN', label: 'Ключ бота (Bot User OAuth Token)', secret: true, where: 'OAuth & Permissions → Bot User OAuth Token → Copy', re: /^xox[b]-[A-Za-z0-9-]{20,}$/,   // [b] — щоб сторож публікації не приймав опис формату за справжній ключ
     
      hint: 'має починатися з «xoxb» і дефіса (це Bot User OAuth Token зі сторінки OAuth & Permissions)' },
    { key: 'SLACK_SIGNING_SECRET', label: 'Підпис запитів (Signing Secret)', secret: true, where: 'Basic Information → App Credentials → Signing Secret → Show', re: /^[a-f0-9]{32}$/i,
      hint: 'це рядок із 32 літер/цифр зі сторінки Basic Information → Signing Secret (натисніть Show, виділіть потрійним кліком)' },
    { key: 'SLACK_CLIENT_ID', label: 'Client ID', secret: false, where: 'Basic Information → App Credentials → Client ID', re: /^\d{8,14}\.\d{8,14}$/,
      hint: 'два числа через крапку (Basic Information → Client ID); виділяйте ПОТРІЙНИМ кліком, інакше захопиться половина' },
    { key: 'SLACK_CLIENT_SECRET', label: 'Client Secret', secret: true, where: 'Basic Information → App Credentials → Client Secret → Show', re: /^[a-f0-9]{32}$/i,
      hint: 'це рядок із 32 літер/цифр зі сторінки Basic Information → Client Secret (натисніть Show)' }
  ];
  var NOTE = 'Тестовий сайт: ключі Slack тут не зберігаються й нікуди не надсилаються — перевіряється лише їхній вигляд.';

  function obj(v) { return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; }
  function isAdmin(me) { return P.demoAdmin.isAdmin(me); }
  function fieldOf(key) { for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].key === key) return FIELDS[i]; return null; }
  function bad(field, message) { return C.fail('validation', message, [{ field: field, message: message }]); }
  function short(v) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 80); }

  P.demoSlackKeys = { FIELDS: FIELDS };

  P.demoApis.push({
    admSlack: function (p, me) {
      if (!isAdmin(me)) return C.forbidden();
      return { ok: true, real: false, note: NOTE, team: '', bot: { ok: false, error: 'demo' }, oidc: false, stateSecret: false,
        fields: FIELDS.map(function (f) { return { key: f.key, label: f.label, secret: f.secret, where: f.where, set: false, shown: '' }; }) };
    },
    admSlackSave: function (p, me) {
      if (!isAdmin(me)) return C.forbidden();
      p = obj(p);
      if (Object.prototype.hasOwnProperty.call(p, 'oidc')) return { ok: true, demo: true, note: NOTE };
      var f = fieldOf(String(p.key || ''));
      if (!f) return bad('key', 'Це поле тут не змінюється.');
      var v = String(p.value == null ? '' : p.value).trim();
      if (!v) return bad('value', 'Вставте значення. Щоб змінити ключ, вставте новий — старий заміниться.');
      if (!f.re.test(v)) return bad('value', 'Не схоже на потрібне значення: ' + f.hint + '.');
      return { ok: true, demo: true, note: NOTE };
    },
    admSlackLog: function (p, me, env) {
      if (!isAdmin(me)) return C.forbidden();
      p = obj(p);
      var label = short(p.label);
      if (!label) return bad('label', 'Немає назви поля.');
      P.demoAdmin.log(env, me, 'Система', 'Slack', [[label, short(p.from), short(p.to)]]);
      return { ok: true };
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);
