(function (root) {
  'use strict';
  var P = root.P = root.P || {}, esc = P.esc;
  var Q = { d: 'відділ', o: 'замовлення', p: 'вироби' };   // що саме підставляємо (літера в адресі → слово)

  function uniq(list) { return list.filter(function (x, i) { return list.indexOf(x) === i; }); }

  function plan(a, fc) {
    var dep = fc.departments.filter(function (d) { return d.id === a.departmentId; })[0] || null;
    var known = {};
    fc.orders.forEach(function (o) { known[o.no] = true; });
    var orders = uniq((a.orders || []).filter(function (o) { return known[o]; }));
    var prods = dep ? uniq((a.items || []).map(function (i) { return i.productId; })).filter(function (id) {
      return fc.products.some(function (p) { return p.id === id && p.deptTypeId === dep.deptTypeId; });
    }) : [];
    return { dep: dep, orders: orders, products: prods,
      prodNames: prods.map(function (id) { return fc.products.filter(function (p) { return p.id === id; })[0].name; }) };
  }

  function steps(pl, ans) {
    var out = [];
    if (pl.dep) out.push('d');
    if (pl.orders.length) out.push('o');
    if (pl.dep && pl.products.length && ans.d !== false) out.push('p');
    return out;
  }

  function question(k, pl) {
    if (k === 'd') return 'Підставити відділ «' + pl.dep.name + '»?';
    if (k === 'o') return 'Підставити замовлення «' + pl.orders.join(', ') + '»?';
    return 'Підставити вироби «' + pl.prodNames.join(', ') + '»?';
  }

  function open(auditId, ctx) {
    var sh = P.sheet.open({ title: 'Повторити минулий', body: P.state.loading() });
    var body = sh.el.querySelector('.sheet__body'), data = null, ans = {}, at = 0;

    function paint(html) { if (sh.el.isConnected) body.innerHTML = '<div class="rep">' + html + '</div>'; }

    function nothing() {
      var other = data.a.locationId !== ctx.loc;
      paint('<p class="rep__text">' + (other ? 'Минулий аудит був у локації «' + esc(data.a.locationName) + '» — тут підставити нічого не вийде.'
        : 'З минулого аудиту тут підставити нічого не вийде: його відділу, замовлень і виробів уже немає в цій локації.') + '</p>' +
        '<div class="rep__acts"><button type="button" class="ui-btn ui-btn--primary" data-rep="new">' + P.ic('add') + 'Новий аудит</button></div>');
    }
    function ask(list) {
      var k = list[at];
      paint('<p class="rep__step">Крок ' + (at + 1) + ' з ' + list.length + P.help.btn('w.home.repeat') + '</p><p class="rep__q">' + esc(question(k, data.pl)) + '</p>' +
        '<div class="rep__acts"><button type="button" class="ui-btn ui-btn--primary" data-rep="yes">Так, підставити</button>' +
        '<button type="button" class="ui-btn ui-btn--secondary" data-rep="no">Ні</button>' +
        (at > 0 ? '<button type="button" class="ui-btn ui-btn--quiet" data-rep="back">' + P.ic('arrow-left') + 'Назад</button>' : '') + '</div>');
    }
    function summary(list) {
      var take = list.filter(function (k) { return ans[k]; }), pl = data.pl;
      var items = take.map(function (k) {
        var what = k === 'd' ? pl.dep.name : k === 'o' ? pl.orders.join(', ') : pl.prodNames.join(', ');
        return '<li><b>' + esc(Q[k].charAt(0).toUpperCase() + Q[k].slice(1)) + ':</b> ' + esc(what) + '</li>';
      }).join('');
      paint('<p class="rep__q">' + (take.length ? 'Буде підставлено' : 'Нічого не підставляємо') + '</p>' +
        (take.length ? '<ul class="rep__sum">' + items + '</ul>' : '<p class="rep__text">Форма буде порожня, як у новому аудиті.</p>') +
        '<p class="rep__text">Скільки перевірили, брак, працівників і коментар впишете самі.</p>' +
        '<div class="rep__acts"><button type="button" class="ui-btn ui-btn--primary" data-rep="start">' + P.ic('add') + 'Почати аудит</button>' +
        '<button type="button" class="ui-btn ui-btn--quiet" data-rep="back">' + P.ic('arrow-left') + 'Назад</button></div>');
    }
    function render() {
      var list = steps(data.pl, ans);
      if (!list.length) return nothing();
      if (at >= list.length) at = list.length;
      if (at === list.length) return summary(list);
      ask(list);
    }
    function load() {
      body.innerHTML = P.state.loading();
      Promise.all([P.srv('auditGet', { id: auditId }), P.srv('auditFormContext', { locationId: ctx.loc })]).then(function (rs) {
        if (!sh.el.isConnected) return;   // вікно вже закрили
        var bad = !rs[0].ok ? rs[0] : !rs[1].ok ? rs[1] : null;
        if (bad) {
          body.innerHTML = P.state.error('Не вдалося завантажити', bad.error);
          var retry = body.querySelector('[data-act="retry"]');
          if (retry) retry.onclick = load;
          return;
        }
        data = { a: rs[0].audit, pl: plan(rs[0].audit, rs[1]) };
        ans = {}; at = 0;
        render();
      });
    }

    P.delegate(body, 'click', '[data-rep]', function (e, t) {
      var act = t.getAttribute('data-rep'), list = data ? steps(data.pl, ans) : [];
      if (act === 'new') { sh.close(); return P.router.go('/audit/new', { loc: ctx.loc }); }
      if (act === 'yes' || act === 'no') { ans[list[at]] = act === 'yes'; at++; return render(); }
      if (act === 'back') { at = Math.max(0, at - 1); return render(); }
      if (act === 'start') {
        var take = list.filter(function (k) { return ans[k]; });
        sh.close();
        P.router.go('/audit/new', { loc: ctx.loc, dep: ans.d ? data.a.departmentId : '', rep: take.length ? auditId : '', take: take.join(',') });
      }
    });
    load();
    return sh;
  }

  P.auditRepeat = { open: open };
})(typeof window !== 'undefined' ? window : globalThis);
