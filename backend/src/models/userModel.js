import { query } from '../config/db.js';

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
