-- ข้อมูลสำหรับ Load Test (CS361) — ข้อมูลสมมติทั้งหมด ไม่มีข้อมูลผู้ใช้จริง
-- ห้ามรันบน Production ต้องตั้ง session ก่อน:  SET loadtest.target = 'non-production';
-- ห้ามย้ายไฟล์นี้ไปไว้ใน database/seeds เพราะ migrate {"seeds":true} จะรันทุก seed ในทุก environment
--
-- เครื่องหมายข้อมูลทดสอบ (cleanup.sql ลบตามนี้):
--   users      (username LIKE 'lt.%' หรือ username LIKE '6799999%') และ email LIKE '%@loadtest.example.test'
--   companies  name LIKE '[LOADTEST]%'  (positions / company_users ลบตามแบบ CASCADE)
--   terms      code = 'LT-TEST'         (สร้างเฉพาะเมื่อยังไม่มีภาคการศึกษาที่ active)
--
-- สิ่งที่สร้าง:
--   บัญชี login 10 บัญชี: lt.student01–08 (ผ่านเข้าแผน มี transcript/CV), lt.staff, lt.company
--   บัญชียื่นแผน 8 บัญชี: lt.plan01–08 รหัสสมมติ 6799999001–008 (ยังไม่ยื่นสมัครแผน ใช้ทดสอบ PUT /api/students/me)
--   นักศึกษา background 300 คน (login ไม่ได้: auth_provider='loadtest', cognito_sub ตั้งไว้แล้ว)
--   บริษัท 60 แห่ง × 5 ตำแหน่ง = 300 ตำแหน่ง (term_id NULL, เปิดรับ, อยู่ในช่วงรับสมัคร)
--   ใบสมัคร background 600 ใบ + history ตามลำดับสถานะ (นักศึกษา login ยังไม่มีใบสมัคร ใช้ทดสอบการเขียน)
BEGIN;

DO $$
BEGIN
  IF current_setting('loadtest.target', true) IS DISTINCT FROM 'non-production' THEN
    RAISE EXCEPTION 'ไม่รัน seed: ต้อง SET loadtest.target = ''non-production'' ก่อน (ห้ามใช้กับ Production)';
  END IF;
  IF EXISTS (SELECT 1 FROM users WHERE username LIKE 'lt.%' OR email LIKE '%@loadtest.example.test')
     OR EXISTS (SELECT 1 FROM companies WHERE name LIKE '[LOADTEST]%') THEN
    RAISE EXCEPTION 'มีข้อมูล Load Test อยู่แล้ว ให้รัน loadtest/cleanup.sql ก่อน';
  END IF;
  -- รหัสสมมติของบัญชียื่นแผนต้องไม่ชนกับผู้ใช้ที่มีอยู่ (ไม่ใช้ข้อมูลผู้ใช้จริง)
  IF EXISTS (SELECT 1 FROM users WHERE username LIKE '6799999%') THEN
    RAISE EXCEPTION 'มีผู้ใช้ username 6799999xxx อยู่แล้ว ไม่สร้างบัญชียื่นแผนทับ';
  END IF;
END $$;

-- ภาคการศึกษา: ใช้ภาคที่ active อยู่ ถ้าไม่มีให้สร้าง LT-TEST ที่ครอบวันนี้
INSERT INTO terms (code, plan_open_at, plan_close_at, coop_start, coop_end, is_active)
SELECT 'LT-TEST', d - 30, d + 60, d + 90, d + 210, TRUE
FROM (SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date AS d) today
WHERE NOT EXISTS (SELECT 1 FROM terms WHERE is_active);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM terms WHERE is_active
                 AND (now() AT TIME ZONE 'Asia/Bangkok')::date BETWEEN plan_open_at AND plan_close_at) THEN
    RAISE EXCEPTION 'ภาคการศึกษาที่ active ไม่อยู่ในช่วงเปิดรับวันนี้ POST /api/applications จะได้ 409 ให้ปรับวันที่ภาคการศึกษาก่อน';
  END IF;
END $$;

-- บัญชี login 10 บัญชี (auth_provider='dev' → local ใช้ DEV_AUTH_PASSWORD, AWS ใช้ MOCK_LOGINS/MOCK_PASSWORD)
INSERT INTO users (auth_provider, username, cognito_sub, role, th_name, en_name, email, phone)
SELECT 'dev', 'lt.student' || lpad(n::text, 2, '0'), 'dev:lt:student' || n, 'student',
       'นักศึกษาโหลดเทสต์ ' || n, 'Load Test Student ' || n,
       'lt.student' || lpad(n::text, 2, '0') || '@loadtest.example.test', '0890000' || lpad(n::text, 3, '0')
FROM generate_series(1, 8) n;

INSERT INTO users (auth_provider, username, cognito_sub, role, th_name, en_name, email, phone) VALUES
  ('dev', 'lt.staff',   'dev:lt:staff',   'staff',   'เจ้าหน้าที่โหลดเทสต์',  'Load Test Staff',       'lt.staff@loadtest.example.test',   '0890000901'),
  ('dev', 'lt.company', 'dev:lt:company', 'company', 'ผู้ประสานงานโหลดเทสต์', 'Load Test Coordinator', 'lt.company@loadtest.example.test', '0890000902');

-- นักศึกษา background (เพิ่มปริมาณข้อมูล ไม่ใช้ login)
INSERT INTO users (auth_provider, username, cognito_sub, role, th_name, en_name, email)
SELECT 'loadtest', 'lt.bg' || lpad(n::text, 4, '0'), 'loadtest:bg:' || n, 'student',
       'นักศึกษาสมมติ ' || n, 'Synthetic Student ' || n, 'lt.bg' || lpad(n::text, 4, '0') || '@loadtest.example.test'
FROM generate_series(1, 300) n;

-- ทุกคนผ่านเข้าแผนแล้ว มี transcript/CV (key สมมติ ไม่มีไฟล์จริงใน storage — อย่าทดสอบดาวน์โหลดเอกสาร)
INSERT INTO students (user_id, gpax, transcript_s3_key, cv_s3_key, address, major, curriculum,
                      profile_status, screening_status, screening_by, screening_at,
                      committee_result, committee_at, coop_result, coop_result_by, coop_result_at)
SELECT u.user_id, 2.75 + (u.user_id * 37 % 125) / 100.0,
       u.user_id || '/transcript-' || gen_random_uuid() || '.pdf',
       u.user_id || '/cv-' || gen_random_uuid() || '.pdf',
       'ที่อยู่สมมติสำหรับ Load Test', (ARRAY['CIS', 'ACS'])[1 + u.user_id % 2], '66',
       'pending', 'passed', staff.user_id, now(), 'passed', now(), 'passed', staff.user_id, now()
FROM users u CROSS JOIN users staff
WHERE u.role = 'student' AND u.username LIKE 'lt.%' AND staff.username = 'lt.staff';

-- บัญชียื่นสมัครแผนสหกิจ: username = รหัสนักศึกษาสมมติ 10 หลัก (ขึ้นต้น 67 → หลักสูตร 66, ปี 3 ในปีการศึกษา 2569)
-- ยังไม่ยื่นสมัคร (profile_status NULL) มีเพียง key เอกสารสมมติ เพราะ load test ไม่อัปโหลดไฟล์จริง
-- ข้อมูลคุณสมบัติ/ส่วนตัวที่เหลือ locustfile ส่งมาใน PUT /api/students/me เหมือนหน้า /student/profile
INSERT INTO users (auth_provider, username, cognito_sub, role, th_name, en_name, email, phone)
SELECT 'dev', '6799999' || lpad(n::text, 3, '0'), 'dev:lt:plan' || n, 'student',
       'นักศึกษายื่นแผนโหลดเทสต์ ' || n, 'Load Test Plan Applicant ' || n,
       'lt.plan' || lpad(n::text, 2, '0') || '@loadtest.example.test', '0890001' || lpad(n::text, 3, '0')
FROM generate_series(1, 8) n;

INSERT INTO students (user_id, transcript_s3_key, cv_s3_key, photo_s3_key)
SELECT u.user_id, u.user_id || '/transcript-' || gen_random_uuid() || '.pdf',
       u.user_id || '/cv-' || gen_random_uuid() || '.pdf', u.user_id || '/photo-' || gen_random_uuid() || '.jpg'
FROM users u WHERE u.username LIKE '6799999%' AND u.email LIKE 'lt.plan%@loadtest.example.test';

-- บริษัท 60 แห่ง ช่วงรับสมัครครอบวันนี้
INSERT INTO companies (name, description, province, location, allowance, additional_info, application_start, application_end)
SELECT '[LOADTEST] บริษัททดสอบ ' || lpad(n::text, 3, '0'), 'ข้อมูลสมมติสำหรับ Load Test ไม่ใช่สถานประกอบการจริง',
       (ARRAY['กรุงเทพมหานคร', 'ปทุมธานี', 'นนทบุรี', 'ชลบุรี', 'เชียงใหม่'])[1 + n % 5],
       'ที่อยู่สมมติ เลขที่ ' || n, (300 + n % 5 * 100) || ' บาท/วัน', 'ข้อมูลเพิ่มเติมสมมติ',
       d - 30, d + 120
FROM generate_series(1, 60) n, (SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date AS d) today;

INSERT INTO positions (company_id, name, description, quota, term_id, is_open)
SELECT c.company_id, p.name, 'ตำแหน่งสมมติสำหรับ Load Test', 3 + c.company_id % 5, NULL, TRUE
FROM companies c
CROSS JOIN (VALUES ('Software Developer'), ('QA Engineer'), ('Data Analyst'), ('UX/UI Designer'), ('DevOps Engineer')) p(name)
WHERE c.name LIKE '[LOADTEST]%';

INSERT INTO company_users (user_id, company_id, job_title)
SELECT u.user_id, c.company_id, 'ผู้ประสานงาน (ทดสอบ)'
FROM users u, companies c WHERE u.username = 'lt.company' AND c.name = '[LOADTEST] บริษัททดสอบ 001';

-- ใบสมัคร background: นักศึกษาละ 2 ใบคนละตำแหน่ง ในภาคที่ active
CREATE TEMP TABLE lt_bg ON COMMIT DROP AS
SELECT s.student_id, s.cv_s3_key, row_number() OVER (ORDER BY u.username) AS k
FROM students s JOIN users u USING (user_id) WHERE u.username LIKE 'lt.bg%';

CREATE TEMP TABLE lt_pos ON COMMIT DROP AS
SELECT p.position_id, row_number() OVER (ORDER BY p.position_id) AS j
FROM positions p JOIN companies c USING (company_id) WHERE c.name LIKE '[LOADTEST]%';

INSERT INTO applications (student_id, term_id, position_id, status, resume_s3_key, submitted_at)
SELECT b.student_id, t.term_id, p.position_id,
       CASE WHEN slot = 1 THEN (ARRAY['submitted', 'accepted', 'declined', 'confirmed', 'withdrawn', 'submitted'])[1 + b.k % 6]
            WHEN b.k % 6 = 3 THEN 'withdrawn' ELSE 'submitted' END,
       b.cv_s3_key, now() - (b.k % 20) * interval '1 day'
FROM lt_bg b
CROSS JOIN (VALUES (1), (2)) slots(slot)
JOIN lt_pos p ON p.j = (b.k * 7 + (slot - 1) * 150) % 300 + 1
CROSS JOIN (SELECT term_id FROM terms WHERE is_active) t;

-- history ตามลำดับสถานะ (บริษัทตัดสินโดย lt.company, นอกนั้นโดยนักศึกษา)
WITH paths AS (
  SELECT a.*, CASE a.status
    WHEN 'submitted' THEN ARRAY['submitted'] WHEN 'accepted' THEN ARRAY['submitted', 'accepted']
    WHEN 'declined' THEN ARRAY['submitted', 'declined'] WHEN 'confirmed' THEN ARRAY['submitted', 'accepted', 'confirmed']
    ELSE ARRAY['submitted', 'withdrawn'] END AS statuses
  FROM applications a JOIN lt_bg b USING (student_id)
), events AS (
  SELECT p.*, e.status AS event_status, e.ordinality
  FROM paths p CROSS JOIN LATERAL unnest(p.statuses) WITH ORDINALITY e(status, ordinality)
)
INSERT INTO application_history (application_id, changed_by, from_status, to_status, position_id, resume_s3_key, changed_at)
SELECT e.application_id, CASE WHEN e.event_status IN ('accepted', 'declined') THEN coordinator.user_id ELSE s.user_id END,
       e.statuses[e.ordinality::int - 1], e.event_status, e.position_id, e.resume_s3_key,
       e.submitted_at + (e.ordinality - 1) * interval '1 hour'
FROM events e JOIN students s USING (student_id)
CROSS JOIN users coordinator WHERE coordinator.username = 'lt.company';

SELECT 'users' AS table_name, count(*) AS rows FROM users WHERE email LIKE '%@loadtest.example.test'
UNION ALL SELECT 'students', count(*) FROM students JOIN users USING (user_id) WHERE email LIKE '%@loadtest.example.test'
UNION ALL SELECT 'companies', count(*) FROM companies WHERE name LIKE '[LOADTEST]%'
UNION ALL SELECT 'positions', count(*) FROM positions JOIN companies USING (company_id) WHERE companies.name LIKE '[LOADTEST]%'
UNION ALL SELECT 'applications', count(*) FROM applications JOIN students USING (student_id) JOIN users USING (user_id) WHERE username LIKE 'lt.%'
UNION ALL SELECT 'application_history', count(*) FROM application_history h JOIN applications a USING (application_id)
  JOIN students USING (student_id) JOIN users USING (user_id) WHERE username LIKE 'lt.%';

COMMIT;
