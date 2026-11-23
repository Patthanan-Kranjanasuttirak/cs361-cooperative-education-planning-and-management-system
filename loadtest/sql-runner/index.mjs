// Lambda ชั่วคราวสำหรับรัน loadtest/seed.sql หรือ cleanup.sql บน RDS ที่อยู่ใน private subnet
// วางใน VPC / subnet / security group เดียวกับ backend (sg-lambda) และตั้ง env DB_* เหมือน backend
// สั่งงานด้วย Test event ใน Console เท่านั้น (ไม่ต้องผูก API Gateway หรือ Function URL) ลบทิ้งหลังทดสอบเสร็จ
//   {"action": "seed", "confirm": "non-production"}
//   {"action": "cleanup"}
import { readFileSync } from 'node:fs';
import pg from 'pg';

const FILES = { seed: 'seed.sql', cleanup: 'cleanup.sql' };

export const handler = async (event = {}) => {
  const file = FILES[event.action];
  if (!file) throw new Error('action ต้องเป็น "seed" หรือ "cleanup"');
  if (event.action === 'seed' && event.confirm !== 'non-production') {
    throw new Error('seed ต้องส่ง "confirm": "non-production" (ห้ามใช้กับ Production)');
  }
  const client = new pg.Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionTimeoutMillis: 5_000,
    // เหมือน backend: RDS PostgreSQL 15+ บังคับ SSL
    ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    // seed.sql ตรวจค่านี้ใน session ก่อนเขียนข้อมูล
    if (event.action === 'seed') await client.query("SET loadtest.target = 'non-production'");
    const results = [].concat(await client.query(readFileSync(new URL(`./${file}`, import.meta.url), 'utf8')));
    // คืนตารางสรุปท้ายไฟล์ (จำนวนแถวที่สร้าง / ที่เหลือหลังลบ)
    return { action: event.action, result: results.filter((r) => r.rows?.length).at(-1)?.rows ?? [] };
  } finally {
    await client.end();
  }
};
