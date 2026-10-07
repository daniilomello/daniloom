const { test } = require('node:test');
const assert = require('node:assert/strict');
const { captureMenu } = require('./capture-menu.cjs');
const sources = [{ id: 'screen:0', name: 'Entire screen' }, { id: 'window:1', name: 'Terminal' }, { id: 'window:2', name: 'Safari' }];

test('dropdown lists Desktop and window names without preview content', () => {
  let selected;
  const menu = captureMenu(sources, 'choose', value => { selected = value; }, () => {}, () => {});
  assert.ok(menu.some(item => item.label === 'Desktop'));
  assert.ok(menu.some(item => item.label === 'Selecionar área…'));
  menu.find(item => item.label === 'Safari').click();
  assert.equal(selected.id, 'window:2');
  assert.ok(menu.every(item => !('thumbnail' in item)));
});
test('window-only mode excludes desktops and area selection', () => {
  const labels = captureMenu(sources, 'window', () => {}, () => {}, () => {}).map(item => item.label);
  assert.ok(labels.includes('Terminal'));
  assert.ok(!labels.includes('Desktop'));
  assert.ok(!labels.includes('Selecionar área…'));
});
test('each display is available for full screen and area capture', () => {
  let selected;
  const menu = captureMenu([{ id: 'screen:1' }, { id: 'screen:2' }], 'screen', () => {}, source => { selected = source; }, () => {});
  menu.find(item => item.label === 'Selecionar área…').submenu[1].click();
  assert.equal(selected.id, 'screen:2');
});
