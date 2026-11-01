# V3 Backend — issue #34

Express + PostgreSQL จริง ใช้ schema V3 และ migration 004 สำหรับเก็บหลักสูตร/เกรดรายวิชา/การรับทราบใน students โดยไม่เพิ่มตารางหรือสถานะ
React เรียก API ผ่าน `frontend/src/services/api.js`; ไม่มีข้อมูลผู้ใช้/ใบสมัครแบบ mock ในหน้าบทบาทแล้ว

## เปิดและทดสอบ

ดู [TESTING_GUIDE.md](../TESTING_GUIDE.md) สำหรับคำสั่งรัน migration, seed, บัญชีทดสอบ และ tests
Swagger UI: `/api/docs` และ OpenAPI 3.0 JSON: `/api/docs.json` (ปิดเมื่อ `NODE_ENV=production`)
กด Authorize แล้วใส่ token ที่ได้จาก `POST /api/auth/login` เพื่อทดลอง endpoint ที่มีสิทธิ์

| ข้อมูล | Endpoint หลัก | สิทธิ์ |
|---|---|---|
| Authentication | `POST /api/auth/login`, `GET /api/auth/me` | login local เปิดเฉพาะ development |
| User | `GET/POST /api/users`, `PUT/PATCH /api/users/:id` | staff; ห้ามเปลี่ยน role หรือปิดบัญชีตนเอง |
| Student | `GET/PUT /api/students/me`, `GET /api/students/:id` | เจ้าของ/กรรมการ/staff ตามวิธีเรียก |
| Student management | `GET /api/students`, `PUT /api/students/:id` | staff (ทุกคน) หรือกรรมการ (เฉพาะผู้สมัครแผน, อ่านอย่างเดียว) |
| Co-op selection | `PUT /api/students/:id/screening`, `PUT /api/students/:id/committee-result`, `GET /api/coop-selection`, `POST /api/coop-selection/announce` | คัดกรอง/ประกาศ = staff; คัดเลือก = committee |
| Report | `GET /api/reports/coop-passed[?format=csv]` | staff/committee |
| Company | `GET /api/companies`, `GET /api/companies/:id` | อ่านข้อมูลสาธารณะได้ |
| Company management | `POST/PUT/DELETE /api/companies[/:id]`, `GET /api/staff/companies/:id` | staff; company แก้ได้เฉพาะของตนเอง |
| Company profile | `GET/PUT /api/company/profile` | company ของตนเอง |
| Position | `GET/POST /api/positions`, `PUT/PATCH/DELETE /api/positions/:id` | staff/company owner |
| Term | `GET/POST /api/terms`, `GET /api/terms/active`, `PUT /api/terms/:id`, `POST /api/terms/:id/activate` | อ่านหลัง login; เขียนเฉพาะ staff |
| Application | `GET/POST /api/applications`, `GET /api/applications/:id` | ข้อมูลตามเจ้าของ; สร้างเฉพาะ student |
| Company decision | `PATCH /api/company/applications/:id/decision` | company owner |
| Confirmation / withdrawal | `POST /api/applications/:id/confirm`, `POST /api/applications/:id/withdraw` | student owner |
| Document | `POST /api/documents?kind=transcript|resume`, `GET /api/documents/:key` | PDF local เฉพาะ development และผู้มีสิทธิ์ |

มี alias สำหรับหน้าเดิม: `/staff/applications`, `/students/me/applications`, `/company/applications`, `/company/positions[/:id]`
รายการใบสมัครรองรับ `term_id` และ `status` ใน query ตาม OpenAPI

## Workflow และความถูกต้อง

- โลโก้บริษัท: `POST /api/company/logo` รับไฟล์ PNG/JPG/WEBP/SVG ไม่เกิน 2 MB เฉพาะผู้ประสานงาน คืน `url` สำหรับบันทึกผ่าน `PUT /api/company/profile` เก็บไฟล์ local ในโหมดพัฒนา โลโก้ที่บันทึกแล้วเปิดดูสาธารณะได้ที่ `/api/company-logos/{companyId}/{filename}` พร้อม nosniff และ CSP sandbox เอกสารนักศึกษายังต้องยืนยันตัวตนตามสิทธิ์เดิม

- นักศึกษามี GPAX ≥ 2.75, Transcript และผ่านเข้าแผนสหกิจศึกษา (`coop_result = passed`) ก่อนส่งใบสมัคร; ต้องอยู่ในภาค active และช่วงรับแผน/ช่วงรับสมัครบริษัท ตำแหน่งต้องเปิดและตรงภาคหรือไม่ผูกภาค
- โปรไฟล์บันทึกหลักสูตร 61/66, course_grades และ declarations ลง DB; หน้าเว็บแสดงค่าเฉลี่ยกลุ่มและเช็กรายวิชาเบื้องต้น ผู้ตรวจยังต้องตรวจเทียบกับ Transcript
- นักศึกษาบันทึกโปรไฟล์ได้เมื่อครบทุกเกณฑ์เท่านั้น: หลักสูตร, GPAX ≥ 2.75, รายวิชาครบและเฉลี่ยกลุ่ม ≥ 2.50, การรับทราบทั้งสามข้อ และ Transcript; API ตรวจข้อมูลใหม่รวมกับค่าเดิมใน transaction ก่อนเขียน ตอบ 422 `INELIGIBLE` พร้อมรายการข้อที่ไม่ผ่านใน `error.details.qualification` ข้อมูลเดิมไม่เปลี่ยน หน้าเว็บแสดง popup และไม่ส่งข้อมูลที่ไม่ผ่าน เกณฑ์ใน frontend/backend ต้องตรงกัน (test runner ตรวจไฟล์ทั้งคู่) เจ้าหน้าที่ยังแก้ข้อมูลเพื่อดูแลระเบียนได้ และเบอร์โทรของโปรไฟล์ที่ล็อกแล้วยังแก้ได้
- คัดเลือกเข้าแผน: นักศึกษาสมัครแผน → staff คัดกรอง + โน้ต → committee เลือก passed/failed (แก้ได้จนประกาศ) → staff ประกาศทีละคน (`student_ids`) หรือทุกคนที่ตัดสินแล้ว (`committee_result` → `coop_result`) นักศึกษาไม่เห็นโน้ตและ `committee_result`; พอกรรมการเริ่มคัดเลือก (มีผลของผู้ที่ยังไม่ประกาศอย่างน้อย 1 คน) ผู้สมัครแผนทุกคนแก้ข้อมูลคุณสมบัติไม่ได้จนกว่าจะประกาศ (`qualification_lock = selecting`, 409) ประกาศแล้วล็อกถาวร (`announced`)
- `submitted → accepted | declined` โดยผู้ประสานงานบริษัทของตำแหน่งนั้น (ไม่มีขั้นอาจารย์นิเทศก์อนุมัติแล้ว; ใบเก่าสถานะ `approved` พิจารณาต่อได้)
- `accepted → confirmed` โดยนักศึกษา; ใบ accepted อื่นในภาคเดียวกันเป็น released, submitted/approved เป็น withdrawn
- นักศึกษาถอนได้เฉพาะ submitted/approved และแก้ GPAX/Transcript/หลักสูตร/เกรด/การรับทราบหลังอนุมัติไม่ได้ ให้ staff แก้ไขกรณีข้อมูลผิด
- quota ใช้แสดงผลและแจ้งเตือน ไม่ปิดรับหรือปฏิเสธอัตโนมัติ ตามกติกาเดิม
- ทุกการเปลี่ยนสถานะเขียน application/review/history ใน transaction เดียว ใช้ student row lock กันการดำเนินการที่ขัดกัน
- การส่งซ้ำด้วย student/term/position และ resume key เดิมคืนใบเดิม การ review/decision/confirm/withdraw ซ้ำที่ตรงผลเดิมไม่เพิ่มประวัติซ้ำ กรณีผลขัดแย้งตอบ 409
- ล็อกการเปลี่ยน active term ด้วย advisory lock; retry ทั้ง transaction เมื่อ deadlock/serialization failure
- บัญชี company ไม่เห็น submitted/rejected ของผู้อื่น และข้อมูลติดต่อ/เอกสารถูกซ่อนเมื่อไม่อยู่ใน approved/accepted/confirmed
- ลบตำแหน่งที่มีใบสมัครหรือบริษัทที่มีใบสมัคร/ผู้ประสานงานไม่ได้; ปิดบัญชีแทนการลบประวัติผู้ใช้

## Authentication

Local: `AUTH_MODE=development` และ `DEV_AUTH_PASSWORD`; login รับเฉพาะบัญชี `auth_provider=dev` ที่มีอยู่ใน DB
รหัสผ่านทดสอบอ่านจาก env ไม่เก็บลงตาราง users และไม่มีการส่ง role จาก browser ไปกำหนดสิทธิ์
ทุก request ตรวจบัญชี/บทบาท/สถานะจาก DB ใหม่ โหมดนี้ถูกปิดใน production และ AWS Lambda

Production เตรียมไว้สองแบบ:

- `AUTH_MODE=cognito`: ตั้ง `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`; ตรวจลายเซ็น/issuer/client/expiry/token_use=access ด้วย [aws-jwt-verify](https://github.com/awslabs/aws-jwt-verify)
- `AUTH_MODE=api-gateway`: ใช้ verified claims ที่ส่งจาก Cognito/JWT authorizer ผ่าน Lambda event เท่านั้น พร้อมตรวจ issuer/client/expiry/token_use อีกครั้ง เหมาะกับ Lambda private subnet ที่ไม่มี NAT; HTTP headers/body ปลอม claims ไม่ได้

ทั้งสองแบบจับคู่ `sub` กับ `users.cognito_sub` และใช้ `users.role` เป็นสิทธิ์จริง
รับทั้ง ID token และ access token; login ครั้งแรกผูก `cognito_sub` ให้บัญชีที่ลงทะเบียนไว้ (TU ด้วย username, Google ด้วยอีเมลที่ยืนยันแล้ว)
วิธีตั้งค่า Cognito, Google และ Lambda triggers ของ TU API: [cognito-triggers/README.md](cognito-triggers/README.md)
ต้องผูก authorizer กับทุก protected route และจำกัดสิทธิ์ invoke Lambda ผ่าน API Gateway
ไม่มีการสร้าง AWS resources หรือบัญชี Cognito อัตโนมัติ; staff ลงทะเบียนข้อมูลและ cognito_sub ผ่าน User API
หน้า login local ยังไม่เปิด Google OAuth จึงไม่แสดงผลสำเร็จปลอม

## เอกสารและไฟล์

PDF และโลโก้เก็บใน S3 เมื่อตั้ง `FILE_BUCKET` (โหมดพัฒนาเก็บใน `.uploads/` ที่ไม่เข้า git) ไฟล์ไม่เกิน 4 MB ตามข้อจำกัดของ Lambda ตรวจชนิดและ header ของไฟล์
คีย์ผูก namespace ตาม user_id; download ใช้ Bearer token และตรวจเจ้าของ/staff/กรรมการ/company owner
ถ้าไม่ได้ตั้ง `FILE_BUCKET` นอกโหมดพัฒนา endpoint เอกสาร/โลโก้ตอบ `503 STORAGE_NOT_CONFIGURED` วิธีตั้งค่า S3 ดู [DEPLOY_AWS.md](../DEPLOY_AWS.md)
ฟิลด์ `transcript_s3_key` และ `resume_s3_key` ใช้รูปแบบคีย์ตามเจ้าของที่ API กำหนด

## Error contract

```json
{
  "message": "กรุณากรอกเหตุผลที่ไม่อนุมัติ",
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "กรุณากรอกเหตุผลที่ไม่อนุมัติ",
    "details": { "comment": "กรุณากรอกเหตุผลที่ไม่อนุมัติ" },
    "request_id": "..."
  }
}
```

`X-Request-ID` ตรงกับ `error.request_id`; 401 ต้อง login ใหม่, 403 ไม่มีสิทธิ์, 404 ไม่พบ,
409 ข้อมูลซ้ำ/สถานะขัดกัน/ข้อมูลอ้างอิง, 422 validation/คุณสมบัติ, 503 บริการไม่พร้อม
ไม่ส่งรายละเอียด SQL, token หรือข้อมูลลับกลับไปยัง client
