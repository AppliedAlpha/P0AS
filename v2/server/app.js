import { HttpError, admin, decryptToken, digest, encryptToken, issueSession, localOnly, maskName, normalizeName, rateLimit, readJSON, requireSecrets, sameOrigin, session, studentInput } from './security.js';

const studentColumns = 'id, name_mask, trial_count, is_attended, attendance_type, score, attended_at';
const json = (value, status = 200, headers = {}) => Response.json(value, { status, headers });
async function settings(db) { return db.prepare('SELECT title, state FROM settings WHERE id = 1').first(); }
async function student(db, id) { return db.prepare(`SELECT ${studentColumns} FROM students WHERE id = ?`).bind(id).first(); }
function failure(status, message, code) { throw new HttpError(status, message, code); }
function requireConsent(value) { if (value !== true) failure(400, '개인정보 수집·이용에 동의해주세요.', 'CONSENT_REQUIRED'); }
function tokenCode() {
  const array = new Uint32Array(1);
  do { crypto.getRandomValues(array); } while (array[0] >= 4294000000);
  return String(array[0] % 1000000).padStart(6, '0');
}
async function routes(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/$/, '');
  const method = request.method;
  if (!env.DB) failure(503, '데이터베이스 연결을 준비 중입니다.', 'NOT_CONFIGURED');
  requireSecrets(env);
  if (!['GET', 'POST'].includes(method)) failure(405, '지원하지 않는 요청입니다.');
  if (method === 'POST') sameOrigin(request);

  if (path === '/api/config' && method === 'GET') return json({ ...await settings(env.DB), local: localOnly(request, env) });
  if (path === '/api/session' && method === 'POST') {
    const body = await readJSON(request);
    requireConsent(body.consent);
    const { studentId, name } = studentInput(body);
    await rateLimit(env.DB, env.DATA_SECRET, 'identity-ip', request.headers.get('cf-connecting-ip') || 'local', 30);
    await rateLimit(env.DB, env.DATA_SECRET, 'identity-student', studentId, 8);
    const found = await env.DB.prepare('SELECT name_digest FROM students WHERE id = ?').bind(studentId).first();
    const expected = await digest(env.DATA_SECRET, 'name', `${studentId}:${name}`);
    if (!found || found.name_digest !== expected) failure(400, '학번 또는 이름이 일치하지 않습니다. 입력 내용을 확인해주세요.', 'IDENTITY_MISMATCH');
    return json({ student: await student(env.DB, studentId) }, 200, { 'Set-Cookie': await issueSession(env.DB, env, request, studentId) });
  }
  if (path === '/api/logout' && method === 'POST') {
    // Revocation is checked by every authenticated request; expired tokens do not revive.
    try {
      const raw = request.headers.get('cookie')?.match(/(?:^|;\s*)p0as_session=([^;]+)/)?.[1];
      if (raw) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(await digest(env.SESSION_SECRET, 'sid', raw.split('.')[0])).run();
    } catch { /* The cookie is also cleared if the session was already absent. */ }
    return json({ ok: true }, 200, { 'Set-Cookie': `p0as_session=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0${localOnly(request, env) ? '' : '; Secure'}` });
  }
  if (path === '/api/result' && method === 'GET') {
    const identity = await session(request, env);
    return json({ student: await student(env.DB, identity.student_id) });
  }
  if (path === '/api/attendance' && method === 'POST') {
    const identity = await session(request, env);
    const { token, consent } = await readJSON(request);
    requireConsent(consent);
    await rateLimit(env.DB, env.DATA_SECRET, 'attendance', identity.student_id, 6);
    if (typeof token !== 'string' || !/^\d{6}$/.test(token)) failure(400, '토큰은 숫자 6자리로 입력해주세요.', 'INVALID_INPUT');
    const tokenDigest = await digest(env.DATA_SECRET, 'token', token);
    try {
      await env.DB.prepare('INSERT INTO claims (id, student_id, token_digest) VALUES (?, ?, ?)').bind(crypto.randomUUID(), identity.student_id, tokenDigest).run();
    } catch (error) {
      const message = String(error.message);
      if (message.includes('ATTENDANCE_CLOSED')) failure(409, '지금은 출석을 접수하지 않습니다. 운영자에게 확인해주세요.', 'CLOSED');
      if (message.includes('ALREADY_ATTENDED') || message.includes('claims.student_id')) failure(409, '이미 출석이 기록되어 있습니다. 결과 조회에서 확인해주세요.', 'ALREADY_ATTENDED');
      if (message.includes('STUDENT_LOCKED')) failure(423, '토큰 입력이 3회 일치하지 않아 잠겼습니다. 현장 운영자에게 문의해주세요.', 'LOCKED');
      if (message.includes('INVALID_TOKEN') || message.includes('claims.token_digest')) {
        await env.DB.batch([
          env.DB.prepare('UPDATE students SET trial_count = trial_count + 1 WHERE id = ? AND is_attended = 0 AND trial_count < 3').bind(identity.student_id),
          env.DB.prepare("INSERT INTO logs (student_id, type, description) VALUES (?, 'FAILURE', '유효하지 않거나 사용된 토큰 입력')").bind(identity.student_id),
        ]);
        const current = await student(env.DB, identity.student_id);
        if (current.trial_count >= 3) failure(423, '토큰 입력이 3회 일치하지 않아 잠겼습니다. 현장 운영자에게 문의해주세요.', 'LOCKED');
        failure(400, `유효하지 않거나 사용된 토큰입니다. 종이를 확인해주세요. (${current.trial_count}/3회)`, 'INVALID_TOKEN');
      }
      throw error;
    }
    return json({ student: await student(env.DB, identity.student_id) });
  }
  if (path === '/api/admin/local-login' && method === 'POST') {
    if (!localOnly(request, env)) failure(404, '페이지를 찾을 수 없습니다.');
    return json({ ok: true }, 200, { 'Set-Cookie': await issueSession(env.DB, env, request, null, 'admin') });
  }
  if (path.startsWith('/api/admin')) {
    const actor = await admin(request, env);
    if (path === '/api/admin/login' && method === 'GET') return Response.redirect(new URL('/manage', request.url), 302);
    if (path === '/api/admin/overview' && method === 'GET') {
      const result = await env.DB.batch([
        env.DB.prepare(`SELECT ${studentColumns}, name FROM students ORDER BY id`),
        env.DB.prepare('SELECT digest AS id, hint, code_encrypted, batch_id, used_by, used_at FROM tokens ORDER BY rowid DESC'),
        env.DB.prepare('SELECT id, student_id, type, description, actor, created_at FROM logs ORDER BY id DESC LIMIT 30'),
        env.DB.prepare('SELECT id, label, created_at FROM token_batches ORDER BY created_at DESC'),
        env.DB.prepare('SELECT title, state FROM settings WHERE id = 1'),
      ]);
      const tokens = await Promise.all(result[1].results.map(async ({ code_encrypted, ...row }) => ({ ...row, code: await decryptToken(env.DATA_SECRET, code_encrypted) })));
      return json({ students: result[0].results, tokens, logs: result[2].results, batches: result[3].results, settings: result[4].results[0], actor });
    }
    if (path === '/api/admin/reset' && method === 'POST') {
      const body = await readJSON(request);
      if (body.confirm !== true) failure(400, '초기화 경고를 확인한 뒤 다시 시도해주세요.', 'CONFIRMATION_REQUIRED');
      await env.DB.batch([
        env.DB.prepare("UPDATE settings SET title = 'K-MOOC 특강', state = 'PRE' WHERE id = 1"),
        env.DB.prepare("DELETE FROM sessions WHERE role = 'student'"),
        env.DB.prepare('DELETE FROM claims'),
        env.DB.prepare('DELETE FROM tokens'),
        env.DB.prepare('DELETE FROM token_batches'),
        env.DB.prepare('DELETE FROM students'),
        env.DB.prepare('DELETE FROM logs'),
        env.DB.prepare('DELETE FROM rate_limits'),
      ]);
      return json({ ok: true, settings: await settings(env.DB) });
    }
    if (path === '/api/admin/settings' && method === 'POST') {
      const body = await readJSON(request);
      if (!['PRE', 'OPEN', 'CLOSED'].includes(body.state) || typeof body.title !== 'string' || !body.title.trim() || body.title.length > 80) failure(400, '행사명과 운영 상태를 확인해주세요.');
      await env.DB.batch([
        env.DB.prepare('UPDATE settings SET title = ?, state = ? WHERE id = 1').bind(body.title.trim(), body.state),
        env.DB.prepare("INSERT INTO logs (type, description, actor) VALUES ('SETTINGS', ?, ?)").bind(`운영 설정 변경 · ${body.state}`, actor),
      ]);
      return json({ settings: await settings(env.DB) });
    }
    if (path === '/api/admin/approve' && method === 'POST') {
      const body = await readJSON(request);
      if (!['MANUAL', 'ASSIGNMENT'].includes(body.type) || !await student(env.DB, body.studentId)) failure(400, '학생과 출석 유형을 확인해주세요.');
      const current = await student(env.DB, body.studentId);
      if (current.is_attended) failure(409, '이미 출석이 기록된 학생입니다.');
      await env.DB.batch([
        env.DB.prepare("UPDATE students SET is_attended = 1, score = 5, attendance_type = ?, attended_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ? AND is_attended = 0").bind(body.type, body.studentId),
        env.DB.prepare("INSERT INTO logs (student_id, type, description, actor) VALUES (?, 'MANUAL', ?, ?)").bind(body.studentId, body.type === 'MANUAL' ? '수동 출석 승인' : '과제 출석 인정', actor),
      ]);
      return json({ ok: true });
    }
    if (path === '/api/admin/unlock' && method === 'POST') {
      const body = await readJSON(request);
      if (!await student(env.DB, body.studentId)) failure(404, '학생을 찾을 수 없습니다.');
      await env.DB.batch([
        env.DB.prepare('UPDATE students SET trial_count = 0 WHERE id = ?').bind(body.studentId),
        env.DB.prepare("INSERT INTO logs (student_id, type, description, actor) VALUES (?, 'UNLOCK', '입력 잠금 해제', ?)").bind(body.studentId, actor),
      ]);
      return json({ ok: true });
    }
    if (path === '/api/admin/tokens' && method === 'POST') {
      const body = await readJSON(request);
      if (!Number.isInteger(body.count) || body.count < 1 || body.count > 250) failure(400, '토큰은 한 번에 1~250개 발급할 수 있습니다.');
      const id = crypto.randomUUID();
      const label = String(body.label || '현장 배부용').trim().slice(0, 60);
      const codes = new Set();
      const statements = [env.DB.prepare('INSERT INTO token_batches (id, label) VALUES (?, ?)').bind(id, label)];
      // D1 Free permits 50 calls per invocation. Collision checks run in one
      // batch rather than a separate DB roundtrip for each of up to 250 codes.
      for (let round = 0; codes.size < body.count && round < 5; round++) {
        const candidates = new Set();
        while (candidates.size < body.count - codes.size) { const code = tokenCode(); if (!codes.has(code)) candidates.add(code); }
        const records = await Promise.all([...candidates].map(async code => ({ code, hash: await digest(env.DATA_SECRET, 'token', code), encrypted: await encryptToken(env.DATA_SECRET, code) })));
        const existing = await env.DB.batch(records.map(row => env.DB.prepare('SELECT digest FROM tokens WHERE digest = ?').bind(row.hash)));
        records.forEach((row, index) => {
          if (existing[index].results.length) return;
          codes.add(row.code);
          statements.push(env.DB.prepare('INSERT INTO tokens (digest, hint, batch_id, code_encrypted) VALUES (?, ?, ?, ?)').bind(row.hash, `•••• ${row.code.slice(-2)}`, id, row.encrypted));
        });
      }
      if (codes.size !== body.count) failure(409, '새 토큰을 준비하지 못했습니다. 수량을 줄여 다시 발급해주세요.');
      statements.push(env.DB.prepare("INSERT INTO logs (type, description, actor) VALUES ('TOKENS', ?, ?)").bind(`토큰 ${codes.size}개 발급 · ${label}`, actor));
      await env.DB.batch(statements);
      return json({ codes: [...codes], batch: { id, label } }, 201);
    }
    if (path === '/api/admin/tokens/manage' && method === 'POST') {
      const body = await readJSON(request);
      if (!['reset', 'delete'].includes(body.action) || !['all', 'selected'].includes(body.scope)) failure(400, '토큰 관리 요청을 확인해주세요.');
      let ids = [];
      if (body.scope === 'selected') {
        if (!Array.isArray(body.ids) || !body.ids.length || body.ids.length > 1000 || body.ids.some(id => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id))) failure(400, '선택한 토큰을 확인해주세요. 한 번에 최대 1,000개까지 처리할 수 있습니다.');
        ids = [...new Set(body.ids)];
      }
      const where = body.scope === 'all' ? '1 = 1' : 'digest IN (SELECT value FROM json_each(?))';
      const args = body.scope === 'all' ? [] : [JSON.stringify(ids)];
      const count = await env.DB.prepare(`SELECT count(*) AS count FROM tokens WHERE ${where}`).bind(...args).first();
      if (!count.count) failure(404, '처리할 토큰이 없습니다.');
      // A reset/delete releases claims only. Attendance and audit logs remain.
      // All three changes are atomic even when a student submits concurrently.
      const verb = body.action === 'reset' ? '상태 초기화' : '삭제';
      const results = await env.DB.batch([
        env.DB.prepare(`INSERT INTO logs (type, description, actor) SELECT 'TOKEN_MANAGE', '토큰 ' || count(*) || '개 ${verb}', ? FROM tokens WHERE ${where}`).bind(actor, ...args),
        env.DB.prepare(`DELETE FROM claims WHERE token_digest IN (SELECT digest FROM tokens WHERE ${where})`).bind(...args),
        env.DB.prepare(body.action === 'reset' ? `UPDATE tokens SET used_by = NULL, used_at = NULL WHERE ${where}` : `DELETE FROM tokens WHERE ${where}`).bind(...args),
      ]);
      return json({ count: results[2].meta.changes });
    }
    if (path === '/api/admin/students' && method === 'POST') {
      const { students } = await readJSON(request);
      if (!Array.isArray(students) || !students.length || students.length > 250) failure(400, '명단은 한 번에 1~250명까지 등록할 수 있습니다.');
      const unique = new Set();
      const statements = [];
      for (const row of students) {
        const { studentId, name } = studentInput(row);
        if (unique.has(studentId)) failure(400, '명단에 중복된 학번이 있습니다.');
        unique.add(studentId);
        statements.push(env.DB.prepare(`INSERT INTO students (id, name, name_mask, name_digest) VALUES (?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET name = excluded.name, name_mask = excluded.name_mask, name_digest = excluded.name_digest`).bind(studentId, name, maskName(name), await digest(env.DATA_SECRET, 'name', `${studentId}:${normalizeName(name)}`)));
      }
      statements.push(env.DB.prepare("INSERT INTO logs (type, description, actor) VALUES ('IMPORT', ?, ?)").bind(`명단 ${students.length}명 등록·갱신`, actor));
      await env.DB.batch(statements);
      return json({ count: students.length });
    }
    failure(404, '요청한 기능을 찾을 수 없습니다.');
  }
  // There is deliberately no public token list, individual token lookup, or DB proxy.
  failure(404, '요청한 기능을 찾을 수 없습니다.');
}
export async function handleRequest(request, env) {
  let response;
  try { response = await routes(request, env); }
  catch (error) {
    if (error instanceof HttpError) response = json({ error: error.message, code: error.code }, error.status);
    else { console.error('p0as request failed:', String(error.message).replace(/[\r\n]/g, ' ').slice(0, 180)); response = json({ error: '처리를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.', code: 'INTERNAL_ERROR' }, 500); }
  }
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'same-origin');
  response.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  return response;
}
