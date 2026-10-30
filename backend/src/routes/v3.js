import { Router } from 'express';
import { authenticate, allowRoles, developmentLogin } from '../middlewares/auth.js';
import * as resources from '../services/resourceService.js';
import * as workflow from '../services/applicationService.js';
import * as v from '../utils/validation.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();
const staff = allowRoles('staff');
const companyOrStaff = allowRoles('company', 'staff');
const committee = allowRoles('committee');
const selectors = allowRoles('staff', 'committee');
async function applicationFilters(req, activeByDefault = false) {
  const filters = {};
  if (req.query.term_id !== undefined) filters.term_id = v.id(req.query.term_id, 'term_id');
  else if (activeByDefault) filters.term_id = (await resources.terms()).find((term) => term.is_active)?.term_id ?? -1;
  if (req.query.status !== undefined) filters.status = v.enumeration(req.query.status, 'status', v.STATUSES);
  return filters;
}
const sid = (req) => {
  if (!req.user.student_id) throw new HttpError(403, 'ไม่พบบัญชีนักศึกษา', 'FORBIDDEN');
  return req.user.student_id;
};
router.post('/auth/login', developmentLogin);
router.use(authenticate);
router.get('/auth/me', (req, res) => res.json(req.user));
router.get('/users', staff, async (_req, res) => res.json(await resources.listUsers()));
router.post('/users', staff, async (req, res) => res.status(201).json(await resources.saveUser(req.user, null, req.body)));
router.put('/users/:id', staff, async (req, res) => res.json(await resources.saveUser(req.user, v.id(req.params.id), req.body)));
router.patch('/users/:id', staff, async (req, res) => res.json(await resources.saveUser(req.user, v.id(req.params.id), req.body)));
router.get('/students/me', allowRoles('student'), (req, res) => res.json(req.user));
router.put('/students/me', allowRoles('student'), async (req, res) => res.json(await resources.saveStudent(req.user, sid(req), req.body)));
router.get('/students/me/applications', allowRoles('student'), async (req, res) => res.json(await workflow.applications(req.user, await applicationFilters(req, true))));
router.get('/students', selectors, async (req, res) => res.json(await resources.listStudents(req.user)));
router.get('/students/:id', allowRoles('student', 'committee', 'staff'), async (req, res) => {
  const student = await resources.studentProfile(req.user, v.id(req.params.id));
  const applications = await workflow.applications(req.user, { student_id: student.student_id });
  res.json({ ...student, applications });
});
router.put('/students/:id', allowRoles('student', 'staff'), async (req, res) => res.json(await resources.saveStudent(req.user, v.id(req.params.id), req.body)));
// คัดเลือกเข้าแผนสหกิจศึกษา: เจ้าหน้าที่คัดกรอง → กรรมการคัดเลือก → เจ้าหน้าที่ประกาศ (ทีละคนหรือทั้งหมด)
router.put('/students/:id/screening', staff, async (req, res) => res.json(await resources.screenStudent(req.user, v.id(req.params.id), req.body)));
router.put('/students/:id/committee-result', committee, async (req, res) => res.json(await resources.decideStudent(req.user, v.id(req.params.id), req.body)));
router.get('/coop-selection', selectors, async (_req, res) => res.json(await resources.selection()));
router.post('/coop-selection/announce', staff, async (req, res) => res.json(await resources.announceResults(req.user, req.body ?? {})));
// รายงาน: ?format=csv ได้ไฟล์ CSV (UTF-8 BOM ให้ Excel อ่านภาษาไทยได้)
function sendCsv(res, filename, columns, rows) {
  const cell = (value) => {
    let text = value instanceof Date ? value.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }) : value == null ? '' : String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  const csv = [columns.map(([, label]) => label), ...rows.map((row) => columns.map(([key]) => row[key]))].map((line) => line.map(cell).join(',')).join('\r\n');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.type('text/csv; charset=utf-8').send(`\uFEFF${csv}\r\n`);
}
// รายชื่อผู้ผ่านเข้าแผน
router.get('/reports/coop-passed', selectors, async (req, res) => {
  const rows = await resources.passedStudents();
  if (req.query.format !== 'csv') return res.json(rows);
  sendCsv(res, 'coop-passed.csv', [['student_code', 'รหัสนักศึกษา'], ['th_name', 'ชื่อ-นามสกุล'], ['en_name', 'Name'], ['major', 'กลุ่มวิชาเอก'], ['curriculum', 'หลักสูตร'],
    ['gpax', 'GPAX'], ['email', 'อีเมล'], ['phone', 'เบอร์โทรศัพท์'], ['coop_result_at', 'วันที่ประกาศผล']], rows);
});
// รายชื่อนักศึกษาที่ยืนยันสิทธิ์แล้ว (?term_id= เฉพาะภาคการศึกษา)
router.get('/reports/confirmed', staff, async (req, res) => {
  const rows = await workflow.confirmedPlacements(req.query.term_id ? v.id(req.query.term_id, 'term_id') : null);
  if (req.query.format !== 'csv') return res.json(rows);
  sendCsv(res, 'coop-confirmed.csv', [['term', 'ภาคการศึกษา'], ['student_code', 'รหัสนักศึกษา'], ['th_name', 'ชื่อ-นามสกุล'], ['en_name', 'Name'],
    ['major', 'กลุ่มวิชาเอก'], ['email', 'อีเมลนักศึกษา'], ['phone', 'เบอร์นักศึกษา'], ['company_name', 'สถานประกอบการ'], ['position_name', 'ตำแหน่ง'],
    ['receiver_name', 'ผู้รับ (บริษัท)'], ['receiver_email', 'อีเมลผู้รับ'], ['receiver_phone', 'เบอร์ผู้รับ'], ['confirmed_at', 'วันที่ยืนยันสิทธิ์']], rows);
});
router.get('/terms', async (_req, res) => res.json(await resources.terms()));
router.get('/terms/active', async (_req, res) => res.json((await resources.terms()).find((term) => term.is_active) ?? null));
router.post('/terms', staff, async (req, res) => res.status(201).json(await resources.saveTerm(null, req.body)));
router.put('/terms/:id', staff, async (req, res) => res.json(await resources.saveTerm(v.id(req.params.id), req.body)));
router.post('/terms/:id/activate', staff, async (req, res) => res.json(await resources.activateTerm(v.id(req.params.id))));
router.get('/company/profile', allowRoles('company'), async (req, res) => res.json(await resources.companyProfile(req.user, req.user.company_id)));
router.put('/company/profile', allowRoles('company'), async (req, res) => res.json(await resources.saveCompany(req.user, req.user.company_id, req.body)));
router.get('/staff/companies/:id', staff, async (req, res) => res.json(await resources.companyProfile(req.user, v.id(req.params.id))));
router.post('/companies', staff, async (req, res) => res.status(201).json(await resources.saveCompany(req.user, null, req.body)));
router.put('/companies/:id', companyOrStaff, async (req, res) => res.json(await resources.saveCompany(req.user, v.id(req.params.id), req.body)));
router.delete('/companies/:id', staff, async (req, res) => { await resources.deleteCompany(v.id(req.params.id)); res.status(204).end(); });
router.get('/positions', companyOrStaff, async (req, res) => res.json(await resources.positions(req.user, req.query.company_id === undefined ? undefined : v.id(req.query.company_id, 'company_id'))));
router.post('/positions', companyOrStaff, async (req, res) => res.status(201).json(await resources.savePosition(req.user, null, req.body)));
router.put('/positions/:id', companyOrStaff, async (req, res) => res.json(await resources.savePosition(req.user, v.id(req.params.id), req.body)));
router.patch('/positions/:id', companyOrStaff, async (req, res) => res.json(await resources.savePosition(req.user, v.id(req.params.id), req.body)));
router.delete('/positions/:id', companyOrStaff, async (req, res) => { await resources.deletePosition(req.user, v.id(req.params.id)); res.status(204).end(); });
router.get('/company/positions', allowRoles('company'), async (req, res) => res.json(await resources.positions(req.user)));
router.post('/company/positions', allowRoles('company'), async (req, res) => res.status(201).json(await resources.savePosition(req.user, null, req.body)));
router.put('/company/positions/:id', allowRoles('company'), async (req, res) => res.json(await resources.savePosition(req.user, v.id(req.params.id), req.body)));
router.patch('/company/positions/:id', allowRoles('company'), async (req, res) => res.json(await resources.savePosition(req.user, v.id(req.params.id), req.body)));
router.delete('/company/positions/:id', allowRoles('company'), async (req, res) => { await resources.deletePosition(req.user, v.id(req.params.id)); res.status(204).end(); });
// ใบสมัคร: นักศึกษา/เจ้าหน้าที่/บริษัท (กรรมการไม่เกี่ยวกับใบสมัครบริษัท)
for (const path of ['/applications', '/staff/applications', '/company/applications']) {
  router.get(path, async (req, res) => {
    if (req.user.role === 'committee' || path.includes('/staff/') && req.user.role !== 'staff' || path.includes('/company/') && req.user.role !== 'company') throw new HttpError(403, 'ไม่มีสิทธิ์เข้าถึงข้อมูล', 'FORBIDDEN');
    res.json(await workflow.applications(req.user, await applicationFilters(req, path.startsWith('/company/'))));
  });
}
router.post('/applications', allowRoles('student'), async (req, res) => {
  const result = await workflow.createApplication(req.user, req.body);
  res.status(result.created ? 201 : 200).json(result.application);
});
router.get('/applications/:id', async (req, res) => res.json(await workflow.application(req.user, v.id(req.params.id))));
// ใบสมัครส่งถึงบริษัทโดยตรง บริษัทรับ/ไม่รับได้เลย
router.patch('/company/applications/:id/decision', allowRoles('company'), async (req, res) => res.json(await workflow.decideApplication(req.user, v.id(req.params.id), req.body)));
router.post('/applications/:id/confirm', allowRoles('student'), async (req, res) => res.json(await workflow.studentAction(req.user, v.id(req.params.id), 'confirm')));
router.post('/applications/:id/withdraw', allowRoles('student'), async (req, res) => res.json(await workflow.studentAction(req.user, v.id(req.params.id), 'withdraw')));
export default router;
