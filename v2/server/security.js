import { createRemoteJWKSet, jwtVerify } from 'jose';

const encoder = new TextEncoder();
const keysets = new Map();
const tokenKeys = new Map();
async function tokenKey(secret) {
  if (!tokenKeys.has(secret)) {
    if (tokenKeys.size >= 4) tokenKeys.clear();
    tokenKeys.set(secret, crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, ['deriveKey']).then(material => crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode('p0as/v2'), info: encoder.encode('token-display/v1') }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])));
  }
  return tokenKeys.get(secret);
}
const encode64 = bytes => btoa(String.fromCharCode(...bytes));
const decode64 = value => Uint8Array.from(atob(value), char => char.charCodeAt(0));
export async function encryptToken(secret, code) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await tokenKey(secret), encoder.encode(code));
  return `v1.${encode64(iv)}.${encode64(new Uint8Array(encrypted))}`;
}
export async function decryptToken(secret, value) {
  if (!value) return null;
  const [version, iv, payload, extra] = value.split('.');
  if (version !== 'v1' || !iv || !payload || extra) throw new Error('Invalid encrypted token');
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode64(iv) }, await tokenKey(secret), decode64(payload));
  const code = new TextDecoder().decode(decrypted);
  if (!/^\d{6}$/.test(code)) throw new Error('Invalid decrypted token');
  return code;
}
export class HttpError extends Error {
  constructor(status, message, code = 'REQUEST_FAILED') { super(message); this.status = status; this.code = code; }
}
export function localOnly(request, env) {
  return env.LOCAL_DEV === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname);
}
export function requireSecrets(env) {
  for (const name of ['SESSION_SECRET', 'DATA_SECRET']) {
    if (!env[name] || env[name].length < 32) throw new HttpError(503, '서버 설정을 확인 중입니다. 운영자에게 문의해주세요.', 'NOT_CONFIGURED');
  }
  if (env.SESSION_SECRET === env.DATA_SECRET) throw new HttpError(503, '서버 설정을 확인 중입니다.', 'NOT_CONFIGURED');
}
export async function digest(secret, domain, value) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${domain}\0${value}`));
  return Array.from(new Uint8Array(signed), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function normalizeName(value) { return String(value || '').normalize('NFC').trim().replace(/\s+/g, ' '); }
export function maskName(value) { const chars = [...normalizeName(value)]; return chars.length < 2 ? '*' : chars[0] + '*'.repeat(chars.length - 2 || 1) + (chars.length > 2 ? chars.at(-1) : ''); }
export function studentInput(body) {
  if (!body || typeof body.studentId !== 'string' || typeof body.name !== 'string') throw new HttpError(400, '학번과 이름을 확인해주세요.', 'INVALID_INPUT');
  const studentId = body.studentId.trim();
  const name = normalizeName(body.name);
  if (!/^[A-Za-z0-9-]{4,24}$/.test(studentId) || name.length < 1 || name.length > 40) throw new HttpError(400, '학번과 이름을 확인해주세요.', 'INVALID_INPUT');
  return { studentId, name };
}
export async function readJSON(request) {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new HttpError(415, '요청 형식이 올바르지 않습니다.');
  const reader = request.body?.getReader();
  const decoder = new TextDecoder();
  let raw = ''; let size = 0;
  if (reader) {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 100000) { await reader.cancel(); throw new HttpError(413, '한 번에 처리할 수 있는 크기를 초과했습니다.'); }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  }
  try { const body = JSON.parse(raw); if (!body || Array.isArray(body) || typeof body !== 'object') throw new Error(); return body; }
  catch { throw new HttpError(400, '입력 내용을 확인해주세요.'); }
}
export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new HttpError(403, '페이지를 새로 열고 다시 시도해주세요.', 'CROSS_ORIGIN');
}
export async function rateLimit(db, secret, scope, value, limit = 10, seconds = 60) {
  const now = Math.floor(Date.now() / 1000);
  const key = await digest(secret, `rate:${scope}`, value);
  const row = await db.prepare(`INSERT INTO rate_limits (key, count, resets_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = CASE WHEN resets_at <= ? THEN 1 ELSE count + 1 END,
    resets_at = CASE WHEN resets_at <= ? THEN excluded.resets_at ELSE resets_at END RETURNING count, resets_at`).bind(key, now + seconds, now, now).first();
  if (row.count > limit) throw new HttpError(429, '요청이 많습니다. 잠시 후 다시 시도해주세요.', 'RATE_LIMITED');
}
export async function issueSession(db, env, request, studentId, role = 'student', nameDigest) {
  const id = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = Math.floor(Date.now() / 1000) + 1800;
  const signature = await digest(env.SESSION_SECRET, 'session', `${id}.${expiresAt}`);
  const sessionId = await digest(env.SESSION_SECRET, 'sid', id);
  const insert = role === 'student'
    ? db.prepare("INSERT INTO sessions (id, student_id, role, expires_at) SELECT ?, id, 'student', ? FROM students WHERE id = ? AND name_digest = ?").bind(sessionId, expiresAt, studentId, nameDigest)
    : db.prepare('INSERT INTO sessions (id, student_id, role, expires_at) VALUES (?, ?, ?, ?)').bind(sessionId, studentId, role, expiresAt);
  const results = await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Math.floor(Date.now() / 1000)),
    insert,
    db.prepare('DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE resets_at <= ? LIMIT 128)').bind(Math.floor(Date.now() / 1000)),
  ]);
  if (!results[1].meta.changes) throw new HttpError(400, '학번 또는 이름이 일치하지 않습니다. 입력 내용을 확인해주세요.', 'IDENTITY_MISMATCH');
  return `p0as_session=${id}.${expiresAt}.${signature}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=1800${localOnly(request, env) ? '' : '; Secure'}`;
}
export async function session(request, env, role = 'student') {
  const raw = request.headers.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith('p0as_session='))?.slice('p0as_session='.length);
  if (!raw) throw new HttpError(401, '본인 정보를 다시 확인해주세요.', 'UNAUTHENTICATED');
  const [id, expires, signature, extra] = raw.split('.');
  if (extra || !id || !/^\d+$/.test(expires || '') || !/^[a-f0-9]{64}$/.test(signature || '') || Number(expires) <= Date.now() / 1000) throw new HttpError(401, '인증 시간이 지났습니다. 다시 확인해주세요.', 'UNAUTHENTICATED');
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const bytes = Uint8Array.from(signature.match(/../g), b => parseInt(b, 16));
  if (!await crypto.subtle.verify('HMAC', key, bytes, encoder.encode(`session\0${id}.${expires}`))) throw new HttpError(401, '인증을 다시 진행해주세요.', 'UNAUTHENTICATED');
  const sessionId = await digest(env.SESSION_SECRET, 'sid', id);
  const row = await env.DB.prepare('SELECT student_id, role FROM sessions WHERE id = ? AND expires_at > ?').bind(sessionId, Math.floor(Date.now() / 1000)).first();
  if (!row || row.role !== role) throw new HttpError(401, '인증을 다시 진행해주세요.', 'UNAUTHENTICATED');
  return { ...row, session_id: sessionId };
}
export async function admin(request, env) {
  if (localOnly(request, env)) { await session(request, env, 'admin'); return 'local-admin'; }
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token) throw new HttpError(401, '관리자 로그인이 필요합니다.', 'ADMIN_LOGIN_REQUIRED');
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAILS) throw new HttpError(503, '관리자 인증 설정이 필요합니다.', 'NOT_CONFIGURED');
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN.replace(/^https:\/\//, '').replace(/\/$/, '')}`;
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer)) throw new HttpError(503, '관리자 인증 설정을 확인해주세요.');
  try {
    if (!keysets.has(issuer)) keysets.set(issuer, createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)));
    const { payload } = await jwtVerify(token, keysets.get(issuer), { issuer, audience: env.ACCESS_AUD, algorithms: ['RS256'], requiredClaims: ['exp', 'email'] });
    const allowed = env.ADMIN_EMAILS.split(',').map(x => x.trim().toLowerCase());
    if (!payload.email || !allowed.includes(payload.email.toLowerCase())) throw new Error('unauthorized');
    return payload.email;
  } catch { throw new HttpError(403, '관리 권한이 없는 계정입니다.', 'FORBIDDEN'); }
}
