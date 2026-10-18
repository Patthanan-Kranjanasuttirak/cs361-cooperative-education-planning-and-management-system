-- Restore the student course form without discarding existing profile data.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL search_path = public;
ALTER TABLE students ADD COLUMN IF NOT EXISTS curriculum VARCHAR(2)
    CHECK (curriculum IN ('61', '66'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS course_grades JSONB NOT NULL DEFAULT '{}'
    CHECK (jsonb_typeof(course_grades) = 'object');
ALTER TABLE students ADD COLUMN IF NOT EXISTS declarations JSONB NOT NULL DEFAULT '{}'
    CHECK (jsonb_typeof(declarations) = 'object');
COMMIT;
