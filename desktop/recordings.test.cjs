const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { RecordingStore } = require('./recordings.cjs');

async function setup(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'daniloom-recordings-'));
  const store = new RecordingStore(directory);
  t.after(async () => { await store.close(); await fs.rm(directory, { recursive: true, force: true }); });
  return { directory, store };
}
const bytes = (value) => Uint8Array.from(value).buffer;

test('preserves chunk order and finalizes a complete recording', async (t) => {
  const { directory, store } = await setup(t);
  const id = await store.begin('video/webm;codecs=vp9');
  await Promise.all([store.append(id, bytes([1, 2])), store.append(id, bytes([3, 4]))]);
  const result = await store.finish(id);
  assert.deepEqual([...await fs.readFile(result)], [1, 2, 3, 4]);
  assert.ok(result.endsWith('.webm') && !result.includes('.partial.'));
  assert.equal((await fs.readdir(path.join(directory, 'Sem projeto'))).length, 1);
});

test('explicit discard removes the recording and permits another session', async (t) => {
  const { directory, store } = await setup(t);
  const id = await store.begin('video/mp4');
  await store.append(id, bytes([1]));
  assert.equal(await store.finish(id, true), null);
  assert.deepEqual(await fs.readdir(path.join(directory, 'Sem projeto')), []);
  const next = await store.begin('video/mp4');
  await assert.rejects(store.begin('video/mp4'), /andamento/);
  await store.finish(next);
});

test('shutdown retains flushed partial media for manual recovery', async (t) => {
  const { directory, store } = await setup(t);
  const id = await store.begin('video/webm');
  await store.append(id, bytes([7, 8, 9]));
  await store.close();
  const [partial] = await fs.readdir(path.join(directory, 'Sem projeto'));
  assert.ok(partial.includes('.partial.'));
  assert.deepEqual([...await fs.readFile(path.join(directory, 'Sem projeto', partial))], [7, 8, 9]);
});

test('rejects unknown sessions and invalid buffers', async (t) => {
  const { store } = await setup(t);
  assert.throws(() => store.append('../../other', bytes([1])), /desconhecida/);
  const id = await store.begin('video/webm');
  assert.throws(() => store.append(id, 'invalid'), /inválido/);
});


test('separates projects with identical names and reuses a folder after rename', async t => {
  const { directory, store } = await setup(t);
  const record = async project => {
    const id = await store.begin('video/webm', project);
    await store.append(id, bytes([1, 2, 3]));
    return store.finish(id);
  };
  const first = await record({ id: 'project-a', name: 'Curso' });
  const other = await record({ id: 'project-b', name: 'Curso' });
  const renamed = await record({ id: 'project-a', name: 'Novo nome' });
  assert.notEqual(path.dirname(first), path.dirname(other));
  assert.equal(path.dirname(first), path.dirname(renamed));
  assert.equal((await fs.readdir(directory)).length, 2);
  assert.equal((await fs.readdir(path.dirname(first))).length, 2);
});

test('project names cannot escape the recordings root and long Unicode names work', async t => {
  const { directory, store } = await setup(t);
  for (const name of ['../../outside/../video', '🎬'.repeat(300), '...']) {
    const id = await store.begin('video/mp4', { id: name, name });
    const session = store.sessions.get(id);
    assert.equal(path.dirname(path.dirname(session.partial)), directory);
    await store.append(id, bytes([1]));
    await store.finish(id);
  }
});

test('moves legacy recordings without changing content or overwriting collisions', async t => {
  const { directory, store } = await setup(t);
  const name = 'Daniloom-legacy.webm';
  await fs.writeFile(path.join(directory, name), Buffer.from([1, 2]));
  await fs.writeFile(path.join(directory, 'notes.txt'), 'keep');
  await store.organizeLegacy();
  assert.deepEqual([...await fs.readFile(path.join(directory, 'Gravações anteriores', name))], [1, 2]);
  await fs.writeFile(path.join(directory, name), Buffer.from([9]));
  await store.organizeLegacy();
  assert.deepEqual([...await fs.readFile(path.join(directory, name))], [9]);
  assert.deepEqual([...await fs.readFile(path.join(directory, 'Gravações anteriores', name))], [1, 2]);
  assert.equal(await fs.readFile(path.join(directory, 'notes.txt'), 'utf8'), 'keep');
});
