const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes, timingSafeEqual } = require('node:crypto');

function createDesktopServer({ dist, webOrigin, authOrigin = webOrigin, port }) {
  let pending = null;
  const cancelAuth = () => {
    if (!pending) return;
    clearTimeout(pending.timer);
    pending.reject(new Error('Autorização cancelada ou expirada.'));
    pending = null;
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    if (![ `127.0.0.1:${port}`, `localhost:${port}` ].includes(req.headers.host)) {
      res.writeHead(403).end('Host inválido.');
      return;
    }
    try {
      const url = new URL(req.url, `http://127.0.0.1:${port}`);
      if (url.pathname === '/desktop-auth/callback') {
        if (req.method !== 'POST' || req.headers.origin !== authOrigin || !pending) {
          res.writeHead(403).end('Autorização inválida.');
          return;
        }
        let body = '';
        for await (const chunk of req) {
          body += chunk;
          if (body.length > 32768) { res.writeHead(413).end(); return; }
        }
        const fields = new URLSearchParams(body);
        const state = Buffer.from(fields.get('state') || '');
        const expected = Buffer.from(pending.state);
        const accessToken = fields.get('accessToken');
        if (state.length !== expected.length || !timingSafeEqual(state, expected) || !accessToken || accessToken.length > 8192) {
          res.writeHead(403).end('Autorização inválida.');
          return;
        }
        const current = pending;
        pending = null;
        clearTimeout(current.timer);
        current.resolve({ accessToken });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Daniloom</title><body style="background:#0c0d0f;color:#f4f4f5;font:16px system-ui;padding:60px"><h1>Desktop conectado</h1><p>Volte ao Daniloom Desktop. Você pode fechar esta aba.</p></body></html>');
        return;
      }
      if (url.pathname.startsWith('/api/')) {
        if (req.method !== 'POST' || ![`http://127.0.0.1:${port}`, `http://localhost:${port}`].includes(req.headers.origin) || !['/api/generate-watermark', '/api/gemini/generate-youtube-metadata'].includes(url.pathname)) {
          res.writeHead(403).end(); return;
        }
        const chunks = [];
        let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 1024 * 1024) { res.writeHead(413).end(); return; }
          chunks.push(chunk);
        }
        const upstream = await fetch(`${webOrigin}${url.pathname}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: Buffer.concat(chunks), signal: AbortSignal.timeout(120000), redirect: 'error',
        });
        res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
        res.end(Buffer.from(await upstream.arrayBuffer()));
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
      const requested = decodeURIComponent(url.pathname);
      const file = path.resolve(dist, `.${requested}`);
      if (!file.startsWith(`${path.resolve(dist)}${path.sep}`) && file !== path.resolve(dist)) {
        res.writeHead(403).end(); return;
      }
      let target = file;
      if (!path.extname(requested) || requested === '/') target = path.join(dist, 'index.html');
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json' };
      res.setHeader('Content-Type', types[path.extname(target)] || 'application/octet-stream');
      const data = await fs.readFile(target);
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch (error) {
      res.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Não foi possível atender a solicitação.');
    }
  });
  return {
    server,
    cancelAuth,
    async beginAuth(scope, openBrowser) {
      if (!['drive', 'youtube'].includes(scope)) throw new Error('Escopo inválido.');
      if (pending) throw new Error('Conclua a autorização aberta no navegador.');
      const state = randomBytes(32).toString('hex');
      return new Promise((resolve, reject) => {
        pending = { state, resolve, reject, timer: setTimeout(cancelAuth, 5 * 60 * 1000) };
        const url = new URL('/desktop-auth', authOrigin);
        url.searchParams.set('state', state);
        url.searchParams.set('port', String(port));
        url.searchParams.set('scope', scope);
        Promise.resolve().then(() => openBrowser(url.href)).catch(cancelAuth);
      });
    },
  };
}
module.exports = { createDesktopServer };
