(function (root) {
  'use strict';
  var P = root.P, doc = root.document;
  if (!P || !P.ic || !P.mountIcons) return;

  var cfg = P.config || {};
  if (cfg.backend === 'supabase' && cfg.authUrl) {
    var hide = function (sel) { var el = doc.querySelector(sel); if (el) el.remove(); };
    hide('.st-demo');
    hide('.st__how');
    var foot = doc.querySelector('.st__foot');
    if (foot) foot.innerHTML = '<a href="vhid/">Перевірка входу через Slack</a>';   // старий дизайн — лише в тестовій версії
    var lead = doc.querySelector('.st__lead');
    if (lead) lead.textContent = 'Увійдіть через Slack — додаток сам відкриє ваш кабінет.';
    var list = doc.querySelector('section[aria-label="Профілі"]');
    if (list) {
      var card = doc.createElement('section');
      card.className = 'ui-card st__card';
      card.setAttribute('aria-label', 'Вхід');
      card.style.cssText = 'display:flex;flex-direction:column;gap:10px;align-items:stretch;text-align:center';
      card.innerHTML = cfg.oidc === false
        ? '<p class="st__note"><b>Увійдіть кнопкою в Slack.</b> Відкрийте Slack → бот Аудиту → вкладка «Home» → «Увійти в Аудит» ' +
          '(або та сама кнопка в закріпленому повідомленні каналу) — прийде особисте посилання на 10 хвилин.</p>'
        : '<a class="ui-btn ui-btn--primary" href="' + String(cfg.authUrl).replace(/\/+$/, '') + '/oidc/start?app=pratsivnyk">' +
          '<span data-ic="slack"></span>Увійти через Slack</a>' +
          '<p class="st__note">Або натисніть кнопку «Увійти в Аудит» у Slack — прийде особисте посилання на 10 хвилин.</p>';
      list.parentNode.insertBefore(card, list);
      var h = doc.createElement('p');
      h.className = 'st__note';
      h.textContent = 'Уже увійшли? Відкрийте свій кабінет:';
      list.parentNode.insertBefore(h, list);
    }
    doc.title = 'Аудит якості — вхід';
  }

  P.mountIcons();
  var spots = doc.querySelectorAll('[data-ic]');
  for (var i = 0; i < spots.length; i++) {
    spots[i].innerHTML = P.ic(spots[i].getAttribute('data-ic'), spots[i].getAttribute('data-ic-cls') || '');
  }
})(window);
