// Error ที่มี HTTP status ติดมาด้วย ให้ errorHandler ส่ง status และข้อความนี้กลับไปให้ผู้ใช้
export class HttpError extends Error {
  constructor(statusCode, message, code = 'REQUEST_FAILED', details) {
    super(message);
    this.name = "HttpError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}
