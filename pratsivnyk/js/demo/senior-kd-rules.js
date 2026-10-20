(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var Z = 1.645;
  var LEVEL_ORDER = ['scrap', 'repair', 'fix'];

  function lowEdge(rejected, checked) {
    if (!(checked > 0)) return null;
    var r = rejected / checked;
    return (r - Z * Math.sqrt(r * (1 - r) / checked)) * 100;
  }
  function earlyOk(checked, rejected, T, min) {
    if (!(checked > 0) || checked < min) return false;
    return lowEdge(rejected, checked) > T;
  }
  function earlyRates(T, min) {
    return [1, 1.5, 2, 3].map(function (f) {
      var n = Math.round(min * f), k = Math.max(0, Math.floor(T * n / 100));
      while (k < n && !earlyOk(n, k, T, min)) k++;
      return { n: n, rate: Math.round(k / n * 1000) / 10 };
    });
  }
  function levelRank(level) { var i = LEVEL_ORDER.indexOf(level); return i < 0 ? LEVEL_ORDER.length - 1 : i; }
  function pareto(list, pct) {
    var xs = (list || []).filter(function (x) { return x && x.pieces > 0; }).slice().sort(function (a, b) {
      return levelRank(a.level) - levelRank(b.level) || b.pieces - a.pieces ||
        (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    });
    var total = xs.reduce(function (s, x) { return s + x.pieces; }, 0), out = [], cum = 0;
    for (var i = 0; i < xs.length; i++) {
      if (i > 0 && (cum + xs[i].pieces) * 100 > pct * total) break;   // не вміщається повністю — зупинка
      out.push(xs[i].id); cum += xs[i].pieces;
    }
    return out;
  }
  function weekVerdict(deptRate, typesRate, typesBefore, T) {
    if (deptRate == null) return null;
    if (deptRate <= T) return 'norm';
    if (!(typesBefore > 0)) return 'types_lower';
    return (typesRate || 0) >= typesBefore ? 'relapse' : 'types_lower';
  }
  function highEdge(rejected, checked) {
    if (!(checked > 0)) return null;
    var r = rejected / checked;
    return (r + Z * Math.sqrt(r * (1 - r) / checked)) * 100;
  }
  function r1(x) { return Math.round(x * 10) / 10; }
  function earlyClose(p, typesBefore, T, min) {
    var c = p && p.checked > 0 ? p.checked : 0;
    var o = { ok: false, checked: c, min: min, minOk: c >= min, deptRate: null, deptOk: false, typesRate: null, hi: null,
      half: typesBefore > 0 ? r1(typesBefore / 2) : null, typesOk: false };
    if (!c) return o;
    o.deptRate = r1(p.rejected / c * 100); o.deptOk = o.deptRate <= T;
    o.typesRate = r1(p.typesPieces / c * 100); o.hi = r1(highEdge(p.typesPieces, c));
    o.typesOk = o.half != null && o.hi <= o.half;
    o.ok = o.minOk && o.deptOk && o.typesOk;
    return o;
  }
  function finalOf(v1, v2) { return v1 === 'norm' && v2 === 'norm' ? 'helped' : 'held_types'; }

  var R = { Z: Z, LEVEL_ORDER: LEVEL_ORDER, lowEdge: lowEdge, earlyOk: earlyOk, earlyRates: earlyRates, levelRank: levelRank,
    pareto: pareto, weekVerdict: weekVerdict, finalOf: finalOf, highEdge: highEdge, earlyClose: earlyClose };
  P.demoKdRules = R;
  if (typeof module !== 'undefined' && module.exports) module.exports = R;
})(typeof window !== 'undefined' ? window : globalThis);
