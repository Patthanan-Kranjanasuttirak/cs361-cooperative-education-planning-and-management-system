import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { authenticate } from '../middlewares/auth.js';
import { query } from '../config/db.js';
import { HttpError } from '../utils/httpError.js';
import { getFile, putFile, storageReady } from '../services/storage.js';

const router = Router();
const formats = {
  'image/png': { extension:'png', matches:(data) => data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
  'image/jpeg': { extension:'jpg', matches:(data) => data[0] === 255 && data[1] === 216 && data[2] === 255 },
  'image/webp': { extension:'webp', matches:(data) => data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP' },
  'image/svg+xml': { extension:'svg', matches:(data) => /^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg(?:\s|>)/i.test(data.toString('utf8')) },
};
const storageRequired = (_req, _res, next) => storageReady() ? next() : next(new HttpError(503, 'ยังไม่ได้ตั้งค่าบริการเก็บโลโก้', 'STORAGE_NOT_CONFIGURED'));

router.post('/company/logo', authenticate, storageRequired, express.raw({ type:Object.keys(formats), limit:'2mb' }), async (req, res) => {
  if (req.user.role !== 'company' || !req.user.company_id) throw new HttpError(403, 'อัปโหลดโลโก้ได้เฉพาะผู้ประสานงานของบริษัท', 'FORBIDDEN');
  const format = formats[req.get('Content-Type')?.split(';')[0]];
  if (!format || !Buffer.isBuffer(req.body) || !req.body.length || !format.matches(req.body)) throw new HttpError(422, 'รองรับไฟล์ PNG, JPG, WEBP หรือ SVG ที่ถูกต้อง ไม่เกิน 2 MB', 'INVALID_IMAGE');
  const filename = `logo-${randomUUID()}.${format.extension}`;
  await putFile(`company-logos/${req.user.company_id}/${filename}`, req.body, req.get('Content-Type').split(';')[0]);
  res.status(201).json({ url:`/company-logos/${req.user.company_id}/${filename}` });
});

// Company logos are public images; document routes remain authenticated.
router.get('/company-logos/:companyId/:filename', storageRequired, async (req, res) => {
  const { companyId, filename } = req.params;
  if (!/^[1-9]\d{0,9}$/.test(companyId) || Number(companyId) > 2147483647 || !/^logo-[a-f0-9-]{36}\.(png|jpg|webp|svg)$/.test(filename)) throw new HttpError(404, 'ไม่พบโลโก้', 'NOT_FOUND');
  const url = `/company-logos/${companyId}/${filename}`;
  const { rows } = await query('SELECT 1 FROM companies WHERE company_id=$1 AND logo=$2', [companyId, url]);
  if (!rows.length) throw new HttpError(404, 'ไม่พบโลโก้', 'NOT_FOUND');
  const file = await getFile(`company-logos/${companyId}/${filename}`);
  if (!file) throw new HttpError(404, 'ไม่พบไฟล์โลโก้', 'NOT_FOUND');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Security-Policy', "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:");
  res.type(filename.split('.').pop()).send(file);
});

export default router;
