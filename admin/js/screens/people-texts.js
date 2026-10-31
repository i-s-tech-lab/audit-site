(function (root) {
  'use strict';
  var P = root.P;
  var DELEG = ['senior_auditor', 'manager'];   // ролі, у яких право «Додавати людей» є від початку

  var CAN_HINT = {
    senior_auditor: 'Додає, змінює й вмикає лише аудиторів на своїх локаціях — до 50 нових людей на добу. Право є в кожного старшого аудитора від початку; вимкнути його можна окремій людині.',
    manager: 'Додає, змінює й вмикає аудиторів і старших аудиторів у своїх локаціях; керівник з «Усі локації» — ще й керівників зі списком локацій. До 50 нових людей на добу. Право є в кожного керівника від початку; вимкнути його можна окремій людині.'
  };
  var STATE_TEXT = { guest: ' · гість простору — додати може лише адміністратор', deleted: ' · акаунт вимкнено', other_team: ' · з іншого простору', bot: ' · бот' };
  var DELETED_MSG = 'Акаунт цієї людини у Slack вимкнено. Додати її можна, коли акаунт знову увімкнуть.';
  var DM_OK = 'Їй у Slack надіслано кнопку «Увійти в Аудит».';
  var DM_FAIL = 'Повідомлення в Slack не вдалося надіслати — надішліть кнопку входу вручну: «Вхід через Slack» → «Надіслати людині».';

  if (P.help && P.help.add) P.help.add({ 'admin.people.canAdd': { t: 'Право «Додавати людей»', d: 'Є в кожного старшого аудитора й керівника від початку; адміністратор може вимкнути його окремій людині. З ним людина сама додає колег з нижчою роллю:\nстарший — лише аудиторів на своїх локаціях;\nкерівник — аудиторів і старших аудиторів у своїх локаціях;\nкерівник з «Усі локації» — ще й керівників зі списком локацій (видаляє керівника лише адміністратор — за запитом).\nНових людей — до 50 на добу, однаково для всіх. Новій людині в Slack одразу приходить кнопка входу. Хто кого додав — видно в списку людей і в журналі входів.' } });

  function locBlock(st, locations) {
    var A = P.adm, esc = P.esc, lab = '<span class="label">Локації' + A.help('admin.people.locs') + '</span>';
    if (st.role === 'admin') return lab + '<span class="select adm-locked">Усі локації' + P.ic('lock', 'icon icon--sm') + '</span>';
    var chips = '<div class="adm-chips">' + locations.map(function (l) {
      var on = st.locs.indexOf(l.id) >= 0;
      return '<button class="chip-pick' + (on ? ' chip-pick--on' : '') + '" type="button" data-act="pp-pick"' + A.da('id', l.id) + ' aria-pressed="' + on + '">' + (on ? P.ic('check', 'ui-icon--sm') : '') + esc(l.name) + '</button>';
    }).join('') + '</div>';
    if (st.role !== 'manager') return lab + chips;
    return '<span class="label">Усі локації' + A.help('admin.people.locs') + '</span>' + A.seg('allLocations', [['true', 'Так'], ['false', 'Ні']], String(st.all)) +
      (st.all ? '<span class="hint">Нові локації зʼявляться в керівника самі.</span>' : '<span class="label">Локації керівника</span>' + chips + '<span class="hint">Керівник бачить і додає людей лише в цих локаціях.</span>');
  }

  P.admPeopleTexts = {
    locBlock: locBlock, CAN_HINT: CAN_HINT, STATE_TEXT: STATE_TEXT, DELETED_MSG: DELETED_MSG,
    roleChangeHint: function (u, role) {
      if (!u || role === u.role) return '';
      if (DELEG.indexOf(role) >= 0) return 'Право «Додавати людей» увімкнеться саме — у цієї ролі воно є від початку.';
      return u.canAddPeople ? 'Право «Додавати людей» зніметься: у цієї ролі його немає.' : '';
    },
    rightOff: function (u) {
      return DELEG.indexOf(u.role) >= 0 && !u.canAddPeople ? P.sr.h.badge('право «Додавати людей» вимкнено', 'warn') : '';
    },
    todayHint: function (access, btn) {
      var hint = access && typeof access.addedToday === 'number' ? '<span class="hint">Сьогодні додано: ' + access.addedToday + ' з ' + (access.addLimitPerDay || 50) + '.</span>' : '';
      return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">' + hint + btn + '</div>';
    },
    guestBlock: function (on) {
      return on ? '<label class="field" data-f="allowGuest"><span style="display:flex;gap:8px;align-items:center"><input type="checkbox" name="allowGuest"> <b>Так, це гість Slack-простору — додати</b></span>' +
        '<span class="hint">Гостя Slack-простору може додати лише адміністратор.</span></label>' : '';
    },
    needGuestTick: function () {
      return { ok: false, code: 'validation', errors: [{ field: 'allowGuest', message: 'Поставте галочку, щоб додати гостя Slack-простору.' }] };
    },
    isGuestError: function (r) {
      return !!r && r.code === 'validation' && (r.errors || []).some(function (e) { return e.field === 'slackId' && /гість/i.test(e.message || ''); });
    },
    savedToast: function (r, u) {
      var name = r.name || (u ? u.name : '');
      if (!r.created) { P.toast('ok', 'Збережено · ' + name, r.active === false ? 'Доступ вимкнено.' : ''); return; }
      if (r.dm === 'sent') P.toast('ok', 'Людину додано · ' + name, DM_OK);
      else if (r.dm === 'failed') P.toast('warn', 'Людину додано · ' + name, DM_FAIL + (r.dmError ? ' Причина: ' + r.dmError : ''));   // причину бачить адмін
      else P.toast('ok', 'Людину додано · ' + name, r.active === false ? 'Доступ вимкнено.' : '');
    }
  };
})(typeof window !== "undefined" ? window : globalThis);
