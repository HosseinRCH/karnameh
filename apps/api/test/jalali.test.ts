import test from 'node:test';
import assert from 'node:assert/strict';
import { toJalaali, toGregorian, isoToJalaali, jalaaliToIso } from '@karnameh/shared';

test('known anchor: 1979-02-11 -> 1357/11/22', () => {
  assert.deepEqual(toJalaali(1979, 2, 11), { jy: 1357, jm: 11, jd: 22 });
});

test('round trip Gregorian -> Jalali -> Gregorian', () => {
  const samples: Array<[number, number, number]> = [
    [2026, 1, 1],
    [2026, 3, 21],
    [2026, 10, 15],
    [2020, 2, 29],
    [2000, 12, 31],
  ];
  for (const [gy, gm, gd] of samples) {
    const j = toJalaali(gy, gm, gd);
    const g = toGregorian(j.jy, j.jm, j.jd);
    assert.deepEqual({ gy: g.gy, gm: g.gm, gd: g.gd }, { gy, gm, gd });
  }
});

test('ISO helpers', () => {
  assert.equal(isoToJalaali('1979-02-11T00:00:00.000Z'), '1357/11/22');
  assert.equal(jalaaliToIso(1357, 11, 22), '1979-02-11');
});
