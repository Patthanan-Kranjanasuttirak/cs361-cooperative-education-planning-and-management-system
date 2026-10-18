import { Router } from 'express';
import { authenticate, allowRoles, developmentLogin } from '../middlewares/auth.js';
import * as resources from '../services/resourceService.js';
import * as workflow from '../services/applicationService.js';
import * as v from '../utils/validation.js';
import { HttpError } from '../utils/httpError.js';

const router = Router();
const staff = allowRoles('staff');
const companyOrStaff = allowRoles('company', 'staff');
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
router.get('/students', allowRoles('advisor', 'staff'), async (req, res) => res.json(await resources.listStudents(req.user)));
router.get('/students/:id', allowRoles('student', 'advisor', 'staff'), async (req, res) => {
  const student = await resources.studentProfile(req.user, v.id(req.params.id));
  const applications = await workflow.applications(req.user, { student_id: student.student_id });
  res.json({ ...student, applications });
});
router.put('/students/:id', allowRoles('student', 'staff'), async (req, res) => res.json(await resources.saveStudent(req.user, v.id(req.params.id), req.body)));
router.put('/students/:id/advisor', staff, async (req, res) => {
  v.object(req.body, ['advisor_id']);
  res.json(await resources.saveStudent(req.user, v.id(req.params.id), { advisor_id: v.id(req.body.advisor_id, 'advisor_id', true) }));
});
router.get('/advisor/students', allowRoles('advisor'), async (req, res) => res.json(await resources.listStudents(req.user)));
router.get('/advisor/students/:id', allowRoles('advisor'), async (req, res) => {
  const student = await resources.studentProfile(req.user, v.id(req.params.id));
  res.json({ ...student, applications: await workflow.applications(req.user, { student_id: student.student_id }) });
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
for (const path of ['/applications', '/advisor/applications', '/staff/applications', '/company/applications']) {
  router.get(path, async (req, res) => {
    if (path.includes('/advisor/') && req.user.role !== 'advisor' || path.includes('/staff/') && req.user.role !== 'staff' || path.includes('/company/') && req.user.role !== 'company') throw new HttpError(403, 'ไม่มีสิทธิ์เข้าถึงข้อมูล', 'FORBIDDEN');
    const filters = await applicationFilters(req, path.startsWith('/company/') || path.startsWith('/advisor/'));
    res.json(await workflow.applications(req.user, filters));
  });
}
router.post('/applications', allowRoles('student'), async (req, res) => {
  const result = await workflow.createApplication(req.user, req.body);
  res.status(result.created ? 201 : 200).json(result.application);
});
router.get('/applications/:id', async (req, res) => res.json(await workflow.application(req.user, v.id(req.params.id))));
router.post('/applications/:id/reviews', allowRoles('advisor', 'staff'), async (req, res) => res.json(await workflow.reviewApplication(req.user, v.id(req.params.id), req.body)));
router.patch('/company/applications/:id/decision', allowRoles('company'), async (req, res) => res.json(await workflow.decideApplication(req.user, v.id(req.params.id), req.body)));
router.post('/applications/:id/confirm', allowRoles('student'), async (req, res) => res.json(await workflow.studentAction(req.user, v.id(req.params.id), 'confirm')));
router.post('/applications/:id/withdraw', allowRoles('student'), async (req, res) => res.json(await workflow.studentAction(req.user, v.id(req.params.id), 'withdraw')));
export default router;
