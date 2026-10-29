(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var bk = P.cabBackup = {};
  var STALE_H = 30, EVERY_MS = 5 * 60 * 1000, POLL_MS = 5000, POLL_MAX_MS = 10 * 60 * 1000;

  function shiftDay(key, n) {
    var p = key.split('-');
    return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * 86400000).toISOString().slice(0, 10);
  }

  bk.whenText = function (iso, now) {
    var day = P.fmt.dayKey(iso), today = P.fmt.dayKey(now), time = P.fmt.time(iso);
    if (!day) return '—';
    if (day === today) return 'сьогодні ' + time;
    if (day === shiftDay(today, -1)) return 'вчора ' + time;
    return P.fmt.date(iso) + ' ' + time;
  };

  bk.shortText = function (iso, now) {
    var day = P.fmt.dayKey(iso), today = P.fmt.dayKey(now);
    if (!day) return '';
    if (day === today) return P.fmt.time(iso);
    return day === shiftDay(today, -1) ? 'вчора' : P.fmt.date(iso);
  };

  bk.fmtBytes = function (n) {
    if (n == null || isNaN(n)) return '—';
    var u = ['Б', 'КБ', 'МБ', 'ГБ'], i = 0, v = Math.max(0, n);
    while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
    return (i === 0 ? String(Math.round(v)) : (Math.round(v * 10) / 10).toString().replace('.', ',')) + ' ' + u[i];
  };

  bk.view = function (head, now) {
    if (!head || typeof head !== 'object' || !head.state) return null;
    var s = head.state, ok = s === 'ok' || s === 'stale';
    if (ok && !head.at) s = 'none';
    else if (ok) {
      var ageH = (now.getTime() - new Date(head.at).getTime()) / 3600000;
      s = s === 'stale' || ageH > STALE_H ? 'stale' : 'ok';
    }
    if (s === 'ok' || s === 'stale') {
      var when = bk.whenText(head.at, now);
      return { state: s, tone: s === 'ok' ? 'ok' : 'warn', text: 'Копія: ' + when, short: bk.shortText(head.at, now),
        status: s === 'ok' ? 'Усе гаразд' : 'Остання копія давно — старша за ' + STALE_H + ' год' };
    }
    if (s === 'failed') return { state: s, tone: 'bad', text: 'Копія не вдалась', short: '', status: 'Остання спроба не вдалась' + (head.error ? ': ' + head.error : '') };
    if (s === 'running') return { state: s, tone: 'run', text: 'Роблю копію…', short: '', status: 'Копія робиться просто зараз' };
    if (s === 'none') return { state: s, tone: 'off', text: 'Копій ще немає', short: '', status: 'Жодної копії ще не зроблено' };
    if (s === 'off') return { state: s, tone: 'off', text: 'Копії не налаштовано', short: '', status: 'Автоматичні копії вимкнені' };
    return null;
  };

  var head = null, timer = null, pollTimer = null, popup = null, busy = false, epoch = 0;

  bk.html = function () {
    var v = bk.view(head, new Date());
    if (!v) return '';
    return '<button class="tool cab-bk cab-bk--' + v.tone + '" type="button" data-act="cab-backup" data-cab-bk aria-haspopup="menu" title="' + P.esc(v.text) + '" aria-label="' + P.esc(v.text) + ' — відкрити подробиці">' +
      (v.tone === 'run' ? '<span class="ui-spinner ui-spinner--sm" aria-hidden="true"></span>' : '<i class="cab-bk__dot" aria-hidden="true"></i>') +
      '<span class="sr-hide-phone cab-bk__t">' + P.esc(v.text) + '</span>' +
      (v.short ? '<span class="cab-bk__short" aria-hidden="true">' + P.esc(v.short) + '</span>' : '') + '</button>';
  };

  function mount() {
    var doc = root.document, cur = doc.querySelector('[data-cab-bk]'), html = bk.html();
    if (cur) { if (html) cur.outerHTML = html; else cur.remove(); }
    else if (html) { var r = doc.querySelector('[data-act="cab-refresh"]'); if (r) r.insertAdjacentHTML('beforebegin', html); }
    if (popup && !popup.closed) drawPopup();
  }

  bk.refresh = function () {
    var my = epoch;
    return P.srv('admBackups', {}).then(function (r) {
      if (my !== epoch) return null;   // тим часом вийшли з кабінету — стару відповідь викидаємо
      if (r && r.ok && r.head && typeof r.head === 'object') head = r.head;
      else if (!r || r.code === 'not_ready' || r.code === 'forbidden' || r.code === 'auth') head = null;
      mount();
      if (head && head.state === 'running') poll();
      return head;
    }, function () { return head; });
  };

  function poll() {
    if (pollTimer) return;
    var my = epoch, since = Date.now();
    function tick() {
      pollTimer = setTimeout(function () {
        bk.refresh().then(function (h) {
          if (my !== epoch) return;
          if (h && h.state === 'running' && Date.now() - since < POLL_MAX_MS) { tick(); return; }
          pollTimer = null;
          if (!h || h.state === 'running') return;   // не вдалось спитати або вийшов час — мовчимо, позначка залишилась як була
          if (h.state === 'failed') P.toast('warn', 'Копію не зроблено', h.error || 'Подробиці — у розділі «Резервні копії».');
          else P.toast('ok', 'Копію зроблено', 'Позначка вгорі оновилась.');
        });
      }, POLL_MS);
    }
    tick();
  }

  bk.start = function () {
    bk.stop();
    bk.refresh();
    timer = setInterval(bk.refresh, EVERY_MS);
  };
  bk.stop = function () {
    if (timer) clearInterval(timer);
    if (pollTimer) clearTimeout(pollTimer);
    timer = null; pollTimer = null; head = null; epoch++;
  };

  function popupBody() {
    var now = new Date(), v = bk.view(head, now);
    if (!v) return '<p class="hint" style="padding:8px 12px">Стан копій поки невідомий.</p>';
    var last = head.at ? '<p class="hint" style="padding:0 12px">Остання копія: ' + P.esc(bk.whenText(head.at, now)) + (head.bytes != null ? ' · ' + P.esc(bk.fmtBytes(head.bytes)) : '') + '</p>' : '';
    var off = v.state === 'running' || v.state === 'off' || busy;
    return '<div style="display:flex;flex-direction:column;gap:6px;padding:8px 4px 4px">' +
      '<p style="margin:0;padding:0 12px"><b>' + P.esc(v.text) + '</b>' + (P.help ? P.help.btn('admin.bk.chip') : '') + '</p><p class="hint" style="padding:0 12px">' + P.esc(v.status) + '</p>' + last +
      '<div style="padding:6px 12px 2px"><button class="btn btn--secondary" type="button" data-act="bk-now"' + (off ? ' disabled' : '') + '>' + P.ic('backup', 'ui-icon--sm') + 'Зробити копію зараз</button></div>' +
      '<div class="menu__sep"></div>' +
      '<a class="menu__item" href="#/backups" data-ov-close><span class="menu__ic">' + P.ic('list') + '</span><span><span class="menu__t">Усі копії</span><span class="menu__s">Список, правило зберігання, перевірка</span></span></a></div>';
  }
  function drawPopup() { var b = popup.el.querySelector('[data-bk-pop]'); if (b) b.innerHTML = popupBody(); }

  function makeNow() {
    busy = true; drawPopup();
    P.srv('admBackupNow', {}).then(function (r) {
      busy = false;
      if (!r || !r.ok) { if (!r || r.code !== 'forbidden') P.toast('warn', 'Копію не зроблено', (r && r.error) || ''); drawPopup(); return; }
      bk.refresh().then(function (h) {
        if (h && h.state === 'running') P.toast('info', 'Роблю копію…', 'Це може тривати кілька хвилин. Позначка вгорі оновиться сама.');
        else P.toast('ok', 'Копію зроблено', r.message || '');
      });
    });
  }

  bk.open = function (anchor) {
    popup = P.sr.menu(anchor, { width: 360, body: '<div data-bk-pop>' + popupBody() + '</div>', on: { 'bk-now': makeNow } });
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = bk;
})(typeof window !== 'undefined' ? window : globalThis);
