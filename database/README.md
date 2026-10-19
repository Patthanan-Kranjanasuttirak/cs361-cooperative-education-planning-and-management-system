# Database V3

Schema ที่รีวิวแล้วมี 9 ตาราง อยู่ใน `init/001_schema.sql` และคงข้อมูลตัวอย่างบริษัท/ตำแหน่งเดิมไว้
ไฟล์ init ทำงานเฉพาะตอน volume ว่าง; การ rebuild ไม่อัปเกรดฐานข้อมูลเดิม

## อัปเกรด volume เดิมโดยเก็บข้อมูล

รันจากโฟลเดอร์ที่มี `docker-compose.yml` ตรวจให้ backup สำเร็จก่อนขั้นถัดไป
เปลี่ยนชื่อไฟล์ backup หากเคยใช้ชื่อนี้แล้ว

```sh
docker compose up -d database
docker compose exec -T database sh -c 'pg_dump -Fc -U "$POSTGRES_USER" -d "$POSTGRES_DB"' > /tmp/cs361-before-v3.dump
docker compose exec -T database sh -c 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/migrations/003_v3_schema.sql
docker compose exec -T database sh -c 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/migrations/004_student_course_grades.sql
```

Migration รองรับ V1/V2 และรันซ้ำได้ ย้ายเบอร์โทรไป `users.phone`, นำ `password_hash` ออก,
เปลี่ยนชื่อ ID เดิมโดยรักษาความสัมพันธ์ และรองรับตำแหน่งที่ไม่ผูกภาค
หากเบอร์ของผู้ใช้เดียวกันขัดแย้งจะ rollback ทั้งหมด ให้แก้เบอร์ก่อนรันใหม่
หลัง commit หากต้องการคืนคอลัมน์รหัสผ่านต้องกู้จาก backup

## Seed สำหรับพัฒนา API

ใช้เฉพาะ local; ไม่รวม seed บัญชีทดสอบในการ init อัตโนมัติของ production

```sh
docker compose exec -T database sh -c 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < database/seeds/005_v3-demo.sql
```

Seed ครบ 4 บทบาทและ 8 สถานะ รันซ้ำไม่เพิ่มข้อมูลเดิม ไม่เปลี่ยนข้อมูลบริษัทเดิม
GPAX ใน seed เป็นข้อมูลสมมติและ Transcript ยังว่าง นักศึกษาต้องอัปโหลดก่อนส่งใบสมัครใหม่
Migration 004 คืนฟอร์มรายวิชาโดยเพิ่ม students.curriculum, course_grades และ declarations โดยไม่ลบข้อมูลเดิม
เกรดเริ่มต้นเป็น object ว่าง ส่วนหลักสูตรของบัญชี demo จะเติม 66 หากยังว่าง โดยไม่เขียนทับหลักสูตรที่เลือกไว้
ไม่ได้เพิ่มสถานะ draft/revision หรือตารางใหม่

ดู [วิธีทดสอบระบบ](../TESTING_GUIDE.md) และ [API/Workflow](../backend/README.md)
ชุดทดสอบ migration เดิมที่ซ้ำซ้อนถูกรวมเป็น integration suite ของ backend
