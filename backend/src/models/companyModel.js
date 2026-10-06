import { query } from "../config/db.js";

// คำสั่ง SQL ของตาราง companies
// ใช้ $1, $2 เสมอ (ห้ามต่อ string) เพื่อป้องกัน SQL injection

const COMPANY_COLUMNS = "id, name, logo, description, province, location";

// ค้นหาใน name, description, location, province (ไม่สนตัวพิมพ์เล็กใหญ่) และกรองตามจังหวัด
// ส่งค่าว่าง = ไม่กรองเงื่อนไขนั้น
export async function findAll({ search = "", province = "" } = {}) {
  const { rows } = await query(
    `SELECT ${COMPANY_COLUMNS}
     FROM companies
     WHERE ($1 = '' OR name ILIKE '%' || $1 || '%'
                    OR description ILIKE '%' || $1 || '%'
                    OR location ILIKE '%' || $1 || '%'
                    OR province ILIKE '%' || $1 || '%')
       AND ($2 = '' OR province = $2)
     ORDER BY id`,
    [search, province]
  );
  return rows;
}

export async function findById(id) {
  const { rows } = await query(
    `SELECT ${COMPANY_COLUMNS} FROM companies WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}
