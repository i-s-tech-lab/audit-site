(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm, da = A.da, q = A.q, qa = A.qa, API = P.accessApi;
  var PAGE = 50;
  var DAYS = [[1, 'Сьогодні'], [7, '7 днів'], [30, '30 днів'], [90, '90 днів']];
  var KINDS = [['all', 'Усе'], ['login', 'Входи'], ['refused', 'Відмови'], ['people', 'Люди й доступи']];
  var ROLE_CODE = /\b(auditor|senior_auditor|location_lead|manager|admin)\b/g;   // сервер пише в подробицях код ролі — перекладаємо
  var OLD_ROLE = { location_lead: 'Старший локації' };   // роль прибрано, а старі записи журналу ще містять її код
  var flt = { days: 7, kind: 'all', q: '' };   // період, розділ і пошук живуть, поки відкрита сторінка

  function whoText(e) {
    var who = e.kind === 'people' && e.actor && e.actor.name ? e.actor : e.who;
    if (who && who.name) return who.name;
    if (!e.slackId) return '—';
    return (e.event === 'not_listed' || e.event === 'request_created' || e.event === 'request_skipped' ? 'немає в списку · ' : 'Slack ') + e.slackId;
  }
  function detailText(e) {
    var parts = [], d = e.detail ? String(e.detail) : '', via = API.viaText(d);
    if (e.kind === 'people' && e.actor && e.target && e.actor.name && e.target.name) parts.push(e.actor.name + ' → ' + e.target.name);
    if (via) parts.push(via);
    else if (e.event === 'exchange_ok') { if (API.ROLE[d] || OLD_ROLE[d]) parts.push(API.ROLE[d] || OLD_ROLE[d]); }
    else if (d && e.event !== 'button_press') {
      d = d.replace(ROLE_CODE, function (m) { return OLD_ROLE[m] || API.roleText(m); });
      if (/[А-Яа-яІіЇїЄєҐґ]/.test(d) && !(e.target && d === e.target.name)) parts.push(d);
    }
    return parts.join(' · ');
  }
  function evRow(e) {
    var d = detailText(e);
    return '<li class="acc-ev acc-ev--' + esc(e.kind || 'system') + '"><span class="acc-ev__t">' + esc(P.fmt.dateTime(e.at)) + '</span><span class="acc-ev__who">' + esc(whoText(e)) + '</span>' +
      '<span class="acc-ev__what">' + esc(API.eventText(e)) + '</span>' + (d ? '<span class="acc-ev__d">' + esc(d) + '</span>' : '') + '</li>';
  }
  function matches(e, s) {
    return !s || [whoText(e), e.slackId, API.eventText(e), detailText(e)].join(' ').toLowerCase().indexOf(s) >= 0;
  }

  P.cab.screen('/slack-login/log', { tab: 'slack', title: 'Журнал входів', render: function (ctx) {
    var whoId = ctx.query && ctx.query.who ? String(ctx.query.who) : '', whoName = '';
    var items = [], more = false, nextId = null, loading = false, failed = null, seq = 0;

    function shown() { var s = flt.q.trim().toLowerCase(); return items.filter(function (e) { return matches(e, s); }); }
    function pills(act, list, cur, label) {
      return '<nav class="pills acc-pills" aria-label="' + label + '">' + list.map(function (x) {
        return '<button class="pill' + (x[0] === cur ? ' pill--on' : '') + '" type="button" data-act="' + act + '"' + da('v', x[0]) + ' aria-pressed="' + (x[0] === cur) + '">' + esc(x[1]) + '</button>';
      }).join('') + '</nav>';
    }
    function drawList() {
      var box = q(ctx.el, '[data-lg-list]'); if (!box) return;
      var list = shown();
      box.innerHTML = failed ? H.error(failed) : list.length ? '<ul class="acc-evs">' + list.map(evRow).join('') + '</ul>'
        : loading ? '<p class="hint">Завантажуємо…</p>' : H.empty('За цей час подій немає', 'Спробуйте довший період або інший розділ.');
      var m = q(ctx.el, '[data-lg-more]');
      m.hidden = !more || failed; m.disabled = loading;
      q(ctx.el, '[data-lg-n]').textContent = flt.q.trim() && items.length ? 'Знайдено ' + list.length + ' із завантажених ' + items.length : '';
    }
    function draw() {
      ctx.el.innerHTML = '<section class="adm-col">' +
        A.head('Журнал входів', (flt.days === 1 ? 'за останню добу' : 'за ' + flt.days + ' днів') + ' · ' + A.asOf()) + P.admLogin.subnav('log') +
        '<div class="acc-filters">' + pills('lg-days', DAYS, flt.days, 'Період') + pills('lg-kind', KINDS, flt.kind, 'Розділ') + '</div>' +
        '<div class="adm-tools"><label class="search adm-search">' + P.ic('search', 'icon') + '<input class="input input--search" type="search" data-input="lg-q" value="' + esc(flt.q) + '" placeholder="Імʼя, Slack ID або подія" aria-label="Пошук у журналі"></label>' +
          (whoId ? '<button class="chip-pick chip-pick--on" type="button" data-act="lg-unwho" aria-label="Показати події всіх людей">× ' + esc(whoName || 'Людина') + '</button>' : '') + '</div>' +
        '<section class="card adm-flat"><p class="hint" data-lg-n></p><div data-lg-list></div>' +
          '<div class="acc-more"><button class="btn btn--secondary" type="button" data-act="lg-more" data-lg-more hidden>Показати ще</button></div></section>' +
        '<p class="hint">Журнал зберігається 6 місяців. Slack ID показано скорочено.</p></section>';
      drawList();
    }
    function fetchPage(reset) {
      var my = ++seq;
      if (reset) { items = []; more = false; nextId = null; }
      loading = true; failed = null; drawList();
      API.log({ days: flt.days, kind: flt.kind, userId: whoId, beforeId: reset ? undefined : nextId, limit: PAGE }).then(function (r) {
        if (!ctx.alive() || my !== seq) return;
        loading = false;
        if (!r || !r.ok) { failed = r || { ok: false, code: 'server', error: 'Не вдалося отримати журнал.' }; drawList(); return; }
        items = items.concat(r.items || []); more = !!r.more; nextId = r.nextBeforeId;
        if (whoId && !whoName) {   // імʼя для чипа — з перших подій, де ця людина є
          items.some(function (e) { var x = [e.who, e.actor, e.target].filter(function (y) { return y && y.id === whoId && y.name; })[0]; if (x) whoName = x.name; return !!x; });
          if (whoName) { var chip = q(ctx.el, '[data-act="lg-unwho"]'); if (chip) chip.textContent = '× ' + whoName; }
        }
        drawList();
      });
    }
    function mark(attr, v) {
      qa(ctx.el, '[data-act="' + attr + '"]').forEach(function (b) { var on = String(b.getAttribute('data-v')) === String(v); b.classList.toggle('pill--on', on); b.setAttribute('aria-pressed', on); });
    }

    ctx.on('lg-days', function (t) { flt.days = +t.getAttribute('data-v'); mark('lg-days', flt.days); q(ctx.el, '.h2-sub').textContent = (flt.days === 1 ? 'за останню добу' : 'за ' + flt.days + ' днів') + ' · ' + A.asOf(); fetchPage(true); });
    ctx.on('lg-kind', function (t) { flt.kind = t.getAttribute('data-v'); mark('lg-kind', flt.kind); fetchPage(true); });
    ctx.on('lg-q', function (t) { flt.q = t.value; drawList(); });
    ctx.on('lg-more', function () { if (!loading && more) fetchPage(false); });
    ctx.on('lg-unwho', function () { ctx.go('/slack-login/log'); });
    draw();
    fetchPage(true);
    if (whoId) {   // імʼя людини для чипа, якщо в її подіях імені ще немає (напр. подій не було)
      API.list().then(function (r) {
        var u = r && r.ok ? (r.items || []).filter(function (x) { return x.id === whoId; })[0] : null;
        if (!ctx.alive() || !u) return;
        whoName = u.name; var chip = q(ctx.el, '[data-act="lg-unwho"]'); if (chip) chip.textContent = '× ' + u.name;
      });
    }
  } });
})(window);
