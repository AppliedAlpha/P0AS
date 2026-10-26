import { createServer as createHttpServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
import { developmentEnvironment } from './local-db.mjs';
import { handleRequest } from '../server/app.js';

// Intentionally no dotenv, process.env database credentials, Wrangler config,
// Cloudflare account, v1 files, or remote database fallback in this server.
const browserTests = process.argv.includes('--browser-tests');
const localDirectory = browserTests ? `.local/browser-tests/${crypto.randomUUID()}` : '.local';
const env = await developmentEnvironment(localDirectory);
const api = createHttpServer(async (incoming, outgoing) => {
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of incoming) {
      size += chunk.length;
      if (size > 100000) { outgoing.writeHead(413); outgoing.end('Payload too large'); return; }
      chunks.push(chunk);
    }
    const request = new Request(`http://${incoming.headers.host}${incoming.url}`, { method: incoming.method, headers: incoming.headers, ...(['GET', 'HEAD'].includes(incoming.method) ? {} : { body: Buffer.concat(chunks) }) });
    const response = await handleRequest(request, env);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch { outgoing.writeHead(500); outgoing.end('Local server error'); }
});
await new Promise((resolve, reject) => { api.once('error', reject); api.listen(0, '127.0.0.1', resolve); });
const vite = await createViteServer({ server: { port: browserTests ? 5175 : 5173, proxy: { '/api': { target: `http://127.0.0.1:${api.address().port}`, changeOrigin: false } } } });
await vite.listen();
process.send?.({ type: 'p0as-ready' });
console.log('\n p0as v2 · LOCAL / FICTIONAL DATA ONLY');
vite.printUrls();
console.log(' Test student: 26000001 / 가상하나 / token 482913');
console.log(' Admin: /manage → 관리자 로그인');
console.log(` DB: ${localDirectory}/p0as.sqlite (no Cloudflare connection)\n`);
const stop = async () => {
  const fallback = setTimeout(() => process.exit(0), 3000); fallback.unref();
  api.closeAllConnections(); api.close(); await vite.close(); env.DB.close(); process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
