(function (root) {
  'use strict';
  var P = root.P;
  if (!P || !P.cab) return;
  var esc = P.esc, H = P.sr.h, A = P.adm;

  var BACKUP_MAX_H = 30, DISK_MIN_PCT = 10, CERT_MIN_DAYS = 14;   // межі позначок «є на що глянути» (з постановки)
  function working(state) { return String(state || '').toUpperCase() === 'RUNNING'; }

  function uptime(sec) {
    if (sec == null) return '—';
    var d = Math.floor(sec / 86400), h = Math.floor(sec % 86400 / 3600), m = Math.floor(sec % 3600 / 60);
    if (d) return d + ' ' + A.plural(d, ['день', 'дні', 'днів']) + (h ? ' ' + h + ' год' : '');
    if (h) return h + ' год' + (m ? ' ' + m + ' хв' : '');
    return m + ' хв';
  }
  function bytes(n) {
    if (n == null) return '—';
    var u = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'], i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return String(i && n < 100 ? Math.round(n * 10) / 10 : Math.round(n)).replace('.', ',') + ' ' + u[i];
  }
  function hoursSince(iso, asOf) { return (Date.parse(asOf) - Date.parse(iso)) / 3600000; }

  function line(label, value) { return '<p class="adm-ov-t__line"><span class="adm-dim">' + esc(label) + '</span> ' + value + '</p>'; }
  function tile(o) {
    var f = o.flag;
    return '<article class="dtile adm-ov-t' + (f ? ' adm-ov-t--' + f.kind : '') + '">' +
      '<div class="adm-ov-t__top"><a class="dtile__name adm-ov-t__link" href="#' + esc(o.path) + '">' + P.ic(o.ic, 'ui-icon--sm') + esc(o.name) + '</a>' +
        A.help(o.key) + '<span class="adm-ov-t__go" aria-hidden="true">' + P.ic('chevron-right', 'ui-icon--sm') + '</span></div>' +
      '<p class="adm-ov-t__val' + (o.dim ? ' adm-ov-t__val--dim' : '') + '"><b>' + esc(o.val) + '</b>' + (o.unit ? '<span>' + esc(o.unit) + '</span>' : '') + A.help(o.valHelp) + '</p>' +
      (f && f.text ? '<span class="badge badge--' + f.kind + ' adm-ov-t__flag">' + P.ic(f.kind === 'danger' ? 'error' : 'warning', 'ui-icon--sm') + esc(f.text) + '</span>' : '') +
      (o.lines ? '<div class="adm-ov-t__lines">' + o.lines + '</div>' : '') + '</article>';
  }
  function notReady(path, ic, name, key) {
    return tile({ path: path, ic: ic, name: name, key: key, val: 'дані ще не готові', dim: true, valHelp: 'admin.overview.notReady' });
  }

  function serverTile(s) {
    if (!s) return notReady('/server', 'power', 'Сервер', 'admin.overview.server');
    var on = s.services.filter(function (x) { return working(x.state); }).length;
    return tile({ path: '/server', ic: 'power', name: 'Сервер', key: 'admin.overview.server', val: s.ok ? 'працює' : 'не відповідає',
      flag: s.ok ? null : { kind: 'danger' },   // «не відповідає» вже написано головним словом — лише колір
      lines: line('без перезапуску:', esc(uptime(s.uptimeSec))) +
        (s.services.length ? line('служби:', '<b>' + on + ' з ' + s.services.length + '</b> працюють') : '') +
        line('помилок за добу:', '<b>' + H.num(s.errors24h) + '</b>') });
  }
  function backupsTile(b, asOf) {
    if (!b) return notReady('/backups', 'backup', 'Копії бази', 'admin.overview.backups');
    var l = b.last, flag = null;
    if (l && !l.ok) flag = { kind: 'danger', text: 'остання копія не вдалась' };
    else if (l && hoursSince(l.at, asOf) > BACKUP_MAX_H) flag = { kind: 'warn', text: 'копія старша за ' + BACKUP_MAX_H + ' год' };
    return tile({ path: '/backups', ic: 'backup', name: 'Копії бази', key: 'admin.overview.backups', flag: flag,
      val: l ? A.ago(l.at) : 'копій ще немає', dim: !l, unit: l ? (l.ok ? 'остання копія · вдалась' : 'остання копія · не вдалась') : '',
      lines: line('перевірено відновленням:', b.lastVerifiedAt ? '<b>' + esc(A.ago(b.lastVerifiedAt)) + '</b>' : 'ще не перевіряли') +
        line('копій:', '<b>' + H.num(b.count) + '</b> · ' + esc(bytes(b.totalBytes))) });
  }
  function diskTile(d) {
    if (!d) return notReady('/server', 'save', 'Місце на диску', 'admin.overview.disk');
    return tile({ path: '/server', ic: 'save', name: 'Місце на диску', key: 'admin.overview.disk', val: H.pct(d.freePct), unit: 'вільно',
      flag: d.freePct < DISK_MIN_PCT ? { kind: 'danger', text: 'вільно менше ' + DISK_MIN_PCT + '%' } : null });
  }
  function certTile(c) {
    if (!c) return notReady('/server', 'lock', 'Сертифікат', 'admin.overview.cert');
    var n = c.daysLeft;
    return tile({ path: '/server', ic: 'lock', name: 'Сертифікат', key: 'admin.overview.cert',
      val: n > 0 ? H.num(n) + ' ' + A.plural(n, ['день', 'дні', 'днів']) : 'закінчився', unit: n > 0 ? 'до кінця дії' : '',
      flag: n <= 0 ? { kind: 'danger', text: 'термін дії минув' } : n < CERT_MIN_DAYS ? { kind: 'warn', text: 'менше ' + CERT_MIN_DAYS + ' днів' } : null });
  }
  function onlineTile(o) {
    if (!o) return notReady('/activity', 'people', 'Онлайн зараз', 'admin.overview.online');
    var more = o.count - o.people.length;
    return tile({ path: '/activity', ic: 'people', name: 'Онлайн зараз', key: 'admin.overview.online', val: H.num(o.count),
      unit: A.plural(o.count, ['людина', 'людини', 'людей']),
      lines: o.people.length ? '<ul class="adm-ov-t__list adm-ov-t__list--people">' + o.people.map(function (x) {
        return '<li><b>' + esc(x.name) + '</b> <span class="adm-dim">' + esc([x.roleLabel, x.appLabel].filter(Boolean).join(' · ')) + '</span></li>';
      }).join('') + '</ul>' + (more > 0 ? '<p class="adm-ov-t__line adm-dim">і ще ' + more + '</p>' : '') : '<p class="adm-ov-t__line adm-dim">зараз нікого немає</p>' });
  }
  function requestsTile(r) {
    return tile({ path: '/slack-login', ic: 'slack', name: 'Хочуть увійти', key: 'admin.overview.requests', val: H.num(r.pending),
      unit: A.plural(r.pending, ['запит', 'запити', 'запитів']), flag: r.pending > 0 ? { kind: 'warn', text: 'чекають рішення' } : null,
      lines: r.pending ? '' : '<p class="adm-ov-t__line adm-dim">запитів немає</p>' });
  }
  function auditsTile(a) {
    return tile({ path: '/audits', ic: 'audit', name: 'Аудити сьогодні', key: 'admin.overview.audits', val: H.num(a.total),
      unit: A.plural(a.total, ['аудит', 'аудити', 'аудитів']),
      lines: a.byLocation.length ? '<ul class="adm-ov-t__list">' + a.byLocation.map(function (l) {
        return '<li><span>' + esc(l.name) + '</span><b>' + H.num(l.count) + '</b></li>';
      }).join('') + '</ul>' : '<p class="adm-ov-t__line adm-dim">локацій ще немає</p>' });
  }
  function todayTile(t) {
    if (!t) return notReady('/activity', 'clock', 'Події сьогодні', 'admin.overview.today');
    return tile({ path: '/activity', ic: 'clock', name: 'Події сьогодні', key: 'admin.overview.today', val: H.num(t.events),
      unit: A.plural(t.events, ['подія', 'події', 'подій']),
      lines: line('змін:', '<b>' + H.num(t.changes) + '</b>') + line('входів:', '<b>' + H.num(t.logins) + '</b>') });
  }
  function quick() {
    function a(href, ic, label) { return '<a class="btn btn--secondary btn--sm" href="' + href + '">' + P.ic(ic, 'ui-icon--sm') + esc(label) + '</a>'; }
    return '<section class="adm-ov-quick"><h3 class="adm-card-t">Швидкі дії' + A.help('admin.overview.actions') + '</h3><div class="adm-ov-quick__row">' +
      a('#/people', 'add', 'Додати людину') + a('#/slack-login/log', 'list', 'Журнал входів') + a('#/backups', 'backup', 'Резервні копії') + '</div></section>';
  }

  P.cab.tab({ id: 'overview', label: 'Огляд', ic: 'home', path: '/overview', order: 5 });
  P.cab.screen('/overview', { tab: 'overview', title: 'Огляд', render: function (ctx) {
    P.srv('admDash', {}).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
      var t = r.tiles;
      ctx.el.innerHTML = '<section class="adm-col">' +
        A.head('Огляд', A.asOf() + '. Натисніть плитку — відкриється вкладка з подробицями.', '', 'admin.overview.page') +
        '<div class="adm-ov">' + serverTile(t.server) + backupsTile(t.backups, r.asOf) + diskTile(t.disk) + certTile(t.cert) +
          onlineTile(t.online) + requestsTile(t.requests) + auditsTile(t.auditsToday) + todayTile(t.today) + '</div>' +
        quick() + '</section>';
    });
  } });
})(window);
