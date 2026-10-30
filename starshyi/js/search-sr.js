(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  if (!P.search) return;
  var enc = encodeURIComponent;

  function ui(id, t, s, tags, extra) { return Object.assign({ id: id, t: t, s: s, tags: tags }, extra); }

  var UI = [
    ui('tab-analytics', 'Аналітика', 'Вкладка', ['вкладка', 'розділ', 'графік', 'брак'], { path: '/analytics' }),
    ui('tab-workers', 'Люди · Працівники', 'Вкладка «Люди»', ['вкладка', 'розділ', 'працівник', 'люди'], { path: '/people' }),
    ui('tab-auditors', 'Люди · Аудитори', 'Вкладка «Люди»', ['вкладка', 'розділ', 'аудитор', 'люди'], { path: '/people/auditors' }),
    ui('tab-kd', 'Коригуючі дії', 'Вкладка', ['вкладка', 'розділ', 'кд', 'коригуюча дія', 'графік'], { path: '/kd' }),
    ui('tab-history', 'Історія аудитів', 'Вкладка', ['вкладка', 'розділ', 'аудит', 'графік'], { path: '/history' }),
    ui('mg-team', 'Керування · Аудитори', 'Розділ «Керування»', ['керування', 'розділ', 'аудитор', 'доступ'], { path: '/manage/team' }),
    ui('mg-workers', 'Керування · Виробничі працівники', 'Розділ «Керування»', ['керування', 'розділ', 'працівник'], { path: '/manage/workers' }),
    ui('mg-products', 'Керування · Відділи й вироби', 'Розділ «Керування»', ['керування', 'розділ', 'відділ', 'виріб'], { path: '/manage/products' }),
    ui('mg-defects', 'Керування · Види браку', 'Розділ «Керування»', ['керування', 'розділ', 'вид браку'], { path: '/manage/defects' }),
    ui('mg-blocks', 'Керування · Блоки замовлень', 'Розділ «Керування»', ['керування', 'розділ', 'замовлення', 'блок'], { path: '/manage/blocks' }),
    ui('mg-import', 'Керування · Виробництво: план і факт', 'Розділ «Керування»', ['керування', 'розділ', 'виробництво', 'план', 'факт', 'таблиця'], { path: '/manage/import' }),
    ui('mg-mailing', 'Керування · Розсилки', 'Розділ «Керування»', ['керування', 'розділ', 'розсилка'], { path: '/manage/mailing' }),
    ui('mg-journal', 'Керування · Журнал змін', 'Розділ «Керування»', ['керування', 'розділ', 'журнал', 'зміни'], { path: '/manage/journal' }),
    ui('an-today', 'Сьогодні', 'Блок вкладки «Аналітика»', ['блок', 'аналітика'], { path: '/analytics', block: 'today' }),
    ui('an-sum', 'За період — підсумок', 'Блок вкладки «Аналітика»', ['блок', 'аналітика'], { path: '/analytics', block: 'sum' }),
    ui('an-days', 'Брак за днями', 'Блок вкладки «Аналітика»', ['блок', 'аналітика', 'графік'], { path: '/analytics', block: 'days' }),
    ui('an-levels', 'Рівні браку', 'Блок вкладки «Аналітика»', ['блок', 'аналітика', 'графік'], { path: '/analytics', block: 'levels' }),
    ui('an-depts', 'Брак по відділах', 'Блок вкладки «Аналітика» · коли обрано «Усі відділи»', ['блок', 'аналітика', 'графік', 'відділ'], { path: '/analytics', block: 'depts', when: 'коли обрано «Усі відділи»' }),
    ui('an-top', 'Що бракує найчастіше', 'Блок вкладки «Аналітика»', ['блок', 'аналітика', 'графік', 'вид браку'], { path: '/analytics', block: 'top' }),
    ui('an-dstats', 'Види браку відділу — статистика', 'Блок вкладки «Аналітика» · коли обрано один відділ', ['блок', 'аналітика', 'відділ', 'вид браку'], { path: '/analytics', block: 'dstats', when: 'коли обрано один відділ' }),
    ui('an-orders', 'Аналітика по замовленнях', 'Блок вкладки «Аналітика»', ['блок', 'аналітика', 'замовлення'], { path: '/analytics', block: 'orders' }),
    ui('an-watch', 'Стежу', 'Блок вкладки «Аналітика» · спершу в буфері', ['блок', 'аналітика', 'зірочка', 'стежу'], { path: '/analytics', block: 'watch' })
  ];

  function q(id) { return String(id).replace(/["\\]/g, '\\$&'); }

  function route(it) {
    switch (it.k) {
      case 'ui': return { path: it.path };
      case 'auditor': return { path: '/people/auditors' };
      case 'senior': return { path: '/manage/team' };
      case 'worker': return { path: '/people' };
      case 'dept': return { path: '/analytics', query: { dep: it.id } };
      case 'defect': return { path: '/analytics/defect/' + enc(it.id) };
      case 'product': return { path: '/manage/products' };
      case 'order': return { path: '/analytics' };
      case 'kd': return { path: '/kd/dept/' + enc(String(it.id).split('|')[0]) + '/' + enc(it.id) };
      case 'audit': return { path: '/history' };
    }
    return null;
  }

  function after(it) {
    var S = P.search;
    if (it.k === 'ui' && it.block) { S.showBlock('#an-' + it.block, { when: it.when }); return; }
    if (it.k === 'auditor') {
      S.waitFor('tr[data-act="pp-aud"][data-id="' + q(it.id) + '"]', function (row) {
        if (row.getAttribute('aria-expanded') !== 'true') row.click();
        S.reveal(row);
      });
    } else if (it.k === 'worker') {
      S.waitFor('#pp-list', function () {
        if (P.srPeople) P.srPeople.openWorker({ loc: { id: it.loc, name: S.locName(it.loc) } }, it.id);
      });
    } else if (it.k === 'order') {
      S.showBlock('#an-orders', null, function () {
        S.waitFor('#an-oq', function (inp) {
          inp.value = it.id; inp.dispatchEvent(new Event('input', { bubbles: true }));
          setTimeout(function () {
            var n = root.document.getElementById('an-ocount');
            if (!n || !/знайдено 0\b/.test(n.textContent)) return;
            inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true }));
            if (P.toast) P.toast('info', 'Замовлення поза обраним періодом', 'Змініть «Період» угорі — і знайдіть номер ' + it.id + ' у цьому блоці.');
          }, 150);
        });
      });
    } else if (it.k === 'audit') {
      S.waitFor('#sr-main', function () { if (P.srHist) P.srHist.openAudit(it.id); });
    }
  }

  P.search.setup({ app: 'starshyi', ui: UI, route: route, after: after, locationId: function () { return P.sr.curLoc ? P.sr.curLoc() : null; } });

  if (typeof module !== 'undefined' && module.exports) module.exports = { UI: UI, route: route };
})(typeof window !== 'undefined' ? window : globalThis);
