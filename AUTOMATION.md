# AUTOMATION.md — IaC และ CI/CD (V5)

เอกสารนี้เป็น **ภาพรวม** ของ Automation ในโปรเจกต์ แยกเป็น 2 ส่วนที่ไม่ขึ้นต่อกัน พร้อมผลทดสอบจริงและวิธีรันซ้ำตามสถานการณ์

| ส่วน | ตอบโจทย์ | ทำอะไร | ไฟล์หลัก |
|---|---|---|---|
| **A. IaC** (Infrastructure as Code) | "สร้างโครงสร้าง AWS ซ้ำได้" | เขียนทรัพยากร AWS เป็นโค้ด สร้างทั้งชุดด้วยคำสั่งเดียว และลบได้ทั้งชุด | `infra/*.yaml`, `infra/deploy.ps1` |
| **B. CI/CD** | "push โค้ดแล้ว AWS ใช้ได้ทันที" | push ขึ้น GitHub แล้วทดสอบและอัปเดต Lambda อัตโนมัติ | `.github/workflows/*.yml`, `infra/github-deploy-user.yaml` |

IaC สร้าง "สถานที่" (VPC, RDS, Lambda ฯลฯ) ส่วน CI/CD ส่ง "โค้ดใหม่" เข้า Lambda ที่มีอยู่แล้ว ระบบที่ใช้งานจริงตอนนี้ **สร้างด้วยมือ** (prefix `cs361-coop`) ไม่ได้อยู่ใน stack ของ IaC IaC จึงสร้างระบบ "อีกชุด" แยกจากกัน (ชุดทดสอบ prefix `cs361-coop-test`) ส่วน CI/CD อัปเดต Lambda ของระบบจริง

**อ่านไฟล์ไหนเมื่อไร**

| ไฟล์ | เนื้อหา |
|---|---|
| **AUTOMATION.md** (ไฟล์นี้) | ภาพรวม ตารางว่าอะไรอัตโนมัติ ผลทดสอบจริง วิธีรันตามสถานการณ์ ความปลอดภัยและการล้างหลังส่งงาน |
| [infra/README.md](infra/README.md) | **รายละเอียดคำสั่ง:** สิ่งที่ต้องมี, พารามิเตอร์และความลับของ `deploy.ps1`, ตั้งค่า CI/CD ทีละคำสั่ง, ขั้นตอนที่ยังเป็นมือ, วิธีแก้ปัญหา, หลักฐานที่ควรเก็บ |
| [DEPLOY_AWS.md](DEPLOY_AWS.md) | คู่มือสร้างด้วยมือ รายการ AWS resource และตารางว่าขั้นตอนไหนควร automate |

---

## A. IaC — สร้างโครงสร้าง AWS ด้วยโค้ด

### A1. ทำไมต้องมี
- **สร้างซ้ำได้** ระบบมีทรัพยากรหลายสิบตัว การทำมือตามคู่มือยาวเสี่ยงผิดพลาด
- **ลดความผิดพลาดจากการตั้งค่า** ปัญหาที่เคยเจอ เช่น `CORS_ORIGIN` มี `/` ท้าย, ลืมสร้าง Cognito domain, `MOCK_LOGINS` สองที่ไม่ตรงกัน ถูกกำหนดครั้งเดียวใน template
- **มีชุดทดสอบแยกได้** เปลี่ยน `Prefix` ก็ได้ระบบใหม่ ลบทิ้งได้ทั้งชุด
- **ตรวจสอบย้อนหลังได้** โครงสร้างอยู่ใน git

### A2. สิ่งที่สร้าง

| ไฟล์ | หน้าที่ |
|---|---|
| `infra/network-data.yaml` (**stack 1**, 14 resources) | VPC แบบ private 2 AZ (ไม่มี NAT/IGW), sg-lambda และ sg-rds, S3 gateway endpoint, RDS PostgreSQL (ไม่ public), S3 bucket ไฟล์ผู้ใช้, S3 bucket พัก zip ของ Lambda |
| `infra/app.yaml` (**stack 2**, 44 resources) | IAM role, Lambda backend (ใน VPC), Lambda trigger 4 ตัว (นอก VPC), Cognito (user pool, app client, domain, managed login, Google provider), API Gateway (routes, authorizer, CORS, stage) |
| `infra/deploy.ps1` | สคริปต์รันทุกขั้นตอนตามลำดับ และลบชุดทดสอบ (`-Destroy`) |

stack 2 อ่านค่าจาก stack 1 จึงต้อง deploy stack 1 ก่อน และต้องมี zip ของ Lambda ใน bucket ก่อนสร้าง stack 2

### A3. สร้างระบบใหม่
ที่โฟลเดอร์ root ของโปรเจกต์ ใช้ prefix ที่ไม่ใช่ `cs361-coop` (สคริปต์ปฏิเสธ เพราะชื่อชนกับระบบจริง):

```powershell
powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 -Prefix cs361-coop-test -MockLogins "committee.v3@tu.ac.th,staff.v3@tu.ac.th,company.v3@example.test,company.other.v3@example.test" -Seed
```

สคริปต์ทำตามลำดับ: ตรวจเบื้องต้น → ถามความลับ (กด Enter ข้ามได้) → build zip → deploy stack 1 (RDS ใช้ 10 ถึง 15 นาที) → อัปโหลด zip → deploy stack 2 → migrate → smoke test 4 ข้อ (ต้อง `[PASS]` ทั้งหมด) → พิมพ์ค่าสำหรับหน้าเว็บ (`VITE_*`) และ Redirect URI ของ Google

สิ่งที่ต้องมีก่อน, พารามิเตอร์ทั้งหมด, ตัวแปรความลับ และขั้นตอนที่ IaC ทำให้ไม่ได้ (Google OAuth client, `TU_API_KEY`, เชื่อม Amplify กับ GitHub, ข้อมูลใน RDS เดิม) ดูใน [infra/README.md](infra/README.md)

### A4. ผลทดสอบจริง (9 พ.ย. 2026)

| รายการ | ผล |
|---|---|
| ตรวจ template | `validate-template` และ `cfn-lint` ผ่าน |
| Deploy stack 1 และ 2 | `CREATE_COMPLETE` ทั้งคู่ (14 และ 44 resources) |
| Migrate | สำเร็จ (init, migration 003 ถึง 011, seed) |
| Smoke test | `[PASS]` ครบ 4 ข้อ (`/health` 200, `/companies` 200, `/auth/me` ไม่มี token 401, preflight CORS 204) |
| ตรวจเพิ่มด้วย AWS CLI | RDS ไม่ public, Lambda backend อยู่ใน VPC และ trigger 4 ตัวอยู่นอก VPC, Cognito มี domain และ Google provider |
| `-Destroy` | ทั้งสอง stack เป็น `DELETE_COMPLETE` ไม่เหลือ Lambda, VPC, bucket ของชุดทดสอบ ระบบจริงไม่ถูกกระทบ |
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
1. สร้าง IAM user ด้วย `infra/github-deploy-user.yaml`
2. สร้าง access key (แสดงครั้งเดียว อย่าส่งให้ใคร อย่าถ่ายภาพ)
3. ใส่ secrets `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` และ variable `API_URL` ใน GitHub (Settings → Secrets and variables → Actions)
4. merge workflow เข้า `main` (workflow ต้องอยู่บน `main` ถึงจะรัน และปุ่ม Run workflow จะขึ้น)

คำสั่งทีละขั้นอยู่ใน [infra/README.md](infra/README.md) หัวข้อ "CI/CD"

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

### B9. ผลทดสอบจริง

| รายการ | ผล |
|---|---|
| Deploy backend #1 (merge PR #53) | test และ deploy เขียว (44 วินาที) Lambda มี Version 1 ใหม่ |
| Deploy backend #2 (merge PR #58) | test และ deploy เขียว (38 วินาที) |
| CI `validate-infra` บน PR และ push `main` | เขียว |
| `/health` หลัง deploy | `HTTP 200` และมี header `access-control-allow-origin` ถูกต้อง |
| Run workflow แบบ `deploy_triggers` / `migrate` | ผลที่ควรเห็น: ขั้นอัปเดต trigger เขียวพร้อมบรรทัด `define-auth-challenge -> cs361-coop-define-auth` ครบ 4 ตัว และขั้น migrate ได้ `"log":[]` (ไม่มีไฟล์ใหม่) บันทึกผลจริงของคุณที่นี่ |

---

## C. วิธีรันใหม่ — ตามสถานการณ์

| สถานการณ์ | ทำอะไร |
|---|---|
| ต้องการระบบใหม่อีกชุด (ทดสอบ/สาธิต) | `deploy.ps1 -Prefix <ชื่อใหม่>` (ข้อ A3) เสร็จแล้ว `-Destroy` |
| แก้โค้ด backend ของระบบจริง | push เข้า `main` (CI/CD ทำเอง) |
| แก้โค้ด trigger ของระบบจริง | push เข้า `main` (CI/CD ทำเอง) |
| มี migration ใหม่ | push แล้วกด Run workflow ติ๊ก `migrate` |
| แก้โค้ด backend ของชุดทดสอบ | `powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 -Prefix <ชื่อ> -CodeOnly` (เพิ่ม `-Migrate` ถ้ามี migration ใหม่) |
| แก้ template ใน `infra/` | รัน `deploy.ps1` เต็มกับชุดทดสอบ (CI รัน `cfn-lint` ให้เมื่อ push) |
| ลบชุดทดสอบ | `powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 -Prefix <ชื่อ> -Destroy` (พิมพ์ prefix ยืนยัน) |
| เพิ่มสิทธิ์ให้ IAM user ของ GitHub | deploy `infra/github-deploy-user.yaml` ซ้ำ (ไม่ต้องสร้าง key ใหม่) |
| token AWS หมดอายุ | `aws login` ใหม่ |
| stack ค้างสถานะ `ROLLBACK_COMPLETE` หรือ `deploy.ps1` ล้ม | ดูสาเหตุและวิธีลบใน [infra/README.md](infra/README.md) หัวข้อ "ปัญหาที่อาจเจอ" |

---

## D. ความปลอดภัย และสิ่งที่ต้องทำหลังส่งงาน

- **ไม่มีความลับใน repository:** รหัสผ่านฐานข้อมูล, `MOCK_PASSWORD`, `TU_API_KEY`, Google client secret ส่งเป็นพารามิเตอร์ตอน deploy (ซ่อนด้วย `NoEcho`) หรือเก็บใน SSM ส่วน AWS key ของ GitHub อยู่ใน GitHub secrets
- **IAM user ของ GitHub จำกัดสิทธิ์** ที่ Lambda เฉพาะตัวและไม่มีสิทธิ์อื่น
- **หลังส่งงานให้ล้าง:**
  1. ลบ access key: `aws iam delete-access-key --user-name <ชื่อ user> --access-key-id <id>` (หา id ด้วย `aws iam list-access-keys --user-name <ชื่อ user>`)
  2. ลบ secrets ทั้งสองตัวใน GitHub
  3. ลบ stack: `aws cloudformation delete-stack --stack-name cs361-coop-github-deploy-user --region ap-southeast-2` (ลบ key ก่อน)
  4. ลบ snapshot ของชุดทดสอบใน RDS → Snapshots และพารามิเตอร์ SSM `/cs361-coop-test/deploy/db-password`
- **ข้อควรจำ:** ระบบจริงยังใช้ฐานข้อมูลรหัสผ่านและบัญชี mock ที่ควรเปลี่ยนก่อนใช้งานจริง (ดู DEPLOY_AWS.md ข้อ 10 และ 11)
