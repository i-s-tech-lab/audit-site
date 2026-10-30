(function (root) {
  'use strict';
  var P = root.P, doc = root.document;
  var makers = {};   // назва екрана → fn() → його власний текст для чату

  function scrub(t) {
    return String(t)
      .replace(/\b(?:https?:\/\/|www\.)[^\s«»"'<>]+/gi, '[посилання]')
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[пошта]')
      .replace(/\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/g, '[адреса]')
      .replace(/\b(?:[a-z0-9-]+\.)+(?:com|net|org|ua|io|dev|app|local|lan|corp|biz|info|cloud|site|online|tech|pro)\b/gi, '[адреса]')
      .replace(/\b[A-Za-z0-9_-]{40,}\b/g, '[код]');
  }

  function screenText() {
    var main = doc.querySelector('#cab-main') || doc.querySelector('main');
    if (!main) return '';
    var own = main.querySelector('[data-chat]'), make = own && makers[own.getAttribute('data-chat')];
    if (make) return String(make() || '');
    main.classList.add('chat-grab');
    var raw = String(main.innerText || main.textContent || '');
    main.classList.remove('chat-grab');
    var lines = raw.split('\n').map(function (l) {
      return l.replace(/\s+/g, ' ').replace(/(^|\s)\?(?=\s|$)/g, '$1').trim();
    });
    return lines.filter(function (l, i) { return l || (i > 0 && lines[i - 1]); }).join('\n').trim();
  }

  function head() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return (doc.title || 'Аудит') + '\nЗнято: ' + p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function open() {
    var A = P.adm, text = scrub(head() + '\n\n' + screenText());
    var body = '<p class="hint">Посилання, пошти й адреси сховано. Натисніть «Скопіювати» і вставте в чат (Ctrl+V).</p>' +
      '<textarea class="input adm-chat-text" readonly rows="14" spellcheck="false" aria-label="Текст поточного екрана">' + P.esc(text) + '</textarea>';
    A.modal({ size: 'sm', title: 'Текст для чату', sub: text.split('\n').length + ' рядків', body: body, foot: A.cancelBtn() + A.saveBtn('Скопіювати', 'export'),
      onMount: function (el) { var ta = el.querySelector('textarea'); if (ta) { ta.scrollTop = 0; ta.select(); } },
      on: { 'adm-save': function (b, e, layer) {
        P.hdrTools.copy(text).then(function (ok) {
          if (ok) { layer.close(); P.toast('ok', 'Скопійовано', 'Вставте в чат: Ctrl+V.'); }
          else { var ta = layer.el.querySelector('textarea'); if (ta) { ta.focus(); ta.select(); } P.toast('warn', 'Не вдалося скопіювати', 'Текст у вікні виділено — натисніть Ctrl+C.'); }
        });
      } } });
  }

  P.chatText = { scrub: scrub, screenText: screenText, open: open,
    add: function (name, fn) { makers[name] = fn; } };
  if (P.hdrTools) P.hdrTools.on('chat', open);
})(window);
