(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, K = P.mlKit, doc = root.document;
  var MAX = 10;   // MAX_RECIPIENTS у mail-core.mjs
  var LIMIT = 'Отримувачів уже 10 — це найбільше. Щоб додати нового, приберіть когось хрестиком.';
  var CH_ID = /^[CG](?=[A-Z0-9]*\d)[A-Z0-9]{8,14}$/, LOC_WORDS = 'канал локації';   // ID каналу Slack (validChannelId у mail-core.mjs; обовʼязково є цифра)

  function create(o) {
    var d = o.draft, data = o.data, ix = o.ix, q = '', hl = 0, items = [], open = false;
    var allowEmpty = !!o.allowEmpty;   // стара розсилка, яка вже була без отримувачів, — сервер збереже її й порожньою (тестовий канал)

    function known() {
      var m = {};
      (data.items || []).forEach(function (r) { (r.to || []).forEach(function (t) { if (t.type === 'channel' && t.name) m[t.name] = (m[t.name] || 0) + 1; }); });
      return m;
    }
    function picked(t) {
      return d.to.some(function (x) {
        if (x.type !== t.type) return false;
        if (t.type === 'locChannel') return true;
        if (t.type === 'channel') return t.id ? x.id === t.id : x.name != null && String(x.name).toLowerCase() === String(t.name).toLowerCase();
        return x.id === t.id;
      });
    }
    function suggest() {
      var s = q.trim(), isCh = s.charAt(0) === '#', term = s.replace(/^#+/, '').toLowerCase(), g = [], err = '', foot = '';
      if (d.to.length >= MAX) return { groups: [], err: LIMIT };
      if (!picked({ type: 'locChannel' }) && (!s || (isCh && !term) || (!isCh && term.length > 1 && LOC_WORDS.indexOf(term) === 0))) {
        g.push({ title: 'Канал із налаштувань «Локації»', items: [{ k: 'loc', v: 'locChannel', av: '#', t: 'Канал локації (з налаштувань «Локації»)', s: 'у кожної локації свій канал — повідомлення піде в канал тієї локації, про яку цифри' }] });
      }
      var idm = !isCh && CH_ID.test(s) ? s : '';
      if (idm) {
        if (picked({ type: 'channel', id: idm })) err = 'Канал ' + idm + ' уже серед отримувачів — двічі один канал не додається.';
        else g.push({ title: 'Канал за ID', items: [{ k: 'chid', v: idm, av: '+', t: 'Додати канал за ID ' + idm, s: 'ID каналу зі Slack — Slack → назва каналу → внизу вкладки About' }] });
      }
      if (isCh || !s) {
        var m = known(), ch = Object.keys(m).filter(function (n) { return n.indexOf(term) >= 0 && !picked({ type: 'channel', name: n }); }).sort();
        if (ch.length) g.push({ title: 'Канали з інших розсилок', items: ch.slice(0, 6).map(function (n) {
          return { k: 'ch', v: n, av: '#', t: '#' + n, s: 'канал · уже в ' + m[n] + ' ' + K.plural(m[n], ['розсилці', 'розсилках', 'розсилках']) }; }) });
      }
      if (isCh && term) {
        var norm = K.channelName(s);
        if (!norm) err = 'Назва каналу — лише літери, цифри, «-», «_» і «.», до 80 знаків. Наприклад: #якість-цехів.';
        else if (picked({ type: 'channel', name: norm })) err = '#' + norm + ' уже серед отримувачів — двічі один канал не додається.';
        else if (!known()[norm]) g.push({ title: 'Новий канал', items: [{ k: 'ch', v: norm, av: '+', t: 'Додати канал #' + norm, s: 'якщо такий канал є в Slack' }] });
        foot = 'Щоб повідомлення дійшло, бот «Аудит» має бути в каналі: у Slack відкрийте канал і напишіть /invite @Аудит.';
      }
      if (!isCh && !idm) {
        var match = function (name) { return !term || String(name).toLowerCase().indexOf(term) >= 0; };
        var us = (data.users || []).filter(function (u) { return match(u.name) && !picked({ type: 'user', id: u.id }); });
        var ad = (data.addressees || []).filter(function (a) { return a.active !== false && !(data.users || []).some(function (u) { return u.id === a.id; }) && match(a.name) && !picked({ type: 'user', id: a.id }); });
        if (us.length) g.push({ title: 'Люди з доступом до кабінетів', items: us.slice(0, s ? 8 : 4).map(function (u) {
          return { k: 'us', v: u.id, av: P.initials(u.name), t: u.name, s: u.roleLabel + ((u.locations || []).length ? ' · ' + u.locations.join(', ') : '') + ' · отримає особисто' }; }) });
        if (ad.length) g.push({ title: 'Адресати розсилок — без доступу до кабінетів', items: ad.slice(0, s ? 8 : 4).map(function (a) {
          var p = ix[a.id] || {};
          return { k: 'us', v: a.id, av: P.initials(a.name), ad: true, t: a.name, s: (a.jobTitle ? a.jobTitle + ' · ' : '') + (p.place || '') + ' · отримає особисто' }; }) });
        if (s && !us.length && !ad.length) err = 'Людину «' + s + '» не знайдено. Перевірте імʼя або додайте людину в «Розсилки → Адресати» — і вона зʼявиться тут.';
        else foot = s ? 'Немає потрібної людини? Додайте її в «Розсилки → Адресати» — і вона зʼявиться тут.' : 'Стрілками ↑↓ — вибрати, Enter — додати. Почніть писати — список звузиться.';
      }
      return { groups: g, err: err, foot: foot };
    }
    function box() { return o.root().querySelector('[data-rz-dd]'); }
    function draw() {
      var el = box(); if (!el) return;
      var inp = o.root().querySelector('[data-rz-to-q]');
      if (!open) { el.hidden = true; el.innerHTML = ''; if (inp) { inp.setAttribute('aria-expanded', 'false'); inp.removeAttribute('aria-activedescendant'); } return; }
      var r = suggest(), n = 0;
      items = [];
      r.groups.forEach(function (g) { g.items.forEach(function (x) { items.push(x); }); });
      if (hl >= items.length) hl = items.length - 1;
      if (hl < 0) hl = 0;
      el.hidden = false;
      el.innerHTML = r.groups.map(function (g) {
        return '<p class="rz-dd__g">' + esc(g.title) + '</p>' + g.items.map(function (x) {
          var i = n++;
          return '<button class="rz-dd__i' + (i === hl ? ' is-hl' : '') + '" type="button" role="option" tabindex="-1" id="rz-dd-' + i + '" aria-selected="' + (i === hl) + '" data-act="rz-to-pick" data-i="' + i + '">' +
            '<span class="rz-dd__av' + (x.k === 'ch' ? ' rz-dd__av--ch' : x.ad ? ' rz-dd__av--ad' : '') + '" aria-hidden="true">' + esc(x.av) + '</span>' +
            '<span class="rz-dd__tx"><b>' + esc(x.t) + '</b><span>' + esc(x.s) + '</span></span></button>';
        }).join('');
      }).join('') + (r.err ? '<p class="err rz-dd__err" role="alert">' + P.ic('error', 'ui-icon--sm') + esc(r.err) + '</p>' : '') + (r.foot ? '<p class="rz-dd__f">' + esc(r.foot) + '</p>' : '');
      if (inp) { inp.setAttribute('aria-expanded', 'true'); if (items[hl]) inp.setAttribute('aria-activedescendant', 'rz-dd-' + hl); else inp.removeAttribute('aria-activedescendant'); }
    }
    function add(x) {
      if (!x) return;
      if (d.to.length >= MAX) { draw(); return; }
      q = ''; hl = 0;
      o.onAdd(x.k === 'ch' ? { type: 'channel', name: x.v } : x.k === 'chid' ? { type: 'channel', id: x.v } : x.k === 'loc' ? { type: 'locChannel' } : { type: 'user', id: x.v });
    }

    return {
      html: function () {
        var chips = d.to.map(function (t, i) { return K.recipChip(t, ix, i); }).join('');
        var ch = K.chan();
        return '<div class="field" data-f="to"><span class="label">Обрано · ' + d.to.length + ' з ' + MAX + '</span>' +
          '<div class="rz-rcs">' + (chips || (allowEmpty ? '<span class="hint">Нікого не обрано — ця розсилка йде в тестовий канал' + (ch ? ' #' + esc(ch) : '') + '.</span>'
            : '<span class="hint"><b>Додайте хоча б один канал або людину</b> — без отримувачів розсилку не збережеш.</span>')) + '</div></div>' +
          '<div class="field rz-to"><label class="label" for="rz-to-q">Додати канал або людину</label>' +
          '<input class="input" id="rz-to-q" data-rz-to-q value="' + esc(q) + '" autocomplete="off" maxlength="81" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="rz-dd"' +
            ' placeholder="Напишіть #назву-каналу або імʼя людини — зʼявляться підказки">' +
          '<div class="rz-dd" id="rz-dd" role="listbox" data-rz-dd hidden></div>' +
          '<span class="hint">Канал пишіть так, як він називається в Slack, з «#»: <b>#якість-цехів</b> — або впишіть його ID (<b>C0123…</b>). Хочете, щоб розсилка йшла в канал кожної локації, — оберіть <b>Канал локації</b> (його задає адмін у «Локації»). Бот «Аудит» має бути в цьому каналі (у Slack: <b>/invite @Аудит</b>). ' +
            'Людину шукайте за імʼям — серед тих, хто має доступ до кабінетів, і серед адресатів розсилок («Розсилки → Адресати»).</span></div>';
      },
      input: function (t) { q = t.value; hl = 0; open = true; draw(); },
      focus: function (t) { q = t.value; open = true; draw(); },
      blur: function () {
        root.setTimeout(function () {
          var el = box(), a = doc.activeElement;
          if (el && a && (el.contains(a) || a.hasAttribute('data-rz-to-q'))) return;
          open = false; draw();
        }, 120);
      },
      key: function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!open) { open = true; } else if (items.length) hl = (hl + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; draw(); return; }
        if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); open = false; draw(); return; }
        if (e.key === 'Enter') { e.preventDefault(); if (open && items[hl]) add(items[hl]); }
      },
      pick: function (btn) { add(items[+btn.getAttribute('data-i')]); }
    };
  }

  P.mlTo = { create: create };
})(window);
