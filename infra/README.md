# infra/ — โครงสร้างโค้ด

ไฟล์นี้อธิบาย **โครงสร้างโค้ดในโฟลเดอร์ `infra/`** เท่านั้น (แต่ละไฟล์ทำอะไร ประกอบกันอย่างไร) วิธีรัน คำสั่ง พารามิเตอร์ การตั้งค่า CI/CD การแก้ปัญหา และผลทดสอบ อยู่ใน **[AUTOMATION.md](../AUTOMATION.md)**

## 1. ภาพรวมของโฟลเดอร์

```
infra/
├── network-data.yaml       Stack 1  เครือข่าย ฐานข้อมูล และ S3
├── app.yaml                Stack 2  IAM, Lambda, Cognito, API Gateway
├── frontend.yaml           Stack 3  Amplify Hosting 
├── github-deploy-user.yaml IAM user สำหรับ GitHub Actions (CI/CD)
├── github-oidc.yaml        ทางเลือกแบบ OIDC สำหรับ CI/CD (ใช้ไม่ได้ในบัญชีนี้)
├── deploy.ps1              สคริปต์ที่ประกอบทุกอย่างเข้าด้วยกัน
├── README.md               ไฟล์นี้
└── .build/                 ผล build ชั่วคราว (สร้างโดย deploy.ps1, ไม่อยู่ใน git)
```

และที่อยู่นอกโฟลเดอร์แต่เป็นส่วนหนึ่งของ Automation: `.github/workflows/deploy-backend.yml`, `.github/workflows/validate-infra.yml`

## 2. ความสัมพันธ์ระหว่าง stack

```
frontend.yaml (stack 3, รอบแรก)  ──► โดเมน Amplify ──┐
                                                      ▼
network-data.yaml (stack 1) ──Exports──► app.yaml (stack 2) ──Outputs──► frontend.yaml (stack 3, รอบสอง)
        │                                    ▲
        └─ ArtifactsBucket ◄── zip ของ Lambda (อัปโหลดโดย deploy.ps1)
```

- **stack 2 อ่านค่าจาก stack 1** ผ่าน Exports ชื่อ `<Prefix>-...` (ด้วย `Fn::ImportValue`) จึงลบ stack 1 ไม่ได้ถ้า stack 2 ยังอยู่
- **stack 3 ถูก deploy 2 รอบ** เพราะมีการอ้างอิงเป็นวงกลม: CORS origin และ callback URL ของ Cognito (stack 2) ต้องรู้โดเมนของ Amplify ส่วน Amplify ต้องรู้ค่า `VITE_*` จาก stack 2 รอบแรกจึงสร้างโดยไม่มีค่า backend และไม่ build รอบสองใส่ค่าแล้วสั่ง build
- ทุกทรัพยากรชื่อขึ้นต้นด้วยพารามิเตอร์ `Prefix` เพื่อให้สร้างหลายชุดได้โดยไม่ชนกัน

## 3. แต่ละ template

### `network-data.yaml` — Stack 1 (14 resources)
| กลุ่ม | resource | หมายเหตุ |
|---|---|---|
| เครือข่าย | `Vpc`, `PrivateSubnetA/B`, `PrivateRouteTable` และ association 2 ตัว | private 2 AZ ไม่มี NAT และไม่มี internet gateway |
| S3 endpoint | `S3GatewayEndpoint` | ทางเดียวที่ Lambda ใน VPC ออกไปถึง S3 (ฟรี) |
| Security group | `LambdaSecurityGroup`, `RdsSecurityGroup`, `RdsIngressFromLambda` | sg-lambda ออกได้เฉพาะ 5432 ไป sg-rds และ 443 ไป S3 prefix list; sg-rds รับเฉพาะ 5432 จาก sg-lambda และไม่มี outbound (ใช้กฎ `127.0.0.1/32` แทนการตัด allow-all) |
| ฐานข้อมูล | `DbSubnetGroup`, `Database` | PostgreSQL ไม่ public เข้ารหัส gp3 `DeletionPolicy: Snapshot` (ลบ stack แล้วเหลือ snapshot สุดท้าย) |
| S3 | `FilesBucket`, `ArtifactsBucket` | บล็อก public ทั้งหมด เข้ารหัส ชื่อสร้างอัตโนมัติ (ไม่ชน) ใบที่สองเก็บ zip ของ Lambda เพราะ CloudFormation สร้าง Lambda จากไฟล์ในเครื่องไม่ได้ |

- **Parameters (13):** `Prefix`, `VpcCidr`, `PrivateSubnetACidr`, `PrivateSubnetBCidr`, `S3PrefixListId`, `DbInstanceClass`, `DbAllocatedStorage`, `DbEngineVersion`, `DbName`, `DbUsername`, `DbPassword` (NoEcho), `DbBackupRetentionDays`, `DbDeletionProtection`
- **Exports:** `VpcId`, `PrivateSubnetIds`, `LambdaSecurityGroupId`, `DbHost`, `DbPort`, `DbName`, `DbUsername`, `FilesBucketName`, `FilesBucketArn`, `ArtifactsBucketName` (ขึ้นต้นด้วย `<Prefix>-`)
- `S3PrefixListId` ไม่ได้กรอกเอง สคริปต์ค้นหาให้จาก region

### `app.yaml` — Stack 2 (44 resources)
| กลุ่ม | resource |
|---|---|
| IAM (2) | `TriggerRole` (แก้ attribute ของ Cognito ได้), `BackendRole` (VPC และ S3 เฉพาะ bucket ไฟล์) |
| Lambda trigger (4) + สิทธิ์ให้ Cognito เรียก (4) | `PreSignUpFunction`, `DefineAuthChallengeFunction`, `CreateAuthChallengeFunction`, `VerifyAuthChallengeFunction` และ `...Permission` ของแต่ละตัว อยู่นอก VPC เพราะ verify ต้องเรียก TU API |
| Cognito (5) | `UserPool` (ผูก trigger, attribute `en_name`), `GoogleProvider` (map `email`, `email_verified`, `name`), `UserPoolClient`, `UserPoolDomain`, `ManagedLoginStyle` |
| Lambda backend (1) | `BackendFunction` อยู่ใน VPC โค้ดมาจากไฟล์ใน ArtifactsBucket ตัวแปร env ทั้งหมดตั้งในส่วน `Environment` |
| API Gateway (28) | `Api` (REST, binary `*/*`), `CognitoAuthorizer`, resource 9 ตัว (`api`, `{proxy+}`, `health`, `public`, `companies`, `company-logos` และลูก), method 12 ตัว, `Gateway4xxResponse` และ `Gateway5xxResponse` (header CORS), `ApiDeployment`, `ApiStage`, `ApiInvokePermission` |

- **Parameters (16):** `Prefix`, `LambdaRuntime`, `BackendCodeKey`, `TriggerKeyPrefix`, `WebOrigin` (มี pattern ไม่ให้มี `/` ท้าย), `CognitoDomainPrefix`, `DbPassword`, `MockLogins`, `MockPassword`, `TuApiKey`, `GoogleClientId`, `GoogleClientSecret`, `ApiStageName`, `ApiThrottleRate`, `ApiThrottleBurst`, `ApiDeploymentVersion`
- **Outputs:** `ApiUrl`, `UserPoolId`, `UserPoolClientId`, `CognitoDomain`, `GoogleRedirectUri`, `BackendFunctionName` (สคริปต์เอาไปใช้ต่อ)
- สิทธิ์ของ `TriggerRole` ผูกกับ user pool ในบัญชี/region นี้ด้วย wildcard เพราะ pool ยังไม่มีตอนสร้าง role (กันการอ้างอิงเป็นวงกลม)
- method ทุกตัวใช้ Lambda proxy; `AuthorizationType` เป็น `COGNITO_USER_POOLS` เฉพาะ route ที่ต้องล็อกอิน (ตรงกับตารางใน DEPLOY_AWS.md ข้อ 8) และ OPTIONS เป็นสาธารณะ
- `ApiDeploymentVersion` เปลี่ยนค่าทุกครั้งที่สคริปต์รัน เพื่อให้ API Gateway สร้าง deployment ใหม่ (CloudFormation ไม่ทำให้เองเมื่อแก้ method)

### `frontend.yaml` — Stack 3 (2 resources, ไม่บังคับ)
- `AmplifyApp` (ผูก GitHub, build spec แบบ monorepo, กฎ rewrite `/<*>` → `/index.html` 404-200, env รวม `VITE_*`) และ `AmplifyBranch`
- **Parameters:** `Prefix`, `Repository` (pattern ไม่รับ `.git`), `GitHubAccessToken` (NoEcho), `BranchName`, `AppRoot`, `ApiUrl`, `UserPoolId`, `UserPoolClientId`, `CognitoDomain` ค่า backend 4 ตัวหลังว่างได้ (รอบแรก) ซึ่งเงื่อนไข `HasBackend` ใช้ตัดสินว่าจะใส่ env `VITE_*` และเปิด auto build หรือไม่
- **Outputs:** `AppId`, `WebOrigin`

### `github-deploy-user.yaml` และ `github-oidc.yaml` — สิทธิ์ AWS ของ CI/CD
- `github-deploy-user.yaml`: `DeployUser` (IAM user) พร้อมนโยบายอัปเดตและ publish version ของ Lambda backend กับ trigger 4 ตัว (ทั้งชื่อ `-challenge` และชื่อสั้น) และเรียก backend ไม่สร้าง access key ใน template
- `github-oidc.yaml`: `GitHubOidcProvider` (สร้างตามเงื่อนไข) และ `DeployRole` ที่ GitHub assume ได้เฉพาะ repo และ branch ที่ระบุ ใช้สิทธิ์ชุดเดียวกัน

## 4. `deploy.ps1` — โครงสร้างภายใน

**ฟังก์ชันหลัก**

| ฟังก์ชัน | ทำอะไร |
|---|---|
| `Resolve-Aws`, `Invoke-Aws`, `Invoke-AwsQuiet` | เรียก AWS CLI; `Invoke-Aws` หยุดเมื่อล้ม, `Invoke-AwsQuiet` ใช้เมื่อความล้มเหลวคือคำตอบที่คาดไว้ (PowerShell 5.1 แปลง stderr เป็น error ที่หยุดสคริปต์) |
| `Read-SecretValue`, `Get-DbPassword`, `New-RandomPassword` | รับความลับจาก env หรือถามแบบไม่แสดงตัวอักษร; รหัสผ่านฐานข้อมูลเก็บใน SSM |
| `Get-StackOutputs`, `Test-StackExists` | อ่าน Outputs ของ stack และตรวจว่า stack มีอยู่ |
| `Build-Packages`, `New-Zip` | build zip ของ backend และ trigger (`npm ci` และ `tar.exe` เพราะ `Compress-Archive` ของ 5.1 ใช้ `\` ซึ่ง Lambda อ่านไม่ได้) |
| `Invoke-Migration` | เรียก Lambda ด้วย `{"action":"migrate"}` |
| `Test-Http`, `Test-SpaFallback`, `Invoke-SmokeTests`, `Wait-AmplifyJob` | smoke test (ของ API ตรวจ status; ของหน้าเว็บตรวจเนื้อหา เพราะ Amplify ตอบ 404 พร้อมแอป) และรอ build ของ Amplify |

**ลำดับในสคริปต์** (บล็อกตามที่เรียงอยู่ในไฟล์): build only → pre-checks → destroy → code only → inputs → build → Amplify รอบแรก → stack 1 → upload → stack 2 → Amplify รอบสอง → migrate → smoke test → summary โหมด `-BuildOnly`, `-Destroy` และ `-CodeOnly` ออกจากสคริปต์ (`return`) ก่อนถึงขั้นสร้างเต็ม

**ที่เก็บชั่วคราว:** `infra/.build/` (zip และ payload) และพารามิเตอร์ SSM `/<prefix>/deploy/db-password`

## 5. Workflow ของ GitHub Actions

| ไฟล์ | โครงสร้าง |
|---|---|
| `.github/workflows/deploy-backend.yml` | **ทำงานเมื่อ** push เข้า `main` (ที่แก้ `backend/` หรือ `database/`) หรือกดรันเอง (`workflow_dispatch` มี input `deploy_triggers` และ `migrate`) **ขั้นตอน:** job `test` (เทสต์ trigger ที่ไม่ใช้ฐานข้อมูล) → job `deploy`: ตรวจไฟล์ที่เปลี่ยน → build zip → ขอสิทธิ์ AWS (OIDC role ถ้ามีตัวแปร ไม่เช่นนั้น access key) → อัปเดต Lambda backend → อัปเดต trigger (ตามเงื่อนไข) → เตือนเรื่อง migration → migrate (เฉพาะกดเอง) → smoke test |
| `.github/workflows/validate-infra.yml` | job `cfn-lint` รัน `cfn-lint` กับ `infra/*.yaml` เมื่อ push (`main`, `develop`) หรือ pull request ที่แก้ `infra/` |

## 6. ข้อกำหนดของโค้ดในโฟลเดอร์นี้

- **ไฟล์ `.yaml` และ `.ps1` ต้องเป็น ASCII ล้วน** ข้อความภาษาไทยทำให้ AWS CLI และ PowerShell 5.1 บน Windows อ่านผิดเพี้ยน (ภาษาไทยใช้ได้ในไฟล์ `.md`)
- **ห้ามใช้ YAML anchor/alias** CloudFormation ไม่รองรับ (จึงเขียน method ของ API Gateway ซ้ำทีละตัว)
- **ห้ามฝังความลับในไฟล์** ใช้พารามิเตอร์ `NoEcho` หรือ SSM
- **ตั้งชื่อด้วย `Prefix`** ทุก resource ที่มีชื่อ เพื่อให้สร้างหลายชุดได้
- **ตรวจก่อน commit:** `cfn-lint infra/*.yaml` และ `aws cloudformation validate-template` (คำเตือน W1011 เรื่องรหัสผ่านเป็นพารามิเตอร์ ยอมรับได้เพราะ VPC ไม่มี NAT จึงเรียก Secrets Manager ไม่ได้)

## 7. เพิ่มหรือแก้ของใหม่ (แนวทาง)

| ต้องการ | แก้ที่ไหน |
|---|---|
| เพิ่มตัวแปร env ให้ Lambda backend | เพิ่ม Parameter (ถ้าเป็นค่าจากภายนอก) และบรรทัดใน `Environment.Variables` ของ `BackendFunction` ใน `app.yaml` และเพิ่ม override ใน `deploy.ps1` (ส่วน stack 2) |
| เพิ่ม route ของ API ที่อยู่นอก `/api/{proxy+}` | เพิ่ม `AWS::ApiGateway::Resource` และ `Method` ใน `app.yaml` แล้วใส่ชื่อ method ใน `DependsOn` ของ `ApiDeployment` (route ใต้ `/api/{proxy+}` เดิมไม่ต้องเพิ่ม) |
| เพิ่ม Lambda หรือ resource ใหม่ | เพิ่มใน `app.yaml` (ถ้าต้องใช้ VPC/ฐานข้อมูลให้ import ค่าจาก Exports ของ stack 1) แล้วเช็คจำนวนและ lint |
| เปลี่ยนขนาด RDS หรือเครือข่าย | แก้ Parameter/ค่าใน `network-data.yaml` (บางอย่างเช่น engine ทำให้ resource ถูกสร้างใหม่ ตรวจ change set ก่อน) |
| เพิ่มสิทธิ์ให้ CI/CD | แก้นโยบายใน `github-deploy-user.yaml` (และ `github-oidc.yaml` ให้ตรงกัน) แล้ว deploy ซ้ำ |
