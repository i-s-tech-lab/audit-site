(function (root) {
  'use strict';
  var P = root.P = root.P || {}, esc = function (s) { return P.esc(s); };
  var REAL = { mlRules: 1, mlRuleSave: 1, mlRuleOn: 1, mlRuleCopy: 1, mlRuleDelete: 1, mlAddrList: 1, mlAddrSave: 1, mlAddrDelete: 1 };
  var NO_CODE = 'Введіть код розсилки, щоб відкрити справжні правила.';
  var dir = null, addr = [];   // останній довідник з демо-сервера і список активних адресатів зі справжнього — для підписів

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function authFail(error) { return { ok: false, code: 'mail_auth', error: error || NO_CODE, noCode: !error }; }

  function demoDir(force) {
    if (dir && !force) return Promise.resolve(dir);
    return P.srv('mlRules', {}).then(function (r) { if (r && r.ok) dir = r; return r; });
  }

  function relabel(item, d, extra) {
    if (!item || !d) return item;
    var loc = {}, dep = {}, people = {};
    (d.locations || []).forEach(function (l) {
      loc[l.id] = l.name;
      (l.departments || []).forEach(function (x) { dep[x.id] = { name: x.name, loc: l.name, locId: l.id }; });
    });
    (d.users || []).forEach(function (u) { people[u.id] = u.name; });
    (extra || []).forEach(function (a) { if (!has(people, a.id)) people[a.id] = a.name + (a.active === false ? ' (вимкнено)' : ''); });   // адресати: id = Slack-ID; користувач — головніший
    item.locLabel = item.locations === 'all' ? 'усі локації' : (item.locations || []).map(function (id) { return loc[id] || id; }).join(', ');
    var oneLoc = Array.isArray(item.locations) && item.locations.length === 1;
    item.depLabel = Array.isArray(item.departments) ? item.departments.map(function (id) {
      return !has(dep, id) ? id : oneLoc ? dep[id].name : dep[id].name + ' (' + dep[id].loc + ')';
    }).join(', ') : 'усі відділи';
    item.toLabels = (item.to || []).map(function (t) {
      return t.type === 'channel' ? { type: 'channel', label: '#' + t.name } : { type: 'user', id: t.id, label: (has(people, t.id) ? people[t.id] : 'Немає в списку') + ' · особисто' };
    });
    return item;
  }

  function finish(action, r) {
    if (!r || r.ok) {
      if (r && r.ok && (action === 'mlRuleSave' || action === 'mlRuleCopy') && r.item) {
        return demoDir().then(function (d) { if (d && d.ok) relabel(r.item, d, addr); return r; });
      }
      return r;
    }
    if (r.code === 'auth') return authFail('Код розсилки не підходить — введіть його ще раз.');
    return r;
  }

  function rules(payload) {
    return P.mailProbe.call('mlRules', payload).then(function (r) {
      if (!r.ok) return finish('mlRules', r);
      return demoDir(true).then(function (d) {
        if (!d || !d.ok) return d || { ok: false, code: 'server', error: 'Не вдалося прочитати довідник локацій.' };
        r.locations = r.locations && r.locations.length ? r.locations : d.locations;
        if (r.usersFrom) {   // справжні користувачі кабінетів: ID локацій → назви (якщо довідник їх знає)
          var ln = {}; (r.locations || []).forEach(function (l) { ln[l.id] = l.name; });
          r.users = (r.users || []).map(function (u) { return Object.assign({}, u, { locations: (u.locations || []).map(function (id) { return ln[id] || id; }) }); });
        } else r.users = r.users && r.users.length ? r.users : d.users;
        r.presets = r.presets && r.presets.length ? r.presets : d.presets;
        r.options = r.options && r.options.groups ? r.options : d.options;
        r.addressees = Array.isArray(r.addressees) ? r.addressees : [];
        addr = r.addressees;
        (r.items || []).forEach(function (it) { relabel(it, r, addr); });
        return r;
      });
    });
  }

  function addrList(payload) {
    return P.mailProbe.call('mlAddrList', payload).then(function (r) {
      if (!r.ok) return finish('mlAddrList', r);
      if (r.locations && r.locations.length) return r;
      return P.srv('mlAddrList', {}).then(function (d) {
        if (!d || !d.ok) return d || { ok: false, code: 'server', error: 'Не вдалося прочитати довідник локацій.' };
        r.locations = d.locations;
        return r;
      });
    });
  }

  function call(action, payload) {
    payload = payload || {};
    if (!has(REAL, action)) return P.srv(action, payload);   // перегляд — завжди вигадані цифри з демо-сервера
    if (!P.mailProbe || !P.mailProbe.has()) return Promise.resolve(authFail());
    if (action === 'mlRules') return rules(payload);
    if (action === 'mlAddrList') return addrList(payload);
    return P.mailProbe.call(action, payload).then(function (r) { return finish(action, r); });
  }

  function loginHtml(message) {
    var steps = ['Відкрийте <b>supabase.com</b> → ваш проєкт → <b>Edge Functions → Secrets</b>.',
      'Код — це значення секрету <b>MAIL_ADMIN_CODE</b>. Ви задавали його самі, коли вмикали розсилку (від 8 знаків).',
      'Забули код — задайте в Supabase новий: він діє одразу, перевстановлювати нічого не треба.'];
    return '<div class="rz-code"><section class="card rz-code__main"><h3 class="h2">Відкрити розсилки</h3>' +
      '<p><b>Правила розсилок лежать у Supabase</b>, а сайт відкритий для всіх, хто знає адресу. Тому, щоб бачити й змінювати розсилки, потрібен <b>код розсилки</b>.</p>' +
      '<form class="rz-code__form" data-ml-login><label class="field"><span class="label">Код розсилки</span>' +
      '<input class="input" type="password" name="code" autocomplete="off" placeholder="Код розсилки" aria-label="Код розсилки" required></label>' +
      '<div data-ml-err>' + errHtml(message) + '</div>' +
      '<button class="btn btn--primary" type="submit">' + P.ic('login', 'ui-icon--sm') + 'Відкрити розсилки</button></form>' +
      '<p class="hint">Код памʼятається лише в цьому браузері. На іншому компʼютері чи телефоні його треба ввести ще раз. Забути — у «Стан і журнал».</p></section>' +
      '<section class="card rz-code__how"><h3 class="card-title">Де взяти код</h3><ol class="rz-steps rz-steps--col">' + steps.map(function (s, i) {
        return '<li><span class="rz-num" aria-hidden="true">' + (i + 1) + '</span><p>' + s + '</p></li>'; }).join('') + '</ol>' +
      '<p class="hint">Коли запрацює справжній вхід через Slack, код стане не потрібен: адміністратор відкриватиме розсилки своїм входом.</p></section></div>';
  }
  function errHtml(text) { return text ? '<p class="err" role="alert">' + P.ic('error', 'ui-icon--sm') + esc(text) + '</p>' : ''; }

  function bindLogin(box, onOk) {
    box.addEventListener('submit', function (e) {
      var form = e.target.closest('[data-ml-login]');
      if (!form || !box.contains(form)) return;
      e.preventDefault();
      var btn = form.querySelector('[type="submit"]'), c = String(form.querySelector('[name="code"]').value || ''), out = box.querySelector('[data-ml-err]');
      btn.disabled = true;
      P.mailProbe.call('status', {}, c).then(function (r) {
        btn.disabled = false;
        if (!r.ok) { if (out) out.innerHTML = errHtml(r.code === 'auth' ? 'Код не підходить. Перевірте великі й малі літери. Після 10 невдалих спроб — пауза 10 хвилин.' : r.error); return; }
        P.mailProbe.setCode(c);
        onOk();
      });
    });
  }

  P.mlApi = { call: call, loginHtml: loginHtml, bindLogin: bindLogin };
})(typeof window !== 'undefined' ? window : globalThis);
