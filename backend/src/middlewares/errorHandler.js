import { HttpError } from "../utils/httpError.js";

// ไม่พบ route ที่เรียก
export function notFound(req, _res, next) {
  next(new HttpError(404, `Not found: ${req.method} ${req.originalUrl}`));
}

// ตัวจัดการ Error กลาง: HttpError ส่งข้อความกลับไปตามจริง
// error อื่น (เช่น ต่อ Database ไม่ได้) log ไว้ดูใน console / CloudWatch แล้วตอบข้อความกลาง ๆ ไม่เปิดเผยรายละเอียด
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  console.error(err);
  res.status(500).json({ message: "Internal server error" });
}
