-- Keep every consumed token when attendance is revoked. A student may consume
-- a different token later; claims still permits only one current attendance.
-- Copy/drop child rows first so foreign keys remain valid throughout D1's
-- migration transaction. Restore claims before recreating their write triggers.
DROP TRIGGER validate_claim;
DROP TRIGGER record_claim;

CREATE TABLE claims_0003_backup AS
SELECT id, student_id, token_digest, created_at FROM claims;
DROP TABLE claims;

CREATE TABLE tokens_0003 (
  digest TEXT PRIMARY KEY,
  hint TEXT NOT NULL,
  batch_id TEXT NOT NULL REFERENCES token_batches(id),
  used_by TEXT REFERENCES students(id),
  used_at TEXT,
  code_encrypted TEXT
);
INSERT INTO tokens_0003 (rowid, digest, hint, batch_id, used_by, used_at, code_encrypted)
SELECT rowid, digest, hint, batch_id, used_by, used_at, code_encrypted FROM tokens;
DROP TABLE tokens;
ALTER TABLE tokens_0003 RENAME TO tokens;
CREATE INDEX tokens_used_by ON tokens(used_by);

CREATE TABLE claims (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL UNIQUE REFERENCES students(id),
  token_digest TEXT NOT NULL UNIQUE REFERENCES tokens(digest),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
INSERT INTO claims (id, student_id, token_digest, created_at)
SELECT id, student_id, token_digest, created_at FROM claims_0003_backup;
DROP TABLE claims_0003_backup;

CREATE TRIGGER validate_claim BEFORE INSERT ON claims BEGIN
  SELECT CASE
    WHEN (SELECT state FROM settings WHERE id = 1) != 'OPEN' THEN RAISE(ABORT, 'ATTENDANCE_CLOSED')
    WHEN NOT EXISTS (SELECT 1 FROM students WHERE id = NEW.student_id) THEN RAISE(ABORT, 'STUDENT_MISSING')
    WHEN (SELECT is_attended FROM students WHERE id = NEW.student_id) = 1 THEN RAISE(ABORT, 'ALREADY_ATTENDED')
    WHEN (SELECT trial_count FROM students WHERE id = NEW.student_id) >= 3 THEN RAISE(ABORT, 'STUDENT_LOCKED')
    WHEN NOT EXISTS (SELECT 1 FROM tokens WHERE digest = NEW.token_digest AND used_by IS NULL) THEN RAISE(ABORT, 'INVALID_TOKEN')
  END;
END;
CREATE TRIGGER record_claim AFTER INSERT ON claims BEGIN
  UPDATE tokens SET used_by = NEW.student_id, used_at = NEW.created_at WHERE digest = NEW.token_digest;
  UPDATE students SET is_attended = 1, attendance_type = 'FIELD', score = 5, attended_at = NEW.created_at WHERE id = NEW.student_id;
  INSERT INTO logs (student_id, type, description) VALUES (NEW.student_id, 'SUCCESS', '현장 출석 완료');
END;
