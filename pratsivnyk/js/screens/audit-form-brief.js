(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, f = P.fmt, AF = P.AF = P.AF || {};
  var DAYS = 7;   // вікно блоку, днів

  function shown(F) { return !!(F.departmentId && !F.editId && !F.done); }

  function part(title, body) { return '<section class="br-part"><h4 class="br-part__title">' + esc(title) + '</h4>' + body + '</section>'; }
  function rows(list, num, tone) {
    return '<ol class="br-list">' + list.map(function (x) {
      return '<li class="br-row"><span class="br-row__name">' + (tone ? '<span class="lvl-dot lvl-dot--' + esc(x.level) + '" title="' + esc(AF.lvlLabel(x.level)) + '"></span>' : '') +
        esc(x.name) + '</span><span class="br-row__num">' + num(x) + '</span></li>';
    }).join('') + '</ol>';
  }
  function none(text) { return '<p class="br-none">' + esc(text) + '</p>'; }
  function pcs(x) { return f.num(x.pieces) + ' шт'; }
  function kdLine(k) {
    var names = (k.items || []).map(function (x) { return '<span class="br-nm"><span class="lvl-dot lvl-dot--' + esc(x.level) + '" title="' + esc(AF.lvlLabel(x.level)) + '"></span>' + esc(x.name) + '</span>'; });
    return '<p class="br-kd">Коригуюча дія: ' + (names.length ? 'види браку ' + names.join(', ') : 'види браку не вказано') + '</p>';
  }

  function parts(b) {
    var d = b.days, kds = b.kds || (b.kd ? [b.kd] : []);
    var what = part('Що перевіряти', (b.products.length ? rows(b.products, function (x) { return pcs(x); }) : none('Браку за ' + d + ' днів не було.')) +
      kds.map(kdLine).join(''));
    var who = part('Кого перевірити',
      '<p class="br-sub">Найбільше браку за ' + d + ' днів</p>' + (b.defectors.length ? rows(b.defectors, pcs) : none('Браку з відомим винним не було.')) +
      '<p class="br-sub">Давно не перевіряли (понад ' + b.lostAfter + ' днів)</p>' +
      (b.lost.length ? rows(b.lost, function (x) { return x.daysAgo + ' ' + P.plural(x.daysAgo, 'день', 'дні', 'днів') + ' тому'; }) : none('Усіх перевіряли за останні ' + b.lostAfter + ' днів.')));
    var types = part('Види браку за ' + d + ' днів', b.defectTypes.length ? rows(b.defectTypes, pcs, true) : none('Браку за ' + d + ' днів не було.'));
    return '<div class="di-grid">' + what + who + types + '</div>';
  }

  function inner(c) {
    if (!c || c.state === 'loading') return '<p class="di-load" role="status"><span class="ui-spinner ui-spinner--sm" aria-hidden="true"></span>Завантажую…</p>';
    if (c.state === 'error') {
      return '<div class="di-err"><p class="err" role="alert">' + P.ic('error') + esc('Не вдалося завантажити. ' + (c.error || '')) + '</p>' +
        '<button type="button" class="ui-btn ui-btn--secondary ui-btn--sm" data-a="brief-retry">' + P.ic('refresh') + 'Спробувати ще раз</button></div>';
    }
    return parts(c.data);
  }

  AF.briefHtml = function (F) {
    if (!shown(F)) return '';
    var dep = AF.dept(F, F.departmentId), c = (F.briefCache || {})[F.departmentId];
    var days = c && c.data && c.data.days ? c.data.days : DAYS;
    return '<div class="dept-info" data-dept-info><div class="di-head"><h3 class="di-title">Про відділ' + (dep ? ' «' + esc(dep.name) + '»' : '') + ' · ' + days + ' днів</h3>' +
      P.help.btn('w.form.deptInfo') + '</div>' + inner(c) + '</div>';
  };

  AF.briefSync = function (F, done) {
    if (!shown(F)) return;
    var dep = F.departmentId, cache = F.briefCache = F.briefCache || {};
    if (cache[dep]) return;
    cache[dep] = { state: 'loading' };
    P.srv('auditDeptBrief', { locationId: F.loc, departmentId: dep, days: DAYS }).then(function (r) {
      cache[dep] = r.ok ? { state: 'ok', data: r } : { state: 'error', error: r.error || '' };
      done(F);
    });
  };
  AF.briefRetry = function (F) { if (F.briefCache && F.briefCache[F.departmentId] && F.briefCache[F.departmentId].state === 'error') delete F.briefCache[F.departmentId]; };
})(window);
