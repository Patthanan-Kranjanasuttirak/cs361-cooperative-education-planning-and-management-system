import pg from "pg";

// ตั้งค่าการเชื่อมต่อ Database
// - ในเครื่อง (Docker): ใช้ DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
// - บน AWS Lambda: ตั้ง DB_SECRET_ARN ให้ดึง username/password (และ host/dbname ถ้ามี) จาก Secrets Manager
async function loadConfig() {
  const config = {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };

  if (process.env.DB_SECRET_ARN) {
    // AWS SDK มีมาให้ใน Lambda runtime อยู่แล้ว ไม่ต้องติดตั้งเพิ่ม
    const { SecretsManagerClient, GetSecretValueCommand } = await import(
      "@aws-sdk/client-secrets-manager"
    );
    const client = new SecretsManagerClient({});
    const { SecretString } = await client.send(
      new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN })
    );
    const secret = JSON.parse(SecretString);

    config.host = secret.host ?? config.host;
    config.port = Number(secret.port) || config.port;
    config.user = secret.username ?? config.user;
    config.password = secret.password ?? config.password;
    config.database = secret.dbname ?? config.database;
  }

  return config;
}

// สร้าง pool ครั้งเดียวแล้วใช้ซ้ำ (บน Lambda จะถูกเก็บไว้นอก handler ใช้ connection เดิมข้าม request ได้)
// ค่าเริ่มต้น max: 1 เพราะ Lambda หนึ่งตัวรับทีละ request ช่วยลดปัญหา Too many connections ของ RDS
let poolPromise;

export function getPool() {
  if (!poolPromise) {
    poolPromise = loadConfig()
      .then(
        (config) =>
          new pg.Pool({
            ...config,
            max: Number(process.env.DB_POOL_MAX) || 1,
            idleTimeoutMillis: 60_000,
            connectionTimeoutMillis: 5_000,
            // RDS PostgreSQL 15+ บังคับใช้ SSL (Docker ในเครื่องตั้ง DB_SSL=false)
            ssl: process.env.DB_SSL === "false" ? false : { rejectUnauthorized: false },
          })
      )
      .catch((error) => {
        poolPromise = undefined; // ให้ลองใหม่ใน request ถัดไป
        throw error;
      });
  }
  return poolPromise;
}

export async function query(text, params) {
  const pool = await getPool();
  return pool.query(text, params);
}
