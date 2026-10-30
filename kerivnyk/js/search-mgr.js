(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  if (!P.search) return;
  var enc = encodeURIComponent;

  function ui(id, t, s, tags, extra) { return Object.assign({ id: id, t: t, s: s, tags: tags }, extra); }

  var UI = [
    ui('tab-overview', 'Огляд', 'Вкладка', ['вкладка', 'розділ', 'графік', 'брак'], { path: '/overview' }),
    ui('tab-depts', 'Відділи', 'Вкладка', ['вкладка', 'розділ', 'відділ', 'графік'], { path: '/depts' }),
    ui('tab-auditors', 'Аудитори', 'Вкладка', ['вкладка', 'розділ', 'аудитор', 'старший', 'люди'], { path: '/auditors' }),
    ui('tab-kd', 'Коригуючі дії', 'Вкладка', ['вкладка', 'розділ', 'кд', 'коригуюча дія'], { path: '/kd' }),
    ui('tab-month', 'Звіт за місяць', 'Вкладка', ['вкладка', 'розділ', 'звіт', 'місяць'], { path: '/month' }),
    ui('tab-reports', 'Мої звіти', 'Вкладка', ['вкладка', 'розділ', 'звіт', 'розсилка', 'сповіщення'], { path: '/reports' }),
    ui('tab-team', 'Люди', 'Вкладка', ['вкладка', 'розділ', 'людина', 'доступ', 'аудитор', 'старший'], { path: '/team' }),
    ui('ov-sum', 'За період — підсумок', 'Блок вкладки «Огляд»', ['блок', 'огляд'], { path: '/overview', block: 'sum' }),
    ui('ov-days', 'Брак за днями', 'Блок вкладки «Огляд»', ['блок', 'огляд', 'графік'], { path: '/overview', block: 'days' }),
    ui('ov-cmp', 'Було → стало', 'Блок вкладки «Огляд»', ['блок', 'огляд'], { path: '/overview', block: 'cmp' }),
    ui('ov-kd', 'Коригуючі дії', 'Блок вкладки «Огляд»', ['блок', 'огляд', 'кд', 'коригуюча дія'], { path: '/overview', block: 'kd' }),
    ui('ov-compare', 'Порівняння двох періодів', 'Блок вкладки «Огляд»', ['блок', 'огляд', 'порівняння'], { path: '/overview', block: 'compare' }),
    ui('ov-nocheck', 'Дні без перевірок', 'Блок вкладки «Огляд» · спершу в буфері', ['блок', 'огляд', 'перевірка'], { path: '/overview', block: 'nocheck' }),
    ui('ov-per100', 'Брак на 100 перевірених', 'Блок вкладки «Огляд» · спершу в буфері', ['блок', 'огляд', 'графік', 'відділ'], { path: '/overview', block: 'per100' })
  ];

  function q(id) { return String(id).replace(/["\\]/g, '\\$&'); }

  function route(it) {
    switch (it.k) {
      case 'ui': return { path: it.path };
      case 'loc': return { path: '/overview', query: { loc: it.id } };
      case 'dept': return { path: '/depts' };
      case 'auditor':
      case 'senior': return { path: '/auditors' };
      case 'kd': return it.loc ? { path: '/kd/loc/' + enc(it.loc) } : { path: '/kd' };
    }
    return null;
  }

  function openDept(it) {
    var S = P.search, sel = '.mgr-dtile[data-tile-id="' + q(it.id) + '"]';
    function found(tile) {
      var b = tile.querySelector('[data-act="mgr-d-open"]');
      if (b && !tile.classList.contains('mgr-dtile--on')) b.click();
      S.reveal(tile);
    }
    S.waitFor(sel, found, 1200, function () {
      var chip = it.loc ? root.document.querySelector('[data-act="mgr-d-loc"][data-v="' + q(it.loc) + '"]') : null;
      if (!chip) return;
      chip.click();
      S.waitFor(sel, found, 2500);
    });
  }

  function after(it) {
    if (it.k === 'ui' && it.block) P.search.showBlock('#ov-' + it.block);
    else if (it.k === 'dept') openDept(it);
  }

  P.search.setup({ app: 'kerivnyk', ui: UI, route: route, after: after, audits: false });

  if (typeof module !== 'undefined' && module.exports) module.exports = { UI: UI, route: route };
})(typeof window !== 'undefined' ? window : globalThis);
