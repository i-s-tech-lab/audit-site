(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var doc = root.document;
  var fns = {}, dotOn = false;

  function esc(s) { return P.esc ? P.esc(s) : String(s); }
  function ic(n) { return P.ic ? P.ic(n) : ''; }

  function html(opts) {
    var o = opts || {}, cls = o.cls || 'tool', out = '';
    function btn(act, icon, label, extra) {
      return '<button class="' + cls + ' hdr-tool" type="button" data-act="' + act + '" title="' + esc(label) + '" aria-label="' + esc(label) + '">' + ic(icon) + (extra || '') + '</button>';
    }
    if (o.search && fns.search) out += btn('hdr-search', 'search', 'Пошук (Ctrl+K)');
    if (o.link && fns.link) out += btn('hdr-link', 'link', 'Скопіювати посилання на цей екран');
    if (o.chat && fns.chat) out += btn('hdr-chat', 'export', 'Текст для чату: скопіювати те, що на екрані');
    if (o.news && fns.news) out += btn('hdr-news', 'whats-new', 'Що нового', '<span class="hdr-tool__dot"' + (dotOn ? '' : ' hidden') + '></span>');
    return out ? '<span class="hdr-tools">' + out + '</span>' : '';
  }

  function url(t) {
    var q = t.query || {}, qs = Object.keys(q).filter(function (k) { return q[k] != null && q[k] !== ''; })
      .map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(q[k]); }).join('&');
    var href = '../' + t.app + '/#' + (t.path || '/') + (qs ? '?' + qs : '');
    try { return new URL(href, root.location.href).href; } catch (e) { return href; }
  }

  function copy(text) {
    function old() {
      try {
        var ta = doc.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        doc.body.appendChild(ta); ta.select();
        var ok = doc.execCommand('copy');
        doc.body.removeChild(ta);
        return ok;
      } catch (e) { return false; }
    }
    if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
      return root.navigator.clipboard.writeText(text).then(function () { return true; }, function () { return old(); });
    }
    return Promise.resolve(old());
  }

  function share() {
    var t = fns.link ? fns.link() : null;
    if (!t) { if (P.toast) P.toast('info', 'Цим екраном не можна поділитися', 'Посилання є для екранів, які бачить і старший аудитор: аналітика, коригуючі дії, люди.'); return; }
    var u = url(t);
    copy(u).then(function (ok) {
      if (!P.toast) return;
      if (ok) P.toast('ok', 'Посилання скопійовано', t.label ? 'Відкриється: ' + t.label + '.' : 'Надішліть його в Slack — відкриється той самий екран.');
      else P.toast('warn', 'Не вдалося скопіювати', 'Скопіюйте адресу вручну: ' + u);
    });
  }

  function dot(on) {
    dotOn = !!on;
    if (!doc) return;
    Array.prototype.forEach.call(doc.querySelectorAll('.hdr-tool__dot'), function (d) { d.hidden = !dotOn; });
  }

  if (doc && doc.addEventListener) {
    doc.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-act^="hdr-"]') : null;
      if (!b || !b.classList.contains('hdr-tool')) return;
      var a = b.getAttribute('data-act');
      if (a === 'hdr-search' && fns.search) fns.search();
      else if (a === 'hdr-link') share();
      else if (a === 'hdr-news' && fns.news) fns.news();
      else if (a === 'hdr-chat' && fns.chat) fns.chat();
    });
    doc.addEventListener('keydown', function (e) {
      if (!fns.search || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      if (e.code !== 'KeyK' && String(e.key).toLowerCase() !== 'k') return;
      if (!doc.querySelector('.hdr-tool[data-act="hdr-search"]')) return;   // у цьому кабінеті пошуку немає (напр. аудитор)
      e.preventDefault();
      fns.search();
    });
  }

  P.hdrTools = {
    html: html, url: url, copy: copy, dot: dot, share: share,
    on: function (name, fn) { fns[name] = fn; },
    has: function (name) { return !!fns[name]; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
