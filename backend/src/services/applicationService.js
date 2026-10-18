import { query, transaction } from '../config/db.js';
import { HttpError } from '../utils/httpError.js';
import * as v from '../utils/validation.js';

const deny = () => { throw new HttpError(403, 'ไม่มีสิทธิ์เข้าถึงใบสมัครนี้', 'FORBIDDEN'); };
const conflict = (message) => { throw new HttpError(409, message, 'INVALID_TRANSITION'); };
const documentUrl = (key) => key ? `/documents/${encodeURIComponent(key)}` : null;

export async function applications(actor, filters = {}, db = { query }) {
  const applicationId = filters.application_id ?? null;
  const termId = filters.term_id ?? null;
  const status = filters.status ?? null;
  const studentId = filters.student_id ?? null;
  const { rows } = await db.query(`SELECT a.*,c.name AS company_name,p.name AS position_name,p.company_id,t.code AS term,
    json_build_object('student_id',s.student_id,'user_id',u.user_id,'student_code',u.username,
      'th_name',u.th_name,'gpax',s.gpax::float8,'curriculum',s.curriculum,'email',u.email,'phone',u.phone,'advisor_name',advisor.th_name) AS student,
    s.transcript_s3_key,
    COALESCE((SELECT json_agg(json_build_object('review_id',r.review_id,'reviewer_id',r.reviewer_id,
      'reviewer_name',reviewer.th_name,'reviewer_role',reviewer.role,'status',r.status,'comment',r.comment,'created_at',r.created_at) ORDER BY r.review_id)
      FROM application_reviews r JOIN users reviewer ON reviewer.user_id=r.reviewer_id WHERE r.application_id=a.application_id),'[]') AS reviews,
    COALESCE((SELECT json_agg(json_build_object('history_id',h.history_id,'from',h.from_status,'to',h.to_status,
      'by',changer.th_name,'at',h.changed_at,'position_id',h.position_id,'resume_s3_key',h.resume_s3_key) ORDER BY h.history_id)
      FROM application_history h LEFT JOIN users changer ON changer.user_id=h.changed_by WHERE h.application_id=a.application_id),'[]') AS history,
    (SELECT min(created_at) FROM application_reviews r WHERE r.application_id=a.application_id AND r.status='approved') AS approved_at
    FROM applications a JOIN students s USING(student_id) JOIN users u ON u.user_id=s.user_id
    LEFT JOIN users advisor ON advisor.user_id=s.advisor_id
    JOIN terms t ON t.term_id=a.term_id JOIN positions p ON p.position_id=a.position_id JOIN companies c ON c.company_id=p.company_id
    WHERE ($1::int IS NULL OR a.application_id=$1) AND ($2::int IS NULL OR a.term_id=$2)
      AND ($3::varchar IS NULL OR a.status=$3) AND ($4::int IS NULL OR a.student_id=$4)
      AND ($5='staff' OR ($5='student' AND u.user_id=$6) OR ($5='advisor' AND s.advisor_id=$6)
        OR ($5='company' AND p.company_id=$7 AND (a.status IN ('approved','accepted','declined','confirmed','released')
          OR (a.status='withdrawn' AND EXISTS (SELECT 1 FROM application_reviews r WHERE r.application_id=a.application_id AND r.status='approved')))))
    ORDER BY a.application_id DESC`, [applicationId, termId, status, studentId, actor.role, actor.user_id, actor.company_id ?? null]);
  return rows.map((row) => {
    row.resume_url = documentUrl(row.resume_s3_key);
    row.transcript_url = documentUrl(row.transcript_s3_key);
    if (actor.role === 'company') {
      row.reviews = [];
      row.history = row.history.filter((h) => ![null, 'submitted', 'rejected'].includes(h.to));
      if (!['approved', 'accepted', 'confirmed'].includes(row.status)) {
        row.student.email = null;
        row.student.phone = null;
        row.resume_url = null;
        row.transcript_url = null;
        row.resume_s3_key = null;
        row.transcript_s3_key = null;
        row.history = row.history.map((h) => ({ ...h, resume_s3_key: null }));
      }
    }
    return row;
  });
}

export async function application(actor, applicationId, db = { query }) {
  const rows = await applications(actor, { application_id: applicationId }, db);
  if (!rows.length) throw new HttpError(404, 'ไม่พบใบสมัครที่คุณมีสิทธิ์เข้าถึง', 'NOT_FOUND');
  return rows[0];
}

async function history(db, app, actor, from, to) {
  await db.query('INSERT INTO application_history (application_id,changed_by,from_status,to_status,position_id,resume_s3_key) VALUES ($1,$2,$3,$4,$5,$6)', [app.application_id, actor.user_id, from, to, app.position_id, app.resume_s3_key]);
}

function eligible(student) {
  if (student.gpax == null || Number(student.gpax) < 2.75 || !student.transcript_s3_key) {
    throw new HttpError(422, 'ต้องมี GPAX ตั้งแต่ 2.75 และใบแสดงผลการเรียนก่อนสมัคร/อนุมัติ', 'INELIGIBLE');
  }
}

async function lockStudent(db, applicationId) {
  const { rows } = await db.query('SELECT s.* FROM students s JOIN applications a USING(student_id) WHERE a.application_id=$1 FOR UPDATE OF s', [applicationId]);
  if (!rows.length) throw new HttpError(404, 'ไม่พบใบสมัคร', 'NOT_FOUND');
  return rows[0];
}

export async function createApplication(actor, body) {
  v.object(body, ['position_id', 'term_id', 'resume_s3_key']);
  const positionId = v.id(body.position_id, 'position_id');
  const resume = v.documentKey(body.resume_s3_key, 'resume_s3_key', actor.user_id);
  if (!resume) v.invalid('resume_s3_key', 'กรุณาแนบเรซูเม่');
  const requestedTerm = body.term_id === undefined ? null : v.id(body.term_id, 'term_id');
  return transaction(async (db) => {
    const student = (await db.query('SELECT * FROM students WHERE user_id=$1 FOR UPDATE', [actor.user_id])).rows[0];
    if (!student) deny();
    const position = (await db.query('SELECT * FROM positions WHERE position_id=$1 FOR SHARE', [positionId])).rows[0];
    if (!position) v.invalid('position_id', 'ไม่พบตำแหน่งงาน');
    const term = (await db.query(`SELECT *,((now() AT TIME ZONE 'Asia/Bangkok')::date BETWEEN plan_open_at AND plan_close_at) AS within_period
      FROM terms WHERE is_active AND ($1::int IS NULL OR term_id=$1) FOR SHARE`, [requestedTerm])).rows[0];
    if (!term) conflict('ไม่มีภาคการศึกษาที่เปิดใช้งานตรงกับที่ระบุ');
    const duplicate = (await db.query('SELECT * FROM applications WHERE student_id=$1 AND term_id=$2 AND position_id=$3', [student.student_id, term.term_id, positionId])).rows[0];
    if (duplicate) {
      if (duplicate.resume_s3_key !== resume) conflict('มีใบสมัครสำหรับตำแหน่งนี้ในภาคนี้แล้ว');
      return { created: false, application: await application(actor, duplicate.application_id, db) };
    }
    eligible(student);
    if (!student.advisor_id) v.invalid('advisor_id', 'กรุณาให้เจ้าหน้าที่กำหนดอาจารย์ที่ปรึกษา');
    if (!term.within_period || !position.is_open || position.term_id != null && position.term_id !== term.term_id) conflict('ตำแหน่งหรือภาคการศึกษาไม่อยู่ในช่วงเปิดรับ');
    const period = await db.query(`SELECT 1 FROM companies WHERE company_id=$1
      AND (application_start IS NULL OR application_start <= (now() AT TIME ZONE 'Asia/Bangkok')::date)
      AND (application_end IS NULL OR application_end >= (now() AT TIME ZONE 'Asia/Bangkok')::date) FOR SHARE`, [position.company_id]);
    if (!period.rows.length) conflict('สถานประกอบการไม่อยู่ในช่วงรับสมัคร');
    if ((await db.query("SELECT 1 FROM applications WHERE student_id=$1 AND term_id=$2 AND status='confirmed'", [student.student_id, term.term_id])).rows.length) conflict('คุณยืนยันสิทธิ์ในภาคการศึกษานี้แล้ว');
    const app = (await db.query('INSERT INTO applications (student_id,term_id,position_id,resume_s3_key) VALUES ($1,$2,$3,$4) RETURNING *', [student.student_id, term.term_id, positionId, resume])).rows[0];
    await history(db, app, actor, null, 'submitted');
    return { created: true, application: await application(actor, app.application_id, db) };
  });
}

export async function reviewApplication(actor, applicationId, body) {
  v.object(body, ['status', 'comment']);
  const status = v.enumeration(body.status, 'status', ['approved', 'rejected']);
  const comment = v.text(body.comment, 'comment', 10000, { nullable: true });
  if (status === 'rejected' && !comment) v.invalid('comment', 'กรุณาระบุเหตุผลที่ไม่อนุมัติ');
  return transaction(async (db) => {
    const student = await lockStudent(db, applicationId);
    if (actor.role !== 'staff' && student.advisor_id !== actor.user_id) deny();
    const app = (await db.query('SELECT * FROM applications WHERE application_id=$1 FOR UPDATE', [applicationId])).rows[0];
    if (app.status !== 'submitted') {
      const previous = await db.query('SELECT 1 FROM application_reviews WHERE application_id=$1 AND reviewer_id=$2 AND status=$3 AND comment IS NOT DISTINCT FROM $4', [applicationId, actor.user_id, status, comment]);
      if (app.status === status && previous.rows.length) return application(actor, applicationId, db);
      conflict('ใบสมัครถูกพิจารณาแล้ว');
    }
    if (status === 'approved') eligible(student);
    await db.query('INSERT INTO application_reviews (application_id,reviewer_id,status,comment) VALUES ($1,$2,$3,$4)', [applicationId, actor.user_id, status, comment]);
    await db.query('UPDATE applications SET status=$1 WHERE application_id=$2', [status, applicationId]);
    await history(db, app, actor, app.status, status);
    return application(actor, applicationId, db);
  });
}

export async function decideApplication(actor, applicationId, body) {
  v.object(body, ['status']);
  const status = v.enumeration(body.status, 'status', ['accepted', 'declined']);
  return transaction(async (db) => {
    await lockStudent(db, applicationId);
    const position = (await db.query('SELECT p.* FROM positions p JOIN applications a USING(position_id) WHERE a.application_id=$1 FOR UPDATE OF p', [applicationId])).rows[0];
    if (position.company_id !== actor.company_id) deny();
    const app = (await db.query('SELECT * FROM applications WHERE application_id=$1 FOR UPDATE', [applicationId])).rows[0];
    if (app.status === status) return application(actor, applicationId, db);
    if (app.status !== 'approved') conflict('พิจารณาได้เฉพาะใบสมัครที่ผ่านการอนุมัติแล้ว');
    await db.query('UPDATE applications SET status=$1 WHERE application_id=$2', [status, applicationId]);
    await history(db, app, actor, app.status, status);
    return application(actor, applicationId, db);
  });
}

export async function studentAction(actor, applicationId, action) {
  return transaction(async (db) => {
    const student = await lockStudent(db, applicationId);
    if (student.user_id !== actor.user_id) deny();
    const app = (await db.query('SELECT * FROM applications WHERE application_id=$1 FOR UPDATE', [applicationId])).rows[0];
    if (action === 'withdraw') {
      if (app.status === 'withdrawn') return application(actor, applicationId, db);
      if (!['submitted', 'approved'].includes(app.status)) conflict('ถอนใบสมัครได้เฉพาะระหว่างรอพิจารณา');
      await db.query("UPDATE applications SET status='withdrawn' WHERE application_id=$1", [applicationId]);
      await history(db, app, actor, app.status, 'withdrawn');
    } else {
      if (app.status === 'confirmed') return application(actor, applicationId, db);
      if (app.status !== 'accepted') conflict('ยืนยันสิทธิ์ได้เฉพาะใบสมัครที่ผ่านการคัดเลือก');
      const apps = (await db.query('SELECT * FROM applications WHERE student_id=$1 AND term_id=$2 ORDER BY application_id FOR UPDATE', [student.student_id, app.term_id])).rows;
      if (apps.some((a) => a.status === 'confirmed')) conflict('ยืนยันสิทธิ์ได้ที่เดียวต่อภาคการศึกษา');
      for (const row of apps) {
        const next = row.application_id === applicationId ? 'confirmed' : row.status === 'accepted' ? 'released' : ['submitted', 'approved'].includes(row.status) ? 'withdrawn' : row.status;
        if (next !== row.status) {
          await db.query('UPDATE applications SET status=$1 WHERE application_id=$2', [next, row.application_id]);
          await history(db, row, actor, row.status, next);
        }
      }
    }
    return application(actor, applicationId, db);
  });
}
