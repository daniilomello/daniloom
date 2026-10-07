import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizedRegion } from './captureRegion';

test('area selection supports dragging in every direction', () => {
  const expected = { x: .1, y: .2, width: .6, height: .5 };
  assert.deepEqual(normalizedRegion({ x: 100, y: 200 }, { x: 700, y: 700 }, 1000, 1000), expected);
  assert.deepEqual(normalizedRegion({ x: 700, y: 700 }, { x: 100, y: 200 }, 1000, 1000), expected);
  assert.deepEqual(normalizedRegion({ x: 100, y: 700 }, { x: 700, y: 200 }, 1000, 1000), expected);
});
test('bounds stay within the selected display and are independent of Retina scale', () => {
  assert.deepEqual(normalizedRegion({ x: -10, y: -20 }, { x: 2100, y: 1100 }, 2000, 1000), { x: 0, y: 0, width: 1, height: 1 });
  assert.deepEqual(normalizedRegion({ x: 200, y: 100 }, { x: 1000, y: 500 }, 2000, 1000), { x: .1, y: .1, width: .4, height: .4 });
  assert.deepEqual(normalizedRegion({ x: 400, y: 200 }, { x: 2000, y: 1000 }, 4000, 2000), { x: .1, y: .1, width: .4, height: .4 });
});
test('a click or zero-sized display never becomes a capture area', () => {
  assert.equal(normalizedRegion({ x: 10, y: 10 }, { x: 10, y: 10 }, 100, 100), null);
  assert.equal(normalizedRegion({ x: 10, y: 10 }, { x: 30, y: 30 }, 0, 100), null);
});
