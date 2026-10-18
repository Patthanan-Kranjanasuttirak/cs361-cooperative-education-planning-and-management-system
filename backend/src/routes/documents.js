import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { authenticate, developmentAuth } from '../middlewares/auth.js';
import { query } from '../config/db.js';
import { HttpError } from '../utils/httpError.js';
import { enumeration } from '../utils/validation.js';

const router = Router();
const directory = path.resolve(process.env.UPLOAD_DIR || '.uploads');
router.use(authenticate);
router.use((_req, _res, next) => developmentAuth() ? next() : next(new HttpError(503, 'การเก็บเอกสาร local ใช้ได้เฉพาะโหมดพัฒนา กรุณาตั้งค่าบริการเอกสารก่อนใช้งาน production', 'STORAGE_NOT_CONFIGURED')));
router.post('/', express.raw({ type: 'application/pdf', limit: '10mb' }), async (req, res) => {
  if (req.user.role !== 'student') throw new HttpError(403, 'อัปโหลดเอกสารได้เฉพาะนักศึกษา', 'FORBIDDEN');
  const kind = enumeration(req.query.kind, 'kind', ['transcript', 'resume']);
  if (!Buffer.isBuffer(req.body) || req.body.length < 5 || req.body.subarray(0, 5).toString() !== '%PDF-') throw new HttpError(422, 'รองรับเฉพาะไฟล์ PDF', 'INVALID_DOCUMENT');
  const key = `${req.user.user_id}/${kind}-${randomUUID()}.pdf`;
  const target = path.join(directory, key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, req.body, { flag: 'wx', mode: 0o600 });
  res.status(201).json({ key, url: `/documents/${encodeURIComponent(key)}` });
});
router.get('/:key', async (req, res) => {
  const key = req.params.key;
  if (!/^\d+\/(transcript|resume)-[a-f0-9-]+\.pdf$/.test(key)) throw new HttpError(404, 'ไม่พบเอกสาร', 'NOT_FOUND');
  if (Number(key.split('/')[0]) !== req.user.user_id) {
    const { rows } = await query(`SELECT 1 FROM students s WHERE s.transcript_s3_key=$1
      AND ($2='staff' OR ($2='advisor' AND s.advisor_id=$3) OR ($2='company' AND EXISTS (
        SELECT 1 FROM applications a JOIN positions p USING(position_id) WHERE a.student_id=s.student_id
        AND p.company_id=$4 AND a.status IN ('approved','accepted','confirmed'))))
      UNION ALL SELECT 1 FROM applications a JOIN students s USING(student_id) JOIN positions p USING(position_id)
      WHERE a.resume_s3_key=$1 AND ($2='staff' OR ($2='advisor' AND s.advisor_id=$3)
        OR ($2='company' AND p.company_id=$4 AND a.status IN ('approved','accepted','confirmed'))) LIMIT 1`, [key, req.user.role, req.user.user_id, req.user.company_id ?? null]);
    if (!rows.length) throw new HttpError(403, 'ไม่มีสิทธิ์เข้าถึงเอกสารนี้', 'FORBIDDEN');
  }
  const target = path.join(directory, key);
  try { await access(target); } catch { throw new HttpError(404, 'ไม่พบไฟล์เอกสาร', 'NOT_FOUND'); }
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'private, no-store');
  res.type('application/pdf');
  res.set('Content-Disposition', `inline; filename="${path.basename(key)}"`);
  // The development upload directory is .uploads; access above is limited to authorized, validated PDF keys.
  res.sendFile(target, { dotfiles: 'allow' });
});
export default router;
