import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import { digest, encryptToken, maskName } from '../server/security.js';

export const demoStudents = ['가상하나', '가상둘', '가상셋', '가상넷', '가상다섯', '가상여섯', '가상일곱', '가상여덟', '가상아홉', '가상열', '가상열하나', '가상열둘', '가상열셋', '가상열넷', '가상열다섯', '가상열여섯'].map((name, i) => ({ studentId: String(26000001 + i), name }));
export const demoCodes = ['482913', '715204', '390681', '862507', '154398', '607142', '923816', '248065'];
export function openLocalDatabase(path = ':memory:') {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const sqlite = new DatabaseSync(path);
  sqlite.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
  class Statement {
    constructor(sql, args = []) { this.sql = sql; this.args = args; }
    bind(...args) { return new Statement(this.sql, args); }
    async first(column) { const row = sqlite.prepare(this.sql).get(...this.args); return column ? row?.[column] ?? null : row ? { ...row } : null; }
    async all() { return { results: sqlite.prepare(this.sql).all(...this.args).map(row => ({ ...row })), success: true }; }
    async run() { const result = sqlite.prepare(this.sql).run(...this.args); return { success: true, meta: { changes: result.changes, last_row_id: result.lastInsertRowid } }; }
  }
  return {
    sqlite,
    prepare: sql => new Statement(sql),
    async batch(statements) {
      sqlite.exec('BEGIN IMMEDIATE');
      try {
        const results = statements.map(statement => {
          const prepared = sqlite.prepare(statement.sql);
          if (prepared.columns().length) return { results: prepared.all(...statement.args).map(row => ({ ...row })), success: true };
          const result = prepared.run(...statement.args);
          return { results: [], success: true, meta: { changes: result.changes } };
        });
        sqlite.exec('COMMIT'); return results;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
    close: () => sqlite.close(),
  };
}
export function migrateLocal(db) {
  db.sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');
  const directory = new URL('../migrations/', import.meta.url);
  for (const name of readdirSync(directory).filter(name => name.endsWith('.sql')).sort()) {
    if (db.sqlite.prepare('SELECT name FROM local_migrations WHERE name = ?').get(name)) continue;
    db.sqlite.exec('BEGIN IMMEDIATE');
    try { db.sqlite.exec(readFileSync(new URL(name, directory), 'utf8')); db.sqlite.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(name); db.sqlite.exec('COMMIT'); }
    catch (error) { db.sqlite.exec('ROLLBACK'); throw error; }
  }
}
export async function seedLocal(db, env) {
  // Local-only metadata survives an application reset so restarting does not restore deleted fixtures.
  db.sqlite.exec('CREATE TABLE IF NOT EXISTS local_seed_state (id INTEGER PRIMARY KEY CHECK (id = 1))');
  if ((await db.prepare('SELECT count(*) AS count FROM students').first()).count) {
    for (const row of demoStudents) await db.prepare('UPDATE students SET name = ? WHERE id = ? AND name IS NULL AND name_digest = ?').bind(row.name, row.studentId, await digest(env.DATA_SECRET, 'name', `${row.studentId}:${row.name}`)).run();
    for (const code of demoCodes) await db.prepare('UPDATE tokens SET code_encrypted = ? WHERE digest = ? AND code_encrypted IS NULL').bind(await encryptToken(env.DATA_SECRET, code), await digest(env.DATA_SECRET, 'token', code)).run();
    await db.prepare("UPDATE token_batches SET label = '현장 배부용' WHERE id = 'demo-local'").run();
    await db.prepare("UPDATE logs SET description = '명단 16명 등록' WHERE actor = 'local-seed' AND type = 'IMPORT'").run();
    await db.prepare('INSERT OR IGNORE INTO local_seed_state (id) VALUES (1)').run();
    return false;
  }
  if (await db.prepare('SELECT id FROM local_seed_state WHERE id = 1').first()) return false;
  await db.prepare("UPDATE settings SET title = 'K-MOOC 특강', state = 'OPEN' WHERE id = 1").run();
  for (const row of demoStudents) {
    await db.prepare('INSERT INTO students (id, name, name_mask, name_digest) VALUES (?, ?, ?, ?)').bind(row.studentId, row.name, maskName(row.name), await digest(env.DATA_SECRET, 'name', `${row.studentId}:${row.name}`)).run();
  }
  await db.prepare("INSERT INTO token_batches (id, label) VALUES ('demo-local', '현장 배부용')").run();
  for (const code of demoCodes) await db.prepare("INSERT INTO tokens (digest, hint, batch_id, code_encrypted) VALUES (?, ?, 'demo-local', ?)").bind(await digest(env.DATA_SECRET, 'token', code), `•••• ${code.slice(-2)}`, await encryptToken(env.DATA_SECRET, code)).run();
  for (const index of [2, 4, 6]) await db.prepare('INSERT INTO claims (id, student_id, token_digest) VALUES (?, ?, ?)').bind(crypto.randomUUID(), demoStudents[index].studentId, await digest(env.DATA_SECRET, 'token', demoCodes[index])).run();
  await db.prepare("UPDATE students SET is_attended = 1, attendance_type = 'ASSIGNMENT', score = 5, attended_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = '26000009'").run();
  await db.prepare("UPDATE students SET trial_count = 3 WHERE id = '26000012'").run();
  await db.prepare("INSERT INTO logs (type, description, actor) VALUES ('IMPORT', '명단 16명 등록', 'local-seed')").run();
  await db.prepare('INSERT INTO local_seed_state (id) VALUES (1)').run();
  return true;
}
export async function developmentEnvironment(directory = '.local') {
  const root = resolve(directory);
  mkdirSync(root, { recursive: true });
  const secretsPath = resolve(root, 'secrets.json');
  if (!existsSync(secretsPath)) writeFileSync(secretsPath, JSON.stringify({ SESSION_SECRET: randomBytes(48).toString('hex'), DATA_SECRET: randomBytes(48).toString('hex') }), { mode: 0o600 });
  const secrets = JSON.parse(readFileSync(secretsPath, 'utf8'));
  const db = openLocalDatabase(resolve(root, 'p0as.sqlite'));
  const env = { ...secrets, LOCAL_DEV: '1', DB: db };
  migrateLocal(db); await seedLocal(db, env);
  return env;
}
