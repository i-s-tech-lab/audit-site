(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var esc = P.esc || function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  var KEY = 'audit:session';   // справжня сесія в localStorage (не P.store: той додає префікс тестових даних)
  var MSG = {
    not_listed: 'Вас ще немає в списку доступу. Адміністратор уже бачить ваш запит — коли він вас додасть, натисніть «Увійти в Аудит» у Slack ще раз.',
    denied: 'Вхід скасовано. Коли будете готові — натисніть «Увійти через Slack» ще раз.',
    disabled: 'Доступ для вас вимкнено. Зверніться до старшого аудитора або адміністратора.',
    expired: 'Посилання для входу вже не діє (воно живе 10 хвилин і спрацьовує один раз) — натисніть «Увійти в Аудит» у Slack ще раз.',
    team: 'Цей Slack-простір не підключено до Аудиту. Відкрийте Slack своєї компанії й натисніть «Увійти в Аудит» там.',
    rate: 'Забагато спроб. Спробуйте за кілька хвилин.',
    server: 'Не вдалося увійти — щось пішло не так на сервері. Спробуйте ще раз за хвилину.'
  };
  var HINT = 'Або натисніть «Увійти в Аудит» у Slack — у додатку «Аудит якості», вкладка «Головна».';
  var TEST_NOTE = 'Тестова версія: вхід без пароля, ніби Slack підтвердив вигаданого користувача.';
  var BUTTON_MESSAGE = 'Натисніть кнопку, щоб увійти в Аудит. Вона одна для всіх: Slack сам підтвердить, хто ви, а Аудит надішле вам особисте посилання на 10 хвилин.';
  var BUTTON_LABEL = 'Увійти в Аудит';
  var APPS = { pratsivnyk: 1, starshyi: 1, kerivnyk: 1, admin: 1, vhid: 1 };   // vhid — сторінка «Перевірка входу» (v1.4)
  var ROLE_LABELS = { auditor: 'Аудитор', senior_auditor: 'Старший аудитор', location_lead: 'Старший локації', manager: 'Керівник', admin: 'Адмін' };
  var ROLE_ORDER = ['admin', 'manager', 'location_lead', 'senior_auditor', 'auditor'];
  var ASSIGNABLE = ['auditor', 'senior_auditor', 'manager', 'admin'];

  function expiryMs(x) {
    if (typeof x === 'number') return x < 1e12 ? x * 1000 : x;
    var t = Date.parse(x);
    return isNaN(t) ? 0 : t;
  }

  function createAuthSlack(env) {
    var cfg = env.config;
    var A = { config: cfg, MSG: MSG, HINT: HINT, TEST_NOTE: TEST_NOTE, BUTTON_MESSAGE: BUTTON_MESSAGE, BUTTON_LABEL: BUTTON_LABEL };
    var errorMsg = '';   // готовий текст помилки входу (з адреси чи з відповіді /exchange), поки його не показали
    var now = env.now || function () { return Date.now(); };

    A.real = function () { return cfg.backend === 'supabase' && !!cfg.authUrl; };
    function base() { return String(cfg.authUrl || '').replace(/\/+$/, ''); }

    A.maskId = function (id) { id = String(id == null ? '' : id); return id.length > 4 ? id.charAt(0) + '…' + id.slice(-3) : id; };
    A.errorText = function (code) { return Object.prototype.hasOwnProperty.call(MSG, code) ? MSG[code] : MSG.server; };

    A.session = function () {
      var s = env.storage.get(KEY);
      if (!s || typeof s.session !== 'string' || !s.session) return null;
      var t = expiryMs(s.expiresAt);
      if (t && t <= now()) { env.storage.del(KEY); return null; }
      return s;
    };
    A.headers = function () {
      var s = A.session(), h = { 'Content-Type': 'application/json' };
      if (s) h.Authorization = 'Bearer ' + s.session;
      return h;
    };
    A.call = function (path, body) {
      return env.fetch(base() + path, { method: 'POST', headers: A.headers(), body: JSON.stringify(body || {}) }).then(function (res) {
        return Promise.resolve(res.json()).then(function (j) { return j; }, function () { return null; }).then(function (j) {
          j = j && typeof j === 'object' ? j : {};
          if (res.status === 401 && j.ok !== true && !j.code) return { ok: false, code: 'auth', error: j.error || 'Потрібен вхід.' };
          if (res.status === 403 && j.ok !== true && !j.code) return { ok: false, code: 'forbidden', error: j.error || 'Немає прав на цю дію.' };
          if (res.status >= 500 && j.ok !== true) return { ok: false, code: 'server', error: j.error || MSG.server };
          return j;
        });
      }, function () { return { ok: false, code: 'offline', error: 'Немає звʼязку із сервером. Перевірте інтернет і спробуйте ще раз.' }; });
    };

    A.init = function () {
      if (!A.real()) return Promise.resolve();
      var h = String((env.location && env.location.hash) || ''), m = /^#login=([^&]+)/.exec(h), e = /^#login_error=([^&]+)/.exec(h);
      if (!m && !e) return Promise.resolve();
      try { env.history.replaceState(null, '', env.location.pathname + (env.location.search || '')); } catch (x) { /* без історії — токен усе одно використаємо */ }
      if (e) {
        var code; try { code = decodeURIComponent(e[1]); } catch (x) { code = ''; }   // зіпсована адреса — звичайна помилка сервера
        errorMsg = A.errorText(code); return Promise.resolve();
      }
      var token; try { token = decodeURIComponent(m[1]); } catch (x) { token = m[1]; }
      return A.call('/exchange', { token: token }).then(function (r) {
        if (r && r.ok && r.session) { env.storage.set(KEY, { session: r.session, expiresAt: r.expiresAt || null, me: r.me || null }); return; }
        if (r && Object.prototype.hasOwnProperty.call(MSG, r.code)) errorMsg = MSG[r.code];
        else if (r && r.code === 'offline') errorMsg = MSG.server;
        else errorMsg = r && typeof r.error === 'string' && r.error ? r.error : MSG.expired;
      });
    };
    A.takeError = function () { var t = errorMsg; errorMsg = ''; return t; };

    A.me = function () {
      if (!A.session()) return Promise.resolve({ ok: true, me: null });
      return A.call('/me', {}).then(function (r) {
        if (r && r.ok && r.me) return { ok: true, me: r.me };
        if (r && (r.code === 'auth' || r.code === 'expired' || (r.ok === false && !r.code))) { env.storage.del(KEY); return { ok: true, me: null }; }
        return { ok: false, code: 'server', error: (r && r.error) || MSG.server };
      });
    };
    A.logout = function () {
      var done = function () { env.storage.del(KEY); return { ok: true }; };
      if (!A.session()) return Promise.resolve(done());
      return A.call('/logout', {}).then(done, done);
    };
    A.startUrl = function (app) { return base() + '/oidc/start?app=' + encodeURIComponent(Object.prototype.hasOwnProperty.call(APPS, app) ? app : 'pratsivnyk'); };
    A.admin = function (action, payload) { return A.call('/admin', Object.assign({ action: action }, payload || {})); };

    A.requests = function () {
      if (!A.real()) return P.srv('admAccessRequests', {});
      return A.admin('requests.list');
    };
    A.resolveRequest = function (id, decision, userId) {
      if (!A.real()) return P.srv('admAccessResolve', { id: id, decision: decision, userId: userId });
      return A.admin('requests.resolve', { id: id, decision: decision });
    };
    A.sendButton = function (o) {
      if (!A.real()) return P.srv('admLoginButtonSend', { kind: o.kind, channelId: o.channelId, userId: o.person && o.person.id });
      return o.kind === 'channel' ? A.admin('postButton', { channelId: o.channelId }) : A.admin('sendButton', { slackId: o.person && o.person.slackId });
    };
    A.lookup = function (slackId) {
      if (!A.real()) return P.srv('slackLookup', { slackId: slackId });
      return A.admin('lookup', { slackId: slackId }).then(function (r) { return r && r.ok ? { ok: true, found: !!(r.name || r.found), name: r.name || null } : r; });
    };
    A.people = function () {
      if (!A.real()) {
        return P.srv('adminPeople', {}).then(function (r) {
          return r && r.ok ? { ok: true, items: r.items.filter(function (x) { return x.active; }).map(function (x) { return { id: x.id, name: x.name, slackId: x.slackId, roleLabel: x.roleLabel }; }) } : r;
        });
      }
      return A.admin('users.list').then(function (r) {
        return r && r.ok ? { ok: true, items: (r.items || r.users || []).filter(function (x) { return x.active !== false; }).map(function (x) { return { id: x.id, name: x.name, slackId: x.slackId, roleLabel: x.roleLabel || '' }; }) } : r;
      });
    };

    A.peopleAll = function () {
      if (!A.real()) return P.srv('adminPeople', {});
      return A.admin('users.list').then(function (r) {
        if (!r || !r.ok) return r || { ok: false, code: 'server', error: 'Не вдалося отримати список людей.' };
        var s = A.session(), me = (s && s.me) || {}, users = r.users || r.items || [], byRole = {}, locs = {}, locList = [];
        function addLoc(id, name) { if (id && !Object.prototype.hasOwnProperty.call(locs, id)) { locs[id] = 1; locList.push({ id: id, name: name || id, active: true }); } }
        (me.locations || []).forEach(function (l) { addLoc(l.id, l.name); });
        var items = users.map(function (u) {
          var on = u.active !== false;
          if (on) byRole[u.role] = (byRole[u.role] || 0) + 1;
          (u.locationIds || []).forEach(function (id) { addLoc(id); });
          return { id: u.id, name: u.name || '', slackId: A.maskId(u.slackId), slackFull: String(u.slackId || ''), role: u.role,
            roleLabel: u.roleLabel || ROLE_LABELS[u.role] || u.role, locationIds: u.locationIds || [],
            allLocations: u.role === 'manager' || u.role === 'admin', active: on, seniorOff: false, disabledBy: u.disabledBy || null,
            lastAuditAt: null, addedAt: u.createdAt || null, isMe: !!me.id && u.id === me.id };
        });
        var roles = ROLE_ORDER.filter(function (k) { return ASSIGNABLE.indexOf(k) >= 0 || users.some(function (u) { return u.role === k; }); })
          .map(function (k) { return { id: k, label: ROLE_LABELS[k], count: byRole[k] || 0, assignable: ASSIGNABLE.indexOf(k) >= 0 }; });
        return { ok: true, items: items, roles: roles, locations: locList };
      });
    };
    A.savePerson = function (p0) {
      var p = {}; Object.keys(p0 || {}).forEach(function (k) { if (k !== 'knownName') p[k] = p0[k]; });
      if (!A.real()) return P.srv('adminPersonSave', p).then(function (r) { if (r && r.ok && !r.name && p0.knownName) r.name = p0.knownName; return r; });
      return A.admin('users.save', p).then(function (r) {
        return r && r.ok ? { ok: true, id: r.id, name: p.name || p0.knownName || '', active: p.active === undefined ? null : p.active !== false, created: !p.id } : r;
      });
    };

    A.install = function (backend) {
      if (!A.real() || !backend || typeof backend.call !== 'function' || backend.slackWrapped) return backend;
      var orig = backend.call.bind(backend);
      return { slackWrapped: true, reset: backend.reset, failNext: backend.failNext, call: function (fn, payload) {
        if (fn === 'authMe') return A.me();
        if (fn === 'authLogout') return A.logout();
        if (fn === 'demoUsers') return Promise.resolve({ ok: true, users: [] });
        return orig(fn, payload);
      } };
    };

    return A;
  }

  function browserStorage() {
    return {
      get: function (k) { try { var v = root.localStorage.getItem(k); return v == null ? null : JSON.parse(v); } catch (e) { return null; } },
      set: function (k, v) { try { root.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
      del: function (k) { try { root.localStorage.removeItem(k); } catch (e) { /* немає памʼяті — нічого */ } }
    };
  }

  P.createAuthSlack = createAuthSlack;
  P.config = Object.assign({ backend: 'demo', authUrl: '' }, P.config || {});
  var A = P.authSlack = createAuthSlack({ config: P.config, fetch: root.fetch ? root.fetch.bind(root) : null, storage: browserStorage(),
    location: root.location, history: root.history });

  A.loginHtml = function (style) {
    var ui = style === 'ui';
    return '<button class="' + (ui ? 'ui-btn ui-btn--primary login__btn' : 'btn btn--primary btn--block') + '" type="button" data-slack-login>' +
        P.ic('slack') + 'Увійти через Slack</button>' +
      '<p class="' + (ui ? 'login__note' : 'hint') + '">' + esc(HINT) + '</p>' +
      (A.real() ? '' : '<p class="' + (ui ? 'login__note login__note--test' : 'hint') + '">' + esc(TEST_NOTE) + '</p>');
  };

  A.bindLogin = function (el, o) {
    var btn = el.querySelector('[data-slack-login]');
    if (!btn) return;
    btn.onclick = function () {
      if (A.real()) { root.location.href = A.startUrl(o.app); return; }
      btn.disabled = true;
      P.srv('demoUsers', {}).then(function (r) {
        btn.disabled = false;
        var list = r && r.ok ? o.users(r.users || []) : [];
        if (!list.length) { P.toast('danger', 'Не вдалося увійти', (r && r.error) || 'Немає тестових користувачів.'); return; }
        A.demoSheet({ users: list, onDone: o.onDone, onNotListed: o.onNotListed });
      });
    };
  };

  A.demoSheet = function (o) {
    var UNKNOWN = '__unknown__', layer = null;
    function sub(u) { return u.locations && u.locations.length ? u.roleLabel + ' · ' + u.locations.map(function (l) { return l.name; }).join(', ') : u.roleLabel; }
    function closeIt() { if (layer && layer.close) layer.close(); else P.sheet.close(); }
    var body = '<div style="display:flex;flex-direction:column;gap:var(--sp-3)">' +
        '<div class="ui-card" style="display:flex;flex-direction:row;gap:12px;align-items:center;padding:12px 16px">' + P.ic('slack') +
          '<div style="min-width:0"><p class="ui-text-sm" style="color:var(--text-2)">Slack підтвердив, що це ви:</p>' +
          '<p style="margin:2px 0 0;font-weight:700" data-slack-who></p><p class="ui-text-sm" style="color:var(--text-2)" data-slack-sub></p></div></div>' +
        '<label class="ui-field"><span class="ui-label">Тест: хто натиснув кнопку</span><span class="ui-select"><select data-slack-pick>' +
          o.users.map(function (u) { return '<option value="' + esc(u.id) + '">' + esc(u.name + ' · ' + sub(u)) + '</option>'; }).join('') +
          '<option value="' + UNKNOWN + '">Немає в списку (перевірка)</option></select></span></label>' +
        '<p class="ui-text-sm" style="color:var(--text-3)">У справжньому додатку цього вибору немає: Slack сам каже, хто ви, і ви потрапляєте на сайт без пароля.</p></div>';
    var btn = '<button class="ui-btn ui-btn--primary" type="button" data-slack-open>' + P.ic('login') + 'Відкрити Аудит</button>';
    function mount(el) {
      var sel = el.querySelector('[data-slack-pick]'), who = el.querySelector('[data-slack-who]'), sb = el.querySelector('[data-slack-sub]'), go = el.querySelector('[data-slack-open]');
      function show() {
        if (sel.value === UNKNOWN) { who.textContent = 'Гість зі Slack'; sb.textContent = 'Slack його знає, а в Аудиті такої людини ще немає.'; return; }
        var u = o.users.filter(function (x) { return x.id === sel.value; })[0];
        who.textContent = u.name; sb.textContent = sub(u);
      }
      sel.onchange = show; show();
      go.onclick = function () {
        go.disabled = true;
        if (sel.value === UNKNOWN) {
          P.srv('authDemoUnknown', {}).then(function (r) {
            closeIt();
            if (o.onNotListed) o.onNotListed((r && r.error) || MSG.not_listed);
          });
          return;
        }
        P.srv('authDemoLogin', { userId: sel.value }).then(function (res) {
          if (!res.ok) { go.disabled = false; P.toast('danger', 'Не вдалося увійти', res.error); return; }
          closeIt();
          o.onDone(res);
        });
      };
    }
    if (P.sr && P.sr.modal) {
      layer = P.sr.modal({ size: 'sm', title: 'Slack · вхід в Аудит', body: body, foot: '<span style="flex:1"></span>' + btn, onMount: mount });
    } else {
      layer = P.sheet.open({ title: 'Slack · вхід в Аудит', body: body, foot: btn, onMount: mount });
    }
  };

  A.ready = (function () { try { return Promise.resolve(A.init()).catch(function () {}); } catch (x) { return Promise.resolve(); } })();
  if (A.real() && P.backend) P.backend = A.install(P.backend);

  if (typeof module !== 'undefined' && module.exports) module.exports = createAuthSlack;
})(typeof window !== 'undefined' ? window : globalThis);
