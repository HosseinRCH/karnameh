/* Jalali (Shamsi) <-> Gregorian conversion, ported from @karnameh/shared. */
(function (global) {
  function div(a, b) {
    return Math.trunc(a / b);
  }
  function mod(a, b) {
    return a - Math.trunc(a / b) * b;
  }
  const pad = (n) => String(n).padStart(2, '0');

  function g2d(gy, gm, gd) {
    let d =
      div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
      div(153 * mod(gm + 9, 12) + 2, 5) +
      gd -
      34840408;
    d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
    return d;
  }

  function d2g(jdn) {
    let j = 4 * jdn + 139361631;
    j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
    const i = div(mod(j, 1461), 4) * 5 + 308;
    return {
      gy: div(j, 1461) - 100100 + div(8 - (mod(div(i, 153), 12) + 1), 6),
      gm: mod(div(i, 153), 12) + 1,
      gd: div(mod(i, 153), 5) + 1,
    };
  }

  const BREAKS = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324,
    2394, 2456, 3178,
  ];

  function jalCal(jy, withoutLeap) {
    const bl = BREAKS.length;
    const gy = jy + 621;
    let leapJ = -14;
    let jp = BREAKS[0];
    let jm = 0;
    let jump = 0;
    if (jy < jp || jy >= BREAKS[bl - 1]) throw new Error('Invalid Jalali year ' + jy);
    for (let i = 1; i < bl; i += 1) {
      jm = BREAKS[i];
      jump = jm - jp;
      if (jy < jm) break;
      leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
      jp = jm;
    }
    let n = jy - jp;
    leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
    if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
    const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
    const march = 20 + leapJ - leapG;
    let leap = 0;
    if (!withoutLeap) {
      if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
      leap = mod(mod(n + 1, 33) - 1, 4);
      if (leap === -1) leap = 4;
    }
    return { leap, gy, march };
  }

  function j2d(jy, jm, jd) {
    const r = jalCal(jy, true);
    return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
  }

  function d2j(jdn) {
    const gy = d2g(jdn).gy;
    let jy = gy - 621;
    const r = jalCal(jy, false);
    const jdn1f = g2d(gy, 3, r.march);
    let k = jdn - jdn1f;
    if (k >= 0) {
      if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
      k -= 186;
    } else {
      jy -= 1;
      k += 179;
      if (r.leap === 1) k += 1;
    }
    return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
  }

  function toJalaali(gy, gm, gd) {
    return d2j(g2d(gy, gm, gd));
  }
  function toGregorian(jy, jm, jd) {
    return d2g(j2d(jy, jm, jd));
  }
  function jalaaliToIso(jy, jm, jd) {
    const g = toGregorian(jy, jm, jd);
    return `${g.gy}-${pad(g.gm)}-${pad(g.gd)}`;
  }
  function isoParts(iso) {
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
    return { gy: d.getUTCFullYear(), gm: d.getUTCMonth() + 1, gd: d.getUTCDate() };
  }
  function isoToJalaali(iso) {
    if (!iso || iso === 'null') return '—';
    try {
      const p = isoParts(iso);
      const j = toJalaali(p.gy, p.gm, p.gd);
      return `${j.jy}/${pad(j.jm)}/${pad(j.jd)}`;
    } catch {
      return String(iso);
    }
  }
  function todayParts() {
    const n = new Date();
    return toJalaali(n.getFullYear(), n.getMonth() + 1, n.getDate());
  }
  function daysInMonth(jy, jm) {
    const next = jm === 12 ? { jy: jy + 1, jm: 1 } : { jy, jm: jm + 1 };
    const a = new Date(`${jalaaliToIso(jy, jm, 1)}T00:00:00Z`).getTime();
    const b = new Date(`${jalaaliToIso(next.jy, next.jm, 1)}T00:00:00Z`).getTime();
    return Math.round((b - a) / 86400000);
  }
  function firstWeekday(jy, jm) {
    const d = new Date(`${jalaaliToIso(jy, jm, 1)}T00:00:00Z`).getUTCDay();
    return (d + 1) % 7;
  }
  function localIso(date) {
    const d = date || new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function addDays(iso, days) {
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const MONTHS = [
    'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
    'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
  ];
  const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
  const WEEKDAYS_FULL = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];
  function weekdayIndex(iso) {
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`).getUTCDay();
    return (d + 1) % 7;
  }

  global.KJalali = {
    toJalaali,
    toGregorian,
    jalaaliToIso,
    isoToJalaali,
    isoParts,
    todayParts,
    daysInMonth,
    firstWeekday,
    localIso,
    addDays,
    weekdayIndex,
    MONTHS,
    WEEKDAYS,
    WEEKDAYS_FULL,
  };
})(window);
