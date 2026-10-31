(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, K = P.mgr;
  var KD_TITLE = 'Коригуючу дію закрито без участі старшого';
  var NOT_ON = 'Вимкнено адміністратором — поки він не ввімкне, не надсилається';

  function sw(on, id, title) {
    var label = (on ? 'Увімкнено' : 'Вимкнено') + ' · ' + title;
    return '<button class="toggle mgr-sw' + (on ? ' toggle--on' : '') + '" type="button" role="switch" aria-checked="' + on + '" aria-label="' + esc(label) +
      '" title="' + esc(label) + '" data-act="mgr-n-on" data-id="' + esc(id) + '"></button>';
  }
  function pen(id, title) { return '<button class="icon-btn" type="button" data-act="mgr-n-edit" data-id="' + esc(id) + '" aria-label="' + esc('Редагувати: ' + title) + '" title="Редагувати">' + P.ic('edit') + '</button>'; }
  function names(list) { return list.map(function (l) { return l.name; }); }
  function choices(data, it) { return it && it.ruleLocs && it.ruleLocs !== 'all' ? it.ruleLocs : data.locations; }
  function locsLine(data, it) {
    var pool = choices(data, it);
    if (it.locs === 'all') return pool === data.locations ? 'усі мої (і нові теж)' : 'усі, що є в розсилці (' + names(pool).join(', ') + ')';
    var list = data.locations.filter(function (l) { return it.locs.indexOf(l.id) >= 0; });
    return list.length ? names(list).join(', ') : '—';
  }
  function field(f, label, inner, key) { return '<div class="field" data-f="' + f + '"><span class="label">' + esc(label) + (key ? K.help(key) : '') + '</span>' + inner + '</div>'; }
  function showErrors(el, r) {
    Array.prototype.forEach.call(el.querySelectorAll('.mgr-err'), function (e) { e.remove(); });
    var shown = 0;
    (r.errors || []).forEach(function (e) {
      var f = el.querySelector('[data-f="' + e.field + '"]');
      if (f) { f.insertAdjacentHTML('beforeend', '<p class="err mgr-err" role="alert">' + esc(e.message) + '</p>'); shown++; }
    });
    if (!shown) P.toast('danger', 'Не збережено', (r.errors && r.errors[0] ? r.errors[0].message : r.error) || '');
  }

  P.mgrNotifyUi = { create: function (ctx) {
    var data = null, failed = null;
    function find(id) { return id === 'kd-self' ? (data.kdSelf ? { id: id, title: KD_TITLE, enabled: data.kdSelf.enabled, locs: data.kdSelf.locs, ruleLocs: 'all' } : null) : data.rules.filter(function (r) { return r.id === id; })[0] || null; }
    function entry(it, kd) {
      var addressed = !kd && it.addressed, when = kd ? 'щойно коригуючу дію закрито без участі старшого аудитора' : it.when;
      return '<div class="entry mgr-entry"><div class="entry__head"><h3 class="entry__title' + (it.enabled ? '' : ' mgr-off') + '">' + esc(it.title) + (kd ? K.help('mgr.ntf.kd') : '') +
        (addressed ? ' <span class="badge">адмін надсилає вам</span>' : '') + '</h3>' + sw(it.enabled, it.id, it.title) + pen(it.id, it.title) + '</div>' +
        (!kd && !it.ruleOn ? '<p class="hint mgr-ntf-note">' + NOT_ON + '</p>' : '') +
        '<dl class="kv"><dt>Коли</dt><dd>' + esc(when || '—') + '</dd><dt>Локації' + K.help('mgr.ntf.locs') + '</dt><dd>' + esc(locsLine(data, it)) + '</dd></dl></div>';
    }
    function inner() {
      if (failed) return P.sr.h.error(failed);
      if (!data) return '<p class="hint">Завантажуємо сповіщення…</p>';
      var kd = data.kdSelf ? entry({ id: 'kd-self', title: KD_TITLE, enabled: data.kdSelf.enabled, locs: data.kdSelf.locs, ruleLocs: 'all' }, true) : '';
      return '<div class="mgr-ntf-head"><h3 class="mgr-ntf-h">Надсилаються зараз' + K.help('mgr.ntf.now') + '</h3>' +
        (data.sending ? '' : '<p class="hint">У тестовій версії сповіщення не надсилаються</p>') + '</div>' +
        (kd ? '<section class="card">' + kd + '</section>' : '') +
        '<h4 class="mgr-ntf-sub">Розсилки адміністратора · ' + data.rules.length + K.help('mgr.ntf.rules') + '</h4>' +
        (data.rules.length ? '<section class="card">' + data.rules.map(function (r) { return entry(r, false); }).join('') + '</section>'
          : '<p class="hint mgr-ntf-empty">Для ваших локацій розсилок поки немає — їх створює адміністратор у «Розсилках».</p>');
    }
    function refresh() { var h = ctx.el.querySelector('[data-ntf]'); if (h && ctx.alive()) h.innerHTML = inner(); }
    function save(id, enabled, locs, fact, layer, btn) {
      if (btn) btn.disabled = true;
      return P.srv('mgrNotifySave', { id: id, enabled: enabled, locs: locs }).then(function (r) {
        if (btn) btn.disabled = false;
        if (!r.ok) {
          if (r.code === 'validation' && layer) showErrors(layer.el, r);
          else if (r.code !== 'forbidden') P.toast('danger', 'Не вдалося зберегти', (r.errors && r.errors[0] ? r.errors[0].message : r.error) || '');
          return;
        }
        data = r;
        if (layer) layer.close();
        refresh();
        P.toast('ok', 'Збережено · ' + fact);
      });
    }
    function openEdit(id) {
      var it = find(id), pool = choices(data, it), locs = it.locs === 'all' ? 'all' : it.locs.slice();
      function body() {
        var all = locs === 'all';
        return '<div class="mgr-form">' + field('locs', 'З яких локацій', '<div class="chips"><button class="chip-pick' + (all ? ' chip-pick--on' : '') + '" type="button" aria-pressed="' + all + '" data-act="mgr-n-all">' +
          (all ? P.ic('check', 'ui-icon--sm') : '') + 'Усі мої (і нові теж)</button>' + pool.map(function (l) {
          var on = !all && locs.indexOf(l.id) >= 0;
          return '<button class="chip-pick' + (on ? ' chip-pick--on' : '') + '" type="button" aria-pressed="' + on + '" data-act="mgr-n-loc" data-id="' + esc(l.id) + '">' +
            (on ? P.ic('check', 'ui-icon--sm') : '') + esc(l.name) + '</button>'; }).join('') + '</div>', 'mgr.ntf.locs') +
          '<p class="hint">' + (all ? 'Сповіщення надходять про всі ваші локації, і про нові теж.' : 'Обрано ' + locs.length + ' з ' + pool.length + '. Потрібна хоча б одна.') + '</p></div>';
      }
      P.sr.modal({ size: 'sm', title: it.title, sub: 'Про які з ваших локацій надсилати це сповіщення', body: body(),
        foot: '<span style="flex:1"></span><button class="btn btn--quiet" type="button" data-ov-close>Скасувати</button>' +
          '<button class="btn btn--primary" type="button" data-act="mgr-n-save">' + P.ic('save', 'ui-icon--sm') + 'Зберегти</button>',
        on: {
          'mgr-n-all': function (t, e, ly) { locs = 'all'; ly.body(body()); },
          'mgr-n-loc': function (t, e, ly) {
            var lid = t.getAttribute('data-id');
            if (locs === 'all') locs = [];
            var i = locs.indexOf(lid);
            if (i >= 0) locs.splice(i, 1); else locs.push(lid);
            ly.body(body());
          },
          'mgr-n-save': function (t, e, ly) {
            var list = locs === 'all' ? [] : pool.filter(function (l) { return locs.indexOf(l.id) >= 0; });
            save(id, it.enabled, locs, it.title + ' · ' + (locs === 'all' ? 'усі мої (і нові теж)' : names(list).join(', ') || '—'), ly, t);
          }
        } });
    }
    ctx.on('mgr-n-on', function (t) {
      var id = t.getAttribute('data-id'), it = data ? find(id) : null;
      if (it) return save(id, !it.enabled, it.locs, it.title + (it.enabled ? ' вимкнено' : ' увімкнено'), null, t);
    });
    ctx.on('mgr-n-edit', function (t) { if (data && find(t.getAttribute('data-id'))) openEdit(t.getAttribute('data-id')); });
    return {
      html: function () { return '<section class="mgr-ntf" data-ntf>' + inner() + '</section>'; },
      load: function () {
        return P.srv('mgrNotify', {}).then(function (r) {
          if (!ctx.alive()) return;
          if (!r.ok) failed = r; else { data = r; failed = null; }
          refresh();
        });
      }
    };
  } };
})(window);
