# infra/ — Infrastructure as Code 

สร้างระบบ CS361 Co-op บน AWS ซ้ำได้ด้วยคำสั่งเดียว แทนการคลิกใน Console ตามคู่มือ [DEPLOY_AWS.md](../DEPLOY_AWS.md)

| ไฟล์ | ทำอะไร |
|---|---|
| [`network-data.yaml`](network-data.yaml) | **Stack 1** — VPC (private, ไม่มี NAT/IGW), security groups, S3 gateway endpoint, RDS PostgreSQL, S3 สองใบ (ไฟล์ผู้ใช้ และที่เก็บ zip ของ Lambda) |
| [`app.yaml`](app.yaml) | **Stack 2** — IAM role, Lambda backend + trigger 4 ตัว, Cognito (pool, app client, domain, managed login, Google), API Gateway (routes, authorizer, CORS) |
| [`deploy.ps1`](deploy.ps1) | สคริปต์รันทุกขั้นตอนตามลำดับ: build zip → stack 1 → อัปโหลด zip → stack 2 → migrate → smoke test |

ข้อความในไฟล์ `.yaml` และ `.ps1` เป็นภาษาอังกฤษล้วนโดยตั้งใจ เพราะ AWS CLI และ PowerShell 5.1 บน Windows อ่านไฟล์ที่มีภาษาไทยผิดเพี้ยน

## ลำดับการทำงาน

```
build zip (npm ci + tar)
   → deploy stack 1 (network-data)      ← RDS ใช้เวลา 10-15 นาทีครั้งแรก
   → อัปโหลด zip เข้า ArtifactsBucket ของ stack 1
   → deploy stack 2 (app)               ← อ่านค่า VPC/DB/bucket จาก Exports ของ stack 1
   → รัน migrate (สร้างตาราง)
   → smoke test (health, public, 401, CORS)
   → พิมพ์ค่าที่หน้าเว็บต้องใช้
```

Stack 2 deploy ก่อน stack 1 ไม่ได้ เพราะ import ค่าจาก stack 1 และต้องมี zip ใน ArtifactsBucket ก่อน

## สิ่งที่ต้องมี

1. **AWS CLI v2** และล็อกอินแล้ว (`aws login` หรือ `aws configure`) ตรวจด้วย `aws sts get-caller-identity`
2. **Node.js 20+ และ npm** (ใช้ `npm ci` build backend)
3. Windows 10/11 (ใช้ `tar.exe` ที่มากับระบบสร้าง zip ที่ Lambda อ่านได้) และ PowerShell
4. สิทธิ์สร้าง VPC, RDS, IAM, Lambda, Cognito, API Gateway (บัญชีที่ใช้ทดสอบมี `AccountFullAccessRole`)

## สร้างระบบ (ครั้งแรก)

รันที่โฟลเดอร์ root ของโปรเจกต์ โดยใช้ **prefix อื่นที่ไม่ใช่ `cs361-coop`** เพราะชื่อนั้นถูกใช้โดยทรัพยากรที่สร้างมือแล้ว (สคริปต์จะปฏิเสธถ้าใช้ prefix นั้น)

```powershell
powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 -Prefix cs361-coop-test -MockLogins "committee.v3@tu.ac.th,staff.v3@tu.ac.th,company.v3@example.test,company.other.v3@example.test" -Seed
```

สคริปต์จะถามความลับ (กด Enter เพื่อข้ามได้) ค่าเหล่านี้อยู่ในหน่วยความจำเท่านั้น ไม่เขียนลงไฟล์ ไม่ถูก commit และตั้งล่วงหน้าผ่านตัวแปรสภาพแวดล้อมได้:

| ตัวแปร | ใช้ทำอะไร | ถ้าไม่ใส่ |
|---|---|---|
| `DB_PASSWORD` | รหัสผ่านฐานข้อมูล (12-64 ตัว: ตัวอักษร ตัวเลข `_ + = . -`) | สุ่มให้และเก็บไว้ใน SSM Parameter Store (`/<prefix>/deploy/db-password`) |
| `MOCK_PASSWORD` | รหัสผ่านร่วมของบัญชี demo ใน `-MockLogins` | บัญชี demo ใช้ไม่ได้ |
| `TU_API_KEY` | Application-Key ของ TU API | ล็อกอินนักศึกษาไม่ได้ |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth client จาก Google Cloud | ใช้ค่า `unused` (Google login ใช้ไม่ได้ แต่ระบบอื่นทำงาน) |

พารามิเตอร์ของสคริปต์:

| พารามิเตอร์ | ค่าเริ่มต้น | ความหมาย |
|---|---|---|
| `-Prefix` | `cs361-coop-test` | คำนำหน้าชื่อทุกทรัพยากรและชื่อ stack (`<prefix>-data`, `<prefix>-app`) |
| `-Region` | `ap-southeast-2` | region |
| `-WebOrigin` | `http://localhost:5173` | URL หน้าเว็บ **ไม่มี `/` ท้าย** ใช้เป็น CORS origin และ callback URL ของ Cognito |
| `-MockLogins` | ว่าง | อีเมลบัญชี demo คั่นด้วย `,` ไม่มีเว้นวรรค |
| `-Seed` | ปิด | โหลดข้อมูลตัวอย่าง (`005_v3-demo.sql`) ตอน migrate |
| `-SkipTests` | ปิด | ข้าม smoke test |
| `-BuildOnly` | ปิด | build zip เท่านั้น ไม่เรียก AWS (ไว้ทดสอบ packaging) |
| `-CodeOnly` | ปิด | อัปเดตเฉพาะโค้ด backend บน Lambda ที่มีอยู่แล้ว (ดูหัวข้อถัดไป) |
| `-Migrate` | ปิด | ใช้คู่กับ `-CodeOnly` เพื่อรัน migrate หลังอัปเดตโค้ด (ใช้เมื่อมี migration ใหม่) |
| `-Destroy` | ปิด | ลบชุดนี้ทั้งหมด |

รันซ้ำได้ปลอดภัย CloudFormation จะเปลี่ยนเฉพาะสิ่งที่ต่างจากเดิม (zip ใช้ key ใหม่ทุกครั้ง Lambda จึงอัปเดตจริง)

## อัปเดตโค้ด backend หลัง deploy ไปแล้ว

ไม่ต้องทำมือและไม่ต้องสร้างอะไรใหม่ แก้โค้ดใน `backend/` แล้วรัน:

```powershell
powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 -Prefix cs361-coop-test -CodeOnly
```

โหมดนี้ build เฉพาะ backend, อัปโหลด zip ใหม่ขึ้น S3, สั่ง Lambda `<prefix>-api` ให้ใช้ zip นั้น (`update-function-code`) รอจนอัปเดตเสร็จ แล้วรัน smoke test ใช้เวลาประมาณ 1 ถึง 3 นาที ไม่ถามความลับ และไม่แตะ stack 1, Cognito หรือ API Gateway (แก้โค้ดไม่ต้อง Deploy API ใหม่)

- มี migration ใหม่ (ไฟล์ SQL ใน `database/migrations`) ให้เพิ่ม `-Migrate`
- แก้โค้ด trigger ของ Cognito (`backend/cognito-triggers`) หรือแก้ `infra/*.yaml` ให้รันแบบเต็ม (ไม่ใส่ `-CodeOnly`) เพราะ trigger และทรัพยากรอยู่ใน stack 2 โดยครั้งนี้สคริปต์จะถามความลับอีกครั้ง
- `-CodeOnly` ไม่ผ่าน CloudFormation stack จึงบันทึก zip เวอร์ชันเก่าไว้จนกว่าจะรันแบบเต็มครั้งถัดไป ซึ่งใช้ zip ใหม่เสมอ ไม่ทำให้ระบบเสียหาย
- ถ้าไม่ต้องการรันสคริปต์เอง ทำเป็น GitHub Actions (build แล้ว `update-function-code` เมื่อ push) ได้ แต่ต้องตั้งสิทธิ์ AWS ให้ GitHub ก่อน ซึ่งยังไม่ได้ทำ

## ผลที่ได้เมื่อรันสำเร็จ

สคริปต์พิมพ์ผล smoke test 4 ข้อ (ต้อง `PASS` ทั้งหมด) และค่าสำหรับหน้าเว็บ:

| Smoke test | คาดหวัง |
|---|---|
| `GET /health` | 200 (สาธารณะ) |
| `GET /companies` | 200 (สาธารณะ) |
| `GET /auth/me` ไม่มี token | 401 (authorizer ทำงาน) |
| `OPTIONS /auth/me` พร้อม Origin | 200/204 และ `Access-Control-Allow-Origin` ตรงกับ `-WebOrigin` (CORS ถูกต้อง) |

ค่าที่ต้องใส่ที่หน้าเว็บ (Amplify environment variables หรือ `frontend/.env`): `VITE_AUTH_MODE=cognito`, `VITE_API_URL`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_DOMAIN` และ **Redirect URI ของ Google** (`https://<โดเมน Cognito>/oauth2/idpresponse`) ที่ต้องเพิ่มใน Google Cloud ถ้าจะใช้ Google login

## ลบชุดทดสอบ

```powershell
powershell -ExecutionPolicy Bypass -File infra\deploy.ps1 -Prefix cs361-coop-test -Destroy
```

สคริปต์ให้พิมพ์ prefix ยืนยัน แล้วลบ stack 2 → ล้าง bucket → ลบ stack 1 RDS จะเหลือ snapshot สุดท้าย 1 ก้อน (ลบเองในหน้า RDS ถ้าไม่ต้องการ) และพารามิเตอร์ SSM ของรหัสผ่านถูกเก็บไว้ (คำสั่งลบอยู่ท้ายผลลัพธ์) ทรัพยากรที่สร้างมือ (prefix `cs361-coop`) ไม่ถูกแตะเพราะไม่อยู่ใน stack เหล่านี้

## หลักฐานที่ควรเก็บเมื่อส่งงาน

- ภาพ terminal ที่รัน `deploy.ps1` จบพร้อม `PASS` ทุกข้อ
- ภาพหน้า CloudFormation ที่ stack `<prefix>-data` และ `<prefix>-app` เป็น `CREATE_COMPLETE`
- ภาพรายการ resource ที่ถูกสร้าง (แท็บ Resources ของแต่ละ stack)
- ภาพหลัง `-Destroy` ที่ stack หายไป (พิสูจน์ว่าสร้าง/ลบซ้ำได้)

## ข้อจำกัด และขั้นตอนที่ยังต้องทำมือ

| ขั้นตอน | เหตุผล |
|---|---|
| สร้าง Google OAuth client และ consent screen ใน Google Cloud | ไม่มี API ของ CloudFormation สำหรับส่วนนี้ ต้องเพิ่ม Redirect URI ที่สคริปต์พิมพ์ให้ |
| ขอ `TU_API_KEY` จากมหาวิทยาลัย | เป็นความลับที่ต้องขอเอง |
| เชื่อม Amplify กับ GitHub และตั้ง env ของหน้าเว็บ | ต้องอนุญาตสิทธิ์ GitHub และ repo ของ Amplify เป็นคนละส่วนกับ stack นี้ จึงยังไม่ได้ทำเป็น template (ค่าที่ต้องใส่สคริปต์พิมพ์ให้ครบ) |
| ข้อมูลใน RDS เดิม | IaC สร้างโครงสร้าง ไม่ย้ายข้อมูล ชุดใหม่เป็นฐานข้อมูลว่าง (ใช้ `-Seed` เพื่อข้อมูลตัวอย่าง) |
| รหัสผ่านฐานข้อมูลใน Lambda เป็น environment variable | VPC ไม่มี NAT จึงเรียก Secrets Manager ไม่ได้ (ตามที่ DEPLOY_AWS.md อธิบาย) cfn-lint จึงเตือน W1011 ซึ่งยอมรับได้ |

## ปัญหาที่อาจเจอ

| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| `aws` ไม่พบ | เปิด terminal ใหม่หลังติดตั้ง หรือรัน `aws login` ใหม่ถ้า token หมดอายุ |
| Stack 1 ล้มที่ RDS | ดูสาเหตุ: `aws cloudformation describe-stack-events --stack-name <prefix>-data --query "StackEvents[?ResourceStatus=='CREATE_FAILED'].[LogicalResourceId,ResourceStatusReason]" --output text` stack ที่ล้มค้างสถานะ `ROLLBACK_COMPLETE` ต้องลบก่อน: `aws cloudformation delete-stack --stack-name <prefix>-data` |
| ชื่อซ้ำ (`already exists`) | prefix นี้ถูกใช้แล้ว ใช้ prefix อื่น หรือรัน `-Destroy` ก่อน |
| Smoke test `/health` ไม่ผ่านเป็น 5xx | Lambda ใน VPC ใช้เวลาเริ่มครั้งแรก (cold start) รันซ้ำอีกครั้ง หรือดู CloudWatch Logs ของ `<prefix>-api` |
| `/auth/me` preflight ผิด | `-WebOrigin` ต้องตรงกับ URL หน้าเว็บ ไม่มี `/` ท้าย แล้วรันซ้ำ |
| Managed login ขึ้น Unavailable | สร้าง domain และ style ใน stack 2 อยู่แล้ว ถ้ายังขึ้นให้ตรวจ stack events ของ `<prefix>-app` |
| Google ขึ้น `redirect_uri_mismatch` | เพิ่ม Redirect URI ที่สคริปต์พิมพ์ให้ใน Google Cloud ให้ตรงทุกตัวอักษร |

## CI/CD: push ขึ้น GitHub แล้ว backend อัปเดตเอง

| ไฟล์ | ทำอะไร |
|---|---|
| [`github-deploy-user.yaml`](github-deploy-user.yaml) | **ใช้ในบัญชีนี้** — สร้าง IAM user ที่ทำได้แค่อัปเดตโค้ดของ Lambda ตัวเดียว (ไม่สร้าง access key ใน template) ใช้ key ของ user นี้เก็บเป็น GitHub secrets |
| [`github-oidc.yaml`](github-oidc.yaml) | ทางเลือกที่ปลอดภัยกว่า (OIDC ไม่เก็บ key) แต่ **ใช้ไม่ได้ในบัญชีนี้**: องค์กร AWS ตั้ง service control policy ปฏิเสธ `iam:CreateOpenIDConnectProvider` (stack ล้มด้วย "explicit deny in a service control policy") เก็บไว้ใช้กับบัญชีที่อนุญาต |
| [`.github/workflows/deploy-backend.yml`](../.github/workflows/deploy-backend.yml) | เมื่อ push `main` ที่แก้ `backend/` หรือ `database/`: รันเทสต์ → build zip → อัปเดต Lambda backend (`--publish` เก็บเวอร์ชันไว้ย้อนกลับ) → อัปเดต trigger 4 ตัวถ้าโค้ดเปลี่ยน → smoke test `/health` และกด Run workflow เพื่อรัน migrate ได้ ใช้ OIDC role ถ้าตั้งตัวแปร `AWS_DEPLOY_ROLE_ARN` ไม่เช่นนั้นใช้ access key จาก secrets |

หน้าเว็บอัปเดตอัตโนมัติอยู่แล้วโดย Amplify (ผูกกับ GitHub ที่ branch `main`)

**ตั้งค่าครั้งเดียว (แบบ IAM user)**
1. ตรวจว่ามีสิทธิ์ตั้งค่า repo (เห็นแท็บ Settings ใน GitHub) ถ้าไม่มี ให้เจ้าของ repo ทำขั้น 4
2. ถ้าเคยรัน `github-oidc.yaml` แล้วล้ม ให้ลบ stack ที่ค้างอยู่ก่อน (สถานะ `ROLLBACK_COMPLETE`):
   ```powershell
   aws cloudformation delete-stack --stack-name cs361-coop-github-oidc --region ap-southeast-2
   ```
3. สร้าง IAM user:
   ```powershell
   aws cloudformation deploy --stack-name cs361-coop-github-deploy-user --template-file infra/github-deploy-user.yaml --capabilities CAPABILITY_IAM --region ap-southeast-2
   ```
   แล้วดูชื่อ user: `aws cloudformation describe-stacks --stack-name cs361-coop-github-deploy-user --query "Stacks[0].Outputs" --output table --region ap-southeast-2`
4. สร้าง access key (แสดง secret ครั้งเดียว อย่าส่งให้ใครหรือถ่ายภาพ):
   ```powershell
   aws iam create-access-key --user-name <ชื่อ user จากข้อ 3> --query "AccessKey.[AccessKeyId,SecretAccessKey]" --output text
   ```
5. GitHub → repo → Settings → Secrets and variables → Actions:
   - แท็บ **Secrets** → เพิ่ม `AWS_ACCESS_KEY_ID` และ `AWS_SECRET_ACCESS_KEY` (ค่าจากข้อ 4)
   - แท็บ **Variables** → เพิ่ม `API_URL` (เช่น `https://<api-id>.execute-api.ap-southeast-2.amazonaws.com/prod/api` ใช้ตรวจ `/health` ถ้าไม่ตั้งจะข้าม smoke test) และ `LAMBDA_FUNCTION_NAME` ถ้าจะอัปเดต Lambda อื่นนอกจาก `cs361-coop-api` (ต้องส่ง `LambdaFunctionName=<ชื่อ>` ตอน deploy template ข้อ 3 ด้วย)
   - **ห้ามตั้ง** ตัวแปร `AWS_DEPLOY_ROLE_ARN` เมื่อใช้ access key
6. push ไฟล์ workflow ขึ้น `main` แล้วทดสอบ: แท็บ Actions → Deploy backend → Run workflow

**ข้อควรระวังของ access key:** เป็นความลับระยะยาว ใครได้ไปจะอัปเดตโค้ด Lambda ตัวนั้นได้ จึงจำกัดสิทธิ์ไว้ที่ Lambda ตัวเดียวและเก็บเฉพาะใน GitHub secrets เมื่อส่งงานเสร็จให้ลบ key (`aws iam delete-access-key --user-name <ชื่อ user> --access-key-id <id>`) หรือลบ stack ทิ้ง

**ย้อนกลับเมื่อพัง:** `git revert` คอมมิตที่มีปัญหาแล้ว push workflow จะ deploy โค้ดก่อนหน้าให้ หรือใน Lambda → Versions เลือกเวอร์ชันก่อนหน้า

**ขอบเขต: อะไรอัตโนมัติ อะไรกดเอง**

| สิ่งที่เปลี่ยน | สิ่งที่ workflow ทำ |
|---|---|
| โค้ด backend หรือไฟล์ใน `database/` | push `main` แล้วอัปเดต Lambda backend เอง |
| โค้ดใน `backend/cognito-triggers/` | push `main` แล้วอัปเดต Lambda trigger ทั้ง 4 ตัวด้วย (ตรวจจากไฟล์ที่เปลี่ยนเทียบกับคอมมิตก่อนหน้า) หรือกด Run workflow แล้วติ๊ก `deploy_triggers` |
| ไฟล์ migration ใหม่ใน `database/migrations/` | **ไม่รันเอง** workflow แสดงคำเตือนสีเหลืองบอกให้ทำ snapshot RDS แล้วกด Run workflow พร้อมติ๊ก `migrate` (รัน `{"action":"migrate","seeds":false}` ไม่ใส่ seed เสมอ) |
| ทรัพยากร AWS (VPC, RDS, Cognito, API Gateway ฯลฯ) | ไม่ได้อยู่ใน workflow ใช้ `deploy.ps1` เพราะต้องใช้สิทธิ์กว้างและมีความเสี่ยงสูง |

ตั้งค่าเพิ่ม: IAM user ต้องมีสิทธิ์อัปเดต trigger และเรียก backend (เพิ่มเมื่อ 9 พ.ย. 2026) ถ้าสร้างไว้ก่อนหน้านี้แล้ว ให้รันคำสั่ง deploy ข้อ 3 ซ้ำเพื่ออัปเดตสิทธิ์ (ไม่ต้องสร้าง access key ใหม่) workflow หาชื่อ Lambda trigger ให้เองทั้งแบบ `cs361-coop-define-auth` (ระบบจริงที่สร้างมือ) และ `cs361-coop-define-auth-challenge` (ชุด IaC) ถ้าใช้ prefix อื่นที่ไม่ใช่ `cs361-coop` ให้ตั้งตัวแปร GitHub `TRIGGER_FUNCTION_PREFIX` และส่ง `TriggerFunctionPrefix=<prefix>` ตอน deploy template ด้วย


## ตรวจ template อัตโนมัติ (CI)

[`.github/workflows/validate-infra.yml`](../.github/workflows/validate-infra.yml) รัน `cfn-lint` ทุกครั้งที่แก้ไฟล์ใน `infra/` (push และ pull request) โดยไม่ต้องใช้ความลับหรือเข้าบัญชี AWS ตรวจในเครื่องได้ด้วย:

```powershell
pip install cfn-lint
cfn-lint --non-zero-exit-code error infra/network-data.yaml infra/app.yaml infra/github-oidc.yaml
```

## สถานะ

ตรวจแล้ว (9 พ.ย. 2026):
- ไวยากรณ์ผ่าน `aws cloudformation validate-template` และ `cfn-lint` (เหลือคำเตือน W1011 ที่ยอมรับ)
- **Deploy จริงสำเร็จ** ด้วย `deploy.ps1 -Prefix cs361-coop-test`: stack `cs361-coop-test-data` (14 resources) และ `cs361-coop-test-app` (44 resources) เป็น `CREATE_COMPLETE` ทั้งหมด
- migrate สำเร็จ (`init` และ migration 003 ถึง 011 พร้อม seed) และ smoke test ผ่านครบ 4 ข้อ (`/health` 200, `/companies` 200, `/auth/me` ไม่มี token 401, preflight CORS 204)
- ตรวจเพิ่มด้วย AWS CLI: RDS ไม่ public, Lambda backend อยู่ใน VPC ส่วน trigger 4 ตัวอยู่นอก VPC, Cognito มี domain และ Google provider

- **`-Destroy` ทดสอบแล้ว:** stack `cs361-coop-test-app` และ `cs361-coop-test-data` เป็น `DELETE_COMPLETE` ไม่เหลือ Lambda, VPC หรือ bucket ของชุดทดสอบ ระบบจริง (RDS `cs361-coop-db`, bucket `cs361-coop-files-2026`, Cognito pool เดิม) ไม่ถูกกระทบ เหลือเฉพาะ snapshot สุดท้ายของ RDS 1 ก้อนและพารามิเตอร์ SSM ของรหัสผ่านตามที่ออกแบบไว้

ยังไม่ได้ตรวจ: `-CodeOnly` และ Google login กับชุดทดสอบ (ต้องมี OAuth client และเพิ่ม Redirect URI)
