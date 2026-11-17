-- ลบข้อมูล Load Test ทั้งหมดที่ seed.sql สร้าง และใบสมัครที่เกิดระหว่างทดสอบ รันซ้ำได้
-- ลบเฉพาะแถวที่มีเครื่องหมายทดสอบ (ดู seed.sql) ไม่แตะข้อมูลอื่น
-- ข้อควรทราบ: ใบสมัครของบัญชีใดก็ตามที่สมัครตำแหน่ง [LOADTEST] จะถูกลบด้วย เพราะตำแหน่งต้องลบได้
-- ไฟล์ที่อัปโหลดผ่านบัญชีทดสอบ (ถ้ามี) ไม่ถูกลบจาก S3/.uploads ต้องลบตาม prefix <user_id>/ เอง
BEGIN;

CREATE TEMP TABLE lt_users ON COMMIT DROP AS
SELECT user_id FROM users WHERE username LIKE 'lt.%' AND email LIKE '%@loadtest.example.test';

CREATE TEMP TABLE lt_companies ON COMMIT DROP AS
SELECT company_id FROM companies WHERE name LIKE '[LOADTEST]%';

-- application_reviews.reviewer_id ไม่มี ON DELETE จึงต้องลบก่อนลบผู้ใช้
DELETE FROM application_reviews WHERE reviewer_id IN (SELECT user_id FROM lt_users);

-- applications.position_id ไม่มี ON DELETE จึงต้องลบใบสมัครก่อนลบตำแหน่ง (history/reviews ลบตามแบบ CASCADE)
DELETE FROM applications a
WHERE a.student_id IN (SELECT student_id FROM students WHERE user_id IN (SELECT user_id FROM lt_users))
   OR a.position_id IN (SELECT position_id FROM positions WHERE company_id IN (SELECT company_id FROM lt_companies));

DELETE FROM companies WHERE company_id IN (SELECT company_id FROM lt_companies); -- positions, company_users CASCADE
DELETE FROM users WHERE user_id IN (SELECT user_id FROM lt_users);              -- students, company_users CASCADE

-- ภาค LT-TEST ลบได้เมื่อไม่มีข้อมูลอื่นอ้างถึง (ถ้า staff เผลอใช้ภาคนี้สร้างข้อมูลจริง จะคงไว้)
DELETE FROM terms t WHERE t.code = 'LT-TEST'
  AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.term_id = t.term_id)
  AND NOT EXISTS (SELECT 1 FROM positions p WHERE p.term_id = t.term_id);

SELECT (SELECT count(*) FROM users WHERE username LIKE 'lt.%') AS remaining_lt_users,
       (SELECT count(*) FROM companies WHERE name LIKE '[LOADTEST]%') AS remaining_lt_companies,
       (SELECT count(*) FROM terms WHERE code = 'LT-TEST') AS remaining_lt_term;

COMMIT;
