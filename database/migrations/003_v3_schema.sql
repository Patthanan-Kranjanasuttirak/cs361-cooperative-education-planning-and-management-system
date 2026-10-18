-- V3 (#31): upgrade V1 or V2 in place. Run with psql -v ON_ERROR_STOP=1.
-- Forward-only: back up the database before removing legacy password hashes.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL search_path = public;
SELECT pg_advisory_xact_lock(361, 3);

-- V1 used id rather than company_id / position_id. Renaming keeps rows and FKs.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'companies' AND column_name = 'id') THEN
        ALTER TABLE companies RENAME COLUMN id TO company_id;
        ALTER SEQUENCE IF EXISTS companies_id_seq RENAME TO companies_company_id_seq;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'positions' AND column_name = 'id') THEN
        ALTER TABLE positions RENAME COLUMN id TO position_id;
        ALTER SEQUENCE IF EXISTS positions_id_seq RENAME TO positions_position_id_seq;
    END IF;
END $$;

-- V3 table definitions are a snapshot, independent of future init file changes.
-- ลำดับสถานะของใบสมัคร (applications.status)
--   submitted → approved | rejected        อาจารย์ที่ปรึกษา หรือ เจ้าหน้าที่ คนใดคนหนึ่งตรวจ
--   approved  → accepted | declined        บริษัทตัดสิน (เห็นเฉพาะใบที่ approved แล้ว)
--   accepted  → confirmed                  นักศึกษายืนยันสิทธิ์ได้ที่เดียวต่อภาคการศึกษา
--     เมื่อยืนยันแล้ว ใบอื่นในภาคเดียวกัน: accepted → released, submitted/approved → withdrawn
--   submitted | approved → withdrawn       นักศึกษาถอนใบสมัครเอง

-- ผู้ใช้ทุกบทบาท
-- การยืนยันตัวตนอยู่ที่ผู้ให้บริการภายนอก ไม่เก็บรหัสผ่านในฐานข้อมูลนี้
CREATE TABLE IF NOT EXISTS users (
    user_id       SERIAL PRIMARY KEY,
    auth_provider VARCHAR(10)  NOT NULL,
    username      VARCHAR(50)  NOT NULL UNIQUE,
    cognito_sub   VARCHAR(64)  UNIQUE,
    role          VARCHAR(20)  NOT NULL CHECK (role IN ('student', 'advisor', 'staff', 'company')),
    th_name       VARCHAR(255) NOT NULL,
    en_name       VARCHAR(255) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    phone         VARCHAR(20),
    is_active     BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ภาคการศึกษาที่เปิดรับแผนสหกิจ (เปิดใช้งานได้ทีละภาค)
CREATE TABLE IF NOT EXISTS terms (
    term_id       SERIAL PRIMARY KEY,
    code          VARCHAR(20) NOT NULL UNIQUE,
    plan_open_at  DATE        NOT NULL,
    plan_close_at DATE        NOT NULL,
    coop_start    DATE        NOT NULL,
    coop_end      DATE        NOT NULL,
    is_active     BOOLEAN     NOT NULL DEFAULT FALSE,
    CHECK (plan_close_at >= plan_open_at),
    CHECK (coop_end >= coop_start)
);


CREATE TABLE IF NOT EXISTS companies (
    company_id        SERIAL PRIMARY KEY,
    name              VARCHAR(255) NOT NULL,
    logo              VARCHAR(255),
    description       TEXT,
    province          VARCHAR(100),
    location          TEXT,
    application_start DATE,
    application_end   DATE,
    CHECK (application_end IS NULL OR application_start IS NULL OR application_end >= application_start)
);


-- term_id เป็น NULL ได้สำหรับตำแหน่งที่ไม่ผูกกับภาคการศึกษา
-- quota เป็นข้อมูลแสดงผลเท่านั้น บริษัทกดปิดรับเองผ่าน is_open
CREATE TABLE IF NOT EXISTS positions (
    position_id SERIAL PRIMARY KEY,
    company_id  INTEGER      NOT NULL REFERENCES companies (company_id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    quota       INTEGER CHECK (quota IS NULL OR quota >= 0),
    term_id     INTEGER REFERENCES terms (term_id),
    is_open     BOOLEAN      NOT NULL DEFAULT TRUE
);


CREATE TABLE IF NOT EXISTS students (
    student_id        SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL UNIQUE REFERENCES users (user_id) ON DELETE CASCADE,
    gpax              NUMERIC(3, 2) CHECK (gpax IS NULL OR gpax BETWEEN 0 AND 4),
    transcript_s3_key VARCHAR(512),
    advisor_id        INTEGER REFERENCES users (user_id) ON DELETE SET NULL
);


-- ผู้ประสานงานของบริษัท (users.role = 'company')
CREATE TABLE IF NOT EXISTS company_users (
    user_id    INTEGER PRIMARY KEY REFERENCES users (user_id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies (company_id) ON DELETE CASCADE,
    job_title  VARCHAR(150)
);


-- ใบสมัครอ้างภาคการศึกษาและตำแหน่งแยกกัน เพื่อรองรับตำแหน่งที่ term_id เป็น NULL
CREATE TABLE IF NOT EXISTS applications (
    application_id SERIAL PRIMARY KEY,
    student_id     INTEGER     NOT NULL REFERENCES students (student_id) ON DELETE CASCADE,
    term_id        INTEGER     NOT NULL REFERENCES terms (term_id),
    position_id    INTEGER     NOT NULL REFERENCES positions (position_id),
    status         VARCHAR(20) NOT NULL DEFAULT 'submitted'
                   CHECK (status IN ('submitted', 'approved', 'rejected', 'accepted',
                                     'declined', 'confirmed', 'released', 'withdrawn')),
    resume_s3_key  VARCHAR(512),
    submitted_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (student_id, term_id, position_id)
);


-- นักศึกษายืนยันสิทธิ์ได้ที่เดียวต่อภาคการศึกษา

-- ผลการตรวจของอาจารย์ที่ปรึกษาหรือเจ้าหน้าที่ (ผ่าน 1 รายการก็เปลี่ยนใบสมัครเป็น approved)
CREATE TABLE IF NOT EXISTS application_reviews (
    review_id      SERIAL PRIMARY KEY,
    application_id INTEGER     NOT NULL REFERENCES applications (application_id) ON DELETE CASCADE,
    reviewer_id    INTEGER     NOT NULL REFERENCES users (user_id),
    status         VARCHAR(20) NOT NULL CHECK (status IN ('approved', 'rejected')),
    comment        TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ประวัติการเปลี่ยนสถานะทุกครั้ง (position_id, resume_s3_key เป็นค่า ณ ตอนเปลี่ยน)
-- เพิ่มแถวใน transaction เดียวกับที่ update applications.status
CREATE TABLE IF NOT EXISTS application_history (
    history_id     SERIAL PRIMARY KEY,
    application_id INTEGER     NOT NULL REFERENCES applications (application_id) ON DELETE CASCADE,
    changed_by     INTEGER     REFERENCES users (user_id) ON DELETE SET NULL,
    from_status    VARCHAR(20),
    to_status      VARCHAR(20) NOT NULL,
    position_id    INTEGER     NOT NULL,
    resume_s3_key  VARCHAR(512),
    changed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);



LOCK TABLE users, students, company_users, positions, applications IN ACCESS EXCLUSIVE MODE;

-- CREATE TABLE IF NOT EXISTS above creates missing tables, not missing columns.
ALTER TABLE positions ADD COLUMN IF NOT EXISTS term_id INTEGER REFERENCES terms (term_id);
ALTER TABLE positions ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE positions ALTER COLUMN term_id DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);

-- Consolidate phone numbers before removing their old columns. Conflicting
-- values abort the whole transaction rather than silently discard a number.
CREATE TEMP TABLE v3_phone_sources (user_id INTEGER, phone VARCHAR(20)) ON COMMIT DROP;
INSERT INTO v3_phone_sources SELECT user_id, phone FROM users WHERE phone IS NOT NULL;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'phone') THEN
        INSERT INTO v3_phone_sources SELECT user_id, phone FROM students WHERE phone IS NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'public' AND table_name = 'company_users' AND column_name = 'phone') THEN
        INSERT INTO v3_phone_sources SELECT user_id, phone FROM company_users WHERE phone IS NOT NULL;
    END IF;
    IF EXISTS (SELECT user_id FROM v3_phone_sources GROUP BY user_id HAVING COUNT(DISTINCT phone) > 1) THEN
        RAISE EXCEPTION 'V3 migration stopped: conflicting phone numbers for the same user. Reconcile users/students/company_users.phone and retry.';
    END IF;
END $$;
UPDATE users u SET phone = s.phone
FROM (SELECT user_id, MIN(phone) AS phone FROM v3_phone_sources GROUP BY user_id) s
WHERE u.user_id = s.user_id AND u.phone IS DISTINCT FROM s.phone;

ALTER TABLE students DROP COLUMN IF EXISTS phone;
ALTER TABLE company_users DROP COLUMN IF EXISTS phone;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_check;
ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_provider_check;
ALTER TABLE users ALTER COLUMN auth_provider DROP DEFAULT;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

-- V3 uses separate foreign keys, including for a position with no term.
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_position_id_term_id_fkey;
ALTER TABLE positions DROP CONSTRAINT IF EXISTS positions_position_id_term_id_key;
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_student_id_position_id_key;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'applications'::regclass AND conname = 'applications_term_id_fkey') THEN
        ALTER TABLE applications ADD CONSTRAINT applications_term_id_fkey FOREIGN KEY (term_id) REFERENCES terms (term_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'applications'::regclass AND conname = 'applications_position_id_fkey') THEN
        ALTER TABLE applications ADD CONSTRAINT applications_position_id_fkey FOREIGN KEY (position_id) REFERENCES positions (position_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'applications'::regclass AND conname = 'applications_student_id_term_id_position_id_key') THEN
        ALTER TABLE applications ADD CONSTRAINT applications_student_id_term_id_position_id_key UNIQUE (student_id, term_id, position_id);
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS one_active_term ON terms (is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_companies_province ON companies (province);
CREATE INDEX IF NOT EXISTS idx_positions_company_id ON positions (company_id);
CREATE INDEX IF NOT EXISTS idx_positions_term_id ON positions (term_id);
CREATE INDEX IF NOT EXISTS idx_students_advisor_id ON students (advisor_id);
CREATE INDEX IF NOT EXISTS idx_company_users_company_id ON company_users (company_id);
CREATE INDEX IF NOT EXISTS idx_applications_position_id ON applications (position_id);
CREATE INDEX IF NOT EXISTS idx_applications_student_term ON applications (student_id, term_id);
CREATE UNIQUE INDEX IF NOT EXISTS one_confirmed_per_term
    ON applications (student_id, term_id) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_application_reviews_application_id ON application_reviews (application_id);
CREATE INDEX IF NOT EXISTS idx_application_history_application_id ON application_history (application_id);

COMMIT;
