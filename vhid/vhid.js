(function (root) {
  'use strict';
  var P = root.P, A = P.authSlack, R = P.vhidRoute, esc = P.esc, box = root.document.getElementById('vh-state');
  var query = R.parse(root.location.search);   // { audit, badAudit, check }
  var checkMode = query.check;                 // ?check=1 — стара сторінка перевірки входу

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

  function go(url) { busy('Відкриваю…'); root.location.replace(url); }
  function hereUrl() { return root.location.pathname + root.location.search; }
  function cabBtn(me) { return R.cabinet(me && me.role) ? btn('cab', 'login', 'Відкрити мій кабінет', true) : ''; }
  function drawNeedLogin(err) {
    A.remember(hereUrl());
    box.innerHTML = status('warn', 'lock', 'Щоб відкрити аудит, увійдіть', 'Напишіть боту в Slack /audit — він надішле посилання. Після входу аудит відкриється сам.') +
      (err ? '<p class="vh__err" role="alert">' + esc(err) + '</p>' : '') +
      '<div class="vh__btns">' + (A.siteButton() ? btn('login', 'slack', 'Увійти через Slack', true) : '') + btn('again', 'refresh', 'Я вже увійшов(ла)', false) + '</div>' +
      '<p class="vh__hint">' + esc(A.HINT) + ' Посилання діє 10 хвилин і спрацьовує один раз.</p>';
  }
  function drawForeign(me) {
    box.innerHTML = status('warn', 'lock', 'Цей аудит — не з вашої локації', 'Ви бачите аудити лише своїх локацій. Свій кабінет — за кнопкою нижче.') +
      '<div class="vh__btns">' + cabBtn(me) + '</div>';
  }
  function drawMissing(me) {
    box.innerHTML = status('warn', 'info', 'Аудиту не знайдено', 'Можливо, його видалили або посилання неповне.') +
      '<div class="vh__btns">' + cabBtn(me) + '</div>';
  }
  function drawFail(text) {
    box.innerHTML = status('bad', 'error', 'Не вдалося відкрити аудит', text || 'Спробуйте ще раз за хвилину.') +
      '<div class="vh__btns">' + btn('again', 'refresh', 'Спробувати ще раз', true) + '</div>';
  }
  function openAudit(me, id) {
    if (!R.cabinet(me.role)) { drawFail('Для вашої ролі кабінету не знайдено. Зверніться до адміністратора.'); return; }
    if (me.role === 'auditor' || !A.appFn('auditGet')) { go(R.auditPath(me.role, id, null)); return; }
    busy('Шукаю аудит…');
    A.app('auditGet', { id: id }).then(function (r) {
      if (r && r.ok && r.audit) { go(R.auditPath(me.role, id, r.audit.locationId)); return; }
      if (r && r.code === 'forbidden') { drawForeign(me); return; }
      if (r && r.code === 'not_found') { drawMissing(me); return; }
      if (r && r.code === 'auth') { drawNeedLogin(); return; }
      drawFail(r && r.error);
    });
  }
  function openHome(me) {
    var t = A.takeTarget(), cab = R.cabinet(me.role);
    if (t) { go(t); return; }
    if (cab) { go(cab); return; }
    drawIn(me);   // роль невідома — показуємо, хто ви
  }
  function entry() {
    busy('Перевіряю вхід…');
    A.me().then(function (r) {
      if (!r.ok) { drawFail(r.error); return; }
      if (!r.me) {
        if (query.badAudit) drawMissing(null);
        else if (query.audit) drawNeedLogin(A.takeError());   // помилка з посилання входу (прострочене…) — теж покажемо
        else check();   // просто відкрили /vhid/ без входу — як і раніше: чи живий сервер і як увійти
        return;
      }
      if (query.audit) openAudit(r.me, query.audit);
      else if (query.badAudit) drawMissing(r.me);
      else openHome(r.me);
    });
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
    if (a === 'again') (checkMode ? check : entry)();
    else if (a === 'login') {
      t.disabled = true;
      if (checkMode) A.remember(root.location.pathname + '?check=1');   // після Slack — назад на перевірку, а не в кабінет
      root.location.href = A.startUrl('vhid');
    } else if (a === 'logout') { t.disabled = true; busy('Виходжу…'); A.logout().then(checkMode ? check : entry); }
    else if (a === 'cab') A.me().then(function (r) { var cab = r.me && R.cabinet(r.me.role); if (cab) go(cab); });
  });
  P.mountIcons();   // набір іконок (P.ic посилається на нього)
  if (checkMode) {
    root.document.getElementById('vh-title').textContent = 'Перевірка входу через Slack';
    root.document.getElementById('vh-lead').textContent = 'Тут перевіряємо справжній вхід: від кнопки в Slack до сесії.';
    root.document.getElementById('vh-extra').hidden = false;
    A.ready.then(check);
  } else A.ready.then(entry);
})(window);
