(function (root) {
  'use strict';
  var P = root.P = root.P || {};

  var NOBODY_NAME = 'Імʼя зі Slack не отримано';
  var DM_SENT = 'Їй у Slack надіслано кнопку «Увійти в Аудит».';
  var DM_FAILED = 'Повідомлення в Slack не вдалося надіслати — попросіть людину натиснути «Увійти в Аудит» у Slack (додаток «Аудит якості», вкладка «Головна»).';

  function rel(iso) {
    var t = Date.parse(iso);
    if (!iso || isNaN(t)) return '';
    var m = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (m < 1) return 'щойно';
    if (m < 60) return m + ' хв тому';
    if (m < 1440) return Math.floor(m / 60) + ' год тому';
    var d = Math.floor(m / 1440);
    return d + ' ' + (d % 10 === 1 && d % 100 !== 11 ? 'день' : d % 10 >= 2 && d % 10 <= 4 && (d % 100 < 12 || d % 100 > 14) ? 'дні' : 'днів') + ' тому';
  }
  function mask(id) { return P.authSlack && P.authSlack.maskId ? P.authSlack.maskId(id) : String(id); }

  function avatar(rq) {
    var esc = P.esc, photo = typeof rq.photo === 'string' && /^data:image\/(jpeg|png|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(rq.photo) ? rq.photo : '';
    return '<span class="avatar" aria-hidden="true" style="flex:none;overflow:hidden">' +
      (photo ? '<img src="' + photo + '" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">' : esc(rq.name && P.initials ? P.initials(rq.name) : '?')) + '</span>';
  }
  function sourceText(rq) {
    var s = rq.source || null;
    if (!s || !s.kind) return '';
    if (s.kind === 'channel') return s.channel ? 'натиснув кнопку в #' + s.channel : 'натиснув кнопку в каналі Slack';
    if (s.kind === 'home') return 'натиснув кнопку в додатку «Аудит якості» у Slack';
    if (s.kind === 'dm') return 'натиснув кнопку в особистих повідомленнях Slack';
    if (s.kind === 'oidc') return 'натиснув «Увійти через Slack» на сайті';
    return '';
  }
  function row(rq) {
    var esc = P.esc, when = rel(rq.createdAt), where = sourceText(rq), id = esc(rq.id);
    return '<div class="tr-row" style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 0;border-top:1px solid var(--line)">' +
      '<div style="display:flex;align-items:center;gap:12px;min-width:0">' + avatar(rq) +
        '<div style="min-width:0"><b>' + esc(rq.name || NOBODY_NAME) + '</b><p class="hint" style="margin:2px 0 0">' + esc(mask(rq.slackId)) + ' · ' +
        esc(where || 'просить увійти') + (when ? ' · ' + esc(when) : '') + '</p></div></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn--primary btn--sm" type="button" data-act="tr-add" data-id="' + id + '">' + P.ic('check', 'ui-icon--sm') + 'Додати</button>' +
        '<button class="btn btn--quiet btn--sm" type="button" data-act="tr-reject" data-id="' + id + '">' + P.ic('close', 'ui-icon--sm') + 'Відхилити</button></div></div>';
  }
  function card(st) {
    var n = st.list ? st.list.length : 0;
    return '<section class="card" data-tr-card><h3 class="card-title">Хочуть увійти' + (n ? ' · ' + n : '') + '</h3>' +
      (st.loading ? '<p class="hint">Завантажуємо…</p>'
        : st.error ? '<p class="hint">' + P.esc(st.error) + '</p>'
        : n ? st.list.map(row).join('') : '<p class="hint">Зараз ніхто не чекає</p>') + '</section>';
  }

  P.teamRequests = {
    slot: function () { return '<div data-tr-box></div>'; },
    create: function (o) {
      var st = { loading: true };
      function draw() { var b = o.box(); if (b) b.innerHTML = card(st); }
      return {
        show: draw,   // перемалювати з тим, що вже завантажено (екран перемалювали, а запити тягнути знову не треба)
        refresh: function () {
          st = { loading: true }; draw();
          P.authTeam.requests().then(function (r) {
            if (o.alive && !o.alive()) return;
            st = r && r.ok ? { list: r.requests } : { error: 'Запити зараз недоступні — оновіть сторінку, щоб спробувати ще раз.' };
            draw();
          });
        },
        find: function (id) { return ((st.list || []).filter(function (x) { return String(x.id) === String(id); }))[0] || null; }
      };
    },
    idOf: function (rq) { return mask(rq.slackId); },
    avatar: avatar,
    sourceText: sourceText,
    reject: function (rq) {
      if (!rq) return Promise.resolve(false);
      return P.confirm({ title: 'Відхилити запит · ' + (rq.name || 'Slack ' + mask(rq.slackId)) + '?', okLabel: 'Відхилити', danger: true,
        text: 'Людина не потрапить у список доступу. Якщо вона знову натисне «Увійти в Аудит», новий запит зʼявиться не раніше ніж через добу.' })
        .then(function (ok) {
          if (!ok) return false;
          return P.authSlack.resolveRequest(rq.id, 'rejected').then(function (r) {
            if (!r || !r.ok) { P.toast('danger', 'Не вдалося відхилити', (r && r.error) || ''); return false; }
            P.toast('ok', 'Запит відхилено · ' + (rq.name || ''));
            return true;
          });
        });
    },
    saved: function (r, name) {
      var who = 'Людину додано · ' + (name || r.name || '');
      if (r.dm === 'failed') P.toast('warn', who, DM_FAILED);
      else P.toast('ok', who, r.dm === 'sent' ? DM_SENT : r.active === false ? 'Доступ вимкнено.' : '');
    }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = P.teamRequests;
})(typeof window !== 'undefined' ? window : globalThis);
