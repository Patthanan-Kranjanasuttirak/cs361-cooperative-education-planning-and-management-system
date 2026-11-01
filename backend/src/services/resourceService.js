import { query, transaction } from '../config/db.js';
import { qualificationChecks } from '../config/coopCriteria.js';
import { QUALIFICATION_LOCK, SELECTION_COLUMNS, USER_COLUMNS, USER_JOINS, userById } from '../models/userModel.js';
import { HttpError } from '../utils/httpError.js';
import * as v from '../utils/validation.js';

const missing = () => { throw new HttpError(404, 'ไม่พบข้อมูล', 'NOT_FOUND'); };
const denied = () => { throw new HttpError(403, 'ไม่มีสิทธิ์เข้าถึงข้อมูลนี้', 'FORBIDDEN'); };
const conflict = (message) => { throw new HttpError(409, message, 'CONFLICT'); };

async function update(db, table, key, target, data) {
  const entries = Object.entries(data).filter(([, value]) => value !== undefined);
  if (!entries.length) v.invalid('body', 'กรุณาระบุข้อมูลที่ต้องการแก้ไข');
  const { rows } = await db.query(`UPDATE ${table} SET ${entries.map(([field], i) => `${field}=$${i + 1}`).join(',')} WHERE ${key}=$${entries.length + 1} RETURNING *`, [...entries.map(([, value]) => value), target]);
  return rows[0] ?? missing();
}

// บัญชีนักศึกษาสร้างและอัปเดตอัตโนมัติจากระบบ TU ตอนเข้าสู่ระบบ จึงไม่อยู่ในหน้าจัดการผู้ใช้งาน
const STUDENT_MANAGED = () => { throw new HttpError(403, 'บัญชีนักศึกษาสร้างอัตโนมัติเมื่อเข้าสู่ระบบด้วยบัญชี TU เจ้าหน้าที่จัดการไม่ได้', 'STUDENT_MANAGED_BY_TU'); };

export async function listUsers() {
  const { rows } = await query(`SELECT ${USER_COLUMNS} FROM users u ${USER_JOINS} WHERE u.role <> 'student' ORDER BY u.user_id`);
  return rows;
}

export async function saveUser(actor, userId, body) {
  v.object(body, ['auth_provider', 'username', 'cognito_sub', 'role', 'th_name', 'en_name', 'email', 'phone', 'is_active', 'company_id', 'job_title']);
  return transaction(async (db) => {
    let old;
    if (userId) {
      const result = await db.query('SELECT * FROM users WHERE user_id=$1 FOR UPDATE', [userId]);
      old = result.rows[0] ?? missing();
      if (old.role === 'student') STUDENT_MANAGED();
      if (body.role !== undefined && body.role !== old.role) v.invalid('role', 'ไม่สามารถเปลี่ยนบทบาทของบัญชีเดิม');
      if (userId === actor.user_id && body.is_active === false) conflict('ไม่สามารถปิดบัญชีของตนเอง');
    }
    const role = v.enumeration(body.role ?? old?.role, 'role', v.ROLES);
    if (role === 'student') STUDENT_MANAGED();
    const required = !old;
    const data = {};
    for (const [key, max] of [['username', 50], ['th_name', 255], ['en_name', 255], ['auth_provider', 10]]) {
      if (required || body[key] !== undefined) data[key] = v.text(body[key] ?? (key === 'auth_provider' ? (process.env.AUTH_MODE === 'development' && process.env.NODE_ENV !== 'production' && !process.env.AWS_LAMBDA_FUNCTION_NAME ? 'dev' : 'cognito') : undefined), key, max);
    }
    if (required || body.email !== undefined) {
      data.email = v.email(body.email);
      // อีเมลใช้เข้าสู่ระบบและผูกบัญชี Cognito ต้องไม่ซ้ำ ไม่อย่างนั้นทั้งสองบัญชีจะเข้าระบบไม่ได้
      const taken = await db.query('SELECT 1 FROM users WHERE lower(email)=$1 AND user_id IS DISTINCT FROM $2', [data.email, userId ?? null]);
      if (taken.rows.length) conflict('อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว');
    }
    if (body.phone !== undefined) data.phone = v.phone(body.phone);
    if (body.cognito_sub !== undefined) data.cognito_sub = v.text(body.cognito_sub, 'cognito_sub', 64, { nullable: true });
    if (body.is_active !== undefined) data.is_active = v.boolean(body.is_active, 'is_active');
    if (!old) {
      const entries = Object.entries({ ...data, role });
      const result = await db.query(`INSERT INTO users (${entries.map(([key]) => key).join(',')}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(',')}) RETURNING user_id`, entries.map(([, value]) => value));
      userId = result.rows[0].user_id;
    } else if (Object.keys(data).length) await update(db, 'users', 'user_id', userId, data);
    if (role === 'company') {
      const existing = await db.query('SELECT * FROM company_users WHERE user_id=$1', [userId]);
      const companyId = v.id(body.company_id === undefined ? existing.rows[0]?.company_id : body.company_id, 'company_id');
      const company = await db.query('SELECT company_id FROM companies WHERE company_id=$1 FOR SHARE', [companyId]);
      if (!company.rows.length) v.invalid('company_id', 'ไม่พบสถานประกอบการ');
      const job = body.job_title === undefined ? existing.rows[0]?.job_title ?? null : v.text(body.job_title, 'job_title', 150, { nullable: true });
      await db.query('INSERT INTO company_users (user_id, company_id, job_title) VALUES ($1,$2,$3) ON CONFLICT (user_id) DO UPDATE SET company_id=EXCLUDED.company_id, job_title=EXCLUDED.job_title', [userId, companyId, job]);
    } else if (body.company_id !== undefined || body.job_title !== undefined) v.invalid('role', 'ข้อมูลความสัมพันธ์ไม่ตรงกับบทบาท');
    return userById(userId, db);
  });
}

// เจ้าหน้าที่เห็นนักศึกษาทุกคน กรรมการเห็นเฉพาะคนที่สมัครแผนสหกิจศึกษาแล้ว
export async function listStudents(actor) {
  const { rows } = await query(`SELECT ${USER_COLUMNS}, ${SELECTION_COLUMNS}, u.username AS student_code,
      (SELECT count(*)::int FROM applications a WHERE a.student_id=s.student_id) AS application_count,
      (SELECT count(*)::int FROM applications a WHERE a.student_id=s.student_id AND a.status='submitted') AS pending_count,
      (SELECT json_build_object('status',a.status,'company_name',c.name,'position_name',p.name,'changed_at',
         COALESCE((SELECT max(h.changed_at) FROM application_history h WHERE h.application_id=a.application_id),a.submitted_at))
       FROM applications a JOIN positions p ON p.position_id=a.position_id JOIN companies c ON c.company_id=p.company_id
       WHERE a.student_id=s.student_id ORDER BY (a.status='confirmed') DESC,
         COALESCE((SELECT max(h.changed_at) FROM application_history h WHERE h.application_id=a.application_id),a.submitted_at) DESC LIMIT 1) AS latest
    FROM users u ${USER_JOINS} WHERE u.role='student'
      AND ($1='staff' OR ($1='committee' AND s.profile_status IS NOT NULL)) ORDER BY u.username`, [actor.role]);
  return rows;
}

// นักศึกษาเห็นเฉพาะของตัวเองและไม่เห็นผลคัดกรอง/คัดเลือก ส่วนกรรมการเห็นเฉพาะคนที่สมัครแผนแล้ว
export async function studentProfile(actor, studentId, db = { query }) {
  const reviewer = actor.role === 'staff' || actor.role === 'committee';
  const { rows } = await db.query(`SELECT ${USER_COLUMNS}, ${reviewer ? `${SELECTION_COLUMNS}, ` : ''}u.username AS student_code
    FROM users u ${USER_JOINS} WHERE s.student_id=$1`, [studentId]);
  const student = rows[0] ?? missing();
  const allowed = actor.role === 'staff' || (actor.role === 'committee' && student.profile_status != null) || (actor.role === 'student' && student.user_id === actor.user_id);
  if (!allowed) denied();
  return student;
}

// ข้อมูลส่วนตัวที่นักศึกษาต้องกรอกครบก่อนบันทึก: ช่อง → ข้อความเมื่อยังว่าง
const PERSONAL_FIELDS = {
  cv_s3_key: 'กรุณาอัปโหลดไฟล์ CV', photo_s3_key: 'กรุณาอัปโหลดรูปนักศึกษา', address: 'กรุณากรอกที่อยู่', major: 'กรุณาเลือกกลุ่มวิชาเอก',
  guardian_name: 'กรุณากรอกชื่อ-นามสกุลผู้ปกครอง', guardian_relation: 'กรุณากรอกความสัมพันธ์กับนักศึกษา',
  guardian_address: 'กรุณากรอกที่อยู่ผู้ปกครอง', guardian_phone: 'กรุณากรอกเบอร์โทรศัพท์ผู้ปกครอง',
};

const LOCK_MESSAGES = {
  announced: 'ประกาศผลการคัดเลือกเข้าแผนสหกิจศึกษาแล้ว ไม่สามารถแก้ไขข้อมูลคุณสมบัติได้ กรุณาติดต่อเจ้าหน้าที่',
  selecting: 'กรรมการกำลังคัดเลือกเข้าแผนสหกิจศึกษา ไม่สามารถแก้ไขข้อมูลคุณสมบัติได้ กรุณาติดต่อเจ้าหน้าที่',
  application: 'ข้อมูลคุณสมบัติถูกใช้ในใบสมัครที่บริษัทรับแล้ว กรุณาติดต่อเจ้าหน้าที่เพื่อแก้ไข',
};

export async function saveStudent(actor, studentId, body) {
  const fields = ['gpax', 'phone', 'transcript_s3_key', 'curriculum', 'course_grades', 'declarations', ...Object.keys(PERSONAL_FIELDS)];
  v.object(body, fields);
  return transaction(async (db) => {
    // username = เลขทะเบียน ใช้ตรวจชั้นปีและหลักสูตรใน qualificationChecks
    const result = await db.query('SELECT s.*, u.username FROM students s JOIN users u USING (user_id) WHERE s.student_id=$1 FOR UPDATE OF s', [studentId]);
    const student = result.rows[0] ?? missing();
    if (actor.role !== 'staff' && !(actor.role === 'student' && student.user_id === actor.user_id)) denied();
    const data = {};
    if (body.gpax !== undefined) data.gpax = v.gpax(body.gpax);
    for (const key of ['transcript_s3_key', 'cv_s3_key', 'photo_s3_key']) if (body[key] !== undefined) data[key] = v.documentKey(body[key], key, student.user_id);
    for (const [key, max] of [['address', 1000], ['guardian_name', 255], ['guardian_relation', 100], ['guardian_address', 1000]]) {
      if (body[key] !== undefined) data[key] = v.text(body[key], key, max, { nullable: true });
    }
    if (body.major !== undefined) data.major = body.major === null ? null : v.enumeration(body.major, 'major', ['CIS', 'ACS']);
    if (body.guardian_phone !== undefined) data.guardian_phone = v.phone(body.guardian_phone, 'guardian_phone');
    if (body.curriculum !== undefined) data.curriculum = body.curriculum === null ? null : v.enumeration(body.curriculum, 'curriculum', ['61', '66']);
    if (body.course_grades !== undefined) data.course_grades = v.courseGrades(body.course_grades);
    if (body.declarations !== undefined) data.declarations = v.declarations(body.declarations);
    const sameGrades = (left, right) => JSON.stringify(Object.entries(left ?? {}).sort()) === JSON.stringify(Object.entries(right ?? {}).sort());
    const qualificationChanged = (data.gpax !== undefined && data.gpax !== (student.gpax == null ? null : Number(student.gpax))) ||
      (data.transcript_s3_key !== undefined && data.transcript_s3_key !== student.transcript_s3_key) ||
      (data.curriculum !== undefined && data.curriculum !== student.curriculum) ||
      (data.course_grades !== undefined && !sameGrades(data.course_grades, student.course_grades)) ||
      (data.declarations !== undefined && Object.keys(data.declarations).some((key) => data.declarations[key] !== Boolean(student.declarations?.[key])));
    if (actor.role === 'student') {
      // ข้อมูลคุณสมบัติถูกล็อก (QUALIFICATION_LOCK) แต่ข้อมูลติดต่อ/ส่วนตัวยังแก้ได้
      // รอกรรมการที่กำลังตัดสินพร้อมกัน ไม่ให้แก้คุณสมบัติเล็ดลอดหลังกรรมการเริ่มคัดเลือก
      await db.query('SELECT pg_advisory_xact_lock_shared($1, $2)', SELECTION_LOCK);
      const lock = (await db.query(`SELECT ${QUALIFICATION_LOCK} AS lock FROM students s WHERE s.student_id=$1`, [studentId])).rows[0].lock;
      const locked = lock != null;
      if (locked && qualificationChanged) conflict(LOCK_MESSAGES[lock]);
      if (!locked) {
        const failures = qualificationChecks({ ...student, ...data }).filter(([passed]) => !passed).map(([, label]) => label);
        if (failures.length) throw new HttpError(422, 'ข้อมูลคุณสมบัติไม่ถูกต้องหรือไม่ครบถ้วน ไม่สามารถบันทึกได้', 'INELIGIBLE', { qualification: failures });
      }
      // บันทึกครั้งแรก = ส่งข้อมูลแล้ว รอประกาศผลการคัดเลือกเข้าแผนสหกิจศึกษา
      if (student.profile_status == null) data.profile_status = 'pending';
      const incomplete = Object.entries(PERSONAL_FIELDS).filter(([key]) => (data[key] === undefined ? student[key] : data[key]) == null).map(([, message]) => message);
      if (incomplete.length) throw new HttpError(422, 'กรุณากรอกข้อมูลส่วนตัวให้ครบถ้วน', 'VALIDATION_ERROR', { profile: incomplete });
    }
    if (Object.keys(data).length) await update(db, 'students', 'student_id', studentId, data);
    if (body.phone !== undefined) await db.query('UPDATE users SET phone=$1 WHERE user_id=$2', [v.phone(body.phone), student.user_id]);
    return userById(student.user_id, db);
  });
}

// ---- คัดเลือกเข้าแผนสหกิจศึกษา ----
// รอบปัจจุบัน = นักศึกษาที่สมัครแผนแล้วแต่ยังไม่ประกาศผล
const CANDIDATE = 's.profile_status IS NOT NULL AND s.coop_result IS NULL';
const RESULT = ['passed', 'failed'];
// advisory lock ของการคัดเลือก: กรรมการตัดสิน/ประกาศผล = exclusive, นักศึกษาบันทึกข้อมูล = shared
const SELECTION_LOCK = [361, 10];

async function lockCandidate(db, studentId) {
  const student = (await db.query('SELECT * FROM students WHERE student_id=$1 FOR UPDATE', [studentId])).rows[0] ?? missing();
  if (student.profile_status == null) conflict('นักศึกษายังไม่ได้สมัครแผนสหกิจศึกษา');
  return student;
}

// เจ้าหน้าที่คัดกรองเบื้องต้น: passed | failed | null และโน้ตถึงกรรมการ (นักศึกษาไม่เห็น)
export async function screenStudent(actor, studentId, body) {
  v.object(body, ['screening_status', 'screening_note']);
  const data = {};
  if (body.screening_status !== undefined) data.screening_status = body.screening_status === null ? null : v.enumeration(body.screening_status, 'screening_status', RESULT);
  if (body.screening_note !== undefined) data.screening_note = v.text(body.screening_note, 'screening_note', 10000, { nullable: true });
  if (!Object.keys(data).length) v.invalid('body', 'กรุณาระบุผลคัดกรองหรือโน้ต');
  return transaction(async (db) => {
    await lockCandidate(db, studentId);
    await update(db, 'students', 'student_id', studentId, { ...data, screening_by: actor.user_id, screening_at: new Date() });
    return studentProfile(actor, studentId, db);
  });
}

// กรรมการเลือกผ่าน/ไม่ผ่าน (null = ยังไม่ตัดสิน) ได้จนกว่าเจ้าหน้าที่จะประกาศผลคนนั้น
export async function decideStudent(actor, studentId, body) {
  v.object(body, ['committee_result']);
  const result = body.committee_result === null ? null : v.enumeration(body.committee_result, 'committee_result', RESULT);
  return transaction(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock($1, $2)', SELECTION_LOCK);
    const student = await lockCandidate(db, studentId);
    if (student.coop_result != null) conflict('ประกาศผลของนักศึกษาคนนี้แล้ว');
    await db.query('UPDATE students SET committee_result=$1, committee_by=$2, committee_at=$3 WHERE student_id=$4',
      [result, result && actor.user_id, result && new Date(), studentId]);
    return studentProfile(actor, studentId, db);
  });
}

// จำนวนผู้สมัครแผนที่ยังไม่ประกาศผล แยกตามผลของกรรมการ
export async function selection() {
  const { rows } = await query(`SELECT count(*)::int AS candidates,
      count(*) FILTER (WHERE committee_result='passed')::int AS passed,
      count(*) FILTER (WHERE committee_result='failed')::int AS failed,
      count(*) FILTER (WHERE committee_result IS NULL)::int AS undecided
    FROM students s WHERE ${CANDIDATE}`);
  return rows[0];
}

// เจ้าหน้าที่ประกาศผล (committee_result → coop_result ที่นักศึกษาเห็น) ได้ทันทีที่กรรมการตัดสิน
// student_ids = ประกาศเฉพาะคนที่เลือก, ไม่ส่ง = ประกาศทุกคนที่กรรมการตัดสินแล้ว
export async function announceResults(actor, body = {}) {
  v.object(body, ['student_ids']);
  let ids = null;
  if (body.student_ids !== undefined) {
    if (!Array.isArray(body.student_ids) || !body.student_ids.length || body.student_ids.length > 1000) v.invalid('student_ids', 'กรุณาเลือกนักศึกษาที่ต้องการประกาศผล');
    ids = body.student_ids.map((id) => v.id(id, 'student_ids'));
  }
  return transaction(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock($1, $2)', SELECTION_LOCK);
    const { rowCount } = await db.query(`UPDATE students s SET coop_result=committee_result, coop_result_by=$1, coop_result_at=now()
      WHERE ${CANDIDATE} AND committee_result IS NOT NULL AND ($2::int[] IS NULL OR student_id=ANY($2))`, [actor.user_id, ids]);
    if (!rowCount) conflict('ไม่มีนักศึกษาที่กรรมการคัดเลือกแล้วและรอประกาศผล');
    return { announced: rowCount };
  });
}

// รายชื่อนักศึกษาที่ประกาศว่าผ่านเข้าแผนสหกิจศึกษา
export async function passedStudents() {
  const { rows } = await query(`SELECT u.username AS student_code, u.th_name, u.en_name, s.major, s.curriculum, s.gpax::float8 AS gpax,
      u.email, u.phone, s.coop_result_at
    FROM students s JOIN users u USING(user_id) WHERE s.coop_result='passed' ORDER BY u.username`);
  return rows;
}

export async function terms() {
  const { rows } = await query(`SELECT term_id,code,to_char(plan_open_at,'YYYY-MM-DD') AS plan_open_at,
    to_char(plan_close_at,'YYYY-MM-DD') AS plan_close_at,to_char(coop_start,'YYYY-MM-DD') AS coop_start,
    to_char(coop_end,'YYYY-MM-DD') AS coop_end,is_active FROM terms ORDER BY coop_start DESC`);
  return rows;
}

export async function saveTerm(termId, body) {
  v.object(body, ['code', 'plan_open_at', 'plan_close_at', 'coop_start', 'coop_end']);
  const data = { code: v.text(body.code, 'code', 20) };
  if (!/^[123]\/25\d{2}$/.test(data.code)) v.invalid('code', 'รูปแบบภาคการศึกษาต้องเป็น เช่น 2/2569');
  for (const key of ['plan_open_at', 'plan_close_at', 'coop_start', 'coop_end']) data[key] = v.date(body[key], key);
  if (data.plan_close_at < data.plan_open_at || data.coop_end < data.coop_start) v.invalid('dates', 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม');
  if (termId) await update({ query }, 'terms', 'term_id', termId, data);
  else await query('INSERT INTO terms (code,plan_open_at,plan_close_at,coop_start,coop_end) VALUES ($1,$2,$3,$4,$5)', Object.values(data));
  return terms();
}

export async function activateTerm(termId) {
  await transaction(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(361, 34)');
    const target = await db.query('SELECT term_id FROM terms WHERE term_id=$1 FOR UPDATE', [termId]);
    if (!target.rows.length) missing();
    await db.query('UPDATE terms SET is_active=FALSE WHERE is_active');
    await db.query('UPDATE terms SET is_active=TRUE WHERE term_id=$1', [termId]);
  });
  return terms();
}

export async function companyProfile(actor, companyId, db = { query }) {
  if (actor.role === 'company' && actor.company_id !== companyId) denied();
  const { rows } = await db.query(`SELECT c.*, c.company_id AS id,
    to_char(application_start,'YYYY-MM-DD') AS application_start,to_char(application_end,'YYYY-MM-DD') AS application_end,
    COALESCE((SELECT json_agg(json_build_object('user_id',u.user_id,'th_name',u.th_name,'email',u.email,'phone',u.phone,'job_title',cu.job_title))
      FROM company_users cu JOIN users u USING(user_id) WHERE cu.company_id=c.company_id),'[]') AS coordinators
    FROM companies c WHERE c.company_id=$1`, [companyId]);
  return rows[0] ?? missing();
}

export async function saveCompany(actor, companyId, body) {
  if (actor.role === 'company' && (!companyId || actor.company_id !== companyId)) denied();
  v.object(body, ['name', 'logo', 'description', 'province', 'location', 'allowance', 'additional_info', 'additional_file', 'application_start', 'application_end']);
  return transaction(async (db) => {
    if (companyId) await db.query('SELECT company_id FROM companies WHERE company_id=$1 FOR UPDATE', [companyId]);
    const old = companyId ? await companyProfile(actor, companyId, db) : null;
    const data = { name: v.text(body.name ?? old?.name, 'name', 255) };
    for (const [key, max] of [['logo', 255], ['description', 20000], ['province', 100], ['location', 10000], ['allowance', 255], ['additional_info', 20000]]) {
      if (body[key] !== undefined) data[key] = v.text(body[key], key, max, { nullable: true });
    }
    if (body.additional_file !== undefined) {
      data.additional_file = v.text(body.additional_file, 'additional_file', 255, { nullable: true });
      // รับเฉพาะไฟล์ที่อัปโหลดผ่าน POST /company/details-file ของบริษัทนี้
      if (data.additional_file && !new RegExp(`^company-files/${companyId}/details-[a-f0-9-]{36}\\.pdf$`).test(data.additional_file)) v.invalid('additional_file', 'ไฟล์ไม่ถูกต้อง');
    }
    for (const key of ['application_start', 'application_end']) if (body[key] !== undefined) data[key] = v.date(body[key], key, true);
    const start = data.application_start === undefined ? old?.application_start : data.application_start;
    const end = data.application_end === undefined ? old?.application_end : data.application_end;
    if (start && end && end < start) v.invalid('application_end', 'วันปิดรับต้องไม่ก่อนวันเปิดรับ');
    if (companyId) await update(db, 'companies', 'company_id', companyId, data);
    else {
      const entries = Object.entries(data);
      const result = await db.query(`INSERT INTO companies (${entries.map(([key]) => key).join(',')}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(',')}) RETURNING company_id`, entries.map(([, value]) => value));
      companyId = result.rows[0].company_id;
    }
    return companyProfile(actor, companyId, db);
  });
}

export async function deleteCompany(companyId) {
  await transaction(async (db) => {
    const company = await db.query('SELECT company_id FROM companies WHERE company_id=$1 FOR UPDATE', [companyId]);
    if (!company.rows.length) missing();
    const linked = await db.query('SELECT 1 FROM company_users WHERE company_id=$1 UNION ALL SELECT 1 FROM applications a JOIN positions p USING(position_id) WHERE p.company_id=$1 LIMIT 1', [companyId]);
    if (linked.rows.length) conflict('ไม่สามารถลบสถานประกอบการที่มีผู้ประสานงานหรือใบสมัคร');
    await db.query('DELETE FROM companies WHERE company_id=$1', [companyId]);
  });
}

export async function positions(actor, companyId) {
  if (actor.role === 'company') {
    if (!actor.company_id || (companyId && companyId !== actor.company_id)) denied();
    companyId = actor.company_id;
  }
  const { rows } = await query(`SELECT p.*,p.position_id AS id,
    (SELECT count(*)::int FROM applications a WHERE a.position_id=p.position_id) AS applicant_count,
    (SELECT count(*)::int FROM applications a WHERE a.position_id=p.position_id AND a.status IN ('accepted','confirmed')) AS accepted_count
    FROM positions p WHERE ($1::int IS NULL OR p.company_id=$1) ORDER BY p.position_id`, [companyId ?? null]);
  return rows;
}

export async function savePosition(actor, positionId, body) {
  v.object(body, ['company_id', 'name', 'description', 'quota', 'term_id', 'is_open']);
  return transaction(async (db) => {
    const old = positionId ? (await db.query('SELECT * FROM positions WHERE position_id=$1 FOR UPDATE', [positionId])).rows[0] ?? missing() : null;
    const companyId = actor.role === 'company' ? actor.company_id : v.id(body.company_id ?? old?.company_id, 'company_id');
    if (!companyId || (actor.role === 'company' && (old && old.company_id !== companyId || body.company_id !== undefined && body.company_id !== companyId))) denied();
    if (old && body.company_id !== undefined && body.company_id !== old.company_id) v.invalid('company_id', 'ไม่สามารถย้ายตำแหน่งงานไปสถานประกอบการอื่น');
    const data = { name: v.text(body.name ?? old?.name, 'name', 255) };
    if (body.description !== undefined) data.description = v.text(body.description, 'description', 20000, { nullable: true });
    if (body.quota !== undefined) {
      if (body.quota !== null && (!Number.isInteger(body.quota) || body.quota < 0)) v.invalid('quota', 'จำนวนรับต้องเป็นจำนวนเต็มตั้งแต่ 0 หรือ null');
      if (old && body.quota !== null) {
        const accepted = await db.query("SELECT count(*)::int AS n FROM applications WHERE position_id=$1 AND status IN ('accepted','confirmed')", [positionId]);
        if (body.quota < accepted.rows[0].n) conflict('จำนวนรับต้องไม่น้อยกว่าจำนวนที่รับแล้ว');
      }
      data.quota = body.quota;
    }
    if (body.term_id !== undefined) data.term_id = v.id(body.term_id, 'term_id', true);
    if (old && data.term_id !== undefined && data.term_id !== old.term_id) {
      const apps = await db.query('SELECT 1 FROM applications WHERE position_id=$1 LIMIT 1', [positionId]);
      if (apps.rows.length) conflict('ไม่สามารถเปลี่ยนภาคของตำแหน่งที่มีใบสมัครแล้ว');
    }
    if (body.is_open !== undefined) data.is_open = v.boolean(body.is_open, 'is_open');
    if (positionId) return update(db, 'positions', 'position_id', positionId, data);
    const entries = Object.entries({ company_id: companyId, ...data });
    const result = await db.query(`INSERT INTO positions (${entries.map(([key]) => key).join(',')}) VALUES (${entries.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *,position_id AS id`, entries.map(([, value]) => value));
    return result.rows[0];
  });
}

export async function deletePosition(actor, positionId) {
  await transaction(async (db) => {
    const { rows } = await db.query('SELECT * FROM positions WHERE position_id=$1 FOR UPDATE', [positionId]);
    const position = rows[0] ?? missing();
    if (actor.role === 'company' && position.company_id !== actor.company_id) denied();
    const apps = await db.query('SELECT 1 FROM applications WHERE position_id=$1 LIMIT 1', [positionId]);
    if (apps.rows.length) conflict('ไม่สามารถลบตำแหน่งที่มีใบสมัครแล้ว');
    await db.query('DELETE FROM positions WHERE position_id=$1', [positionId]);
  });
}
