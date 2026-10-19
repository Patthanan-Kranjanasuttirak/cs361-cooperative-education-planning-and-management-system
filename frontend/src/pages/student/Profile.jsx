import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { useApi } from '../../hooks/useApi';
import { api, uploadDocument } from '../../services/api';
import { COOP_CRITERIA, curriculumFor, curriculumLabel, qualificationChecks } from '../../config/coopCriteria';
import ApiState from '../../components/ApiState';
import FileInput from '../../components/FileInput';
import DocumentLink from '../../components/DocumentLink';
import CourseGradesFields from '../../components/CourseGradesFields';
import SaveSuccessDialog from '../../components/SaveSuccessDialog';
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
    <h2 id="qualification-alert-title">ข้อมูลคุณสมบัติไม่ถูกต้องหรือไม่ครบถ้วน</h2>
    <p id="qualification-alert-description">ยังไม่สามารถบันทึกได้ กรุณาแก้ไขรายการต่อไปนี้ให้ผ่านเกณฑ์ก่อน</p>
    <ul>{errors.map((message) => <li key={message}>{message}</li>)}</ul>
    <div className="profile-validation-actions"><button type="button" className="profile-submit" onClick={onClose} autoFocus>กลับไปแก้ไข</button></div>
  </dialog>;
}

function ProfileForm({ profile, onSaved }) {
  const [gpax, setGpax] = useState(profile.gpax ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  // หลักสูตรตามปีรหัส: ถึงปี 65 → 61, ตั้งแต่ปี 66 → 66
  const curriculum = curriculumFor(profile.username);
  const [grades, setGrades] = useState(profile.course_grades ?? {});
  const [declarations, setDeclarations] = useState({ mustPass: false, discipline: false, accept: false, ...profile.declarations });
  const [file, setFile] = useState(null);
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [validationErrors, setValidationErrors] = useState(null);
  const locked = profile.qualification_locked;
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
    if (saving || saved) return;
    setNotice('');
    const errors = locked ? [] : checks.filter(([passed]) => !passed).map(([, label]) => label);
    if (file && (file.type !== 'application/pdf' || file.size === 0 || file.size > 4 * 1024 * 1024)) errors.push('เลือกไฟล์ PDF ที่ไม่ว่างและมีขนาดไม่เกิน 4 MB');
    if (errors.length) { setValidationErrors(errors); return; }
    setSaving(true);
    try {
      const key = file ? (await uploadDocument(file, 'transcript')).key : profile.transcript_s3_key;
      const body = locked ? { phone } : { gpax: Number(gpax), phone, curriculum, course_grades: grades, declarations, transcript_s3_key: key };
      const result = await api('/students/me', { method: 'PUT', body });
      onSaved(result); setFile(null);
      setSaved(true);
    } catch (error) {
      if (error.status === 422) setValidationErrors(error.details ? Object.values(error.details).flat() : [error.message]);
      else setNotice(error.message);
    }
    finally { setSaving(false); }
  };
  return <section>
    <h1 className="profile-title">ข้อมูลส่วนตัว</h1>
    {validationErrors && <QualificationAlert errors={validationErrors} onClose={() => setValidationErrors(null)} />}
    {saved && <SaveSuccessDialog to="/student/apply" nextPageLabel="สมัครสหกิจศึกษา" />}
    {notice && <p role="status" className="app-banner">{notice}</p>}
    {locked && <p className="profile-hint">ข้อมูลคุณสมบัติถูกใช้ในใบสมัครที่อนุมัติแล้ว หากต้องแก้ไขกรุณาติดต่อเจ้าหน้าที่ ส่วนเบอร์โทรศัพท์ยังแก้ไขได้</p>}
    <form className="profile-form" onSubmit={save} noValidate>
      <fieldset className="profile-section">
        <legend className="profile-section-title">ข้อมูลทั่วไป</legend>
        <dl className="profile-readonly">{[
          ['รหัสนักศึกษา', profile.username], ['หลักสูตร', curriculumLabel(curriculum)], ['ชื่อ-นามสกุล', profile.th_name], ['ชื่อภาษาอังกฤษ', profile.en_name],
          ['อีเมล', profile.email], ['อาจารย์ที่ปรึกษา', profile.advisor_name],
        ].map(([label, value]) => <div key={label} className="profile-readonly-row"><dt>{label}</dt><dd>{value || '—'}</dd></div>)}</dl>
      </fieldset>
      <fieldset className="profile-section" disabled={saving}>
        <legend className="profile-section-title">ข้อมูลติดต่อ</legend>
        <label className="profile-label" htmlFor="profile-phone">เบอร์โทรศัพท์</label>
        <input id="profile-phone" className="profile-input" type="tel" maxLength={20} value={phone} onChange={(e) => setPhone(e.target.value)} />
      </fieldset>
      <fieldset className="profile-section" disabled={saving || locked}>
        <legend className="profile-section-title">ผลการเรียน</legend>
        <label className="profile-label" htmlFor="profile-gpax">GPAX</label>
        <input id="profile-gpax" className="profile-input" type="number" min="0" max="4" step="0.01" value={gpax} onChange={(e) => setGpax(e.target.value)} />
        <p className="profile-hint">เกณฑ์ขั้นต่ำ {COOP_CRITERIA.minGpax.toFixed(2)}</p>
        <label className="profile-label" htmlFor="profile-transcript">ใบแสดงผลการเรียน (PDF ไม่เกิน 4 MB)</label>
        <FileInput id="profile-transcript" accept="application/pdf" fileName={file?.name} onChange={(e) => setFile(e.target.files[0] ?? null)} disabled={saving || locked} />
        <DocumentLink url={profile.transcript_s3_key ? `/documents/${encodeURIComponent(profile.transcript_s3_key)}` : null} label="ดูเอกสารที่บันทึกไว้" />
      </fieldset>
      <CourseGradesFields curriculum={curriculum} grades={grades} onGradeChange={changeGrade} disabled={saving || locked} />
      {rule && <fieldset className="profile-section" disabled={saving || locked}>
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
        {!locked && <p className="profile-hint profile-hint-warn">ต้องผ่านเงื่อนไขทั้งหมดก่อนจึงจะบันทึกข้อมูลได้</p>}
      </div>
      <button className="profile-submit" type="submit" disabled={saving || saved}>{saving ? 'กำลังบันทึก…' : saved ? 'บันทึกแล้ว' : 'บันทึกข้อมูลคุณสมบัติ'}</button>
    </form>
  </section>;
}

export default function Profile() {
  const { updateUser } = useAuth();
  const { data: profile, setData, loading, error } = useApi('/students/me', null);
  if (!profile) return <section><h1 className="profile-title">ข้อมูลส่วนตัว</h1><ApiState loading={loading} error={error} /></section>;
  return <ProfileForm key={profile.student_id} profile={profile} onSaved={(result) => { setData(result); updateUser(result); }} />;
}
