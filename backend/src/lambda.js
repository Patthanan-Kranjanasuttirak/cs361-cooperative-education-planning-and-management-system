import serverless from "serverless-http";
import app from "./app.js";
import { VERIFIED_COGNITO_CLAIMS } from './middlewares/auth.js';

// รัน API บน AWS Lambda (API Gateway → Lambda)
// ตั้งค่า Handler ของ Lambda เป็น: src/lambda.handler
// app และ connection pool ถูกสร้างนอก handler จึงใช้ซ้ำได้ระหว่าง request
export const handler = serverless(app, {
  request(req, event) {
    const authorizer = event.requestContext?.authorizer;
    req[VERIFIED_COGNITO_CLAIMS] = authorizer?.jwt?.claims ?? authorizer?.claims;
  },
});
