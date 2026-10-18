import { query } from "../config/db.js";

// คำสั่ง SQL ของตาราง companies และ positions
// ใช้ $1, $2 เสมอ (ห้ามต่อ string) เพื่อป้องกัน SQL injection

// แสดงตำแหน่งที่ไม่ผูกภาคการศึกษา และตำแหน่งของภาคที่เปิดใช้งานอยู่
const ACTIVE_POSITIONS = `
  active_positions AS (
    SELECT p.* FROM positions p LEFT JOIN terms t ON t.term_id = p.term_id
    WHERE p.term_id IS NULL OR t.is_active
  )
`;

// คอลัมน์ที่ส่งกลับไปให้หน้าเว็บ
// - วันที่แปลงเป็นข้อความ YYYY-MM-DD (ถ้าส่งเป็น DATE ตรง ๆ pg จะแปลงเป็นเวลา UTC แล้ววันเพี้ยนได้)
// - positions รวมตำแหน่งที่ไม่ผูกภาคและตำแหน่งของภาคที่ active เรียงตามลำดับที่เพิ่ม
const COMPANY_COLUMNS = `
  c.company_id AS id, c.name, c.logo, c.description, c.province, c.location,
  to_char(c.application_start, 'YYYY-MM-DD') AS application_start,
  to_char(c.application_end, 'YYYY-MM-DD') AS application_end,
  COALESCE(
    (SELECT json_agg(json_build_object('id', p.position_id, 'name', p.name, 'description', p.description,
                                       'quota', p.quota, 'is_open', p.is_open) ORDER BY p.position_id)
     FROM active_positions p
     WHERE p.company_id = c.company_id),
    '[]'
  ) AS positions
`;

// ค้นหาใน name, province และชื่อตำแหน่งงาน (ไม่สนตัวพิมพ์เล็กใหญ่)
// แล้วกรองตามจังหวัด, ชื่อตำแหน่ง (ตรงทั้งคำ) และสถานะการรับสมัคร (open | upcoming | closed)
// ส่งค่าว่าง = ไม่กรองเงื่อนไขนั้น
// "วันนี้" ใช้เวลาประเทศไทย เพราะ RDS ตั้งเวลาเป็น UTC (ช่วงตี 0–7 วันที่จะยังเป็นของเมื่อวาน)
export async function findAll({ search = "", province = "", position = "", status = "" } = {}) {
  // escape ตัวอักษรพิเศษของ ILIKE (% _ \) ให้ค้นหาเป็นตัวอักษรธรรมดา ไม่ใช่ wildcard
  const searchPattern = search.replace(/[\\%_]/g, "\\$&");
  const { rows } = await query(
    `WITH today AS (SELECT (now() AT TIME ZONE 'Asia/Bangkok')::date AS d),
          ${ACTIVE_POSITIONS}
     SELECT ${COMPANY_COLUMNS}
     FROM companies c, today
     WHERE ($1 = '' OR c.name ILIKE '%' || $1 || '%'
                    OR c.province ILIKE '%' || $1 || '%'
                    OR EXISTS (SELECT 1 FROM active_positions p
                               WHERE p.company_id = c.company_id AND p.name ILIKE '%' || $1 || '%'))
       AND ($2 = '' OR c.province = $2)
       AND ($3 = '' OR EXISTS (SELECT 1 FROM active_positions p
                               WHERE p.company_id = c.company_id AND p.name = $3))
       AND ($4 = ''
            OR ($4 = 'open'     AND today.d BETWEEN c.application_start AND c.application_end)
            OR ($4 = 'upcoming' AND today.d < c.application_start)
            OR ($4 = 'closed'   AND today.d > c.application_end))
     ORDER BY c.company_id`,
    [searchPattern, province, position, status]
  );
  return rows;
}

export async function findById(id) {
  const { rows } = await query(
    `WITH ${ACTIVE_POSITIONS}
     SELECT ${COMPANY_COLUMNS} FROM companies c WHERE c.company_id = $1`,
    [id]
  );
  return rows[0] ?? null;
}
