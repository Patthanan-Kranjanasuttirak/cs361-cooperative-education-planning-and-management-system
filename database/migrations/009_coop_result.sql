-- ผลการคัดเลือกเข้าแผนสหกิจศึกษา (เจ้าหน้าที่ประกาศ): NULL = รอประกาศผล, passed = ผ่าน, failed = ไม่ผ่าน
-- เพิ่มคอลัมน์อย่างเดียว ไม่ลบข้อมูลเดิม รันซ้ำได้
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL search_path = public;
ALTER TABLE students ADD COLUMN IF NOT EXISTS coop_result VARCHAR(10) CHECK (coop_result IN ('passed', 'failed'));
ALTER TABLE students ADD COLUMN IF NOT EXISTS coop_result_by INTEGER REFERENCES users (user_id) ON DELETE SET NULL;
ALTER TABLE students ADD COLUMN IF NOT EXISTS coop_result_at TIMESTAMPTZ;
COMMIT;
