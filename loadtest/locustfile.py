"""CS361 Cooperative Education - Locust load test (ข้อมูลทดสอบจาก loadtest/seed.sql เท่านั้น)

การกระทำ 3 อย่าง (สัดส่วน 4:4:2 = บันทึกข้อมูล 20%):
  list    GET /api/companies         หน้ารายการสถานประกอบการ (/student/companies)
  detail  GET /api/companies/{id}    หน้ารายละเอียดบริษัท (สุ่มเฉพาะบริษัท [LOADTEST])
  save    PUT /api/students/me       ยื่นสมัครแผนสหกิจศึกษา (/student/profile ปุ่ม "สมัครแผนสหกิจศึกษา")
          ใช้บัญชี lt.plan01–08 (รหัสสมมติ 6799999001–008) ครั้งแรกตั้งสถานะ "รอประกาศผล" ครั้งต่อไปเป็นการแก้ไข

Local (backend AUTH_MODE=development):
    export LOADTEST_PASSWORD='<DEV_AUTH_PASSWORD>'
    locust -f loadtest/locustfile.py --host http://localhost:5000

AWS test stack (Cognito CUSTOM_AUTH; อีเมล lt.plan01–08 ต้องอยู่ใน MOCK_LOGINS ของ verify-auth-challenge และ backend Lambda):
    export LOADTEST_PASSWORD='<MOCK_PASSWORD>'
    export COGNITO_REGION=<region> COGNITO_CLIENT_ID=<app client id>
    locust -f loadtest/locustfile.py --host https://<api-id>.execute-api.<region>.amazonaws.com/prod

เปิด http://localhost:8089 แล้วกด Start ผู้ใช้เพิ่มเป็นขั้นเอง 12 นาที (10 → 20 → 40 → 80)
ไม่เขียนรหัสผ่านหรือ token ลงไฟล์นี้ และห้ามยิงกับ Production
"""
import os
import random
import secrets

from gevent.lock import Semaphore
from locust import HttpUser, LoadTestShape, between, task
from locust.exception import StopUser

PASSWORD = os.environ.get("LOADTEST_PASSWORD", "")
COGNITO_REGION = os.environ.get("COGNITO_REGION", "")
COGNITO_CLIENT_ID = os.environ.get("COGNITO_CLIENT_ID", "")
ACCOUNTS = [a.strip() for a in os.environ.get("LOADTEST_USERS", "").split(",") if a.strip()] or [
    f"lt.plan{n:02d}@loadtest.example.test" for n in range(1, 9)
]

# วิชาตามเกณฑ์หลักสูตร 66 (backend/src/config/coopCriteria.js) เกรด C+ ขึ้นไปทุกวิชา → เฉลี่ยกลุ่ม ≥ 2.50 เสมอ
COMPLETED_66 = ["คพ.100", "คพ.101", "คพ.102", "คพ.111", "คพ.213", "คพ.251", "คพ.261"]
IN_PROGRESS_66 = ["คพ.180", "คพ.262"]
PASSING_GRADES = ["A", "B+", "B", "C+"]

# แชร์ระหว่าง virtual user: token ต่อบัญชี (ID token อายุ ~1 ชั่วโมง พอสำหรับรอบ 12 นาที) และรายการบริษัททดสอบ
_tokens = {}
_token_locks = {account: Semaphore() for account in ACCOUNTS}
_company_ids = []
_company_lock = Semaphore()
_next_account = 0


def _error_code(response):
    try:
        error = response.json().get("error") or {}
        # รูปแบบจาก errorHandler: {error: {code, message, details}} (ไม่มี SQL/secret)
        return f"{error.get('code')} {error.get('details') or error.get('message')}"
    except Exception:
        return response.text[:200]


class CoopStudent(HttpUser):
    wait_time = between(1, 3)

    def on_start(self):
        global _next_account
        if not PASSWORD:
            raise StopUser("ต้องตั้ง LOADTEST_PASSWORD (DEV_AUTH_PASSWORD หรือ MOCK_PASSWORD)")
        self.account = ACCOUNTS[_next_account % len(ACCOUNTS)]
        _next_account += 1
        self.headers = {"Authorization": f"Bearer {self._token()}"}
        self._load_companies()

        with self.client.get("/api/students/me", headers=self.headers, name="setup: students/me", catch_response=True) as res:
            if res.status_code != 200:
                res.failure(f"{self.account}: {res.status_code} {_error_code(res)}")
                raise StopUser()
            self.me = res.json()
        if self.me.get("qualification_locked"):
            # announced/selecting/application → แก้คุณสมบัติไม่ได้ PUT จะได้ 409 ให้ cleanup แล้ว seed ใหม่
            print(f"[warn] {self.account}: qualification_lock={self.me.get('qualification_lock')} PUT จะได้ 409")

    # ---- login ----
    def _token(self):
        with _token_locks[self.account]:
            if self.account not in _tokens:
                _tokens[self.account] = self._cognito_login() if COGNITO_CLIENT_ID else self._dev_login()
            return _tokens[self.account]

    def _dev_login(self):
        with self.client.post("/api/auth/login", json={"email": self.account, "password": PASSWORD},
                              name="login", catch_response=True) as res:
            if res.status_code != 200:
                res.failure(f"{self.account}: {res.status_code} (seed.sql รันแล้วหรือยัง / backend เป็น AUTH_MODE=development ไหม)")
                raise StopUser()
            return res.json()["token"]

    def _cognito(self, target, body, allow_not_found=False):
        # เรียก Cognito ตรงแบบเดียวกับหน้าเว็บ (ไม่ต้องติดตั้ง boto3)
        with self.client.post(
            f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/", json=body, name=f"cognito {target}",
            headers={"Content-Type": "application/x-amz-json-1.1",
                     "X-Amz-Target": f"AWSCognitoIdentityProviderService.{target}"},
            catch_response=True,
        ) as res:
            data = res.json() if res.content else {}
            if res.status_code == 200:
                return data
            kind = str(data.get("__type", res.status_code))
            if allow_not_found and "UserNotFoundException" in kind:
                res.success()
                return None
            res.failure(f"{self.account}: {kind}")
            raise StopUser()

    def _cognito_login(self):
        start = {"AuthFlow": "CUSTOM_AUTH", "ClientId": COGNITO_CLIENT_ID, "AuthParameters": {"USERNAME": self.account}}
        init = self._cognito("InitiateAuth", start, allow_not_found=True)
        if init is None:
            # ครั้งแรกยังไม่มีผู้ใช้ใน pool: SignUp ด้วยรหัสสุ่มที่ไม่ได้ใช้ (login จริงใช้ CUSTOM_AUTH) เหมือน get-tokens.mjs
            self._cognito("SignUp", {"ClientId": COGNITO_CLIENT_ID, "Username": self.account,
                                     "Password": f"Aa1!{secrets.token_hex(24)}"})
            init = self._cognito("InitiateAuth", start)
        result = self._cognito("RespondToAuthChallenge", {
            "ClientId": COGNITO_CLIENT_ID, "ChallengeName": "CUSTOM_CHALLENGE", "Session": init.get("Session"),
            "ChallengeResponses": {"USERNAME": init.get("ChallengeParameters", {}).get("USERNAME", self.account),
                                   "ANSWER": PASSWORD},
        })
        token = result.get("AuthenticationResult", {}).get("IdToken")
        if not token:
            print(f"[error] {self.account}: ไม่ได้ token (MOCK_PASSWORD หรือ MOCK_LOGINS ไม่ถูกต้อง)")
            raise StopUser()
        return token

    def _load_companies(self):
        with _company_lock:
            if _company_ids:
                return
            with self.client.get("/api/companies", name="setup: companies", catch_response=True) as res:
                rows = res.json().get("data", []) if res.status_code == 200 else []
                _company_ids.extend(c["id"] for c in rows if c.get("name", "").startswith("[LOADTEST]"))
                if not _company_ids:
                    res.failure("ไม่พบบริษัท [LOADTEST] — รัน loadtest/seed.sql ก่อน")
                    raise StopUser()

    # ---- 3 การกระทำ ----
    @task(4)
    def list_page(self):
        self.client.get("/api/companies", name="list: GET /api/companies")

    @task(4)
    def detail_page(self):
        self.client.get(f"/api/companies/{random.choice(_company_ids)}", name="detail: GET /api/companies/[id]")

    @task(2)
    def save(self):
        n = random.randint(1, 999)
        body = {
            # คุณสมบัติ (ตรวจซ้ำที่ backend ด้วย qualificationChecks)
            "gpax": random.randint(275, 400) / 100,
            "curriculum": "66",
            "course_grades": {**{c: random.choice(PASSING_GRADES) for c in COMPLETED_66},
                              **{c: "IP" for c in IN_PROGRESS_66}},
            "declarations": {"mustPass": True, "discipline": True, "accept": True},
            # key เอกสารสมมติจาก seed (ไม่อัปโหลดไฟล์จริงระหว่าง load test)
            "transcript_s3_key": self.me["transcript_s3_key"],
            "cv_s3_key": self.me["cv_s3_key"],
            "photo_s3_key": self.me["photo_s3_key"],
            # ข้อมูลส่วนตัวสมมติ
            "phone": self.me.get("phone") or "0890001000",
            "address": f"ที่อยู่สมมติสำหรับ Load Test เลขที่ {n}",
            "major": random.choice(["CIS", "ACS"]),
            "guardian_name": "ผู้ปกครองสมมติ",
            "guardian_relation": "บิดา",
            "guardian_address": f"ที่อยู่ผู้ปกครองสมมติ เลขที่ {n}",
            "guardian_phone": f"0890002{n:03d}",
        }
        with self.client.put("/api/students/me", json=body, headers=self.headers,
                             name="save: PUT /api/students/me", catch_response=True) as res:
            if res.status_code == 200 and res.json().get("profile_status") == "pending":
                res.success()
            elif res.status_code == 200:
                res.failure(f"profile_status={res.json().get('profile_status')} (คาดว่า pending)")
            else:
                # 422 INELIGIBLE/VALIDATION_ERROR, 409 CONFLICT (ถูกล็อก), 429 API Gateway throttling
                res.failure(f"{res.status_code} {_error_code(res)}")


class StepLoad(LoadTestShape):
    # (วินาทีที่สิ้นสุด, จำนวนผู้ใช้): 10/20/40 คน ขั้นละ 2 นาที แล้ว 80 คน 6 นาที รวม 12 นาที
    steps = [(120, 10), (240, 20), (360, 40), (720, 80)]

    def tick(self):
        t = self.get_run_time()
        for end, users in self.steps:
            if t < end:
                return (users, 5)
        return None
