(function (root) {
  'use strict';
  var P = root.P, doc = root.document, esc = P.esc, S = P.sr;
  var CFG = P.cabinet || {}, ROLE = CFG.role === 'manager' ? 'manager' : 'admin';
  var TITLE = CFG.title || (ROLE === 'admin' ? 'Кабінет адміністратора' : 'Кабінет керівника');
  var C = P.cab = {};
  var app, main, me = null, cur = null, tabs = [], gen = 0, lastPath = null, curTab = null;
  var SIDE = ROLE === 'admin' && CFG.nav === 'side' && !!P.cabNav;
  var REAL = !!(P.authSlack && P.authSlack.real());
  function shown() { return REAL ? tabs.filter(function (t) { return P.authSlack.realOk(t.real); }) : tabs; }
  function home() { var s = shown(); return REAL ? (s[0] ? s[0].path : '/') : (CFG.home || '/overview'); }
  function screenReal(def) {
    if (def.real !== undefined) return P.authSlack.realOk(def.real);
    var t = tabs.filter(function (x) { return x.id === def.tab; })[0];
    return !!(t && P.authSlack.realOk(t.real));
  }
  C.real = function () { return REAL; };

  C.tab = function (t) { tabs.push(t); tabs.sort(function (a, b) { return (a.order || 0) - (b.order || 0); }); };
  C.screen = function (pattern, def) { P.router.add(pattern, def); };
  C.me = function () { return me; };

  function today() { return P.fmt.dayKey(new Date()); }
  function addDays(k, n) { var p = k.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * 86400000).toISOString().slice(0, 10); }
  var period = (function () { var v = P.store.get('cab:period', null); return v && v.from && v.to ? v : { from: addDays(today(), -29), to: today(), preset: 30 }; })();
  C.period = function () { return { from: period.from, to: period.to, preset: period.preset || null }; };
  C.addDays = addDays;
  C.today = today;
  function setPeriod(p) { period = p; P.store.set('cab:period', p); render(); }
  function periodBar(inner) {
    return '<div class="' + (inner ? '' : 'wrap ') + 'bar"><span class="hint">Період</span>' +
      '<label class="date">' + P.ic('calendar', 'ui-icon--sm') + '<input type="date" data-period="from" value="' + period.from + '" max="' + period.to + '" style="border:0;background:transparent;font:inherit;color:inherit"></label>' +
      '<span class="hint">—</span>' +
      '<label class="date">' + P.ic('calendar', 'ui-icon--sm') + '<input type="date" data-period="to" value="' + period.to + '" max="' + today() + '" style="border:0;background:transparent;font:inherit;color:inherit"></label>' +
      '<span class="pills">' + [7, 30, 90].map(function (n) {
        return '<button class="pill' + (period.preset === n ? ' pill--on' : '') + '" type="button" data-act="cab-preset" data-n="' + n + '">' + n + ' днів</button>'; }).join('') + '</span></div>';
  }

  function strip() { return REAL ? '' : '<div class="sr-demo" role="note">' + P.ic('info', 'ui-icon--sm') + 'Тестова версія · усі імена й цифри вигадані · дані живуть лише в цьому браузері</div>'; }
  function testMark() { return REAL ? '' : ' (тест)'; }
  function notReadyCard() {
    var s = shown();
    return P.state.empty('info', 'Цей розділ ще не підключено',
      'Він запрацює, коли дані перенесуть зі старої системи.' + (s.length ? ' Зараз працюють: ' + s.map(function (t) { return '«' + t.label + '»'; }).join(', ') + '.' : ''));
  }
  function plusItems() { return P.cabPlus ? P.cabPlus.visible(CFG.plus, REAL, P.authSlack.realOk) : []; }
  function navGroups() { return P.cabNav.group(shown(), CFG.groups); }
  function frame(tab, showPeriod) {
    var now = new Date(), hhmm = (now.getHours() < 10 ? '0' : '') + now.getHours() + ':' + (now.getMinutes() < 10 ? '0' : '') + now.getMinutes();
    var pad = 'padding-top:' + (showPeriod ? 0 : 20) + 'px';
    var head = strip() +
      '<header class="wrap hdr"><div class="hdr__titles"><h1 class="hdr__title">' + esc(TITLE) + '</h1>' +
      '<p class="hdr__sub">Усі локації · ' + esc(S.h.dayLong(today())) + '</p></div>' +
      '<div class="hdr__tools">' + (P.cabPlus ? P.cabPlus.button(plusItems()) : '') + (ROLE === 'admin' && P.cabBackup ? P.cabBackup.html() : '') +
      '<button class="tool" type="button" data-act="cab-refresh" title="Оновити дані" aria-label="Оновлено о ' + hhmm + ' — оновити дані"><span class="sr-hide-phone">Оновлено о ' + hhmm + '</span>' + P.ic('refresh', 'ui-icon--sm') + '</button>' +
      '<button class="who" type="button" data-act="cab-profile" aria-label="Мій профіль"><span class="avatar">' + esc(P.initials(me.name)) + '</span><span class="sr-hide-phone">' + esc(me.name) + '</span></button></div></header>';
    if (SIDE) {   // ліве меню (≥ 900 px) або кнопка «Розділи» (вужче); решта сторінки — справа від меню. v1.6
      var on = shown().filter(function (t) { return t.id === tab; })[0];
      return head + P.cabNav.bar(on ? on.label : 'Розділи') + '<div class="wrap cab-layout">' + P.cabNav.html(navGroups(), tab) +
        '<div class="cab-body">' + (showPeriod ? periodBar(true) : '') + '<main class="content" id="cab-main"></main></div></div>';
    }
    return head +
      '<div class="sr-tabsbar"><nav class="wrap tabs" aria-label="Розділи">' + shown().map(function (t) {
        return '<a class="tab' + (t.id === tab ? ' tab--on' : '') + '" href="#' + t.path + '">' + P.ic(t.ic) + esc(t.label) + '</a>'; }).join('') + '</nav></div>' +
      (showPeriod ? periodBar() : '') + '<main class="wrap content" id="cab-main" style="' + pad + '"></main>';
  }

  function render() {
    if (!me) return;
    var r = P.router.current(), m = P.router.match(r.path);
    if (!m) {
      if (REAL && !shown().length) { app.innerHTML = '<main class="wrap content" style="padding-top:20px">' + notReadyCard() + '</main>'; return; }
      P.router.go(home()); return;
    }
    var def = m.screen, my = ++gen, handlers = {};
    var live = !REAL || screenReal(def);
    S.closeAll();
    curTab = def.tab;
    app.innerHTML = frame(def.tab, live && !!def.period);
    main = app.querySelector('#cab-main');
    if (r.path !== lastPath) { lastPath = r.path; root.scrollTo(0, 0); }
    var onTab = app.querySelector('.tab--on'), tabsEl = onTab && onTab.parentNode;
    if (tabsEl) tabsEl.scrollLeft = Math.max(0, onTab.offsetLeft - (tabsEl.clientWidth - onTab.offsetWidth) / 2);
    doc.title = (def.title || TITLE) + ' — ' + (ROLE === 'admin' ? 'адміністратор' : 'керівник') + testMark();
    cur = { el: main, me: me, params: m.params, query: r.query, period: C.period(),
      alive: function () { return my === gen; },
      on: function (act, fn) { handlers[act] = fn; },
      go: function (path, query) { P.router.go(path, query); },
      reload: function () { render(); },
      handlers: handlers };
    if (!live) { main.innerHTML = notReadyCard(); return; }
    main.innerHTML = S.h.loading();
    try { def.render(cur); } catch (e) { main.innerHTML = P.state.error('Помилка на екрані', String((e && e.message) || e)); if (root.console) console.error(e); }
  }
  C.render = render;

  function reloadData() { return P.srv('demoReload', {}).then(function () { render(); }); }
  C.reloadData = reloadData;
  var pending = null;
  root.addEventListener('storage', function (e) {
    if (e.key === 'audit-demo:demo:admin') return;   // сесію адміністратора обробляє profile-switch.js
    if (!me || !e.key || e.key.indexOf('audit-demo:demo:') !== 0 || e.key.indexOf('audit-demo:demo:me') === 0 || e.key.indexOf('audit-demo:demo:loggedAt') === 0) return;
    clearTimeout(pending);
    pending = setTimeout(function () {
      if (S.openCount()) { P.toast('info', 'Зʼявились нові дані', 'Натисніть «Оновлено о …» вгорі, щоб їх побачити.'); return; }
      reloadData().then(function () { P.toast('info', 'Нові дані', 'Кабінет оновився сам — наприклад, хтось записав аудит.'); });
    }, 600);
  });

  function menuItem(act, ic, title, sub) {
    return '<button class="menu__item" type="button" data-act="' + act + '" style="border:0;background:transparent;width:100%;text-align:left;font:inherit;cursor:pointer">' +
      '<span class="menu__ic">' + P.ic(ic) + '</span><span><span class="menu__t">' + esc(title) + '</span>' + (sub ? '<span class="menu__s">' + esc(sub) + '</span>' : '') + '</span></button>';
  }
  function openProfile(anchor) {
    var dark = doc.documentElement.getAttribute('data-theme') === 'dark';
    S.menu(anchor, { width: 360, onMount: function (el) { P.profileSwitch.bind(el); }, body:
      '<div style="display:flex;gap:12px;align-items:center;padding:8px 12px"><span class="avatar" style="width:48px;height:48px">' + esc(P.initials(me.name)) + '</span>' +
      '<div style="min-width:0"><b>' + esc(me.name) + '</b><p class="hint">Slack: підключено' + (me.slackId ? ' · ' + esc(P.authSlack.maskId(me.slackId)) : '') + '</p></div></div>' +
      '<div style="padding:4px 12px 8px"><span class="badge badge--brand">' + esc(me.roleLabel) + ' · усі локації</span></div>' +
      (me.admin ? '<div class="menu__sep"></div><div style="padding:8px 12px">' + P.profileSwitch.html(me) + '</div>' : '') +
      '<div class="menu__sep"></div><div style="padding:8px 12px"><div class="seg" role="group" aria-label="Тема">' +
      '<button class="seg__btn' + (dark ? '' : ' seg__btn--on') + '" type="button" data-act="th" data-v="light">' + P.ic('theme-light', 'ui-icon--sm') + 'Світла</button>' +
      '<button class="seg__btn' + (dark ? ' seg__btn--on' : '') + '" type="button" data-act="th" data-v="dark">' + P.ic('theme-dark', 'ui-icon--sm') + 'Темна</button></div></div>' +
      '<div class="menu__sep"></div>' +
      (REAL ? '' : menuItem('pf-reset', 'refresh', 'Скинути тестові дані', 'Усе, що ви змінили в тестовій версії, зникне')) +
      menuItem('pf-out', 'logout', 'Вийти', ''),
      on: {
        th: function (t, e, layer) {   // v1.6: тема запамʼятовується в профілі людини (P.prefs), а не лише в браузері
          var v = t.getAttribute('data-v');
          if (P.prefs) P.prefs.setTheme('cab', v); else { doc.documentElement.setAttribute('data-theme', v); P.store.set('theme:sr', v); }
          layer.close(); },
        'pf-reset': function (t, e, layer) { layer.close(); P.confirm({ title: 'Скинути тестові дані?', text: 'Записані аудити, коригуючі дії й зміни в налаштуваннях у цьому браузері зникнуть.', okLabel: 'Скинути', danger: true })
          .then(function (ok) { if (!ok) return; P.srv('demoReset', {}).then(function () { P.toast('ok', 'Тестові дані скинуто'); boot(); }); }); },
        'pf-out': function (t, e, layer) { layer.close(); P.srv('authLogout', {}).then(function () { me = null; boot(); }); }
      } });
  }

  function loginScreen(note) {
    doc.title = TITLE + ' — вхід' + testMark();
    app.innerHTML = strip() + '<main class="wrap" style="max-width:520px;padding-top:72px;display:flex;flex-direction:column;gap:14px;text-align:center;align-items:center">' +
      '<div class="hero__logo">' + P.ic('audit') + '</div><h1 class="hero__title">Аудит якості</h1><p class="hero__lead">' + esc(TITLE) + '</p>' +
      (note ? '<div class="banner banner--warn" style="text-align:left">' + P.ic('warning') + '<div class="banner__body"><p class="banner__text">' + esc(note) + '</p></div></div>' : '') +
      P.authSlack.loginHtml('cab') + '</main>';
    P.authSlack.bindLogin(app, { app: ROLE === 'admin' ? 'admin' : 'kerivnyk',
      users: function (all) { return all.filter(function (x) { return x.role === ROLE || x.role === 'admin'; }); },
      onDone: function () { boot(); }, onNotListed: loginScreen });
  }
  function boot() {
    S.closeAll();
    P.authSlack.ready.then(function () { return P.srv('authMe', {}); }).then(function (r) {
      var m = r && r.ok ? r.me : null;
      if (m && m.role === ROLE) {
        me = m; render();
        if (P.cabBackup && ROLE === 'admin') P.cabBackup.start();   // v1.6: позначка копій — одразу й далі кожні 5 хв
        if (P.prefs) P.prefs.load(me.id).then(function () { P.prefs.applyTheme('cab'); });   // v1.6: тема з профілю людини
        return;
      }
      me = null; if (P.cabBackup) P.cabBackup.stop();
      loginScreen(m ? 'Ви увійшли як «' + m.roleLabel + '». Цей кабінет — для ' + (ROLE === 'admin' ? 'адміністратора' : 'керівника') + '.' : (r && !r.ok && r.code !== 'auth' ? 'Не вдалося перевірити вхід — перевірте звʼязок і спробуйте ще раз.' : P.authSlack.takeError()));
    });
  }
  C.boot = boot;

  function start() {
    app = doc.getElementById('app');
    if (P.mountIcons) P.mountIcons();
    app.addEventListener('click', function (e) {
      var t = e.target.closest('[data-act]');
      if (!t || !app.contains(t)) return;
      var act = t.getAttribute('data-act');
      if (act === 'cab-profile') { e.preventDefault(); openProfile(t); return; }
      if (act === 'cab-refresh') { e.preventDefault(); if (P.cabBackup && ROLE === 'admin') P.cabBackup.refresh(); reloadData().then(function () { P.toast('ok', 'Дані оновлено'); }); return; }
      if (act === 'cab-plus' && P.cabPlus) { e.preventDefault(); P.cabPlus.open(t, plusItems()); return; }   // v1.6
      if (act === 'cab-backup' && P.cabBackup) { e.preventDefault(); P.cabBackup.open(t); return; }   // v1.6
      if (act === 'cab-sections' && SIDE) { e.preventDefault(); P.cabNav.open(navGroups(), curTab); return; }   // v1.6
      if (act === 'cab-preset') { var n = +t.getAttribute('data-n'); setPeriod({ from: addDays(today(), -(n - 1)), to: today(), preset: n }); return; }
      if (act === 'retry') { render(); return; }
      if (cur && cur.handlers[act]) { e.preventDefault(); cur.handlers[act](t, e); }
    });
    app.addEventListener('change', function (e) {
      var t = e.target;
      if (t.getAttribute && t.getAttribute('data-period')) {
        var p = { from: period.from, to: period.to, preset: null }; p[t.getAttribute('data-period')] = t.value;
        if (p.from && p.to && p.from <= p.to) setPeriod(p);
        return;
      }
      var a = t.getAttribute && t.getAttribute('data-change');
      if (a && cur && cur.handlers[a]) cur.handlers[a](t, e);
    });
    app.addEventListener('input', function (e) {
      var a = e.target.getAttribute && e.target.getAttribute('data-input');
      if (a && cur && cur.handlers[a]) cur.handlers[a](e.target, e);
    });
    root.addEventListener('hashchange', render);
    P.on('route', render);
    P.on('auth:required', function () { me = null; if (P.cabBackup) P.cabBackup.stop(); boot(); });
    P.on('auth:forbidden', function (r) { P.toast('warn', 'Немає прав на цю дію', r && r.error); });
    boot();
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();
})(typeof window !== 'undefined' ? window : globalThis);
