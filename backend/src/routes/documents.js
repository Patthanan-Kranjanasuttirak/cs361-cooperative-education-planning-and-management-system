import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { authenticate } from '../middlewares/auth.js';
import { query } from '../config/db.js';
import { HttpError } from '../utils/httpError.js';
import { DOCUMENT_KEY, enumeration } from '../utils/validation.js';
import { MAX_UPLOAD_BYTES, getFile, putFile, storageReady } from '../services/storage.js';

const router = Router();
router.use(authenticate);
router.use((_req, _res, next) => storageReady() ? next() : next(new HttpError(503, 'ยังไม่ได้ตั้งค่าที่เก็บเอกสาร (FILE_BUCKET)', 'STORAGE_NOT_CONFIGURED')));
// รูปนักศึกษารับ JPG/PNG ส่วนเอกสารอื่นรับ PDF (ตรวจจากเนื้อไฟล์ ไม่เชื่อ Content-Type อย่างเดียว)
const PHOTO_FORMATS = {
  'image/jpeg': { extension: 'jpg', matches: (data) => data[0] === 255 && data[1] === 216 && data[2] === 255 },
  'image/png': { extension: 'png', matches: (data) => data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) },
};
const CONTENT_TYPES = { pdf: 'application/pdf', jpg: 'image/jpeg', png: 'image/png' };
// บริษัทเปิดเอกสารของผู้สมัครได้ระหว่างพิจารณาและหลังรับ (ใบสมัครส่งถึงบริษัทโดยตรง)
const COMPANY_OPEN = "('submitted','approved','accepted','confirmed')";

router.post('/', express.raw({ type: ['application/pdf', ...Object.keys(PHOTO_FORMATS)], limit: MAX_UPLOAD_BYTES }), async (req, res) => {
  if (req.user.role !== 'student') throw new HttpError(403, 'อัปโหลดเอกสารได้เฉพาะนักศึกษา', 'FORBIDDEN');
  const kind = enumeration(req.query.kind, 'kind', ['transcript', 'resume', 'cv', 'photo']);
  let extension = 'pdf';
  if (kind === 'photo') {
    const format = PHOTO_FORMATS[req.get('Content-Type')?.split(';')[0]];
    if (!format || !Buffer.isBuffer(req.body) || !req.body.length || !format.matches(req.body)) throw new HttpError(422, 'รองรับเฉพาะรูป JPG หรือ PNG', 'INVALID_DOCUMENT');
    extension = format.extension;
  } else if (!Buffer.isBuffer(req.body) || req.body.length < 5 || req.body.subarray(0, 5).toString() !== '%PDF-') throw new HttpError(422, 'รองรับเฉพาะไฟล์ PDF', 'INVALID_DOCUMENT');
  const key = `${req.user.user_id}/${kind}-${randomUUID()}.${extension}`;
  await putFile(key, req.body, CONTENT_TYPES[extension]);
  res.status(201).json({ key, url: `/documents/${encodeURIComponent(key)}` });
});
router.get('/:key', async (req, res) => {
  const key = req.params.key;
  if (!DOCUMENT_KEY.test(key)) throw new HttpError(404, 'ไม่พบเอกสาร', 'NOT_FOUND');
  if (Number(key.split('/')[0]) !== req.user.user_id) {
    const { rows } = await query(`SELECT 1 FROM students s WHERE $1 IN (s.transcript_s3_key, s.cv_s3_key, s.photo_s3_key)
      AND ($2 IN ('staff','committee') OR ($2='company' AND EXISTS (
        SELECT 1 FROM applications a JOIN positions p USING(position_id) WHERE a.student_id=s.student_id
        AND p.company_id=$3 AND a.status IN ${COMPANY_OPEN})))
      UNION ALL SELECT 1 FROM applications a JOIN positions p USING(position_id)
      WHERE a.resume_s3_key=$1 AND ($2='staff' OR ($2='company' AND p.company_id=$3 AND a.status IN ${COMPANY_OPEN})) LIMIT 1`, [key, req.user.role, req.user.company_id ?? null]);
    if (!rows.length) throw new HttpError(403, 'ไม่มีสิทธิ์เข้าถึงเอกสารนี้', 'FORBIDDEN');
  }
  const file = await getFile(key);
  if (!file) throw new HttpError(404, 'ไม่พบไฟล์เอกสาร', 'NOT_FOUND');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Cache-Control', 'private, no-store');
  res.type(CONTENT_TYPES[key.split('.').pop()]);
  res.set('Content-Disposition', `inline; filename="${key.split('/')[1]}"`);
  res.send(file);
});
export default router;
