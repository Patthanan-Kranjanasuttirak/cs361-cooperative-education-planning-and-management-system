import { readdirSync, readFileSync } from "node:fs";
import { query } from "./config/db.js"; // เปลี่ยนมา import query แทน

const dir = new URL("./schema/", import.meta.url);

export async function migrate() {
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await query(readFileSync(new URL(f, dir), "utf8")); // ลบ pool. ออก
  }
  
  const r = await query("select table_name from information_schema.tables where table_schema='public'"); // ลบ pool. ออก
  return r.rows.map((x) => x.table_name);
}