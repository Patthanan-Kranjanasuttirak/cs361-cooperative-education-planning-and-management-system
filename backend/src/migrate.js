import { readdirSync, readFileSync, existsSync } from "node:fs";
import { getPool } from "./config/db.js";

// โฟลเดอร์ใน zip: src/schema/init, src/schema/migrations, src/schema/seeds
const root = new URL("./schema/", import.meta.url);
const sqlIn = (dir) =>
  existsSync(new URL(`${dir}/`, root))
    ? readdirSync(new URL(`${dir}/`, root)).filter((f) => f.endsWith(".sql"))
    : [];
const LOCK_ID = 727274; // กันสองคนกด migrate พร้อมกัน

// event: { action: "migrate", seeds?: true, reset?: "yes-delete-everything" }
export async function migrate({ seeds = false, reset } = {}) {
  const pool = await getPool();
  // pool ใน db.js ตั้ง max=1: ใช้ client ตัวเดียวตลอด ห้ามเรียก pool.query ระหว่างที่ถือ client อยู่ (จะค้าง)
  const client = await pool.connect();
  const log = [];
  let locked = false;
  try {
    locked = (await client.query("SELECT pg_try_advisory_lock($1) AS ok", [LOCK_ID])).rows[0].ok;
    if (!locked) throw new Error("มี migration อื่นกำลังรันอยู่ รอสักครู่แล้วลองใหม่");

    if (reset === "yes-delete-everything") {
      await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
      log.push("RESET: ลบทุกอย่างใน schema public แล้ว");
    }
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations
      (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`);
    const done = new Set(
      (await client.query("SELECT filename FROM schema_migrations")).rows.map((r) => r.filename)
    );

    // init + migrations เรียงตามชื่อไฟล์ รันไฟล์ละครั้ง (ไฟล์ที่รันแล้วจะถูกข้าม)
    const files = ["init", "migrations"]
      .flatMap((d) => sqlIn(d).map((f) => ({ d, f })))
      // เพิ่ม { numeric: true } ป้องกันปัญหาเรียงลำดับไฟล์ 01 กับ 003
      .sort((a, b) => a.f.localeCompare(b.f, undefined, { numeric: true }));
      
    for (const { d, f } of files) {
      if (done.has(f)) continue;
      try {
        await client.query("BEGIN");
        await client.query(readFileSync(new URL(`${d}/${f}`, root), "utf8"));
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [f]);
        await client.query("COMMIT");
        log.push(`applied ${d}/${f}`);
      } catch (e) {
        await client.query("ROLLBACK");
        throw new Error(`ไฟล์ ${d}/${f}: ${e.message}`);
      }
    }

    // seeds รันเมื่อสั่งเท่านั้น และต้องเขียนให้รันซ้ำได้ (ON CONFLICT DO NOTHING)
    if (seeds) {
      for (const f of sqlIn("seeds").sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
        try {
          await client.query(readFileSync(new URL(`seeds/${f}`, root), "utf8"));
          log.push(`seed ${f}`);
        } catch (e) {
          throw new Error(`ไฟล์ seeds/${f}: ${e.message}`);
        }
      }
    }

    const t = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1"
    );
    return { log, tables: t.rows.map((r) => r.table_name) };
  } finally {
    if (locked) await client.query("SELECT pg_advisory_unlock($1)", [LOCK_ID]).catch(() => {});
    client.release();
  }
}