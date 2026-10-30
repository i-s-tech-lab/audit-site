(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var KINDS = { type: 'вид браку', worker: 'працівника', product: 'виріб', order: 'замовлення' };
  var MAX = 200;
  var ID_RE = /^[^\u0000-\u001f<>"`\\]{1,80}$/;   // ті самі межі, що в профілі (demo/prefs.js)

  function esc(s) { return P.esc ? P.esc(s) : String(s); }
  function ic(on) { return P.ic ? P.ic(on ? 'star-on' : 'star', 'ui-icon--sm') : ''; }
  function path(kind) { return 'lists.star:' + kind; }
  function curLoc() { return P.sr && typeof P.sr.curLoc === 'function' ? P.sr.curLoc() : null; }
  function keyOf(kind, id) { var loc = kind === 'worker' ? curLoc() : null; return loc ? loc + ':' + id : id; }
  function active(kind) {
    var loc = kind === 'worker' ? curLoc() : null, pre = loc ? loc + ':' : null;
    return all(kind).map(function (e) { return pre && e.indexOf(pre) === 0 ? e.slice(pre.length) : e; });
  }
  function okKind(kind) { return Object.prototype.hasOwnProperty.call(KINDS, kind); }
  function okId(id) { return typeof id === 'string' && ID_RE.test(id); }
  function all(kind) { return okKind(kind) && P.prefs ? P.prefs.get(path(kind), []) || [] : []; }
  function on(kind, id) { return okId(id) && active(kind).indexOf(id) >= 0; }
  function label(isOn, name) { return (isOn ? 'Не стежити за «' : 'Стежити за «') + name + '»'; }

  function html(kind, id, name) {
    if (!okKind(kind) || !okId(id)) return '';
    var isOn = on(kind, id), nm = String(name == null ? id : name);
    return '<button class="srs-star' + (isOn ? ' srs-star--on' : '') + '" type="button" data-star-kind="' + kind + '" data-star-id="' + esc(id) + '" data-star-name="' + esc(nm) +
      '" aria-pressed="' + isOn + '" aria-label="' + esc(label(isOn, nm)) + '" title="' + esc(label(isOn, nm)) + '">' + ic(isOn) + '</button>';
  }

  function sort(list, kind, idOf) {
    var set = Object.create(null);
    active(kind).forEach(function (id) { set[id] = 1; });
    var a = [], b = [];
    (list || []).forEach(function (x) { (set[String(idOf(x))] ? a : b).push(x); });
    return a.concat(b);
  }

  function toggle(kind, id) {
    if (!okKind(kind) || !okId(id) || !P.prefs) return null;
    var list = all(kind), mine = keyOf(kind, id), wasOn = list.indexOf(mine) >= 0 || list.indexOf(id) >= 0;
    if (wasOn) list = list.filter(function (e) { return e !== mine && e !== id; });   // знімаємо і новий запис (з локацією), і старий (лише код)
    else {
      if (list.length >= MAX) { if (P.toast) P.toast('warn', 'Забагато позначок', 'Можна стежити не більше ' + MAX + ' позицій одного виду. Зніміть непотрібні зірочки.'); return null; }
      list.push(mine);
    }
    P.prefs.set(path(kind), list.length ? list : null);
    var now = !wasOn;
    refresh(kind, id, now);
    if (P.emit) P.emit('stars:changed', { kind: kind, id: id, on: now });
    return now;
  }

  function refresh(kind, id, isOn) {
    var doc = root.document;
    if (!doc) return;
    Array.prototype.forEach.call(doc.querySelectorAll('[data-star-kind]'), function (b) {
      if (b.getAttribute('data-star-kind') !== kind || b.getAttribute('data-star-id') !== id) return;
      var text = label(isOn, b.getAttribute('data-star-name') || id);
      b.classList.toggle('srs-star--on', isOn);
      b.setAttribute('aria-pressed', String(isOn));
      b.setAttribute('aria-label', text);
      b.setAttribute('title', text);
      b.innerHTML = ic(isOn);
    });
  }

  function sig() { return Object.keys(KINDS).map(function (k) { return all(k).join(','); }).join('|'); }
  function late(alive, redraw) {
    if (!P.prefs || !P.prefs.load) return;
    var before = sig();
    P.prefs.load().then(function () { if (sig() !== before && (!alive || alive())) redraw(); });
  }

  P.srStars = { html: html, on: on, sort: sort, all: all, toggle: toggle, late: late, sig: sig, KINDS: KINDS };

  if (root.document && root.document.addEventListener) {
    root.document.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('[data-star-kind]') : null;
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      var kind = b.getAttribute('data-star-kind'), id = b.getAttribute('data-star-id');
      P.prefs.load().then(function () { toggle(kind, id); });
    }, true);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = P.srStars;
})(typeof window !== 'undefined' ? window : globalThis);
