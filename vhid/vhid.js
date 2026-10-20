(function (root) {
  'use strict';
  var P = root.P, A = P.authSlack, esc = P.esc, box = root.document.getElementById('vh-state');

  var MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  function when(x) {
    var t = typeof x === 'number' ? (x < 1e12 ? x * 1000 : x) : Date.parse(x);
    if (!t || isNaN(t)) return '—';
    var d = new Date(t), mm = d.getMinutes();
    return d.getDate() + ' ' + MONTHS[d.getMonth()] + ', ' + d.getHours() + ':' + (mm < 10 ? '0' : '') + mm;
  }
  function status(kind, icon, title, text) {
    return '<div class="vh__status vh__status--' + kind + '">' + P.ic(icon) + '<p><b>' + esc(title) + '</b>' + (text ? esc(text) : '') + '</p></div>';
  }
  function btn(act, icon, label, primary) {
    return '<button class="ui-btn ' + (primary ? 'ui-btn--primary' : 'ui-btn--secondary') + '" type="button" data-act="' + act + '">' + P.ic(icon) + esc(label) + '</button>';
  }
  function busy(text) { box.innerHTML = '<div class="vh__busy"><span class="ui-spinner" aria-hidden="true"></span><span>' + esc(text) + '</span></div>'; }

  function drawIn(me) {
    var s = A.session() || {}, locs = (me.locations || []).map(function (l) { return l.name || l.id; });
    var all = me.role === 'manager' || me.role === 'admin';
    box.innerHTML = status('ok', 'success', 'Ви увійшли як ' + (me.name || 'людина без імені'), 'Вхід через Slack працює: посилання спрацювало, сервер вас знає.') +
      '<dl class="vh__kv"><dt>Роль</dt><dd>' + esc(me.roleLabel || me.role || '—') + '</dd>' +
        '<dt>Локації</dt><dd>' + esc(locs.length ? locs.join(', ') : all ? 'усі локації' : 'ще не призначено') + '</dd>' +
        '<dt>Slack-ID</dt><dd>' + esc(A.maskId(me.slackId)) + '</dd>' +
        '<dt>Вхід діє до</dt><dd>' + esc(when(s.expiresAt)) + (me.rules && me.rules.sessionDays ? ' · ' + esc(String(me.rules.sessionDays)) + ' дн.' : '') + '</dd></dl>' +
      '<div class="vh__btns">' + btn('again', 'refresh', 'Перевірити ще раз', false) + btn('logout', 'logout', 'Вийти', false) + '</div>' +
      '<p class="vh__hint">«Вийти» закриває вхід на цьому пристрої (і на сервері). На іншому пристрої — свій окремий вхід, він діє далі.</p>';
  }
  function drawOut(err, server) {
    var head = server === 'ok' ? status('warn', 'info', 'Ви ще не увійшли', 'Сервер входу відповідає — можна входити.')
      : server === 'offline' ? status('bad', 'error', 'Немає звʼязку із сервером входу', 'Перевірте інтернет. Якщо інтернет є — сервер входу ще не залитий у Supabase або не відповідає.')
      : status('bad', 'error', 'Сервер входу відповів з помилкою', 'Спробуйте за хвилину. Якщо повторюється — подивіться журнал функції slack-auth у Supabase.');
    box.innerHTML = head + (err ? '<p class="vh__err" role="alert">' + esc(err) + '</p>' : '') +
      '<div class="vh__btns">' + btn('login', 'slack', 'Увійти через Slack', true) + btn('again', 'refresh', 'Перевірити ще раз', false) +
        (A.session() ? btn('logout', 'logout', 'Вийти', false) : '') + '</div>' +
      '<p class="vh__hint">' + esc(A.HINT) + ' Посилання з повідомлення відкриє цю сторінку вже зі входом.</p>';
  }

  function check() {
    busy('Перевіряю…');
    var err = A.takeError();
    A.me().then(function (r) {
      if (r.ok && r.me) { drawIn(r.me); return; }
      if (!r.ok) { drawOut(err || r.error, 'error'); return; }
      return A.call('/me', {}).then(function (x) {
        var server = x && x.code === 'auth' ? 'ok' : x && x.code === 'offline' ? 'offline' : 'error';
        drawOut(err, server);
      });
    });
  }

  box.addEventListener('click', function (e) {
    var t = e.target.closest('[data-act]');
    if (!t) return;
    var a = t.getAttribute('data-act');
    if (a === 'again') check();
    else if (a === 'login') { t.disabled = true; root.location.href = A.startUrl('vhid'); }
    else if (a === 'logout') { t.disabled = true; busy('Виходжу…'); A.logout().then(check); }
  });
  P.mountIcons();   // набір іконок (P.ic посилається на нього)
  A.ready.then(check);
})(window);
