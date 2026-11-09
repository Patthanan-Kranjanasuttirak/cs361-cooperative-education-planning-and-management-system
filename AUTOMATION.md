# AUTOMATION.md — IaC, CI/CD และวิธีรันทั้งหมด (V5)

ไฟล์นี้คือที่เดียวที่รวม **Automation ทั้งหมดของโปรเจกต์**: Infrastructure as Code (IaC), CI/CD และ **วิธีรันทุกอย่าง** ตั้งแต่ต้นจนลบ

| ต้องการ | ดูที่ |
|---|---|
| วิธีรัน, คำสั่ง, พารามิเตอร์, แก้ปัญหา, ผลทดสอบ (ไฟล์นี้) | **AUTOMATION.md** |
| โครงสร้างโค้ดในโฟลเดอร์ `infra/` (แต่ละไฟล์ทำอะไร ประกอบกันอย่างไร) | [infra/README.md](infra/README.md) |
| คู่มือสร้างด้วยมือ และรายการ AWS resource ของระบบจริง | [DEPLOY_AWS.md](DEPLOY_AWS.md) |

Automation มี 2 ส่วนที่ไม่ขึ้นต่อกัน:

| ส่วน | ตอบโจทย์ | ทำอะไร | ไฟล์หลัก |
|---|---|---|---|
| **A. IaC** | "สร้างโครงสร้าง AWS ซ้ำได้" | เขียนทรัพยากร AWS เป็นโค้ด สร้างทั้งชุดด้วยคำสั่งเดียว และลบได้ทั้งชุด | `infra/*.yaml`, `infra/deploy.ps1` |
| **B. CI/CD** | "push โค้ดแล้ว AWS ใช้ได้ทันที" | push ขึ้น GitHub แล้วทดสอบและอัปเดต Lambda อัตโนมัติ | `.github/workflows/*.yml`, `infra/github-deploy-user.yaml` |

IaC สร้าง "สถานที่" (VPC, RDS, Lambda ฯลฯ) ส่วน CI/CD ส่ง "โค้ดใหม่" เข้า Lambda ที่มีอยู่แล้ว ระบบที่ใช้งานจริงตอนนี้ **สร้างด้วยมือ** (prefix `cs361-coop`) ไม่ได้อยู่ใน stack ของ IaC IaC จึงสร้างระบบ "อีกชุด" แยกจากกัน (ชุดทดสอบ prefix `cs361-coop-test`) ส่วน CI/CD อัปเดต Lambda ของระบบจริง

---

## A. IaC — สร้างโครงสร้าง AWS ด้วยโค้ด

### A1. ทำไมต้องมี
- **สร้างซ้ำได้** ระบบมีทรัพยากรหลายสิบตัว การทำมือตามคู่มือยาวเสี่ยงผิดพลาด
- **ลดความผิดพลาดจากการตั้งค่า** ปัญหาที่เคยเจอ เช่น `CORS_ORIGIN` มี `/` ท้าย, ลืมสร้าง Cognito domain, `MOCK_LOGINS` สองที่ไม่ตรงกัน ถูกกำหนดครั้งเดียวใน template
- **มีชุดทดสอบแยกได้** เปลี่ยน `Prefix` ก็ได้ระบบใหม่ ลบทิ้งได้ทั้งชุด
- **ตรวจสอบย้อนหลังได้** โครงสร้างอยู่ใน git

### A2. สิ่งที่สร้าง

| Stack | ไฟล์ | สร้างอะไร |
|---|---|---|
| **1** `<prefix>-data` (14 resources) | `infra/network-data.yaml` | VPC แบบ private 2 AZ (ไม่มี NAT/IGW), sg-lambda และ sg-rds, S3 gateway endpoint, RDS PostgreSQL (ไม่ public), S3 bucket ไฟล์ผู้ใช้, S3 bucket พัก zip ของ Lambda |
| **2** `<prefix>-app` (44 resources) | `infra/app.yaml` | IAM role, Lambda backend (ใน VPC) และ trigger 4 ตัว (นอก VPC), Cognito (user pool, app client, domain, managed login, Google provider), API Gateway (routes, authorizer, CORS, stage) พร้อม environment variable ของ Lambda ครบ |
| **3** `<prefix>-web` (ไม่บังคับ) | `infra/frontend.yaml` | Amplify Hosting ผูกกับ GitHub repo พร้อม env และกฎ SPA (สร้างเมื่อใส่ `-GitHubRepo`) |

ลำดับต้องเป็น stack 1 ก่อน stack 2 (stack 2 อ่านค่าจาก stack 1 และต้องมี zip ของ Lambda ใน bucket ก่อน)

### A3. สิ่งที่ต้องมีก่อน
1. **AWS CLI v2** และล็อกอินแล้ว: `aws login` (หรือ `aws configure`) ตรวจด้วย `aws sts get-caller-identity`
2. **Node.js 20+ และ npm** (ใช้ `npm ci` build backend)
3. Windows 10/11 และ PowerShell (ใช้ `tar.exe` ที่มากับระบบทำ zip ที่ Lambda อ่านได้)
4. สิทธิ์สร้าง VPC, RDS, IAM, Lambda, Cognito, API Gateway (บัญชีที่ใช้ทดสอบมี `AccountFullAccessRole`)

### A4. สร้างระบบใหม่ (ครั้งแรก)
รันที่โฟลเดอร์ root ของโปรเจกต์ ใช้ **prefix ที่ไม่ใช่ `cs361-coop`** (สคริปต์ปฏิเสธ เพราะชื่อชนกับทรัพยากรที่สร้างมือ):

```powershell
powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 -Prefix cs361-coop-test -MockLogins "committee.v3@tu.ac.th,staff.v3@tu.ac.th,company.v3@example.test,company.other.v3@example.test" -Seed
```

**สคริปต์ทำตามลำดับ:**
1. ตรวจเบื้องต้น (ล็อกอิน AWS, prefix, รูปแบบ `-WebOrigin`)
2. ถามความลับ (กด Enter ข้ามได้) ความลับอยู่ในหน่วยความจำเท่านั้น ไม่เขียนลงไฟล์ ไม่ถูก commit
3. build zip ของ backend และ trigger (`npm ci` แล้วบีบด้วย `tar`)
4. deploy stack 1 (RDS ใช้ 10 ถึง 15 นาทีครั้งแรก)
5. อัปโหลด zip เข้า bucket ของ stack 1
6. deploy stack 2
7. migrate สร้างตารางในฐานข้อมูลใหม่
8. smoke test (ต้อง `[PASS]` ทั้งหมด)
9. พิมพ์ค่าสำหรับหน้าเว็บ (`VITE_*`) และ Redirect URI ของ Google

**ตัวแปรสภาพแวดล้อม** (ตั้งล่วงหน้าเพื่อไม่ให้ถาม):

| ตัวแปร | ใช้ทำอะไร | ถ้าไม่ใส่ |
|---|---|---|
| `DB_PASSWORD` | รหัสผ่านฐานข้อมูล (12-64 ตัว: ตัวอักษร ตัวเลข `_ + = . -`) | สุ่มให้และเก็บไว้ใน SSM Parameter Store (`/<prefix>/deploy/db-password`) |
| `MOCK_PASSWORD` | รหัสผ่านร่วมของบัญชี demo ใน `-MockLogins` | บัญชี demo ใช้ไม่ได้ |
| `TU_API_KEY` | Application-Key ของ TU API | ล็อกอินนักศึกษาไม่ได้ |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth client จาก Google Cloud | ใช้ค่า `unused` (Google login ใช้ไม่ได้ แต่ระบบอื่นทำงาน) |
| `GITHUB_TOKEN` | GitHub token (เฉพาะเมื่อใช้ `-GitHubRepo`) | ถามตอนรัน ถ้าไม่ใส่สคริปต์หยุด |

**พารามิเตอร์ของ `deploy.ps1`:**

| พารามิเตอร์ | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `-Prefix` | `cs361-coop-test` | คำนำหน้าชื่อทุกทรัพยากรและชื่อ stack (`<prefix>-data`, `<prefix>-app`, `<prefix>-web`) |
| `-Region` | `ap-southeast-2` | region |
| `-WebOrigin` | `http://localhost:5173` | URL หน้าเว็บ **ไม่มี `/` ท้าย** (ใช้เป็น CORS origin และ callback ของ Cognito) ถ้าใช้ `-GitHubRepo` สคริปต์ตั้งค่านี้เองจาก Amplify |
| `-MockLogins` | ว่าง | อีเมลบัญชี demo คั่นด้วย `,` ไม่มีเว้นวรรค |
| `-GitHubRepo` | ว่าง | URL ของ repo (`https://github.com/<owner>/<repo>` ไม่มี `.git` ไม่มี `/` ท้าย) เมื่อใส่ จะสร้าง Amplify ด้วย (ดู A5) |
| `-GitHubBranch` | `main` | branch ที่ Amplify build |
| `-Seed` | ปิด | ใส่ข้อมูลตัวอย่างตอน migrate (`005_v3-demo.sql`) |
| `-SkipTests` | ปิด | ข้าม smoke test |
| `-BuildOnly` | ปิด | build zip อย่างเดียว ไม่เรียก AWS |
| `-CodeOnly` | ปิด | อัปเดตเฉพาะโค้ด backend ของชุดที่สร้างไว้แล้ว (ดู A6) |
| `-Migrate` | ปิด | ใช้คู่กับ `-CodeOnly` เพื่อรัน migrate หลังอัปเดตโค้ด |
| `-Destroy` | ปิด | ลบชุดนี้ทั้งหมด |
| `-AllowExistingNames` | ปิด | ยอมให้ใช้ prefix `cs361-coop` (ไม่แนะนำ ชนกับของจริง) |

**ผลที่ควรเห็นเมื่อสำเร็จ** (smoke test 4 ข้อ):

| Smoke test | คาดหวัง |
|---|---|
| `GET /health` | 200 (สาธารณะ) |
| `GET /companies` | 200 (สาธารณะ) |
| `GET /auth/me` ไม่มี token | 401 (authorizer ทำงาน) |
| `OPTIONS /auth/me` พร้อม Origin | 200/204 และ `Access-Control-Allow-Origin` ตรงกับ `-WebOrigin` (CORS ถูกต้อง) |

ท้ายผลลัพธ์สคริปต์พิมพ์ค่า `VITE_AUTH_MODE`, `VITE_API_URL`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_DOMAIN` และ **Redirect URI ของ Google** (`https://<โดเมน Cognito>/oauth2/idpresponse`) ที่ต้องเพิ่มใน Google Cloud ถ้าใช้ Google login ถ้าไม่ได้ใช้ `-GitHubRepo` ต้องตั้ง `AMPLIFY_MONOREPO_APP_ROOT=frontend` และ `AMPLIFY_DIFF_DEPLOY=false` ใน Amplify เองด้วย แล้ว Redeploy

### A5. สร้างพร้อมหน้าเว็บ (Amplify) — ไม่บังคับ
ใส่ `-GitHubRepo` เพื่อให้สคริปต์สร้าง Amplify app ผูกกับ repo และ build หน้าเว็บให้ด้วย:

```powershell
powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 -Prefix cs361-coop-test -GitHubRepo https://github.com/Patthanan-Kranjanasuttirak/cs361-cooperative-education-planning-and-management-system -MockLogins "committee.v3@tu.ac.th,staff.v3@tu.ac.th,company.v3@example.test,company.other.v3@example.test" -Seed
```

คำสั่งนี้ใช้กับ repo ของโปรเจกต์นี้ ถ้าใช้ repo อื่น เปลี่ยนค่าหลัง `-GitHubRepo`

**ลำดับที่เพิ่มเข้ามา** (CORS และ callback ของ Cognito ต้องรู้โดเมนของ Amplify ส่วนหน้าเว็บต้องรู้ค่าจาก stack 2):
1. สร้าง Amplify app (stack `<prefix>-web`) ยังไม่ build เพื่อให้ได้โดเมน (ทำก่อน stack 1 เพื่อให้ปัญหาเรื่อง GitHub โผล่ภายในไม่กี่นาที)
2. deploy stack 1 และ stack 2 โดยใช้โดเมนนั้นเป็น `-WebOrigin`
3. อัปเดต Amplify ด้วยค่า `VITE_*` จาก stack 2 แล้วสั่ง build และรอจนเสร็จ
4. smoke test เพิ่มอีก 1 ข้อ: เส้นทางของหน้าเว็บ (`/login/`) ต้องได้ตัวแอป (HTML ที่มี `id="root"` เหมือนหน้าแรก) ตรวจที่เนื้อหา ไม่ตรวจเลข status เพราะกฎ `404-200` ของ Amplify ตอบ **404 พร้อมเนื้อหาแอป** และ `/login` ถูก redirect (301) ไป `/login/` ระบบจริงที่สร้างมือเป็นแบบเดียวกัน (เบราว์เซอร์แสดงหน้าได้ตามปกติ)

Amplify app ใหม่ผูกกับ repo เดียวกับของจริง จึง build ทุกครั้งที่ push จนกว่าจะลบ (`-Destroy` ลบให้) Amplify ของระบบจริงไม่ถูกแตะ

**GitHub token ที่ต้องใช้**
1. **ใช้บัญชี GitHub ที่มีสิทธิ์ Admin ใน repo** (เปิดหน้า repo แล้วต้องเห็นแท็บ **Settings**) เพราะ Amplify ต้องสร้าง webhook
   - repo ของ **บัญชีบุคคล** ให้ Admin คนอื่นไม่ได้ (มีแค่เจ้าของกับ collaborator) ส่วน repo ของ **Organization** ให้ได้ที่ Settings → Collaborators and teams → Add people → role Admin
   - ไม่ควรให้ Admin โดยไม่จำเป็น เพราะ Admin จัดการ secrets (รวม AWS key ของ CI/CD) และลบ repo ได้ ทางที่ปลอดภัยกว่าคือให้คนที่มีสิทธิ์รันขั้นตอนนี้เอง
2. **สร้าง token:** GitHub → รูปโปรไฟล์ → Settings (ของบัญชี) → Developer settings → Personal access tokens → **Tokens (classic)** → Generate new token (classic)
   - Note: `cs361-amplify-test`
   - Expiration: Custom ตั้งเป็นพรุ่งนี้ (หรือค่าที่สั้นที่สุด)
   - Scopes: ติ๊ก **`repo`** และ **`admin:repo_hook`** (ติ๊กที่ช่องหน้าชื่อกลุ่ม แถวย่อยติ๊กตาม)
   - กด Generate แล้วคัดลอก token (ขึ้นต้น `ghp_` แสดงครั้งเดียว) ต้องเป็นแบบ classic เท่านั้น แบบ fine-grained (`github_pat_`) ใช้ไม่ได้
3. **ส่งให้สคริปต์:** วางตอนที่สคริปต์ถาม (พิมพ์แล้วไม่แสดงอักขระ) หรือตั้ง `$env:GITHUB_TOKEN` ก่อนรัน ห้ามส่งให้ใคร ห้ามถ่ายภาพ ห้าม commit
4. **Amplify GitHub App ต้องติดตั้งใน repo นั้นแล้ว** (ระบบจริงใช้อยู่)

**ตรวจ token ก่อนรัน** (ถ้า token ผิดจะรู้ก่อนเริ่มสร้าง) วาง token ตอนถาม ผลลัพธ์ไม่แสดงตัว token:

```powershell
$t = Read-Host "GitHub token" -AsSecureString; $p = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($t)); $h = @{ Authorization = "Bearer $p"; 'User-Agent' = 'check' }; $u = 'https://api.github.com/repos/Patthanan-Kranjanasuttirak/cs361-cooperative-education-planning-and-management-system'; try { $r = Invoke-WebRequest -UseBasicParsing -Headers $h $u; "repo: OK | scopes: $($r.Headers['X-OAuth-Scopes']) | permissions: $((($r.Content | ConvertFrom-Json).permissions | ConvertTo-Json -Compress))" } catch { "repo: HTTP $([int]$_.Exception.Response.StatusCode)" }; try { "hooks: HTTP $((Invoke-WebRequest -UseBasicParsing -Headers $h "$u/hooks").StatusCode)" } catch { "hooks: HTTP $([int]$_.Exception.Response.StatusCode)" }
```

ผลที่ถูกต้อง: `scopes: admin:repo_hook, repo`, `"admin":true` และ `hooks: HTTP 200` ถ้า `scopes` ว่างเปล่า แปลว่า token ไม่มีสิทธิ์ใด ๆ (มักเป็นแบบ fine-grained หรือ classic ที่ไม่ได้ติ๊ก scope) ให้สร้างใหม่

**อายุของ token และการลบ**
- ต้องมีตั้งแต่เริ่มรันจนสคริปต์จบ เพราะใช้ 2 รอบ (สร้างแอป และอัปเดตค่าแล้ว build) ลบกลางทางไม่ได้
- **หลังเห็นข้อความ `Done` ลบได้ทันที:** GitHub → Settings → Developer settings → Tokens (classic) → คลิกชื่อ token → Delete this token เหตุผล: สิทธิ์ `repo` อ่านและเขียนทุก repo ของบัญชี ถ้ารั่ว คนอื่น push เข้า `main` ได้ และ CI/CD จะ deploy ขึ้นระบบจริงทันที ตามเอกสารของ Amplify token ใช้ตอนสร้างแอปและ webhook เท่านั้น (ข้อนี้ยังไม่ได้ทดสอบกับบัญชีนี้)
- **ต้องใช้ token อีกเมื่อ:** รัน `deploy.ps1 -GitHubRepo ...` อีกครั้ง (สร้างใหม่หรืออัปเดต stack ของ Amplify) ใช้ token เดิมได้ถ้ายังไม่หมดอายุและไม่ถูกลบ ไม่เช่นนั้นสร้างใหม่
- **ไม่ต้องใช้ token:** การรันโดยไม่ใส่ `-GitHubRepo`, `-Destroy`, `-CodeOnly` และ CI/CD (ใช้ AWS access key ไม่ใช่ GitHub token)

### A6. อัปเดตและลบ

**อัปเดตโค้ด backend ของชุดที่สร้างไว้แล้ว** (ไม่ถามความลับ ใช้ 1 ถึง 3 นาที ไม่แตะ stack 1, Cognito หรือ API Gateway):

```powershell
powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 -Prefix cs361-coop-test -CodeOnly
```

- มี migration ใหม่ ให้เพิ่ม `-Migrate`
- แก้โค้ด trigger ของ Cognito หรือแก้ `infra/*.yaml` ให้รันแบบเต็ม (ไม่ใส่ `-CodeOnly`) สคริปต์จะถามความลับอีกครั้ง
- `-CodeOnly` ไม่ผ่าน CloudFormation จึงบันทึก zip เวอร์ชันเก่าไว้ในข้อมูลของ stack จนกว่าจะรันแบบเต็มครั้งถัดไป ซึ่งใช้ zip ใหม่เสมอ ไม่ทำให้ระบบเสียหาย
- รันคำสั่งสร้างเต็มซ้ำได้ปลอดภัย CloudFormation เปลี่ยนเฉพาะสิ่งที่ต่างจากเดิม

**ลบชุดทดสอบทั้งหมด:**

```powershell
powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 -Prefix cs361-coop-test -Destroy
```

สคริปต์ให้พิมพ์ prefix ยืนยัน แล้วลบ stack 3 (ถ้ามี) → stack 2 → ล้าง bucket → stack 1 ทรัพยากรที่สร้างมือ (prefix `cs361-coop`) ไม่ถูกแตะเพราะไม่อยู่ใน stack เหล่านี้

**สิ่งที่ `-Destroy` ไม่ลบ** (ลบเองถ้าไม่ต้องการ):
- snapshot สุดท้ายของ RDS (RDS → Snapshots → Manual)
- พารามิเตอร์ SSM `/<prefix>/deploy/db-password` (สคริปต์พิมพ์คำสั่งลบให้)
- **CloudWatch log group ของ Lambda** เช่น `/aws/lambda/<prefix>-api` Lambda สร้างเองตอนรันครั้งแรก ไม่อยู่ใน template จึงไม่ถูกลบและไม่มีอายุเก็บ (ตรวจแล้วว่าค้างจริงหลังลบชุดทดสอบ): `aws logs delete-log-group --log-group-name /aws/lambda/<prefix>-api --region ap-southeast-2`

### A7. สิ่งที่ IaC ไม่ทำ

| ประเภท | สิ่งที่ไม่ทำ | เหตุผล / หมายเหตุ |
|---|---|---|
| ต้องทำมือ | **Google OAuth client** และ consent screen | ไม่มี API ใน CloudFormation ต้องเพิ่ม Redirect URI ที่สคริปต์พิมพ์ให้ (template สร้างฝั่ง Cognito ที่ต่อกับ Google ให้ ถ้าไม่ส่ง Client ID/secret จะใช้ `unused`) |
| ต้องทำมือ | **`TU_API_KEY`** | ต้องขอจากมหาวิทยาลัย |
| ต้องทำมือ | โดเมนของตัวเอง, Budget alert, CloudTrail, alarm, WAF | ไม่อยู่ใน template |
| สร้างแต่ว่างเปล่า | **ข้อมูลใน RDS** | ได้ตารางจาก migration ใช้ `-Seed` เพื่อข้อมูลตัวอย่าง ข้อมูลจริงของระบบเดิมไม่ถูกคัดลอก |
| สร้างแต่ว่างเปล่า | ผู้ใช้ใน Cognito, ไฟล์ใน S3, ผู้ใช้ role `company` ที่ลงทะเบียนไว้ | เป็นคนละชุดกับระบบจริง |
| ข้อจำกัด | รหัสผ่านฐานข้อมูลเป็น environment variable ของ Lambda | VPC ไม่มี NAT จึงเรียก Secrets Manager ไม่ได้ (`cfn-lint` เตือน W1011 ซึ่งยอมรับได้) |
| ข้อจำกัด | Backup RDS ตั้ง 1 วัน, ไม่เปิด Multi-AZ | ข้อจำกัดของ Free plan |
| แยกคนละชุด | ระบบจริงที่สร้างมือ | ไม่ถูกแตะและไม่ใช้ร่วม รวมถึง user pool เก่า `cs361-coop-web` |

**ตัวแปร env ที่ IaC ตั้งให้:** Lambda backend ได้ `AUTH_MODE`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `CORS_ORIGIN`, `FILE_BUCKET`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `MOCK_LOGINS`, `MOCK_PASSWORD` (timeout 30 วินาที, memory 512 MB) ส่วน Lambda `verify-auth-challenge` ได้ `TU_API_KEY`, `MOCK_LOGINS`, `MOCK_PASSWORD` ค่าเดียวกับ backend ไม่ต้องจำให้ตรงเอง ส่วน Amplify ได้ env ครบเมื่อใช้ `-GitHubRepo` (A5)

### A8. แก้ปัญหา

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `aws` ไม่พบ | เปิด terminal ใหม่หลังติดตั้ง หรือรัน `aws login` ใหม่ถ้า token หมดอายุ |
| Stack ล้ม | ดูสาเหตุ (เปลี่ยนชื่อ stack ตามที่ล้ม): `aws cloudformation describe-stack-events --stack-name <prefix>-data --query "StackEvents[?ResourceStatus=='CREATE_FAILED'].[LogicalResourceId,ResourceStatusReason]" --output text --region ap-southeast-2` stack ที่ล้มค้างสถานะ `ROLLBACK_COMPLETE` ต้องลบก่อนรันใหม่: `aws cloudformation delete-stack --stack-name <ชื่อ stack> --region ap-southeast-2` |
| ชื่อซ้ำ (`already exists`) | prefix นี้ถูกใช้แล้ว ใช้ prefix อื่น หรือรัน `-Destroy` ก่อน |
| Smoke test `/health` ไม่ผ่านเป็น 5xx | Lambda ใน VPC ใช้เวลาเริ่มครั้งแรก (cold start) รันซ้ำอีกครั้ง หรือดู CloudWatch Logs ของ `<prefix>-api` |
| `/auth/me` preflight ผิด | `-WebOrigin` ต้องตรงกับ URL หน้าเว็บ ไม่มี `/` ท้าย แล้วรันซ้ำ |
| Managed login ขึ้น Unavailable | stack 2 สร้าง domain และ style ให้แล้ว ถ้ายังขึ้นให้ตรวจ stack events ของ `<prefix>-app` |
| Google ขึ้น `redirect_uri_mismatch` | เพิ่ม Redirect URI ที่สคริปต์พิมพ์ให้ใน Google Cloud ให้ตรงทุกตัวอักษร |
| Stack `<prefix>-web` ล้มด้วย `list-repository-webhooks ... 404` | token ไม่มีสิทธิ์จัดการ webhook (เคยเจอ: `scopes` ว่างเปล่า) ตรวจด้วยคำสั่งใน A5 แล้วสร้าง token classic ใหม่ที่ติ๊ก `repo` และ `admin:repo_hook` ลบ stack ที่ค้างก่อนรันใหม่ |
| token AWS หมดอายุระหว่างทำงาน | `aws login` ใหม่ แล้วรันคำสั่งเดิมซ้ำ |

### A9. หลักฐานที่ควรเก็บเมื่อส่งงาน
- ภาพ terminal ที่รัน `deploy.ps1` จบพร้อม `[PASS]` ทุกข้อ
- ภาพหน้า CloudFormation ที่ stack `<prefix>-data` และ `<prefix>-app` เป็น `CREATE_COMPLETE`
- ภาพรายการ resource ที่ถูกสร้าง (แท็บ Resources ของแต่ละ stack)
- ภาพหลัง `-Destroy` ที่ stack หายไป (พิสูจน์ว่าสร้างและลบซ้ำได้)

### A10. ผลทดสอบจริง (9 พ.ย. 2026)

| รายการ | ผล |
|---|---|
| ตรวจ template | `validate-template` และ `cfn-lint` ผ่าน |
| Deploy stack 1 และ 2 | `CREATE_COMPLETE` ทั้งคู่ (14 และ 44 resources) |
| Migrate | สำเร็จ (init, migration 003 ถึง 011, seed) |
| Smoke test | `[PASS]` ครบ 4 ข้อ (`/health` 200, `/companies` 200, `/auth/me` ไม่มี token 401, preflight CORS 204) |
| ตรวจเพิ่มด้วย AWS CLI | RDS ไม่ public, Lambda backend อยู่ใน VPC และ trigger 4 ตัวอยู่นอก VPC, Cognito มี domain และ Google provider |
| `-Destroy` | ทั้งสอง stack เป็น `DELETE_COMPLETE` ไม่เหลือ Lambda, VPC, bucket ของชุดทดสอบ ระบบจริงไม่ถูกกระทบ |
| Amplify (stack 3, `-GitHubRepo`) | **สร้างและ build สำเร็จ** (รอบแรกล้มเพราะ GitHub token ไม่มีสิทธิ์ webhook แก้ที่ token แล้วรอบที่สองผ่าน) ได้โดเมน `https://main.<app-id>.amplifyapp.com` และ smoke test ของ backend ผ่าน 4 ข้อ ข้อที่ 5 (หน้าเว็บ) ล้มรอบแรกเพราะตรวจ `HTTP 200` เข้มเกินจริง (ระบบจริงก็ตอบ 404 + เนื้อหาแอป) แก้เป็นตรวจเนื้อหาแล้ว และยืนยันกับทั้งชุดทดสอบและระบบจริงแล้ว แต่ยังไม่ได้รัน deploy เต็มซ้ำหลังแก้ |
| ไม่ได้ใส่ Google และ TU API | ชุดทดสอบใช้ค่า `unused` จึงล็อกอินด้วย Google และบัญชี TU ไม่ได้ (ทดสอบได้เฉพาะบัญชี mock ถ้าตั้ง `-MockLogins` และ `MOCK_PASSWORD`) ไม่เกี่ยวกับความล้มเหลวของ smoke test |
| ยังไม่ได้ทดสอบ | `-CodeOnly` และ Google login กับชุดทดสอบ |

---

## B. CI/CD — push โค้ดแล้ว AWS ใช้ทันที

### B1. ขั้นตอน
เมื่อ push หรือ merge เข้า branch **`main`** GitHub Actions ทำงานเอง:

```
push main (แก้ backend/ หรือ database/)
  → test      เทสต์ 11 ข้อ (ไม่ใช้ฐานข้อมูล) ถ้าไม่ผ่านจะหยุด
  → deploy    build zip → ขอสิทธิ์ AWS → อัปเดต Lambda backend (--publish เก็บ version)
              → อัปเดต trigger 4 ตัว (เฉพาะเมื่อโค้ด trigger เปลี่ยน)
              → smoke test GET /health ต้องได้ 200
```

หน้าเว็บ (`frontend/`) ไม่อยู่ใน workflow นี้ เพราะ **Amplify ผูกกับ GitHub และ deploy เองอยู่แล้ว**

### B2. ไฟล์

| ไฟล์ | หน้าที่ |
|---|---|
| `.github/workflows/deploy-backend.yml` | ขั้นตอนข้างบน และปุ่ม Run workflow |
| `.github/workflows/validate-infra.yml` | รัน `cfn-lint` ตรวจ template ใน `infra/` เมื่อ push (`main`, `develop`) หรือมี pull request |
| `infra/github-deploy-user.yaml` | สร้าง IAM user สิทธิ์น้อยสำหรับ GitHub (ใช้ในบัญชีนี้) |
| `infra/github-oidc.yaml` | ทางเลือกแบบ OIDC ไม่เก็บ key (**ใช้ไม่ได้ในบัญชีนี้**) |

### B3. อะไรอัตโนมัติ อะไรกดเอง

| สิ่งที่เปลี่ยน | สิ่งที่เกิดขึ้น |
|---|---|
| โค้ด backend (`backend/**`) หรือ `database/**` | push `main` แล้วอัปเดต Lambda `cs361-coop-api` เอง |
| โค้ด Cognito trigger (`backend/cognito-triggers/**`) | push `main` แล้วอัปเดต trigger ทั้ง 4 ตัวเอง (ตรวจจากไฟล์ที่เปลี่ยนเทียบกับคอมมิตก่อนหน้า) |
| ไฟล์ migration ใหม่ (`database/migrations/**`) | **ไม่รันเอง** workflow ขึ้นคำเตือนสีเหลือง ให้ทำ snapshot RDS แล้วกด **Run workflow** ติ๊ก `migrate` เพราะ migration แก้ฐานข้อมูลจริง |
| ทรัพยากร AWS (VPC, RDS, Cognito, API Gateway ฯลฯ) | ไม่อยู่ใน workflow ใช้ `deploy.ps1` เพราะต้องใช้สิทธิ์กว้างและเสี่ยงสูง |
| แก้เฉพาะไฟล์นอก `backend/` และ `database/` (เช่น README) | workflow ไม่รัน |

ชื่อ Lambda trigger ที่สร้างมือในระบบจริงคือ `cs361-coop-pre-sign-up`, `cs361-coop-define-auth`, `cs361-coop-create-auth`, `cs361-coop-verify-auth` (ไม่มี `-challenge`) ส่วนชุด IaC ใช้ชื่อ `...-define-auth-challenge` workflow หาชื่อที่มีอยู่จริงให้เอง

### B4. สิทธิ์ AWS ของ GitHub
- องค์กร AWS ของบัญชีนี้ตั้ง **service control policy ปฏิเสธการสร้าง/ดู OIDC provider** (`iam:CreateOpenIDConnectProvider`) จึงใช้ OIDC ไม่ได้ ทางเลือกที่ใช้คือ **IAM user + access key เก็บใน GitHub secrets**
- IAM user ทำได้เฉพาะ: อัปเดตโค้ดและ publish version ของ Lambda backend กับ trigger 4 ตัว และเรียก (invoke) backend เพื่อรัน migrate ไม่มีสิทธิ์อื่น
- ถ้าบัญชีอนาคตอนุญาต OIDC ให้ใช้ `github-oidc.yaml` แล้วตั้งตัวแปร `AWS_DEPLOY_ROLE_ARN` workflow จะเลือก role แทน key เอง

### B5. ตั้งค่าครั้งเดียว
1. ตรวจว่ามีสิทธิ์ตั้งค่า repo (เห็นแท็บ Settings ใน GitHub) ถ้าไม่มี ให้เจ้าของ repo ทำข้อ 5
2. ถ้าเคยรัน `github-oidc.yaml` แล้วล้ม ให้ลบ stack ที่ค้างอยู่ก่อน:

   ```powershell
   aws cloudformation delete-stack --stack-name cs361-coop-github-oidc --region ap-southeast-2
   ```

3. สร้าง IAM user:

   ```powershell
   aws cloudformation deploy --stack-name cs361-coop-github-deploy-user --template-file infra/github-deploy-user.yaml --capabilities CAPABILITY_IAM --region ap-southeast-2
   ```

   ดูชื่อ user:

   ```powershell
   aws cloudformation describe-stacks --stack-name cs361-coop-github-deploy-user --query "Stacks[0].Outputs" --output table --region ap-southeast-2
   ```

4. สร้าง access key (แสดง secret ครั้งเดียว **อย่าส่งให้ใคร อย่าถ่ายภาพ**):

   ```powershell
   aws iam create-access-key --user-name <ชื่อ user จากข้อ 3> --query "AccessKey.[AccessKeyId,SecretAccessKey]" --output text
   ```

5. GitHub → repo → Settings → Secrets and variables → Actions
   - แท็บ **Secrets:** `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` (ค่าจากข้อ 4)
   - แท็บ **Variables:** `API_URL` (URL ของ API ลงท้ายด้วย `/prod/api` ใช้ตรวจ `/health` ถ้าไม่ตั้งจะข้าม smoke test) และถ้าชื่อ Lambda ต่างจากค่าเริ่มต้นให้ตั้ง `LAMBDA_FUNCTION_NAME` และ `TRIGGER_FUNCTION_PREFIX` (ต้องส่ง `LambdaFunctionName=<ชื่อ>` และ `TriggerFunctionPrefix=<prefix>` ตอน deploy template ข้อ 3 ด้วย)
   - **อย่าตั้ง** `AWS_DEPLOY_ROLE_ARN` เมื่อใช้ access key
6. merge workflow เข้า `main` (workflow ต้องอยู่บน `main` ถึงจะรัน และปุ่ม Run workflow จะขึ้น)

**เพิ่มสิทธิ์ให้ IAM user ภายหลัง** (เช่นเพิ่มเมื่อ 9 พ.ย. 2026 ให้อัปเดต trigger และเรียก backend): รันคำสั่ง deploy ในข้อ 3 ซ้ำ ไม่ต้องสร้าง access key ใหม่และไม่ต้องแก้ GitHub secrets

### B6. ใช้งานประจำวัน
- **แก้โค้ด backend หรือ trigger:** push หรือ merge เข้า `main` ก็พอ ไม่ต้องกดอะไร ดูผลที่ GitHub → Actions → Deploy backend
- **มีไฟล์ migration ใหม่:** Actions → Deploy backend → **Run workflow** → เลือก `main` → ติ๊ก `migrate` → Run (ทำ snapshot RDS ก่อน) รัน `{"action":"migrate","seeds":false}` ซึ่งเหมือน test event ที่ตั้งไว้ใน Lambda แต่ไม่ใส่ seed และไม่เปิดให้ `reset`
- **บังคับอัปเดต trigger โดยไม่แก้ไฟล์:** Run workflow แล้วติ๊ก `deploy_triggers`
- ดูว่าอัปเดตจริง: Lambda → Last modified เปลี่ยน และแท็บ Versions มี version ใหม่

### B7. ย้อนกลับเมื่อพัง
- `git revert` คอมมิตที่มีปัญหา แล้ว push เข้า `main` workflow จะ deploy โค้ดก่อนหน้าให้
- หรือดูโค้ดของ version ก่อนหน้าในแท็บ Versions ของ Lambda (workflow ใช้ `--publish` เก็บทุก version ไว้)

### B8. ข้อควรระวัง
- **ทุกครั้งที่ merge เข้า `main` ที่แก้ backend จะ deploy ขึ้นระบบจริงทันที** ด่านที่มีคือเทสต์ 11 ข้อกับ smoke test `/health` ซึ่งจับปัญหาได้ไม่หมด ควรทดสอบใน branch ก่อน merge และพิจารณาเปิด branch protection ให้ต้องผ่าน PR
- เทสต์ API ใหญ่ (`backend/tests/api.test.mjs`) ต้องมี PostgreSQL จึงรันเฉพาะในเครื่อง ไม่อยู่ใน CI
- Lambda ใช้สถาปัตยกรรม arm64 ส่วน GitHub build บนเครื่อง x64 ใช้ได้เพราะ dependency ปัจจุบันเป็น JavaScript ล้วน ถ้าเพิ่มไลบรารีที่มีไฟล์ native ต้องตรวจก่อน
- คำเตือน "Node.js 20 is deprecated" ใน Actions เป็นเรื่อง action เวอร์ชัน v4 ไม่กระทบการทำงาน
- ตรวจ template ในเครื่องก่อน push ได้ด้วย `pip install cfn-lint` แล้ว `cfn-lint --non-zero-exit-code error infra/*.yaml` (CI รันคำสั่งเดียวกัน)

### B9. ผลทดสอบจริง

| รายการ | ผล |
|---|---|
| Deploy backend #1 (merge PR #53) | test และ deploy เขียว (44 วินาที) Lambda มี Version 1 ใหม่ |
| Deploy backend #2 (merge PR #58) | test และ deploy เขียว (38 วินาที) |
| CI `validate-infra` บน PR และ push `main` | เขียว |
| `/health` หลัง deploy | `HTTP 200` และมี header `access-control-allow-origin` ถูกต้อง |
| Run workflow แบบ `deploy_triggers` / `migrate` | ผลที่ควรเห็น: ขั้นอัปเดต trigger เขียวพร้อมบรรทัด `define-auth-challenge -> cs361-coop-define-auth` ครบ 4 ตัว และขั้น migrate ได้ `"log":[]` (ไม่มีไฟล์ใหม่) บันทึกผลจริงของคุณที่นี่ |

### B10. CI/CD กับระบบที่สร้างด้วย IaC
CI/CD **ไม่อัปเดตชุดที่สร้างด้วย IaC** workflow ชี้ไปที่ Lambda ตัวเดียวคือ `cs361-coop-api` (ระบบจริง) และ IAM user มีสิทธิ์เฉพาะตัวนั้น ชุดทดสอบ (`cs361-coop-test-*`) จึงไม่ได้โค้ดใหม่เมื่อ push `main`

| ต้องการ | ทำอย่างไร |
|---|---|
| ให้ชุดที่สร้างด้วย IaC ได้โค้ดล่าสุด | ตอนสร้างใหม่ สคริปต์ build จาก **โฟลเดอร์ที่คุณรันอยู่** (ไม่ใช่จาก GitHub) ถ้าสร้างแล้วอยากอัปเดต ใช้ `deploy.ps1 -Prefix <ชื่อ> -CodeOnly` |
| ให้ CI/CD อัปเดตชุดใหม่แทนระบบเดิม | ตั้งตัวแปร GitHub `LAMBDA_FUNCTION_NAME` และ `TRIGGER_FUNCTION_PREFIX` เป็นชื่อใหม่ และ deploy `infra/github-deploy-user.yaml` ซ้ำพร้อมพารามิเตอร์ `LambdaFunctionName` และ `TriggerFunctionPrefix` (ชี้ได้ที่เดียว ระบบเดิมจะไม่ถูกอัปเดต) |

ข้อมูลในฐานข้อมูลและ migration ไม่ตามไปกับชุดใหม่ (เป็นคนละฐานข้อมูล)

---

## C. วิธีรันใหม่ — ตามสถานการณ์

| สถานการณ์ | ทำอะไร |
|---|---|
| ต้องการระบบใหม่อีกชุด (ทดสอบ/สาธิต) | `deploy.ps1 -Prefix <ชื่อใหม่>` (ข้อ A4) เสร็จแล้ว `-Destroy` |
| ต้องการระบบใหม่อีกชุด **พร้อมหน้าเว็บ (Amplify)** | คำสั่งในข้อ A5 ที่มี `-GitHubRepo` (ต้องมี GitHub token) แล้วลบด้วย `-Destroy` และลบ token |
| แก้โค้ด backend ของระบบจริง | push เข้า `main` (CI/CD ทำเอง) |
| แก้โค้ด trigger ของระบบจริง | push เข้า `main` (CI/CD ทำเอง) |
| มี migration ใหม่ | push แล้วกด Run workflow ติ๊ก `migrate` |
| แก้โค้ด backend ของชุดทดสอบ | `powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 -Prefix <ชื่อ> -CodeOnly` (เพิ่ม `-Migrate` ถ้ามี migration ใหม่) |
| แก้ template ใน `infra/` | รัน `deploy.ps1` เต็มกับชุดทดสอบ (CI รัน `cfn-lint` ให้เมื่อ push) |
| ลบชุดทดสอบ | `powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 -Prefix <ชื่อ> -Destroy` (พิมพ์ prefix ยืนยัน) |
| เพิ่มสิทธิ์ให้ IAM user ของ GitHub | deploy `infra/github-deploy-user.yaml` ซ้ำ (ข้อ B5) ไม่ต้องสร้าง key ใหม่ |
| token AWS หมดอายุ | `aws login` ใหม่ |
| stack ค้างสถานะ `ROLLBACK_COMPLETE` หรือ `deploy.ps1` ล้ม | ดูข้อ A8 |

### ที่เจอระหว่างทำ

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `deploy.ps1` หยุดที่ "Collecting inputs" ด้วย `NativeCommandError` | PowerShell 5.1 แปลง error ของคำสั่ง native เป็นการหยุดสคริปต์ แก้แล้วด้วยฟังก์ชัน `Invoke-AwsQuiet` |
| AWS CLI อ่าน template ไม่ได้ ("text contents could not be decoded") | ไฟล์มีภาษาไทย Windows อ่านด้วย code page ของเครื่อง ไฟล์ `infra/*.yaml` และ `deploy.ps1` จึงเป็น ASCII ล้วน |
| `YAML aliases are not allowed` | CloudFormation ไม่รองรับ anchor/alias ใน YAML |
| สร้าง OIDC provider ไม่ได้ (`explicit deny in a service control policy`) | องค์กร AWS ปฏิเสธ จึงใช้ IAM user |
| Workflow อัปเดต trigger ไม่เจอ Lambda | ชื่อ trigger ของระบบจริงไม่มี `-challenge` workflow หาชื่อเองแล้ว |
| หน้าเว็บ "Failed to fetch" หลังย้าย Amplify branch | `CORS_ORIGIN` ต้องตรงกับ URL เว็บแบบไม่มี `/` ท้าย (template มี pattern ตรวจไว้) |
| Smoke test หน้าเว็บ `/login` ล้มด้วย `HTTP 404` ทั้งที่หน้าแสดงได้ | กฎ `404-200` ของ Amplify ตอบ 404 พร้อมเนื้อหาแอป และ `/login` ถูก redirect ไป `/login/` (ระบบจริงเหมือนกัน) การทดสอบจึงตรวจเนื้อหา (`id="root"`) แทนเลข status |
| สร้าง Amplify ด้วย IaC ล้ม (`list-repository-webhooks ... 404`) | GitHub token ไม่มีสิทธิ์จัดการ webhook: ตอนตรวจ `X-OAuth-Scopes` ว่างเปล่า แม้บัญชีจะเป็น Admin ต้องสร้าง token **classic** ที่ติ๊ก `repo` และ `admin:repo_hook` |

---

## D. ความปลอดภัย และสิ่งที่ต้องทำ

- **ไม่มีความลับใน repository:** รหัสผ่านฐานข้อมูล, `MOCK_PASSWORD`, `TU_API_KEY`, Google client secret ส่งเป็นพารามิเตอร์ตอน deploy (ซ่อนด้วย `NoEcho`) หรือเก็บใน SSM ส่วน AWS key ของ GitHub อยู่ใน GitHub secrets
- **IAM user ของ GitHub จำกัดสิทธิ์** ที่ Lambda เฉพาะตัวและไม่มีสิทธิ์อื่น
- **หลังส่งงานให้ล้าง:**
  1. ลบ access key: `aws iam delete-access-key --user-name <ชื่อ user> --access-key-id <id>` (หา id ด้วย `aws iam list-access-keys --user-name <ชื่อ user>`)
  2. ลบ secrets ทั้งสองตัวใน GitHub
  3. ลบ stack: `aws cloudformation delete-stack --stack-name cs361-coop-github-deploy-user --region ap-southeast-2` (ลบ key ก่อน)
  4. ลบสิ่งที่ `-Destroy` ไม่ลบ: snapshot ของชุดทดสอบ (RDS → Snapshots), พารามิเตอร์ SSM `/cs361-coop-test/deploy/db-password` และ CloudWatch log group `/aws/lambda/cs361-coop-test-api`
  5. **ลบ GitHub token** ที่ใช้สร้าง Amplify (ข้อ A5 หัวข้อ "อายุของ token และการลบ")
- **ข้อควรจำ:** ระบบจริงยังใช้ฐานข้อมูลรหัสผ่านและบัญชี mock ที่ควรเปลี่ยนก่อนใช้งานจริง (ดู DEPLOY_AWS.md ข้อ 10 และ 11)
