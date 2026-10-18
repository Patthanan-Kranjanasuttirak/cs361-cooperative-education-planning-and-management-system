import { HttpError } from "../utils/httpError.js";

// ไม่พบ route ที่เรียก
export function notFound(req, _res, next) {
  next(new HttpError(404, `Not found: ${req.method} ${req.path}`, 'NOT_FOUND'));
}

// ตัวจัดการ Error กลาง: HttpError ส่งข้อความกลับไปตามจริง
// error อื่น (เช่น ต่อ Database ไม่ได้) log ไว้ดูใน console / CloudWatch แล้วตอบข้อความกลาง ๆ ไม่เปิดเผยรายละเอียด
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = 500, code = 'INTERNAL_ERROR', message = 'Internal server error', details;
  if (err instanceof HttpError) {
    status = err.statusCode; code = err.code; message = err.message; details = err.details;
  } else if (err.type === 'entity.parse.failed') {
    status = 400; code = 'INVALID_JSON'; message = 'JSON ไม่ถูกต้อง';
  } else if (err.type === 'entity.too.large') {
    status = 413; code = 'PAYLOAD_TOO_LARGE'; message = 'ข้อมูลมีขนาดใหญ่เกินกำหนด';
  } else if (err.code === '23505') {
    status = 409; code = 'DUPLICATE'; message = 'มีข้อมูลซ้ำในระบบ';
  } else if (err.code === '23503') {
    status = 409; code = 'RELATED_DATA'; message = 'ข้อมูลที่อ้างอิงไม่มีอยู่หรือยังมีข้อมูลอื่นใช้งานอยู่';
  } else if (['23502', '23514', '22001', '22P02', '22003'].includes(err.code)) {
    status = 422; code = 'VALIDATION_ERROR'; message = 'ข้อมูลไม่ตรงตามข้อกำหนด';
  } else if (['40001', '40P01', '55P03'].includes(err.code)) {
    status = 409; code = 'TRANSACTION_CONFLICT'; message = 'มีการดำเนินการพร้อมกัน กรุณาลองใหม่';
  } else if (err.code === 'ECONNREFUSED' || err.code?.startsWith('08')) {
    status = 503; code = 'DATABASE_UNAVAILABLE'; message = 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้';
  }
  if (status >= 500) console.error({ request_id: req.requestId, code, message: err.message });
  res.status(status).json({ message, error: { code, message, ...(details ? { details } : {}), request_id: req.requestId } });
}
