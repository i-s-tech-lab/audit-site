(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm, S = P.admSys;
  var kv = S.kv;
  var STATE = { RUNNING: ['працює', 'ok'], STOPPED: ['зупинена', 'danger'], START_PENDING: ['запускається', 'warn'], STOP_PENDING: ['зупиняється', 'warn'] };
  function state(s) { var x = STATE[s] || [String(s || '—'), 'warn']; return H.badge(x[0], x[1]); }
  function yes(ok, t, f) { return ok ? H.badge(t || 'так', 'ok') : H.badge(f || 'ні', 'danger'); }
  function fullDate(iso) { return new Date(iso).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Kyiv' }); }
  function when(iso) { return iso ? esc(P.fmt.dateTime(iso)) + ' <span class="adm-dim">· ' + esc(A.ago(iso)) + '</span>' : '<span class="adm-dim">—</span>'; }
  function card(ic, title, key, inner, wide) {
    return '<section class="card' + (wide ? ' adm-sys-wide' : '') + '"><h3 class="adm-card-t">' + P.ic(ic, 'ui-icon--sm') + esc(title) + A.help(key) + '</h3>' + inner + '</section>';
  }

  function services(r) {
    return card('power', 'Служби', 'admin.system.services', '<div class="adm-sys-rows">' + r.services.map(function (s) {
      return '<div class="adm-sys-row"><div class="adm-sys-row__main"><b>' + esc(s.label) + '</b><span class="adm-dim">' + esc(s.id) + ' · ' + esc(s.account) + '</span></div>' +
        '<div class="adm-sys-row__side">' + state(s.state) + '<span class="adm-dim">з ' + esc(P.fmt.dateTime(s.since)) + '</span></div></div>';
    }).join('') + '</div>');
  }
  function health(r) {
    var h = r.health, sc = h.schema && typeof h.schema === 'object' ? h.schema.last + ' · накочено ' + h.schema.applied : String(h.schema || '—');
    return card('success', 'Стан сервера', 'admin.system.health', '<dl class="kv adm-sys-kv">' +
      kv('Відповідає', yes(h.ok, 'так', 'є проблема')) + kv('Версія сервера', esc(h.version), 'admin.system.version') +
      kv('Випуск', '<span class="adm-sys-mono">' + esc(h.release || '—') + '</span>', 'admin.system.release') + kv('Працює без перезапуску', esc(S.dur(h.uptimeSec)), 'admin.system.uptime') +
      kv('База даних', yes(h.db === 'ok', 'на звʼязку', esc(h.db))) + kv('Версія схеми бази', esc(sc), 'admin.system.schema') +
      kv('Розсилка — остання перевірка', h.mailTick ? when(h.mailTick.at) + ' ' + yes(h.mailTick.ok, 'вдало', 'з помилкою') : '<span class="adm-dim">ще не було</span>', 'admin.system.mailTick') + '</dl>');
  }
  function network(r) {
    var n = r.network, c = n.cert;
    return card('access', 'Мережа і Caddy', 'admin.system.network', '<dl class="kv adm-sys-kv">' +
      kv('Адреса сайту', esc(n.domain), 'admin.system.domain') + kv('Головний Caddy', esc(n.frontProxy || 'немає'), 'admin.system.frontProxy') +
      kv('Брандмауер', esc(n.firewall), 'admin.system.firewall') +
      kv('Порти', '<ul class="adm-sys-ports">' + n.ports.map(function (p) { return '<li><b>' + esc(p.port) + '</b> · ' + esc(p.who) + ' <span class="adm-dim">— ' + esc(p.from) + '</span></li>'; }).join('') + '</ul>', 'admin.system.ports') +
      kv('Сертифікат видав', esc(c.issuer), 'admin.system.cert') + kv('Сертифікат діє до', esc(fullDate(c.validTo)) + ' <span class="adm-dim">· ще ' + H.num(c.daysLeft) + ' ' + A.plural(c.daysLeft, ['день', 'дні', 'днів']) + '</span>') +
      kv('Кореневий сертифікат діє до', esc(fullDate(c.rootValidTo)), 'admin.system.certRoot') + '</dl>');
  }
  function resources(r) {
    var x = r.resources;
    return card('chart', 'Ресурси', 'admin.system.resources', '<dl class="kv adm-sys-kv">' +
      kv('Вільно на диску', H.num(x.diskFreePct) + '% · ' + H.num(x.diskFreeGb) + ' ГБ', 'admin.system.disk') +
      kv('Памʼять зайнято', H.num(x.memUsedPct) + '%', 'admin.system.mem') + kv('Процесор зайнято', H.num(x.cpuPct) + '%', 'admin.system.cpu') + '</dl>');
  }
  function windows(r) {
    return card('settings', 'Windows', 'admin.system.windows', '<dl class="kv adm-sys-kv">' +
      kv('Останнє ввімкнення', when(r.windows.lastBoot)) + kv('Оновлень чекає', H.num(r.windows.updatesPending), 'admin.system.updates') + '</dl>');
  }
  function releases(r) {
    return card('import', 'Випуски', 'admin.system.releases', '<div class="adm-sys-rows">' + r.releases.map(function (x) {
      return '<div class="adm-sys-row"><div class="adm-sys-row__main"><b class="adm-sys-mono">' + esc(x.name) + '</b><span class="adm-dim">' + esc(P.fmt.dateTime(x.at)) + '</span></div>' +
        '<div class="adm-sys-row__side">' + (x.current ? H.badge('зараз працює', 'ok') : H.badge('попередній', '')) + '</div></div>';
    }).join('') + '</div>');
  }
  function errors(r) {
    return card('error', 'Помилки за добу', 'admin.system.errors', '<p class="adm-sys-big">' + H.num(r.errors24h) + '</p>' +
      '<p class="hint">' + (r.errors24h ? 'Подробиці — у журналах служб на сервері (C:\\AuditServer\\logs).' : 'Помилок у журналах служб не було.') + '</p>');
  }
  function commands(r) {
    return card('key', 'Як змінити', 'admin.system.commands', '<p class="hint"><b>Зміни — лише через SSH, від адміністратора.</b> Звідси база і Caddy — лише перегляд.</p>' +
      '<div class="adm-sys-cmds">' + r.commands.map(function (c, i) { return S.cmd(c.label, c.text, i); }).join('') + '</div>', true);
  }

  P.cab.tab({ id: 'server', label: 'Сервер', ic: 'power', path: '/server', order: 65 });
  P.cab.screen('/server', { tab: 'server', title: 'Сервер', render: function (ctx) {
    var data = null;
    P.srv('admServer', {}).then(function (r) {
      if (!ctx.alive()) return;
      if (!r.ok) { ctx.el.innerHTML = H.error(r); return; }
      data = r;
      var up = r.services.filter(function (s) { return s.state === 'RUNNING'; }).length;
      ctx.el.innerHTML = '<section class="adm-col">' + A.head('Сервер', A.asOf() + ' · лише перегляд', '', 'admin.system.server') + S.demoBanner() +
        '<div class="kpis">' + A.kpi(up + ' з ' + r.services.length, 'служб працює', 'admin.system.services') +
          A.kpi(S.dur(r.health.uptimeSec), 'без перезапуску', 'admin.system.uptime') +
          A.kpi(H.num(r.resources.diskFreePct) + '%', 'вільно на диску', 'admin.system.disk') +
          A.kpi(H.num(r.errors24h), 'помилок за добу', 'admin.system.errors') + '</div>' +
        '<div class="adm-sys-grid">' + services(r) + health(r) + network(r) + resources(r) + windows(r) + releases(r) + errors(r) + commands(r) + '</div></section>';
    });
    ctx.on('sys-copy', function (t) {
      var i = +t.getAttribute('data-i'), c = data && data.commands[i];
      if (c) S.copy(c.text, A.q(ctx.el, '[data-cmd="' + i + '"]'));
    });
  } });
})(window);
