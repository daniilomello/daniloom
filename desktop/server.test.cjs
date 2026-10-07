const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createDesktopServer } = require('./server.cjs');

async function setup(t, authOrigin) {
  const dist = await fs.mkdtemp(path.join(os.tmpdir(), 'daniloom-server-'));
  await fs.writeFile(path.join(dist, 'index.html'), '<main>Daniloom</main>');
  const instance = createDesktopServer({ dist, webOrigin: 'https://daniloom.ai.studio', authOrigin, port: 47831 });
  await new Promise((resolve) => instance.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${instance.server.address().port}`;
  t.after(async () => { instance.cancelAuth(); await new Promise((resolve) => instance.server.close(resolve)); await fs.rm(dist, { recursive: true, force: true }); });
  const request = (pathname, options = {}) => new Promise((resolve, reject) => {
    const body = options.body?.toString();
    const req = http.request(`${origin}${pathname}`, { method: options.method || 'GET', headers: { Host: '127.0.0.1:47831', ...(body ? { 'Content-Length': Buffer.byteLength(body), 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...options.headers } }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(new Response(Buffer.concat(chunks), { status: res.statusCode })));
    });
    req.on('error', reject);
    req.end(body);
  });
  return { instance, request };
}

test('serves SPA routes, rejects rebinding host and path traversal', async (t) => {
  const { request } = await setup(t);
  const page = await request('/projects/example');
  assert.equal(await page.text(), '<main>Daniloom</main>');
  assert.equal((await request('/', { headers: { Host: 'malicious.example' } })).status, 403);
  assert.equal((await request('/%2e%2e%2fsecret.txt')).status, 403);
  assert.equal((await request('/missing.js')).status, 404);
});

test('accepts a browser credential once, only with matching origin and state', async (t) => {
  const { instance, request } = await setup(t);
  let authorization;
  const pending = instance.beginAuth('drive', (url) => { authorization = new URL(url); });
  await new Promise((resolve) => setImmediate(resolve));
  const body = new URLSearchParams({ state: authorization.searchParams.get('state'), accessToken: 'test-only-token' });
  const unauthorized = await request('/desktop-auth/callback', { method: 'POST', headers: { Origin: 'https://other.example' }, body });
  assert.equal(unauthorized.status, 403);
  const badState = await request('/desktop-auth/callback', { method: 'POST', headers: { Origin: 'https://daniloom.ai.studio' }, body: new URLSearchParams({ state: 'bad', accessToken: 'test-only-token' }) });
  assert.equal(badState.status, 403);
  const response = await request('/desktop-auth/callback', { method: 'POST', headers: { Origin: 'https://daniloom.ai.studio' }, body });
  assert.equal(response.status, 200);
  assert.deepEqual(await pending, { accessToken: 'test-only-token' });
  assert.ok(!(await response.text()).includes('test-only-token'));
  assert.equal((await request('/desktop-auth/callback', { method: 'POST', headers: { Origin: 'https://daniloom.ai.studio' }, body })).status, 403);
});

test('only known API routes can be proxied from the local UI', async (t) => {
  const { request } = await setup(t);
  assert.equal((await request('/api/anything', { method: 'POST', headers: { Origin: 'http://127.0.0.1:47831' } })).status, 403);
  assert.equal((await request('/api/generate-watermark', { method: 'POST', headers: { Origin: 'https://other.example' } })).status, 403);
});

test('supports Google authorization in the local system browser without a site deployment', async (t) => {
  const { instance, request } = await setup(t, 'http://localhost:47831');
  let authorization;
  const pending = instance.beginAuth('drive', (url) => { authorization = new URL(url); });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(authorization.origin, 'http://localhost:47831');
  assert.equal((await request('/desktop-auth', { headers: { Host: 'localhost:47831' } })).status, 200);
  const body = new URLSearchParams({ state: authorization.searchParams.get('state'), accessToken: 'test-only-token' });
  assert.equal((await request('/desktop-auth/callback', { method: 'POST', headers: { Origin: 'http://localhost:47831' }, body })).status, 200);
  assert.deepEqual(await pending, { accessToken: 'test-only-token' });
});
