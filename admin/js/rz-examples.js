(function (root) {
  'use strict';
  var P = root.P = root.P || {};
  var LABELS = {
    'локація': 'локація', 'перевірено': 'перевірено, шт', 'брак_шт': 'брак, шт', 'брак_%': 'брак, %', 'аудитів': 'аудитів',
    'без_аудитів': 'відділи без аудитів', 'відділів_з_аудитами': 'відділів з аудитами',
    'вчора_перевірено': 'перевірено вчора, шт', 'вчора_брак_%': 'брак вчора, %', 'вчора_аудитів': 'аудитів вчора',
    'тиж_перевірено': 'перевірено за тиждень, шт', 'тиж_брак_%': 'брак за тиждень, %', 'тиж_аудитів': 'аудитів за тиждень',
    'найбільший_брак': 'відділ з найбільшим % браку', 'топ_браку': 'найчастіші види браку',
    'кд_нових': 'понад норму, не почато', 'кд_на_перевірці': 'йде тиждень після впровадження',
    'кабінет_старшого': 'кабінет старшого', 'форма_аудиту': 'форма аудиту',
    'день': 'день', 'дата': 'дата', 'час': 'час', 'вчора': 'вчорашня дата', 'тиждень': 'номер тижня', 'місяць': 'місяць', 'минулий_тиждень': 'дати минулого тижня'
  };
  var NAMES = Object.keys(LABELS);
  var DATA = NAMES.slice(0, 17);
  var EXAMPLES = { 'локація': 'Цех А', 'перевірено': '1 156', 'брак_шт': '44', 'брак_%': '3,8%', 'аудитів': '18', 'без_аудитів': 'Пакування, Склад', 'відділів_з_аудитами': '4 з 6',
    'вчора_перевірено': '1 042', 'вчора_брак_%': '3,1%', 'вчора_аудитів': '16', 'тиж_перевірено': '7 380', 'тиж_брак_%': '3,5%', 'тиж_аудитів': '94',
    'найбільший_брак': 'Оздоблення — 4,9%', 'топ_браку': 'Розрив шва 12 · Перекіс деталі 9', 'кд_нових': '3', 'кд_на_перевірці': '1',
    'кабінет_старшого': 'Кабінет старшого', 'форма_аудиту': 'Форма аудиту' };
  var WD = ['неділя', 'понеділок', 'вівторок', 'середа', 'четвер', 'пʼятниця', 'субота'];
  var MONTHS = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  var MONTHS_NOM = ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'];

  function has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function kyiv(now) {
    var d = now || new Date(), p = { y: d.getFullYear(), m: d.getMonth(), d: d.getDate(), h: d.getHours(), mi: d.getMinutes() };
    try {
      var o = {};
      new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Kyiv', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
        .formatToParts(d).forEach(function (x) { o[x.type] = +x.value; });
      if (o.year && o.month && o.day) p = { y: o.year, m: o.month - 1, d: o.day, h: o.hour, mi: o.minute };
    } catch (e) { /* лишається місцевий час */ }
    return p;
  }
  function isoWeek(day) {
    var t = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    return Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  }
  function lastWeek(day) {
    var a = new Date(day.getTime() - ((day.getUTCDay() || 7) + 6) * 86400000), b = new Date(a.getTime() + 6 * 86400000);
    return a.getUTCMonth() === b.getUTCMonth() ? a.getUTCDate() + '–' + b.getUTCDate() + ' ' + MONTHS[b.getUTCMonth()]
      : a.getUTCDate() + ' ' + MONTHS[a.getUTCMonth()] + ' – ' + b.getUTCDate() + ' ' + MONTHS[b.getUTCMonth()];
  }
  function timeExample(name, now) {
    var k = kyiv(now), day = new Date(Date.UTC(k.y, k.m, k.d)), yd = new Date(day.getTime() - 86400000);
    if (name === 'день') return WD[day.getUTCDay()];
    if (name === 'дата') return k.d + ' ' + MONTHS[k.m];
    if (name === 'час') return pad(k.h) + ':' + pad(k.mi);
    if (name === 'вчора') return yd.getUTCDate() + ' ' + MONTHS[yd.getUTCMonth()];
    if (name === 'тиждень') return String(isoWeek(day));
    if (name === 'місяць') return MONTHS_NOM[k.m];
    if (name === 'минулий_тиждень') return lastWeek(day);
    return null;
  }
  function example(name, now) { return has(EXAMPLES, name) ? EXAMPLES[name] : timeExample(name, now); }
  function label(name) { return has(LABELS, name) ? LABELS[name] : null; }

  P.rzExamples = { example: example, label: label, DATA: DATA, NAMES: NAMES };
  if (typeof module !== 'undefined' && module.exports) module.exports = P.rzExamples;
})(typeof window !== 'undefined' ? window : globalThis);
