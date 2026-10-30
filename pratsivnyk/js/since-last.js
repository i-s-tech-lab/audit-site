(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var HOUR_MS = 3600000, WEEKDAYS = ['нд', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

  function esc(s) { return P.esc ? P.esc(s) : String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  function plural(n, f) {
    var m10 = n % 10, m100 = n % 100;
    return m10 === 1 && m100 !== 11 ? f[0] : (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? f[1] : f[2]);
  }
  var FORMS = {
    audits: ['новий аудит', 'нові аудити', 'нових аудитів'],
    kdNew: ['нова коригуюча дія', 'нові коригуючі дії', 'нових коригуючих дій'],
    relapses: ['рецидив', 'рецидиви', 'рецидивів'],
    selfClosed: ['дія закрилась без участі старшого', 'дії закрились без участі старшого', 'дій закрилось без участі старшого'],
    workersAdded: ['новий працівник', 'нові працівники', 'нових працівників']
  };
  var ORDER = ['audits', 'kdNew', 'relapses', 'selfClosed', 'workersAdded'];

  function parts(counts) {
    var c = counts || {};
    return ORDER.filter(function (k) { return c[k] > 0; }).map(function (k) { return { kind: k, n: c[k], text: c[k] + ' ' + plural(c[k], FORMS[k]) }; });
  }

  function visit(record, nowISO) {
    var rec = Array.isArray(record) ? record : [], at = rec[0] || null;
    var atMs = at ? Date.parse(at) : NaN, nowMs = Date.parse(nowISO);
    if (!at || isNaN(atMs)) return { save: [nowISO], since: null };
    if (nowMs - atMs > HOUR_MS) return { save: [nowISO, at], since: at };
    return { save: null, since: rec[1] || null };
  }

  function whenLabel(iso) {
    var key = P.fmt && P.fmt.dayKey ? P.fmt.dayKey(iso) : '';
    if (!key) return '';
    var wd = WEEKDAYS[new Date(Date.UTC(+key.slice(0, 4), +key.slice(5, 7) - 1, +key.slice(8, 10))).getUTCDay()];
    return wd + ', ' + P.fmt.date(iso) + ' о ' + P.fmt.time(iso);
  }

  function partsHtml(counts, locId, link) {
    return parts(counts).map(function (x) {
      var to = link ? link(x.kind, locId) : null;
      return to ? '<button type="button" class="since__part" data-kind="' + esc(x.kind) + '" data-loc="' + esc(locId || '') + '">' + esc(x.text) + '</button>'
        : '<span class="since__part since__part--plain">' + esc(x.text) + '</span>';
    }).join('<i class="since__sep" aria-hidden="true">·</i>');
  }

  function render(r, scope, link, locId) {
    var head = '<b class="since__head">З вашого останнього входу (' + esc(whenLabel(r.since)) + '):</b>';
    var help = P.help ? P.help.btn('since.last') : '';
    var ic = '<span class="since__ic" aria-hidden="true">' + (P.ic ? P.ic('info', 'ui-icon--sm') : '') + '</span>';
    if (scope === 'manager') {
      var rows = (r.locations || []).filter(function (l) { return parts(l.counts).length; });
      if (!rows.length) return '<div class="since" role="status">' + ic + '<div class="since__txt">' + head + ' нового немає</div>' + help + '</div>';
      return '<div class="since since--rows" role="status">' + ic + '<div class="since__txt">' + head +
        rows.map(function (l) { return '<div class="since__row"><b class="since__loc">' + esc(l.name) + ':</b> ' + partsHtml(l.counts, l.id, link) + '</div>'; }).join('') +
        '</div>' + help + '</div>';
    }
    var body = partsHtml(r.counts, locId, link);
    return '<div class="since" role="status">' + ic + '<div class="since__txt">' + head + ' ' + (body || 'нового немає.') + '</div>' + help + '</div>';
  }

  var seq = 0;
  function mount(el, o) {
    if (!el) return;
    o = o || {};
    var my = ++seq; el.__sinceSeq = my;
    el.innerHTML = '';
    var key = 'lists.seen:' + o.scope;
    var ready = P.prefs && P.prefs.load ? P.prefs.load() : Promise.resolve();
    return ready.then(function () {
      var now = new Date().toISOString(), v = visit(P.prefs ? P.prefs.get(key, []) : [], now);
      if (v.save && P.prefs) P.prefs.set(key, v.save);
      if (!v.since) return null;
      var payload = { scope: o.scope, since: v.since };
      if (o.locationId) payload.locationId = o.locationId;
      return P.srv('sinceLast', payload);
    }).then(function (r) {
      if (!r || !r.ok || el.__sinceSeq !== my) return;   // збій — мовчимо; новіший виклик уже малює
      el.innerHTML = render(r, o.scope, o.link, o.locationId);
      el.onclick = function (e) {
        var b = e.target && e.target.closest ? e.target.closest('.since__part[data-kind]') : null;
        if (!b || !o.link) return;
        var to = o.link(b.getAttribute('data-kind'), b.getAttribute('data-loc') || o.locationId || null);
        if (to && P.router) P.router.go(to.path, to.query);
      };
    }, function () { /* мовчки: це лише підказка */ });
  }

  P.sinceLast = { mount: mount, _visit: visit, _plural: plural, _parts: parts };
})(typeof window !== 'undefined' ? window : globalThis);
