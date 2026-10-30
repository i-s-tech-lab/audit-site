(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  if (!P.srAnParts || !P.sr) return;   // без екрана аналітики (тести без сторінки) блок не потрібен
  var h = P.sr.h, esc = P.esc, A = P.srAn, X = P.srAnParts;
  var last = null, req = 0, timer = null;   // останній екран (view), лічильник запитів, відкладене перемальовування

  function visible() { return !!(X.layout && X.layout.visible('watch')); }
  function box(view) { return view.box('an-watch'); }

  function head(view, sub) {
    return '<div class="card-head an-bh"><div style="flex:1;min-width:220px"><h2 class="card-title">Стежу · ' + esc(view.scope()) + A.q('sr.an.watch') + '</h2>' +
      '<p class="hint">' + sub + '</p></div>' + (X.layout ? X.layout.box('watch') : '') + '</div>';
  }
  function col(key, title, rows) {
    if (!rows.length) return '';
    return '<div class="srw__col"><h3 class="an-h3">' + esc(title) + ' · ' + rows.length + '</h3>' +
      A.fold('an:watch:' + key, rows.length, '<div class="list fold__list">' + rows.join('') + '</div>') + '</div>';
  }
  function row(main, meta, href) {
    var inner = '<span class="row-item__main"><span class="row-item__title">' + esc(main) + '</span><span class="row-item__meta">' + meta + '</span></span>';
    return href ? '<a class="row-item" href="' + href + '">' + inner + '</a>' : '<div class="row-item">' + inner + '</div>';
  }
  function pcs(n) { return h.num(n) + ' шт'; }

  function draw(view) {
    last = view;
    var el = box(view), my = ++req;
    if (!el) return;
    if (!visible()) { el.innerHTML = ''; return; }   // у буфері: нічого не малюємо й сервер не кличемо
    var S = P.srStars, stars = { type: S.all('type'), worker: S.all('worker'), product: S.all('product'), order: S.all('order') };
    var any = Object.keys(stars).some(function (k) { return stars[k].length; });
    var sub = esc(A.span(view.ctx.period.from, view.ctx.period.to));
    if (!any) {
      el.innerHTML = head(view, sub) + '<p class="srw__empty">Позначте зірочкою вид браку, працівника, виріб чи замовлення — тут зʼявляться їхні числа за період.</p>';
      return;
    }
    el.innerHTML = head(view, sub) + h.loading();
    P.srv('srWatch', { locationId: view.ctx.loc.id, from: view.ctx.period.from, to: view.ctx.period.to, departmentId: view.dep, stars: stars }).then(function (r) {
      if (!view.ctx.alive() || my !== req || !visible()) return;
      if (!r.ok) {
        el.innerHTML = head(view, sub) + '<div class="ui-state ui-state--error" role="alert"><p class="ui-state__title">Не вдалося завантажити</p><p class="ui-state__text">' + esc(r.error || 'Перевірте звʼязок і спробуйте ще раз.') + '</p>' +
          '<button class="btn btn--secondary btn--sm" type="button" data-act="an-watch-retry">' + h.ic('refresh', 'ui-icon--sm') + 'Спробувати ще раз</button></div>';
        return;
      }
      var q = view.dep ? '?dep=' + encodeURIComponent(view.dep) : '';
      var cols = col('type', 'Види браку', r.types.map(function (t) { return row(t.name, 'брак ' + pcs(t.pieces) + ' за період', '#/analytics/defect/' + encodeURIComponent(t.id) + q); })) +
        col('worker', 'Працівники', r.workers.map(function (w) { return row(w.name, 'брак ' + pcs(w.pieces) + ' · перевірено ' + pcs(w.checked)); })) +
        col('product', 'Вироби', r.products.map(function (p) { return row(p.name, 'брак ' + pcs(p.pieces)); })) +
        col('order', 'Замовлення', r.orders.map(function (o) { return row(o.no, 'перевірено ' + pcs(o.checked) + ' · брак ' + pcs(o.pieces)); }));
      el.innerHTML = head(view, sub + ' · замовлення — за весь час замовлення') +
        (cols ? '<div class="srw">' + cols + '</div>' : '<p class="srw__empty">Позначених зірочкою позицій у цій локації не знайдено.</p>');
    });
  }

  function redraw() { if (last && last.ctx.alive()) draw(last); }

  X.watch = {
    draw: draw,
    redraw: redraw,
    bind: function (view) {
      last = view;
      view.ctx.on('an-watch-retry', function () { draw(view); });
    }
  };

  if (P.on) P.on('stars:changed', function () {
    if (!last || !visible()) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { timer = null; redraw(); }, 300);
  });
})(typeof window !== 'undefined' ? window : globalThis);
