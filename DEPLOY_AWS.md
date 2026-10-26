# DEPLOY_AWS.md — ระบบจัดการแผนสหกิจศึกษา (CS361, V3)

คู่มือสร้างและดูแลระบบบน AWS แบบ manual (ยังไม่ใช้ IaC) 

## 1. ภาพรวม

```
Browser ──► Amplify Hosting (React/Vite)
   │
   ├─(sign in, custom auth)──► Cognito User Pool ──► 4 trigger Lambda (นอก VPC) ──► TU API
   │
   └─(Bearer ID token)──► API Gateway (REST) ──► Lambda Express API (ใน VPC) ──► RDS PostgreSQL
                              └ Cognito authorizer                         └──► S3 (ผ่าน Gateway endpoint)
```

- Region: **ap-southeast-2 (Sydney)** ทุกบริการ
- ตั้งชื่อทุกทรัพยากรขึ้นต้นด้วย `cs361-coop-`
- ล็อกอินไม่ผ่าน backend: เว็บคุยกับ Cognito ตรง; backend ตรวจ role จากตาราง `users` ทุกครั้ง
- VPC เป็น private subnet, **ไม่มี NAT และไม่มี IGW** → Lambda ใน VPC เรียกอินเทอร์เน็ต/Secrets Manager ไม่ได้
  - จึงต้องวาง trigger Lambda นอก VPC (เพื่อเรียก TU API) และใส่ค่า DB ใน env ตรง ๆ

## 2. ทรัพยากรทั้งหมด

| บริการ | ชื่อ / รายละเอียด |
|---|---|
| VPC | private subnet 2 AZ, ไม่มี NAT/IGW |
| Security groups | `sg-lambda` (outbound 5432 → `sg-rds`, outbound 443 → S3 prefix list), `sg-rds` (inbound 5432 จาก `sg-lambda`) |
| RDS PostgreSQL | `cs361-coop-...`, Publicly accessible = No |
| S3 bucket | `cs361-coop-files-<suffix>`, Block all public access เปิดไว้ |
| S3 Gateway endpoint | `cs361-coop-s3-endpoint` ผูกกับ route table ของ private subnet |
| Lambda backend | `cs361-coop-api` (Node.js Express + serverless-http), อยู่ใน VPC |
| Lambda triggers (นอก VPC) | `cs361-coop-pre-sign-up`, `cs361-coop-define-auth-challenge`, `cs361-coop-create-auth-challenge`, `cs361-coop-verify-auth-challenge` |
| IAM role | `cs361-coop-trigger-role` (+ inline policy `cs361-coop-update-attrs`), role ของ backend (VPC access + S3) |
| Cognito | user pool `cs361-coop-users-v2`, app client ไม่มี secret |
| API Gateway | REST API, stage `prod`, authorizer `cs361-coop-cognito-v3` |
| Amplify | โมโนรีโป `frontend`, branch `develop` |

## 3. ลำดับการสร้าง

1. VPC, private subnet, security groups
2. RDS PostgreSQL
3. S3 bucket + S3 Gateway endpoint + outbound 443 ของ `sg-lambda` ไป prefix list ของ S3
4. IAM role ของ backend และของ trigger
5. Lambda backend (ใน VPC) → อัปโหลด zip → ตั้ง env → รัน migrate
6. Lambda trigger 4 ตัว (นอก VPC)
7. Cognito user pool + app client + ผูก trigger 4 ตัว
8. API Gateway: authorizer, routes, binary media types, gateway responses, deploy
9. Amplify: env + build
10. ตั้ง `CORS_ORIGIN` ด้วย URL Amplify จริง แล้วทดสอบทั้งระบบ

## 4. Environment variables

**Lambda `cs361-coop-api` (backend)**

| ตัวแปร | ค่า |
|---|---|
| `AUTH_MODE` | `api-gateway` (ห้ามใช้ `cognito`/`development`) |
| `COGNITO_USER_POOL_ID` | `ap-southeast-2_heDHFuLMq` |
| `COGNITO_CLIENT_ID` | `ic3050itvmkarak1bt32qd5tc` |
| `CORS_ORIGIN` | URL Amplify `https://develop.d2hk33ncom62gs.amplifyapp.com` |
| `FILE_BUCKET` | `cs361-coop-files-2026` |
| `DB_HOST`, `DB_PORT` (5432), `DB_NAME`, `DB_USER`, `DB_PASSWORD` | ค่าของ RDS |
| `MOCK_LOGINS`, `MOCK_PASSWORD` | ต้องเหมือนกับของ verify ทุกตัวอักษร |

ห้ามตั้งบน Lambda: `DB_SECRET_ARN`, `DEV_AUTH_PASSWORD`, `DEV_AUTH_SECRET`, `UPLOAD_DIR`
Timeout 30 วินาที, memory 512 MB

**Lambda `cs361-coop-verify-auth-challenge`**

| ตัวแปร | ค่า |
|---|---|
| `TU_API_KEY` | Application-Key ของ TU API |
| `MOCK_LOGINS`, `MOCK_PASSWORD` | เหมือนกับ backend |

Timeout 5 วินาที, Runtime Node.js 20+, Handler `index.handler`, ไม่อยู่ใน VPC
Lambda trigger อีก 3 ตัวไม่ต้องมี env (timeout 3 วินาที)

**Amplify (Environment variables)**

| ตัวแปร | ค่า |
|---|---|
| `VITE_AUTH_MODE` | `cognito` |
| `VITE_API_URL` | `https://4i151pnnw4.execute-api.ap-southeast-2.amazonaws.com/prod/api` |
| `VITE_COGNITO_USER_POOL_ID` | `ap-southeast-2_heDHFuLMq` |
| `VITE_COGNITO_CLIENT_ID` | `ic3050itvmkarak1bt32qd5tc` |
| `VITE_COGNITO_DOMAIN` | ใช้เฉพาะ Google login (ยังไม่ได้ใช้) |
| `AMPLIFY_MONOREPO_APP_ROOT` | `frontend` |

ค่า `VITE_*` ถูกฝังตอน build → แก้แล้วต้อง **Redeploy**

## 5. Build และอัปโหลด backend

รันใน Git Bash ที่โฟลเดอร์ root ของโปรเจกต์:

```bash
cd backend
node -v
rm -rf build function.zip
mkdir build
cp -r src cognito-triggers package.json package-lock.json build/
cd build
mkdir -p src/schema && cp -r ../../database/init ../../database/migrations ../../database/seeds src/schema/
npm ci --omit=dev
npx bestzip ../function.zip src cognito-triggers node_modules package.json
cd ..
ls -lh function.zip
unzip -l function.zip | grep -E "cognito-triggers/verify|src/schema/|src/lambda.js"
```

ต้องเห็น `src/lambda.js`, `cognito-triggers/verify-auth-challenge/index.mjs`, และไฟล์ SQL ใน `src/schema/{init,migrations,seeds}`
ถ้าไม่มีโฟลเดอร์ `cognito-triggers/` Lambda จะ error ตอน init (`auth.js` import ไฟล์นี้)
ถ้าไม่มี `src/schema/` migrate จะคืน `log: []` และไม่สร้างตารางอะไร

อัปโหลด: Lambda `cs361-coop-api` → Code → Upload from → .zip file

**Trigger 4 ตัว** ใช้ไฟล์ `index.mjs` ของแต่ละโฟลเดอร์ใน `backend/cognito-triggers/<ชื่อ>/` (ไม่ต้องมี `node_modules`)
- วางโค้ดใน Console (Code → `index.mjs` → Deploy) หรือ zip ด้วย Git bash:

```bash
for n in pre-sign-up define-auth-challenge create-auth-challenge verify-auth-challenge; do
  powershell -Command "Compress-Archive -Path 'cognito-triggers/$n/index.mjs' -DestinationPath 'cognito-triggers/$n.zip' -Force"
done
ls cognito-triggers/*.zip
```

## 6. Migration

รัน test event ใน Lambda `cs361-coop-api`:

```json
{"action":"migrate","seeds":true}
```

- ล้างทุกอย่างแล้วสร้างใหม่ (ลบข้อมูลทั้งหมดใน schema `public`): เพิ่ม `"reset":"yes-delete-everything"`
- ไฟล์ที่รันแล้วบันทึกในตาราง `schema_migrations` และจะถูกข้ามเมื่อรันซ้ำ
- **ทำ snapshot ของ RDS ก่อนรันแบบ reset ทุกครั้ง**
- `006_student_review.sql` (flow ตรวจข้อมูลก่อนสมัคร): เพิ่มคอลัมน์อย่างเดียว ไม่ลบข้อมูล
  - นักศึกษาที่เคยกรอกข้อมูลแล้วจะอยู่สถานะ "รอเจ้าหน้าที่ตรวจ"
  - ต้องมีอาจารย์นิเทศก์อย่างน้อย 1 คน: seed ตั้ง `advisor.v3@tu.ac.th` ให้ หรือเจ้าหน้าที่ติ๊ก "อาจารย์นิเทศก์" ในหน้าจัดการผู้ใช้
  - ต้องอัปโหลด zip ใหม่และ redeploy Amplify พร้อมกัน (frontend ใหม่เรียก `/api/supervisor/applications`)

## 7. Cognito

User pool:
- Sign-in ด้วย **username** (ไม่ใช่ email), ไม่สนตัวพิมพ์เล็ก/ใหญ่
- เปิด self-registration, **ไม่บังคับ required attributes**
- Custom attribute `en_name` (String)
- ปิด Prevent user existence errors (frontend ต้องจับ `UserNotFoundException`)
- App client: ไม่มี client secret, เปิดเฉพาะ `ALLOW_CUSTOM_AUTH` และ `ALLOW_REFRESH_TOKEN_AUTH`
- Extensions → Lambda triggers: Pre sign-up, Define auth challenge, Create auth challenge, Verify auth challenge response

Inline policy `cs361-coop-update-attrs` บน `cs361-coop-trigger-role` (เปลี่ยน `<POOL_ID>` เป็นของจริง):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "cognito-idp:AdminUpdateUserAttributes",
    "Resource": "arn:aws:cognito-idp:ap-southeast-2:<ACCOUNT_ID>:userpool/<POOL_ID>"
  }]
}
```

ถ้าไม่มีสิทธิ์นี้ login ยังผ่าน แต่ชื่อจาก TU จะไม่ถูกบันทึก (ระบบใช้รหัสนักศึกษาแทนชื่อ)
Backend สร้างบัญชีนักศึกษาครั้งแรกจาก claims ของ token ถ้า token แรกยังไม่มีชื่อ จะใช้รหัสนักศึกษาไว้ก่อน
แล้วหน้าเว็บขอ token ใหม่ทันทีหลัง login (ต้องเปิด `ALLOW_REFRESH_TOKEN_AUTH`) backend เติมชื่อจริงให้ (ไม่ทับชื่อที่เจ้าหน้าที่แก้)

## 8. API Gateway

Authorizer: `cs361-coop-cognito-v3` (ประเภท Cognito, ชี้ pool ปัจจุบัน, token source `Authorization`, ไม่ใส่ OAuth scopes)

| Resource | Method | Integration | Authorization |
|---|---|---|---|
| `/api/{proxy+}` | ANY | Lambda proxy (backend) | **authorizer** |
| `/api/{proxy+}` | OPTIONS | Lambda proxy (backend) | None |
| `/api/health` | GET, OPTIONS | Lambda proxy | None |
| `/api/public/{proxy+}` | ANY | Lambda proxy | None |
| `/api/companies` | GET | Lambda proxy | None |
| `/api/companies` | ANY | Lambda proxy | **authorizer** |
| `/api/companies/{proxy+}` | GET | Lambda proxy | None |
| `/api/companies/{proxy+}` | ANY | Lambda proxy | **authorizer** |
| `/api/company-logos/{proxy+}` | GET | Lambda proxy | None |

เหตุผล: `v3Router` ถูกเมานต์ที่ `/api` มี `POST/PUT/DELETE /api/companies...` ที่ต้องล็อกอิน (staff/company)
ดังนั้น `/api/companies` เปิดสาธารณะเฉพาะ GET; method อื่นต้องผ่าน authorizer

- ชื่อ resource ต้องเป็น `company-logos` (มี **s**) ตรงกับ route ในโค้ด
- API settings → Binary media types: `*/*`
- OPTIONS ต้องเป็น **Lambda proxy** ไม่ใช่ Mock: เมื่อใช้ Binary `*/*` ร่วมกับ Mock (จากปุ่ม Enable CORS) จะตอบ 500
- Gateway responses → Default 4XX และ 5XX เพิ่ม header:
  - `Access-Control-Allow-Origin`: `'<URL Amplify>'`
  - `Access-Control-Allow-Headers`: `'Content-Type,Authorization'`
  - `Access-Control-Allow-Methods`: `'GET,POST,PUT,PATCH,DELETE,OPTIONS'`
- ทุก method ต้องมี integration ไม่งั้น Deploy ไม่ผ่าน (`No integration defined for method`)
- แก้อะไรแล้วต้อง **Deploy API** ไป stage `prod` ทุกครั้ง
- แนะนำตั้ง throttling ที่ stage (เช่น rate 20, burst 40)

## 9. ทดสอบ

```bash
# สาธารณะ: ต้องได้ 200
curl -i https://<api-id>.execute-api.ap-southeast-2.amazonaws.com/prod/api/health
curl -i https://<api-id>.execute-api.ap-southeast-2.amazonaws.com/prod/api/companies

# ต้องล็อกอิน: ไม่ส่ง token ต้องได้ 401
curl -i https://<api-id>.execute-api.ap-southeast-2.amazonaws.com/prod/api/auth/me

# preflight: ต้องได้ 204/200 และมี access-control-allow-origin
curl -i -X OPTIONS \
  -H "Origin: https://<amplify-url>" \
  -H "Access-Control-Request-Method: GET" \
  -H "Access-Control-Request-Headers: authorization" \
  https://<api-id>.execute-api.ap-southeast-2.amazonaws.com/prod/api/auth/me

# ล็อกอินด้วยสคริปต์ (บัญชี mock) แล้วเรียก API ด้วย IdToken
CLIENT_ID=<app client id> node test-login.mjs <username> '<password>'
curl -i -H "Authorization: Bearer <IdToken>" https://<api-id>.execute-api.ap-southeast-2.amazonaws.com/prod/api/auth/me
```

backend ต้องการ `Authorization: Bearer <ID token>` (ใช้ **ID token** ไม่ใช่ access token)

## 10. บัญชี mock

`MOCK_LOGINS` เป็นรายการอีเมลคั่นด้วย `,` ทุกบัญชีใช้ `MOCK_PASSWORD` ตัวเดียวกัน (ตัดสินที่ verify-auth-challenge)
บัญชีใน seed `005_v3-demo.sql`: `student1.v3`–`student8.v3@dome.tu.ac.th`, `advisor.v3@tu.ac.th`, `advisor.other.v3@tu.ac.th`, `staff.v3@tu.ac.th`, `company.v3@example.test`, `company.other.v3@example.test`

- **อย่าใช้ `DEV_AUTH_PASSWORD` จาก `.env.example` เป็น `MOCK_PASSWORD`** (อยู่ใน repo ทุกคนเห็น)
- ใครรู้รหัสนี้เป็น staff/advisor ได้ → ลบ `MOCK_LOGINS` หรือเปลี่ยนรหัสหลัง demo
- ถ้าเว็บตัดโดเมน `@dome.tu.ac.th` ก่อนส่งให้ Cognito บัญชีนักศึกษา mock อาจ login ไม่ได้ (ชื่อที่ส่งไม่ตรงกับรายการใน `MOCK_LOGINS`) ให้ตรวจ `AuthProvider.jsx`

## 11. ความปลอดภัยและค่าใช้จ่าย 

- เปิด MFA ให้ root; ทุกคนใช้ IAM user ของตัวเอง; ไม่ใช้ access key ของ root
- เปลี่ยนรหัส/คีย์ทันทีถ้าเคยหลุด (แชต, ภาพหน้าจอ, git)
- RDS ไม่ public; S3 Block all public access เปิดอยู่
- ไม่ commit `*.zip`, `build/`, `.uploads/`, `.env`, ไฟล์ข้อมูลส่วนบุคคล
- AWS Budgets แจ้งเตือนที่ 50% และ 80% ของเครดิต
- ตั้ง log retention ของ CloudWatch Logs เป็น 7–14 วัน
- ห้ามเพิ่ม NAT Gateway หรือ Interface endpoint (มีค่ารายชั่วโมง)
- RDS: ทำ manual snapshot ก่อน demo และก่อน reset; ถ้าไม่ใช้นานให้ Stop temporarily (AWS เปิดกลับเองหลัง 7 วัน)
- เก็บ `function.zip` ที่ใช้ได้ล่าสุดไว้นอก git เพื่อย้อนกลับ

## 12. ที่ยังไม่ได้ทำ

- Google login สำหรับผู้ประสานงาน (ต้องตั้ง Cognito domain และ Google OAuth client)
- โดเมนของตัวเอง (ถ้าเปลี่ยนโดเมน ต้องแก้ `CORS_ORIGIN` และ Gateway responses)
- Infrastructure as Code (V5)