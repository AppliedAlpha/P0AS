import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openLocalDatabase, migrateLocal, seedLocal } from '../scripts/local-db.mjs';
import { handleRequest } from '../server/app.js';
import { digest, encryptToken } from '../server/security.js';

async function fixture() {
  const db = openLocalDatabase();
  const env = { DB: db, LOCAL_DEV: '1', SESSION_SECRET: 'rules-session-secret-independent-00000000', DATA_SECRET: 'rules-data-secret-independent-11111111111' };
  migrateLocal(db); await seedLocal(db, env);
  // This student previously spent a token, but that attendance was revoked.
  await db.prepare('INSERT INTO claims (id, student_id, token_digest) VALUES (?, ?, ?)').bind('previous-attendance', '26000001', await digest(env.DATA_SECRET, 'token', '482913')).run();
  await db.prepare("DELETE FROM claims WHERE student_id = '26000001'").run();
  await db.prepare("UPDATE students SET is_attended = 0, attendance_type = 'NONE', score = 0, attended_at = NULL WHERE id = '26000001'").run();
  return { db, env };
}
async function post(env, path, body, cookie) {
  const response = await handleRequest(new Request('http://localhost:5173/api' + path, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://localhost:5173', ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ consent: true, ...body }),
  }), env);
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}

test('504 identity, attendance, event and token combinations preserve attendance and consumption rules', async t => {
  const identities = [
    { key: 'match', studentId: '26000001', name: '가상하나', valid: true },
    { key: 'wrong-name', studentId: '26000001', name: '잘못된이름', valid: false },
    { key: 'missing-id', studentId: '99999999', name: '가상하나', valid: false },
  ];
  const states = [
    { key: 'NONE', attended: 0, type: 'NONE', trials: 0 },
    { key: 'FAILED_ONCE', attended: 0, type: 'NONE', trials: 1 },
    { key: 'FAILED_TWICE', attended: 0, type: 'NONE', trials: 2 },
    { key: 'LOCKED', attended: 0, type: 'NONE', trials: 3 },
    { key: 'FIELD', attended: 1, type: 'FIELD', trials: 0 },
    { key: 'MANUAL', attended: 1, type: 'MANUAL', trials: 0 },
    { key: 'ASSIGNMENT', attended: 1, type: 'ASSIGNMENT', trials: 0 },
    { key: 'APPROVED_WHILE_LOCKED', attended: 1, type: 'MANUAL', trials: 3 },
  ];
  const tokens = [
    { key: 'unused', value: '715204', format: true, unused: true },
    { key: 'used-by-self', value: '482913', format: true, unused: false },
    { key: 'used-by-other', value: '390681', format: true, unused: false },
    { key: 'unissued', value: '000000', format: true, unused: false },
    { key: 'short', value: '12345', format: false },
    { key: 'non-digits', value: 'ABCDEF', format: false },
    { key: 'JSON-number', value: 715204, format: false },
  ];
  let combinations = 0;
  for (const identity of identities) for (const state of states) for (const event of ['PRE', 'OPEN', 'CLOSED']) for (const token of tokens) {
    const { db, env } = await fixture();
    const label = `${identity.key}/${state.key}/${event}/${token.key}`;
    try {
      await db.prepare('UPDATE settings SET state = ?').bind(event).run();
      await db.prepare("UPDATE students SET is_attended = ?, attendance_type = ?, trial_count = ?, score = ?, attended_at = ? WHERE id = '26000001'")
        .bind(state.attended, state.type, state.trials, state.attended ? 5 : 0, state.attended ? '2026-10-27T00:00:00Z' : null).run();
      const beforeStudent = await db.prepare("SELECT * FROM students WHERE id = '26000001'").first();
      const beforeTokens = (await db.prepare('SELECT * FROM tokens ORDER BY digest').all()).results;
      const identified = await post(env, '/session', { studentId: identity.studentId, name: identity.name });
      const result = identified.status === 200 ? await post(env, '/attendance', { token: token.value }, identified.cookie) : identified;
      let expected;
      let failedToken = false;
      if (!identity.valid) expected = [400, 'IDENTITY_MISMATCH'];
      else if (!token.format) expected = [400, 'INVALID_INPUT'];
      else if (event !== 'OPEN') expected = [409, 'CLOSED'];
      else if (state.attended) expected = [409, 'ALREADY_ATTENDED'];
      else if (state.trials >= 3) expected = [423, 'LOCKED'];
      else if (!token.unused) { expected = state.trials === 2 ? [423, 'LOCKED'] : [400, 'INVALID_TOKEN']; failedToken = true; }
      else expected = [200, undefined];
      assert.deepEqual([result.status, result.data.code], expected, label);
      const afterStudent = await db.prepare("SELECT * FROM students WHERE id = '26000001'").first();
      const afterTokens = (await db.prepare('SELECT * FROM tokens ORDER BY digest').all()).results;
      if (result.status === 200) {
        assert.equal(afterStudent.is_attended, 1, label); assert.equal(afterStudent.attendance_type, 'FIELD', label);
        assert.equal(afterStudent.score, 5, label); assert.ok(afterStudent.attended_at, label);
        assert.equal(afterStudent.trial_count, state.trials, label);
        const selected = await digest(env.DATA_SECRET, 'token', token.value);
        assert.equal(afterTokens.find(row => row.digest === selected).used_by, '26000001', label);
        assert.deepEqual(afterTokens.filter(row => row.digest !== selected), beforeTokens.filter(row => row.digest !== selected), label);
      } else {
        assert.deepEqual(afterTokens, beforeTokens, label);
        assert.deepEqual(afterStudent, { ...beforeStudent, trial_count: state.trials + (failedToken ? 1 : 0) }, label);
      }
      combinations++;
    } finally { db.close(); }
  }
  assert.equal(combinations, 504); t.diagnostic(`${combinations} combinations verified using independent in-memory databases only`);
});

test('issued all-zero and leading-zero token strings are valid six-digit tokens', async () => {
  const { db, env } = await fixture();
  try {
    for (const [token, studentId, name] of [['000000', '26000001', '가상하나'], ['001234', '26000002', '가상둘']]) {
      await db.prepare("INSERT INTO tokens (digest, hint, batch_id, code_encrypted) VALUES (?, ?, 'demo-local', ?)")
        .bind(await digest(env.DATA_SECRET, 'token', token), `•••• ${token.slice(-2)}`, await encryptToken(env.DATA_SECRET, token)).run();
      const identity = await post(env, '/session', { studentId, name });
      assert.equal((await post(env, '/attendance', { token }, identity.cookie)).status, 200);
    }
  } finally { db.close(); }
});

test('a valid student session cannot target another student through request body fields', async () => {
  const { db, env } = await fixture();
  try {
    const identity = await post(env, '/session', { studentId: '26000001', name: '가상하나' });
    const otherBefore = await db.prepare("SELECT * FROM students WHERE id = '26000002'").first();
    const result = await post(env, '/attendance', { token: '715204', studentId: '26000002', name: '가상둘' }, identity.cookie);
    assert.equal(result.status, 200); assert.equal(result.data.student.id, '26000001');
    assert.deepEqual(await db.prepare("SELECT * FROM students WHERE id = '26000002'").first(), otherBefore);
    assert.equal((await db.prepare('SELECT used_by FROM tokens WHERE digest = ?').bind(await digest(env.DATA_SECRET, 'token', '715204')).first()).used_by, '26000001');
  } finally { db.close(); }
});

test('overlapping attendance revocation and a new token preserve a single current attendance', async () => {
  for (const revokeFirst of [true, false]) {
    const { db, env } = await fixture();
    try {
      await db.prepare('INSERT INTO claims (id, student_id, token_digest) VALUES (?, ?, ?)').bind('current-attendance', '26000001', await digest(env.DATA_SECRET, 'token', '715204')).run();
      const usedBefore = (await db.prepare('SELECT * FROM tokens WHERE used_by = ? ORDER BY digest').bind('26000001').all()).results;
      const identity = await post(env, '/session', { studentId: '26000001', name: '가상하나' });
      const administrator = await post(env, '/admin/local-login', {});
      const revoke = () => post(env, '/admin/attendance/revoke', { studentId: '26000001', confirm: true }, administrator.cookie);
      const attend = () => post(env, '/attendance', { token: '862507' }, identity.cookie);
      const results = await Promise.all(revokeFirst ? [revoke(), attend()] : [attend(), revoke()]);
      const revoked = results[revokeFirst ? 0 : 1]; const submitted = results[revokeFirst ? 1 : 0];
      assert.equal(revoked.status, 200); assert.ok([200, 409].includes(submitted.status));
      const expectedAttended = submitted.status === 200 ? 1 : 0;
      assert.equal((await db.prepare("SELECT is_attended FROM students WHERE id = '26000001'").first()).is_attended, expectedAttended);
      assert.equal((await db.prepare("SELECT count(*) AS count FROM claims WHERE student_id = '26000001'").first()).count, expectedAttended);
      assert.equal((await db.prepare('SELECT used_by FROM tokens WHERE digest = ?').bind(await digest(env.DATA_SECRET, 'token', '862507')).first()).used_by, expectedAttended ? '26000001' : null);
      for (const token of usedBefore) assert.deepEqual(await db.prepare('SELECT * FROM tokens WHERE digest = ?').bind(token.digest).first(), token);
    } finally { db.close(); }
  }
});
