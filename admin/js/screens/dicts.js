(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm, da = A.da;
  if (!P.cab) return;

  var G = {
    locations: { ic: 'location', words: ['локація', 'локації', 'локацій'] },
    people: { ic: 'people', words: ['людина з доступом', 'людини з доступом', 'людей з доступом'] },
    rights: { ic: 'access', words: ['роль', 'ролі', 'ролей'] },
    rules: { ic: 'settings', words: ['правило', 'правила', 'правил'] },
    mailing: { ic: 'slack', words: ['розсилка', 'розсилки', 'розсилок'] }
  };
  var L = {
    depts: { ic: 'department', page: '/manage/products' },
    products: { ic: 'order', page: '/manage/products' },
    defects: { ic: 'defect', page: '/manage/defects' },
    workers: { ic: 'people', page: '/manage/workers' },
    team: { ic: 'user', page: '/manage/team' }
  };

  function cell(v) {
    if (v == null) return '';
    if (typeof v === 'number') return String(v).replace('.', ',');
    var s = String(v);
    return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
  }
  function csv(rows) {
    return '﻿' + rows.map(function (r) {
      return r.map(function (v) { var s = cell(v); return /[;"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(';');
    }).join('\r\n') + '\r\n';
  }
  function download(name, text) {
    var doc = root.document, blob = new root.Blob([text], { type: 'text/csv;charset=utf-8' });
    var url = root.URL.createObjectURL(blob), a = doc.createElement('a');
    a.href = url; a.download = name; doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { root.URL.revokeObjectURL(url); }, 1000);
  }

  function last(x) {
    if (!x) return '<p class="adm-dc-last adm-dim">Змін за 30 днів не було</p>';
    return '<p class="adm-dc-last"><span>' + esc(A.ago(x.at)) + ' · ' + (x.byName ? esc(x.byName) : '<span class="adm-dim">хто — не записано</span>') + '</span>' +
      '<span class="adm-dim">' + esc(x.what) + '</span></p>';
  }
  function csvBtn(dict, loc, label) {
    return '<button class="btn btn--quiet btn--sm" type="button" data-act="dc-csv"' + da('dict', dict) + (loc ? da('loc', loc) : '') + ' aria-label="Вивантажити в CSV · ' + esc(label) + '">' +
      P.ic('export', 'ui-icon--sm') + 'CSV</button>';
  }
  function tile(g) {
    var m = G[g.id] || { ic: 'list', words: ['', '', ''] };
    return '<article class="dtile adm-dc-tile"><span class="dtile__name">' + P.ic(m.ic, 'ui-icon--sm') + esc(g.label) + A.help('admin.data.g.' + g.id) + '</span>' +
      '<p class="adm-dc-num"><b>' + H.num(g.count) + '</b> ' + esc(A.plural(g.count, m.words)) + '</p>' + last(g.lastChange) +
      '<div class="adm-dc-btns"><a class="btn btn--secondary btn--sm" href="#' + esc(g.path) + '">' + P.ic('arrow-right', 'ui-icon--sm') + 'Відкрити</a>' + csvBtn(g.id, '', g.label) + '</div></article>';
  }
  function dictRow(l, d) {
    var m = L[d.id] || { ic: 'list' };
    return '<div class="adm-dc-row"><div class="adm-dc-row__name">' + P.ic(m.ic, 'ui-icon--sm') + '<b>' + esc(d.label) + '</b>' + A.help('admin.data.l.' + d.id) + '</div>' +
      '<p class="adm-dc-row__n"><b>' + H.num(d.active) + '</b> увімкнено' + (d.archived ? ' · <span class="adm-dim">' + H.num(d.archived) + ' вимкнено</span>' : '') + '</p>' +
      '<div class="adm-dc-row__last">' + last(d.lastChange) + '</div>' +
      '<div class="adm-dc-btns"><button class="btn btn--secondary btn--sm" type="button" data-act="dc-edit"' + da('loc', l.id) + da('dict', d.id) + ' aria-label="Редагувати · ' + esc(d.label + ' · ' + l.name) + '">' +
        P.ic('edit', 'ui-icon--sm') + 'Редагувати</button>' + csvBtn(d.id, l.id, d.label + ' · ' + l.name) + '</div></div>';
  }
  function locCard(l) {
    return '<section class="card adm-dc-loc' + (l.active ? '' : ' adm-dc-loc--off') + '"><h3 class="adm-card-t">' + P.ic('location', 'ui-icon--sm') + esc(l.name) +
      (l.active ? '' : H.badge('вимкнена', '')) + '</h3>' + l.dicts.map(function (d) { return dictRow(l, d); }).join('') + '</section>';
  }

  P.cab.tab({ id: 'dicts', label: 'Довідники', ic: 'list', path: '/dicts', order: 32, real: 'admDicts' });   // real — назва функції, яку вкладка читає (двигун сервера)
  P.cab.screen('/dicts', { tab: 'dicts', title: 'Довідники', render: function (ctx) {
    var data = null;
    function locName(id) { var l = data.locations.filter(function (x) { return x.id === id; })[0]; return l ? l.name : id; }
    function load() {
      P.srv('admDicts', {}).then(function (r) {
        if (!ctx.alive()) return;
        if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
        data = r;
        ctx.el.innerHTML = '<section class="adm-col">' +
          A.head('Довідники', 'Усе, що можна додати й змінити, — в одному місці · ' + A.asOf(), '', 'admin.data.dicts') +
          '<h3 class="adm-group">Для всіх локацій' + A.help('admin.data.global') + '</h3>' +
          '<div class="adm-dc-grid">' + r.global.map(tile).join('') + '</div>' +
          '<h3 class="adm-group">По локаціях' + A.help('admin.data.loc') + '</h3>' +
          '<p class="hint adm-dc-legend"><span>Числа: увімкнено · вимкнено' + A.help('admin.data.counts') + '</span><span>Остання зміна' + A.help('admin.data.last') + '</span>' +
            '<span>«Редагувати»' + A.help('admin.data.edit') + '</span><span>«CSV»' + A.help('admin.data.csv') + '</span></p>' +
          (r.locations.length ? '<div class="adm-dc-locs">' + r.locations.map(locCard).join('') + '</div>' : H.empty('Локацій ще немає', 'Додайте першу у вкладці «Локації».')) +
          '</section>';
      });
    }
    ctx.on('dc-edit', function (t) {
      var page = (L[t.getAttribute('data-dict')] || L.team).page, loc = t.getAttribute('data-loc');
      t.disabled = true;
      P.toast('info', 'Відкриваємо «Керування» · ' + locName(loc), 'Кабінет старшого аудитора, розділ — ' + t.closest('.adm-dc-row').querySelector('b').textContent + '.');
      P.profileSwitch.open('senior_auditor', loc, page).then(function (ok) { if (!ok) t.disabled = false; });
    });
    ctx.on('dc-csv', function (t) {
      var p = { dict: t.getAttribute('data-dict') }, loc = t.getAttribute('data-loc');
      if (loc) p.locationId = loc;
      t.disabled = true;
      P.srv('admDictExport', p).then(function (r) {
        t.disabled = false;
        if (!r.ok) { if (r.code !== 'forbidden') P.toast('danger', 'Не вдалося вивантажити', r.error || ''); return; }
        download(r.filename, csv([r.columns].concat(r.rows)));
        P.toast('ok', 'Файл збережено · ' + r.filename, H.num(r.rows.length) + ' ' + A.plural(r.rows.length, ['рядок', 'рядки', 'рядків']) + ' · файл лише у вашому браузері.');
      });
    });
    load();
  } });
})(window);
