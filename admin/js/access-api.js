(function (root) {
  'use strict';
  var P = root.P = root.P || {};

  var ROLE = { auditor: 'Аудитор', senior_auditor: 'Старший аудитор', manager: 'Керівник', admin: 'Адмін' };
  var VIA = { button: 'кнопка в каналі', home: 'вкладка «Головна»', oidc: 'вхід на сайті' };
  var SLACK = { deleted: 'акаунт вимкнено', guest: 'гість простору', other_team: 'інший простір', bot: 'бот', not_found: 'не знайдено' };

  var EVENT_TEXT = {
    button_press: 'Натиснув «Увійти в Аудит»',
    token_issued: 'Отримав посилання для входу',
    exchange_ok: 'Увійшов',
    logout: 'Вийшов',
    exchange_fail: 'Посилання не спрацювало — застаріле або вже використане',
    exchange_denied: 'Спроба входу — доступ вимкнено',
    disabled: 'Натиснув «Увійти» — доступ вимкнено',
    not_listed: 'Натиснув «Увійти» — немає в списку',
    request_created: "З'явився запит «Хочуть увійти»",
    request_skipped: 'Повторне натискання — запит уже є',
    rate: 'Забагато посилань за 10 хвилин',
    wrong_team: 'Натиснув з іншого Slack-простору',
    oidc_denied: 'Вхід на сайті скасовано в Slack',
    oidc_bad_state: 'Вхід на сайті: застаріле посилання',
    oidc_token_failed: 'Вхід на сайті: Slack не підтвердив',
    oidc_userinfo_failed: 'Вхід на сайті: Slack не підтвердив',
    user_add: 'Додав людину',
    admin_user_add: 'Додав людину',
    user_save: 'Змінив людину',
    admin_user_save: 'Змінив людину',
    user_close: 'Вимкнув доступ',
    grant_on: 'Дав право «Додавати людей»',
    grant_off: 'Забрав право «Додавати людей»',
    admin_request_added: 'Запит «Хочуть увійти»: додано',
    admin_request_rejected: 'Запит «Хочуть увійти»: відхилено',
    welcome_sent: 'Надіслано кнопку входу в Slack',
    welcome_failed: 'Не вдалося надіслати кнопку входу в Slack',
    admin_postButton: 'Поклав кнопку входу в канал',
    admin_sendButton: 'Надіслав кнопку входу людині',
    sessions_closed: 'Закрив входи',
    slack_check: 'Перевірив людей у Slack',
    slack_gone: 'Slack: акаунт вимкнено — входи закрито',
    reply_failed: 'Не вдалося надіслати відповідь у Slack',
    home_failed: 'Не вдалося показати вкладку «Головна»',
    bad_signature: 'Службова подія',
    oidc_start: 'Службова подія'
  };

  function clean(o) {
    var out = {};
    Object.keys(o || {}).forEach(function (k) { if (o[k] !== undefined && o[k] !== null && o[k] !== '') out[k] = o[k]; });
    return out;
  }
  function real() { return !!(P.authSlack && P.authSlack.real && P.authSlack.real()); }
  function srvReal(action, payload) { return P.authSlack.admin(action, payload); }

  function eventText(ev) {
    var name = typeof ev === 'string' ? ev : (ev && ev.event);
    var detail = ev && typeof ev === 'object' ? ev.detail : '';
    var t = Object.prototype.hasOwnProperty.call(EVENT_TEXT, name) ? EVENT_TEXT[name] : 'Службова подія';
    if (name === 'button_press' && (detail === 'home' || detail === 'channel')) t += ' ' + (detail === 'home' ? '(у вкладці «Головна»)' : '(у каналі)');
    return t;
  }

  P.accessApi = {
    list: function () {
      return real() ? srvReal('access.list') : P.srv('admAccessList', {});
    },
    log: function (o) {
      var p = clean(o);
      return real() ? srvReal('log.list', p) : P.srv('admLoginLog', p);
    },
    close: function (o) {
      var p = o && o.all === true ? { all: true } : { userId: o && o.userId };
      return real() ? srvReal('sessions.close', p) : P.srv('admSessionsClose', p);
    },
    check: function () {
      return real() ? srvReal('slack.check') : P.srv('admSlackCheck', {});
    },
    EVENT_TEXT: EVENT_TEXT, eventText: eventText, ROLE: ROLE, VIA: VIA, SLACK: SLACK,
    viaText: function (via) { return Object.prototype.hasOwnProperty.call(VIA, via) ? VIA[via] : ''; },
    roleText: function (role) { return Object.prototype.hasOwnProperty.call(ROLE, role) ? ROLE[role] : role; },
    slackText: function (state, checkedAt) {
      var when = checkedAt ? P.fmt.date(checkedAt) + ', ' + P.fmt.time(checkedAt) : '';
      if (state === 'active') return { text: when ? 'перевірено ' + when : 'діє', bad: false };
      if (Object.prototype.hasOwnProperty.call(SLACK, state)) return { text: SLACK[state] + (checkedAt ? ' · ' + P.fmt.date(checkedAt) : ''), bad: state === 'deleted' };
      return { text: 'ще не перевірено', bad: false };
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
