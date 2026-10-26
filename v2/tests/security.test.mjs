import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { openLocalDatabase, migrateLocal, seedLocal } from '../scripts/local-db.mjs';
import { handleRequest } from '../server/app.js';
import { digest } from '../server/security.js';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

let db; let env;
beforeEach(async () => {
  db = openLocalDatabase();
  env = { DB: db, LOCAL_DEV: '1', SESSION_SECRET: 'audit-session-secret-isolated-00000000000', DATA_SECRET: 'audit-data-secret-isolated-11111111111111' };
  migrateLocal(db); await seedLocal(db, env);
});
afterEach(() => db.close());

async function request(path, body, { cookie, environment = env, headers = {} } = {}) {
  const response = await handleRequest(new Request(`http://localhost:5173/api${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { origin: 'http://localhost:5173', 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), environment);
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function identify(extra = {}) {
  const result = await request('/session', { studentId: '26000001', name: '가상하나', consent: true, ...extra });
  assert.equal(result.status, 200); return result.cookie;
}

test('client overrides cannot lower failures, change identity or grant administrator privileges', async () => {
  await db.prepare("UPDATE students SET trial_count = 2 WHERE id = '26000001'").run();
  for (const count of [-999, 0]) {
    const override = { trial_count: count, trialCount: count, attempts: count, is_attended: 0, role: 'admin', score: 5 };
    const cookie = await identify(override);
    const denied = await request('/attendance', { token: '000000', consent: true, studentId: '26000002', ...override }, { cookie });
    assert.equal(denied.status, 423);
    assert.equal((await db.prepare("SELECT trial_count FROM students WHERE id = '26000001'").first()).trial_count, 3);
    assert.equal((await request('/attendance', { token: '482913', consent: true, ...override }, { cookie })).status, 423);
    assert.equal((await request('/admin/unlock', { studentId: '26000001', ...override }, { cookie })).status, 401);
  }
  assert.equal((await db.prepare("SELECT trial_count FROM students WHERE id = '26000002'").first()).trial_count, 0);
  assert.equal((await db.prepare("SELECT count(*) AS count FROM tokens WHERE used_by = '26000001'").first()).count, 0);
});

test('parallel token guessing records at most three failures even when DB replies overlap', async () => {
  const cookie = await identify();
  // Model separate remote DB round trips returning six invalid verdicts before
  // the old handler can persist any of their failure increments. A transaction
  // must keep each verdict and its counter update together under this schedule.
  let waiting = 0; let release;
  const gate = new Promise(resolve => { release = resolve; });
  function wrap(statement) {
    return new Proxy(statement, { get(target, property) {
      if (property === 'bind') return (...args) => wrap(target.bind(...args));
      if (property === 'run') return async () => {
        try { return await target.run(); }
        catch (error) {
          if (target.sql.startsWith('INSERT INTO claims') && String(error.message).includes('INVALID_TOKEN')) {
            if (++waiting === 6) release();
            await gate;
          }
          throw error;
        }
      };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
  }
  const environment = { ...env, DB: { prepare: sql => wrap(db.prepare(sql)), batch: statements => db.batch(statements) } };
  const results = await Promise.all(Array.from({ length: 6 }, (_, index) => request('/attendance', { token: String(index).padStart(6, '0'), consent: true }, { cookie, environment })));
  assert.equal(results.filter(result => result.status === 400).length, 2);
  assert.equal(results.filter(result => result.status === 423).length, 4);
  assert.equal((await db.prepare("SELECT trial_count FROM students WHERE id = '26000001'").first()).trial_count, 3);
  assert.equal((await db.prepare("SELECT count(*) AS count FROM logs WHERE student_id = '26000001' AND type = 'FAILURE'").first()).count, 3);
  assert.equal((await request('/attendance', { token: '482913', consent: true }, { cookie })).status, 429);
  const token = await db.prepare('SELECT used_by FROM tokens WHERE digest = ?').bind(await digest(env.DATA_SECRET, 'token', '482913')).first();
  assert.equal(token.used_by, null);
});

test('token guesses reveal no token state before authentication or after locking', async () => {
  const codes = ['482913', '390681', '000000']; // unused, used, unissued
  const anonymous = await Promise.all(codes.map(token => request('/attendance', { token, consent: true })));
  assert.ok(anonymous.every(result => result.status === 401));
  assert.deepEqual(anonymous.map(result => result.data), Array(3).fill(anonymous[0].data));
  const cookie = await identify();
  await db.prepare("UPDATE students SET trial_count = 3 WHERE id = '26000001'").run();
  const locked = await Promise.all(codes.map(token => request('/attendance', { token, consent: true }, { cookie })));
  assert.ok(locked.every(result => result.status === 423));
  assert.deepEqual(locked.map(result => result.data), Array(3).fill(locked[0].data));
});

test('used and unissued tokens have identical failure responses', async () => {
  const cookie = await identify();
  const used = await request('/attendance', { token: '390681', consent: true }, { cookie });
  await db.prepare("UPDATE students SET trial_count = 0 WHERE id = '26000001'").run();
  const missing = await request('/attendance', { token: '000000', consent: true }, { cookie });
  assert.equal(used.status, 400); assert.equal(missing.status, 400); assert.deepEqual(used.data, missing.data);
});

test('structured identity values cannot be coerced into valid student credentials', async () => {
  for (const body of [{ studentId: ['26000001'], name: '가상하나' }, { studentId: '26000001', name: ['가상하나'] }, { studentId: 26000001, name: '가상하나' }]) {
    const result = await request('/session', { ...body, consent: true });
    assert.equal(result.status, 400); assert.equal(result.cookie, undefined);
  }
});

test('revoking a session while attendance is in flight prevents its later token consumption', async () => {
  const cookie = await identify();
  let observed; let release;
  const read = new Promise(resolve => { observed = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  function wrap(statement) {
    return new Proxy(statement, { get(target, property) {
      if (property === 'bind') return (...args) => wrap(target.bind(...args));
      if (property === 'first' && target.sql.startsWith('SELECT student_id, role FROM sessions')) return async () => {
        const row = await target.first(); observed(); await gate; return row;
      };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
  }
  const environment = { ...env, DB: { prepare: sql => wrap(db.prepare(sql)), batch: statements => db.batch(statements) } };
  const pending = request('/attendance', { token: '482913', consent: true }, { cookie, environment });
  await read;
  try { assert.equal((await request('/logout', {}, { cookie })).status, 200); }
  finally { release(); }
  assert.equal((await pending).status, 401);
  assert.equal((await db.prepare("SELECT count(*) AS count FROM tokens WHERE used_by = '26000001'").first()).count, 0);
});

test('changing a roster name invalidates old student sessions but an unchanged import preserves them', async () => {
  const cookie = await identify();
  const adminCookie = (await request('/admin/local-login', {})).cookie;
  const update = name => request('/admin/students', { students: [{ studentId: '26000001', name }] }, { cookie: adminCookie });
  assert.equal((await update('가상하나')).status, 200);
  assert.equal((await request('/result', undefined, { cookie })).status, 200);
  assert.equal((await update('가상변경')).status, 200);
  assert.equal((await request('/result', undefined, { cookie })).status, 401);
  assert.equal((await request('/attendance', { token: '482913', consent: true }, { cookie })).status, 401);
  assert.equal((await request('/session', { studentId: '26000001', name: '가상하나', consent: true })).status, 400);
  assert.equal((await request('/session', { studentId: '26000001', name: '가상변경', consent: true })).status, 200);
});

test('identity verified before a roster edit cannot issue a session for the old name afterward', async () => {
  const adminCookie = (await request('/admin/local-login', {})).cookie;
  let observed; let release;
  const read = new Promise(resolve => { observed = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  function wrap(statement) {
    return new Proxy(statement, { get(target, property) {
      if (property === 'bind') return (...args) => wrap(target.bind(...args));
      if (property === 'first' && target.sql.startsWith('SELECT name_digest FROM students')) return async () => {
        const row = await target.first(); observed(); await gate; return row;
      };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    } });
  }
  const environment = { ...env, DB: { prepare: sql => wrap(db.prepare(sql)), batch: statements => db.batch(statements) } };
  const pending = request('/session', { studentId: '26000001', name: '가상하나', consent: true }, { environment });
  await read;
  try {
    assert.equal((await request('/admin/students', { students: [{ studentId: '26000001', name: '가상변경' }] }, { cookie: adminCookie })).status, 200);
  } finally { release(); }
  const result = await pending;
  assert.equal(result.status, 400); assert.equal(result.cookie, undefined);
  assert.equal((await db.prepare("SELECT count(*) AS count FROM sessions WHERE student_id = '26000001'").first()).count, 0);
});

test('token failure audit and counter both roll back if either persistence step fails', async t => {
  t.mock.method(console, 'error', () => {});
  const cookie = await identify();
  db.sqlite.exec("CREATE TRIGGER prevent_failure BEFORE UPDATE OF trial_count ON students WHEN NEW.trial_count > OLD.trial_count BEGIN SELECT RAISE(ABORT, 'simulated audit failure'); END;");
  assert.equal((await request('/attendance', { token: '000000', consent: true }, { cookie })).status, 500);
  assert.equal((await db.prepare("SELECT trial_count FROM students WHERE id = '26000001'").first()).trial_count, 0);
  assert.equal((await db.prepare("SELECT count(*) AS count FROM logs WHERE student_id = '26000001' AND type = 'FAILURE'").first()).count, 0);
});

test('fresh cookies, other IPs and expired minute buckets do not reset persistent token failures', async () => {
  const first = await identify(); const second = await identify(); const third = await identify();
  for (const [cookie, ip, status] of [[first, '203.0.113.1', 400], [second, '203.0.113.2', 400], [third, '203.0.113.3', 423]]) {
    assert.equal((await request('/attendance', { token: '000000', consent: true }, { cookie, headers: { 'cf-connecting-ip': ip } })).status, status);
  }
  await db.prepare('UPDATE rate_limits SET resets_at = 0').run();
  const fresh = await identify();
  assert.equal((await request('/attendance', { token: '482913', consent: true, trial_count: 0 }, { cookie: fresh })).status, 423);
});

test('invented student IDs use bounded counters without blocking a registered student', async () => {
  const results = await Promise.all(Array.from({ length: 400 }, (_, index) => request('/session', { studentId: String(99000000 + index), name: 'Unknown', consent: true })));
  assert.ok(results.every(result => [400, 429].includes(result.status) && !result.cookie));
  assert.ok((await db.prepare('SELECT count(*) AS count FROM rate_limits').first()).count <= 256);
  assert.ok(await identify());
  await db.prepare('UPDATE rate_limits SET resets_at = 0').run();
  const before = (await db.prepare('SELECT count(*) AS count FROM rate_limits').first()).count;
  assert.ok(await identify());
  assert.ok((await db.prepare('SELECT count(*) AS count FROM rate_limits').first()).count < before);
});

test('remote admin APIs verify JWT signature, issuer, audience, expiry and allowed email', async t => {
  const issuer = 'https://audit-admin.cloudflareaccess.com';
  const trusted = await generateKeyPair('RS256');
  const attacker = await generateKeyPair('RS256');
  const jwk = { ...await exportJWK(trusted.publicKey), kid: 'audit', alg: 'RS256', use: 'sig' };
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(String(url), `${issuer}/cdn-cgi/access/certs`);
    return Response.json({ keys: [jwk] });
  });
  const environment = { ...env, LOCAL_DEV: undefined, ACCESS_TEAM_DOMAIN: 'audit-admin.cloudflareaccess.com', ACCESS_AUD: 'audit-app', ADMIN_EMAILS: 'staff@example.com' };
  const sign = (claims = {}, key = trusted.privateKey, algorithm = 'RS256') => new SignJWT({ email: 'staff@example.com', iss: issuer, aud: 'audit-app', exp: Math.floor(Date.now() / 1000) + 300, ...claims }).setProtectedHeader({ alg: algorithm, kid: 'audit' }).sign(key);
  const headers = token => ({ 'cf-access-jwt-assertion': token, 'cf-access-authenticated-user-email': 'staff@example.com' });
  assert.equal((await request('/admin/overview', undefined, { environment, headers: headers(await sign()) })).status, 200);
  for (const token of [
    await sign({}, attacker.privateKey),
    await sign({ iss: 'https://other.cloudflareaccess.com' }),
    await sign({ aud: 'another-app' }),
    await sign({ exp: Math.floor(Date.now() / 1000) - 1 }),
    await sign({ exp: undefined }),
    await sign({ email: 'student@example.com' }),
    await sign({}, new TextEncoder().encode('attacker-controlled-key-0000000000'), 'HS256'),
    'eyJhbGciOiJub25lIn0.eyJlbWFpbCI6InN0YWZmQGV4YW1wbGUuY29tIn0.',
  ]) {
    assert.equal((await request('/admin/overview', undefined, { environment, headers: headers(token) })).status, 403);
    assert.equal((await request('/admin/unlock', { studentId: '26000012' }, { environment, headers: headers(token) })).status, 403);
  }
  assert.equal((await db.prepare("SELECT trial_count FROM students WHERE id = '26000012'").first()).trial_count, 3);
});
