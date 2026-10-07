const WEB_URL = process.env.DANILOOM_WEB_URL || 'https://daniloom.ai.studio';
const web = new URL(WEB_URL);
if (web.protocol !== 'https:' && !(web.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(web.hostname))) {
  throw new Error('DANILOOM_WEB_URL deve usar HTTPS (ou localhost para desenvolvimento).');
}
module.exports = { webOrigin: web.origin, authOrigin: 'http://localhost:47831', localOrigin: 'http://127.0.0.1:47831', port: 47831 };
