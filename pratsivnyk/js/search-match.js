(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var S = P.search = P.search || {};

  var MIN_LEN = 2, PER_GROUP = 6, DEBOUNCE_MS = 120, CACHE_MS = 5 * 60 * 1000;
  var GROUPS = [
    { k: 'ui', name: 'Розділи й блоки', ic: 'list' },
    { k: 'auditor', name: 'Аудитори', ic: 'user' },
    { k: 'senior', name: 'Старші', ic: 'user' },
    { k: 'worker', name: 'Працівники', ic: 'people' },
    { k: 'dept', name: 'Відділи', ic: 'department' },
    { k: 'loc', name: 'Локації', ic: 'location' },
    { k: 'defect', name: 'Види браку', ic: 'defect' },
    { k: 'product', name: 'Вироби', ic: 'department' },
    { k: 'order', name: 'Замовлення', ic: 'order' },
    { k: 'kd', name: 'Коригуючі дії', ic: 'corrective' },
    { k: 'audit', name: 'Аудити', ic: 'audit' },
    { k: 'person', name: 'Люди', ic: 'user' }
  ];

  function esc(s) {
    if (P.esc) return P.esc(s);
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  }
  function fold(s) { return String(s == null ? '' : s).toLowerCase().replace(/[ʼ’`]/g, "'"); }
  function norm(s) { return fold(s).replace(/\s+/g, ' ').trim(); }

  function tagHit(tag, w) {
    if (!tag) return false;
    if (tag.indexOf(w) === 0 || w.indexOf(tag) === 0) return true;
    return tag.split(' ').some(function (tw) { return tw.indexOf(w) === 0; });
  }

  function match(item, q) {
    var nq = norm(q);
    if (nq.length < MIN_LEN) return null;
    var words = nq.split(' '), t = norm(item.t), s = norm(item.s), tags = (item.tags || []).map(norm), got = {};
    var inTitle = 0, inSub = 0, inTag = 0;
    for (var i = 0; i < words.length; i++) {
      var w = words[i];
      if (t.indexOf(w) >= 0) { inTitle++; continue; }
      if (s && s.indexOf(w) >= 0) { inSub++; continue; }
      var hit = false;
      for (var j = 0; j < tags.length; j++) { if (tagHit(tags[j], w)) { got[j] = 1; hit = true; } }
      if (!hit) return null;
      inTag++;
    }
    var score = inTag && !inTitle && !inSub ? 0 : inTag ? 1 : inSub ? 2 : t.indexOf(nq) === 0 ? 4 : 3;
    return { score: score, tags: Object.keys(got).map(function (j) { return item.tags[j]; }) };
  }

  function hl(text, words) {
    var s = String(text == null ? '' : text), f = fold(s);
    if (!words || !words.length || f.length !== s.length) return esc(s);
    var mask = [], i;
    words.forEach(function (w) {
      if (!w) return;
      for (var at = f.indexOf(w); at >= 0; at = f.indexOf(w, at + w.length)) for (i = at; i < at + w.length; i++) mask[i] = 1;
    });
    var out = '', chunk = '', on = false;
    function flush() { if (chunk) out += on ? '<mark>' + esc(chunk) + '</mark>' : esc(chunk); chunk = ''; }
    for (i = 0; i < s.length; i++) {
      var m = !!mask[i];
      if (m !== on) { flush(); on = m; }
      chunk += s.charAt(i);
    }
    flush();
    return out;
  }

  function byRank(a, b) {
    return b.m.score - a.m.score || String(a.item.t).localeCompare(String(b.item.t), 'uk', { numeric: true });
  }
  function run(items, q, extra) {
    var nq = norm(q), out = { words: [], total: 0, groups: [] };
    if (nq.length < MIN_LEN) return out;
    out.words = nq.split(' ');
    var by = {};
    (items || []).forEach(function (it) {
      var m = match(it, nq);
      if (m) (by[it.k] = by[it.k] || []).push({ item: it, m: m });
    });
    Object.keys(by).forEach(function (k) { by[k].sort(byRank); });
    (extra || []).forEach(function (it) { (by[it.k] = by[it.k] || []).push({ item: it, m: { score: 4, tags: [] } }); });
    GROUPS.forEach(function (g) {
      if (!by[g.k]) return;
      out.groups.push({ k: g.k, name: g.name, ic: g.ic, rows: by[g.k] });
      out.total += by[g.k].length;
    });
    return out;
  }

  S.MIN_LEN = MIN_LEN; S.esc = esc;
  S.norm = norm; S.match = match; S.hl = hl; S.run = run; S.GROUPS = GROUPS;

  if (typeof module !== 'undefined' && module.exports) module.exports = { norm: norm, match: match, hl: hl, run: run, GROUPS: GROUPS };
})(typeof window !== 'undefined' ? window : globalThis);
