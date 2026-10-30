import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { rm } from 'node:fs/promises';
import app from '../src/app.js';
import { getPool, query, transaction } from '../src/config/db.js';
import { issueDevelopmentToken } from '../src/middlewares/auth.js';

let server, base, accounts = {}, positions, term, studentUser, student;
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type /Catalog>>endobj\n%%EOF');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSAAAAABJRU5ErkJggg==', 'base64');
const personalInfo = { address: '99 ถ.พหลโยธิน คลองหลวง ปทุมธานี', major: 'CIS', guardian_name: 'สมชาย ใจดี', guardian_relation: 'บิดา', guardian_address: '1 ถ.สุขุมวิท กรุงเทพฯ', guardian_phone: '0811111111' };
const qualification66 = {
  curriculum: '66',
  course_grades: { 'คพ.100':'C+', 'คพ.101':'C+', 'คพ.102':'C+', 'คพ.111':'C+', 'คพ.216':'C+', 'คพ.251':'C+', 'คพ.261':'C+', 'คพ.180':'IP', 'คพ.331':'B' },
  declarations: { mustPass:true, discipline:true, accept:true },
};

async function request(path, token, { method = 'GET', body, raw, headers = {} } = {}) {
  const response = await fetch(base + path, { method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const json = response.status === 204 ? null : await response.json();
  return { status: response.status, body: json, requestId: response.headers.get('x-request-id') };
}
async function ok(path, token, options, expected = 200) {
  const result = await request(path, token, options);
  assert.equal(result.status, expected, JSON.stringify(result.body));
  return result.body;
}
async function upload(token, kind) {
  return ok(`/documents?kind=${kind}`, token, { method: 'POST', raw: pdf, headers: { 'Content-Type': 'application/pdf' } }, 201);
}

before(async () => {
  assert.match(process.env.DB_NAME, /^cs361_api_test_/, 'Refuse to test against application DB');
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}/api`;
  for (const [name, email] of Object.entries({ staff: 'staff.v3@tu.ac.th', advisor: 'advisor.v3@tu.ac.th', otherAdvisor: 'advisor.other.v3@tu.ac.th', company: 'company.v3@example.test', otherCompany: 'company.other.v3@example.test', student: 'student1.v3@dome.tu.ac.th', otherStudent: 'student2.v3@dome.tu.ac.th' })) {
    accounts[name] = await ok('/auth/login', null, { method: 'POST', body: { email, password: process.env.DEV_AUTH_PASSWORD } });
  }
  term = await ok('/terms/active', accounts.staff.token);
  // Make the test independent of the calendar while retaining real date checks.
  await query("UPDATE terms SET plan_open_at=current_date-1,plan_close_at=current_date+30 WHERE term_id=$1", [term.term_id]);
  const company = await ok('/companies', accounts.staff.token, { method: 'POST', body: { name: 'Integration Company' } }, 201);
  positions = [];
  for (let i = 0; i < 5; i++) positions.push(await ok('/positions', accounts.staff.token, { method: 'POST', body: { company_id: company.company_id, name: `Test position ${i}`, quota: 1, term_id: null } }, 201));
  studentUser = await ok('/users', accounts.staff.token, { method: 'POST', body: { username: '6609619999', th_name: 'Integration Student', en_name: 'Integration Student', email: 'integration@example.test', role: 'student', advisor_id: accounts.advisor.user.user_id } }, 201);
  student = await ok('/auth/login', null, { method: 'POST', body: { email: studentUser.email, password: process.env.DEV_AUTH_PASSWORD } });
  // The integration company gets its own coordinator, separate from seeded companies.
  const coordinator = await ok('/users', accounts.staff.token, { method: 'POST', body: { username: 'integration.company', th_name: 'Coordinator', en_name: 'Coordinator', email: 'integration.company@example.test', role: 'company', company_id: company.company_id } }, 201);
  accounts.integrationCompany = await ok('/auth/login', null, { method: 'POST', body: { email: coordinator.email, password: process.env.DEV_AUTH_PASSWORD } });
});

after(async () => {
  if (server) { server.close(); await once(server, 'close'); }
  await (await getPool()).end();
  // This directory is dedicated to this integration suite, not app uploads.
  if (/^\/tmp\/\.?cs361_api_test_[a-f0-9]+_uploads$/.test(process.env.UPLOAD_DIR)) await rm(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

test('public company API, real users, and consistent error envelopes', async () => {
  const publicData = await ok('/companies');
  assert.ok(publicData.total >= 104);
  const result = await request('/users');
  assert.equal(result.status, 401);
  assert.equal(result.body.error.code, 'UNAUTHENTICATED');
  assert.equal(result.body.error.request_id, result.requestId);
  const users = await ok('/users', accounts.staff.token);
  assert.equal(users.filter((u) => u.auth_provider === 'dev' && u.username.startsWith('v3.')).length, 5);
  assert.ok(!('cognito_sub' in users[0]));
  assert.equal((await request('/users', student.token)).status, 403);
  assert.equal((await request('/users', accounts.advisor.token)).status, 403);
  // Duplicate emails would make both accounts unable to log in.
  assert.equal((await request(`/users/${accounts.otherCompany.user.user_id}`, accounts.staff.token, { method: 'PUT', body: { email: 'Company.V3@example.test' } })).status, 409);
  assert.equal((await request('/users', accounts.staff.token, { method: 'POST', body: { username: 'dup.email', th_name: 'ซ้ำ', en_name: 'Dup', email: 'staff.v3@tu.ac.th', role: 'staff' } })).status, 409);
  assert.equal((await ok(`/users/${accounts.otherCompany.user.user_id}`, accounts.staff.token, { method: 'PUT', body: { email: 'company.other.v3@example.test' } })).email, 'company.other.v3@example.test', 'Keeping your own email is allowed');
});

test('wrong password, tampered/expired tokens, disabled accounts and forged roles are rejected', async () => {
  assert.equal((await request('/auth/login', null, { method: 'POST', body: { email: studentUser.email, password: 'wrong' } })).status, 401);
  assert.equal((await request('/users', `${student.token}x`)).status, 401);
  assert.equal((await request('/auth/me', issueDevelopmentToken(studentUser.user_id, -1))).status, 401);
  assert.equal((await request('/users', student.token, { headers: { 'X-User-Role': 'staff', 'X-User-ID': String(accounts.staff.user.user_id) } })).status, 403);
  await ok(`/users/${studentUser.user_id}`, accounts.staff.token, { method: 'PATCH', body: { is_active: false } });
  assert.equal((await request('/auth/me', student.token)).status, 403);
  await ok(`/users/${studentUser.user_id}`, accounts.staff.token, { method: 'PATCH', body: { is_active: true } });
  assert.equal((await request(`/users/${accounts.staff.user.user_id}`, accounts.staff.token, { method: 'PATCH', body: { is_active: false } })).status, 409);
  const mode = process.env.AUTH_MODE, nodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  assert.equal((await request('/auth/login', null, { method: 'POST', body: {} })).status, 404);
  process.env.AUTH_MODE = 'cognito';
  assert.equal((await request('/users', student.token)).status, 503);
  process.env.AUTH_MODE = mode; process.env.NODE_ENV = nodeEnv;
});

test('local login verifies university accounts with the TU API: CS students are created once, staff must be registered', async () => {
  const realFetch = globalThis.fetch, previousKey = process.env.TU_API_KEY, tuCalls = [];
  let tuReply = { status: 200, body: {} };
  // Mock only TU; requests to this test server still use the real fetch.
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('https://restapi.tu.ac.th/')) return realFetch(url, init);
    tuCalls.push(JSON.parse(init.body));
    return new Response(JSON.stringify(tuReply.body), { status: tuReply.status });
  };
  const login = (email, password = 'tu-secret') => request('/auth/login', null, { method: 'POST', body: { email, password } });
  const student = { status: true, type: 'student', username: '6409615555', displayname_th: 'นักศึกษา ทียู', displayname_en: 'TU Student', email: 'tu.student@dome.tu.ac.th' };
  try {
    delete process.env.TU_API_KEY;
    assert.equal((await login('tu.student@dome.tu.ac.th')).body.error.code, 'AUTH_NOT_CONFIGURED');
    process.env.TU_API_KEY = 'integration-key';

    // Name-based university email: TU confirms the student ID, which becomes the username.
    tuReply = { status: 200, body: student };
    const first = await login(' Tu.Student@DOME.tu.ac.th ');
    assert.equal(first.status, 200, JSON.stringify(first.body));
    assert.deepEqual(tuCalls.at(-1), { UserName: 'tu.student', PassWord: 'tu-secret' });
    assert.equal(first.body.user.username, '6409615555'); assert.equal(first.body.user.role, 'student');
    assert.equal(first.body.user.auth_provider, 'tu'); assert.equal(first.body.user.email, 'tu.student@dome.tu.ac.th');
    assert.equal(first.body.user.th_name, 'นักศึกษา ทียู'); assert.equal(first.body.user.curriculum, '61');
    assert.equal((await ok('/auth/me', first.body.token)).user_id, first.body.user.user_id);
    assert.equal((await login('6409615555')).body.user.user_id, first.body.user.user_id, 'student ID login reuses the account');
    assert.equal((await query("SELECT count(*)::int AS n FROM users WHERE username='6409615555'")).rows[0].n, 1);

    tuReply = { status: 200, body: { status: true, type: 'student', username: '6709655555' } };
    const newer = await login('new.student@dome.tu.ac.th');
    assert.equal(newer.body.user.curriculum, '66'); assert.equal(newer.body.user.email, 'new.student@dome.tu.ac.th');
    assert.equal(newer.body.user.th_name, '6709655555', 'Without TU names the student ID is a placeholder');
    tuReply = { status: 200, body: { status: true, type: 'student', username: '6709655555', displayname_th: 'นักศึกษา ใหม่', displayname_en: 'New Student' } };
    const named = (await login('6709655555')).body.user;
    assert.equal(named.th_name, 'นักศึกษา ใหม่'); assert.equal(named.en_name, 'New Student');

    tuReply = { status: 400, body: { status: false, message: 'Password incorrect' } };
    assert.equal((await login('tu.student@dome.tu.ac.th', 'wrong')).status, 401);
    tuReply = { status: 503, body: {} };
    assert.equal((await login('tu.student@dome.tu.ac.th')).body.error.code, 'TU_UNAVAILABLE');
    tuReply = { status: 403, body: { status: false, error: 'Authentication failed due to the following reason: invalid token.' } };
    assert.equal((await login('6409615555')).body.error.code, 'TU_KEY_INVALID');

    // Other majors: rejected after TU, or before TU when the ID is typed directly.
    tuReply = { status: 200, body: { status: true, type: 'student', username: '6409625555' } };
    assert.equal((await login('other.major@dome.tu.ac.th')).body.error.code, 'NOT_CS_STUDENT');
    let calls = tuCalls.length;
    assert.equal((await login('6409625555')).body.error.code, 'NOT_CS_STUDENT');
    assert.equal(tuCalls.length, calls);

    // Advisors/staff: TU proves identity, the users table decides access (username or email).
    tuReply = { status: 200, body: { status: true, type: 'employee', username: 'real.advisor', email: 'Real.Advisor@tu.ac.th' } };
    assert.equal((await login('real.advisor@tu.ac.th')).body.error.code, 'NOT_REGISTERED');
    const advisor = await ok('/users', accounts.staff.token, { method: 'POST', body: { username: 'advisor-registered', th_name: 'อาจารย์จริง', en_name: 'Real Advisor', email: 'real.advisor@tu.ac.th', role: 'advisor' } }, 201);
    assert.equal((await login('real.advisor@tu.ac.th')).body.user.user_id, advisor.user_id);
    tuReply = { status: 200, body: { status: true, type: 'employee', username: 'real.staff' } };
    const staff = await ok('/users', accounts.staff.token, { method: 'POST', body: { username: 'real.staff', th_name: 'เจ้าหน้าที่จริง', en_name: 'Real Staff', email: 'office@example.test', role: 'staff' } }, 201);
    assert.equal((await login('real.staff')).body.user.user_id, staff.user_id);
    await ok(`/users/${staff.user_id}`, accounts.staff.token, { method: 'PATCH', body: { is_active: false } });
    assert.equal((await login('real.staff')).body.error.code, 'NOT_REGISTERED');
    // A TU employee can never claim a student or company account.
    tuReply = { status: 200, body: { status: true, type: 'employee', username: 'someone', email: 'company.v3@example.test' } };
    assert.equal((await login('someone@tu.ac.th')).body.error.code, 'NOT_REGISTERED');

    // Seeded mock accounts keep using DEV_AUTH_PASSWORD without calling TU.
    calls = tuCalls.length;
    for (const email of ['student1.v3@dome.tu.ac.th', 'staff.v3@tu.ac.th', 'v3.staff', '6609610031', 'company.v3@example.test']) {
      assert.equal((await login(email, process.env.DEV_AUTH_PASSWORD)).status, 200, email);
    }
    assert.equal(tuCalls.length, calls);
    assert.equal((await login('company.v3@example.test', 'wrong')).status, 401);
  } finally {
    globalThis.fetch = realFetch;
    if (previousKey === undefined) delete process.env.TU_API_KEY; else process.env.TU_API_KEY = previousKey;
  }
});

test('request validation rejects malformed JSON, booleans as IDs, invalid dates and mass assignment', async () => {
  assert.equal((await request('/users', accounts.staff.token, { method: 'POST', raw: '{', headers: { 'Content-Type': 'application/json' } })).body.error.code, 'INVALID_JSON');
  assert.equal((await request('/positions', accounts.staff.token, { method: 'POST', body: { company_id: true, name: 'Invalid' } })).status, 422);
  assert.equal((await request('/terms', accounts.staff.token, { method: 'POST', body: { code: '1/2570', plan_open_at: '2027-02-30', plan_close_at: '2027-03-31', coop_start: '2027-04-01', coop_end: '2027-08-01' } })).status, 422);
  assert.equal((await request('/students/me', student.token, { method: 'PUT', body: { gpax: 4, role: 'staff' } })).status, 422);
  assert.equal((await request('/students/me', student.token, { method: 'PUT', body: { gpax: '3.5' } })).status, 422);
  assert.equal((await request('/students/me', student.token, { method: 'PUT', body: { gpax: 3.999 } })).status, 422);
  assert.equal((await request('/students/me', student.token, { method: 'PUT', body: { advisor_id: accounts.otherAdvisor.user.user_id } })).status, 422);
});

test('student profile, PDF upload, server-side eligibility and cross-student ownership', async () => {
  const resume = await upload(student.token, 'resume');
  assert.equal((await request('/applications', student.token, { method: 'POST', body: { position_id: positions[0].position_id, resume_s3_key: resume.key } })).body.error.code, 'INELIGIBLE');
  const transcript = await upload(student.token, 'transcript');
  assert.equal((await request('/documents?kind=resume', student.token, { method: 'POST', raw: Buffer.from('fake PDF'), headers: { 'Content-Type': 'application/pdf' } })).status, 422);
  const before = await ok('/students/me', student.token);
  const incomplete = await request('/students/me', student.token, { method: 'PUT', body: { gpax: 2.74, phone: '0812345678', transcript_s3_key: transcript.key } });
  assert.equal(incomplete.status, 422);
  assert.equal(incomplete.body.error.code, 'INELIGIBLE');
  assert.ok(incomplete.body.error.details.qualification.length > 1);
  assert.deepEqual(await ok('/students/me', student.token), before, 'Invalid save must not write grades, documents or phone');
  assert.equal((await request('/students/me', student.token, { method: 'PUT', body: { phone: '0812345678' } })).status, 422);
  // Staff can maintain records even when a student is ineligible; submission still rejects them.
  await ok(`/students/${studentUser.student_id}`, accounts.staff.token, { method: 'PUT', body: { gpax: 2.74, transcript_s3_key: transcript.key } });
  assert.equal((await request('/applications', student.token, { method: 'POST', body: { position_id: positions[0].position_id, resume_s3_key: resume.key } })).status, 422);
  // ข้อมูลส่วนตัว (CV, รูป, ที่อยู่, กลุ่มวิชาเอก, ผู้ปกครอง) ต้องครบก่อนบันทึก
  const cv = await upload(student.token, 'cv');
  assert.equal((await request('/documents?kind=photo', student.token, { method: 'POST', raw: pdf, headers: { 'Content-Type': 'image/png' } })).status, 422);
  const photo = await ok('/documents?kind=photo', student.token, { method: 'POST', raw: png, headers: { 'Content-Type': 'image/png' } }, 201);
  assert.match(photo.key, /\/photo-[a-f0-9-]+\.png$/);
  const qualified = { ...qualification66, gpax: 2.75, phone: '0812345678', transcript_s3_key: transcript.key };
  const beforeInfo = await ok('/students/me', student.token);
  const missingInfo = await request('/students/me', student.token, { method: 'PUT', body: { ...qualified, ...personalInfo, guardian_name: '', cv_s3_key: cv.key } });
  assert.equal(missingInfo.status, 422);
  assert.deepEqual(missingInfo.body.error.details.profile, ['กรุณาอัปโหลดรูปนักศึกษา', 'กรุณากรอกชื่อ-นามสกุลผู้ปกครอง']);
  assert.deepEqual(await ok('/students/me', student.token), beforeInfo, 'Incomplete personal info must not save anything');
  for (const invalid of [{ major: 'CS' }, { guardian_phone: 'abc' }, { cv_s3_key: transcript.key }, { photo_s3_key: cv.key }]) {
    assert.equal((await request('/students/me', student.token, { method: 'PUT', body: { ...qualified, ...personalInfo, cv_s3_key: cv.key, photo_s3_key: photo.key, ...invalid } })).status, 422, JSON.stringify(invalid));
  }
  const saved = await ok('/students/me', student.token, { method: 'PUT', body: { ...qualified, ...personalInfo, cv_s3_key: cv.key, photo_s3_key: photo.key } });
  assert.equal(saved.major, 'CIS'); assert.equal(saved.guardian_relation, 'บิดา'); assert.equal(saved.cv_s3_key, cv.key);
  assert.equal((await request('/students/me', student.token, { method: 'PUT', body: { address: null } })).status, 422, 'Required personal info cannot be cleared');
  const image = await fetch(`${base}/documents/${encodeURIComponent(photo.key)}`, { headers: { Authorization: `Bearer ${accounts.staff.token}` } });
  assert.equal(image.status, 200); assert.match(image.headers.get('content-type'), /^image\/png/);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  assert.equal((await fetch(`${base}/documents/${encodeURIComponent(cv.key)}`, { headers: { Authorization: `Bearer ${accounts.otherStudent.token}` } })).status, 403);
  assert.equal((await fetch(`${base}/documents/${encodeURIComponent(cv.key)}`, { headers: { Authorization: `Bearer ${accounts.advisor.token}` } })).status, 200);
  assert.equal((await request(`/students/${studentUser.student_id}`, accounts.otherStudent.token)).status, 403);
  assert.equal((await request(`/students/${studentUser.student_id}`, accounts.otherStudent.token, { method: 'PUT', body: { gpax: 4 } })).status, 403);
  assert.equal((await request(`/advisor/students/${studentUser.student_id}`, accounts.otherAdvisor.token)).status, 403);
  const forbidden = await fetch(base + transcript.url, { headers: { Authorization: `Bearer ${accounts.otherStudent.token}` } });
  assert.equal(forbidden.status, 403);
  const permitted = await fetch(base + transcript.url, { headers: { Authorization: `Bearer ${accounts.advisor.token}` } });
  assert.equal(permitted.status, 200);
  assert.match(permitted.headers.get('content-type'), /^application\/pdf/);
  assert.match(permitted.headers.get('content-disposition'), /^inline;/);
  assert.equal(permitted.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(Buffer.from(await permitted.arrayBuffer()), pdf, 'PDF preview must return the original uploaded bytes');
  assert.equal((await fetch(base + transcript.url)).status, 401, 'Preview still requires authentication');
  for (const token of [student.token, accounts.staff.token]) {
    const preview = await fetch(base + transcript.url, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(preview.status, 200, 'Owner and staff must be able to preview PDFs from a hidden upload directory');
    assert.deepEqual(Buffer.from(await preview.arrayBuffer()), pdf);
  }
  const absent = `/documents/${encodeURIComponent(`${studentUser.user_id}/transcript-00000000-0000-4000-8000-000000000000.pdf`)}`;
  assert.equal((await request(absent, student.token)).status, 404);
  assert.equal((await request(`/documents/${encodeURIComponent('../.env')}`, student.token)).status, 404);
  const result = await ok('/auth/me', student.token);
  assert.equal(result.gpax, 2.75); assert.equal(result.phone, '0812345678');
});

test('profile saves require every eligibility condition, reject partial bypasses atomically, and accept both curricula', async () => {
  const baseline = await ok('/students/me', student.token);
  const missingCourse = { ...baseline.course_grades }; delete missingCourse['คพ.101'];
  const missingProgress = { ...baseline.course_grades }; delete missingProgress['คพ.180'];
  const lowAverage = Object.fromEntries(Object.keys(baseline.course_grades).map((code) => [code, 'C']));
  const invalidUpdates = [
    { gpax: 2.74 }, { gpax: null }, { gpax: 4.01 }, { gpax: 3.999 }, { curriculum: null },
    { course_grades: {} }, { course_grades: missingCourse }, { course_grades: missingProgress },
    { course_grades: { ...baseline.course_grades, 'คพ.101':'IP' } }, { course_grades: lowAverage },
    ...['mustPass', 'discipline', 'accept'].map((key) => ({ declarations: { ...baseline.declarations, [key]:false } })),
    { transcript_s3_key: null }, { curriculum: '61' }, { phone: 'invalid' },
  ];
  for (const invalid of invalidUpdates) {
    // Both student update routes must merge with existing data and validate before committing anything.
    const result = await request(`/students/${studentUser.student_id}`, student.token, { method:'PUT', body: { phone:'0900000000', ...invalid } });
    assert.equal(result.status, 422, JSON.stringify(invalid));
    assert.deepEqual(await ok('/students/me', student.token), baseline, 'Rejected update must leave the entire profile unchanged');
  }
  const grades61 = { 'คพ.101':'C+', 'คพ.102':'C+', 'คพ.111':'C+', 'คพ.213':'C+', 'คพ.251':'C+', 'คพ.264':'C+', 'คพ.384':'IP', 'คพ.348':'IP' };
  // หลักสูตรต้องตรงกับปีรหัส: รหัส 64 ใช้หลักสูตร 61 เท่านั้น
  await ok(`/users/${studentUser.user_id}`, accounts.staff.token, { method:'PATCH', body:{ username:'6409619999' } });
  const switched = await ok('/students/me', student.token, { method:'PUT', body:{curriculum:'61',course_grades:grades61} });
  assert.deepEqual(switched.course_grades, grades61, 'Average exactly 2.50 and alternate courses must pass');
  assert.equal((await request('/students/me', student.token, { method:'PUT', body:qualification66 })).status, 422);
  await ok(`/users/${studentUser.user_id}`, accounts.staff.token, { method:'PATCH', body:{ username:'6609619999' } });
  await ok('/students/me', student.token, { method:'PUT', body:qualification66 });
  // ชั้นปี 1–2 ยังสมัครไม่ได้ (คำนวณจากปีการศึกษาปัจจุบัน)
  const firstYear = String((new Date().getFullYear() + 543 - (new Date().getMonth() < 7 ? 1 : 0)) % 100) + '09619999';
  await ok(`/users/${studentUser.user_id}`, accounts.staff.token, { method:'PATCH', body:{ username:firstYear } });
  const young = await request('/students/me', student.token, { method:'PUT', body:{ gpax:3.5 } });
  assert.equal(young.status, 422); assert.ok(young.body.error.details.qualification.some((label) => label.includes('ชั้นปีที่ 3')));
  await ok(`/users/${studentUser.user_id}`, accounts.staff.token, { method:'PATCH', body:{ username:'6609619999' } });
});

test('course grades and declarations persist, reload through auth, and respect student/advisor ownership', async () => {
  const grades = { 'คพ.100':'A', 'คพ.101':'B+', 'คพ.102':'B', 'คพ.111':'A', 'คพ.216':'B', 'คพ.251':'A', 'คพ.261':'C+', 'คพ.180':'IP', 'คพ.331':'B' };
  const declarations = { mustPass:true, discipline:true, accept:true };
  const body = { curriculum:'66', course_grades:grades, declarations };
  const saved = await ok('/students/me', student.token, { method:'PUT', body });
  assert.equal(saved.curriculum, '66'); assert.deepEqual(saved.course_grades, grades); assert.deepEqual(saved.declarations, declarations);
  const reloaded = await ok('/students/me', student.token);
  assert.deepEqual(reloaded.course_grades, grades);
  const session = await ok('/auth/login', null, { method:'POST', body:{email:studentUser.email,password:process.env.DEV_AUTH_PASSWORD} });
  assert.deepEqual(session.user.course_grades, grades);
  const advisor = await ok(`/advisor/students/${studentUser.student_id}`, accounts.advisor.token);
  assert.deepEqual(advisor.course_grades, grades);
  assert.equal((await request(`/students/${studentUser.student_id}`, accounts.otherStudent.token, { method:'PUT', body })).status, 403);
  for (const invalid of [
    {curriculum:'67'}, {course_grades:[]}, {course_grades:{'คพ.100':4}}, {course_grades:{'คพ.100':'Z'}},
    {course_grades:{role:'A'}}, {declarations:{accept:'true'}}, {declarations:{is_active:true}},
  ]) assert.equal((await request('/students/me', student.token, { method:'PUT', body:invalid })).status, 422);
  assert.deepEqual((await ok('/students/me', student.token)).course_grades, grades);
  const { rows } = await query('SELECT curriculum,course_grades,declarations FROM students WHERE student_id=$1', [studentUser.student_id]);
  assert.deepEqual(rows[0], body);
});

test('company logo uploads persist through profile save, respect ownership, and serve public images safely', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aSAAAAABJRU5ErkJggg==', 'base64');
  const options = { method:'POST', raw:png, headers:{'Content-Type':'image/png'} };
  assert.equal((await request('/company/logo', null, options)).status, 401);
  assert.equal((await request('/company/logo', accounts.staff.token, options)).status, 403);
  assert.equal((await request('/company/logo', accounts.integrationCompany.token, { ...options, raw:pdf })).status, 422);
  assert.equal((await request('/company/logo', accounts.integrationCompany.token, { ...options, raw:Buffer.alloc(2 * 1024 * 1024 + 1) })).status, 413);
  const upload = await ok('/company/logo', accounts.integrationCompany.token, options, 201);
  const profile = await ok('/company/profile', accounts.integrationCompany.token);
  assert.match(upload.url, new RegExp(`^/company-logos/${profile.company_id}/logo-`));
  assert.equal((await request(upload.url)).status, 404, 'Uncommitted logo uploads are not published');
  assert.equal((await request(`/companies/${profile.company_id}`, accounts.otherCompany.token, {method:'PUT',body:{logo:upload.url}})).status, 403);
  await ok('/company/profile', accounts.integrationCompany.token, {method:'PUT',body:{logo:upload.url}});
  assert.equal((await ok('/company/profile', accounts.integrationCompany.token)).logo, upload.url);
  const image = await fetch(base + upload.url);
  assert.equal(image.status, 200);
  assert.match(image.headers.get('content-type'), /^image\/png/);
  assert.equal(image.headers.get('x-content-type-options'), 'nosniff');
  assert.match(image.headers.get('content-security-policy'), /^sandbox;/);
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), png);
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="orange"/></svg>');
  const vector = await ok('/company/logo', accounts.integrationCompany.token, {method:'POST',raw:svg,headers:{'Content-Type':'image/svg+xml'}}, 201);
  await ok('/company/profile', accounts.integrationCompany.token, {method:'PUT',body:{logo:vector.url}});
  assert.equal((await fetch(base + vector.url)).status, 200);
  assert.equal((await request(upload.url)).status, 404, 'Only the currently saved logo is served');
  assert.equal((await request(`/company-logos/${profile.company_id}/${encodeURIComponent('../.env')}`)).status, 404);
});

test('company details PDF is optional, owned by the company, and public only after it is saved', async () => {
  const options = { method:'POST', raw:pdf, headers:{'Content-Type':'application/pdf'} };
  assert.equal((await request('/company/details-file', null, options)).status, 401);
  assert.equal((await request('/company/details-file', accounts.staff.token, options)).status, 403);
  assert.equal((await request('/company/details-file', accounts.integrationCompany.token, { ...options, raw:Buffer.from('not a pdf') })).status, 422);
  const profile = await ok('/company/profile', accounts.integrationCompany.token);
  const upload = await ok('/company/details-file', accounts.integrationCompany.token, options, 201);
  const other = await ok('/company/details-file', accounts.otherCompany.token, options, 201);
  assert.equal((await request(`/companies/${profile.company_id}/details-file`)).status, 404, 'Uncommitted uploads are not published');
  assert.equal((await request('/company/profile', accounts.integrationCompany.token, {method:'PUT',body:{additional_file:other.key}})).status, 422);
  await ok('/company/profile', accounts.integrationCompany.token, {method:'PUT',body:{allowance:'300 บาท/วัน', additional_info:'มีที่พัก', additional_file:upload.key}});
  const company = await ok(`/companies/${profile.company_id}`);
  assert.equal(company.allowance, '300 บาท/วัน');
  assert.equal(company.has_additional_file, true);
  assert.equal(company.additional_file, undefined, 'Storage key is not exposed publicly');
  const file = await fetch(`${base}/companies/${profile.company_id}/details-file`);
  assert.equal(file.status, 200);
  assert.match(file.headers.get('content-type'), /^application\/pdf/);
  assert.deepEqual(Buffer.from(await file.arrayBuffer()), pdf);
  await ok('/company/profile', accounts.integrationCompany.token, {method:'PUT',body:{additional_file:null}});
  assert.equal((await request(`/companies/${profile.company_id}/details-file`)).status, 404);
});

test('saving the profile waits for the co-op plan result; only passed students apply; results lock qualifications; profile CV is the default resume; any supervisor approves', async () => {
  const studentPath = `/students/${studentUser.student_id}`;
  const position = await ok('/positions', accounts.staff.token, { method: 'POST', body: { company_id: positions[0].company_id, name: 'Review flow position', quota: 1, term_id: null } }, 201);
  // ไม่ส่ง resume_s3_key = ใช้ CV จากข้อมูลส่วนตัว
  const body = { position_id: position.position_id };
  const saved = await ok('/students/me', student.token);
  assert.equal(saved.profile_status, 'pending', 'A saved profile waits for the announcement');
  assert.equal(saved.coop_result, null);
  const blocked = await request('/applications', student.token, { method: 'POST', body });
  assert.equal(blocked.status, 422);
  assert.equal(blocked.body.error.code, 'COOP_NOT_PASSED');
  assert.equal(blocked.body.error.details.review.length, 1);
  assert.equal((await request(`${studentPath}/profile-review`, accounts.staff.token, { method: 'POST', body: { status: 'verified' } })).status, 404, 'Staff profile review was removed');
  assert.equal((await request(`${studentPath}/conduct-review`, accounts.advisor.token, { method: 'POST', body: { status: 'certified' } })).status, 404, 'Conduct certification was removed');

  // Staff announce the result; students and advisors cannot.
  assert.equal((await request(`${studentPath}/coop-result`, accounts.advisor.token, { method: 'PUT', body: { coop_result: 'passed' } })).status, 403);
  assert.equal((await request(`${studentPath}/coop-result`, accounts.staff.token, { method: 'PUT', body: { coop_result: 'maybe' } })).status, 422);
  assert.equal((await request(`${studentPath}/coop-result`, accounts.staff.token, { method: 'PUT', body: {} })).status, 422);
  assert.equal((await request('/students/me', student.token, { method: 'PUT', body: { coop_result: 'passed' } })).status, 422, 'Students cannot set their own result');
  const unsaved = await ok('/users', accounts.staff.token, { method: 'POST', body: { username: '6609619998', th_name: 'Unsaved Student', en_name: 'Unsaved Student', email: 'unsaved@example.test', role: 'student' } }, 201);
  assert.equal((await request(`/students/${unsaved.student_id}/coop-result`, accounts.staff.token, { method: 'PUT', body: { coop_result: 'passed' } })).status, 409, 'No result before the profile is saved');

  const failed = await ok(`${studentPath}/coop-result`, accounts.staff.token, { method: 'PUT', body: { coop_result: 'failed' } });
  assert.equal(failed.coop_result, 'failed'); assert.ok(failed.coop_result_at); assert.equal(failed.qualification_locked, true);
  assert.equal((await request('/applications', student.token, { method: 'POST', body })).body.error.code, 'COOP_NOT_PASSED', 'Failed students cannot apply');
  // After the announcement qualifications are frozen; contact/personal edits remain available.
  assert.equal((await request('/students/me', student.token, { method: 'PUT', body: { gpax: 2.8 } })).status, 409);
  assert.equal((await ok('/students/me', student.token, { method: 'PUT', body: { phone: '0812345670', guardian_relation: 'มารดา' } })).coop_result, 'failed');
  const reset = await ok(`${studentPath}/coop-result`, accounts.staff.token, { method: 'PUT', body: { coop_result: null } });
  assert.equal(reset.coop_result, null); assert.equal(reset.coop_result_at, null); assert.equal(reset.qualification_locked, false);
  assert.equal((await ok('/students/me', student.token, { method: 'PUT', body: { gpax: 2.8 } })).gpax, 2.8, 'Waiting again unlocks qualifications');
  assert.equal((await ok(`${studentPath}/coop-result`, accounts.staff.token, { method: 'PUT', body: { coop_result: 'passed' } })).coop_result, 'passed');

  // Supervising is an advisor-account permission, not a per-student assignment.
  const otherAdvisorId = accounts.otherAdvisor.user.user_id;
  assert.equal((await request(`/users/${studentUser.user_id}`, accounts.staff.token, { method: 'PATCH', body: { is_supervisor: true } })).status, 422);
  const application = await ok('/applications', student.token, { method: 'POST', body }, 201);
  assert.equal(application.resume_s3_key, (await ok('/students/me', student.token)).cv_s3_key, 'Profile CV is used when no resume is attached');
  const listed = async (path, token) => (await ok(path, token)).some((a) => a.application_id === application.application_id);
  assert.equal((await request('/supervisor/applications', accounts.otherAdvisor.token)).status, 403, 'Advisors who do not supervise see no queue');
  assert.equal((await request('/supervisor/applications', accounts.staff.token)).status, 403);
  assert.equal((await request(`/applications/${application.application_id}/reviews`, accounts.otherAdvisor.token, { method: 'POST', body: { status: 'approved' } })).status, 403);
  assert.equal(await listed('/advisor/applications', accounts.otherAdvisor.token), false);
  assert.equal((await request(`/advisor/students/${studentUser.student_id}`, accounts.otherAdvisor.token)).status, 403);
  assert.equal((await ok(`/users/${otherAdvisorId}`, accounts.staff.token, { method: 'PATCH', body: { is_supervisor: true } })).is_supervisor, true);
  assert.equal(await listed('/supervisor/applications', accounts.otherAdvisor.token), true, 'A supervisor sees every student\'s applications');
  assert.equal(await listed('/supervisor/applications', accounts.advisor.token), true);
  assert.equal(await listed('/advisor/applications', accounts.otherAdvisor.token), false, 'Supervising does not make them the advisor');
  assert.equal((await ok(`/advisor/students/${studentUser.student_id}`, accounts.otherAdvisor.token)).student_id, studentUser.student_id, 'Supervisors can open any student');
  await ok(`/applications/${application.application_id}/reviews`, accounts.otherAdvisor.token, { method: 'POST', body: { status: 'approved' } });
  await ok(`/applications/${application.application_id}/withdraw`, student.token, { method: 'POST' });
  await ok(`/users/${otherAdvisorId}`, accounts.staff.token, { method: 'PATCH', body: { is_supervisor: false } });
});

test('duplicate concurrent submissions, unauthorized reviews and concurrent approve/reject', async () => {
  const resume = await upload(student.token, 'resume');
  const body = { position_id: positions[0].position_id, resume_s3_key: resume.key };
  const submissions = await Promise.all([request('/applications', student.token, { method: 'POST', body }), request('/applications', student.token, { method: 'POST', body })]);
  assert.deepEqual(submissions.map((r) => r.status).sort(), [200, 201]);
  const application = submissions[0].body;
  assert.equal(application.history.length, 1);
  assert.equal((await request(`/applications/${application.application_id}/reviews`, accounts.otherAdvisor.token, { method: 'POST', body: { status: 'approved' } })).status, 403);
  assert.equal((await request(`/company/applications/${application.application_id}/decision`, accounts.integrationCompany.token, { method: 'PATCH', body: { status: 'accepted' } })).status, 409);
  assert.equal((await request(`/applications/${application.application_id}/reviews`, accounts.staff.token, { method: 'POST', body: { status: 'approved' } })).status, 403, 'Staff cannot approve applications');
  assert.equal((await request(`/applications/${application.application_id}/reviews`, accounts.advisor.token, { method: 'POST', body: { status: 'rejected' } })).status, 422);
  const results = await Promise.all([
    request(`/applications/${application.application_id}/reviews`, accounts.advisor.token, { method: 'POST', body: { status: 'approved', comment: 'Reviewed' } }),
    request(`/applications/${application.application_id}/reviews`, accounts.advisor.token, { method: 'POST', body: { status: 'rejected', comment: 'Competing review' } }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const detail = await ok(`/applications/${application.application_id}`, student.token);
  assert.equal(detail.student.curriculum, '66', 'Application cards must display the saved curriculum');
  assert.equal(detail.reviews.length, 1); assert.equal(detail.history.length, 2);
  assert.equal((await request(`/applications/${application.application_id}`, accounts.otherStudent.token)).status, 404);
  assert.equal((await request(`/applications/${application.application_id}`, accounts.otherCompany.token)).status, 404);
});

test('closed position, mismatched term and closed plan window cannot be bypassed', async () => {
  const resume = await upload(student.token, 'resume');
  const body = { position_id: positions[4].position_id, resume_s3_key: resume.key };
  await ok(`/positions/${positions[4].position_id}`, accounts.staff.token, { method: 'PATCH', body: { is_open: false } });
  assert.equal((await request('/applications', student.token, { method: 'POST', body })).status, 409);
  const futureTerms = await ok('/terms', accounts.staff.token, { method: 'POST', body: { code: '3/2570', plan_open_at: '2027-01-01', plan_close_at: '2027-02-01', coop_start: '2027-03-01', coop_end: '2027-06-01' } }, 201);
  const other = futureTerms.find((t) => t.code === '3/2570');
  await ok(`/positions/${positions[4].position_id}`, accounts.staff.token, { method: 'PATCH', body: { is_open: true, term_id: other.term_id } });
  assert.equal((await request('/applications', student.token, { method: 'POST', body })).status, 409);
  await ok(`/positions/${positions[4].position_id}`, accounts.staff.token, { method: 'PATCH', body: { term_id: null } });
  await query('UPDATE terms SET plan_open_at=current_date-4,plan_close_at=current_date-2 WHERE term_id=$1', [term.term_id]);
  assert.equal((await request('/applications', student.token, { method: 'POST', body })).status, 409);
  await query('UPDATE terms SET plan_open_at=current_date-1,plan_close_at=current_date+30 WHERE term_id=$1', [term.term_id]);
});

test('repeated decisions and two concurrent confirmations keep one right and complete history', async () => {
  const apps = [];
  for (let index = 1; index <= 3; index++) {
    const resume = await upload(student.token, 'resume');
    const app = await ok('/applications', student.token, { method: 'POST', body: { position_id: positions[index].position_id, resume_s3_key: resume.key } }, 201);
    const body = { status: 'approved', comment: 'Approved for testing' };
    await ok(`/applications/${app.application_id}/reviews`, accounts.advisor.token, { method: 'POST', body });
    await ok(`/applications/${app.application_id}/reviews`, accounts.advisor.token, { method: 'POST', body });
    if (index < 3) {
      assert.equal((await request(`/company/applications/${app.application_id}/decision`, accounts.otherCompany.token, { method: 'PATCH', body: { status: 'accepted' } })).status, 403);
      await ok(`/company/applications/${app.application_id}/decision`, accounts.integrationCompany.token, { method: 'PATCH', body: { status: 'accepted' } });
      await ok(`/company/applications/${app.application_id}/decision`, accounts.integrationCompany.token, { method: 'PATCH', body: { status: 'accepted' } });
    }
    apps.push(app);
  }
  const results = await Promise.all(apps.slice(0, 2).map((app) => request(`/applications/${app.application_id}/confirm`, student.token, { method: 'POST' })));
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const current = await ok('/students/me/applications', student.token);
  assert.equal(current.filter((a) => a.status === 'confirmed').length, 1);
  assert.equal(current.find((a) => a.application_id === apps[2].application_id).status, 'withdrawn');
  const selected = current.find((a) => a.status === 'confirmed');
  const again = await ok(`/applications/${selected.application_id}/confirm`, student.token, { method: 'POST' });
  assert.equal(again.history.length, selected.history.length);
  for (const row of current) {
    assert.equal(row.history.at(-1).to, row.status);
    assert.equal(row.reviews.length, 1);
  }
  assert.equal((await request('/students/me', student.token, { method: 'PUT', body: { gpax: 1 } })).status, 409);
  assert.equal((await request('/students/me', student.token, { method: 'PUT', body: { curriculum:'61' } })).status, 409);
  assert.equal((await request('/students/me', student.token, { method: 'PUT', body: { course_grades:{'คพ.100':'F'} } })).status, 409);
  assert.equal((await request('/students/me', student.token, { method: 'PUT', body: { declarations:{mustPass:false} } })).status, 409);
  const profile = await ok('/students/me', student.token);
  assert.equal(profile.qualification_locked, true);
  const unchanged = await ok('/students/me', student.token, {method:'PUT',body:{
    curriculum:profile.curriculum,course_grades:Object.fromEntries(Object.entries(profile.course_grades).reverse()),
    declarations:profile.declarations,phone:'0812345679',
  }});
  assert.equal(unchanged.phone, '0812345679');
  const resume = await upload(student.token, 'resume');
  assert.equal((await request('/applications', student.token, { method: 'POST', body: { position_id: positions[4].position_id, resume_s3_key: resume.key } })).status, 409);
});

test('company scope hides unapproved applications and redacts closed applicant contact data', async () => {
  const visible = await ok('/company/applications', accounts.company.token);
  assert.ok(visible.length);
  assert.ok(visible.every((a) => !['submitted','rejected'].includes(a.status)));
  const declined = visible.find((a) => a.status === 'declined');
  assert.equal(declined.student.email, null); assert.equal(declined.student.phone, null);
  assert.equal(declined.resume_s3_key, null);
  assert.ok(visible.find((a) => a.status === 'approved').student.email);
  assert.deepEqual(await ok('/company/applications', accounts.otherCompany.token), []);
});

test('Cognito API Gateway claims use DB permissions and cannot be supplied through HTTP', async () => {
  const previous = Object.fromEntries(['AUTH_MODE','COGNITO_USER_POOL_ID','COGNITO_CLIENT_ID'].map((key) => [key, process.env[key]]));
  try {
    process.env.AUTH_MODE = 'api-gateway'; process.env.COGNITO_USER_POOL_ID = 'us-east-1_Integration'; process.env.COGNITO_CLIENT_ID = 'integration-client';
    await query("UPDATE users SET cognito_sub='integration-subject' WHERE user_id=$1", [studentUser.user_id]);
    const { handler } = await import('../src/lambda.js');
    const claims = { iss:'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Integration', sub:'integration-subject', client_id:'integration-client', token_use:'access', exp:String(Math.floor(Date.now()/1000)+60), role:'staff' };
    const event = (path, payload) => ({version:'2.0',rawPath:path,rawQueryString:'',headers:{authorization:'Bearer gateway-verified-token'},requestContext:{stage:'$default',http:{method:'GET',path,protocol:'HTTP/1.1',sourceIp:'127.0.0.1'},authorizer:{jwt:{claims:payload}}},isBase64Encoded:false});
    const context = {getRemainingTimeInMillis:() => 10000};
    const me = await handler(event('/api/auth/me',claims), context);
    assert.equal(me.statusCode, 200); assert.equal(JSON.parse(me.body).role, 'student');
    assert.equal((await handler(event('/api/users',claims), context)).statusCode, 403);
    assert.equal((await handler(event('/api/auth/me',{...claims,client_id:'wrong'}), context)).statusCode, 401);
    assert.equal((await handler(event('/api/auth/me',{...claims,exp:'1'}), context)).statusCode, 401);
    assert.equal((await request('/auth/me', student.token, {headers:{'X-Authorizer-Claims':JSON.stringify(claims)}})).status, 401);
  } finally {
    for (const [key,value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key]=value; }
  }
});

test('first Cognito login binds a pre-registered account once by TU username or Google-verified email', async () => {
  const previous = Object.fromEntries(['AUTH_MODE','COGNITO_USER_POOL_ID','COGNITO_CLIENT_ID'].map((key) => [key, process.env[key]]));
  try {
    process.env.AUTH_MODE = 'api-gateway'; process.env.COGNITO_USER_POOL_ID = 'us-east-1_Integration'; process.env.COGNITO_CLIENT_ID = 'integration-client';
    const insert = (username, role, email) => query(
      "INSERT INTO users (auth_provider,username,role,th_name,en_name,email) VALUES ('cognito',$1,$2,'ทดสอบผูกบัญชี','Bind Test',$3) RETURNING user_id", [username, role, email]
    ).then((r) => r.rows[0].user_id);
    const tuUser = await insert('bind.tu.user', 'advisor', 'bind.tu@tu.ac.th');
    const googleUser = await insert('bind.google', 'company', 'Bind.Coordinator@gmail.com');
    await insert('bind.dup.1', 'company', 'dup.coordinator@gmail.com');
    await insert('bind.dup.2', 'company', 'dup.coordinator@gmail.com');
    const { handler } = await import('../src/lambda.js');
    const common = { iss:'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Integration', exp:String(Math.floor(Date.now()/1000)+60) };
    const idToken = (sub, extra) => ({ ...common, sub, aud:'integration-client', token_use:'id', ...extra });
    const google = (sub, email, extra) => idToken(sub, { email, email_verified:'true', 'cognito:username':`google_${sub}`, identities:JSON.stringify([{ providerName:'Google', userId:sub }]), ...extra });
    const me = async (claims) => {
      const event = {version:'2.0',rawPath:'/api/auth/me',rawQueryString:'',headers:{authorization:'Bearer gateway-verified-token'},requestContext:{stage:'$default',http:{method:'GET',path:'/api/auth/me',protocol:'HTTP/1.1',sourceIp:'127.0.0.1'},authorizer:{jwt:{claims}}},isBase64Encoded:false};
      const response = await handler(event, {getRemainingTimeInMillis:() => 10000});
      return { status: response.statusCode, body: JSON.parse(response.body) };
    };

    // TU: Cognito username ตรงกับ users.username (ไม่สนตัวพิมพ์) และครั้งต่อไปหาจาก sub ที่ผูกแล้ว
    let result = await me(idToken('sub-tu', { 'cognito:username':'BIND.TU.USER' }));
    assert.equal(result.status, 200); assert.equal(result.body.user_id, tuUser);
    assert.equal((await me(idToken('sub-tu', { 'cognito:username':'renamed' }))).body.user_id, tuUser);
    // ผูกแล้วผูกซ้ำกับ sub อื่นไม่ได้ (access token ใช้ claim username)
    assert.equal((await me({ ...common, sub:'sub-tu-2', client_id:'integration-client', token_use:'access', username:'bind.tu.user' })).status, 403);

    // Google: ต้องเป็น ID token ที่อีเมลยืนยันแล้ว และผูกได้เฉพาะ role company
    assert.equal((await me(google('sub-g0', 'bind.coordinator@gmail.com', { email_verified:'false' }))).status, 403);
    assert.equal((await me({ ...google('sub-g0', 'bind.coordinator@gmail.com'), token_use:'access', client_id:'integration-client', aud:undefined })).status, 403);
    assert.equal((await me(google('sub-g0', 'bind.tu@tu.ac.th'))).status, 403, 'Google cannot bind a TU-role account');
    result = await me(google('sub-g1', 'bind.coordinator@gmail.com'));
    assert.equal(result.status, 200); assert.equal(result.body.user_id, googleUser);
    assert.equal((await me(google('sub-g2', 'bind.coordinator@gmail.com'))).status, 403);
    // อีเมลซ้ำหลายบัญชี: ไม่เดาว่าเป็นใคร
    assert.equal((await me(google('sub-g3', 'dup.coordinator@gmail.com'))).status, 403);
    // บัญชี dev ไม่ถูกผูก
    assert.equal((await me(idToken('sub-dev', { 'cognito:username':'v3.staff' }))).status, 403);
    assert.equal((await query("SELECT count(*)::int AS n FROM users WHERE auth_provider='dev' AND cognito_sub LIKE 'sub-%'")).rows[0].n, 0);
  } finally {
    for (const [key,value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key]=value; }
  }
});

test('Cognito: CS students are created on first login from TU claims, mock emails bind to their seeded accounts', async () => {
  const previous = Object.fromEntries(['AUTH_MODE','COGNITO_USER_POOL_ID','COGNITO_CLIENT_ID','MOCK_LOGINS'].map((key) => [key, process.env[key]]));
  try {
    process.env.AUTH_MODE = 'api-gateway'; process.env.COGNITO_USER_POOL_ID = 'us-east-1_Integration'; process.env.COGNITO_CLIENT_ID = 'integration-client';
    process.env.MOCK_LOGINS = 'mock.advisor@tu.ac.th';
    const { handler } = await import('../src/lambda.js');
    const idToken = (sub, extra) => ({ iss:'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Integration', exp:String(Math.floor(Date.now()/1000)+60), sub, aud:'integration-client', token_use:'id', ...extra });
    const me = async (claims) => {
      const event = {version:'2.0',rawPath:'/api/auth/me',rawQueryString:'',headers:{authorization:'Bearer gateway-verified-token'},requestContext:{stage:'$default',http:{method:'GET',path:'/api/auth/me',protocol:'HTTP/1.1',sourceIp:'127.0.0.1'},authorizer:{jwt:{claims}}},isBase64Encoded:false};
      const response = await handler(event, {getRemainingTimeInMillis:() => 10000});
      return { status: response.statusCode, body: JSON.parse(response.body) };
    };

    // Verify เก็บชื่อจาก TU ไว้ใน token: name, custom:en_name, email
    let result = await me(idToken('cognito-cs-1', { 'cognito:username':'6509617777', name:'นักศึกษา คอกนิโต', 'custom:en_name':'Cognito Student', email:'cognito.student@dome.tu.ac.th' }));
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.role, 'student'); assert.equal(result.body.username, '6509617777'); assert.equal(result.body.auth_provider, 'cognito');
    assert.equal(result.body.th_name, 'นักศึกษา คอกนิโต'); assert.equal(result.body.en_name, 'Cognito Student');
    assert.equal(result.body.email, 'cognito.student@dome.tu.ac.th'); assert.equal(result.body.curriculum, '61');
    assert.equal((await me(idToken('cognito-cs-1', { 'cognito:username':'6509617777' }))).body.user_id, result.body.user_id);
    // ไม่มีชื่อใน token (เก็บไม่ได้) ใช้รหัสนักศึกษาแทน
    result = await me(idToken('cognito-cs-2', { 'cognito:username':'6709617777' }));
    assert.equal(result.body.th_name, '6709617777'); assert.equal(result.body.email, '6709617777@dome.tu.ac.th'); assert.equal(result.body.curriculum, '66');
    // token รอบถัดไปมีชื่อแล้ว: เติมชื่อที่ยังเป็นรหัสนักศึกษา แต่ไม่ทับชื่อที่มีอยู่แล้ว
    result = await me(idToken('cognito-cs-2', { 'cognito:username':'6709617777', name:'ชื่อจาก TU', 'custom:en_name':'TU Name' }));
    assert.equal(result.body.th_name, 'ชื่อจาก TU'); assert.equal(result.body.en_name, 'TU Name');
    result = await me(idToken('cognito-cs-2', { 'cognito:username':'6709617777', name:'ชื่ออื่น', 'custom:en_name':'Other' }));
    assert.equal(result.body.th_name, 'ชื่อจาก TU'); assert.equal(result.body.en_name, 'TU Name');
    // sub ใหม่ของรหัสเดิม นอกสาขา หรือบัญชีที่ไม่ใช่นักศึกษา: ไม่สร้าง
    assert.equal((await me(idToken('cognito-cs-3', { 'cognito:username':'6509617777' }))).status, 403);
    assert.equal((await me(idToken('cognito-cs-4', { 'cognito:username':'6509627777' }))).status, 403);
    assert.equal((await me(idToken('cognito-cs-5', { 'cognito:username':'unknown.staff' }))).status, 403);
    assert.equal((await query("SELECT count(*)::int AS n FROM users WHERE username IN ('6509627777','unknown.staff')")).rows[0].n, 0);

    // บัญชี mock: seed ใส่ cognito_sub เป็น dev:... ไว้ ผูกได้เฉพาะอีเมลที่อยู่ใน MOCK_LOGINS
    const mock = (await query("INSERT INTO users (auth_provider,username,cognito_sub,role,th_name,en_name,email) VALUES ('dev','mock.advisor','dev:mock:advisor','advisor','อาจารย์ mock','Mock Advisor','mock.advisor@tu.ac.th') RETURNING user_id")).rows[0].user_id;
    result = await me(idToken('cognito-mock-1', { 'cognito:username':'mock.advisor@tu.ac.th' }));
    assert.equal(result.status, 200); assert.equal(result.body.user_id, mock); assert.equal(result.body.role, 'advisor');
    assert.equal((await me(idToken('cognito-mock-2', { 'cognito:username':'mock.advisor@tu.ac.th' }))).status, 403, 'a bound mock cannot be rebound');
    assert.equal((await me(idToken('cognito-mock-3', { 'cognito:username':'advisor.v3@tu.ac.th' }))).status, 403, 'unlisted seeded accounts stay unbindable');

    // REST API (payload v1): claims อยู่ที่ authorizer.claims และ exp เป็นข้อความวันที่
    const rest = async (exp) => handler({ resource:'/{proxy+}', path:'/api/auth/me', httpMethod:'GET', headers:{ Authorization:'Bearer rest-verified-token' }, multiValueHeaders:{}, queryStringParameters:null, isBase64Encoded:false, body:null,
      requestContext:{ stage:'prod', httpMethod:'GET', path:'/prod/api/auth/me', identity:{ sourceIp:'127.0.0.1' }, authorizer:{ claims:{ ...idToken('cognito-mock-1', { 'cognito:username':'mock.advisor@tu.ac.th' }), exp } } } }, {getRemainingTimeInMillis:() => 10000});
    const later = new Date(Date.now() + 60_000).toUTCString().replace(/^(\w+), (\d+) (\w+) (\d+) ([\d:]+) GMT$/, '$1 $3 $2 $5 UTC $4');
    const restMe = await rest(later);
    assert.equal(restMe.statusCode, 200, `${later} ${restMe.body}`); assert.equal(JSON.parse(restMe.body).user_id, mock);
    assert.equal((await rest('Mon Jan 01 00:00:00 UTC 2024')).statusCode, 401);
  } finally {
    for (const [key,value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key]=value; }
  }
});

test('OpenAPI describes V3 endpoints and every schema reference resolves', async () => {
  const spec = await ok('/docs.json');
  for (const path of ['/api/auth/login','/api/students/me','/api/users','/api/positions','/api/terms','/api/applications/{id}/reviews','/api/applications/{id}/confirm']) assert.ok(spec.paths[path],path);
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.$ref) {
      assert.ok(node.$ref.startsWith('#/components/schemas/'));
      assert.ok(spec.components.schemas[node.$ref.split('/').at(-1)], node.$ref);
    }
    Object.values(node).forEach(visit);
  };
  visit(spec);
});

test('position/company ownership, protected deletes and rollback of multi-table user creation', async () => {
  assert.equal((await request(`/positions/${positions[0].position_id}`, accounts.otherCompany.token, { method: 'PATCH', body: { is_open: false } })).status, 403);
  assert.equal((await request(`/positions/${positions[0].position_id}`, accounts.staff.token, { method: 'DELETE' })).status, 409);
  assert.equal((await request(`/companies/${positions[0].company_id}`, accounts.staff.token, { method: 'DELETE' })).status, 409);
  const result = await request('/users', accounts.staff.token, { method: 'POST', body: { username: 'rollback-user', role: 'company', email: 'rollback@example.test', th_name: 'Rollback', en_name: 'Rollback', company_id: 2147483647 } });
  assert.equal(result.status, 422);
  assert.equal((await query("SELECT count(*)::int AS n FROM users WHERE username='rollback-user'")).rows[0].n, 0);
  await assert.rejects(transaction(async (db) => { await db.query("INSERT INTO companies (name) VALUES ('rollback-proof')"); throw new Error('injected failure'); }));
  assert.equal((await query("SELECT count(*)::int AS n FROM companies WHERE name='rollback-proof'")).rows[0].n, 0);
});

test('concurrent term activation remains unique, preserves old active term on invalid request', async () => {
  const template = { plan_open_at: '2027-01-01', plan_close_at: '2027-02-01', coop_start: '2027-03-01', coop_end: '2027-06-01' };
  await ok('/terms', accounts.staff.token, { method: 'POST', body: { ...template, code: '1/2570' } }, 201);
  const terms = await ok('/terms', accounts.staff.token, { method: 'POST', body: { ...template, code: '2/2570' } }, 201);
  await Promise.all(terms.slice(0, 2).map((row) => ok(`/terms/${row.term_id}/activate`, accounts.staff.token, { method: 'POST' })));
  const before = await ok('/terms/active', accounts.staff.token);
  assert.equal((await request('/terms/2147483647/activate', accounts.staff.token, { method: 'POST' })).status, 404);
  assert.equal((await ok('/terms', accounts.staff.token)).filter((t) => t.is_active).length, 1);
  assert.equal((await ok('/terms/active', accounts.staff.token)).term_id, before.term_id);
});
