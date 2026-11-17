// k6 load test: 40% GET /companies, 40% GET /companies/:id, 20% POST /applications
// ใช้กับข้อมูลจาก loadtest/seed.sql เท่านั้น (เลือกเฉพาะบริษัท/ตำแหน่ง [LOADTEST])
//
// Local (AUTH_MODE=development):
//   k6 run -e BASE_URL=http://localhost:5000/api -e LT_PASSWORD='<DEV_AUTH_PASSWORD>' loadtest/k6-mixed.js
// AWS test stack (Cognito): สร้าง tokens.json ด้วย get-tokens.mjs ก่อน แล้ว
//   k6 run -e BASE_URL=https://<api>/prod/api -e TOKENS_FILE=tokens.json loadtest/k6-mixed.js
// ปรับขนาด: -e VUS=10 -e ITERATIONS=3000
import http from 'k6/http';
import { check, fail } from 'k6';
import { Counter } from 'k6/metrics';

const BASE = (__ENV.BASE_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const STUDENTS = Array.from({ length: 8 }, (_, i) => `lt.student${String(i + 1).padStart(2, '0')}@loadtest.example.test`);
// open() ใช้ได้เฉพาะ init context; path อ้างจากตำแหน่งของสคริปต์นี้
const fileTokens = __ENV.TOKENS_FILE ? JSON.parse(open(__ENV.TOKENS_FILE)) : null;

const created = new Counter('applications_created');     // 201 สร้างใบใหม่
const duplicates = new Counter('applications_duplicate'); // 200 ใบเดิม (idempotent)

export const options = {
  scenarios: {
    mixed: {
      executor: 'shared-iterations',
      vus: Number(__ENV.VUS || 10),
      iterations: Number(__ENV.ITERATIONS || 3000),
      maxDuration: __ENV.MAX_DURATION || '15m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:list_companies}': ['p(95)<1500'],
    'http_req_duration{name:company_detail}': ['p(95)<1000'],
    'http_req_duration{name:create_application}': ['p(95)<2000'],
  },
};

export function setup() {
  let tokens = fileTokens;
  if (!tokens) {
    if (!__ENV.LT_PASSWORD) fail('ต้องตั้ง LT_PASSWORD (local) หรือ TOKENS_FILE (AWS)');
    tokens = STUDENTS.map((email) => {
      const res = http.post(`${BASE}/auth/login`, JSON.stringify({ email, password: __ENV.LT_PASSWORD }),
        { headers: { 'Content-Type': 'application/json' }, tags: { name: 'setup_login' } });
      if (res.status !== 200) fail(`login ${email} ได้ ${res.status} (seed.sql รันแล้วหรือยัง?)`);
      return res.json('token');
    });
  }
  const list = http.get(`${BASE}/companies`, { tags: { name: 'setup_list' } });
  if (list.status !== 200) fail(`GET /companies ได้ ${list.status}`);
  const companies = list.json('data').filter((c) => c.name.startsWith('[LOADTEST]'));
  const positionIds = companies.flatMap((c) => c.positions.filter((p) => p.is_open).map((p) => p.id));
  if (!companies.length || !positionIds.length) fail('ไม่พบบริษัท/ตำแหน่ง [LOADTEST] — รัน loadtest/seed.sql ก่อน');
  return { tokens, companyIds: companies.map((c) => c.id), positionIds };
}

const pick = (items) => items[Math.floor(Math.random() * items.length)];

export default function (data) {
  const r = Math.random();
  if (r < 0.4) {
    const res = http.get(`${BASE}/companies`, { tags: { name: 'list_companies' } });
    check(res, { 'list 200': (x) => x.status === 200 });
  } else if (r < 0.8) {
    const res = http.get(`${BASE}/companies/${pick(data.companyIds)}`, { tags: { name: 'company_detail' } });
    check(res, { 'detail 200': (x) => x.status === 200 });
  } else {
    const res = http.post(`${BASE}/applications`, JSON.stringify({ position_id: pick(data.positionIds) }), {
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pick(data.tokens)}` },
      tags: { name: 'create_application' },
      // 200 = ใบสมัครเดิม (นักศึกษาคนเดิมสมัครตำแหน่งเดิมซ้ำ) ถือว่าสำเร็จตาม API
      responseCallback: http.expectedStatuses(200, 201),
    });
    if (res.status === 201) created.add(1);
    else if (res.status === 200) duplicates.add(1);
    check(res, { 'create 200/201': (x) => x.status === 200 || x.status === 201 });
  }
}
