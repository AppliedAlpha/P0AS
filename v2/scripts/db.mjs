import { developmentEnvironment } from './local-db.mjs';

if (process.argv[2] !== 'local') {
  console.error('This helper only supports LOCAL databases. Remote migrations must use an explicit Cloudflare database target. Read docs/OPERATIONS.md.');
  process.exit(1);
}
const env = await developmentEnvironment();
const { count } = await env.DB.prepare('SELECT count(*) AS count FROM students').first();
console.log(`LOCAL database ready: .local/p0as.sqlite · ${count} fictional students`);
env.DB.close();
