# อธิบายโค้ดระบบวางแผนและจัดการสหกิจศึกษา (ฉบับละเอียด)

> อ่านจากบนลงล่างได้เลย ส่วนแรกปูพื้นศัพท์ก่อน แล้วค่อยพาเดินตามโค้ดจริงทีละไฟล์
> ทุกชื่อไฟล์ในเอกสารนี้เปิดดูในโปรเจกต์ได้จริง

## สารบัญ

0. [ศัพท์ที่ต้องรู้ก่อน](#0-ศัพท์ที่ต้องรู้ก่อน)
1. [ภาพรวม: ระบบนี้ทำอะไร](#1-ภาพรวม-ระบบนี้ทำอะไร)
2. [ภาพใหญ่: ชิ้นส่วนทั้งหมดต่อกันยังไง](#2-ภาพใหญ่-ชิ้นส่วนทั้งหมดต่อกันยังไง)
3. [เดินตาม 1 request ตั้งแต่กดปุ่มจนถึงฐานข้อมูล](#3-เดินตาม-1-request-ตั้งแต่กดปุ่มจนถึงฐานข้อมูล)
4. [การ login แบบละเอียด](#4-การ-login-แบบละเอียด)
5. [Backend ทีละไฟล์](#5-backend-ทีละไฟล์)
6. [ฐานข้อมูล](#6-ฐานข้อมูล)
7. [ใบสมัคร: เส้นทางชีวิตและโค้ดแต่ละขั้น](#7-ใบสมัคร-เส้นทางชีวิตและโค้ดแต่ละขั้น)
8. [เกณฑ์คุณสมบัติสหกิจ (coopCriteria)](#8-เกณฑ์คุณสมบัติสหกิจ-coopcriteria)
9. [ไฟล์ PDF และโลโก้](#9-ไฟล์-pdf-และโลโก้)
10. [Frontend ทีละไฟล์](#10-frontend-ทีละไฟล์)
11. [หน้าจอแต่ละบทบาท](#11-หน้าจอแต่ละบทบาท)
12. [รันในเครื่อง / deploy / env / ทดสอบ](#12-รันในเครื่อง--deploy--env--ทดสอบ)
13. [ข้อสังเกตในโค้ด (ควรรู้ไว้เผื่อโดนถาม)](#13-ข้อสังเกตในโค้ด-ควรรู้ไว้เผื่อโดนถาม)
14. [คำถามที่อาจโดนถาม](#14-คำถามที่อาจโดนถาม)

---

## 0. ศัพท์ที่ต้องรู้ก่อน

| คำ | ความหมายแบบบ้าน ๆ | ในโปรเจกต์นี้คือ |
|---|---|---|
| **Frontend** | ส่วนที่ผู้ใช้เห็นในเบราว์เซอร์ | โฟลเดอร์ `frontend/` เขียนด้วย React |
| **Backend** | โปรแกรมหลังบ้าน รับคำขอ ตรวจสิทธิ์ อ่าน/เขียนฐานข้อมูล | โฟลเดอร์ `backend/` เขียนด้วย Node.js + Express |
| **API** | "เมนู" ที่ backend เปิดให้ frontend สั่ง เช่น `GET /api/terms` | อยู่ใน `backend/src/routes/` |
| **Request / Response** | frontend ส่งคำขอ (request) → backend ตอบกลับ (response) เป็น JSON | |
| **HTTP method** | `GET` = ขอดู, `POST` = สร้าง, `PUT`/`PATCH` = แก้, `DELETE` = ลบ | |
| **Status code** | ตัวเลขบอกผล: `200` สำเร็จ, `201` สร้างแล้ว, `401` ยังไม่ login, `403` ไม่มีสิทธิ์, `404` ไม่พบ, `409` ชนกัน/สถานะไม่ถูก, `422` ข้อมูลไม่ผ่านเกณฑ์, `500` พังฝั่งเซิร์ฟเวอร์ | |
| **Route** | การจับคู่ "URL + method" กับฟังก์ชันที่จะทำงาน | `router.get('/terms', ...)` |
| **Middleware** | ด่านตรวจที่ request ต้องผ่านก่อนถึงฟังก์ชันจริง | `authenticate` (login แล้วหรือยัง), `allowRoles` (บทบาทถูกไหม) |
| **Token (JWT)** | "บัตรผ่าน" ที่ได้หลัง login แนบไปกับทุก request ในหัว `Authorization: Bearer <token>` | Cognito เป็นคนออกให้ |
| **Transaction** | ทำหลายคำสั่ง SQL เป็นก้อนเดียว สำเร็จทั้งหมดหรือไม่บันทึกเลย | `transaction()` ใน `config/db.js` |
| **Lock (`FOR UPDATE`)** | จองแถวในฐานข้อมูลไว้ ไม่ให้คนอื่นแก้พร้อมกัน | ใช้ตอนเปลี่ยนสถานะใบสมัคร |
| **Lambda** | รันโค้ดบน AWS โดยไม่ต้องมีเซิร์ฟเวอร์ของตัวเอง | backend และ Cognito triggers |
| **State (React)** | ตัวแปรในหน้าเว็บที่เปลี่ยนแล้วหน้าจอวาดใหม่ให้เอง | `useState(...)` |
| **Context (React)** | ตัวแปรกลางที่ทุกหน้าเข้าถึงได้ | `AuthContext` เก็บว่าใคร login อยู่ |

---

## 1. ภาพรวม: ระบบนี้ทำอะไร

ระบบรับสมัครสหกิจศึกษาของนักศึกษาสาขาวิทยาการคอมพิวเตอร์ มธ. มีผู้ใช้ 4 บทบาท

| บทบาท | ทำอะไรได้ | หน้าแรกหลัง login |
|---|---|---|
| **นักศึกษา** (`student`) | กรอกคุณสมบัติ (GPAX, เกรดรายวิชา, Transcript), สมัครตำแหน่ง, ถอน, ยืนยันสิทธิ์ | `/student` |
| **อาจารย์ที่ปรึกษา** (`advisor`) | อนุมัติ/ไม่อนุมัติใบสมัครของนักศึกษาในความดูแล, ดูข้อมูลนักศึกษา | `/advisor` |
| **เจ้าหน้าที่** (`staff`) | เห็นทุกอย่าง อนุมัติใบสมัครได้ จัดการบริษัท ภาคการศึกษา ผู้ใช้ | `/staff` |
| **ผู้ประสานงานบริษัท** (`company`) | แก้ข้อมูลบริษัท, จัดการตำแหน่ง, คัดเลือกผู้สมัครที่ผ่านอนุมัติแล้ว | `/company-portal` |

หน้าที่ไม่ต้อง login: หน้าแรก (`/`), รายชื่อบริษัท (`/company`), คู่มือนักศึกษา (`/student-handbook`), หน้า login

---

## 2. ภาพใหญ่: ชิ้นส่วนทั้งหมดต่อกันยังไง

```
                    ┌──────────────────────────────┐
                    │   Browser (React ที่ build แล้ว) │
                    └──────────────────────────────┘
                       │ ① login           │ ② เรียก API (แนบ token)
                       ▼                   ▼
              ┌────────────────┐   ┌──────────────────────────┐
              │    Cognito     │   │  API Gateway (REST API)  │
              │  (ออก token)   │   │  ตรวจ token ก่อนส่งต่อ     │
              └────────────────┘   └──────────────────────────┘
                       │ เรียก trigger       │
                       ▼                   ▼
          ┌─────────────────────────┐  ┌──────────────────────┐
          │ Lambda: verify-auth-    │  │   Lambda: backend    │
          │ challenge (ตรวจรหัส)     │  │   (Express app)      │
          └─────────────────────────┘  └──────────────────────┘
                       │                   │            │
                       ▼                   ▼            ▼
                ┌───────────┐   ┌────────────────┐  ┌─────────────────┐
                │  TU API   │   │ RDS PostgreSQL │  │       S3        │
                │ (รหัส มธ.) │   │ (ข้อมูลทั้งหมด) │  │ (PDF, โลโก้)    │
                └───────────┘   └────────────────┘  └─────────────────┘
```

**แบ่งหน้าที่ชัด ๆ 3 ชั้น**

1. **TU API** = ยืนยันว่า "คนนี้เป็นนักศึกษา มธ. จริง รหัสผ่านถูก"
2. **Cognito** = จัดขั้นตอน login แล้วออก token
3. **ตาราง `users` ใน PostgreSQL** = ตัดสินว่า "คนนี้มีบทบาทอะไร ทำอะไรได้บ้าง"

---

## 3. เดินตาม 1 request ตั้งแต่กดปุ่มจนถึงฐานข้อมูล

ตัวอย่าง: **อาจารย์กดปุ่ม "อนุมัติ" ใบสมัคร** ไล่ตามโค้ดจริง

**ขั้น 1 — ปุ่มในหน้าเว็บ** `frontend/src/components/ReviewPanel.jsx`
อาจารย์กด "อนุมัติ" → เปิดช่องความเห็น → กด "ยืนยันอนุมัติ" → เรียก `onSubmit('approved', comment)`
(ถ้าเลือก "ไม่อนุมัติ" แต่ไม่ใส่เหตุผล จะขึ้น error ทันที ไม่ส่งไป backend)

**ขั้น 2 — หน้าเพจส่ง request** `frontend/src/pages/advisor/PendingApplications.jsx`
```js
await api(`/applications/${app.application_id}/reviews`, { method: 'POST', body: { status: decision, comment } });
await reload(); // โหลดรายการใหม่ ใบที่อนุมัติแล้วจะหายไปจากหน้านี้
```

**ขั้น 3 — ตัวกลางเรียก API** `frontend/src/services/api.js`
ฟังก์ชัน `api()` ขอ token จาก Amplify แล้วแนบหัว `Authorization: Bearer <token>` ส่งไปที่ `VITE_API_URL`
ถ้า backend ตอบ error จะแปลงเป็น `Error` ที่มี `status`, `code`, `details` ให้หน้าเพจเอาไปแสดง

**ขั้น 4 — API Gateway** ตรวจลายเซ็น token กับ Cognito ถ้าปลอมหรือหมดอายุ ตอบ `401` ทันที ไม่ถึง backend

**ขั้น 5 — เข้า Lambda** `backend/src/lambda.js`
แปลง event ของ AWS ให้เป็น request แบบ Express (ใช้ `serverless-http`) และเอา claims ที่ API Gateway ตรวจแล้วใส่ไว้ใน `req[VERIFIED_COGNITO_CLAIMS]`

**ขั้น 6 — Express app** `backend/src/app.js`
ผ่าน CORS → ใส่ `requestId` → แปลง JSON → ส่งไป router `routes/v3.js`

**ขั้น 7 — Router + ด่านตรวจ** `backend/src/routes/v3.js`
```js
router.use(authenticate);                       // ด่าน 1: ใครส่งมา (ทุก route หลังบรรทัดนี้)
router.post('/applications/:id/reviews',
  allowRoles('advisor', 'staff'),               // ด่าน 2: ต้องเป็นอาจารย์หรือเจ้าหน้าที่
  async (req, res) => res.json(await workflow.reviewApplication(req.user, v.id(req.params.id), req.body)));
```
- `authenticate` (`middlewares/auth.js`) หา user จากฐานข้อมูลแล้วใส่ไว้ใน `req.user`
- `allowRoles` เช็ก `req.user.role` ไม่ตรงตอบ `403`
- `v.id(...)` ตรวจว่า `:id` เป็นเลขจำนวนเต็มบวก

**ขั้น 8 — Business logic** `backend/src/services/applicationService.js` → `reviewApplication`
```
1. ตรวจ body: status ต้องเป็น approved/rejected, rejected ต้องมี comment
2. เปิด transaction
3. lockStudent: จองแถวนักศึกษา (FOR UPDATE)
4. ถ้าไม่ใช่ staff ต้องเป็นอาจารย์ที่ปรึกษาของนักศึกษาคนนี้ ไม่งั้น 403
5. จองแถวใบสมัคร ถ้าสถานะไม่ใช่ submitted → 409 "ใบสมัครถูกพิจารณาแล้ว"
   (ยกเว้นกดซ้ำด้วยผลเดิม ความเห็นเดิม → ตอบผลเดิมเฉย ๆ)
6. ถ้าอนุมัติ: ตรวจซ้ำว่า GPAX ≥ 2.75 และมี Transcript
7. INSERT application_reviews + UPDATE applications.status + INSERT application_history
8. COMMIT แล้วส่งใบสมัครฉบับล่าสุดกลับไป
```

**ขั้น 9 — ฐานข้อมูล** `backend/src/config/db.js`
`transaction()` สั่ง `BEGIN` → ทำงาน → `COMMIT` ถ้าพังกลางทาง `ROLLBACK` ทั้งก้อน
ถ้าชนกับคนอื่น (deadlock / serialization error) ลองใหม่อัตโนมัติสูงสุด 3 รอบ

**ขั้น 10 — ตอบกลับ** ถ้ามี error ที่ไหน `middlewares/errorHandler.js` จะแปลงเป็น JSON รูปแบบเดียวกัน:
```json
{ "message": "ใบสมัครถูกพิจารณาแล้ว", "error": { "code": "INVALID_TRANSITION", "message": "...", "request_id": "..." } }
```

> **ทุก request ในระบบไหลแบบนี้เหมือนกันหมด** ต่างกันแค่ route กับ service ที่เรียก

---

## 4. การ login แบบละเอียด

### 4.1 ใครเข้าแบบไหน

| ผู้ใช้ | กรอกอะไร | ตรวจรหัสกับอะไร |
|---|---|---|
| นักศึกษา | รหัสนักศึกษา / username TU / อีเมล `@dome.tu.ac.th` | **TU API** + ต้องเป็นรหัสสาขา CS |
| อาจารย์, เจ้าหน้าที่ | อีเมล mock เช่น `staff.v3@tu.ac.th` | รหัสผ่านร่วมของบัญชี mock |
| ผู้ประสานงานบริษัท | อีเมล mock หรือปุ่ม Google | รหัสผ่านร่วม / Google |

### 4.2 Login นักศึกษาบน AWS (Cognito) ทีละบรรทัด

**ฝั่งหน้าเว็บ**

1. `pages/Login.jsx` → ผู้ใช้เลือกบทบาท กรอก username/รหัส กด submit → เรียก `login()` ของ `AuthProvider`
2. `context/AuthProvider.jsx` → `login()` ตัดโดเมน `@dome.tu.ac.th` ออก แล้วเรียก `signInWithTu()`
3. `services/cognito.js` → `signInWithTu()`
   ```
   signOut()                         เคลียร์ session ค้าง
   signIn(CUSTOM_WITHOUT_SRP)        เริ่ม custom auth
     ถ้า UserNotFoundException      → login ครั้งแรก: signUp ด้วยรหัสสุ่ม (unusablePassword) แล้ว signIn ใหม่
   confirmSignIn(password)           ส่งรหัส TU ไปเป็น "คำตอบ" ของ challenge
   ```
   รหัสสุ่มตอน signUp ไม่มีใครรู้และใช้ login ไม่ได้ เพราะ app client เปิดเฉพาะ custom auth

**ฝั่ง Cognito triggers** (`backend/cognito-triggers/`)

| ลำดับ | ไฟล์ | ทำอะไร |
|---|---|---|
| ตอน signUp | `pre-sign-up/index.mjs` | ตรวจรูปแบบ username แล้ว `autoConfirmUser = true` ไม่ต้องยืนยันอีเมล |
| 1 | `define-auth-challenge/index.mjs` | session ว่าง → ถาม `CUSTOM_CHALLENGE` / ตอบถูก 1 ครั้ง → ออก token / อื่น ๆ → fail (ตอบผิดต้องเริ่มใหม่) |
| 2 | `create-auth-challenge/index.mjs` | สร้างคำถามประเภท `TU_PASSWORD` (ไม่เก็บคำตอบไว้ เพราะไปถาม TU ตรง ๆ) |
| 3 | `verify-auth-challenge/index.mjs` | **ตรวจรหัสจริง** (ดูข้อถัดไป) |

**`verify-auth-challenge` ทำอะไรบ้าง**
```
ถ้าเป็นรหัส 10 หลักที่ไม่ใช่สาขา CS     → ตอบผิดทันที ไม่ต้องถาม TU
ถ้าเป็นบัญชี mock (อยู่ใน MOCK_LOGINS) → เทียบกับ MOCK_PASSWORD (timingSafeEqual กันเดาจากเวลา)
ไม่งั้น → verifyWithTu(username, password)
          POST https://restapi.tu.ac.th/api/v1/auth/Ad/verify  (หัว Application-Key = TU_API_KEY, timeout 4 วิ)
          ผ่านเมื่อ: TU ตอบ status true
                    + username ที่ TU ตอบ ตรงกับที่กรอก
                    + ถ้าเป็นนักศึกษา รหัสต้องตรง /^\d{2}09(61|65)\d{4}$/  (สาขา CS)
          ผ่านแล้ว → saveTuProfile: เขียนชื่อไทย/อังกฤษ/อีเมลจาก TU ลง attribute ของ Cognito
                     (ให้ติดมาใน token เพื่อ backend เอาไปสร้างบัญชี)
TU ล่ม (5xx) หรือ key ผิด → throw error ให้หน้าเว็บขึ้น "ไม่สามารถตรวจสอบกับระบบ TU ได้"
```
ไม่มีจุดไหน log หรือเก็บรหัสผ่าน

**กลับมาที่หน้าเว็บ**

4. ได้ token แล้ว `AuthProvider` เรียก `fetchCognitoUser(role)` → `GET /api/auth/me`
5. backend `authenticate` → หา user ด้วย `cognito_sub`
   - **เจอ** → ใช้บัญชีนั้น
   - **ไม่เจอ** (login ครั้งแรก) → `bindCognitoUser(claims)` ใน `models/userModel.js`
     - Google → ผูกกับบัญชี `company` ที่อีเมลตรง (ต้องเป็นอีเมลที่ Google ยืนยันแล้ว)
     - บัญชี mock → ผูกกับบัญชีที่อีเมลตรง
     - TU → ผูกกับบัญชี student/advisor/staff ที่ username ตรง
     - ยังไม่มีบัญชีเลย และเป็นรหัส CS → `provisionTuStudent` **สร้างบัญชีใหม่** (users + students) หลักสูตรคิดจากปีรหัส
   - จากนั้น `fillTuNames` เติมชื่อ ถ้าตอนสร้างยังไม่ได้ชื่อ (ใช้รหัสนักศึกษาแทนชื่อไว้ก่อน)
   - บัญชีถูกปิด (`is_active = false`) → `403`
6. `AuthProvider` เช็กว่า `user.role` ตรงกับบทบาทที่เลือกในหน้า login ไม่ตรง → signOut + "บทบาทที่เลือกไม่ตรงกับบัญชีนี้"
7. บันทึก session แล้ว `Login.jsx` พาไปหน้าแรกของบทบาท

### 4.3 Login ในเครื่อง (โหมด development)

ไม่ใช้ Cognito หน้าเว็บส่ง `POST /api/auth/login` ตรงไปที่ backend → `developmentLogin` ใน `middlewares/auth.js`
```
mockAccount: ถ้ารหัสตรง DEV_AUTH_PASSWORD และอีเมล/username เป็นบัญชี auth_provider='dev' → ผ่าน
ไม่ใช่ → tuLogin: ถามตรง TU API เหมือนกัน (ใช้ฟังก์ชันจากไฟล์ verify-auth-challenge ตัวเดียวกัน)
ผ่าน → backend ออก token เอง (HMAC-SHA256 ด้วย DEV_AUTH_SECRET อายุ 1 ชม.)
```
โหมดนี้ปิดตัวเองอัตโนมัติถ้ารันบน Lambda หรือ `NODE_ENV=production` (`developmentAuth()`)

### 4.4 `authenticate` มี 3 โหมด (env `AUTH_MODE`)

| โหมด | ตรวจ token ยังไง |
|---|---|
| `development` | เช็กลายเซ็น HMAC ที่ backend ออกเอง |
| `api-gateway` (**ใช้บน AWS**) | API Gateway ตรวจแล้ว backend ตรวจซ้ำ: `iss` ต้องเป็น user pool ของเรา, `aud`/`client_id` ต้องเป็น client ของเรา, ยังไม่หมดอายุ |
| `cognito` | backend ตรวจลายเซ็นเองด้วยไลบรารี `aws-jwt-verify` |

ทุกโหมดจบที่เดียวกัน: `req.user = ข้อมูลจากฐานข้อมูล` **ไม่เชื่อ role ที่มากับ token หรือหน้าเว็บ**

### 4.5 Session ฝั่งหน้าเว็บ

- "จดจำการเข้าสู่ระบบ" ติ๊ก → เก็บใน `localStorage` (ปิดเบราว์เซอร์ยังอยู่) / ไม่ติ๊ก → `sessionStorage` (ปิดแท็บหลุด)
- เปิดเว็บทุกครั้ง `AuthProvider` เรียก `/auth/me` ใหม่ ถ้าบัญชีถูกปิดได้ `401/403` → ล้าง session ทันที
- `SESSION_VERSION = 3` ถ้ารูปแบบข้อมูลเปลี่ยน ให้เพิ่มเลขนี้ session เก่าจะถูกทิ้ง

---

## 5. Backend ทีละไฟล์

```
backend/src/
├── server.js        จุดเริ่มเมื่อรันในเครื่อง (app.listen)
├── lambda.js        จุดเริ่มเมื่อรันบน AWS Lambda
├── app.js           ประกอบ middleware + routes
├── migrate.js       สร้าง/อัปเดตตารางบน RDS
├── routes/          URL → ฟังก์ชัน
├── middlewares/     ด่านตรวจ (auth, error)
├── services/        business logic หลัก
├── models/          SQL ของ user และ company
├── controllers/     ตัวรับ request ของ /api/companies
├── config/          db, เกณฑ์สหกิจ, swagger
└── utils/           HttpError, ฟังก์ชันตรวจ input
```

### 5.1 จุดเริ่มต้น

| ไฟล์ | อธิบาย |
|---|---|
| `server.js` | `app.listen(port)` ใช้ตอน Docker / `npm run dev` |
| `lambda.js` | ห่อ app ด้วย `serverless-http`, ส่ง PDF/รูปเป็น binary, ถ้า event เป็น `{ "action": "migrate" }` จะรัน `migrate()` แทน |
| `app.js` | ลำดับ: CORS (`CORS_ORIGIN`) → ใส่ `X-Request-ID` → JSON ไม่เกิน 256kb → Swagger `/api/docs` → `/api/health`, `/api/db-check` → routes → `notFound` → `errorHandler` |

### 5.2 `config/db.js` — เชื่อมฐานข้อมูล

- `getPool()` สร้าง connection pool ครั้งเดียวแล้วใช้ซ้ำ (บน Lambda ใช้ข้าม request ได้)
- `max: 1` เพราะ Lambda หนึ่งตัวรับทีละ request ลดปัญหา RDS connection เต็ม
- ถ้ามี `DB_SECRET_ARN` จะดึงรหัส DB จาก AWS Secrets Manager
- SSL เปิดเป็นค่าเริ่มต้น (RDS บังคับ) Docker ตั้ง `DB_SSL=false`
- `query(sql, params)` ใช้ `$1, $2` เสมอ **กัน SQL injection**
- `transaction(work)` อธิบายในข้อ 3 ขั้น 9 + ตั้ง `lock_timeout = 5s` กันค้าง

### 5.3 `middlewares/`

| ไฟล์ | ฟังก์ชัน | หน้าที่ |
|---|---|---|
| `auth.js` | `authenticate` | หา user จาก token (ข้อ 4.4) |
| | `allowRoles(...roles)` | role ไม่อยู่ในรายการ → 403 |
| | `developmentLogin`, `tuLogin`, `mockAccount` | login ในเครื่อง (ข้อ 4.3) |
| `errorHandler.js` | `notFound` | ไม่มี route → 404 |
| | `errorHandler` | แปลง error เป็น JSON: `HttpError` ใช้ข้อความตรง ๆ, error ของ PostgreSQL แปลงตามรหัส เช่น `23505` (ข้อมูลซ้ำ) → 409, `23503` (อ้างอิงไม่มี) → 409, `40001`/`40P01` (ชนกัน) → 409, ต่อ DB ไม่ได้ → 503, อื่น ๆ → 500 แบบไม่เปิดเผยรายละเอียด |

### 5.4 `utils/`

- `httpError.js` — class `HttpError(status, message, code, details)` โยนจากที่ไหนก็ได้ errorHandler จะตอบตาม status นั้น
- `validation.js` — ตรวจ input ทุกอย่างก่อนเข้า DB:
  - `object(body, allowed)` ห้ามส่งช่องที่ไม่รู้จัก
  - `text`, `id`, `boolean`, `enumeration`, `email`, `phone`, `date`, `gpax` (0–4 ทศนิยม ≤ 2)
  - `documentKey` ไฟล์ต้องเป็นของเจ้าของบัญชี (`<user_id>/transcript-<uuid>.pdf`) กันเอาไฟล์คนอื่นมาแนบ
  - `courseGrades` รหัสวิชาต้องเป็น `คพ.xxx` เกรดต้องอยู่ใน A…F หรือ IP
  - ผิดเมื่อไหร่ → `422 VALIDATION_ERROR` พร้อมบอกช่องที่ผิด

### 5.5 `routes/` — API ทั้งหมด

**`routes/companies.js`** (ไม่ต้อง login — ใช้ในหน้าสาธารณะ)

| Method + URL | ทำอะไร |
|---|---|
| `GET /api/companies?search=&province=&position=&status=` | ค้นหา/กรองบริษัท (status: `open` / `upcoming` / `closed`) |
| `GET /api/companies/:id` | รายละเอียดบริษัท + ตำแหน่ง |

ไหลผ่าน `controllers/companyController.js` → `services/companyService.js` (ตรวจ input) → `models/companyModel.js` (SQL)
SQL ใช้ "วันนี้" ตามเวลาไทย (`Asia/Bangkok`) เพราะ RDS ตั้งเวลาเป็น UTC และ escape `% _ \` ในคำค้นหา

**`routes/v3.js`** (ทุก route ต้อง login ยกเว้น `/auth/login`)

| กลุ่ม | Method + URL | ใครเรียกได้ | ทำอะไร |
|---|---|---|---|
| Auth | `POST /auth/login` | ทุกคน (เฉพาะโหมด dev) | login ในเครื่อง |
| | `GET /auth/me` | ทุกคน | ข้อมูลตัวเอง + role |
| Users | `GET/POST /users`, `PUT/PATCH /users/:id` | staff | ดู/เพิ่ม/แก้/ปิดผู้ใช้ |
| Students | `GET/PUT /students/me` | student | ดู/แก้คุณสมบัติตัวเอง |
| | `GET /students/me/applications` | student | ใบสมัครของตัวเอง (ภาคที่ active) |
| | `GET /students` | advisor, staff | รายชื่อนักศึกษา (อาจารย์เห็นเฉพาะในความดูแล) |
| | `GET /students/:id` | student, advisor, staff | โปรไฟล์ + ใบสมัคร |
| | `PUT /students/:id` | student, staff | แก้ข้อมูลนักศึกษา |
| | `PUT /students/:id/advisor` | staff | กำหนดอาจารย์ที่ปรึกษา |
| | `GET /advisor/students`, `/advisor/students/:id` | advisor | นักศึกษาในความดูแล |
| Terms | `GET /terms`, `GET /terms/active` | ทุกคนที่ login | ภาคการศึกษา |
| | `POST /terms`, `PUT /terms/:id`, `POST /terms/:id/activate` | staff | เพิ่ม/แก้/ตั้งภาคที่ใช้งาน |
| Company | `GET/PUT /company/profile` | company | ข้อมูลบริษัทตัวเอง |
| | `GET /staff/companies/:id` | staff | ข้อมูลบริษัท + ผู้ประสานงาน |
| | `POST /companies`, `DELETE /companies/:id` | staff | เพิ่ม/ลบบริษัท |
| | `PUT /companies/:id` | company (ของตัวเอง), staff | แก้บริษัท |
| Positions | `GET/POST /positions`, `PUT/PATCH/DELETE /positions/:id` | company, staff | ตำแหน่งงาน |
| | `/company/positions...` | company | เหมือนข้างบนแต่บังคับเป็นบริษัทตัวเอง |
| Applications | `GET /applications`, `/advisor/applications`, `/staff/applications`, `/company/applications` | ตามชื่อ path | รายการใบสมัคร (กรอง `?term_id=&status=`) |
| | `POST /applications` | student | ส่งใบสมัคร |
| | `GET /applications/:id` | ผู้มีสิทธิ์เห็น | ใบสมัคร 1 ใบ |
| | `POST /applications/:id/reviews` | advisor, staff | อนุมัติ/ไม่อนุมัติ |
| | `PATCH /company/applications/:id/decision` | company | ผ่าน/ไม่ผ่านการคัดเลือก |
| | `POST /applications/:id/confirm` | student | ยืนยันสิทธิ์ |
| | `POST /applications/:id/withdraw` | student | ถอนใบสมัคร |

**`routes/documents.js`** และ **`routes/companyLogos.js`** — ดูข้อ 9

### 5.6 `services/` — หัวใจของระบบ

**`resourceService.js`** — ข้อมูลพื้นฐาน

| ฟังก์ชัน | จุดสำคัญ |
|---|---|
| `update()` (ภายใน) | สร้าง SQL UPDATE จากช่องที่ส่งมาเท่านั้น (ชื่อช่องผ่าน whitelist ของ `v.object` มาแล้ว) |
| `listUsers`, `saveUser` | เปลี่ยน role ของบัญชีเดิมไม่ได้ / ปิดบัญชีตัวเองไม่ได้ / role student → สร้างแถว `students` ให้ / role company → ต้องผูกกับบริษัทที่มีอยู่ |
| `listStudents` | อาจารย์เห็นเฉพาะ `advisor_id = ตัวเอง` พร้อมนับใบสมัคร ใบรออนุมัติ และสถานะล่าสุด |
| `studentProfile` | ตรวจสิทธิ์: staff / อาจารย์ของคนนั้น / ตัวนักศึกษาเอง |
| `saveStudent` | ถ้ามีใบที่ approved ขึ้นไปแล้ว **ห้ามแก้คุณสมบัติ** (แก้ได้แค่เบอร์โทร) / ถ้ายังไม่มี ต้องผ่าน `qualificationChecks` ทุกข้อถึงบันทึกได้ |
| `terms`, `saveTerm`, `activateTerm` | รหัสภาคต้องเป็นรูป `1/2569`, วันสิ้นสุดต้องไม่ก่อนวันเริ่ม, เปิดใช้งานได้ทีละภาค (ปิดทุกภาคแล้วเปิดภาคที่เลือก ใน transaction + advisory lock) |
| `companyProfile`, `saveCompany`, `deleteCompany` | บริษัทแก้ได้เฉพาะของตัวเอง / ลบไม่ได้ถ้ามีผู้ประสานงานหรือใบสมัคร |
| `positions`, `savePosition`, `deletePosition` | บริษัทเห็น/แก้เฉพาะของตัวเอง / ลด quota ต่ำกว่าคนที่รับแล้วไม่ได้ / เปลี่ยนภาคหรือลบไม่ได้ถ้ามีใบสมัครแล้ว |

**`applicationService.js`** — ขั้นตอนใบสมัคร (ข้อ 7)

### 5.7 `models/`

**`userModel.js`**
- `USER_COLUMNS` / `USER_JOINS` — SELECT ผู้ใช้พร้อมข้อมูลนักศึกษา อาจารย์ที่ปรึกษา และบริษัท ในคำสั่งเดียว
  มี `qualification_locked` = มีใบที่ approved/accepted/confirmed แล้วหรือยัง (หน้าโปรไฟล์ใช้ล็อกฟอร์ม)
- `userById`, `userBySubject` — หา user
- `bindCognitoUser`, `fillTuNames`, `provisionTuStudent`, `registeredTuStaff` — ข้อ 4.2 / 4.3
  `bindCognitoUser` ผูกเฉพาะเมื่อเจอ **บัญชีเดียว** ที่ยังไม่เคยผูก (`HAVING count(*)=1`) ไม่เดาถ้ามีหลายบัญชี

**`companyModel.js`** — SQL ของหน้าสาธารณะ แสดงเฉพาะตำแหน่งที่ไม่ผูกภาค หรือผูกกับภาคที่ active

### 5.8 `migrate.js`

- รันไฟล์ `.sql` ใน `schema/init` และ `schema/migrations` เรียงตามชื่อ ไฟล์ละครั้ง (จำไว้ในตาราง `schema_migrations`)
- `seeds: true` ถึงจะใส่ข้อมูลตัวอย่าง
- `reset: "yes-delete-everything"` ลบทั้ง schema (ต้องพิมพ์ยาว ๆ กันกดพลาด)
- ใช้ advisory lock กันสองคนสั่ง migrate พร้อมกัน

---

## 6. ฐานข้อมูล

### 6.1 ศัพท์ฐานข้อมูลที่ใช้ในข้อนี้

| คำ | ความหมาย | ตัวอย่างในโปรเจกต์ |
|---|---|---|
| **Table (ตาราง)** | เหมือนชีต Excel 1 แผ่น แต่ละแถวคือข้อมูล 1 รายการ | `users`, `applications` |
| **Column (คอลัมน์)** | ช่องข้อมูล มีชนิดกำหนดตายตัว | `gpax NUMERIC(3,2)` |
| **PRIMARY KEY (PK)** | เลขประจำตัวแถว ห้ามซ้ำ ห้ามว่าง | `user_id SERIAL PRIMARY KEY` |
| **SERIAL** | เลขรันอัตโนมัติ 1, 2, 3, … | ทุก `*_id` |
| **FOREIGN KEY (FK) / `REFERENCES`** | ช่องที่ชี้ไปหาแถวในอีกตาราง ต้องชี้ไปที่มีอยู่จริง | `students.user_id → users.user_id` |
| **`ON DELETE CASCADE`** | ลบแถวแม่ แถวลูกถูกลบตาม | ลบบริษัท → ตำแหน่งของบริษัทหายด้วย |
| **`ON DELETE SET NULL`** | ลบแถวแม่ ช่องในแถวลูกกลายเป็นว่าง | ลบบัญชีอาจารย์ → `students.advisor_id` เป็น NULL |
| **`NOT NULL`** | ห้ามว่าง | `users.email` |
| **`UNIQUE`** | ห้ามซ้ำ | `users.username` |
| **`CHECK`** | กฎที่ค่าต้องผ่าน | `gpax BETWEEN 0 AND 4` |
| **`DEFAULT`** | ค่าเริ่มต้นถ้าไม่ได้ใส่ | `status DEFAULT 'submitted'` |
| **INDEX** | สารบัญช่วยค้นหาเร็ว | `idx_students_advisor_id` |
| **Partial unique index** | ห้ามซ้ำ "เฉพาะแถวที่เข้าเงื่อนไข" | active ได้ภาคเดียว, confirmed ได้ใบเดียว |
| **JSONB** | เก็บข้อมูลแบบ JSON ในช่องเดียว | `course_grades = {"คพ.101":"A"}` |
| **TIMESTAMPTZ** | วันเวลาพร้อม timezone | `submitted_at` |

### 6.2 ไฟล์ที่เกี่ยวกับฐานข้อมูล

| ไฟล์ | ใช้เมื่อไหร่ | ทำอะไร |
|---|---|---|
| `database/dockerfile` | รันในเครื่อง | ใช้ image `postgres:17-alpine` แล้วก๊อป `init/` ไปไว้ที่ `docker-entrypoint-initdb.d` (PostgreSQL รันไฟล์ในนั้นเองตอนสร้างครั้งแรก) |
| `database/init/001_schema.sql` | สร้างฐานข้อมูลใหม่ | สร้าง 9 ตาราง + index + ใส่ภาค `2/2569` + บริษัทตัวอย่าง (ข้อมูลมาจาก `frontend/src/data/mockfile.json`) + ตำแหน่งงานตัวอย่าง |
| `database/migrations/003_v3_schema.sql` | อัปเกรดฐานข้อมูลเวอร์ชันเก่า (V1/V2) | เปลี่ยนชื่อคอลัมน์ `id` → `company_id`/`position_id`, ย้ายเบอร์โทรไปไว้ที่ `users.phone`, **ลบ `password_hash` ทิ้ง**, เพิ่มตาราง/คอลัมน์ที่ขาด รันซ้ำได้ |
| `database/migrations/004_student_course_grades.sql` | อัปเกรดต่อ | เพิ่ม `curriculum`, `course_grades`, `declarations` ให้ตาราง `students` โดยไม่ลบข้อมูลเดิม |
| `database/seeds/005_v3-demo.sql` | ทดสอบในเครื่องเท่านั้น | บัญชีทดสอบครบ 4 บทบาท + นักศึกษา 8 คน มีใบสมัครครบ 8 สถานะ รันซ้ำไม่เพิ่มข้อมูลซ้ำ |
| `backend/src/migrate.js` | บน AWS | รันไฟล์ข้างบนบน RDS ผ่าน Lambda (ข้อ 5.8) |

> ไฟล์ `init` ทำงานเฉพาะตอน volume ของ Docker ยังว่าง ถ้ามีข้อมูลอยู่แล้ว การ rebuild จะไม่อัปเดตตาราง ต้องรัน migration เอง (วิธีอยู่ใน `database/README.md`)

### 6.3 แผนภาพความสัมพันธ์ (ER Diagram)

```
                        ┌──────────────────────┐
                        │        users         │  ← ทุกคน ทุกบทบาท
                        │ PK user_id           │
                        │    role              │
                        └──────────────────────┘
                 1 │            1 │       1 │ (advisor)     1 │ (reviewer / changed_by)
                   │              │         │                 │
              0..1 ▼         0..1 ▼         │ *               │
   ┌──────────────────┐  ┌───────────────┐  │                 │
   │  company_users   │  │   students    │◀─┘ advisor_id      │
   │ PK,FK user_id    │  │ PK student_id │                    │
   │ FK company_id    │  │ FK user_id    │                    │
   └──────────────────┘  │ FK advisor_id │                    │
            * │          └───────────────┘                    │
              │                1 │                            │
            1 ▼                * ▼                            │
   ┌──────────────────┐  ┌─────────────────────┐              │
   │    companies     │  │    applications     │              │
   │ PK company_id    │  │ PK application_id   │              │
   └──────────────────┘  │ FK student_id       │              │
            1 │          │ FK term_id ─────────┼──▶ terms     │
            * ▼          │ FK position_id      │              │
   ┌──────────────────┐  │    status           │              │
   │    positions     │◀─┤                     │              │
   │ PK position_id   │ *└─────────────────────┘              │
   │ FK company_id    │       1 │         1 │                 │
   │ FK term_id ──────┼──▶ terms│           │                 │
   └──────────────────┘       * ▼         * ▼                 │
                  ┌─────────────────────┐ ┌─────────────────────┐
                  │ application_reviews │ │ application_history │
                  │ FK reviewer_id ─────┼─┼─ FK changed_by ─────┼──▶ users
                  └─────────────────────┘ └─────────────────────┘

  1 = หนึ่ง   * = หลาย   0..1 = มีหรือไม่มีก็ได้ (ไม่เกิน 1)
```

**อ่านเป็นประโยค**
- ผู้ใช้ 1 คน **อาจ** มีข้อมูลนักศึกษา 1 ชุด (ถ้า role = student) หรือผูกกับบริษัท 1 แห่ง (ถ้า role = company)
- อาจารย์ 1 คนดูแลนักศึกษาได้หลายคน (`students.advisor_id` ชี้กลับไปที่ `users`)
- บริษัท 1 แห่งมีหลายตำแหน่ง และมีผู้ประสานงานได้หลายคน
- นักศึกษา 1 คนมีใบสมัครได้หลายใบ ใบสมัคร 1 ใบเป็นของตำแหน่ง 1 ตำแหน่งในภาค 1 ภาค
- ใบสมัคร 1 ใบมีผลพิจารณาได้หลายครั้ง และมีประวัติการเปลี่ยนสถานะหลายแถว

### 6.4 ทีละตาราง ทีละคอลัมน์

#### `users` — บัญชีผู้ใช้ทุกคน

| คอลัมน์ | ชนิด | กฎ | ความหมาย |
|---|---|---|---|
| `user_id` | SERIAL | PK | เลขประจำตัวในระบบ |
| `auth_provider` | VARCHAR(10) | NOT NULL | มาจากไหน: `dev` (บัญชีทดสอบ), `tu` (login TU ในเครื่อง), `cognito` |
| `username` | VARCHAR(50) | NOT NULL, **UNIQUE** | นักศึกษา = รหัสนักศึกษา, อื่น ๆ = ชื่อผู้ใช้ |
| `cognito_sub` | VARCHAR(64) | **UNIQUE** | รหัสผู้ใช้ใน Cognito (ว่างได้ จนกว่าจะ login ครั้งแรกแล้วผูก) |
| `role` | VARCHAR(20) | NOT NULL, CHECK 4 ค่า | `student` / `advisor` / `staff` / `company` |
| `th_name`, `en_name` | VARCHAR(255) | NOT NULL | ชื่อไทย / อังกฤษ |
| `email` | VARCHAR(255) | NOT NULL | อีเมล |
| `phone` | VARCHAR(20) | | เบอร์โทร |
| `is_active` | BOOLEAN | DEFAULT TRUE | ปิดบัญชี = FALSE (ข้อมูลยังอยู่ แต่ login ไม่ได้) |

> **ไม่มีคอลัมน์รหัสผ่าน** — ระบบไม่เก็บรหัสผ่านเลย การยืนยันตัวตนอยู่ที่ TU API / Cognito / Google (migration 003 ลบ `password_hash` ของเวอร์ชันเก่าทิ้ง)

#### `students` — ข้อมูลเพิ่มของนักศึกษา

| คอลัมน์ | ชนิด | กฎ | ความหมาย |
|---|---|---|---|
| `student_id` | SERIAL | PK | เลขประจำตัวนักศึกษาในระบบ (**ไม่ใช่รหัสนักศึกษา** รหัสอยู่ที่ `users.username`) |
| `user_id` | INTEGER | FK → users, **UNIQUE**, CASCADE | ผูกกับบัญชี 1 ต่อ 1 |
| `gpax` | NUMERIC(3,2) | CHECK 0–4 | เกรดเฉลี่ยสะสม เช่น 3.25 |
| `transcript_s3_key` | VARCHAR(512) | | ที่อยู่ไฟล์ Transcript ใน S3 เช่น `12/transcript-<uuid>.pdf` |
| `advisor_id` | INTEGER | FK → users, SET NULL | อาจารย์ที่ปรึกษา |
| `curriculum` | VARCHAR(2) | CHECK `61`/`66` | หลักสูตร |
| `course_grades` | JSONB | DEFAULT `{}` ต้องเป็น object | เกรดรายวิชา เช่น `{"คพ.101":"A","คพ.384":"IP"}` |
| `declarations` | JSONB | DEFAULT `{}` ต้องเป็น object | ติ๊กรับทราบ `{"mustPass":true,"discipline":true,"accept":true}` |

ทำไมแยกจาก `users`? เพราะข้อมูลพวกนี้มีเฉพาะนักศึกษา ถ้ารวมไว้ใน `users` อาจารย์/บริษัทจะมีช่องว่างเปล่าเต็มไปหมด

ทำไมเกรดเป็น JSONB ไม่ทำตารางแยก? รายวิชาต่างกันตามหลักสูตร และใช้แค่ตรวจคุณสมบัติ ไม่ต้องค้นหาข้ามคน เก็บเป็นก้อนเดียวง่ายกว่า

#### `company_users` — ผู้ประสานงานผูกกับบริษัท

| คอลัมน์ | ชนิด | กฎ | ความหมาย |
|---|---|---|---|
| `user_id` | INTEGER | **PK** + FK → users, CASCADE | user_id เป็น PK เลย = 1 คนอยู่ได้แค่ 1 บริษัท |
| `company_id` | INTEGER | FK → companies, CASCADE | บริษัท |
| `job_title` | VARCHAR(150) | | ตำแหน่งของผู้ประสานงาน |

#### `companies` — สถานประกอบการ

| คอลัมน์ | ชนิด | กฎ | ความหมาย |
|---|---|---|---|
| `company_id` | SERIAL | PK | |
| `name` | VARCHAR(255) | NOT NULL | ชื่อบริษัท |
| `logo` | VARCHAR(255) | | ชื่อไฟล์โลโก้ (ข้อมูลตัวอย่าง เช่น `C01.jpg`) หรือ URL ที่อัปโหลด `/company-logos/...` |
| `description`, `location` | TEXT | | คำอธิบาย / ที่อยู่ |
| `province` | VARCHAR(100) | มี INDEX | จังหวัด (มี index เพราะหน้าบริษัทกรองตามจังหวัด) |
| `application_start`, `application_end` | DATE | CHECK end ≥ start | ช่วงที่บริษัทเปิดรับสมัคร (ใช้คำนวณป้าย เปิด/ยังไม่เปิด/ปิดแล้ว) |

> คำสั่ง `setval(...)` ท้ายไฟล์ init ใช้ตั้งเลขรันของ `company_id` ให้ต่อจากข้อมูลตัวอย่าง (เพราะใส่ id เองตอน INSERT ถ้าไม่ตั้ง บริษัทใหม่จะได้ id 1 ชนกับของเดิม)

#### `positions` — ตำแหน่งที่เปิดรับ

| คอลัมน์ | ชนิด | กฎ | ความหมาย |
|---|---|---|---|
| `position_id` | SERIAL | PK | |
| `company_id` | INTEGER | FK → companies, CASCADE | เป็นของบริษัทไหน |
| `name`, `description` | | name NOT NULL | ชื่อและรายละเอียดตำแหน่ง |
| `quota` | INTEGER | CHECK ≥ 0 หรือ NULL | จำนวนที่รับ (**แสดงผลและเตือนเท่านั้น** ไม่ได้บล็อกการรับเกิน) |
| `term_id` | INTEGER | FK → terms | ผูกกับภาคไหน (NULL = ไม่ผูกภาค ใช้ได้ทุกภาค) |
| `is_open` | BOOLEAN | DEFAULT TRUE | บริษัทกดปิดรับเองได้ |

#### `terms` — ภาคการศึกษา

| คอลัมน์ | ชนิด | กฎ | ความหมาย |
|---|---|---|---|
| `term_id` | SERIAL | PK | |
| `code` | VARCHAR(20) | UNIQUE | เช่น `2/2569` |
| `plan_open_at`, `plan_close_at` | DATE | CHECK close ≥ open | ช่วงที่นักศึกษาส่งใบสมัครได้ |
| `coop_start`, `coop_end` | DATE | CHECK end ≥ start | ช่วงไปฝึกงานจริง |
| `is_active` | BOOLEAN | DEFAULT FALSE | ภาคที่ใช้งานอยู่ |

**`one_active_term`** = `UNIQUE INDEX ON terms (is_active) WHERE is_active`
แปลว่า "ในบรรดาแถวที่ `is_active = TRUE` ค่า is_active ห้ามซ้ำ" → มี TRUE ได้แถวเดียว = **active ได้ภาคเดียว**

#### `applications` — ใบสมัคร

| คอลัมน์ | ชนิด | กฎ | ความหมาย |
|---|---|---|---|
| `application_id` | SERIAL | PK | |
| `student_id` | INTEGER | FK → students, CASCADE | ใครสมัคร |
| `term_id` | INTEGER | FK → terms | ภาคไหน |
| `position_id` | INTEGER | FK → positions | ตำแหน่งไหน |
| `status` | VARCHAR(20) | DEFAULT `submitted`, CHECK 8 ค่า | สถานะ (ข้อ 7) |
| `resume_s3_key` | VARCHAR(512) | | ไฟล์เรซูเม่ |
| `submitted_at` | TIMESTAMPTZ | DEFAULT NOW() | เวลาส่ง |

- **`UNIQUE (student_id, term_id, position_id)`** → สมัครตำแหน่งเดิมในภาคเดิมได้ใบเดียว
- **`one_confirmed_per_term`** = `UNIQUE INDEX ON applications (student_id, term_id) WHERE status = 'confirmed'` → ยืนยันสิทธิ์ได้ใบเดียวต่อภาค
- ทำไมเก็บ `term_id` ทั้งที่ตำแหน่งก็มี `term_id`? เพราะตำแหน่งที่ไม่ผูกภาค (`term_id = NULL`) ใบสมัครยังต้องรู้ว่าเป็นของภาคไหน

#### `application_reviews` — ผลพิจารณาของอาจารย์/เจ้าหน้าที่

| คอลัมน์ | ชนิด | กฎ | ความหมาย |
|---|---|---|---|
| `review_id` | SERIAL | PK | |
| `application_id` | INTEGER | FK → applications, CASCADE | ใบไหน |
| `reviewer_id` | INTEGER | FK → users | ใครพิจารณา |
| `status` | VARCHAR(20) | CHECK `approved`/`rejected` | ผล |
| `comment` | TEXT | | ความเห็น (โค้ดบังคับให้มีเมื่อ rejected) |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | เวลา |

อาจารย์ **หรือ** เจ้าหน้าที่คนใดคนหนึ่งอนุมัติ ใบก็เปลี่ยนเป็น `approved` ทันที

#### `application_history` — ประวัติการเปลี่ยนสถานะ (audit log)

| คอลัมน์ | ชนิด | กฎ | ความหมาย |
|---|---|---|---|
| `history_id` | SERIAL | PK | |
| `application_id` | INTEGER | FK → applications, CASCADE | ใบไหน |
| `changed_by` | INTEGER | FK → users, SET NULL | ใครเปลี่ยน |
| `from_status` | VARCHAR(20) | | สถานะเดิม (NULL = เพิ่งส่ง) |
| `to_status` | VARCHAR(20) | NOT NULL | สถานะใหม่ |
| `position_id`, `resume_s3_key` | | | ค่า ณ ตอนเปลี่ยน (เก็บไว้เป็นหลักฐาน) |
| `changed_at` | TIMESTAMPTZ | DEFAULT NOW() | เวลา |

เพิ่มแถวใน transaction เดียวกับที่เปลี่ยน `applications.status` เสมอ → สถานะกับประวัติไม่มีทางไม่ตรงกัน
หน้า "ภาพรวมสหกิจ" ของเจ้าหน้าที่ใช้ตารางนี้แสดงไทม์ไลน์

### 6.5 Index ทั้งหมด และทำไมต้องมี

| Index | ช่วยอะไร |
|---|---|
| `idx_companies_province` | กรองบริษัทตามจังหวัด |
| `idx_positions_company_id` | ดึงตำแหน่งของบริษัท |
| `idx_positions_term_id` | ดึงตำแหน่งของภาคที่ active |
| `idx_students_advisor_id` | อาจารย์ดูนักศึกษาในความดูแล |
| `idx_company_users_company_id` | หาผู้ประสานงานของบริษัท |
| `idx_applications_position_id` | นับผู้สมัครต่อตำแหน่ง |
| `idx_applications_student_term` | ใบสมัครของนักศึกษาในภาคหนึ่ง |
| `idx_application_reviews_application_id`, `idx_application_history_application_id` | ดึงผลพิจารณา/ประวัติของใบสมัคร |
| `one_active_term`, `one_confirmed_per_term` | **ไม่ได้มีไว้ให้เร็ว แต่เป็นกฎ** (ข้อ 6.4) |

### 6.6 ตัวอย่างข้อมูล 1 เรื่องเต็ม ๆ

นักศึกษา `6609610031` สมัคร Demo Developer ที่ V3 Demo Company → อาจารย์อนุมัติ → บริษัทรับ → ยืนยันสิทธิ์

```
users                (1, 'v3.advisor',   role=advisor, th_name='อาจารย์ทดสอบ')
                     (6, '6609610031',   role=student, th_name='นักศึกษาทดสอบ 1')
                     (9, 'v3.company',   role=company)
students             (student_id=1, user_id=6, gpax=3.30, advisor_id=1, curriculum='66')
companies            (company_id=50, name='V3 Demo Company')
company_users        (user_id=9, company_id=50)
positions            (position_id=200, company_id=50, name='Demo Developer', term_id=1)
terms                (term_id=1, code='2/2569', is_active=TRUE)

applications         (application_id=10, student_id=1, term_id=1, position_id=200, status='confirmed')
application_reviews  (application_id=10, reviewer_id=1, status='approved', comment='เหมาะสม')
application_history  (10, by=6, NULL        → submitted)
                     (10, by=1, submitted   → approved)
                     (10, by=9, approved    → accepted)
                     (10, by=6, accepted    → confirmed)
```
(ตัวเลข id เป็นตัวอย่าง)

### 6.7 กฎที่ล็อกไว้สองชั้น (โค้ด + ฐานข้อมูล)

| กฎ | ในโค้ด | ในฐานข้อมูล |
|---|---|---|
| role มีแค่ 4 แบบ | `v.ROLES` | `CHECK (role IN ...)` |
| username ไม่ซ้ำ | — | `UNIQUE` (ซ้ำ → errorHandler แปลงรหัส `23505` เป็น 409) |
| GPAX 0–4 | `v.gpax()` | `CHECK (gpax BETWEEN 0 AND 4)` |
| สถานะใบสมัครมี 8 แบบ | `v.STATUSES` | `CHECK (status IN ...)` |
| ไม่สมัครซ้ำ | `createApplication` เช็ก duplicate | `UNIQUE (student_id, term_id, position_id)` |
| ยืนยันได้ที่เดียว | `studentAction` เช็กก่อน | `one_confirmed_per_term` |
| ภาค active ได้ภาคเดียว | `activateTerm` ปิดทุกภาคก่อน | `one_active_term` |
| วันที่สิ้นสุดไม่ก่อนวันเริ่ม | `saveTerm`, `saveCompany` | `CHECK (... >= ...)` |
| ลบบริษัทที่มีใบสมัครไม่ได้ | `deleteCompany` เช็กก่อน | FK ของ `applications.position_id` ไม่มี CASCADE (ลบ → รหัส `23503` → 409) |

ถึงโค้ดมีบั๊กหรือมีคนยิง SQL ตรง ๆ ฐานข้อมูลก็ยังไม่ยอมรับข้อมูลที่ผิดกฎ

### 6.8 คำถามเรื่องฐานข้อมูลที่อาจโดนถาม

| คำถาม | คำตอบ |
|---|---|
| ทำไมใช้ PostgreSQL ไม่ใช้ NoSQL | ข้อมูลมีความสัมพันธ์ชัดเจน (นักศึกษา–ใบสมัคร–ตำแหน่ง–บริษัท) และต้องใช้ transaction กับ lock กันข้อมูลชนกัน ซึ่ง relational database ทำได้ดี |
| ทำไม `students` แยกจาก `users` | เป็นข้อมูลเฉพาะนักศึกษา แยกแล้วไม่มีช่องว่างในบัญชีบทบาทอื่น |
| ทำไมมีทั้ง `application_reviews` และ `application_history` | reviews เก็บ "ความเห็นของผู้พิจารณา" ให้นักศึกษาอ่าน / history เก็บ "ทุกการเปลี่ยนสถานะ" ของทุกคนเป็นหลักฐาน |
| ลบผู้ใช้แล้วข้อมูลหายไหม | ระบบใช้ "ปิดบัญชี" (`is_active = FALSE`) แทนการลบ ข้อมูลเดิมยังอยู่ครบ |
| ทำไมเก็บแค่ key ของไฟล์ ไม่เก็บไฟล์ใน DB | ไฟล์ PDF ใหญ่ เก็บใน S3 ถูกกว่าและไม่ทำให้ DB บวม DB เก็บแค่ที่อยู่ไฟล์ |
| รองรับหลายภาคการศึกษาไหม | รองรับ ทุกใบสมัครผูก `term_id` และเปลี่ยนภาค active ได้ ข้อมูลภาคเก่ายังอยู่

---

## 7. ใบสมัคร: เส้นทางชีวิตและโค้ดแต่ละขั้น

```
  นักศึกษาส่ง          อาจารย์/เจ้าหน้าที่          บริษัท              นักศึกษา
 ┌───────────┐       ┌────────────┐       ┌────────────┐       ┌────────────┐
 │ submitted │ ────▶ │  approved  │ ────▶ │  accepted  │ ────▶ │ confirmed  │
 └───────────┘       └────────────┘       └────────────┘       └────────────┘
       │                   │                    │
       ▼                   ▼                    ▼
   rejected            declined          (ใบ accepted อื่นในภาคเดียวกัน → released)
 (ต้องใส่เหตุผล)                           (ใบ submitted/approved อื่น → withdrawn)

 submitted / approved ──(นักศึกษาถอน)──▶ withdrawn
```

ทุกขั้นอยู่ใน `backend/src/services/applicationService.js` และทำใน transaction พร้อม lock

| ขั้น | ฟังก์ชัน | ตรวจอะไรบ้าง |
|---|---|---|
| **ส่งใบสมัคร** | `createApplication` | ต้องแนบเรซูเม่ของตัวเอง / มีภาคที่ active / ถ้าส่งซ้ำด้วยเรซูเม่เดิม → คืนใบเดิม (ไม่สร้างซ้ำ), เรซูเม่ต่าง → 409 / GPAX ≥ 2.75 + มี Transcript / มีอาจารย์ที่ปรึกษา / อยู่ในช่วงรับสมัครของภาค และตำแหน่งเปิดรับ / อยู่ในช่วงรับสมัครของบริษัท / ยังไม่เคย confirmed ในภาคนี้ |
| **อาจารย์/เจ้าหน้าที่พิจารณา** | `reviewApplication` | ข้อ 3 ขั้น 8 |
| **บริษัทคัดเลือก** | `decideApplication` | ต้องเป็นตำแหน่งของบริษัทตัวเอง / ใบต้องเป็น `approved` เท่านั้น |
| **นักศึกษาถอน** | `studentAction('withdraw')` | ต้องเป็นใบของตัวเอง / สถานะ `submitted` หรือ `approved` |
| **นักศึกษายืนยัน** | `studentAction('confirm')` | ใบต้อง `accepted` / ภาคนี้ยังไม่เคย confirm / จากนั้นวนทุกใบในภาค: ใบนี้ → `confirmed`, `accepted` อื่น → `released`, `submitted/approved` อื่น → `withdrawn` |

**ใครเห็นใบสมัครไหน** (`applications()`)
- staff เห็นทุกใบ / student เห็นของตัวเอง / advisor เห็นของนักศึกษาในความดูแล
- company เห็นเฉพาะใบของบริษัทตัวเองที่ **ผ่านอาจารย์แล้ว** (approved ขึ้นไป)
  และถ้ายังไม่ approved/accepted/confirmed จะ **ซ่อนอีเมล เบอร์ เรซูเม่ Transcript** ไม่เห็นความเห็นของอาจารย์

**ทำไมต้อง lock?** สมมติอาจารย์กับเจ้าหน้าที่กดพร้อมกัน ถ้าไม่ lock อาจบันทึกได้ทั้งสองคน
`FOR UPDATE` ทำให้คนที่สองต้องรอ พอถึงคิวจะเห็นว่าสถานะไม่ใช่ `submitted` แล้ว → ได้ 409

---

## 8. เกณฑ์คุณสมบัติสหกิจ (coopCriteria)

ไฟล์ `config/coopCriteria.js` มี **2 ชุดที่ต้องเหมือนกันทุกตัวอักษร** (`frontend/src/config/` และ `backend/src/config/`) และ `backend/tests/run.py` ตรวจว่าเหมือนกัน
- frontend ใช้แสดงเช็กลิสต์ ✓/✕ ระหว่างกรอก
- backend ใช้กันตอนบันทึก (ส่งข้อมูลหลบหน้าเว็บมาก็ไม่ผ่าน)

**`qualificationChecks()` ตรวจ 10 ข้อ**
1. ชั้นปีที่ 3 ขึ้นไป (คิดจาก 2 หลักแรกของรหัส เทียบกับปีการศึกษาปัจจุบัน ซึ่งเริ่มเดือนสิงหาคม)
2. หลักสูตรตรงกับปีที่เข้า (รหัสปี ≤ 65 → หลักสูตร 61, ปี ≥ 66 → หลักสูตร 66)
3. GPAX 2.75–4.00 ทศนิยมไม่เกิน 2 ตำแหน่ง
4. กรอกเกรดวิชาที่ต้องเคยเรียนครบทุกกลุ่ม (กลุ่มที่มีวิชาทดแทน เช่น คพ.213 หรือ คพ.216 ใช้วิชาที่เกรดดีที่สุด)
5. เกรดเฉลี่ยกลุ่มวิชานั้น ≥ 2.50
6. วิชาที่ "กำลังเรียนหรือเรียนแล้ว" ครบทุกกลุ่ม (เกรด `IP` = กำลังเรียน)
7–9. ติ๊กรับทราบ 3 ข้อ (`mustPass`, `discipline`, `accept`)
10. แนบ Transcript

---

## 9. ไฟล์ PDF และโลโก้

**ที่เก็บ** `services/storage.js`: มี `FILE_BUCKET` → เก็บใน S3 / ไม่มี (ในเครื่อง) → โฟลเดอร์ `.uploads`
เขียนแบบห้ามทับไฟล์เดิม (`IfNoneMatch: '*'` / flag `wx`)

**เอกสาร (`routes/documents.js`)**
- `POST /api/documents?kind=transcript|resume` — นักศึกษาเท่านั้น, ต้องเป็น PDF จริง (5 ไบต์แรกคือ `%PDF-`), ไม่เกิน 4 MB
  ชื่อไฟล์ = `<user_id>/<kind>-<uuid>.pdf` แล้วคืน `key` ให้หน้าเว็บเอาไปใส่ในโปรไฟล์/ใบสมัคร
- `GET /api/documents/:key` — เจ้าของเปิดได้เสมอ, คนอื่นเปิดได้เมื่อ: staff / อาจารย์ของนักศึกษาคนนั้น / บริษัทที่มีใบสมัครของคนนั้นสถานะ approved ขึ้นไป
- ทำไมต้องจำกัด 4 MB: Lambda รับ request ได้ไม่เกิน 6 MB และไฟล์ถูกแปลงเป็น base64 ซึ่งใหญ่ขึ้น ~33%

**โลโก้ (`routes/companyLogos.js`)**
- `POST /api/company/logo` — ผู้ประสานงานเท่านั้น, PNG/JPG/WEBP/SVG ไม่เกิน 2 MB, ตรวจ "ลายเซ็นไฟล์" จริง ไม่เชื่อแค่นามสกุล
- `GET /api/company-logos/:companyId/:filename` — เปิดสาธารณะ แต่ต้องเป็นโลโก้ที่บริษัทใช้อยู่จริง, ตั้ง `Content-Security-Policy: sandbox` กัน SVG ฝังสคริปต์

**ฝั่งหน้าเว็บ** `components/DocumentLink.jsx` ดาวน์โหลด PDF ผ่าน `api(url, { blob: true })` (เพื่อแนบ token) แล้วแสดงในหน้าต่าง preview

---

## 10. Frontend ทีละไฟล์

```
frontend/src/
├── main.jsx               จุดเริ่ม: render <App /> ลงใน #root
├── App.jsx                เรียก <AppRoutes />
├── routes/
│   ├── approutes.jsx      ตาราง URL ทั้งหมด
│   └── ProtectedRoute.jsx กันหน้าตามบทบาท
├── context/
│   ├── authContext.js     สร้าง Context เปล่า
│   ├── AuthProvider.jsx   เก็บ/จัดการสถานะ login
│   └── useAuth.js         hook ให้หน้าอื่นเรียกใช้ { user, login, logout, ... }
├── services/
│   ├── api.js             เรียก backend (แนบ token)
│   ├── cognito.js         login ผ่าน Amplify/Cognito
│   └── companyApi.js      เรียก /companies (ไม่แนบ token)
├── hooks/useApi.js        hook โหลดข้อมูล: { data, loading, error, reload, setData }
├── config/
│   ├── roles.js           ชื่อบทบาท หน้าแรก เมนูข้าง
│   ├── applicationStatus.js ป้ายสถานะภาษาไทย + แถบความคืบหน้า
│   ├── coopCriteria.js    เกณฑ์สหกิจ (เหมือน backend)
│   └── coopRules.js       MIN_GPAX, isGpaxEligible
├── layouts/RoleLayout.jsx โครงหน้าหลัง login: Navbar + เมนูข้าง + เนื้อหา + Footer
├── components/            ชิ้นส่วนที่ใช้ซ้ำ
├── pages/                 หน้าจอ แยกโฟลเดอร์ตามบทบาท
└── utils/                 ฟังก์ชันช่วย (วันที่ไทย, เบอร์โทร, รูป)
```

### 10.1 Routing — `routes/approutes.jsx` + `ProtectedRoute.jsx`

```jsx
<Route element={<ProtectedRoute roles={['student']} />}>   // ด่าน: ต้องเป็น student
  <Route path="/student" element={<RoleLayout />}>          // โครงหน้า (เมนูข้าง)
    <Route index element={<MyApplications />} />            // /student
    <Route path="apply" element={<Apply />} />              // /student/apply
    <Route path="profile" element={<Profile />} />          // /student/profile
  </Route>
</Route>
```
- `ProtectedRoute` ยังไม่ login → ส่งไป `/login` (จำหน้าเดิมไว้ login เสร็จพากลับ) / บทบาทไม่ตรง → ส่งไปหน้าแรกของบทบาทตัวเอง
- **นี่แค่ซ่อนหน้า ไม่ใช่ความปลอดภัย** ความปลอดภัยจริงอยู่ที่ backend
- `RoleLayout` อ่านเมนูจาก `config/roles.js` และวาดหน้าลูกตรง `<Outlet />`
- เพิ่มหน้าใหม่: เพิ่ม `<Route>` ใน `approutes.jsx` + เพิ่มเมนูใน `roles.js`

### 10.2 โหลดข้อมูล — `hooks/useApi.js`

แทบทุกหน้าใช้แบบนี้:
```js
const { data: applications, reload, loading, error } = useApi('/advisor/applications?status=submitted');
```
- เปิดหน้า → เรียก API ให้อัตโนมัติ
- ออกจากหน้ากลางทาง → ยกเลิก request (`AbortController`) ไม่ให้ state เพี้ยน
- `path = null` → ยังไม่โหลด (ใช้รอข้อมูลอื่นก่อน เช่นรอรู้ภาคที่ active ก่อนโหลดผู้สมัคร)
- `reload()` โหลดใหม่หลังกดบันทึก / `setData()` อัปเดตข้อมูลในหน้าเองโดยไม่ต้องโหลดใหม่

### 10.3 Components ที่ใช้ซ้ำ

| ไฟล์ | ทำอะไร |
|---|---|
| `Navbar.jsx`, `Footer.jsx` | แถบบน/ล่าง |
| `ApiState.jsx` | แสดง "กำลังโหลด" / ข้อความ error |
| `ApplicationStatusBadge.jsx` | ป้ายสีของสถานะใบสมัคร (อ่านจาก `applicationStatus.js`) |
| `ReviewPanel.jsx` | ปุ่มอนุมัติ/ไม่อนุมัติ + ช่องความเห็น (อาจารย์และเจ้าหน้าที่ใช้ร่วมกัน) |
| `DocumentLink.jsx` | ปุ่มเปิด PDF แบบแนบ token |
| `FileInput.jsx` | ช่องเลือกไฟล์ |
| `CourseGradesFields.jsx` | ฟอร์มกรอกเกรดตามหลักสูตร (โหมดแก้ได้ / อ่านอย่างเดียว) |
| `GpaxValue.jsx` | แสดง GPAX พร้อมสีตามเกณฑ์ |
| `PositionCard.jsx` | การ์ดตำแหน่งงาน |
| `CompanyDetailModal.jsx` | หน้าต่างรายละเอียดบริษัท (หน้าสาธารณะ) |
| `SaveSuccessDialog.jsx` | หน้าต่าง "บันทึกเรียบร้อย" พร้อมปุ่มไปหน้าถัดไป |

---

## 11. หน้าจอแต่ละบทบาท

### นักศึกษา

| หน้า | ไฟล์ | API ที่เรียก | การทำงาน |
|---|---|---|---|
| ข้อมูลส่วนตัว | `pages/student/Profile.jsx` | `GET/PUT /students/me`, `POST /documents?kind=transcript` | กรอกเบอร์, GPAX, Transcript, เกรดรายวิชา, ติ๊กรับทราบ → เห็นเช็กลิสต์ 10 ข้อแบบ real-time → ไม่ผ่านครบจะขึ้น dialog บอกข้อที่ขาด → ผ่านแล้วอัปโหลด Transcript ก่อน แล้วค่อย PUT ข้อมูล / ถ้า `qualification_locked` ฟอร์มคุณสมบัติจะถูกล็อก แก้ได้แค่เบอร์ |
| สมัครสหกิจ | `pages/student/Apply.jsx` | `GET /companies?status=open`, `POST /documents?kind=resume`, `POST /applications` | GPAX ยังไม่กรอก/ต่ำกว่าเกณฑ์ → ขึ้นกล่องเตือนและล็อกฟอร์ม / พิมพ์ค้นหาบริษัทที่เปิดรับ (สูงสุด 8 รายการ) → เลือกตำแหน่ง (มีตำแหน่งเดียวเลือกให้เลย) → แนบเรซูเม่ → อัปโหลดแล้วส่งใบสมัคร (ถ้าส่งไม่ผ่าน กดใหม่จะไม่อัปโหลดไฟล์ซ้ำ) |
| ใบสมัครของฉัน | `pages/student/MyApplications.jsx` | `GET /students/me/applications`, `GET /terms/active`, `POST /applications/:id/confirm` / `withdraw` | การ์ดแต่ละใบมีแถบความคืบหน้า 4 ขั้น + ผลการตรวจและความเห็นอาจารย์ / ปุ่มถอน (submitted, approved) / ปุ่มยืนยันสิทธิ์ (accepted) พร้อมเตือนว่าใบอื่นจะถูกสละสิทธิ์ |

### อาจารย์ที่ปรึกษา

| หน้า | ไฟล์ | API | การทำงาน |
|---|---|---|---|
| ใบสมัครรออนุมัติ | `pages/advisor/PendingApplications.jsx` | `GET /advisor/applications?status=submitted`, `POST /applications/:id/reviews` | ค้นหาชื่อ/รหัส/บริษัท, เปิดเรซูเม่และ Transcript, อนุมัติ/ไม่อนุมัติผ่าน `ReviewPanel` |
| นักศึกษาในความดูแล | `pages/advisor/MyStudents.jsx` | `GET /advisor/students` | ตาราง + ตัวกรอง (ทั้งหมด / มีใบรออนุมัติ / ยังไม่สมัคร / ยืนยันแล้ว) กดแถวเพื่อดูรายละเอียด |
| รายละเอียดนักศึกษา | `pages/advisor/StudentDetail.jsx` | `GET /advisor/students/:id` | ข้อมูลติดต่อ, Transcript, เกรด (อ่านอย่างเดียว), รายการใบสมัครทั้งหมด |

### เจ้าหน้าที่

| หน้า | ไฟล์ | API | การทำงาน |
|---|---|---|---|
| ภาพรวมสหกิจ | `pages/staff/AllApplications.jsx` | `GET /staff/applications`, `GET /terms`, `POST /applications/:id/reviews` | ใบสมัครทุกใบ กรองตามภาค/สถานะ/บริษัท/ชื่อ, ดูประวัติการเปลี่ยนสถานะ, อนุมัติแทนอาจารย์ได้ |
| สถานประกอบการ | `pages/staff/ManageCompanies.jsx` | `GET /companies`, `GET /users`, `GET /staff/companies/:id`, `POST/PUT/DELETE /companies`, `GET /positions?company_id=` | ตารางบริษัทแบ่งหน้าละ 15, เพิ่ม/แก้/ลบ, ดูตำแหน่งและผู้ประสานงาน |
| ภาคการศึกษา | `pages/staff/ManageTerms.jsx` | `GET/POST/PUT /terms`, `POST /terms/:id/activate` | เพิ่ม/แก้ภาค, ตั้งภาคที่ใช้งาน |
| จัดการผู้ใช้ | `pages/staff/ManageUsers.jsx` | `GET/POST/PUT/PATCH /users`, `GET /companies`, `PUT /students/:id` | เพิ่ม/แก้ผู้ใช้, กำหนดอาจารย์ที่ปรึกษา, เปิด/ปิดบัญชี (เตือนถ้าอาจารย์ยังดูแลนักศึกษาอยู่) |

### ผู้ประสานงานบริษัท

| หน้า | ไฟล์ | API | การทำงาน |
|---|---|---|---|
| ผู้สมัคร | `pages/company-portal/Applicants.jsx` | `GET /company/positions`, `GET /terms/active`, `GET /company/applications?term_id=`, `PATCH /company/applications/:id/decision` | ตัวกรอง (รอพิจารณา/ผ่าน/ไม่ผ่าน/สละสิทธิ์) + กรองตามตำแหน่ง / กดผ่าน-ไม่ผ่าน (เตือนถ้ารับเกิน quota และเปลี่ยนภายหลังไม่ได้) |
| ตำแหน่ง | `pages/company-portal/CompanyPositions.jsx` | `GET/POST/PUT/PATCH/DELETE /company/positions` | เพิ่ม/แก้/เปิด-ปิดรับ/ลบตำแหน่ง |
| ข้อมูลบริษัท | `pages/company-portal/CompanyProfile.jsx` | `GET/PUT /company/profile`, `POST /company/logo` | แก้ข้อมูลบริษัท อัปโหลดโลโก้ (มี preview) |

### หน้าสาธารณะ

| หน้า | ไฟล์ | API |
|---|---|---|
| หน้าแรก | `pages/home.jsx` | `GET /companies`, `GET /companies?search=`, `GET /companies/:id` |
| รายชื่อบริษัท | `pages/company.jsx` | `GET /companies?search=&province=&position=&status=` |
| คู่มือนักศึกษา | `pages/studenthandbook.jsx` | ไม่มี (เนื้อหาคงที่ แบ่งแท็บ) |
| เข้าสู่ระบบ | `pages/Login.jsx` | ผ่าน `AuthProvider` (ข้อ 4) |

---

## 12. รันในเครื่อง / deploy / env / ทดสอบ

### รันในเครื่อง (`docker-compose.yml`)

3 container: `database` (PostgreSQL, รัน `init/*.sql` ให้ตอนสร้างครั้งแรก), `backend` (port ตาม `BACKEND_PORT` ค่าเริ่มต้น 5000, `AUTH_MODE=development`), `frontend` (Vite port 5173)
```
docker compose up -d --build
```

### Deploy บน AWS (รายละเอียดใน `DEPLOY_AWS.md`)

- frontend: `npm run build` แล้วอัปโหลดไฟล์ขึ้นที่ host หน้าเว็บ
- backend: zip โฟลเดอร์ `backend` (รวม `cognito-triggers` เพราะ `auth.js` import ไฟล์ verify ไปใช้) → Lambda handler `src/lambda.handler`
- สร้างตาราง: สั่ง Lambda ด้วย test event `{ "action": "migrate" }`
- Cognito: ผูก trigger ทั้ง 4 ตัว, app client เปิดเฉพาะ `ALLOW_CUSTOM_AUTH` + `ALLOW_REFRESH_TOKEN_AUTH`

### Environment variables

| ตัวแปร | ที่ไหน | ใช้ทำอะไร |
|---|---|---|
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` / `DB_SECRET_ARN` | backend | เชื่อมฐานข้อมูล |
| `DB_SSL`, `DB_POOL_MAX` | backend | SSL / จำนวน connection |
| `AUTH_MODE` | backend | `development` / `api-gateway` / `cognito` |
| `DEV_AUTH_PASSWORD`, `DEV_AUTH_SECRET` | backend (ในเครื่อง) | รหัสบัญชีทดสอบ / กุญแจเซ็น token ในเครื่อง |
| `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` | backend | ตรวจ token Cognito |
| `MOCK_LOGINS`, `MOCK_PASSWORD` | backend + trigger | บัญชี mock บน Cognito (ต้องตรงกันทั้งสองที่) |
| `TU_API_KEY`, `TU_API_URL` | trigger (+ backend ในเครื่อง) | เรียก TU API |
| `FILE_BUCKET`, `UPLOAD_DIR` | backend | S3 bucket / โฟลเดอร์ในเครื่อง |
| `CORS_ORIGIN` | backend | URL หน้าเว็บที่อนุญาต |
| `VITE_API_URL` | frontend | ที่อยู่ API |
| `VITE_AUTH_MODE` | frontend | `cognito` = ใช้ Cognito, อย่างอื่น = login ตรงกับ backend |
| `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_DOMAIN` | frontend | ตั้งค่า Amplify |

### ทดสอบ

| ไฟล์ | ทดสอบอะไร | คำสั่ง |
|---|---|---|
| `backend/tests/run.py` | ทั้งระบบกับ DB จริง + ตรวจว่า coopCriteria สองฝั่งเหมือนกัน | `python3 backend/tests/run.py` |
| `backend/tests/api.test.mjs` | API ทีละ endpoint | ดู `TESTING_GUIDE.md` |
| `backend/tests/cognito-triggers.test.mjs` | trigger ทั้ง 4 ตัว | `cd backend && node --test tests/cognito-triggers.test.mjs` |

ดู API ทั้งหมดและลองยิงได้ที่ `/api/docs` (Swagger)

---

## 13. ข้อสังเกตในโค้ด (ควรรู้ไว้เผื่อโดนถาม)

เจอระหว่างอ่านโค้ด ยังไม่ได้แก้

1. **ขนาดเรซูเม่ไม่ตรงกัน** — `pages/student/Apply.jsx` บอกผู้ใช้ว่าได้ถึง 10 MB (`MAX_RESUME_MB = 10`) แต่ backend รับไม่เกิน 4 MB ไฟล์ 4–10 MB จะผ่านหน้าเว็บแต่โดน backend ปฏิเสธ (หน้าโปรไฟล์ใช้ 4 MB ถูกแล้ว)
2. **ไฟล์ที่ไม่มีใครใช้** — `components/PositionManager.jsx`, `components/CompanyForm.jsx` ไม่ถูก import จากที่ไหน ส่วน `data/mockfile.json` เป็นข้อมูลต้นทางของ seed บริษัทใน SQL แต่หน้าเว็บไม่ได้ใช้แล้ว
3. **บัญชีอาจารย์/เจ้าหน้าที่ยังเป็น mock** — ใช้รหัสผ่านร่วมกัน เหมาะกับ demo เท่านั้น โค้ดรองรับ login ผ่าน TU สำหรับบุคลากรไว้แล้ว (`registeredTuStaff`) ถ้าเจ้าหน้าที่ลงทะเบียนบัญชีไว้ก่อน

---

## 14. คำถามที่อาจโดนถาม

| คำถาม | คำตอบ |
|---|---|
| Cognito เก็บรหัสผ่าน TU ไหม | ไม่เก็บ ทุกครั้งที่ login Lambda ส่งไปถาม TU API ใหม่ และไม่ log รหัสผ่าน ในฐานข้อมูลก็ไม่มีช่องรหัสผ่าน |
| ทำไมต้องมี Cognito ไม่เรียก TU ตรง ๆ | Cognito ออก token มาตรฐาน (JWT) ที่ API Gateway ตรวจได้เองก่อนถึง backend, ต่ออายุ token ให้, และรองรับ Google login ของบริษัท |
| นักศึกษาสาขาอื่น login ได้ไหม | ไม่ได้ ตรวจรหัส `YY09(61\|65)xxxx` ทั้งใน Verify Lambda และ backend |
| แก้ role ในหน้าเว็บ (DevTools) เพื่อเข้าหน้าอื่นได้ไหม | เปิดหน้าได้แต่ไม่มีข้อมูล เพราะ backend อ่าน role จากตาราง `users` ทุก request แล้วตอบ 403 |
| ถ้าอาจารย์กับเจ้าหน้าที่กดอนุมัติพร้อมกัน | transaction + `FOR UPDATE` คนที่สองต้องรอ แล้วเห็นว่าสถานะเปลี่ยนแล้ว ได้ 409 |
| กดส่งใบสมัครซ้ำสองครั้ง (เน็ตช้า) | ได้ใบเดิม ไม่เกิดใบซ้ำ และฐานข้อมูลมี unique (student, term, position) กันอีกชั้น |
| นักศึกษายืนยันได้กี่ที่ | ที่เดียวต่อภาค ใบที่เหลือถูกปล่อย/ถอนอัตโนมัติ และฐานข้อมูลมี unique index กันซ้ำ |
| บริษัทเห็นข้อมูลนักศึกษาตอนไหน | เห็นใบสมัครหลังอาจารย์อนุมัติแล้วเท่านั้น และไม่เห็นความเห็นภายในของอาจารย์ |
| แก้ GPAX หลังได้รับอนุมัติแล้วได้ไหม | ไม่ได้ ถูกล็อก (`qualification_locked`) ต้องติดต่อเจ้าหน้าที่ แก้ได้แค่เบอร์โทร |
| เกณฑ์คุณสมบัติตรวจที่ไหน | ทั้งสองฝั่ง หน้าเว็บแสดงผลทันที backend กันจริงตอนบันทึก ใช้ไฟล์เกณฑ์ชุดเดียวกัน |
| กัน SQL injection ยังไง | ใช้ parameter `$1, $2` ทุกคำสั่ง และชื่อช่องที่แก้ได้ต้องอยู่ใน whitelist |
| กันอัปโหลดไฟล์อันตรายยังไง | ตรวจไบต์แรกของไฟล์ (PDF/PNG/JPG/WEBP/SVG), จำกัดขนาด, ตั้งชื่อไฟล์ใหม่ด้วย UUID, SVG เปิดแบบ sandbox |
| ไฟล์เก็บที่ไหน | S3 (ในเครื่องเก็บใน `.uploads`) เปิดได้เฉพาะคนที่มีสิทธิ์ |
| ถ้า TU API ล่ม | login นักศึกษาไม่ได้ ขึ้นข้อความ "ไม่สามารถตรวจสอบกับระบบ TU ได้ในขณะนี้" (แยกจาก "รหัสผิด") |
| ทำไม backend ตัวเดียวรันได้ทั้งในเครื่องและ Lambda | logic อยู่ใน `app.js` ตัวเดียว `server.js` กับ `lambda.js` เป็นแค่ประตูทางเข้าคนละแบบ |
