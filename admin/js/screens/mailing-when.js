(function (root) {
  'use strict';
  var P = root.P, esc = P.esc, K = P.mlKit;
  var DAYS = [[1, 'пн'], [2, 'вт'], [3, 'ср'], [4, 'чт'], [5, 'пт'], [6, 'сб'], [0, 'нд']];
  var WEEKDAYS = [[1, 'понеділок'], [2, 'вівторок'], [3, 'середа'], [4, 'четвер'], [5, 'пʼятниця'], [6, 'субота'], [0, 'неділя']];
  var KINDS = [['every', 'Кожні … хвилин', 'Кілька разів на день у робочі години. Напр., нагадування.'],
    ['daily', 'Щодня о …', 'Раз на день у вибрані дні. Напр., денний звіт.'],
    ['weekly', 'Щотижня', 'Раз на тиждень у вибраний день. Напр., підсумок тижня.'],
    ['event', 'Після події', 'Одразу, коли щось сталося: новий аудит, брак понад поріг.']];
  var EVENTS = [['audit', 'Новий аудит', 'Щойно аудитор записав аудит в одному з обраних відділів (крок 2). Найчастіше — для тімліда відділу.'],
    ['over', 'Брак, % за сьогодні перевищив поріг', 'Один раз за день — коли брак, % локації (по обраних відділах) уперше став вищим за поріг.'],
    ['kd', 'Новий розбір коригуючих дій', 'Раз на тиждень — коли готовий новий тижневий розбір коригуючих дій.']];

  function da(k, v) { return ' data-' + k + '="' + esc(v) + '"'; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function f(name, inner) { return '<div class="rz-f" data-f="' + name + '">' + inner + '</div>'; }
  function lab(text, inner, hint) { return '<label class="field"><span class="label">' + esc(text) + '</span>' + inner + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</label>'; }
  function select(name, opts, cur) {
    return '<select class="input rz-sel" data-rz="' + name + '">' + opts.map(function (o) {
      return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
  }
  function hours() { var a = []; for (var i = 0; i < 24; i++) a.push([i, pad(i) + ':00']); return a; }
  function timeInput(v) { return '<input class="input rz-time" type="time" data-rz="at_time" value="' + esc(v) + '" aria-label="О котрій (за Києвом)">'; }
  function days(cur) {
    var off = K.daysOff(cur);
    var hint = !cur.length ? 'Не обрано жодного дня — оберіть хоча б один.' : 'Обрано: ' + K.daysText(cur) + '.' + (off ? ' ' + K.cap(off) + ' — без повідомлень.' : '');
    return f('days', '<div class="field"><span class="label">У які дні</span><div class="chips">' + DAYS.map(function (x) {
      var on = cur.indexOf(x[0]) >= 0;
      return '<button class="chip-pick rz-pick rz-day' + (on ? ' chip-pick--on' : '') + '" type="button" aria-pressed="' + on + '" data-act="rz-day"' + da('d', x[0]) + '>' + x[1] + '</button>'; }).join('') +
      '</div><span class="hint">' + esc(hint) + '</span></div>');
  }
  function radio(act, v, on, title, desc, extra) {
    return '<div class="rz-rl' + (on ? ' is-on' : '') + '"><button class="rz-rl__b" type="button" role="radio" aria-checked="' + on + '" data-act="' + act + '"' + da('v', v) + '>' +
      '<span class="rz-rad" aria-hidden="true"></span><span class="rz-rl__tx"><b>' + esc(title) + '</b><span class="hint">' + esc(desc) + '</span></span></button>' + (on && extra ? extra : '') + '</div>';
  }
  function pctRow(name, v, label) {
    return '<div class="rz-rl__x rz-row"><span class="label">' + esc(label) + '</span><span class="rz-pct"><input class="input" inputmode="decimal" data-rz="' + name + '" value="' + esc(v) +
      '" maxlength="5" aria-label="' + esc(label) + ' у відсотках"><b>%</b></span></div>';
  }

  function html(d, data) {
    var w = d.when, ev = data.options.every || [5, 720];
    var h = '<div class="rz-rcards" role="radiogroup" aria-label="Коли надсилати" data-f="kind">' + KINDS.map(function (k) {
      var on = w.kind === k[0];
      return '<button class="rz-rcard' + (on ? ' is-on' : '') + '" type="button" role="radio" aria-checked="' + on + '" data-act="rz-kind"' + da('v', k[0]) + '><b>' + esc(k[1]) + '</b><span>' + esc(k[2]) + '</span></button>';
    }).join('') + '</div>';
    if (w.kind === 'every') {
      var n = +w.every_min, off = K.daysOff(w.days);
      h += '<div class="rz-grid">' + f('every_min', lab('Як часто', select('every_min', ev.map(function (x) { return [x, K.everyText(x)]; }), w.every_min),
          'Від ' + K.everyText(ev[0]) + ' до ' + K.everyText(ev[ev.length - 1]) + '.')) +
        f('hours', '<div class="rz-grid rz-grid--2">' + lab('З', select('hour_from', hours(), w.hour_from)) + lab('До (включно)', select('hour_to', hours(), w.hour_to)) + '</div>') + '</div>' + days(w.days) +
        (+w.hour_from <= +w.hour_to ? '<p class="hint">Перше повідомлення — о ' + esc(pad(w.hour_from)) + ':00, останнє — о ' + esc(K.lastSlot(w)) + ', між ними — ' + esc(K.everyText(n)) + '.' +
          (off && w.days.length ? ' ' + esc(K.cap(off)) + ' — нічого.' : '') + '</p>' : '');
    } else if (w.kind === 'daily') {
      h += '<div class="rz-whenrow">' + f('at_time', lab('О котрій', timeInput(w.at_time), 'За київським часом.')) + days(w.days) + '</div>';
    } else if (w.kind === 'weekly') {
      h += '<div class="rz-grid">' + f('weekday', lab('День тижня', select('weekday', WEEKDAYS, w.weekday))) + f('at_time', lab('О котрій', timeInput(w.at_time), 'За київським часом.')) + '</div>';
    } else {
      h += f('event', '<div class="rz-rlist" role="radiogroup" aria-label="Яка подія">' + EVENTS.map(function (x) {
        return radio('rz-event', x[0], w.event === x[0], x[1], x[2], x[0] === 'over' ? f('event_pct', pctRow('pct', w.pct, 'Поріг') + P.help.btn('admin.ml.eventOver')) : '');
      }).join('') + '</div>') +
        K.box('warn', '<b>Події дає база аудитів.</b> До її появи таке правило збережеться, але чекатиме — біля нього буде позначка «Чекає бази даних».');
    }
    var label = P.mailRules && P.mailRules.scheduleLabel ? P.mailRules.scheduleLabel({ when: w }) : K.whenShort(d);
    return h + '<p class="rz-inlist">У списку: <span class="rz-inlist__v">' + esc(label) + '</span></p>';
  }

  P.mlWhen = { html: html, radio: radio, pctRow: pctRow };
})(window);
