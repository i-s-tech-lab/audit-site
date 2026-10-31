(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  if (!P.search) return;

  function tab(id, label, path, tags) {
    return { id: 'tab-' + id, t: label, s: 'Вкладка', tags: ['вкладка', 'розділ'].concat(tags), path: path };
  }

  var UI = [
    tab('overview', 'Огляд', '/overview', ['огляд', 'головна']),
    tab('locations', 'Локації', '/locations', ['локація', 'цех']),
    tab('people', 'Люди й доступи', '/people', ['людина', 'аудитор', 'старший', 'керівник', 'адміністратор', 'доступ']),
    tab('slack', 'Вхід через Slack', '/slack-login', ['slack', 'вхід', 'доступ']),
    tab('rules', 'Правила', '/rules', ['правила', 'налаштування']),
    tab('dicts', 'Довідники', '/dicts', ['довідник', 'відділ', 'вид браку', 'виріб']),
    tab('audits', 'Аудити', '/audits', ['аудит']),
    tab('broken', 'Биті записи', '/broken', ['биті записи', 'помилка', 'перевірка', 'аудит']),
    tab('mailing', 'Розсилки', '/mailing', ['розсилка', 'сповіщення']),
    tab('slackposts', 'Пости в каналах', '/slack-posts', ['пост', 'канал', 'slack', 'аудит', 'допис']),
    tab('activity', 'Активність', '/activity', ['активність', 'журнал']),
    tab('status', 'Стан', '/status', ['стан', 'сервер']),
    tab('backups', 'Резервні копії', '/backups', ['копія', 'резервна копія', 'база']),
    tab('server', 'Сервер', '/server', ['сервер', 'ресурси']),
    tab('prelaunch', 'Перед запуском', '/prelaunch', ['перевірки', 'запуск', 'готовність', 'канал важливе', 'сторож']),
    tab('slackcfg', 'Налаштування Slack', '/slack-settings', ['slack', 'бот', 'ключ', 'токен', 'секрет', 'client id', 'signing secret'])
  ];

  function q(id) { return String(id).replace(/["\\]/g, '\\$&'); }

  function route(it) {
    switch (it.k) {
      case 'ui': return { path: it.path };
      case 'person': return { path: '/people', query: { edit: it.id } };
      case 'loc': return { path: '/locations' };
      case 'dept':
      case 'defect':
      case 'product': return { path: '/dicts' };
      case 'audit': return { path: '/audits' };
    }
    return null;
  }

  function after(it) {
    if (it.k === 'audit') P.search.waitFor('tr[data-act="au-open"][data-id="' + q(it.id) + '"]', function (row) { row.click(); }, 1500);
  }

  P.search.setup({ app: 'admin', ui: UI, route: route, after: after });

  if (typeof module !== 'undefined' && module.exports) module.exports = { UI: UI, route: route };
})(typeof window !== 'undefined' ? window : globalThis);
