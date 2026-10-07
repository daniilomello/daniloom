import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadResumable } from './resumableUpload';

const sessionUrl = 'https://www.googleapis.com/upload/drive/v3/files?upload_id=test';
const result = { id: 'file-id', name: 'clip.webm' };
const blob = new Blob([new Uint8Array(8 * 1024 * 1024 + 12)], { type: 'video/webm' });

test('uploads bounded chunks and follows server-confirmed offsets', async () => {
  const ranges: string[] = [];
  const sessions: Array<string | null> = [];
  const request = (async (_url, options) => {
    if (options?.method === 'POST') return new Response(null, { status: 200, headers: { Location: sessionUrl } });
    const range = new Headers(options?.headers).get('Content-Range')!;
    ranges.push(range);
    return ranges.length === 1
      ? new Response(null, { status: 308, headers: { Range: 'bytes=0-8388607' } })
      : Response.json(result);
  }) as typeof fetch;
  assert.deepEqual(await uploadResumable({ blob, token: 'test-only-token', metadata: {}, request, saveSession: async (url) => { sessions.push(url); } }), result);
  assert.deepEqual(ranges, ['bytes 0-8388607/8388620', 'bytes 8388608-8388619/8388620']);
  assert.deepEqual(sessions, [sessionUrl, null]);
});

test('resumes an interrupted session using the remote offset', async () => {
  const ranges: string[] = [];
  const request = (async (_url, options) => {
    assert.equal(options?.method, 'PUT');
    ranges.push(new Headers(options?.headers).get('Content-Range')!);
    return ranges.length === 1
      ? new Response(null, { status: 308, headers: { Range: 'bytes=0-8388607' } })
      : Response.json(result);
  }) as typeof fetch;
  await uploadResumable({ blob, token: 'test-only-token', metadata: {}, sessionUrl, request, saveSession: async () => {} });
  assert.deepEqual(ranges, ['bytes */8388620', 'bytes 8388608-8388619/8388620']);
});

test('recognizes completion after the final response was lost', async () => {
  let calls = 0;
  const request = (async (_url, options) => {
    calls++;
    assert.equal(new Headers(options?.headers).get('Content-Range'), 'bytes */8388620');
    return Response.json(result);
  }) as typeof fetch;
  assert.deepEqual(await uploadResumable({ blob, token: 'test-only-token', metadata: {}, sessionUrl, request, saveSession: async () => {} }), result);
  assert.equal(calls, 1);
});

test('does not leak credentials to an untrusted upload URL', async () => {
  let called = false;
  const request = (async () => { called = true; return Response.json(result); }) as typeof fetch;
  await assert.rejects(uploadResumable({ blob, token: 'test-only-token', metadata: {}, sessionUrl: 'https://malicious.example/upload', request, saveSession: async () => {} }), /inválida/);
  assert.equal(called, false);
});

test('keeps a session for retry after authorization expires', async () => {
  let cleared = false;
  const request = (async () => new Response(null, { status: 401 })) as typeof fetch;
  await assert.rejects(uploadResumable({ blob, token: 'test-only-token', metadata: {}, sessionUrl, request, saveSession: async () => { cleared = true; } }), /Renove/);
  assert.equal(cleared, false);
});
