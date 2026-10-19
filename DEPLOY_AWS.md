# Deploy ขึ้น AWS (Amplify Hosting + REST API + Cognito)

```
Browser ──HTTPS──▶ Amplify Hosting (frontend)
   │
   ├──▶ Cognito User Pool ──▶ Lambda triggers (ตรวจรหัส TU / บัญชี mock)
   │
   └──▶ API Gateway (REST, Cognito authorizer) ──▶ Lambda backend ──▶ RDS PostgreSQL
                                                         └──────────▶ S3 (Transcript, เรซูเม่, โลโก้)
```

| ผู้ใช้ | เข้าสู่ระบบด้วย | บัญชีใน DB |
|---|---|---|
| นักศึกษา | ชื่อผู้ใช้ TU (รหัสนักศึกษา) + รหัส TU | สร้างให้ตอนเข้าครั้งแรก (เฉพาะรหัส `YY0961` / `YY0965`) |
| อาจารย์ / เจ้าหน้าที่ / ผู้ประสานงาน | อีเมลบัญชี mock + `MOCK_PASSWORD` | ต้องมีอยู่แล้ว (seed) และอีเมลอยู่ใน `MOCK_LOGINS` |
| ผู้ประสานงาน (ทางเลือก) | Google | อีเมลตรงกับบัญชีที่ลงทะเบียนไว้ |

ทำตามลำดับ ใช้ region `us-east-1` และ role `LabRole` (Learner Lab สร้าง IAM role เองไม่ได้)
ก่อนเริ่มให้ตรวจว่า Learner Lab เปิดให้ใช้ Amplify และ Cognito — ถ้าไม่มี Amplify ให้ใช้ S3 + CloudFront แทน (Cognito ต้องการ HTTPS)

## 1. RDS PostgreSQL

1. สร้าง RDS PostgreSQL (db.t3.micro) ไว้ใน VPC เดียวกับ Lambda backend จดค่า endpoint, ชื่อผู้ใช้, รหัสผ่าน, ชื่อฐานข้อมูล
2. Security group ของ RDS: เปิด port 5432 ให้ security group ของ Lambda backend
3. รัน schema, migration และ seed จากเครื่องที่เชื่อมถึง RDS ได้ (เช่น เปิด Public access ชั่วคราวแล้วจำกัด IP ของตัวเอง หรือใช้ EC2 ใน VPC):

```sh
export PGHOST=<rds-endpoint> PGUSER=<user> PGPASSWORD=<password> PGDATABASE=<db> PGSSLMODE=require
psql -X -v ON_ERROR_STOP=1 -f database/init/01-schema.sql
psql -X -v ON_ERROR_STOP=1 -f database/migrations/003_v3_schema.sql
psql -X -v ON_ERROR_STOP=1 -f database/migrations/004_student_course_grades.sql
psql -X -v ON_ERROR_STOP=1 -f database/seeds/v3-demo.sql   # บัญชี mock และข้อมูลตัวอย่าง
```

บัญชี mock ใน seed: `staff.v3@tu.ac.th`, `advisor.v3@tu.ac.th`, `advisor.other.v3@tu.ac.th`, `company.v3@example.test`, `company.other.v3@example.test`
ถ้าเปิด Public access ไว้ตอนรัน ให้ปิดหลังเสร็จ

## 2. S3 สำหรับไฟล์

1. สร้าง bucket แบบ private (Block all public access เปิดไว้) เช่น `cs361-coop-files-<ชื่อทีม>`
2. Lambda backend อยู่ใน VPC ที่ไม่มี NAT → VPC → Endpoints → Create endpoint → `com.amazonaws.us-east-1.s3` แบบ **Gateway** แล้วเลือก route table ของ subnet ที่ Lambda ใช้ (ไม่มีค่าใช้จ่าย)

ไฟล์ทุกชนิดจำกัดที่ 4 MB เพราะ Lambda รับ request ได้ไม่เกิน 6 MB หลังเข้ารหัส base64

## 3. Cognito และ Lambda triggers

ทำตาม [backend/cognito-triggers/README.md](backend/cognito-triggers/README.md) ทั้งหมด แล้วเพิ่ม:

- User Pool → Sign-up → Custom attributes → เพิ่ม `en_name` (String, Mutable) ใช้เก็บชื่ออังกฤษจาก TU
- Lambda `verify-auth-challenge` env:
  - `TU_API_KEY` = Application Key จาก restapi.tu.ac.th (ไม่มี `{ }`)
  - `MOCK_LOGINS` = อีเมลบัญชี mock คั่นด้วย `,` เช่น `staff.v3@tu.ac.th,advisor.v3@tu.ac.th,company.v3@example.test`
  - `MOCK_PASSWORD` = รหัสผ่านบัญชี mock (ตั้งใหม่ ห้ามใช้ `V3-local-only!`)
- `LabRole` ต้องเรียก `cognito-idp:AdminUpdateUserAttributes` ได้ (ใช้เก็บชื่อจาก TU) ถ้าเรียกไม่ได้ login ยังผ่าน แต่ชื่อนักศึกษาจะเป็นรหัสนักศึกษาแทน — ดู CloudWatch log ว่ามี `Saving TU profile failed`

## 4. Lambda backend

1. สร้าง zip จากโฟลเดอร์ `backend` (ต้องมีโฟลเดอร์ `cognito-triggers` อยู่ใน zip เพราะ backend ใช้เกณฑ์ร่วมกัน):

```sh
cd backend
npm ci --omit=dev
zip -r ../backend-lambda.zip src cognito-triggers node_modules package.json
```

2. สร้าง Lambda: Node.js 20.x ขึ้นไป, handler `src/lambda.handler`, role `LabRole`, memory 512 MB, timeout 15 วินาที
3. VPC: เลือก subnet และ security group เดียวกับที่ RDS อนุญาต
4. Environment variables:

| ชื่อ | ค่า |
|---|---|
| `NODE_ENV` | `production` |
| `AUTH_MODE` | `api-gateway` |
| `COGNITO_USER_POOL_ID` | `us-east-1_xxxxxxxxx` |
| `COGNITO_CLIENT_ID` | App client ID |
| `MOCK_LOGINS` | ค่าเดียวกับ Lambda trigger |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | ค่าจาก RDS (ไม่ต้องตั้ง `DB_SSL`) |
| `FILE_BUCKET` | ชื่อ bucket จากข้อ 2 |
| `CORS_ORIGIN` | URL ของ Amplify เช่น `https://main.xxxxxx.amplifyapp.com` (ใส่หลังทำข้อ 6) |

## 5. API Gateway (REST API)

1. Create API → REST API → ตั้งชื่อ
2. Authorizers → Create → Cognito → เลือก User Pool, Token source `Authorization`
3. Resources (Lambda proxy integration ทั้งหมด ชี้ไปที่ Lambda backend):

| Resource | Method | Authorization |
|---|---|---|
| `/{proxy+}` | ANY | Cognito authorizer |
| `/api/companies` และ `/api/companies/{id}` | GET | NONE (หน้าแรกดูได้โดยไม่ login) |
| `/api/company-logos/{proxy+}` | GET | NONE |
| `/api/health` | GET | NONE |

4. เปิด CORS ให้ทุก resource (Actions → Enable CORS) ใส่ origin ของ Amplify และอนุญาต header `Authorization,Content-Type`
5. Gateway responses → `DEFAULT_4XX` และ `DEFAULT_5XX` → เพิ่ม header `Access-Control-Allow-Origin` = `'<URL ของ Amplify>'` (ไม่งั้นหน้าเว็บจะไม่เห็นข้อความ 401 จาก authorizer)
6. Settings → Binary media types → เพิ่ม `*/*` (ให้อัปโหลด/ดาวน์โหลด PDF และรูปได้)
7. Deploy API → stage `prod` จด Invoke URL เช่น `https://xxxx.execute-api.us-east-1.amazonaws.com/prod`

## 6. Amplify Hosting (frontend)

1. Amplify → Create new app → เชื่อม GitHub repo นี้ → เลือก branch → เลือก monorepo แล้วใส่ app root `frontend`
2. Environment variables:

| ชื่อ | ค่า |
|---|---|
| `VITE_API_URL` | Invoke URL + `/api` เช่น `https://xxxx.execute-api.us-east-1.amazonaws.com/prod/api` |
| `VITE_AUTH_MODE` | `cognito` |
| `VITE_COGNITO_USER_POOL_ID` | `us-east-1_xxxxxxxxx` |
| `VITE_COGNITO_CLIENT_ID` | App client ID |
| `VITE_COGNITO_DOMAIN` | `<prefix>.auth.us-east-1.amazoncognito.com` |

3. Rewrites and redirects → เพิ่มกฎ SPA: Source `</^[^.]+$|\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|webp|woff|woff2|ttf|map|json)$)([^.]+$)/>` → Target `/index.html` → Type `200 (Rewrite)`
4. Deploy แล้วนำ URL ที่ได้ไปใส่:
   - `CORS_ORIGIN` ของ Lambda backend และ CORS / Gateway responses ของ API Gateway (แล้ว Deploy API ใหม่)
   - Cognito App client → Callback URLs และ Sign-out URLs: `https://<amplify-url>/login`
   - เว็บ restapi.tu.ac.th → URL ของระบบ

## 7. ตรวจหลัง deploy

- [ ] หน้าแรกแสดงรายชื่อบริษัทโดยไม่ต้อง login
- [ ] นักศึกษาสาขาวิทยาการคอมพิวเตอร์ login ด้วยรหัสนักศึกษาได้ หน้าโปรไฟล์แสดงชื่อจาก TU และหลักสูตรถูกต้อง
- [ ] นักศึกษาอัปโหลด Transcript แล้วเปิดดูได้ (ไฟล์อยู่ใน S3)
- [ ] `staff.v3@tu.ac.th` + `MOCK_PASSWORD` เข้าหน้าเจ้าหน้าที่ได้
- [ ] รหัสนักศึกษาสาขาอื่นเข้าไม่ได้

ปัญหาที่พบบ่อย: ดู CloudWatch Logs ของ Lambda backend และ `verify-auth-challenge`
`ไม่สามารถตรวจสอบกับระบบ TU ได้` = Lambda trigger ออก internet ไม่ได้ (อย่าใส่ใน VPC) หรือ `TU_API_KEY` ผิด
หน้าเว็บขึ้น CORS error = `CORS_ORIGIN` / Gateway responses ยังไม่ตรงกับ URL ของ Amplify
