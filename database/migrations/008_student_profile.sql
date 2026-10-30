-- ข้อมูลส่วนตัวนักศึกษาเพิ่มเติม: CV, รูปนักศึกษา, ที่อยู่, กลุ่มวิชาเอก และข้อมูลผู้ปกครอง
-- ยกเลิกการรับรองความประพฤติโดยอาจารย์ที่ปรึกษา: คอลัมน์ conduct_* ยังเก็บไว้ (ไม่ใช้แล้ว) เพื่อไม่ลบข้อมูลเดิม
-- เพิ่มคอลัมน์อย่างเดียว ไม่ลบข้อมูลเดิม รันซ้ำได้
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL search_path = public;
ALTER TABLE students ADD COLUMN IF NOT EXISTS cv_s3_key VARCHAR(512);
ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_s3_key VARCHAR(512);
ALTER TABLE students ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS major VARCHAR(3) CHECK (major IN ('CIS', 'ACS'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255);
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_relation VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_address TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(20);
COMMIT;
