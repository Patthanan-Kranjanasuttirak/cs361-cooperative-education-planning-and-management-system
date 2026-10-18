import { query, transaction } from '../config/db.js';
import { curriculumFor } from '../config/coopCriteria.js';

export const USER_COLUMNS = `u.user_id, u.auth_provider, u.username, u.role, u.th_name, u.en_name,
  u.email, u.phone, u.is_active, s.student_id, s.gpax::float8 AS gpax,
  s.transcript_s3_key, s.advisor_id, advisor.th_name AS advisor_name,
  s.curriculum, s.course_grades, s.declarations,
  EXISTS (SELECT 1 FROM applications a WHERE a.student_id=s.student_id AND a.status IN ('approved','accepted','confirmed')) AS qualification_locked,
  cu.company_id, cu.job_title`;
export const USER_JOINS = `LEFT JOIN students s ON s.user_id=u.user_id
  LEFT JOIN users advisor ON advisor.user_id=s.advisor_id
  LEFT JOIN company_users cu ON cu.user_id=u.user_id`;

export async function userById(userId, db = { query }) {
  const { rows } = await db.query(`SELECT ${USER_COLUMNS} FROM users u ${USER_JOINS} WHERE u.user_id=$1`, [userId]);
  return rows[0] ?? null;
}

export async function userBySubject(subject) {
  const { rows } = await query('SELECT user_id FROM users WHERE cognito_sub=$1', [subject]);
  return rows[0] ? userById(rows[0].user_id) : null;
}

// identities มาเป็น array ใน ID token แต่ API Gateway ส่ง claims ที่เป็น array มาเป็น string
function identityProviders(claims) {
  let identities = claims.identities;
  if (typeof identities === 'string') {
    try { identities = JSON.parse(identities); } catch { return []; }
  }
  return Array.isArray(identities) ? identities.map((i) => i?.providerName) : [];
}

// เข้าสู่ระบบครั้งแรก: เจ้าหน้าที่ลงทะเบียนบัญชีไว้ก่อน แต่ sub ของ Cognito เพิ่งเกิดตอน login จึงผูกให้ครั้งเดียว
// - Google (ผู้ประสานงาน): ใช้อีเมลที่ Google ยืนยันแล้วจาก ID token
// - TU (นักศึกษา/อาจารย์/เจ้าหน้าที่): Cognito username = TU username ที่ Verify Auth Challenge ตรวจกับ TU API แล้ว
// ผูกเฉพาะเมื่อตรงกับบัญชีเดียวที่ยังไม่เคยผูก ถ้าซ้ำหรือไม่พบจะไม่ผูกและได้ 403
export async function bindCognitoUser(claims) {
  let condition, value;
  if (identityProviders(claims).includes('Google')) {
    const verified = claims.email_verified === true || claims.email_verified === 'true';
    if (claims.token_use !== 'id' || !verified || typeof claims.email !== 'string') return null;
    condition = "role='company' AND lower(email)=lower($2)";
    value = claims.email;
  } else {
    const username = claims['cognito:username'] ?? claims.username;
    if (typeof username !== 'string' || !username) return null;
    condition = "role IN ('student','advisor','staff') AND lower(username)=lower($2)";
    value = username;
  }
  const { rows } = await query(
    `UPDATE users SET cognito_sub=$1 WHERE user_id=(
       SELECT min(user_id) FROM users WHERE cognito_sub IS NULL AND auth_provider<>'dev' AND ${condition} HAVING count(*)=1
     ) RETURNING user_id`,
    [claims.sub, value]
  );
  return rows[0] ? userById(rows[0].user_id) : null;
}

// นักศึกษาที่ TU ยืนยันแล้ว: login ครั้งแรกสร้างบัญชีให้ (ชื่อจาก TU, หลักสูตรตามปีรหัส) ครั้งต่อไปใช้บัญชีเดิม
// ถ้าชื่อผู้ใช้นี้เป็นบัญชีบทบาทอื่นหรือถูกปิด คืน null
export async function provisionTuStudent(profile) {
  const userId = await transaction(async (db) => {
    const inserted = await db.query(
      `INSERT INTO users (auth_provider, username, role, th_name, en_name, email) VALUES ('tu', $1, 'student', $2, $3, $4)
       ON CONFLICT (username) DO NOTHING RETURNING user_id`,
      [profile.username, profile.th_name, profile.en_name, profile.email]
    );
    if (inserted.rows[0]) {
      await db.query('INSERT INTO students (user_id, curriculum) VALUES ($1, $2)', [inserted.rows[0].user_id, curriculumFor(profile.username)]);
      return inserted.rows[0].user_id;
    }
    const { rows } = await db.query("SELECT user_id FROM users WHERE username=$1 AND role='student' AND is_active", [profile.username]);
    return rows[0]?.user_id ?? null;
  });
  return userId ? userById(userId) : null;
}

// อาจารย์/เจ้าหน้าที่ที่ TU ยืนยันแล้ว: เข้าได้เมื่อเจ้าหน้าที่ลงทะเบียนไว้ โดย username หรืออีเมลตรงกับข้อมูลจาก TU
// ถ้าไม่พบหรือพบหลายบัญชีจะไม่เดา คืน null
export async function registeredTuStaff(username, emails) {
  const { rows } = await query(
    `SELECT user_id FROM users WHERE role IN ('advisor','staff') AND is_active
       AND (lower(username)=$1 OR lower(email)=ANY($2::text[]))`,
    [username, emails.filter(Boolean).map((email) => email.toLowerCase())]
  );
  return rows.length === 1 ? userById(rows[0].user_id) : null;
}
