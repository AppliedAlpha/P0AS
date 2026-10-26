PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  title TEXT NOT NULL DEFAULT 'K-MOOC 특강',
  semester TEXT NOT NULL DEFAULT '이번 학기',
  state TEXT NOT NULL DEFAULT 'PRE' CHECK (state IN ('PRE', 'OPEN', 'CLOSED'))
);
INSERT OR IGNORE INTO settings (id) VALUES (1);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  name_mask TEXT NOT NULL,
  name_digest TEXT NOT NULL,
  trial_count INTEGER NOT NULL DEFAULT 0 CHECK (trial_count >= 0),
  is_attended INTEGER NOT NULL DEFAULT 0 CHECK (is_attended IN (0, 1)),
  attendance_type TEXT NOT NULL DEFAULT 'NONE',
  score INTEGER NOT NULL DEFAULT 0,
  attended_at TEXT
);
CREATE TABLE IF NOT EXISTS token_batches (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS tokens (
  digest TEXT PRIMARY KEY,
  hint TEXT NOT NULL,
  batch_id TEXT NOT NULL REFERENCES token_batches(id),
  used_by TEXT UNIQUE REFERENCES students(id),
  used_at TEXT
);
CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE REFERENCES students(id),
  token_digest TEXT NOT NULL UNIQUE REFERENCES tokens(digest),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id TEXT,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT 'student',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  student_id TEXT REFERENCES students(id),
  role TEXT NOT NULL CHECK (role IN ('student', 'admin')),
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  resets_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS logs_recent ON logs(id DESC);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);

-- A single claim insert validates and consumes a token atomically. The unique
-- constraints also protect against simultaneous requests from different clients.
CREATE TRIGGER IF NOT EXISTS validate_claim BEFORE INSERT ON claims BEGIN
  SELECT CASE
    WHEN (SELECT state FROM settings WHERE id = 1) != 'OPEN' THEN RAISE(ABORT, 'ATTENDANCE_CLOSED')
    WHEN NOT EXISTS (SELECT 1 FROM students WHERE id = NEW.student_id) THEN RAISE(ABORT, 'STUDENT_MISSING')
    WHEN (SELECT is_attended FROM students WHERE id = NEW.student_id) = 1 THEN RAISE(ABORT, 'ALREADY_ATTENDED')
    WHEN (SELECT trial_count FROM students WHERE id = NEW.student_id) >= 3 THEN RAISE(ABORT, 'STUDENT_LOCKED')
    WHEN NOT EXISTS (SELECT 1 FROM tokens WHERE digest = NEW.token_digest AND used_by IS NULL) THEN RAISE(ABORT, 'INVALID_TOKEN')
  END;
END;
CREATE TRIGGER IF NOT EXISTS record_claim AFTER INSERT ON claims BEGIN
  UPDATE tokens SET used_by = NEW.student_id, used_at = NEW.created_at WHERE digest = NEW.token_digest;
  UPDATE students SET is_attended = 1, attendance_type = 'FIELD', score = 5, attended_at = NEW.created_at WHERE id = NEW.student_id;
  INSERT INTO logs (student_id, type, description) VALUES (NEW.student_id, 'SUCCESS', '현장 출석 완료');
END;
