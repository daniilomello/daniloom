const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPermissionRequester } = require('./permissions.cjs');

test('startup requests camera, microphone, screen and system audio in order', async () => {
  const order = [];
  const granted = new Set();
  const request = createPermissionRequester({ preferences: {
    getMediaAccessStatus: type => granted.has(type) ? 'granted' : 'not-determined',
    askForMediaAccess: async type => { order.push(type); granted.add(type); },
  }, nativeRequest: async () => { order.push('screen-and-system-audio'); return { screen: true, systemAudioRequested: true }; } });
  const [one, two] = await Promise.all([request(), request()]);
  assert.deepEqual(order, ['camera', 'microphone', 'screen-and-system-audio']);
  assert.deepEqual(one, two);
  assert.equal(one.camera, 'granted');
});
test('does not repeat denied or already granted OS prompts', async () => {
  const request = createPermissionRequester({ preferences: {
    getMediaAccessStatus: type => type === 'camera' ? 'denied' : 'granted',
    askForMediaAccess: async () => { assert.fail('OS prompt must not be repeated'); },
  }, nativeRequest: async () => ({ screen: false }) });
  assert.equal((await request()).camera, 'denied');
});
