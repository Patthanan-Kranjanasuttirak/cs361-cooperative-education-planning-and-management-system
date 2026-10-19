import serverless from "serverless-http";
import app from "./app.js";
import { migrate } from "./migrate.js";
import { VERIFIED_COGNITO_CLAIMS } from './middlewares/auth.js';

// รัน API บน AWS Lambda (API Gateway → Lambda)
// ตั้งค่า Handler ของ Lambda เป็น: src/lambda.handler
// app และ connection pool ถูกสร้างนอก handler จึงใช้ซ้ำได้ระหว่าง request
// binary: ส่ง PDF/รูปกลับเป็น base64 (REST API ต้องตั้ง Binary media types เป็น */*)
const api = serverless(app, {
  binary: ['application/pdf', 'image/*'],
  request(req, event) {
    const authorizer = event.requestContext?.authorizer;
    req[VERIFIED_COGNITO_CLAIMS] = authorizer?.jwt?.claims ?? authorizer?.claims;
  },
});
// สั่ง migrate ด้วย test event { "action": "migrate" } ใน Lambda console
export const handler = async (event, context) =>
  event.action === "migrate" ? migrate(event) : api(event, context);
