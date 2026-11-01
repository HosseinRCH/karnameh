import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePersian, matchesPersian } from '../src/lib/normalize';

test('maps Arabic yeh and kaf to Persian forms', () => {
  assert.equal(normalizePersian('كاري'), 'کاری');
});

test('strips harakat', () => {
  assert.equal(normalizePersian('كَار'), 'کار');
});

test('converts Persian and Arabic-Indic digits to ASCII', () => {
  assert.equal(normalizePersian('۱۲۳'), '123');
  assert.equal(normalizePersian('١٢٣'), '123');
});

test('treats ZWNJ as a boundary', () => {
  assert.equal(normalizePersian('می\u200Cرود'), 'می رود');
});

test('search matches across spelling variants', () => {
  assert.equal(matchesPersian('اعتبار', 'اعتبار'), true);
  assert.equal(matchesPersian('اعتبار', 'اعتب'), true);
  assert.equal(matchesPersian('کار پروژه', 'کار'), true);
});
