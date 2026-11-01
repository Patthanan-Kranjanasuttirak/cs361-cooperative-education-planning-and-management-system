-- ข้อความ/ไฟล์ PDF ที่บริษัทแนบถึงนักศึกษาตอนตัดสินผ่าน/ไม่ผ่านการคัดเลือก (ไม่บังคับ)
-- เพิ่มคอลัมน์อย่างเดียว ไม่ลบข้อมูลเดิม รันซ้ำได้
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL search_path = public;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS company_note TEXT;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS company_file VARCHAR(255);
COMMIT;
