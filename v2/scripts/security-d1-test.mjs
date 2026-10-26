import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { openLocalDatabase, migrateLocal } from '../scripts/local-db.mjs';
import { digest, encryptToken } from '../server/security.js';

// Use Wrangler's own emulator, including when npm nests its dependencies.
// No Wrangler config, .env file, real secrets or persistent database is loaded.
const require = createRequire(import.meta.resolve('wrangler'));
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
const env = { LOCAL_DEV: '1', SESSION_SECRET: 'd1-local-audit-session-isolated-00000000', DATA_SECRET: 'd1-local-audit-data-isolated-11111111111' };
const options = { scriptPath: resolve('.wrangler/functions/index.js'), modules: true, compatibilityDate: '2026-10-01', d1Databases: ['DB'], bindings: env };
const mf = new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options);
const source = openLocalDatabase();
try {
  migrateLocal(source);
  const db = await mf.getD1Database('DB');
  const schema = source.sqlite.prepare("SELECT sql FROM sqlite_schema WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY CASE type WHEN 'table' THEN 0 WHEN 'index' THEN 1 ELSE 2 END").all();
  await db.batch(schema.map(row => db.prepare(row.sql)));
  await db.prepare("INSERT INTO settings (id, title, state) VALUES (1, 'Local audit', 'OPEN')").run();
  await db.prepare("INSERT INTO token_batches (id, label) VALUES ('audit', 'Local audit')").run();
  const students = Array.from({ length: 101 }, (_, index) => ({ id: String(31000000 + index), name: `Audit${index}`, token: String(100000 + index) }));
  const inserts = [];
  for (const row of students) {
    inserts.push(db.prepare('INSERT INTO students (id, name, name_mask, name_digest) VALUES (?, ?, ?, ?)').bind(row.id, row.name, 'A*', await digest(env.DATA_SECRET, 'name', `${row.id}:${row.name}`)));
    inserts.push(db.prepare("INSERT INTO tokens (digest, hint, batch_id, code_encrypted) VALUES (?, 'test', 'audit', ?)").bind(await digest(env.DATA_SECRET, 'token', row.token), await encryptToken(env.DATA_SECRET, row.token)));
  }
  await db.batch(inserts);
  async function post(path, body, cookie) {
    const response = await mf.dispatchFetch(`http://localhost/api${path}`, { method: 'POST', headers: { origin: 'http://localhost', 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.10', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ consent: true, ...body }) });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const identity = await post('/session', { studentId: students[0].id, name: students[0].name });
  assert.equal(identity.status, 200);
  const guesses = await Promise.all(Array.from({ length: 6 }, (_, index) => post('/attendance', { token: String(index).padStart(6, '0'), trial_count: -999 }, identity.cookie)));
  assert.equal(guesses.filter(result => result.status === 400).length, 2);
  assert.equal(guesses.filter(result => result.status === 423).length, 4);
  assert.equal((await db.prepare('SELECT trial_count FROM students WHERE id = ?').bind(students[0].id).first()).trial_count, 3);
  assert.equal((await db.prepare("SELECT count(*) AS count FROM logs WHERE type = 'FAILURE'").first()).count, 3);
  const results = await Promise.all(students.slice(1).map(async row => {
    const session = await post('/session', { studentId: row.id, name: row.name });
    assert.equal(session.status, 200);
    return post('/attendance', { token: row.token }, session.cookie);
  }));
  assert.equal(results.filter(result => result.status === 200).length, 100);
  assert.equal((await db.prepare('SELECT count(*) AS count FROM claims').first()).count, 100);
  assert.equal((await db.prepare('SELECT count(*) AS count FROM tokens WHERE used_by IS NOT NULL').first()).count, 100);
  console.log('Local workerd/D1 audit passed: parallel guessing locks at 3; 100 shared-IP attendance flows succeed.');
} finally { source.close(); await mf.dispose(); }
