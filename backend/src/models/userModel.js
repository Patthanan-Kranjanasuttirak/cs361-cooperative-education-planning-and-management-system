import { query, transaction } from '../config/db.js';
import { curriculumFor } from '../config/coopCriteria.js';
import { isCsStudentId, isMockLogin } from '../../cognito-triggers/verify-auth-challenge/index.mjs';

export const USER_COLUMNS = `u.user_id, u.auth_provider, u.username, u.role, u.th_name, u.en_name,
  u.email, u.phone, u.is_active, u.is_supervisor, s.student_id, s.gpax::float8 AS gpax,
  s.transcript_s3_key, s.advisor_id, advisor.th_name AS advisor_name,
  s.curriculum, s.course_grades, s.declarations,
  s.profile_status, s.profile_comment, s.profile_reviewed_at,
  s.conduct_status, s.conduct_comment, s.conduct_reviewed_at,
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

// เข้าสู่ระบบครั้งแรก: sub ของ Cognito เพิ่งเกิดตอน login จึงผูกกับบัญชีใน users ครั้งเดียว
// - Google (ผู้ประสานงาน): ใช้อีเมลที่ Google ยืนยันแล้วจาก ID token
// - บัญชี mock: Cognito username = อีเมลใน MOCK_LOGINS (Verify ตรวจ MOCK_PASSWORD แล้ว) ผูกกับบัญชีอีเมลนั้น รวมบัญชี dev ใน seed
// - TU (นักศึกษา/อาจารย์/เจ้าหน้าที่): Cognito username = TU username ที่ Verify Auth Challenge ตรวจกับ TU API แล้ว
//   นักศึกษาสาขาที่ยังไม่มีบัญชี สร้างให้จากชื่อ/อีเมลที่ Verify เก็บไว้ใน token
// ผูกเฉพาะเมื่อตรงกับบัญชีเดียวที่ยังไม่เคยผูก ถ้าซ้ำหรือไม่พบจะไม่ผูกและได้ 403
export async function bindCognitoUser(claims) {
  let condition, value, unbound = "cognito_sub IS NULL AND auth_provider<>'dev'";
  const username = claims['cognito:username'] ?? claims.username;
  if (identityProviders(claims).includes('Google')) {
    const verified = claims.email_verified === true || claims.email_verified === 'true';
    if (claims.token_use !== 'id' || !verified || typeof claims.email !== 'string') return null;
    condition = "role='company' AND lower(email)=lower($2)";
    value = claims.email;
  } else if (typeof username !== 'string' || !username) {
    return null;
  } else if (isMockLogin(username)) {
    // seed ใส่ cognito_sub เป็น dev:... ไว้ จึงยอมให้แทนที่ได้เฉพาะบัญชี mock
    unbound = "(cognito_sub IS NULL OR cognito_sub LIKE 'dev:%')";
    condition = 'lower(email)=lower($2)';
    value = username;
  } else {
    condition = "role IN ('student','advisor','staff') AND lower(username)=lower($2)";
    value = username;
  }
  const { rows } = await query(
    `UPDATE users SET cognito_sub=$1 WHERE user_id=(
       SELECT min(user_id) FROM users WHERE ${unbound} AND ${condition} HAVING count(*)=1
     ) RETURNING user_id`,
    [claims.sub, value]
  );
  if (rows[0]) return userById(rows[0].user_id);
  if (identityProviders(claims).includes('Google') || isMockLogin(username) || !isCsStudentId(username)) return null;
  const id = username.toLowerCase();
  return provisionTuStudent({
    username: id,
    th_name: claims.name || id,
    en_name: claims['custom:en_name'] || id,
    email: claims.email || `${id}@dome.tu.ac.th`,
  }, claims.sub);
}

// ชื่อจาก TU อาจยังไม่มากับ token ตอนเข้าครั้งแรก (Verify เก็บลง Cognito ไม่สำเร็จ) บัญชีจึงถูกสร้างด้วยรหัสนักศึกษาแทนชื่อ
// token รอบถัดไปมีชื่อแล้วให้เติมเฉพาะช่องที่ยังเป็นรหัสนักศึกษา ไม่ทับชื่อที่เจ้าหน้าที่แก้ไว้
export async function fillTuNames(user, claims) {
  if (user?.role !== 'student') return user;
  const placeholder = user.username.toLowerCase();
  const fill = (current, value) => current?.toLowerCase() === placeholder && typeof value === 'string' && value.trim() && value.trim().toLowerCase() !== placeholder ? value.trim() : null;
  const thName = fill(user.th_name, claims.name), enName = fill(user.en_name, claims['custom:en_name']);
  if (!thName && !enName) return user;
  await query('UPDATE users SET th_name=COALESCE($2, th_name), en_name=COALESCE($3, en_name) WHERE user_id=$1', [user.user_id, thName, enName]);
  return userById(user.user_id);
}

// นักศึกษาที่ TU ยืนยันแล้ว: login ครั้งแรกสร้างบัญชีให้ (ชื่อจาก TU, หลักสูตรตามปีรหัส) ครั้งต่อไปใช้บัญชีเดิม
// ถ้าชื่อผู้ใช้นี้เป็นบัญชีบทบาทอื่นหรือถูกปิด คืน null
// Cognito (มี cognitoSub): สร้างใหม่เท่านั้น บัญชีเดิมต้องผูกผ่าน bindCognitoUser
export async function provisionTuStudent(profile, cognitoSub = null) {
  const userId = await transaction(async (db) => {
    const inserted = await db.query(
      `INSERT INTO users (auth_provider, username, cognito_sub, role, th_name, en_name, email) VALUES ($1, $2, $3, 'student', $4, $5, $6)
       ON CONFLICT DO NOTHING RETURNING user_id`,
      [cognitoSub ? 'cognito' : 'tu', profile.username, cognitoSub, profile.th_name, profile.en_name, profile.email]
    );
    if (inserted.rows[0]) {
      await db.query('INSERT INTO students (user_id, curriculum) VALUES ($1, $2)', [inserted.rows[0].user_id, curriculumFor(profile.username)]);
      return inserted.rows[0].user_id;
    }
    if (cognitoSub) return null;
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
