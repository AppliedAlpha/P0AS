-- Existing attendance is preserved. Original values cannot be recovered from
-- hashes; legacy names/tokens remain NULL until re-imported or re-issued.
ALTER TABLE settings DROP COLUMN semester;
ALTER TABLE students ADD COLUMN name TEXT;
ALTER TABLE tokens ADD COLUMN code_encrypted TEXT;
