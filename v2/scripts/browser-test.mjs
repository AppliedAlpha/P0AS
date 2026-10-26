import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Own one isolated local server directly so Windows teardown does not depend
// on process-tree enumeration or taskkill permissions.
const server = spawn(process.execPath, ['scripts/dev.mjs', '--browser-tests'], { stdio: ['ignore', 'inherit', 'inherit', 'ipc'], windowsHide: true });
let runner;
const stop = () => { runner?.kill(); server.kill(); };
process.once('SIGINT', () => { stop(); process.exit(130); });
process.once('SIGTERM', () => { stop(); process.exit(143); });
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { reject(new Error('Browser test server did not start.')); }, 25000);
    server.once('error', error => { clearTimeout(timer); reject(error); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error(`Browser test server exited: ${code}`)); });
    server.on('message', message => { if (message.type === 'p0as-ready') { clearTimeout(timer); resolve(); } });
  });
  server.disconnect();
  runner = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url)), 'test', ...process.argv.slice(2)], { stdio: 'inherit', windowsHide: true, env: { ...process.env, P0AS_TEST_SERVER_MANAGED: '1' } });
  process.exitCode = await new Promise((resolve, reject) => { runner.once('error', reject); runner.once('exit', code => resolve(code ?? 1)); });
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { server.kill(); }
