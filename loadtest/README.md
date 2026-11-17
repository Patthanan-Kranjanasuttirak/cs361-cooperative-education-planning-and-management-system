# Load Test / Concurrent Test

ข้อมูลทดสอบ บัญชีทดสอบ และสคริปต์ k6 สำหรับส่ง request หลายพันครั้งต่อรอบ (อ่าน 80% / เขียน 20%)
ข้อมูลทั้งหมดเป็นข้อมูลสมมติ ไม่มีข้อมูลผู้ใช้จริง และลบออกได้ด้วย `cleanup.sql`

> **ห้ามรันบน Production** ใช้กับ Local Docker หรือ Test Stack ที่แยกจากระบบจริงเท่านั้น
> `seed.sql` จะไม่ทำงานถ้าไม่ได้ `SET loadtest.target = 'non-production'` ก่อน
> ห้ามคัดลอกไฟล์ไปไว้ใน `database/seeds/` เพราะ migrate `{"seeds":true}` จะรันทุก seed ในทุก environment

| ไฟล์ | หน้าที่ |
|---|---|
| `seed.sql` | สร้างบัญชีและข้อมูลทดสอบ (ไม่ยอมรันซ้ำถ้ายังมีข้อมูลทดสอบอยู่) |
| `cleanup.sql` | ลบข้อมูลทดสอบทั้งหมด รวมใบสมัครที่สร้างระหว่างทดสอบ (รันซ้ำได้) |
| `k6-mixed.js` | สคริปต์ k6 แบบผสม 40% / 40% / 20% |
| `get-tokens.mjs` | ขอ Cognito ID token ของบัญชีทดสอบ สำหรับ AWS Test Stack |

## 1. ข้อมูลที่สร้าง

| ตาราง | จำนวนแถว | รายละเอียด |
|---|---|---|
| `users` | 310 | บัญชี login 10 + นักศึกษา background 300 |
| `students` | 308 | ทุกคนผ่านเข้าแผนแล้ว (`coop_result='passed'`) GPAX 2.75–3.99 มี key ของ transcript/CV |
| `companies` | 60 | `[LOADTEST] บริษัททดสอบ 001–060` ช่วงรับสมัครตั้งแต่ 30 วันก่อนถึง 120 วันหลังวันที่ seed |
| `positions` | 300 | บริษัทละ 5 ตำแหน่ง `term_id = NULL` เปิดรับ |
| `applications` | 600 | ใบสมัครของนักศึกษา background มีหลายสถานะ (submitted / accepted / declined / confirmed / withdrawn) |
| `application_history` | 900 | ประวัติที่ตรงกับสถานะปัจจุบันของใบสมัครแต่ละใบ |
| `terms` | 0–1 | สร้าง `LT-TEST` ก็ต่อเมื่อยังไม่มีภาคที่ active (ถ้ามีอยู่แล้วจะใช้ภาคเดิม) |

ข้อมูลทดสอบระบุได้จาก: `users.username LIKE 'lt.%'` + อีเมล `@loadtest.example.test`, `companies.name LIKE '[LOADTEST]%'` และ `terms.code = 'LT-TEST'`
(`.test` เป็นโดเมนที่สงวนไว้ จึงไม่ซ้ำกับอีเมลของคนจริง)

### บัญชีทดสอบ 10 บัญชี

| บัญชี (อีเมล) | Role | ใช้ทำอะไร |
|---|---|---|
| `lt.student01@loadtest.example.test` … `lt.student08@loadtest.example.test` | student | ยิง `POST /api/applications` ทุกคนผ่านเข้าแผนแล้ว มี CV และยังไม่มีใบสมัคร |
| `lt.staff@loadtest.example.test` | staff | ตรวจผลหลังทดสอบ (`GET /api/applications`) |
| `lt.company@loadtest.example.test` | company | ผู้ประสานงานของ `[LOADTEST] บริษัททดสอบ 001` |

- Local: login ได้ด้วยรหัส `DEV_AUTH_PASSWORD` (ใส่อีเมลหรือ username เช่น `lt.student01`)
- AWS: ต้องเพิ่มอีเมลทั้ง 10 บัญชีลงใน `MOCK_LOGINS` ของ **ทั้ง** `verify-auth-challenge` และ backend Lambda แล้วใช้รหัส `MOCK_PASSWORD`
- นักศึกษา background (`lt.bg0001`–`lt.bg0300`) login ไม่ได้ (`auth_provider='loadtest'` และมี `cognito_sub` อยู่แล้ว) มีไว้เพิ่มปริมาณข้อมูลเท่านั้น
- key ของ transcript/CV เป็นค่าสมมติ ไม่มีไฟล์จริงใน storage จึงไม่ควรทดสอบการดาวน์โหลดเอกสารด้วยบัญชีเหล่านี้

## 2. การกระทำที่ผู้ใช้ทำบ่อยที่สุด 3 อย่าง

ตรวจจาก `frontend/src/pages` และ `backend/src/routes` แล้ว

| # | ประเภท | การกระทำ | Endpoint | สิทธิ์ | หน้าที่เรียก |
|---|---|---|---|---|---|
| 1 | หน้ารายการ | ดูหรือค้นหารายชื่อสถานประกอบการและตำแหน่งที่เปิดรับ | `GET /api/companies` (รับ `?search=&province=&position=&status=`) | Public | หน้าแรก `home.jsx`, `/company` (`company.jsx`), หน้าสมัคร `student/Apply.jsx` (`?status=open`) |
| 2 | หน้ารายละเอียด | เปิดดูรายละเอียดบริษัทและตำแหน่งงาน | `GET /api/companies/:id` | Public | `/company/:id`, `/detail/:id` |
| 3 | การบันทึกข้อมูล | นักศึกษาส่งใบสมัครตำแหน่งงาน | `POST /api/applications` body `{"position_id": <id>}` | student (Bearer token) | `student/Apply.jsx` |

เหตุผลที่เลือก:
- `GET /api/companies` เป็นหน้าที่ผู้ใช้ทุกกลุ่มเข้าก่อน (รวมคนที่ยังไม่ login) และ response รวมตำแหน่งงานของทุกบริษัท จึงเป็น query ที่หนักที่สุดในกลุ่มการอ่าน
- `POST /api/applications` ทำงานใน transaction เดียว: lock แถวนักศึกษา (`FOR UPDATE`) → ตรวจตำแหน่ง ภาคการศึกษา และช่วงรับสมัคร → ตรวจใบซ้ำ → `INSERT` ใบสมัคร + history จึงทดสอบเรื่อง concurrency และ data integrity ได้ตรงจุด
- ถ้าส่ง `position_id` เดิมซ้ำด้วยนักศึกษาคนเดิม API ตอบ **200** และคืนใบเดิม (ไม่สร้างใบซ้ำ) สคริปต์นับแยกเป็น `applications_duplicate` และนับใบใหม่ (201) เป็น `applications_created`
- ไม่ส่ง `resume_s3_key` จึงใช้ CV จากโปรไฟล์ ทำให้ไม่ต้องอัปโหลดไฟล์ระหว่างทดสอบ

ความจุของการเขียน: นักศึกษา 8 คน × 300 ตำแหน่ง = 2,400 ใบที่สร้างใหม่ได้ต่อรอบ ถ้ายิง 5,000 request จะเป็นการเขียนประมาณ 1,000 ครั้ง ส่วนใหญ่สร้างใบใหม่
ถ้าจะยิงมากกว่านี้ หรือต้องการเริ่มรอบใหม่จากศูนย์ ให้รัน `cleanup.sql` แล้วรัน `seed.sql` ใหม่ก่อนแต่ละรอบ

## 3. วิธีใช้ (Local Docker)

```sh
docker compose up -d --build
# seed (ฐานข้อมูลต้อง migrate ถึง 011 แล้ว)
(echo "SET loadtest.target='non-production';"; cat loadtest/seed.sql) | \
  docker compose exec -T database sh -c 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

# ยิง load test (ติดตั้ง k6 ก่อน: brew install k6)
k6 run -e BASE_URL=http://localhost:5000/api -e LT_PASSWORD='<DEV_AUTH_PASSWORD>' \
  -e VUS=10 -e ITERATIONS=5000 loadtest/k6-mixed.js

# ลบข้อมูลทดสอบ
docker compose exec -T database sh -c 'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < loadtest/cleanup.sql
```

บน local backend ตั้ง `DB_POOL_MAX` ไว้ที่ 1 (ค่าเริ่มต้นสำหรับ Lambda) ถ้าต้องการเลียนแบบ Lambda หลายตัวพร้อมกัน ให้ตั้ง `DB_POOL_MAX` ให้สูงขึ้น และบันทึกค่าที่ใช้ไว้ในรายงานผล

## 4. วิธีใช้ (AWS Test Stack)

1. ใช้ Stack ที่แยกจาก Production และมี RDS ของตัวเอง
2. รัน `seed.sql` ด้วย `psql` ผ่านช่องทางที่เข้าถึง RDS ได้ (ใน Repository ยังไม่มีช่องทางรัน SQL ทั่วไปบน RDS เพราะ RDS อยู่ใน private subnet ต้องตรวจสอบวิธีเข้าถึงของ Stack นั้น)
3. เพิ่มอีเมลบัญชีทดสอบลงใน `MOCK_LOGINS` ของทั้ง Cognito trigger และ backend Lambda
4. ขอ token (ID token มีอายุประมาณ 1 ชั่วโมง ให้ขอใหม่ก่อนเริ่มแต่ละรอบ):
   ```sh
   COGNITO_REGION=<region> COGNITO_CLIENT_ID=<app client id> LT_PASSWORD='<MOCK_PASSWORD>' \
   API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod/api \
   node loadtest/get-tokens.mjs > loadtest/tokens.json
   k6 run -e BASE_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod/api \
     -e TOKENS_FILE=tokens.json -e VUS=10 -e ITERATIONS=5000 loadtest/k6-mixed.js
   ```
   `tokens.json` อยู่ใน `.gitignore` ห้าม commit
5. ถ้าตั้ง throttling ของ API Gateway ตามที่ `DEPLOY_AWS.md` แนะนำ (rate 20, burst 40) จะเจอ **429** เมื่อยิงเกินค่านั้น ให้บันทึกค่า throttling ที่ใช้ทดสอบไว้ด้วย
6. หลังทดสอบเสร็จ ให้รัน `cleanup.sql` และนำบัญชีทดสอบออกจาก `MOCK_LOGINS` (ผู้ใช้ใน Cognito User Pool ชื่อ `lt.*@loadtest.example.test` ต้องลบเองใน Console หรือ `aws cognito-idp admin-delete-user`)

## 5. ผลที่ต้องเก็บ

k6 แยก metric ตาม tag `name` (`list_companies`, `company_detail`, `create_application`): avg, p95, จำนวน request, error rate, throughput (`http_reqs`/s)
ฝั่ง AWS ให้ดูใน CloudWatch: Lambda Duration / ConcurrentExecutions / Throttles, RDS DatabaseConnections / CPUUtilization
จำนวน VU (`VUS`) ไม่เท่ากับ request ต่อวินาที ให้รายงานค่า `http_reqs` ที่วัดได้จริงจาก k6

ตรวจ data integrity หลังทดสอบ:
```sql
-- ใบสมัครที่ไม่มี history (ต้องเป็น 0)
SELECT count(*) FROM applications a JOIN students s USING (student_id) JOIN users u USING (user_id)
WHERE u.username LIKE 'lt.%' AND NOT EXISTS (SELECT 1 FROM application_history h WHERE h.application_id = a.application_id);
-- ใบซ้ำ (student, term, position) ต้องเป็น 0 รายการ (มี UNIQUE constraint อยู่แล้ว)
SELECT student_id, term_id, position_id, count(*) FROM applications GROUP BY 1, 2, 3 HAVING count(*) > 1;
```
