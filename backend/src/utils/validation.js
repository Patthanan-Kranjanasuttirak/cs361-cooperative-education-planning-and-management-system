import { HttpError } from './httpError.js';

export function invalid(field, message) {
  throw new HttpError(422, message, 'VALIDATION_ERROR', { [field]: message });
}

export function object(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('body', 'ต้องส่งข้อมูลเป็น JSON object');
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length) invalid(unknown[0], 'ไม่รองรับข้อมูลช่องนี้');
  return value;
}

export function text(value, field, max, { nullable = false, required = true } = {}) {
  if ((value == null || value === '') && nullable) return null;
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) invalid(field, `กรุณากรอก ${field} ไม่เกิน ${max} ตัวอักษร`);
  return value.trim();
}

export function id(value, field = 'id', nullable = false) {
  if (value === null && nullable) return null;
  if (!['number','string'].includes(typeof value) || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) > 2147483647) invalid(field, `${field} ต้องเป็นจำนวนเต็มบวก`);
  return Number(value);
}

export function boolean(value, field) {
  if (typeof value !== 'boolean') invalid(field, `${field} ต้องเป็น boolean`);
  return value;
}

export function enumeration(value, field, choices) {
  if (!choices.includes(value)) invalid(field, `${field} ไม่ถูกต้อง`);
  return value;
}

export function email(value) {
  const result = text(value, 'email', 255);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) invalid('email', 'รูปแบบอีเมลไม่ถูกต้อง');
  return result.toLowerCase();
}

export function phone(value) {
  const result = text(value, 'phone', 20, { nullable: true });
  if (result != null && !/^\+?[0-9 ()-]{8,20}$/.test(result)) invalid('phone', 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง');
  return result;
}

export function date(value, field, nullable = false) {
  if (nullable && (value == null || value === '')) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) invalid(field, `${field} ต้องเป็นวันที่ YYYY-MM-DD`);
  return value;
}

export function gpax(value) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 4 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-8) invalid('gpax', 'GPAX ต้องเป็นตัวเลข 0–4 ทศนิยมไม่เกิน 2 ตำแหน่ง');
  return value;
}

export function documentKey(value, field, userId) {
  const key = text(value, field, 512, { nullable: true });
  const kind = field === 'transcript_s3_key' ? 'transcript' : 'resume';
  if (key && (!key.startsWith(`${userId}/${kind}-`) || !/^\d+\/(transcript|resume)-[a-f0-9-]+\.pdf$/.test(key))) invalid(field, 'ประเภทเอกสารและเจ้าของต้องตรงกับบัญชีที่เข้าสู่ระบบ');
  return key;
}

export const ROLES = ['student', 'advisor', 'staff', 'company'];
export const STATUSES = ['submitted', 'approved', 'rejected', 'accepted', 'declined', 'confirmed', 'released', 'withdrawn'];

export function courseGrades(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 50) invalid('course_grades', 'เกรดรายวิชาต้องเป็น object ไม่เกิน 50 วิชา');
  for (const [code, grade] of Object.entries(value)) {
    if (!/^คพ\.\d{3}$/.test(code)) invalid('course_grades', 'รหัสรายวิชาไม่ถูกต้อง');
    if (!['A','B+','B','C+','C','D+','D','F','IP'].includes(grade)) invalid('course_grades', `เกรดของ ${code} ไม่ถูกต้อง`);
  }
  return value;
}

export function declarations(value) {
  const keys = ['mustPass', 'discipline', 'accept'];
  object(value, keys);
  return Object.fromEntries(keys.map((key) => [key, value[key] === undefined ? false : boolean(value[key], key)]));
}
