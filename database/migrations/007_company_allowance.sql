-- ข้อมูลสถานประกอบการเพิ่มเติม: เบี้ยเลี้ยง, รายละเอียดเพิ่มเติม (เช่น สวัสดิการ ที่พัก การเดินทาง) และไฟล์ PDF แนบ
-- เพิ่มคอลัมน์อย่างเดียว ไม่ลบข้อมูลเดิม รันซ้ำได้
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL search_path = public;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS allowance VARCHAR(255);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS additional_info TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS additional_file VARCHAR(255);
COMMIT;
