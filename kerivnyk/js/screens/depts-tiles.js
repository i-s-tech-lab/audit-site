(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, K = P.mgr;

  function daysOf(v) { return v % 1 === 0 ? K.dn(v) : String(v).replace('.', ',') + ' дня'; }
  function line(label, val) { return '<span class="mgr-dtile__m"><span class="mgr-dtile__l">' + esc(label) + '</span><span class="mgr-dtile__v">' + val + '</span></span>'; }
  function noAudit(d) {
    return line('Днів без аудиту', d.workDays ? '<b>' + H.num(d.daysNoAudit) + '</b> з ' + H.num(d.workDays) : '<span class="mgr-dim">аудитів у локації не було</span>');
  }
  function cover(d) {
    if (d.produced == null) return line('Охоплення', 'перевірено <b>' + H.num(d.checked) + '</b> шт · <span class="mgr-dim">немає даних виробництва</span>');
    return line('Охоплення', 'перевірено <b>' + H.num(d.coverChecked != null ? d.coverChecked : d.checked) + '</b> з ' + H.num(d.produced) + ' шт' + (d.coverPct != null ? ' · <b>' + H.pct(d.coverPct) + '</b>' : ''));
  }
  function audits(d) { return line('Аудити', 'з браком <b>' + H.num(d.auditsDefect) + '</b> · без браку <b>' + H.num(d.auditsClean) + '</b>'); }
  function kd(d) {
    var k = d.kd;
    return '<span class="mgr-dtile__kd"><span class="mgr-dtile__l">Коригуючі дії старшого</span>' + (!k ? '<span class="mgr-dim">даних немає</span>' :
      '<span class="mgr-dtile__v">відкрилось <b>' + H.num(k.opened) + '</b> · відпрацьовано <b>' + H.num(k.worked) + '</b></span>' +
      '<span class="mgr-dtile__v">до плану в середньому: <b>' + (k.avgDaysToPlan != null ? daysOf(k.avgDaysToPlan) : '—') + '</b></span>' +
      '<span class="mgr-dtile__v">закрито без участі старшого <b>' + H.num(k.selfClosed) + '</b> · рецидивів <b>' + H.num(k.relapses) + '</b></span>') + '</span>';
  }

  function tile(d, on) {
    return '<div class="mgr-dtile' + (on ? ' mgr-dtile--on' : '') + (d.active ? '' : ' mgr-dtile--off') + '" data-tile-id="' + esc(d.id) + '" data-tile-name="' + esc(d.name) + '">' +
      '<button class="mgr-dtile__btn" type="button" data-act="mgr-d-open" data-id="' + esc(d.id) + '" aria-expanded="' + !!on + '" aria-label="' + esc((on ? 'Згорнути: ' : 'Розгорнути: ') + d.name) + '">' +
      '<span class="mgr-dtile__head"><b class="mgr-dtile__name">' + esc(d.name) + '</b>' + (d.active ? '' : H.badge('вимкнено')) + '</span>' +
      noAudit(d) + cover(d) + audits(d) + kd(d) + '</button></div>';
  }

  function block(loc, openId) {
    return '<section class="card mgr-dpb" data-dpblock="' + esc(loc.id) + '"><div><h3 class="mgr-dpb__t">' + P.ic('location', 'ui-icon--sm') + esc(loc.name) +
      '<span class="mgr-dim">відділів: ' + loc.depts.length + ' · днів з аудитами: ' + H.num(loc.workDays) + '</span></h3></div>' +
      (loc.depts.length ? '<div class="mgr-dpb__row" data-dprow="' + esc(loc.id) + '" aria-label="Відділи · ' + esc(loc.name) + '">' + loc.depts.map(function (d) { return tile(d, d.id === openId); }).join('') + '</div>'
        : '<p class="hint">Відділів не знайдено — спробуйте інший тип відділу.</p>') +
      '<div class="mgr-dpb__slot" data-dpslot="' + esc(loc.id) + '"></div></section>';
  }

  function key() {
    return '<p class="hint mgr-dpb__key">На плитці' + K.help('mgr.dp.tile') + ': «Днів без аудиту»' + K.help('mgr.dp.noaudit') + ' · «Охоплення»' + K.help('mgr.dp.cover') +
      ' · «Аудити»' + K.help('mgr.dp.audits') + ' · «Коригуючі дії старшого»' + K.help('mgr.dp.kd') + '</p>';
  }

  function mount(el) {
    return Array.prototype.map.call(el.querySelectorAll('[data-dprow]'), function (row) {
      return P.tileRow.mount(row, { scope: 'mgr:dp:' + row.getAttribute('data-dprow'), item: '.mgr-dtile', idAttr: 'data-tile-id', active: '.mgr-dtile--on', minWidth: 230, max: 6, label: 'відділ' });
    });
  }
  function unmount(handles) { (handles || []).forEach(function (h) { if (h && h.destroy) h.destroy(); }); }

  P.mgrDeptTiles = { block: block, key: key, mount: mount, unmount: unmount };
})(window);
