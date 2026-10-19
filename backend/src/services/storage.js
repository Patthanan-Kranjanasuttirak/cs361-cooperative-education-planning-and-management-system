import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { developmentAuth } from '../middlewares/auth.js';

// ที่เก็บไฟล์ (Transcript, เรซูเม่, โลโก้บริษัท)
// - ตั้ง FILE_BUCKET: เก็บใน S3 (Lambda ใช้ LabRole; Lambda ใน VPC ที่ไม่มี NAT ต้องมี S3 gateway endpoint)
// - โหมดพัฒนา: เก็บใน UPLOAD_DIR (ค่าเริ่มต้น .uploads) ที่ไม่เข้า git
// key เป็น path แบบ relative เช่น 12/transcript-<uuid>.pdf, company-logos/3/logo-<uuid>.png
// Lambda รับ request ได้ไม่เกิน 6 MB (ไฟล์ไบนารีถูกเข้ารหัส base64 ผ่าน API Gateway) จึงจำกัดไฟล์ที่ MAX_UPLOAD_BYTES
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const root = () => path.resolve(process.env.UPLOAD_DIR || '.uploads');
let sdk, s3;

async function bucket() {
  if (!s3) {
    sdk ??= await import('@aws-sdk/client-s3'); // มีมาให้ใน Lambda Node.js runtime
    s3 = new sdk.S3Client({});
  }
  return s3;
}

// สำหรับ test: แทน S3 client/คำสั่งด้วยของจำลอง
export function setS3ForTests(client, commands) {
  s3 = client;
  sdk = commands;
}

export const storageReady = () => Boolean(process.env.FILE_BUCKET) || developmentAuth();

export async function putFile(key, body, contentType) {
  if (process.env.FILE_BUCKET) {
    // IfNoneMatch: ไม่เขียนทับไฟล์เดิม (เหมือน flag wx ของ local)
    await (await bucket()).send(new sdk.PutObjectCommand({ Bucket: process.env.FILE_BUCKET, Key: key, Body: body, ContentType: contentType, IfNoneMatch: '*' }));
    return;
  }
  const target = path.join(root(), key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body, { flag: 'wx', mode: 0o600 });
}

// ไม่พบไฟล์คืน null
export async function getFile(key) {
  if (process.env.FILE_BUCKET) {
    try {
      const result = await (await bucket()).send(new sdk.GetObjectCommand({ Bucket: process.env.FILE_BUCKET, Key: key }));
      return Buffer.from(await result.Body.transformToByteArray());
    } catch (error) {
      if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) return null;
      throw error;
    }
  }
  try {
    return await readFile(path.join(root(), key));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
