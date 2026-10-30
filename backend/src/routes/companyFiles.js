import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { authenticate } from '../middlewares/auth.js';
import { query } from '../config/db.js';
import { HttpError } from '../utils/httpError.js';
import { application } from '../services/applicationService.js';
import { id } from '../utils/validation.js';
import { MAX_UPLOAD_BYTES, getFile, putFile, storageReady } from '../services/storage.js';

// ไฟล์ PDF รายละเอียดเพิ่มเติมของบริษัท (ไม่บังคับ)
// อัปโหลดแล้วยังไม่เผยแพร่ จนกว่าจะบันทึก key ลง companies.additional_file ผ่าน PUT /company/profile
const router = Router();
const storageRequired = (_req, _res, next) => storageReady() ? next() : next(new HttpError(503, 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์', 'STORAGE_NOT_CONFIGURED'));

router.post('/company/details-file', authenticate, storageRequired, express.raw({ type:'application/pdf', limit:MAX_UPLOAD_BYTES }), async (req, res) => {
  if (req.user.role !== 'company' || !req.user.company_id) throw new HttpError(403, 'อัปโหลดไฟล์ได้เฉพาะผู้ประสานงานของบริษัท', 'FORBIDDEN');
  if (!Buffer.isBuffer(req.body) || req.body.length < 5 || req.body.subarray(0, 5).toString() !== '%PDF-') throw new HttpError(422, 'รองรับเฉพาะไฟล์ PDF', 'INVALID_DOCUMENT');
  const key = `company-files/${req.user.company_id}/details-${randomUUID()}.pdf`;
  await putFile(key, req.body, 'application/pdf');
  res.status(201).json({ key });
});

// ไฟล์ PDF ที่บริษัทแนบถึงนักศึกษาตอนตัดสินผล: ส่ง key ใน company_file ของ PATCH /company/applications/{id}/decision
router.post('/company/decision-file', authenticate, storageRequired, express.raw({ type:'application/pdf', limit:MAX_UPLOAD_BYTES }), async (req, res) => {
  if (req.user.role !== 'company' || !req.user.company_id) throw new HttpError(403, 'อัปโหลดไฟล์ได้เฉพาะผู้ประสานงานของบริษัท', 'FORBIDDEN');
  if (!Buffer.isBuffer(req.body) || req.body.length < 5 || req.body.subarray(0, 5).toString() !== '%PDF-') throw new HttpError(422, 'รองรับเฉพาะไฟล์ PDF', 'INVALID_DOCUMENT');
  const key = `company-files/${req.user.company_id}/decision-${randomUUID()}.pdf`;
  await putFile(key, req.body, 'application/pdf');
  res.status(201).json({ key });
});

// เปิดได้เฉพาะผู้ที่เห็นใบสมัครนั้น (นักศึกษาเจ้าของ บริษัทเจ้าของตำแหน่ง เจ้าหน้าที่)
router.get('/applications/:id/company-file', authenticate, storageRequired, async (req, res) => {
  const app = await application(req.user, id(req.params.id));
  const key = (await query('SELECT company_file FROM applications WHERE application_id=$1', [app.application_id])).rows[0]?.company_file;
  const file = key && await getFile(key);
  if (!file) throw new HttpError(404, 'ไม่พบไฟล์', 'NOT_FOUND');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'private, no-store');
  res.type('application/pdf');
  res.set('Content-Disposition', `inline; filename="application-${app.application_id}-company.pdf"`);
  res.send(file);
});

// สาธารณะเหมือนข้อมูลบริษัท (API Gateway เปิด GET /api/companies/{proxy+} ไว้แล้ว)
router.get('/companies/:id/details-file', storageRequired, async (req, res) => {
  if (!/^[1-9]\d{0,9}$/.test(req.params.id) || Number(req.params.id) > 2147483647) throw new HttpError(404, 'ไม่พบไฟล์', 'NOT_FOUND');
  const { rows } = await query('SELECT additional_file FROM companies WHERE company_id=$1', [req.params.id]);
  const key = rows[0]?.additional_file;
  const file = key && await getFile(key);
  if (!file) throw new HttpError(404, 'ไม่พบไฟล์', 'NOT_FOUND');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Security-Policy', "sandbox");
  res.type('application/pdf');
  res.set('Content-Disposition', `inline; filename="company-${req.params.id}-details.pdf"`);
  res.send(file);
});

export default router;
