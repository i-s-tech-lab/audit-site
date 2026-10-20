(function (root) {
  'use strict';
  var P = root.P = root.P || {}, doc = root.document;
  var PH = /\{([^{}\s]{1,20})\}/g, ONE_PH = /^\{([^{}\s]{1,20})\}$/;
  var DRAG_TYPE = 'text/x-rz-ph';
  var EXAMPLES = { 'локація': 'Цех А', 'перевірено': '1 156', 'брак_шт': '44', 'брак_%': '3,8%', 'аудитів': '18', 'без_аудитів': 'Пакування, Склад',
    'найбільший_брак': 'Оздоблення — 4,9%', 'топ_браку': 'Розрив шва 12 · Перекіс деталі 9', 'кд_нових': '3', 'кд_на_перевірці': '1' };
  var WD = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'];
  var MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];

  function has(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  function esc(s) { return P.esc ? P.esc(s) : String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function example(name) {
    if (has(EXAMPLES, name)) return EXAMPLES[name];
    var d = new Date();
    if (name === 'день') return WD[d.getDay()];
    if (name === 'дата') return d.getDate() + ' ' + MONTHS[d.getMonth()];
    if (name === 'час') return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
    return null;
  }

  function parse(v) {
    var out = [], last = 0;
    v = String(v == null ? '' : v).replace(/\r\n?/g, '\n');
    function text(s) { s.split('\n').forEach(function (part, j) { if (j) out.push({ t: 'nl' }); if (part) out.push({ t: 'text', v: part }); }); }
    v.replace(PH, function (all, name, i) { if (i > last) text(v.slice(last, i)); out.push({ t: 'ph', name: name }); last = i + all.length; return all; });
    if (last < v.length) text(v.slice(last));
    return out;
  }

  function mount(host, o) {
    o = o || {};
    var labels = {}, links = o.links || {}, max = o.max || 1500;
    (o.groups || []).forEach(function (g) { (g.items || []).forEach(function (x) { labels[x[0]] = x[1]; }); });
    Object.keys(links).forEach(function (k) { if (!has(labels, k)) labels[k] = links[k]; });

    host.innerHTML = '<div class="rz-ce" contenteditable="true" role="textbox" aria-multiline="true" spellcheck="true" aria-label="Текст повідомлення"' +
      ' data-placeholder="' + esc(o.placeholder || '') + '"></div><p class="rz-ce__n" aria-live="polite"></p>';
    var el = host.querySelector('.rz-ce'), counter = host.querySelector('.rz-ce__n');
    var lastOff = null, drag = null, cur = '';
    var SVC = String.fromCharCode(0x2060), SVC_RE = new RegExp(SVC, 'g'), NBSP_RE = new RegExp(String.fromCharCode(0xa0), 'g');

    function sampleOf(name) {
      if (has(links, name)) return links[name] + ' ↗';
      var s = o.sample ? o.sample(name) : null;
      if (s != null && s !== '') return String(s);
      var x = example(name);
      return x != null ? x : labels[name] || name;
    }
    function chipHtml(name) {
      var known = has(labels, name), link = has(links, name), sample = known ? sampleOf(name) : '{' + name + '}';
      var label = known ? labels[name] : 'Такої вставки немає — замініть або приберіть';
      return '<span class="rz-tok' + (known ? '' : ' rz-tok--bad') + (link ? ' rz-tok--link' : '') + '" contenteditable="false" draggable="true"' +
        ' data-ph="' + esc(name) + '" title="' + esc(label + (known ? ' · вставка {' + name + '} · натисніть, щоб змінити, або перетягніть' : '')) + '"' +
        ' aria-label="Вставка: ' + esc(label) + (known && !link ? ', приклад ' + esc(sample) : '') + '">' + esc(sample) + '</span>';
    }
    function render(v) {
      el.innerHTML = parse(v).map(function (x) { return x.t === 'text' ? esc(x.v) : x.t === 'nl' ? '<br>' : chipHtml(x.name); }).join('') + '<br data-tail="1">';
    }

    function serialize(node) {
      var s = '';
      (function walk(n) {
        for (var c = n.firstChild; c; c = c.nextSibling) {
          if (c.nodeType === 3) s += c.nodeValue.replace(NBSP_RE, ' ').replace(SVC_RE, '');
          else if (c.nodeType === 1) {
            if (c.hasAttribute('data-ph')) s += '{' + c.getAttribute('data-ph') + '}';
            else if (c.tagName === 'BR') { if (!c.hasAttribute('data-tail')) s += '\n'; }
            else { if (/^(DIV|P|LI)$/.test(c.tagName) && s && s.slice(-1) !== '\n') s += '\n'; walk(c); }
          }
        }
      })(node);
      return s;
    }
    function canonical() {
      var last = el.lastChild;
      if (!last || last.nodeType !== 1 || !last.hasAttribute('data-tail')) return false;
      for (var c = el.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) continue;
        if (c.nodeType !== 1) return false;
        if (c.tagName === 'BR') { if (c.hasAttribute('data-tail') && c !== last) return false; continue; }
        if (!(c.tagName === 'SPAN' && c.hasAttribute('data-ph') && c.childNodes.length === 1 && c.firstChild.nodeType === 3)) return false;
      }
      return true;
    }
    function offsetAt(node, offset) {
      var r = doc.createRange();
      r.setStart(el, 0);
      try { r.setEnd(node, offset); } catch (e) { return serialize(el).length; }
      var box = doc.createElement('div');
      box.appendChild(r.cloneContents());
      return serialize(box).length;
    }
    function caret() {
      var sel = root.getSelection && root.getSelection();
      if (!sel || !sel.rangeCount) return null;
      var r = sel.getRangeAt(0);
      if (!el.contains(r.startContainer) && r.startContainer !== el) return null;
      return { a: offsetAt(r.startContainer, r.startOffset), b: offsetAt(r.endContainer, r.endOffset) };
    }
    function visLen(s) { return s.replace(SVC_RE, '').length; }
    function domIdx(s, k) { var i = 0, seen = 0; while (i < s.length && (seen < k || s.charAt(i) === SVC)) { if (s.charAt(i) !== SVC) seen++; i++; } return i; }
    function ensureSvc(t) { if (!visLen(t.nodeValue) && t.nodeValue.indexOf(SVC) < 0) t.nodeValue = SVC; }
    function anchorBefore(r, node) {
      var prev = node ? node.previousSibling : el.lastChild;
      if (prev && prev.nodeType === 3) { ensureSvc(prev); r.setStart(prev, prev.nodeValue.length); return; }
      var t = doc.createTextNode(SVC);
      el.insertBefore(t, node || null);
      r.setStart(t, 1);
    }
    function setCaret(off) {
      var acc = 0, sel = root.getSelection(), r = doc.createRange(), c;
      for (c = el.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) {
          var n = visLen(c.nodeValue);
          if (acc + n >= off) ensureSvc(c);
          if (acc + n >= off) { r.setStart(c, domIdx(c.nodeValue, off - acc)); break; }
          acc += n;
        } else if (c.nodeType === 1) {
          if (c.hasAttribute('data-tail') || off === acc) { anchorBefore(r, c); break; }
          var len = c.hasAttribute('data-ph') ? c.getAttribute('data-ph').length + 2 : 1;
          if (acc + len >= off) {   // одразу після цієї фішки чи <br>
            var nx = c.nextSibling;
            if (nx && nx.nodeType === 3) { ensureSvc(nx); r.setStart(nx, domIdx(nx.nodeValue, 0)); } else anchorBefore(r, nx);
            break;
          }
          acc += len;
        }
      }
      if (!c) anchorBefore(r, el.lastChild);
      r.collapse(true);
      sel.removeAllRanges(); sel.addRange(r);
      lastOff = off;
    }
    function changed(kind) {
      var v = serialize(el);
      el.classList.toggle('is-empty', !v);
      counter.textContent = v.length > max * 0.8 ? v.length + ' / ' + max + ' знаків' : '';
      counter.classList.toggle('rz-ce__n--over', v.length > max);
      if (v !== cur) { cur = v; if (o.onChange) o.onChange(v); }
      if (kind !== 'undo') snap(kind || 'edit');
    }

    var H0 = o.history || {}, hist = H0.list || (H0.list = []), lastAt = 0;
    function hiGet() { return typeof H0.i === 'number' ? H0.i : -1; }
    function snap(kind) {
      var v = serialize(el), c = caret(), off = c ? c.b : v.length, now = Date.now(), hi = hiGet();
      if (hi >= 0 && hist[hi].v === v) { hist[hi].off = off; return; }
      if ((kind === 'type' || kind === 'del') && hi > 0 && hi === hist.length - 1 && hist[hi].kind === kind && now - lastAt < 1000) hist[hi] = { v: v, off: off, kind: kind };
      else { hist.splice(hi + 1); hist.push({ v: v, off: off, kind: kind }); if (hist.length > 100) hist.shift(); H0.i = hist.length - 1; }
      lastAt = now;
    }
    function undo(step) {
      var hi = hiGet(), j = hi + step;
      if (j < 0 || j >= hist.length) return;
      var a = hist[hi].v, b = hist[j].v, p = 0, s = 0;
      while (p < a.length && p < b.length && a.charAt(p) === b.charAt(p)) p++;
      while (s < a.length - p && s < b.length - p && a.charAt(a.length - 1 - s) === b.charAt(b.length - 1 - s)) s++;
      var off = b.length - s;
      H0.i = j; render(hist[j].v); setCaret(off); changed('undo');
    }

    function splice(a, b, ins, kind) {
      var v = serialize(el);
      v = v.slice(0, a) + ins + v.slice(b);
      render(v); setCaret(a + ins.length); changed(kind || 'edit');
    }
    function chipOffset(chip) { return offsetAt(el, Array.prototype.indexOf.call(el.childNodes, chip)); }

    var composing = false;
    el.addEventListener('compositionstart', function () { composing = true; });
    el.addEventListener('compositionend', function () { composing = false; afterTyping(); });
    el.addEventListener('beforeinput', function (e) {
      if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') { e.preventDefault(); undo(e.inputType === 'historyUndo' ? -1 : 1); return; }
      if ((e.inputType === 'deleteContentBackward' || e.inputType === 'deleteContentForward') && e.cancelable && !composing) {
        var c = caret();
        if (!c) return;
        e.preventDefault();
        if (c.a !== c.b) splice(c.a, c.b, '', 'edit'); else delUnit(c.b, e.inputType === 'deleteContentBackward');
      }
    });
    function delUnit(at, back) {
      var v = serialize(el), m, n, code;
      if (back) {
        if (at <= 0) return;
        m = /\{[^{}\s]{1,20}\}$/.exec(v.slice(0, at));
        code = v.charCodeAt(at - 1);
        n = m ? m[0].length : code >= 0xDC00 && code <= 0xDFFF && at > 1 ? 2 : 1;
        splice(at - n, at, '', m ? 'edit' : 'del');
      } else {
        if (at >= v.length) return;
        m = /^\{[^{}\s]{1,20}\}/.exec(v.slice(at));
        code = v.charCodeAt(at);
        n = m ? m[0].length : code >= 0xD800 && code <= 0xDBFF ? 2 : 1;
        splice(at, at + n, '', m ? 'edit' : 'del');
      }
    }
    el.addEventListener('input', function (e) {
      if (e.isComposing || composing) return;
      afterTyping();
    });
    function afterTyping() {
      var c = caret();
      if (!canonical()) { render(serialize(el)); if (c) setCaret(c.b); }
      else {
        var sel = root.getSelection(), r0 = sel && sel.rangeCount ? sel.getRangeAt(0) : null, n = r0 ? r0.startContainer : null;
        if (n && n.nodeType === 3 && n.parentNode === el && n.nodeValue.indexOf(SVC) >= 0 && visLen(n.nodeValue) > 0 && c) {
          n.nodeValue = n.nodeValue.replace(SVC_RE, ''); setCaret(c.b);
        } else if (c && r0 && r0.collapsed && !(n && n.nodeType === 3 && visLen(n.nodeValue) > 0)) {
          setCaret(c.b);
        }
      }
      changed('type');
    }
    el.addEventListener('keydown', function (e) {
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter') { e.preventDefault(); var c = caret(); if (c) splice(c.a, c.b, '\n'); return; }
      var mod = e.ctrlKey || e.metaKey, k = String(e.key || '').toLowerCase();
      if (mod && (k === 'z' || k === 'я')) { e.preventDefault(); undo(e.shiftKey ? 1 : -1); return; }
      if (mod && (k === 'y' || k === 'н')) { e.preventDefault(); undo(1); return; }
      if (mod && /^[biu]$/i.test(e.key)) e.preventDefault();
    });
    el.addEventListener('paste', function (e) {
      e.preventDefault();
      var t = (e.clipboardData || root.clipboardData).getData('text/plain') || '', c = caret();
      if (c) splice(c.a, c.b, t.replace(/\r\n?/g, '\n'));
    });
    function onSel() { if (!doc.body.contains(el)) { doc.removeEventListener('selectionchange', onSel); return; } var c = caret(); if (c) lastOff = c.b; }
    doc.addEventListener('selectionchange', onSel);

    el.addEventListener('dragstart', function (e) {
      var chip = e.target.closest ? e.target.closest('[data-ph]') : null, v = serialize(el);
      if (chip && el.contains(chip)) {
        var from = chipOffset(chip), ins = '{' + chip.getAttribute('data-ph') + '}';
        drag = { ins: ins, from: from, len: ins.length };
        chip.classList.add('is-drag');
      } else {
        var c = caret();
        if (!c || c.a === c.b) return;
        drag = { ins: v.slice(c.a, c.b), from: c.a, len: c.b - c.a };
      }
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData('text/plain', drag.ins);
      if (ONE_PH.test(drag.ins)) e.dataTransfer.setData(DRAG_TYPE, ONE_PH.exec(drag.ins)[1]);
    });
    el.addEventListener('dragend', function () { drag = null; Array.prototype.forEach.call(el.querySelectorAll('.is-drag'), function (x) { x.classList.remove('is-drag'); }); });
    el.addEventListener('dragover', function (e) { e.preventDefault(); e.dataTransfer.dropEffect = drag ? 'move' : 'copy'; });
    el.addEventListener('drop', function (e) {
      e.preventDefault();
      var dt = e.dataTransfer, r = pointRange(e.clientX, e.clientY), v = serialize(el);
      var at = r && (el.contains(r.startContainer) || r.startContainer === el) ? offsetAt(r.startContainer, r.startOffset) : v.length;
      if (drag) {
        var d0 = drag; drag = null;
        if (at >= d0.from && at <= d0.from + d0.len) return;   // відпустили на тому самому місці
        v = v.slice(0, d0.from) + v.slice(d0.from + d0.len);
        if (at > d0.from) at -= d0.len;
        render(v.slice(0, at) + d0.ins + v.slice(at)); setCaret(at + d0.ins.length); changed('edit');
        return;
      }
      var name = dt.getData(DRAG_TYPE), text = name ? '{' + name + '}' : String(dt.getData('text/plain') || '').replace(/\r\n?/g, '\n');
      if (text) splice(at, at, text);
    });
    function pointRange(x, y) {
      if (doc.caretRangeFromPoint) return doc.caretRangeFromPoint(x, y);
      if (doc.caretPositionFromPoint) { var p = doc.caretPositionFromPoint(x, y); if (!p) return null; var r = doc.createRange(); r.setStart(p.offsetNode, p.offset); return r; }
      return null;
    }

    el.addEventListener('click', function (e) {
      var chip = e.target.closest ? e.target.closest('[data-ph]') : null;
      if (!chip || !el.contains(chip)) return;
      e.preventDefault();
      openMenu(chip);
    });
    function openMenu(chip) {
      var name = chip.getAttribute('data-ph'), known = has(labels, name), at = chipOffset(chip), len = name.length + 2;
      var body = '<div class="rz-tokmenu"><p class="rz-tokmenu__h"><b>' + esc(known ? labels[name] : 'Невідома вставка {' + name + '}') + '</b>' +
          (known ? '<span>' + (has(links, name) ? 'посилання на наш сайт' : 'приклад: ' + esc(sampleOf(name))) + ' · у тексті {' + esc(name) + '}</span>' : '<span>Такої вставки немає — сервер не збереже текст. Замініть або приберіть.</span>') + '</p>' +
        '<p class="rz-tokmenu__t">Замінити на</p>' + (o.groups || []).map(function (g) {
          return '<div class="rz-tokmenu__g"><span>' + esc(g.title) + '</span><div class="chips">' + g.items.map(function (x) {
            return '<button class="chip-pick rz-chip' + (x[0] === name ? ' chip-pick--on' : '') + '" type="button" data-act="rz-tok-to" data-v="' + esc(x[0]) + '">' + esc(x[1]) + '</button>'; }).join('') + '</div></div>';
        }).join('') +
        '<button class="btn btn--quiet btn--sm rz-tokmenu__rm" type="button" data-act="rz-tok-rm">' + (P.ic ? P.ic('delete', 'ui-icon--sm') : '') + 'Прибрати вставку</button></div>';
      var on = {
        'rz-tok-to': function (t, e, layer) { layer.close(); var v = t.getAttribute('data-v'); el.focus(); if (v !== name) splice(at, at + len, '{' + v + '}'); else setCaret(at + len); },
        'rz-tok-rm': function (t, e, layer) { layer.close(); el.focus(); splice(at, at + len, ''); }
      };
      if (P.sr && P.sr.menu) P.sr.menu(chip, { width: 360, on: on, body: body });
    }

    var api = {
      value: function () { return serialize(el); },
      set: function (v) { render(v); cur = serialize(el); changed('edit'); },
      insert: function (name) {
        var c = caret(), v = serialize(el), a = c ? c.a : lastOff != null ? Math.min(lastOff, v.length) : v.length, b = c ? c.b : a;
        el.focus(); splice(a, b, '{' + name + '}');
      },
      refresh: function () { if (composing) return; var c = doc.activeElement === el ? caret() : null; render(serialize(el)); if (c) setCaret(c.b); },   // слово ще набирається — не чіпаємо
      focus: function () { el.focus(); }
    };
    render(o.value || ''); cur = serialize(el); changed('init');
    return api;
  }

  function dragButton(e) {
    var b = e.target.closest ? e.target.closest('[data-rz-drag]') : null;
    if (!b) return;
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData(DRAG_TYPE, b.getAttribute('data-rz-drag'));
    e.dataTransfer.setData('text/plain', '{' + b.getAttribute('data-rz-drag') + '}');
  }
  if (doc) doc.addEventListener('dragstart', dragButton);

  P.rzChips = { mount: mount, parse: parse, example: example };
  if (typeof module !== 'undefined' && module.exports) module.exports = { parse: parse };
})(typeof window !== 'undefined' ? window : globalThis);
