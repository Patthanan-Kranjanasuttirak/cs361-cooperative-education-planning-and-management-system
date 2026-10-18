# เข้าสู่ระบบด้วย Amplify + Cognito

| ผู้ใช้ | วิธีเข้าสู่ระบบ | ตรวจตัวตน | ตรวจสิทธิ์ |
|---|---|---|---|
| นักศึกษา / อาจารย์ / เจ้าหน้าที่ | ชื่อผู้ใช้ + รหัสผ่าน TU | Lambda `verify-auth-challenge` ส่งไปตรวจกับ TU API ทุกครั้ง | backend: `users.username` ตรงกับชื่อผู้ใช้ TU |
| ผู้ประสานงานสถานประกอบการ | ปุ่ม Google (Cognito Hosted UI) | Google | backend: `users.email` ตรงกับอีเมลที่ Google ยืนยันแล้ว |

ระบบไม่เก็บรหัสผ่านของใครเลย เจ้าหน้าที่ต้องลงทะเบียนผู้ใช้ในหน้า "จัดการผู้ใช้งาน" ก่อน
login ครั้งแรก backend จะผูก `users.cognito_sub` ให้อัตโนมัติ (ดู `bindCognitoUser` ใน `src/models/userModel.js`)
ถ้าไม่พบบัญชี อีเมลซ้ำหลายบัญชี หรือบัญชีถูกปิด จะตอบ 403 และหน้าเว็บ signOut ให้

ลำดับของ TU: `signIn(CUSTOM_WITHOUT_SRP)` → ถ้ายังไม่มีผู้ใช้ใน User Pool ให้ `signUp` (รหัสสุ่มที่ใช้ไม่ได้) → Define ขอ challenge → ตอบด้วยรหัสผ่าน TU → Verify ตรวจกับ TU API → ได้ token

## สิ่งที่ต้องเตรียม

- **Application-Key ของ TU API** (ขอจากมหาวิทยาลัย)
- **Google Cloud project** สำหรับสร้าง OAuth Client
- **URL หน้าเว็บที่เป็น HTTPS:** Cognito รับ callback แบบ `http://` เฉพาะ `localhost` ส่วน S3 static website เป็น HTTP อย่างเดียว ต้องมี CloudFront (หรือ Amplify Hosting) ครอบไว้

## 1. Google OAuth Client

Google Cloud Console → APIs & Services
1. OAuth consent screen: เลือก External แล้วใส่ชื่อแอป ระหว่างทดสอบให้เพิ่มอีเมลผู้ทดสอบใน Test users
2. Credentials → Create OAuth client ID → เลือก Web application
   - Authorized redirect URI: `https://<cognito-domain>/oauth2/idpresponse`
3. เก็บ Client ID และ Client secret ไว้ใช้ในขั้นที่ 2

## 2. Cognito User Pool

1. **Sign-in:** ใช้ Username ไม่สนตัวพิมพ์ (case-insensitive) และ**ไม่บังคับ** attribute ใด ๆ (ห้ามบังคับ email เพราะบัญชี TU สมัครด้วย username อย่างเดียว)
2. **Self-registration:** เปิด (frontend ต้อง `signUp` ตอน login TU ครั้งแรก) และปิด MFA
3. **Domain:** ตั้ง Cognito domain prefix แล้วนำไปใส่ `VITE_COGNITO_DOMAIN`
4. **Social identity provider → Google:** ใส่ Client ID/secret, scopes `openid email profile`
   - Attribute mapping: `email` → `email`, `email_verified` → `email_verified`, `name` → `name`
   - ต้องแมป `email_verified` ด้วย ถ้าไม่แมป backend จะไม่ยอมผูกบัญชี
5. **App client:** เป็น public client (ไม่มี client secret)
   - Authentication flows: เปิดเฉพาะ `ALLOW_CUSTOM_AUTH` และ `ALLOW_REFRESH_TOKEN_AUTH`
     **ห้ามเปิด** `USER_PASSWORD_AUTH` / `USER_SRP_AUTH` ไม่อย่างนั้นใครก็ `signUp` ด้วยชื่อคนอื่นแล้ว login ด้วยรหัสที่ตั้งเองได้
   - Prevent user existence errors: **ปิด** (Legacy) เพื่อให้ frontend รู้ว่าต้อง `signUp` ตอน login ครั้งแรก
6. **Hosted UI / Managed login ของ app client:**
   - Identity providers: เลือก **Google อย่างเดียว** (ไม่เลือก Cognito user pool เพราะจะเปิดช่องให้ login ด้วยรหัสผ่านใน pool)
   - OAuth grant: Authorization code grant, scopes `openid email profile`
   - Callback URLs และ Sign-out URLs: `http://localhost:5173/login` และ `https://<เว็บจริง>/login`

## 3. Lambda triggers

สร้าง Lambda 4 ตัว: Node.js 20.x ขึ้นไป, Execution role `LabRole` (Learner Lab), handler `index.handler`
คัดลอกโค้ดจาก `index.mjs` ในแต่ละโฟลเดอร์ แล้วผูกกับ User Pool ที่เมนู Extensions → Lambda triggers

| โฟลเดอร์ | Trigger | หมายเหตุ |
|---|---|---|
| `pre-sign-up` | Pre sign-up | ยืนยันบัญชี TU ให้อัตโนมัติ |
| `define-auth-challenge` | Define auth challenge | |
| `create-auth-challenge` | Create auth challenge | |
| `verify-auth-challenge` | Verify auth challenge response | ตั้ง env `TU_API_KEY`, timeout 5 วินาที, **ห้ามใส่ใน VPC** ที่ไม่มี NAT เพราะต้องเรียก TU API ผ่าน internet |

ทดสอบโค้ด trigger ในเครื่องได้ (mock TU API ไม่เรียกจริง): `node --test backend/tests/cognito-triggers.test.mjs`

## 4. Backend และ Frontend

Backend Lambda:
- `AUTH_MODE=api-gateway` (แนะนำเมื่อ Lambda อยู่ใน private subnet ไม่มี NAT) แล้วผูก HTTP API **JWT authorizer**
  issuer `https://cognito-idp.<region>.amazonaws.com/<user-pool-id>`, audience = App client ID
- หรือ `AUTH_MODE=cognito` ให้ backend ตรวจลายเซ็นเอง (Lambda ต้องออก internet เพื่อโหลด JWKS)
- ทั้งสองแบบตั้ง `COGNITO_USER_POOL_ID` และ `COGNITO_CLIENT_ID`

Frontend (`frontend/.env`):
```
VITE_AUTH_MODE=cognito
VITE_COGNITO_USER_POOL_ID=<region>_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=<app client id>
VITE_COGNITO_DOMAIN=<prefix>.auth.<region>.amazoncognito.com
```
หน้าเว็บส่ง **ID token** ให้ backend เพราะมีอีเมลที่ใช้ผูกบัญชี Google (backend รับ access token ได้ด้วย)

## 5. ลงทะเบียนผู้ใช้

- นักศึกษา / อาจารย์ / เจ้าหน้าที่: `username` = ชื่อผู้ใช้ TU (นักศึกษาใช้เลขทะเบียน) และ `auth_provider` ไม่ใช่ `dev`
- ผู้ประสานงาน: `email` = อีเมลบัญชี Google ของคนนั้น และห้ามซ้ำกับบัญชีอื่น
  ถ้าบริษัทไม่ได้ใช้ Google ผู้ประสานงานสร้างบัญชี Google ด้วยอีเมลงานที่ accounts.google.com ได้ (ไม่ต้องเป็น Gmail)
- บัญชี `dev` ใน seed ใช้ได้เฉพาะ `AUTH_MODE=development` และจะไม่ถูกผูกกับ Cognito

## ยังไม่รวมในงานนี้

- `verify-auth-challenge` ปฏิเสธนักศึกษานอกสาขาวิทยาการคอมพิวเตอร์ และ Cognito username ต้องตรงกับ username ที่ TU ตอบ ในโหมด Cognito นักศึกษาจึงต้องกรอกรหัสนักศึกษา (อีเมลที่เป็นชื่อใช้ได้เฉพาะโหมด development ซึ่งใช้ username ที่ TU ตอบเป็นตัวตน)
- โหมด development สร้างบัญชีนักศึกษาให้อัตโนมัติตอนเข้าครั้งแรก และให้อาจารย์/เจ้าหน้าที่จับคู่ด้วยอีเมลได้ แต่โหมด Cognito ยังไม่ทำ (`bindCognitoUser` ผูกด้วย username ของบัญชีที่ลงทะเบียนไว้เท่านั้น)
- บัญชี mock ของผู้ประสานงานและบัญชีทดสอบใช้ได้เฉพาะโหมด development
- ยังไม่ได้ทดสอบกับ Cognito และ TU API จริง ทดสอบไปแค่ backend integration กับ claims จำลอง และ trigger กับ TU API จำลอง
