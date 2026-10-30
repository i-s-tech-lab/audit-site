(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var doc = root.document, nav = root.navigator || {};
  var KEY = 'install-hint:later', DAYS = 14, DAY_MS = 86400000;
  var deferred = null, redraw = null;   // подія Chrome «можна встановити» — береться ОДИН раз, показується пізніше

  function decide(env) {
    var e = env || {};
    var real = e.role === 'auditor' && !e.ownRole && !e.admin;      // справжній аудитор
    var snoozed = typeof e.dismissedAt === 'number' && e.now - e.dismissedAt < DAYS * DAY_MS;   // «Не зараз» менш ніж 14 днів тому
    if (!real || e.standalone || snoozed) return { show: false, mode: null };
    return { show: true, mode: e.hasPrompt ? 'prompt' : (e.ios ? 'ios' : 'menu') };
  }

  function isStandalone() {
    try { if (root.matchMedia && root.matchMedia('(display-mode: standalone)').matches) return true; } catch (e) { /* старий браузер */ }
    return nav.standalone === true;   // iPhone / iPad
  }
  function isIos() {
    var ua = String(nav.userAgent || '');
    return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && nav.maxTouchPoints > 1);
  }
  function snoozedAt() { var v = P.store ? P.store.get(KEY, null) : null; return typeof v === 'number' ? v : null; }
  function envOf(me) {
    return { role: me.role, ownRole: me.ownRole, admin: me.admin, standalone: isStandalone(), dismissedAt: snoozedAt(), now: Date.now(), hasPrompt: !!deferred, ios: isIos() };
  }

  if (root.addEventListener) {
    root.addEventListener('beforeinstallprompt', function (ev) {
      ev.preventDefault();
      deferred = ev;
      if (redraw) redraw();
    });
    root.addEventListener('appinstalled', function () { deferred = null; if (redraw) redraw(true); });
  }

  function body(mode) {
    if (mode === 'prompt') return { txt: 'Додайте «Аудит» на головний екран — відкриватиметься одним дотиком, як звичайна програма.', btn: 'Додати на головний екран' };
    if (mode === 'ios') return { txt: 'Щоб відкривати «Аудит» одним дотиком: натисніть «Поділитися» ⬆ → «На початковий екран».', btn: '' };
    return { txt: 'Щоб відкривати «Аудит» одним дотиком: меню браузера ⋮ → «Додати на головний екран».', btn: '' };
  }

  function mount(el, me) {
    if (!el || !doc || !me || !decide(envOf(me)).show) return;
    var host = el.querySelector('.stack') || el, card = doc.createElement('section');
    card.className = 'inst'; card.setAttribute('aria-label', 'Додати на головний екран');
    host.appendChild(card);
    function draw(gone) {
      if (gone === true || !card.isConnected) { redraw = null; if (card.parentNode) card.parentNode.removeChild(card); return; }
      var d = decide(envOf(me));
      if (!d.show) { card.hidden = true; return; }
      var b = body(d.mode);
      card.hidden = false;
      card.innerHTML = '<span class="inst__ic" aria-hidden="true">' + (P.ic ? P.ic('add') : '') + '</span>' +
        '<div class="inst__body"><p class="inst__title">Аудит — на головний екран</p><p class="inst__txt">' + P.esc(b.txt) + '</p>' +
        '<div class="inst__acts">' + (b.btn ? '<button class="ui-btn ui-btn--primary ui-btn--sm" type="button" data-inst="add">' + P.esc(b.btn) + '</button>' : '') +
        '<button class="ui-btn ui-btn--quiet ui-btn--sm" type="button" data-inst="later">Не зараз</button></div></div>';
    }
    redraw = draw;
    card.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-inst]') : null;
      if (!t) return;
      if (t.getAttribute('data-inst') === 'later') {   // «Не зараз» — на 14 днів
        if (P.store) P.store.set(KEY, Date.now());
        card.hidden = true;
        return;
      }
      var ev = deferred;
      if (!ev || typeof ev.prompt !== 'function') return;
      deferred = null;   // подією можна скористатись лише раз
      try {
        ev.prompt();
        Promise.resolve(ev.userChoice).then(function (c) { draw(c && c.outcome === 'accepted' ? true : undefined); }, function () { draw(); });
      } catch (err) { draw(); }
    });
    draw();
  }

  P.installHint = { decide: decide, mount: mount, DAYS: DAYS };
  if (typeof module !== 'undefined' && module.exports) module.exports = P.installHint;
})(typeof window !== 'undefined' ? window : globalThis);
