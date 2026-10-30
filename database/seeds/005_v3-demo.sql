-- Opt-in local development data. No credentials or real personal data.
BEGIN;
SELECT pg_advisory_xact_lock(361, 34);
INSERT INTO users (auth_provider, username, cognito_sub, role, th_name, en_name, email, phone) VALUES
 ('dev','v3.staff','dev:v3:staff','staff','เจ้าหน้าที่ทดสอบ','Demo Staff','staff.v3@tu.ac.th','020000001'),
 ('dev','v3.advisor','dev:v3:advisor','advisor','อาจารย์ทดสอบ','Demo Advisor','advisor.v3@tu.ac.th','020000002'),
 ('dev','v3.advisor.other','dev:v3:advisor:other','advisor','อาจารย์อีกคน','Other Advisor','advisor.other.v3@tu.ac.th','020000003'),
 ('dev','v3.company','dev:v3:company','company','ผู้ประสานงานทดสอบ','Demo Coordinator','company.v3@example.test','020000004'),
 ('dev','v3.company.other','dev:v3:company:other','company','ผู้ประสานงานอีกบริษัท','Other Coordinator','company.other.v3@example.test','020000005')
ON CONFLICT (username) DO NOTHING;
INSERT INTO users (auth_provider,username,cognito_sub,role,th_name,en_name,email,phone)
SELECT 'dev','660961003' || n,'dev:v3:student' || n,'student','นักศึกษาทดสอบ ' || n,'Demo Student ' || n,
       'student' || n || '.v3@dome.tu.ac.th','080000000' || n FROM generate_series(1,8) n
ON CONFLICT (username) DO NOTHING;
INSERT INTO students (user_id,gpax,advisor_id,curriculum)
SELECT u.user_id,3.30,a.user_id,'66' FROM users u CROSS JOIN users a
WHERE u.cognito_sub LIKE 'dev:v3:student%' AND a.username='v3.advisor'
ON CONFLICT (user_id) DO UPDATE SET curriculum=COALESCE(students.curriculum,EXCLUDED.curriculum);
-- อาจารย์ทดสอบเป็นทั้งที่ปรึกษาและนิเทศก์ ส่วนอาจารย์อีกคนเป็นที่ปรึกษาอย่างเดียว
UPDATE users SET is_supervisor=TRUE WHERE username='v3.advisor';
-- นักศึกษา demo ส่งข้อมูลแล้วและผ่านการคัดเลือกเข้าแผนสหกิจศึกษา (ต้องรัน migration 009 ก่อน)
UPDATE students s SET profile_status=COALESCE(s.profile_status,'pending'),
  coop_result=COALESCE(s.coop_result,'passed'),coop_result_by=COALESCE(s.coop_result_by,staff.user_id),coop_result_at=COALESCE(s.coop_result_at,now())
FROM users u, users staff WHERE u.user_id=s.user_id AND u.cognito_sub LIKE 'dev:v3:student%' AND staff.username='v3.staff';
INSERT INTO terms (code,plan_open_at,plan_close_at,coop_start,coop_end,is_active)
SELECT '2/2569','2026-08-01','2027-01-15','2027-01-18','2027-05-14',NOT EXISTS (SELECT 1 FROM terms WHERE is_active)
WHERE NOT EXISTS (SELECT 1 FROM terms WHERE code='2/2569');
INSERT INTO companies (name,description,province)
SELECT name,'ข้อมูลสมมติสำหรับทดสอบ V3','ปทุมธานี'
FROM (VALUES ('V3 Demo Company'),('V3 Other Company')) names(name)
WHERE NOT EXISTS (SELECT 1 FROM companies c WHERE c.name=names.name);
INSERT INTO company_users (user_id,company_id,job_title)
SELECT u.user_id,c.company_id,'ผู้ประสานงาน' FROM users u JOIN companies c ON
  (u.username='v3.company' AND c.name='V3 Demo Company') OR
  (u.username='v3.company.other' AND c.name='V3 Other Company')
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO positions (company_id,name,description,quota,term_id)
SELECT c.company_id,p.name,'ตำแหน่งสมมติสำหรับพัฒนา API',10,t.term_id
FROM companies c CROSS JOIN terms t CROSS JOIN (VALUES ('Demo Developer'),('Demo QA Engineer')) p(name)
WHERE c.name IN ('V3 Demo Company','V3 Other Company') AND t.code='2/2569'
 AND NOT EXISTS (SELECT 1 FROM positions old WHERE old.company_id=c.company_id AND old.name=p.name AND old.term_id=t.term_id);
INSERT INTO applications (student_id,term_id,position_id,status,submitted_at)
SELECT s.student_id,t.term_id,p.position_id,state.status,now()-interval '2 days'
FROM (VALUES (1,'submitted'),(2,'approved'),(3,'rejected'),(4,'accepted'),(5,'declined'),(6,'confirmed'),(7,'released'),(8,'withdrawn')) state(n,status)
JOIN users u ON u.cognito_sub='dev:v3:student' || state.n
JOIN students s ON s.user_id=u.user_id
JOIN companies c ON c.name='V3 Demo Company'
JOIN positions p ON p.company_id=c.company_id AND p.name='Demo Developer'
JOIN terms t ON t.term_id=p.term_id
ON CONFLICT (student_id,term_id,position_id) DO NOTHING;
-- Released students have confirmed the alternative position in the same term.
INSERT INTO applications (student_id,term_id,position_id,status,submitted_at)
SELECT s.student_id,p.term_id,p.position_id,'confirmed',now()-interval '2 days'
FROM users u JOIN students s USING(user_id) JOIN companies c ON c.name='V3 Demo Company'
JOIN positions p ON p.company_id=c.company_id AND p.name='Demo QA Engineer'
WHERE u.cognito_sub='dev:v3:student7'
ON CONFLICT (student_id,term_id,position_id) DO NOTHING;
INSERT INTO application_reviews (application_id,reviewer_id,status,comment,created_at)
SELECT a.application_id,reviewer.user_id,CASE WHEN a.status='rejected' THEN 'rejected' ELSE 'approved' END,
       'ผลการตรวจตัวอย่างสำหรับพัฒนา API',a.submitted_at+interval '5 minutes'
FROM applications a JOIN students s USING(student_id) JOIN users student ON student.user_id=s.user_id
CROSS JOIN users reviewer WHERE student.cognito_sub LIKE 'dev:v3:student%' AND reviewer.username='v3.advisor'
 AND a.status NOT IN ('submitted','withdrawn')
 AND NOT EXISTS (SELECT 1 FROM application_reviews r WHERE r.application_id=a.application_id);
WITH paths AS (
 SELECT a.*,CASE a.status
  WHEN 'submitted' THEN ARRAY['submitted'] WHEN 'approved' THEN ARRAY['submitted','approved']
  WHEN 'rejected' THEN ARRAY['submitted','rejected'] WHEN 'accepted' THEN ARRAY['submitted','approved','accepted']
  WHEN 'declined' THEN ARRAY['submitted','approved','declined'] WHEN 'confirmed' THEN ARRAY['submitted','approved','accepted','confirmed']
  WHEN 'released' THEN ARRAY['submitted','approved','accepted','released'] ELSE ARRAY['submitted','withdrawn'] END AS statuses
 FROM applications a JOIN students s USING(student_id) JOIN users u ON u.user_id=s.user_id
 WHERE u.cognito_sub LIKE 'dev:v3:student%' AND NOT EXISTS (SELECT 1 FROM application_history h WHERE h.application_id=a.application_id)
), events AS (
 SELECT p.*,e.status AS event_status,e.ordinality FROM paths p CROSS JOIN LATERAL unnest(p.statuses) WITH ORDINALITY e(status,ordinality)
)
INSERT INTO application_history (application_id,changed_by,from_status,to_status,position_id,resume_s3_key,changed_at)
SELECT e.application_id,CASE WHEN e.event_status IN ('approved','rejected') THEN advisor.user_id WHEN e.event_status IN ('accepted','declined') THEN coordinator.user_id ELSE s.user_id END,
 e.statuses[e.ordinality::int-1],e.event_status,e.position_id,e.resume_s3_key,e.submitted_at+(e.ordinality-1)*interval '5 minutes'
FROM events e JOIN students s USING(student_id) CROSS JOIN users advisor CROSS JOIN users coordinator
WHERE advisor.username='v3.advisor' AND coordinator.username='v3.company';
COMMIT;
