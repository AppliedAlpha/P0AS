import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openLocalDatabase, migrateLocal, seedLocal } from '../scripts/local-db.mjs';
import { handleRequest } from '../server/app.js';
import { decryptToken, digest, encryptToken } from '../server/security.js';
import { csvCell, filterStudents, parseRoster, visibleName } from '../src/lib.js';

let db; let env;
beforeEach(async () => {
  db = openLocalDatabase();
  env = { DB: db, LOCAL_DEV: '1', SESSION_SECRET: 'test-session-secret-independent-0000000000', DATA_SECRET: 'test-data-secret-independent-111111111111' };
  migrateLocal(db); await seedLocal(db, env);
});
afterEach(() => db.close());
async function request(path, { body, cookie, headers = {}, environment = env, origin = 'http://localhost:5173' } = {}) {
  if (body !== undefined && ['/session', '/attendance'].includes(path)) body = { consent: true, ...body };
  const response = await handleRequest(new Request(`${origin}/api${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { ...(body === undefined ? {} : { 'content-type': 'application/json', origin }), ...(cookie ? { cookie } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), environment);
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
}
async function identify(studentId = '26000001', name = '가상하나') { const result = await request('/session', { body: { studentId, name } }); assert.equal(result.status, 200); return result.cookie; }
async function administrator() { const result = await request('/admin/local-login', { body: {} }); assert.equal(result.status, 200); return result.cookie; }
const attend = (cookie, token = '482913') => request('/attendance', { body: { token }, cookie });

test('public settings expose no secret or token list; API responses are not cached', async () => {
  const result = await request('/config');
  assert.equal(result.status, 200); assert.equal(result.data.local, true);
  assert.ok(!JSON.stringify(result.data).includes(env.DATA_SECRET)); assert.ok(!JSON.stringify(result.data).includes('482913'));
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal((await request('/tokens')).status, 404);
  assert.equal((await request('/tokens/482913')).status, 404);
});
test('student APIs and admin list require a valid session', async () => {
  assert.equal((await attend(null)).status, 401);
  assert.equal((await request('/result')).status, 401);
  assert.equal((await request('/admin/overview')).status, 401);
  const studentCookie = await identify();
  assert.equal((await request('/admin/overview', { cookie: studentCookie })).status, 401);
});
test('wrong identity and missing identity use the same error', async () => {
  const wrong = await request('/session', { body: { studentId: '26000001', name: '다른사람' } });
  const missing = await request('/session', { body: { studentId: '99999999', name: '다른사람' } });
  assert.equal(wrong.status, 400); assert.deepEqual(wrong.data, missing.data); assert.equal(wrong.cookie, undefined);
});
test('attendance atomically consumes one token, updates student, and writes a log', async () => {
  const cookie = await identify(); const result = await attend(cookie);
  assert.equal(result.status, 200); assert.equal(result.data.student.is_attended, 1); assert.equal(result.data.student.score, 5);
  assert.ok(result.data.student.attended_at); assert.ok(!('name_digest' in result.data.student));
  const hash = await digest(env.DATA_SECRET, 'token', '482913');
  const token = await db.prepare('SELECT * FROM tokens WHERE digest = ?').bind(hash).first();
  assert.equal(token.used_by, '26000001'); assert.notEqual(token.digest, '482913');
  const log = await db.prepare('SELECT * FROM logs ORDER BY id DESC LIMIT 1').first();
  assert.equal(log.type, 'SUCCESS'); assert.ok(!JSON.stringify(log).includes('482913'));
});
test('same student with two simultaneous different tokens consumes exactly one', async () => {
  const cookie = await identify();
  const results = await Promise.all([attend(cookie, '482913'), attend(cookie, '715204')]);
  assert.deepEqual(results.map(x => x.status).sort(), [200, 409]);
  const row = await db.prepare("SELECT count(*) AS count FROM tokens WHERE used_by = '26000001'").first(); assert.equal(row.count, 1);
});
test('same token submitted by different students has one winner', async () => {
  const first = await identify(); const second = await identify('26000002', '가상둘');
  const results = await Promise.all([attend(first), attend(second)]);
  assert.deepEqual(results.map(x => x.status).sort(), [200, 400]);
  const row = await db.prepare("SELECT count(*) AS count FROM claims WHERE student_id IN ('26000001', '26000002')").first(); assert.equal(row.count, 1);
});
test('invalid token has no partial writes and locks after three attempts', async () => {
  const cookie = await identify();
  assert.equal((await attend(cookie, '000000')).status, 400);
  assert.equal((await attend(cookie, '000000')).status, 400);
  assert.equal((await attend(cookie, '000000')).status, 423);
  assert.equal((await attend(cookie, '482913')).status, 423);
  const student = await db.prepare("SELECT trial_count, is_attended FROM students WHERE id = '26000001'").first();
  assert.deepEqual(student, { trial_count: 3, is_attended: 0 });
  assert.equal((await db.prepare("SELECT count(*) AS count FROM tokens WHERE used_by = '26000001'").first()).count, 0);
});
test('server rejects attendance when closed even with an existing session', async () => {
  const cookie = await identify(); await db.prepare("UPDATE settings SET state = 'CLOSED'").run();
  assert.equal((await attend(cookie)).status, 409);
  assert.equal((await request('/result', { cookie })).status, 200);
  assert.equal((await db.prepare("SELECT count(*) AS count FROM tokens WHERE used_by = '26000001'").first()).count, 0);
});
test('cross-origin and missing-origin writes are rejected', async () => {
  assert.equal((await request('/session', { body: {}, headers: { origin: 'https://attacker.example' } })).status, 403);
  const raw = await handleRequest(new Request('http://localhost:5173/api/admin/local-login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }), env);
  assert.equal(raw.status, 403);
});
test('oversized request bodies are bounded before identity processing', async () => {
  const result = await request('/session', { body: { studentId: '26000001', name: '가상하나', extra: 'x'.repeat(100001) } });
  assert.equal(result.status, 413); assert.equal(result.cookie, undefined);
});
test('altered, expired and revoked session cookies are rejected', async () => {
  const cookie = await identify();
  const forged = cookie.slice(0, -1) + (cookie.at(-1) === '0' ? '1' : '0');
  assert.equal((await attend(forged)).status, 401);
  await db.prepare('UPDATE sessions SET expires_at = 0').run();
  assert.equal((await request('/result', { cookie })).status, 401);
  const fresh = await identify(); await request('/logout', { cookie: fresh, body: {} });
  assert.equal((await request('/result', { cookie: fresh })).status, 401);
});
test('local-only login cannot run in a remote environment or hostname', async () => {
  assert.equal((await request('/admin/local-login', { body: {}, environment: { ...env, LOCAL_DEV: undefined } })).status, 404);
  const response = await handleRequest(new Request('https://app.example/api/admin/local-login', { method: 'POST', headers: { origin: 'https://app.example', 'content-type': 'application/json' }, body: '{}' }), env);
  assert.equal(response.status, 404);
  assert.equal((await request('/admin/overview', { environment: { ...env, LOCAL_DEV: undefined }, headers: { 'cf-access-authenticated-user-email': 'admin@example.com' } })).status, 401);
});
test('remote student identity, attendance and lookup work without external verification', async t => {
  const network = t.mock.method(globalThis, 'fetch', () => { throw new Error('Student requests must not contact an external service'); });
  const remote = { environment: { DB: db, SESSION_SECRET: env.SESSION_SECRET, DATA_SECRET: env.DATA_SECRET }, origin: 'https://app.example' };
  const denied = await request('/session', { ...remote, body: { studentId: '26000001', name: '틀린이름' } });
  assert.equal(denied.status, 400); assert.equal(denied.data.code, 'IDENTITY_MISMATCH'); assert.equal(denied.cookie, undefined);
  const identity = await request('/session', { ...remote, body: { studentId: '26000001', name: '가상하나' } });
  assert.equal(identity.status, 200); assert.ok(identity.cookie);
  assert.match(identity.headers.get('set-cookie'), /; HttpOnly; SameSite=Strict; Max-Age=1800; Secure$/);
  const attendance = await request('/attendance', { ...remote, cookie: identity.cookie, body: { token: '482913' } });
  assert.equal(attendance.status, 200); assert.equal(attendance.data.student.is_attended, 1);
  const lookup = await request('/result', { ...remote, cookie: identity.cookie });
  assert.equal(lookup.status, 200); assert.equal(lookup.data.student.attendance_type, 'FIELD');
  assert.equal((await request('/admin/overview', { ...remote, cookie: identity.cookie })).status, 401);
  assert.equal(network.mock.callCount(), 0);
});
test('identity requests are rate limited by student on the server', async () => {
  for (let i = 0; i < 8; i++) await request('/session', { body: { studentId: '26000001', name: '잘못된이름' } });
  assert.equal((await request('/session', { body: { studentId: '26000001', name: '가상하나' } })).status, 429);
});
test('admin can unlock and approve with audit log; student cannot', async () => {
  const cookie = await administrator();
  assert.equal((await request('/admin/unlock', { body: { studentId: '26000012' }, cookie })).status, 200);
  assert.equal((await db.prepare("SELECT trial_count FROM students WHERE id = '26000012'").first()).trial_count, 0);
  assert.equal((await request('/admin/approve', { body: { studentId: '26000001', type: 'ASSIGNMENT' }, cookie })).status, 200);
  const row = await db.prepare("SELECT attendance_type, score FROM students WHERE id = '26000001'").first(); assert.deepEqual(row, { attendance_type: 'ASSIGNMENT', score: 5 });
  assert.equal((await request('/admin/approve', { body: { studentId: '26000001', type: 'MANUAL' }, cookie })).status, 409);
});
test('only authenticated administrators can retrieve all encrypted token originals', async () => {
  const cookie = await administrator();
  const created = await request('/admin/tokens', { cookie, body: { count: 5, label: '가상 테스트' } });
  assert.equal(created.status, 201); assert.equal(new Set(created.data.codes).size, 5); assert.ok(created.data.codes.every(code => /^\d{6}$/.test(code)));
  const overview = await request('/admin/overview', { cookie });
  for (const code of created.data.codes) assert.ok(overview.data.tokens.some(token => token.code === code));
  assert.ok(!('name_digest' in overview.data.students[0])); assert.ok(!('code_encrypted' in overview.data.tokens[0]));
  const stored = await db.prepare('SELECT code_encrypted FROM tokens WHERE digest = ?').bind(await digest(env.DATA_SECRET, 'token', created.data.codes[0])).first();
  assert.ok(!stored.code_encrypted.includes(created.data.codes[0]));
  assert.equal((await request('/admin/overview')).status, 401);
});
test('250-token issuance stays below the D1 Free per-invocation request limit', async () => {
  const cookie = await administrator(); let calls = 0;
  function monitor(statement) {
    return new Proxy(statement, { get(target, key) {
      if (key === 'bind') return (...args) => monitor(target.bind(...args));
      if (['first', 'all', 'run'].includes(key)) return (...args) => { calls++; return target[key](...args); };
      return target[key];
    } });
  }
  const limitedDB = { ...db, prepare: sql => monitor(db.prepare(sql)), batch: statements => { calls++; return db.batch(statements); } };
  const result = await request('/admin/tokens', { cookie, body: { count: 250, label: '대량 가상 발급' }, environment: { ...env, DB: limitedDB } });
  assert.equal(result.status, 201); assert.equal(result.data.codes.length, 250); assert.ok(calls < 10, `Expected batched calls; got ${calls}`);
});
test('import validates all rows before writing and preserves attendance', async () => {
  const cookie = await administrator();
  const invalid = await request('/admin/students', { cookie, body: { students: [{ studentId: '27000001', name: '가상새봄' }, { studentId: '', name: '가상실패' }] } });
  assert.equal(invalid.status, 400); assert.equal(await db.prepare("SELECT * FROM students WHERE id = '27000001'").first(), null);
  const result = await request('/admin/students', { cookie, body: { students: [{ studentId: '26000003', name: '가상변경' }] } });
  assert.equal(result.status, 200); assert.equal((await db.prepare("SELECT is_attended FROM students WHERE id = '26000003'").first()).is_attended, 1);
});
test('transaction trigger rollback also holds for direct claims bypassing the API', async () => {
  await db.prepare("UPDATE settings SET state = 'CLOSED'").run();
  await assert.rejects(db.prepare('INSERT INTO claims (id, student_id, token_digest) VALUES (?, ?, ?)').bind('test-claim', '26000001', await digest(env.DATA_SECRET, 'token', '482913')).run(), /ATTENDANCE_CLOSED/);
  assert.equal(await db.prepare("SELECT * FROM claims WHERE id = 'test-claim'").first(), null);
});
test('CSV quotes cells, mitigates spreadsheet formulas and parses quoted names', () => {
  assert.equal(csvCell('=1+1'), '"\'=1+1"'); assert.equal(csvCell('가상"학생'), '"가상""학생"');
  assert.deepEqual(parseRoster('student_id,name\r\n27000001,"가상,학생"'), [{ studentId: '27000001', name: '가상,학생' }]);
  assert.throws(() => parseRoster('27000001,"가상학생'), /따옴표/);
});

test('consent is required for identity and attendance, without recording consent metadata', async () => {
  for (const consent of [undefined, false, 'true', 1]) {
    const identity = await request('/session', { body: { studentId: '26000001', name: '가상하나', consent } });
    assert.equal(identity.status, 400); assert.equal(identity.data.code, 'CONSENT_REQUIRED');
  }
  const cookie = await identify();
  const result = await request('/attendance', { cookie, body: { token: '482913', consent: false } });
  assert.equal(result.status, 400); assert.equal(result.data.code, 'CONSENT_REQUIRED');
  const columns = db.sqlite.prepare('PRAGMA table_info(students)').all();
  assert.ok(!columns.some(column => /consent/.test(column.name)));
  assert.equal((await db.prepare("SELECT is_attended FROM students WHERE id = '26000001'").first()).is_attended, 0);
});
test('real names are stored and available only to administrators; student responses stay masked', async () => {
  const cookie = await administrator();
  const imported = await request('/admin/students', { cookie, body: { students: [{ studentId: '27000001', name: '가상새봄' }] } });
  assert.equal(imported.status, 200);
  assert.equal((await db.prepare("SELECT name FROM students WHERE id = '27000001'").first()).name, '가상새봄');
  const overview = await request('/admin/overview', { cookie });
  assert.equal(overview.data.students.find(student => student.id === '27000001').name, '가상새봄');
  const identified = await request('/session', { body: { studentId: '27000001', name: '가상새봄' } });
  assert.ok(!('name' in identified.data.student)); assert.equal(identified.data.student.name_mask, '가**봄');
});
test('AES-GCM token originals cannot be decrypted with another environment key or modified ciphertext', async () => {
  const ciphertext = await encryptToken(env.DATA_SECRET, '001234');
  assert.equal(await decryptToken(env.DATA_SECRET, ciphertext), '001234');
  await assert.rejects(decryptToken('different-environment-key-2222222222222222', ciphertext));
  const parts = ciphertext.split('.'); parts[2] = (parts[2][0] === 'A' ? 'B' : 'A') + parts[2].slice(1);
  await assert.rejects(decryptToken(env.DATA_SECRET, parts.join('.')));
});
test('bulk reset preserves attendance and makes a consumed token available to another student', async () => {
  const cookie = await administrator();
  const result = await request('/admin/tokens/manage', { cookie, body: { action: 'reset', scope: 'all' } });
  assert.equal(result.status, 200); assert.equal(result.data.count, 8);
  assert.equal((await db.prepare("SELECT is_attended FROM students WHERE id = '26000003'").first()).is_attended, 1);
  assert.equal((await db.prepare('SELECT count(*) AS count FROM tokens WHERE used_by IS NOT NULL').first()).count, 0);
  const studentCookie = await identify(); assert.equal((await attend(studentCookie, '390681')).status, 200);
  const previousStudent = await identify('26000003', '가상셋'); assert.equal((await attend(previousStudent, '482913')).status, 409);
});
test('selected token deletion is atomic and preserves attendance, remaining tokens, and audit records', async () => {
  const cookie = await administrator(); const id = await digest(env.DATA_SECRET, 'token', '390681');
  const result = await request('/admin/tokens/manage', { cookie, body: { action: 'delete', scope: 'selected', ids: [id] } });
  assert.equal(result.status, 200); assert.equal(result.data.count, 1);
  assert.equal((await db.prepare('SELECT count(*) AS count FROM tokens').first()).count, 7);
  assert.equal((await db.prepare("SELECT is_attended FROM students WHERE id = '26000003'").first()).is_attended, 1);
  assert.ok((await db.prepare("SELECT count(*) AS count FROM logs WHERE type = 'SUCCESS'").first()).count > 0);
  assert.equal((await db.prepare("SELECT count(*) AS count FROM logs WHERE type = 'TOKEN_MANAGE'").first()).count, 1);
  const deleted = await request('/admin/tokens/manage', { cookie, body: { action: 'delete', scope: 'all' } });
  assert.equal(deleted.status, 200); assert.equal((await db.prepare('SELECT count(*) AS count FROM tokens').first()).count, 0);
});
test('student and unauthenticated requests cannot bulk reset or delete tokens', async () => {
  const cookie = await identify();
  for (const action of ['reset', 'delete']) {
    assert.equal((await request('/admin/tokens/manage', { cookie, body: { action, scope: 'all' } })).status, 401);
    assert.equal((await request('/admin/tokens/manage', { body: { action, scope: 'all' } })).status, 401);
  }
  assert.equal((await db.prepare('SELECT count(*) AS count FROM tokens').first()).count, 8);
});
test('existing hash-only schema upgrades idempotently without inventing originals or losing attendance', () => {
  const legacy = openLocalDatabase();
  try {
    legacy.sqlite.exec(readFileSync(new URL('../migrations/0001_initial.sql', import.meta.url), 'utf8'));
    legacy.sqlite.prepare('INSERT INTO students (id, name_mask, name_digest, is_attended, score) VALUES (?, ?, ?, 1, 5)').run('legacy-001', '가**름', 'irreversible-legacy-hash');
    migrateLocal(legacy); migrateLocal(legacy);
    const row = legacy.sqlite.prepare("SELECT name, is_attended, score FROM students WHERE id = 'legacy-001'").get();
    assert.equal(row.name, null); assert.equal(row.is_attended, 1); assert.equal(row.score, 5);
    assert.ok(!legacy.sqlite.prepare('PRAGMA table_info(settings)').all().some(column => column.name === 'semester'));
  } finally { legacy.close(); }
});
test('roster type filters, ID/time ordering and masking match the chosen controls', () => {
  const rows = [
    { id: '10', name: '가상하나', name_mask: '가**나', is_attended: 1, attendance_type: 'FIELD', attended_at: '2026-10-26T01:00:00Z' },
    { id: '2', is_attended: 1, attendance_type: 'MANUAL', attended_at: '2026-10-26T02:00:00Z' },
    { id: '3', is_attended: 1, attendance_type: 'ASSIGNMENT', attended_at: '2026-10-26T03:00:00Z' },
    { id: '1', is_attended: 0, attendance_type: 'NONE', trial_count: 3, attended_at: null },
  ];
  assert.deepEqual(filterStudents(rows).map(row => row.id), ['1', '2', '3', '10']);
  assert.deepEqual(filterStudents(rows, { direction: 'desc' }).map(row => row.id), ['10', '3', '2', '1']);
  assert.deepEqual(filterStudents(rows, { sortBy: 'attended_at', direction: 'desc' }).map(row => row.id), ['3', '2', '10', '1']);
  assert.deepEqual(filterStudents(rows, { sortBy: 'attended_at', direction: 'asc' }).map(row => row.id), ['10', '2', '3', '1']);
  for (const type of ['FIELD', 'MANUAL', 'ASSIGNMENT']) assert.equal(filterStudents(rows, { filter: 'attended', attendanceType: type }).length, 1);
  assert.equal(filterStudents(rows, { filter: 'locked' })[0].id, '1');
  assert.equal(visibleName(rows[0], false), '가**나'); assert.equal(visibleName(rows[0], true), '가상하나');
});
