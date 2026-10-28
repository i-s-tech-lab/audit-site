(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, H = P.sr.h, A = P.adm, da = A.da, q = A.q;
  var KEEP_DAYS = 183;
  var PRESETS = [[1, 'Сьогодні'], [7, '7 днів'], [30, '30 днів'], [180, '180 днів']];
  var APPS = { pratsivnyk: 'Додаток працівника', starshyi: 'Кабінет старшого', kerivnyk: 'Кабінет керівника', admin: 'Кабінет адміністратора' };
  var flt = { days: 7, from: '', to: '', who: '', whoName: '', loc: '', kind: '' };

  function period() {
    var today = P.cab.today();
    return flt.days ? { from: P.cab.addDays(today, -(flt.days - 1)), to: today } : { from: flt.from, to: flt.to };
  }
  function periodText(r) {
    if (flt.days === 1) return 'за сьогодні';
    if (flt.days) return 'за ' + flt.days + ' днів';
    var f = r ? r.from : flt.from, t = r ? r.to : flt.to;
    return f === t ? 'за ' + H.dayShort(f) : 'з ' + H.dayShort(f) + ' по ' + H.dayShort(t);
  }
  function minAgo(iso, asOf) {
    var m = Math.floor((Date.parse(asOf) - Date.parse(iso)) / 60000);
    return m < 1 ? 'щойно' : m + ' хв тому';
  }
  function roleText(code) { return code ? (P.accessApi ? P.accessApi.roleText(code) : code) : 'немає в списку'; }

  P.cab.tab({ id: 'activity', label: 'Активність', ic: 'clock', path: '/activity', order: 45 });
  P.cab.screen('/activity', { tab: 'activity', title: 'Активність', render: function (ctx) {
    var online = null, data = null, items = [], loading = false, failed = null, seq = 0;
    var locs = (ctx.me.allLocations || ctx.me.locations || []).map(function (l) { return { id: l.id, name: l.name }; });

    function kpis() {
      var s = data.stats;
      return '<div class="kpis">' + A.kpi(H.num(online.items.length), 'онлайн зараз', 'admin.activity.online') +
        A.kpi(H.num(s.events), 'подій за період', 'admin.activity.events') + A.kpi(H.num(s.changes), 'змін даних', 'admin.activity.changes') +
        A.kpi(H.num(s.logins), 'входів', 'admin.activity.logins') + '</div>';
    }
    function onlineCard() {
      var list = online.items;
      return '<section class="card"><h3 class="adm-card-t">' + P.ic('people', 'ui-icon--sm') + 'Онлайн зараз' + A.help('admin.activity.online') +
        '<span class="adm-dim adm-ac-t-sub">останні 15 хв · ' + esc(P.fmt.time(online.asOf)) + '</span></h3>' +
        (list.length ? '<ul class="adm-ac-online">' + list.map(function (x) {
          return '<li class="adm-ac-on"><span class="avatar" aria-hidden="true">' + esc(P.initials(x.name)) + '</span><div class="adm-ac-on__main"><b>' + esc(x.name) + '</b>' +
            '<span class="adm-person__meta">' + esc([x.roleLabel, x.appLabel, x.locationName].filter(Boolean).join(' · ')) + '</span></div>' +
            '<span class="adm-ac-on__ago">' + esc(minAgo(x.lastAt, online.asOf)) + '</span></li>';
        }).join('') + '</ul>' : '<p class="hint">Зараз нікого: за останні 15 хвилин ніхто нічого не робив в Аудиті.</p>') + '</section>';
    }
    function pills() {
      return '<nav class="pills acc-pills" aria-label="Період">' + PRESETS.map(function (x) {
        return '<button class="pill' + (x[0] === flt.days ? ' pill--on' : '') + '" type="button" data-act="ac-days"' + da('v', x[0]) + ' aria-pressed="' + (x[0] === flt.days) + '">' + esc(x[1]) + '</button>';
      }).join('') + '</nav>';
    }
    function dateInput(name, label, v, min, max) {
      return A.field(name, label, '<input class="input adm-ac-date" type="date" name="' + name + '" value="' + esc(v) + '" min="' + min + '" max="' + max + '">');
    }
    function filters() {
      var pr = period(), today = P.cab.today(), min = P.cab.addDays(today, -(KEEP_DAYS - 1));
      var people = data.people.slice();
      if (flt.who && !people.some(function (x) { return x.id === flt.who; })) people.unshift({ id: flt.who, name: flt.whoName || 'Обрана людина' });
      var all = data.kinds.reduce(function (n, k) { return n + k.count; }, 0);
      function chip(id, label, count, key) {
        return '<span class="adm-ac-kind"><button class="chip-pick' + (flt.kind === id ? ' chip-pick--on' : '') + '" type="button" data-act="ac-kind"' + da('v', id) +
          ' aria-pressed="' + (flt.kind === id) + '">' + esc(label) + '<small>' + H.num(count) + '</small></button>' + (key ? A.help(key) : '') + '</span>';
      }
      return '<section class="card adm-ac-filters" data-ac-filters>' +
        '<div class="adm-ac-row"><span class="label">Період' + A.help('admin.activity.period') + '</span>' + pills() + '</div>' +
        '<div class="adm-ac-dates">' + dateInput('from', 'З', pr.from, min, today) + dateInput('to', 'По', pr.to, min, today) +
          '<button class="btn btn--secondary" type="button" data-act="adm-save">' + P.ic('calendar', 'ui-icon--sm') + 'Показати</button></div>' +
        '<div class="adm-tools">' +
          '<label class="adm-ac-sel"><span class="label">Людина' + A.help('admin.activity.who') + '</span><select class="input adm-select" data-change="ac-who" aria-label="Людина">' +
            '<option value="">Усі люди</option>' + people.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === flt.who ? ' selected' : '') + '>' + esc(x.name) + '</option>'; }).join('') + '</select></label>' +
          '<label class="adm-ac-sel"><span class="label">Локація' + A.help('admin.activity.location') + '</span><select class="input adm-select" data-change="ac-loc" aria-label="Локація">' +
            '<option value="">Усі локації</option>' + locs.map(function (l) { return '<option value="' + esc(l.id) + '"' + (l.id === flt.loc ? ' selected' : '') + '>' + esc(l.name) + '</option>'; }).join('') + '</select></label></div>' +
        '<div class="adm-chips" role="group" aria-label="Вид подій">' + chip('', 'Усе', all, 'admin.activity.kind') +
          data.kinds.map(function (k) { return chip(k.id, k.label, k.count, 'admin.activity.kind.' + k.id); }).join('') + '</div></section>';
    }
    function row(x, i) {
      var change = x.from != null || x.to != null ? ': <span class="adm-dim">' + esc(x.from == null ? '—' : x.from) + '</span> → <b>' + esc(x.to == null ? '—' : x.to) + '</b>' : '';
      return '<li class="adm-log__item adm-ac-ev adm-ac-ev--' + esc(x.kind) + '"><button class="adm-ac-ev__btn" type="button" data-act="ac-open"' + da('i', i) + ' aria-expanded="false">' +
        '<span class="adm-log__top"><b>' + esc(x.who.name) + '</b><span class="adm-dim">' + esc(P.fmt.time(x.at) + ' · ' + x.area + ' · ' + x.target) + '</span></span>' +
        '<span class="adm-log__what">' + esc(x.what) + change + '</span></button><div class="adm-ac-ev__more" data-ac-more="' + i + '" hidden></div></li>';
    }
    function details(x) {
      var kind = data.kinds.filter(function (k) { return k.id === x.kind; })[0];
      var rows = [['Коли', H.dayLong(P.fmt.dayKey(x.at)) + ', ' + P.fmt.time(x.at)], ['Хто', x.who.name + ' · ' + roleText(x.who.role)], ['Вид', kind ? kind.label : x.kind]];
      if (x.locationName) rows.push(['Локація', x.locationName]);
      if (x.app) rows.push(['Де', APPS[x.app] || x.app]);
      (x.details || []).forEach(function (d) { rows.push(d); });
      return '<dl class="kv">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>';
    }
    function emptyHtml() {
      var on = [], loc = locs.filter(function (l) { return l.id === flt.loc; })[0], kind = data.kinds.filter(function (k) { return k.id === flt.kind; })[0];
      if (flt.who) on.push('людина: ' + (flt.whoName || '—'));
      if (loc) on.push('локація: ' + loc.name);
      if (kind) on.push('вид: ' + kind.label.toLowerCase());
      var text = on.length ? 'Обрано ' + on.join(' · ') + '.' : 'За цей період у журналах немає жодної події.';
      return P.state.empty('clock', 'Подій ' + periodText(data) + ' немає', text,
        on.length ? '<button class="btn btn--secondary btn--sm" type="button" data-act="ac-clear">' + P.ic('close', 'ui-icon--sm') + 'Зняти фільтри</button>' : '');
    }
    function feedHtml() {
      if (failed) return H.error(failed);
      if (!items.length) return emptyHtml();
      var out = '', day = null;
      items.forEach(function (x, i) {
        var d = P.fmt.dayKey(x.at);
        if (d !== day) { out += (day ? '</ol>' : '') + '<h3 class="adm-ac-day">' + esc(H.dayLong(d)) + '</h3><ol class="adm-log">'; day = d; }
        out += row(x, i);
      });
      return out + '</ol>';
    }
    function drawFeed() {
      var box = q(ctx.el, '[data-ac-feed]'); if (!box) return;
      box.innerHTML = feedHtml();
      var more = q(ctx.el, '[data-ac-moreall]'), n = q(ctx.el, '[data-ac-n]');
      more.hidden = !!failed || data.page >= data.pages; more.disabled = loading;
      n.textContent = items.length && !failed ? 'Показано ' + H.num(items.length) + ' з ' + H.num(data.total) : '';
    }
    function draw() {
      ctx.el.innerHTML = '<section class="adm-col adm-ac">' + A.head('Активність', periodText(data) + ' · ' + A.asOf(), '', 'admin.activity.title') +
        kpis() + onlineCard() + filters() +
        '<section class="card adm-flat"><h3 class="adm-card-t">' + P.ic('scroll', 'ui-icon--sm') + 'Стрічка подій' + A.help('admin.activity.feed') + '</h3>' +
          '<p class="hint" data-ac-n></p><div data-ac-feed></div>' +
          '<div class="acc-more"><button class="btn btn--secondary" type="button" data-act="ac-more" data-ac-moreall hidden>Показати ще</button></div></section>' +
        '<p class="hint">Журнали зберігаються 6 місяців (183 дні) — старіші події зникають самі.' + A.help('admin.activity.keep') + '</p></section>';
      A.enterSubmits(q(ctx.el, '[data-ac-filters]'));
      drawFeed();
    }

    function fetchFeed(page) {
      var my = ++seq, pr = period();
      loading = true; failed = null;
      if (page === 1 && data) { var box = q(ctx.el, '[data-ac-feed]'); if (box) box.innerHTML = H.loading(); }
      return P.srv('admActivity', { from: pr.from, to: pr.to, who: flt.who, locationId: flt.loc, kind: flt.kind, page: page }).then(function (r) {
        if (!ctx.alive() || my !== seq) return;
        loading = false;
        if (!r || !r.ok) {
          if (r && r.code === 'validation' && data) { A.showErrors(q(ctx.el, '[data-ac-filters]'), r); drawFeed(); return; }
          failed = r || { ok: false, error: 'Не вдалося отримати стрічку.' };
          if (!data) { ctx.el.innerHTML = H.error(failed); return; }
          drawFeed(); return;
        }
        var person = r.people.filter(function (x) { return x.id === flt.who; })[0];
        if (person) flt.whoName = person.name;
        items = page === 1 ? r.items : items.concat(r.items); data = r;
        if (page === 1) draw(); else drawFeed();
      });
    }
    function refetch() { fetchFeed(1); }

    ctx.on('ac-days', function (t) { flt.days = +t.getAttribute('data-v'); refetch(); });
    ctx.on('adm-save', function () {
      var box = q(ctx.el, '[data-ac-filters]'), f = A.val(box, 'from'), t = A.val(box, 'to');
      if (!f || !t) { A.showErrors(box, { ok: false, code: 'validation', errors: [{ field: f ? 'to' : 'from', message: 'Оберіть дату.' }] }); return; }
      if (f > t) { A.showErrors(box, { ok: false, code: 'validation', errors: [{ field: 'to', message: 'Дата «по» — не раніше за дату «з».' }] }); return; }
      flt.days = null; flt.from = f; flt.to = t; refetch();
    });
    ctx.on('ac-who', function (t) { flt.who = t.value; flt.whoName = t.value ? t.options[t.selectedIndex].text : ''; refetch(); });
    ctx.on('ac-loc', function (t) { flt.loc = t.value; refetch(); });
    ctx.on('ac-kind', function (t) { flt.kind = t.getAttribute('data-v'); refetch(); });
    ctx.on('ac-clear', function () { flt.who = ''; flt.whoName = ''; flt.loc = ''; flt.kind = ''; refetch(); });
    ctx.on('ac-more', function () { if (!loading && data && data.page < data.pages) fetchFeed(data.page + 1); });
    ctx.on('ac-open', function (t) {
      var i = +t.getAttribute('data-i'), box = q(ctx.el, '[data-ac-more="' + i + '"]'), open = t.getAttribute('aria-expanded') !== 'true';
      if (!box || !items[i]) return;
      if (open && !box.innerHTML) box.innerHTML = details(items[i]);
      box.hidden = !open; t.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    P.srv('admOnline', {}).then(function (r) {
      if (!ctx.alive()) return;
      if (!r || !r.ok) { ctx.el.innerHTML = H.error(r); return; }
      online = r;
      fetchFeed(1);
    });
  } });
})(window);
