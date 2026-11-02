# DEPLOY_AWS.md — ระบบจัดการแผนสหกิจศึกษา (CS361, V3)

คู่มือสร้างและดูแลระบบบน AWS แบบ manual (ยังไม่ใช้ IaC) 

## 1. ภาพรวม

```
Browser ──► Amplify Hosting (React/Vite)
   │
   ├─(sign in, custom auth)──► Cognito User Pool ──► 4 trigger Lambda (นอก VPC) ──► TU API
   │                                  ▲
   ├─(sign in, Google: ผู้ประสานงาน)──┴──► Cognito domain (managed login) ──► Google (accounts.google.com)
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
| Cognito | user pool `cs361-coop-users-v2`, app client `cs361-coop-web` ไม่มี secret, Cognito domain `cs361-coop` (managed login + style ผูกกับ app client), identity provider **Google** |
| Google Cloud | project `cs361-coop`: OAuth consent screen (External, Testing) และ OAuth client แบบ Web application ใช้กับ Cognito เท่านั้น |
| API Gateway | REST API, stage `prod`, authorizer `cs361-coop-cognito-v3` |
| Amplify | โมโนรีโป `frontend`, branch **`main`** (production), มีกฎ rewrite สำหรับ single-page app |

หมายเหตุ: user pool `cs361-coop-web` (ID `ap-southeast-2_yDMCp1sZT`) เป็น pool เก่าที่ไม่ได้ใช้งาน ไม่ผูกกับระบบ ลบได้เมื่อเช็คแล้วว่าไม่มีผู้ใช้

## 3. ลำดับการสร้าง

1. VPC, private subnet, security groups
2. RDS PostgreSQL
3. S3 bucket + S3 Gateway endpoint + outbound 443 ของ `sg-lambda` ไป prefix list ของ S3
4. IAM role ของ backend และของ trigger
5. Lambda backend (ใน VPC) → อัปโหลด zip → ตั้ง env → รัน migrate
6. Lambda trigger 4 ตัว (นอก VPC)
7. Cognito user pool + app client + ผูก trigger 4 ตัว
8. Google login (ถ้าใช้): Cognito domain → managed login style → Google OAuth client → identity provider → login pages ของ app client (ดูข้อ 7)
9. API Gateway: authorizer, routes, binary media types, gateway responses, deploy
10. Amplify: env + build + กฎ rewrite (ดูข้อ 8.1)
11. ตั้ง `CORS_ORIGIN` (Lambda) และ Gateway responses ด้วย URL Amplify จริง **ไม่มี `/` ท้าย** แล้วทดสอบทั้งระบบ

## 4. Environment variables

**Lambda `cs361-coop-api` (backend)**

| ตัวแปร | ค่า |
|---|---|
| `AUTH_MODE` | `api-gateway` (ห้ามใช้ `cognito`/`development`) |
| `COGNITO_USER_POOL_ID` | `ap-southeast-2_heDHFuLMq` |
| `COGNITO_CLIENT_ID` | `ic3050itvmkarak1bt32qd5tc` |
| `CORS_ORIGIN` | URL Amplify `https://main.d2hk33ncom62gs.amplifyapp.com` (**ห้ามมี `/` ท้าย** เบราว์เซอร์เทียบกับ Origin แบบตรงตัวอักษร ถ้ามี `/` จะถูกบล็อกด้วย CORS และหน้าเว็บขึ้น "Failed to fetch") รับได้ค่าเดียว |
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
| `VITE_COGNITO_DOMAIN` | `cs361-coop.auth.ap-southeast-2.amazoncognito.com` (ไม่มี `https://`) ใช้กับ Google login |
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
  - ขั้นอาจารย์นิเทศก์และการตรวจข้อมูลโดยเจ้าหน้าที่ยกเลิกแล้วใน migration 009/010
- `007_company_allowance.sql`: เพิ่มเบี้ยเลี้ยง รายละเอียดเพิ่มเติม และไฟล์ PDF แนบของบริษัท (ไฟล์เปิดผ่าน `GET /api/companies/{id}/details-file` ใช้ resource `/api/companies/{proxy+}` เดิม ไม่ต้องเพิ่มใน API Gateway)
- `008_student_profile.sql`: เพิ่ม CV, รูป, ที่อยู่, กลุ่มวิชาเอก และข้อมูลผู้ปกครองของนักศึกษา และยกเลิกการรับรองความประพฤติ (คอลัมน์ `conduct_*` ยังอยู่)
- `009_coop_result.sql`: เพิ่มผลการคัดเลือกเข้าแผนสหกิจศึกษาของนักศึกษา (`coop_result`: NULL = รอประกาศผล, passed, failed) เจ้าหน้าที่ประกาศผ่าน `PUT /api/students/{id}/coop-result` (อยู่ใต้ resource `/api/{proxy+}` เดิม) แทนขั้นตอนเจ้าหน้าที่ตรวจข้อมูล นักศึกษายื่นใบสมัครได้เมื่อผล = passed เท่านั้น ถ้าใช้ seed demo ให้รัน `"seeds":true` ซ้ำหลัง migrate เพื่อตั้งนักศึกษา demo ให้ผ่านเข้าแผน
  - นักศึกษาเดิมต้องกรอกข้อมูลส่วนตัวให้ครบก่อนบันทึกครั้งถัดไป
  - ต้องอัปโหลด zip ใหม่และ redeploy Amplify พร้อมกัน
- `010_committee.sql`: เปลี่ยนบทบาทอาจารย์ (`advisor`) ทั้งหมดเป็น **กรรมการสหกิจศึกษา** (`committee`) และเพิ่มขั้นตอนคัดเลือก
  - เจ้าหน้าที่คัดกรอง + โน้ต (`PUT /api/students/{id}/screening`) → กรรมการเลือกผ่าน/ไม่ผ่าน (`PUT /api/students/{id}/committee-result`) → เจ้าหน้าที่ประกาศทีละคนหรือทั้งหมด (`POST /api/coop-selection/announce`) รายชื่อผู้ผ่าน `GET /api/reports/coop-passed?format=csv` ทั้งหมดอยู่ใต้ resource `/api/{proxy+}` เดิม ไม่ต้องเพิ่มใน API Gateway
  - ใบสมัครส่งถึงบริษัทโดยตรง ไม่มีขั้นอาจารย์นิเทศก์อนุมัติ (endpoint `/api/applications/{id}/reviews`, `/api/advisor/*`, `/api/supervisor/*`, `PUT /api/students/{id}/coop-result` ถูกลบ)
  - คอลัมน์ `users.is_supervisor`, `students.advisor_id` ยังอยู่ (ไม่ใช้แล้ว)
  - **แก้ `MOCK_LOGINS` ของ Cognito trigger**: เปลี่ยน `advisor.v3@tu.ac.th` เป็น `committee.v3@tu.ac.th` (seed สร้างบัญชีกรรมการใหม่ บัญชี `advisor.v3` เดิมกลายเป็นกรรมการเช่นกัน)
  - ต้องอัปโหลด zip ใหม่และ redeploy Amplify พร้อมกัน แล้วรัน `{"action":"migrate","seeds":true}`
- `011_company_feedback.sql`: บริษัทแนบข้อความ/ไฟล์ PDF ถึงนักศึกษาตอนตัดสินผลคัดเลือก (`POST /api/company/decision-file`, `GET /api/applications/{id}/company-file` อยู่ใต้ resource `/api/{proxy+}` เดิม ไม่ต้องเพิ่มใน API Gateway)

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

### Google login (ผู้ประสานงานสถานประกอบการ)

ใช้เฉพาะ role `company` ส่วนนักศึกษา กรรมการ และเจ้าหน้าที่ยังใช้ custom auth ตามเดิม Google ไม่ผ่าน trigger define/create/verify
(มีแค่ `pre-sign-up` ที่ถูกเรียกครั้งแรกแล้ว "ปล่อยผ่าน")

**1) Google Cloud Console** (project `cs361-coop`, ใช้ฟรี ไม่ต้องผูกบัตร อย่ากด Free Trial)
- Google Auth Platform → ตั้ง Audience เป็น **External** (โหมด Testing) และเพิ่มอีเมลผู้ทดสอบใน **Test users** (สูงสุด 100) บัญชีที่ไม่อยู่ในรายการจะเข้าไม่ได้ (Access blocked)
- Clients → Create client → **Web application**
  - Authorized redirect URI: `https://cs361-coop.auth.ap-southeast-2.amazoncognito.com/oauth2/idpresponse` (คัดลอกจากหน้า Cognito → Branding → Domain อย่าพิมพ์เอง)
  - เก็บ Client ID และ Client secret ไว้ **ห้าม commit/ส่งในแชทหรือภาพ**

**2) Cognito**
- Branding → Domain → **Cognito domain** (prefix `cs361-coop`, Branding version = Managed login) ถ้าไม่ตั้ง หน้า login ของ Cognito ใช้ไม่ได้
- Branding → **Managed login** → Create a style สำหรับ app client `cs361-coop-web` (ค่าเริ่มต้นได้) ถ้าไม่มี style หน้า "Managed login pages configuration" ของ app client จะขึ้น **Status: Unavailable**
- Social and external providers → Add identity provider → **Google**
  - ใส่ Client ID/secret, scopes `openid email profile`
  - Attribute mapping: `email`→`email`, `email_verified`→`email_verified`, `name`→`name` (ต้องแมป `email_verified` ไม่งั้น backend ไม่ผูกบัญชี)
- App clients → `cs361-coop-web` → Login pages → Edit
  - Identity providers: **Google เท่านั้น** (ไม่เลือก Cognito user pool)
  - OAuth grant type: **Authorization code grant**, OpenID Connect scopes: `openid`, `email`, `profile`
  - Callback URLs และ Sign-out URLs: `http://localhost:5173/login` และ `https://main.d2hk33ncom62gs.amplifyapp.com/login`

**3) ลงทะเบียนผู้ประสานงาน (สำคัญ)**
- เจ้าหน้าที่เพิ่มผู้ใช้ role **ผู้ประสานงาน** ในหน้า **จัดการผู้ใช้งาน** ของเว็บจริง (`main...amplifyapp.com` ไม่ใช่ localhost ซึ่งใช้ฐานข้อมูลคนละชุด) โดยอีเมลต้องตรงกับอีเมล Google ที่ใช้ล็อกอิน และเลือกสถานประกอบการ
- ล็อกอินครั้งแรก backend ผูก `cognito_sub` ให้อัตโนมัติด้วยอีเมลที่ Google ยืนยันแล้ว ผูกได้เฉพาะ role `company` และเฉพาะอีเมลที่มีแถวเดียวที่ยังไม่เคยผูก
- ถ้าไม่มีแถวที่ตรง หน้าเว็บขึ้น "บัญชีนี้ยังไม่ได้ลงทะเบียนในระบบ หรือถูกปิดใช้งาน" (ข้อความเดียวกันขึ้นทั้งตอน `/auth/me` ตอบ 401 และ 403 ให้ดู status จริงในแท็บ Network)

**ปัญหาที่เคยเจอ**

| อาการ | สาเหตุ | แก้ |
|---|---|---|
| `redirect_uri_mismatch` ที่ Google | Redirect URI ใน Google ไม่ตรงโดเมน Cognito | ใส่ `https://<โดเมน Cognito>/oauth2/idpresponse` ให้ตรงทุกตัวอักษร |
| Access blocked / app not verified | อีเมลไม่อยู่ใน Test users | เพิ่มใน Audience → Test users |
| Managed login Status = Unavailable | ยังไม่มี Cognito domain หรือยังไม่สร้าง style ของ app client | สร้าง domain และ style |
| "Failed to fetch" หลังกดล็อกอิน | CORS: `CORS_ORIGIN` หรือ Gateway responses ไม่ตรง URL เว็บ (เช่นมี `/` ท้าย) | แก้ให้ตรงและ Deploy API |
| 403 ที่ `/auth/me` ทั้งที่มีผู้ใช้ | backend อ่านค่า `identities` ไม่ออก ผู้ใช้ Google ได้ `identities` เป็น **object เดี่ยว** ไม่ใช่ array | แก้แล้วใน `userModel.js` (คอมมิต `20afaca`) ต้องอัปโหลด zip ใหม่ |
| 403 และ `seen: []` ใน log | อีเมลไม่มีในตาราง `users` ของ RDS (เพิ่มผิดที่/ผิดฐานข้อมูล) | เพิ่มผู้ใช้ผ่านเว็บจริง |

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
  - `Access-Control-Allow-Origin`: `'<URL Amplify>'` (ครอบด้วย `'` และ **ไม่มี `/` ท้าย** ต้องตรงกับ `CORS_ORIGIN`)
  - `Access-Control-Allow-Headers`: `'Content-Type,Authorization'`
  - `Access-Control-Allow-Methods`: `'GET,POST,PUT,PATCH,DELETE,OPTIONS'`
- ทุก method ต้องมี integration ไม่งั้น Deploy ไม่ผ่าน (`No integration defined for method`)
- แก้อะไรแล้วต้อง **Deploy API** ไป stage `prod` ทุกครั้ง
- แนะนำตั้ง throttling ที่ stage (เช่น rate 20, burst 40)

## 8.1 Amplify

- เชื่อม branch **`main`** เป็น production (เพิ่ม branch ใหม่แล้วค่อยลบ `develop` เปลี่ยนชื่อ branch ของ deployment เดิมไม่ได้) โดเมนเปลี่ยนเป็น `https://main.<app-id>.amplifyapp.com` ต้องแก้ `CORS_ORIGIN`, Gateway responses และ Callback/Sign-out URLs ของ Cognito ตามด้วย
- Environment variables ตั้งเป็น **All branches** ตามข้อ 4 แล้ว Redeploy เมื่อแก้ค่า `VITE_*`
- Hosting → **Rewrites and redirects** เพิ่มกฎ single-page app ไม่งั้น `/login/` ตอบ 404 และอาจทำให้ `code` ของ OAuth หายตอนกลับจาก Google:

| Source address | Target address | Type |
|---|---|---|
| `</^[^.]+$\|\.(?!(css\|gif\|ico\|jpg\|jpeg\|js\|png\|txt\|svg\|woff\|woff2\|ttf\|map\|json\|webp)$)([^.]+$)/>` | `/index.html` | 200 (Rewrite) |

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
บัญชีใน seed `005_v3-demo.sql`: `student1.v3`–`student8.v3@dome.tu.ac.th`, `committee.v3@tu.ac.th`, `staff.v3@tu.ac.th`, `company.v3@example.test`, `company.other.v3@example.test`

- **อย่าใช้ `DEV_AUTH_PASSWORD` จาก `.env.example` เป็น `MOCK_PASSWORD`** (อยู่ใน repo ทุกคนเห็น)
- ใครรู้รหัสนี้เป็น staff/committee ได้ → ลบ `MOCK_LOGINS` หรือเปลี่ยนรหัสหลัง demo
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

- เปลี่ยนรหัสผ่านฐานข้อมูล (`DB_PASSWORD`) และ `MOCK_PASSWORD` ก่อนใช้งานจริง ลดรายชื่อ `MOCK_LOGINS` และบัญชี demo ใน RDS
- เปิด Google OAuth consent screen เป็น In production (ตอนนี้โหมด Testing เข้าได้เฉพาะอีเมลใน Test users)
- เปิด API Gateway access log, CloudTrail, RDS deletion protection และ automated backup
- ลบ user pool เก่า `cs361-coop-web` และ branch `develop` ใน Amplify เมื่อไม่ใช้แล้ว
- โดเมนของตัวเอง (ถ้าเปลี่ยนโดเมน ต้องแก้ `CORS_ORIGIN` และ Gateway responses)
- Infrastructure as Code (V5) ดูรายการขั้นตอนที่ควร automate ในข้อ 13

## 13. Manual steps ที่เปลี่ยนเป็น Automation ได้

ตอนนี้ทุกขั้นตอนทำมือผ่าน AWS Console และ Google Cloud Console ตารางนี้ระบุว่าขั้นไหนควร automate และใช้อะไร เรียงตามประโยชน์ที่ได้

| # | Manual ตอนนี้ | Automation ที่แนะนำ | ผลที่ได้ |
|---|---|---|---|
| 1 | build zip backend ด้วยคำสั่งใน Git Bash (ข้อ 5) แล้วอัปโหลดผ่านหน้า Lambda | สคริปต์ build + `aws lambda update-function-code` หรือ GitHub Actions เมื่อ push `main` | ไม่ลืมไฟล์ใน zip, ย้อนเวอร์ชันได้, ไม่ค้างโค้ดเก่าบน Lambda |
| 2 | แก้ env ของ Lambda และ Amplify ด้วยมือทีละตัว (ข้อ 4) | กำหนดใน IaC หรือเก็บใน SSM Parameter Store | ค่าไม่คลาดเคลื่อนระหว่าง Lambda สองตัว (`MOCK_LOGINS`, `MOCK_PASSWORD`) |
| 3 | รัน `migrate` ด้วย test event ในหน้า Lambda (ข้อ 6) | ขั้นตอนใน pipeline หลัง deploy (`aws lambda invoke`) | migration ไม่ตกหล่น, มีบันทึกการรัน |
| 4 | ตั้ง API Gateway: resources, authorizer, binary media types, gateway responses, Deploy ทุกครั้ง (ข้อ 8) | OpenAPI + SAM/CloudFormation/Terraform และ deploy stage อัตโนมัติ | ไม่ลืม Deploy API, CORS/gateway responses ตรงกับ URL เว็บเสมอ |
| 5 | สร้าง VPC, subnet, security groups, S3 endpoint, RDS, S3 bucket, IAM role (ข้อ 2, 3) | CloudFormation / Terraform / AWS CDK | สร้างสภาพแวดล้อมใหม่ได้ซ้ำ (staging/production) ใน 1 คำสั่ง |
| 6 | ตั้ง Cognito: pool, app client, trigger, domain, style, Google provider, login pages (ข้อ 7) | IaC เดียวกัน (Cognito ทุกส่วนเขียนเป็น template ได้ ยกเว้น Google OAuth client ที่สร้างจาก Google Cloud) | ตั้งค่าซ้ำได้ ไม่พลาดเรื่อง `email_verified` mapping หรือ callback URL |
| 7 | ทดสอบหลัง deploy ด้วย curl (ข้อ 9) | smoke test ใน CI (health, 401, preflight CORS, login แล้วเรียก `/auth/me`) | รู้ทันทีว่า CORS หรือ authorizer พัง |
| 8 | ลงทะเบียนผู้ประสานงาน/กรรมการทีละคนในหน้าเว็บ และแก้ `MOCK_LOGINS` ใน Lambda สองตัว | สคริปต์นำเข้าผู้ใช้จากไฟล์ CSV ผ่าน User API | ลดงานซ้ำ ลดความผิดพลาดของอีเมล |
| 9 | Budget alert, log retention, alarm, backup ตั้งมือ (ข้อ 11) | IaC (AWS Budgets, `RetentionInDays`, CloudWatch Alarms, RDS backup retention) | ไม่ลืมตั้งเมื่อสร้างสภาพแวดล้อมใหม่ |
| 10 | เพิ่ม/แก้กฎ rewrite และ env ของ Amplify (ข้อ 8.1) | `amplify.yml` + ตั้งค่าผ่าน AWS CLI/IaC | หน้าเว็บ deploy ซ้ำได้ ไม่ต้องจำกฎ |

**ที่ยังต้องทำมือต่อไป** (ทำอัตโนมัติไม่ได้หรือไม่คุ้ม): สร้าง Google OAuth client และตั้ง consent screen/Test users, ขอ Application-Key จาก TU, ใส่ความลับ (รหัสผ่าน DB, Client secret) ครั้งแรก

**ลำดับที่แนะนำ:** เริ่มจากข้อ 1, 3 และ 7 ก่อน (ได้ผลเร็วและเสี่ยงต่ำ) ค่อยทำ IaC ข้อ 5 และ 6