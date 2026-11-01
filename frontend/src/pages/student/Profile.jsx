import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { useApi } from '../../hooks/useApi';
import { api, uploadDocument } from '../../services/api';
import { COOP_CRITERIA, curriculumFor, curriculumLabel, qualificationChecks } from '../../config/coopCriteria';
import ApiState from '../../components/ApiState';
import FileInput from '../../components/FileInput';
import DocumentLink from '../../components/DocumentLink';
import CourseGradesFields from '../../components/CourseGradesFields';
import CoopResultBadge from '../../components/CoopResultBadge';
import StudentPhoto from '../../components/StudentPhoto';
import { MAJORS } from '../../config/majors';
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/eligibility.css';

function QualificationAlert({ errors, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    dialog.current.showModal();
    return () => { previousFocus?.focus(); };
  }, [errors]);
  return <dialog ref={dialog} className="profile-validation-dialog" role="alertdialog"
    aria-labelledby="qualification-alert-title" aria-describedby="qualification-alert-description" onClose={onClose}
    onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <h2 id="qualification-alert-title">ข้อมูลไม่ถูกต้องหรือไม่ครบถ้วน</h2>
    <p id="qualification-alert-description">ยังไม่สามารถบันทึกได้ กรุณาแก้ไขรายการต่อไปนี้ให้ผ่านเกณฑ์ก่อน</p>
    <ul>{errors.map((message) => <li key={message}>{message}</li>)}</ul>
    <div className="profile-validation-actions"><button type="button" className="profile-submit" onClick={onClose} autoFocus>กลับไปแก้ไข</button></div>
  </dialog>;
}

// สถานะสหกิจศึกษา: บันทึกข้อมูลแล้วรอเจ้าหน้าที่ประกาศผลการคัดเลือกเข้าแผน
function ReviewStatus({ profile }) {
  return <div className="profile-section profile-status-section">
    <p className="profile-section-title">สถานะสหกิจศึกษา</p>
    <dl className="profile-readonly"><div className="profile-readonly-row">
      <dt>ผลการคัดเลือกเข้าแผนสหกิจศึกษา</dt>
      <dd><CoopResultBadge student={profile} /></dd>
    </div></dl>
    <p className="profile-hint">นักศึกษาจะต้องผ่านการคัดเลือกเข้าแผนสหกิจศึกษาก่อนจึงจะสามารถยื่นใบสมัครได้ </p>
  </div>;
}

// เหตุที่แก้ข้อมูลคุณสมบัติไม่ได้ (qualification_lock จาก API)
const LOCK_REASONS = {
  announced: 'ประกาศผลการคัดเลือกเข้าแผนสหกิจศึกษาแล้ว',
  selecting: 'กรรมการกำลังคัดเลือกเข้าแผนสหกิจศึกษา',
  application: 'ข้อมูลคุณสมบัติถูกใช้ในใบสมัครที่บริษัทรับแล้ว',
};

const MAX_FILE_MB = 4;
const PHOTO_TYPES = ['image/jpeg', 'image/png'];
// ช่องข้อความที่ต้องกรอก: [ชื่อใน API, ชื่อที่แสดง]
const PERSONAL_TEXT = [
  ['address', 'ที่อยู่'], ['guardian_name', 'ชื่อ-นามสกุลผู้ปกครอง'], ['guardian_relation', 'ความสัมพันธ์กับนักศึกษา'],
  ['guardian_address', 'ที่อยู่ผู้ปกครอง'], ['guardian_phone', 'เบอร์โทรศัพท์ผู้ปกครอง'],
];

// ตรวจไฟล์ CV/รูป และช่องข้อมูลส่วนตัวที่บังคับกรอก (backend ตรวจซ้ำ)
function personalErrors(personal, profile, cvFile, photoFile) {
  const errors = [];
  if (!personal.major) errors.push('กรุณาเลือกกลุ่มวิชาเอก');
  for (const [key, label] of PERSONAL_TEXT) if (!personal[key].trim()) errors.push(`กรุณากรอก${label}`);
  if (!cvFile && !profile.cv_s3_key) errors.push('กรุณาอัปโหลดไฟล์ CV');
  else if (cvFile && (cvFile.type !== 'application/pdf' || cvFile.size === 0 || cvFile.size > MAX_FILE_MB * 1024 * 1024)) errors.push(`ไฟล์ CV ต้องเป็น PDF ที่ไม่ว่างและไม่เกิน ${MAX_FILE_MB} MB`);
  if (!photoFile && !profile.photo_s3_key) errors.push('กรุณาอัปโหลดรูปนักศึกษา');
  else if (photoFile && (!PHOTO_TYPES.includes(photoFile.type) || photoFile.size === 0 || photoFile.size > MAX_FILE_MB * 1024 * 1024)) errors.push(`รูปนักศึกษาต้องเป็น JPG หรือ PNG ไม่เกิน ${MAX_FILE_MB} MB`);
  return errors;
}

// สมัครแผนแล้วฟอร์มเป็นแบบดูอย่างเดียว ต้องกด "แก้ไขข้อมูล" ก่อนจึงจะแก้ได้
function ProfileForm({ profile, onSaved, onCancel }) {
  const submitted = Boolean(profile.profile_status);
  const [editing, setEditing] = useState(!submitted);
  const [gpax, setGpax] = useState(profile.gpax ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  // หลักสูตรตามปีรหัส: ถึงปี 65 → 61, ตั้งแต่ปี 66 → 66
  const curriculum = curriculumFor(profile.username);
  const [grades, setGrades] = useState(profile.course_grades ?? {});
  const [declarations, setDeclarations] = useState({ mustPass: false, discipline: false, accept: false, ...profile.declarations });
  const [file, setFile] = useState(null);
  const [personal, setPersonal] = useState(() => Object.fromEntries(['major', ...PERSONAL_TEXT.map(([key]) => key)].map((key) => [key, profile[key] ?? ''])));
  const [cvFile, setCvFile] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
  const changePersonal = (event) => setPersonal((previous) => ({ ...previous, [event.target.name]: event.target.value }));
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState(null);
  const locked = profile.qualification_locked;
  const readOnly = saving || !editing;
  const rule = COOP_CRITERIA.curricula[curriculum];
  const checks = qualificationChecks({ username: profile.username, gpax, curriculum, course_grades: grades, declarations, transcript_s3_key: file || profile.transcript_s3_key });
  const changeGrade = (code, value) => setGrades((previous) => {
    const next = { ...previous };
    if (value) next[code] = value;
    else delete next[code];
    return next;
  });
  const save = async (event) => {
    event.preventDefault();
    if (saving || !editing) return;
    setNotice('');
    const errors = [...personalErrors(personal, profile, cvFile, photoFile), ...(locked ? [] : checks.filter(([passed]) => !passed).map(([, label]) => label))];
    if (file && (file.type !== 'application/pdf' || file.size === 0 || file.size > 4 * 1024 * 1024)) errors.push('เลือกไฟล์ PDF ที่ไม่ว่างและมีขนาดไม่เกิน 4 MB');
    if (errors.length) { setValidationErrors(errors); return; }
    setSaving(true);
    try {
      const key = file ? (await uploadDocument(file, 'transcript')).key : profile.transcript_s3_key;
      const cv = cvFile ? (await uploadDocument(cvFile, 'cv')).key : profile.cv_s3_key;
      const photo = photoFile ? (await uploadDocument(photoFile, 'photo')).key : profile.photo_s3_key;
      const personalBody = { ...Object.fromEntries(Object.entries(personal).map(([name, value]) => [name, value.trim()])), cv_s3_key: cv, photo_s3_key: photo };
      const body = locked ? { phone, ...personalBody } : { gpax: Number(gpax), phone, curriculum, course_grades: grades, declarations, transcript_s3_key: key, ...personalBody };
      const result = await api('/students/me', { method: 'PUT', body });
      onSaved(result); setFile(null); setCvFile(null); setPhotoFile(null); setEditing(false);
      setNotice(submitted ? 'บันทึกการแก้ไขเรียบร้อยแล้ว' : 'สมัครแผนสหกิจศึกษาแล้ว รอประกาศผล');
    } catch (error) {
      if (error.status === 422) setValidationErrors(error.details ? Object.values(error.details).flat() : [error.message]);
      else setNotice(error.message);
    }
    finally { setSaving(false); }
  };
  return <section>
    <div className="profile-header">
      <h1 className="profile-title">ข้อมูลส่วนตัว</h1>
      {!editing && <button className="app-btn app-btn--primary" type="button" onClick={() => { setNotice(''); setEditing(true); }}>แก้ไขข้อมูล</button>}
    </div>
    {validationErrors && <QualificationAlert errors={validationErrors} onClose={() => setValidationErrors(null)} />}
    {notice && <p role="status" className="app-banner">{notice}</p>}
    <ReviewStatus profile={profile} />
    {locked && <p className="profile-hint">{LOCK_REASONS[profile.qualification_lock]} จึงแก้ไขข้อมูลคุณสมบัติไม่ได้ หากต้องแก้ไขกรุณาติดต่อเจ้าหน้าที่ ส่วนข้อมูลส่วนตัว ข้อมูลติดต่อ และข้อมูลผู้ปกครองยังแก้ไขได้</p>}
    <form className="profile-form" onSubmit={save} noValidate>
      <fieldset className="profile-section">
        <legend className="profile-section-title">ข้อมูลทั่วไป</legend>
        {/* ปิดเฉพาะช่องกรอก ปุ่มดูเอกสารยังกดได้ตอนดูอย่างเดียว */}
        <fieldset className="profile-fields" disabled={readOnly}>
        <div className="student-info">
          <StudentPhoto s3Key={profile.photo_s3_key} file={photoFile} />
          <div className="student-info-body">
            <dl className="profile-readonly">{[
              ['รหัสนักศึกษา', profile.username], ['หลักสูตร', curriculumLabel(curriculum)], ['ชื่อ-นามสกุล', profile.th_name], ['ชื่อภาษาอังกฤษ', profile.en_name],
              ['อีเมล', profile.email],
            ].map(([label, value]) => <div key={label} className="profile-readonly-row"><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
            <label className="profile-label" htmlFor="profile-photo">รูปนักศึกษา (JPG หรือ PNG ไม่เกิน {MAX_FILE_MB} MB) <span className="profile-required">*</span></label>
            <FileInput id="profile-photo" accept={PHOTO_TYPES.join(',')} fileName={photoFile?.name} onChange={(e) => setPhotoFile(e.target.files[0] ?? null)} disabled={readOnly} />
          </div>
        </div>
        <label className="profile-label" htmlFor="profile-major">กลุ่มวิชาเอก <span className="profile-required">*</span></label>
        <select id="profile-major" name="major" className="profile-input" value={personal.major} onChange={changePersonal}>
          <option value="">— เลือกกลุ่มวิชาเอก —</option>
          {Object.entries(MAJORS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <label className="profile-label" htmlFor="profile-cv">ไฟล์ CV (PDF ไม่เกิน {MAX_FILE_MB} MB) <span className="profile-required">*</span></label>
        <FileInput id="profile-cv" accept="application/pdf" fileName={cvFile?.name} onChange={(e) => setCvFile(e.target.files[0] ?? null)} disabled={readOnly} />
        </fieldset>
        {profile.cv_s3_key && <DocumentLink url={`/documents/${encodeURIComponent(profile.cv_s3_key)}`} label="ดู CV ที่บันทึกไว้" />}
        <p className="profile-hint">สามารถใช้เป็นCVเริ่มต้นสำหรับสมัครสหกิจศึกษาได้</p>
      </fieldset>
      <fieldset className="profile-section" disabled={readOnly}>
        <legend className="profile-section-title">ข้อมูลติดต่อ</legend>
        <label className="profile-label" htmlFor="profile-phone">เบอร์โทรศัพท์</label>
        <input id="profile-phone" className="profile-input" type="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label className="profile-label" htmlFor="profile-address">ที่อยู่ <span className="profile-required">*</span></label>
        <textarea id="profile-address" name="address" rows={3} className="profile-input" maxLength={1000} value={personal.address} onChange={changePersonal} />
      </fieldset>
      <fieldset className="profile-section" disabled={readOnly}>
        <legend className="profile-section-title">ข้อมูลผู้ปกครอง</legend>
        <label className="profile-label" htmlFor="profile-guardian-name">ชื่อ-นามสกุลผู้ปกครอง <span className="profile-required">*</span></label>
        <input id="profile-guardian-name" name="guardian_name" className="profile-input" maxLength={255} value={personal.guardian_name} onChange={changePersonal} />
        <label className="profile-label" htmlFor="profile-guardian-relation">ความสัมพันธ์กับนักศึกษา <span className="profile-required">*</span></label>
        <input id="profile-guardian-relation" name="guardian_relation" className="profile-input" maxLength={100} placeholder="เช่น บิดา มารดา" value={personal.guardian_relation} onChange={changePersonal} />
        <label className="profile-label" htmlFor="profile-guardian-address">ที่อยู่ผู้ปกครอง <span className="profile-required">*</span></label>
        <textarea id="profile-guardian-address" name="guardian_address" rows={3} className="profile-input" maxLength={1000} value={personal.guardian_address} onChange={changePersonal} />
        <label className="profile-label" htmlFor="profile-guardian-phone">เบอร์โทรศัพท์ผู้ปกครอง <span className="profile-required">*</span></label>
        <input id="profile-guardian-phone" name="guardian_phone" className="profile-input" type="tel" maxLength={20} value={personal.guardian_phone} onChange={changePersonal} />
      </fieldset>
      <fieldset className="profile-section">
        <legend className="profile-section-title">ผลการเรียน</legend>
        <fieldset className="profile-fields" disabled={readOnly || locked}>
        <label className="profile-label" htmlFor="profile-gpax">GPAX</label>
        <input id="profile-gpax" className="profile-input" type="number" min="0" max="4" step="0.01" value={gpax} onChange={(e) => setGpax(e.target.value)} />
        <p className="profile-hint">เกณฑ์ขั้นต่ำ {COOP_CRITERIA.minGpax.toFixed(2)}</p>
        <label className="profile-label" htmlFor="profile-transcript">ใบแสดงผลการเรียน (PDF ไม่เกิน 4 MB)</label>
        <FileInput id="profile-transcript" accept="application/pdf" fileName={file?.name} onChange={(e) => setFile(e.target.files[0] ?? null)} disabled={readOnly || locked} />
        </fieldset>
        {profile.transcript_s3_key && <DocumentLink url={`/documents/${encodeURIComponent(profile.transcript_s3_key)}`} label="ดูเอกสารที่บันทึกไว้" />}
      </fieldset>
      <CourseGradesFields curriculum={curriculum} grades={grades} onGradeChange={changeGrade} disabled={readOnly || locked} />
      {rule && <fieldset className="profile-section" disabled={readOnly || locked}>
        <legend className="profile-section-title">การรับทราบและยอมรับ</legend>
        {[
          ['mustPass', `รับทราบว่าต้องสอบได้วิชา ${rule.mustPassBeforeCoop} ก่อนออกไปปฏิบัติงานจริง`],
          ['discipline', 'ไม่เคยถูกลงโทษทางวินัยนักศึกษา'],
          ['accept', 'รับทราบเกณฑ์และยอมรับเงื่อนไขสหกิจศึกษา'],
        ].map(([key, label]) => <label key={key} className="elig-declare"><input type="checkbox" checked={declarations[key]} onChange={(event) => setDeclarations((previous) => ({ ...previous, [key]: event.target.checked }))} /><span>{label}</span></label>)}
      </fieldset>}
      <div className="profile-section">
        <p className="profile-section-title">ผลตรวจคุณสมบัติเบื้องต้น</p>
        <ul className="elig-checks">{checks.map(([passed, label]) => <li key={label} className={`elig-check ${passed ? 'elig-check--ok' : 'elig-check--no'}`}><span className="elig-check-icon" aria-hidden="true">{passed ? '✓' : '✕'}</span><span>{label}</span></li>)}</ul>
        <p className="profile-hint">ผลเบื้องต้นคำนวณจากข้อมูลที่กรอก ผู้ตรวจจะพิจารณารายวิชาและคุณสมบัติอื่นจาก Transcript อีกครั้ง</p>
        {!locked && <p className="profile-hint profile-hint-warn">ต้องข้อมูลให้ครบถ้วนและผ่านเงื่อนไขทั้งหมดก่อนจึงจะสามารถสมัครเข้าแผนสหกิจศึกษาได้</p>}
      </div>
      {editing && <div className="profile-actions">
        <button className="profile-submit" type="submit" disabled={saving}>{saving ? 'กำลังบันทึก…' : submitted ? 'บันทึกการแก้ไข' : 'สมัครแผนสหกิจศึกษา'}</button>
        {submitted && <button className="app-btn profile-cancel" type="button" onClick={onCancel} disabled={saving}>ยกเลิก</button>}
      </div>}
    </form>
  </section>;
}

export default function Profile() {
  const { updateUser } = useAuth();
  const { data: profile, setData, loading, error } = useApi('/students/me', null);
  // ยกเลิกการแก้ไข = สร้างฟอร์มใหม่จากข้อมูลที่บันทึกไว้
  const [formKey, setFormKey] = useState(0);
  if (!profile) return <section><h1 className="profile-title">ข้อมูลส่วนตัว</h1><ApiState loading={loading} error={error} /></section>;
  return <ProfileForm key={`${profile.student_id}-${formKey}`} profile={profile} onSaved={(result) => { setData(result); updateUser(result); }} onCancel={() => setFormKey((key) => key + 1)} />;
}
