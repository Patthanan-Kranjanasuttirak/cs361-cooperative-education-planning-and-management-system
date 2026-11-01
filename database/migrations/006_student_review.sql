-- ตรวจข้อมูลนักศึกษาก่อนสมัคร: เจ้าหน้าที่ตรวจข้อมูล, อาจารย์ที่ปรึกษารับรองความประพฤติ, อาจารย์นิเทศก์ (users.is_supervisor) อนุมัติใบสมัคร
-- เพิ่มคอลัมน์อย่างเดียว ไม่ลบข้อมูลเดิม รันซ้ำได้
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL search_path = public;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_supervisor BOOLEAN NOT NULL DEFAULT FALSE
    CHECK (NOT is_supervisor OR role = 'advisor');
ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_status VARCHAR(20)
    CHECK (profile_status IN ('pending', 'verified', 'returned'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_comment TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_reviewed_by INTEGER REFERENCES users (user_id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS profile_reviewed_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS conduct_status VARCHAR(20)
    CHECK (conduct_status IN ('certified', 'rejected'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS conduct_comment TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS conduct_reviewed_by INTEGER REFERENCES users (user_id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS conduct_reviewed_at TIMESTAMPTZ;
-- นักศึกษาที่เคยบันทึกข้อมูลคุณสมบัติแล้ว ให้อยู่ในคิวรอเจ้าหน้าที่ตรวจ
UPDATE students SET profile_status = 'pending' WHERE profile_status IS NULL AND gpax IS NOT NULL;
COMMIT;
