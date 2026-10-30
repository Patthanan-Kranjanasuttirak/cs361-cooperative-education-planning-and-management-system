-- เปลี่ยนบทบาทอาจารย์ (ที่ปรึกษา/นิเทศก์) เป็นกรรมการสหกิจศึกษา และเพิ่มขั้นตอนคัดเลือกเข้าแผนสหกิจศึกษา
--   เจ้าหน้าที่คัดกรองเบื้องต้น + โน้ต (screening_*) → กรรมการเลือกผ่าน/ไม่ผ่าน (committee_*)
--   → เจ้าหน้าที่ประกาศผลทีละคนหรือทั้งหมด (students.coop_result)
--   นักศึกษาไม่เห็นโน้ตและผลของกรรมการ เห็นเฉพาะผลที่ประกาศแล้ว
-- ใบสมัครบริษัทไม่ต้องให้อาจารย์นิเทศก์อนุมัติแล้ว: submitted ส่งถึงบริษัทโดยตรง
-- คอลัมน์ users.is_supervisor, students.advisor_id ยังเก็บไว้ (ไม่ใช้แล้ว) เพื่อไม่ลบข้อมูลเดิม รันซ้ำได้
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL search_path = public;
-- ลบ CHECK ที่อ้างบทบาท advisor (users.role และ is_supervisor) แล้วสร้าง CHECK ของบทบาทใหม่
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'users'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) LIKE '%advisor%' LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;
UPDATE users SET role = 'committee' WHERE role = 'advisor';
UPDATE users SET is_supervisor = FALSE WHERE is_supervisor;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('student', 'committee', 'staff', 'company'));

ALTER TABLE students ADD COLUMN IF NOT EXISTS screening_status VARCHAR(10) CHECK (screening_status IN ('passed', 'failed'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS screening_note TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS screening_by INTEGER REFERENCES users (user_id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS screening_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS committee_result VARCHAR(10) CHECK (committee_result IN ('passed', 'failed'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS committee_by INTEGER REFERENCES users (user_id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS committee_at TIMESTAMPTZ;
COMMIT;
