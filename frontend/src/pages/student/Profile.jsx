import { useState } from 'react';
import { useAuth } from '../../context/useAuth';
import FileInput from '../../components/FileInput';
import { isMobilePhone, normalizePhone } from '../../utils/phone';
import { COOP_CRITERIA, GRADE_POINTS, IN_PROGRESS, evaluateCourses } from '../../config/coopCriteria';
import { MIN_GPAX, isGpaxEligible } from '../../config/coopRules';
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/eligibility.css';
import '../CSS/companyPortal.css';

const MAX_TRANSCRIPT_MB = 10;
const GRADES = Object.keys(GRADE_POINTS);

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ตรงกับ students.gpax NUMERIC(3,2) CHECK 0–4 (ค่าว่าง = ยังไม่กรอก)
function parseGpax(value) {
  if (value === '') return { gpax: null, error: '' };
  const gpax = Number(value);
  if (!/^\d(\.\d{1,2})?$/.test(value) || gpax < 0 || gpax > 4) {
    return { gpax: null, error: 'GPAX ต้องอยู่ระหว่าง 0.00 – 4.00 (ทศนิยมไม่เกิน 2 ตำแหน่ง)' };
  }
  return { gpax, error: '' };
}

function CheckItem({ ok, children }) {
  return (
    <li className={`elig-check ${ok ? 'elig-check--ok' : 'elig-check--no'}`}>
      <span className="elig-check-icon" aria-hidden="true">{ok ? '✓' : '✕'}</span>
      <span>{children}</span>
    </li>
  );
}

function CourseSlot({ slot, grades, onChange, allowInProgress, disabled }) {
  const isChoice = slot.length > 1;
  return (
    <div className={`elig-slot${isChoice ? ' elig-slot--choice' : ''}`}>
      {isChoice && <p className="elig-slot-note">{slot.join(' หรือ ')} (เลือก 1 วิชา)</p>}
      {slot.map((code) => (
        <div key={code} className="elig-course">
          <label className="elig-course-code" htmlFor={`grade-${code}`}>{code}</label>
          <select
            id={`grade-${code}`}
            className="profile-input elig-grade"
            value={grades[code] ?? ''}
            onChange={(e) => onChange(code, e.target.value)}
            disabled={disabled}
          >
            <option value="">ไม่ได้ลงทะเบียนเรียน</option>
            {allowInProgress && <option value={IN_PROGRESS}>กำลังศึกษา</option>}
            {GRADES.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

export default function Profile() {
  const { user, updateUser } = useAuth();
  const saved = user.eligibility ?? null;
  const rule = COOP_CRITERIA.curricula[user.curriculum];

  // ข้อมูลทั่วไปแก้ไม่ได้ — TODO: ดึงจาก TU API (ชื่อ, อีเมล, อาจารย์ที่ปรึกษา, หลักสูตร) ตอน login แล้วเก็บลง users / students
  const general = [
    { label: 'ชื่อ-นามสกุล (ภาษาไทย)', value: user.th_name },
    { label: 'ชื่อ-นามสกุล (ภาษาอังกฤษ)', value: user.en_name },
    { label: 'อีเมล', value: user.email },
    { label: 'อาจารย์ที่ปรึกษา', value: user.advisor_name },
    { label: 'หลักสูตร', value: user.curriculum && `หลักสูตร พ.ศ. 25${user.curriculum}` },
  ];

  const [gpaxInput, setGpaxInput] = useState(user.gpax != null ? user.gpax.toFixed(2) : '');
  const [phone, setPhone] = useState(user.phone ?? '');
  const [grades, setGrades] = useState(saved?.grades ?? {});
  const [declarations, setDeclarations] = useState(saved?.declarations ?? { mustPass: false, discipline: false, accept: false });
  const [transcript, setTranscript] = useState(null);
  const [transcriptError, setTranscriptError] = useState('');
  const [editing, setEditing] = useState(!saved);

  const generalSection = (
    <fieldset className="profile-section">
      <legend className="profile-section-title">ข้อมูลทั่วไป</legend>
      <p className="profile-hint">ข้อมูลจากระบบของมหาวิทยาลัย</p>
      <dl className="profile-readonly">
        {general.map((item) => (
          <div key={item.label} className="profile-readonly-row">
            <dt className="profile-label">{item.label}</dt>
            <dd className="profile-readonly-value">{item.value || '—'}</dd>
          </div>
        ))}
      </dl>
    </fieldset>
  );

  if (!rule) {
    return (
      <section>
        <h1 className="profile-title">ข้อมูลส่วนตัว</h1>
        <div className="profile-form">
          {generalSection}
          <p className="profile-error">ไม่พบเกณฑ์สหกิจศึกษาของหลักสูตรนี้ กรุณาติดต่อเจ้าหน้าที่</p>
        </div>
      </section>
    );
  }

  const { gpax, error: gpaxError } = parseGpax(gpaxInput);
  const courses = evaluateCourses(user.curriculum, grades);
  const transcriptName = transcript?.name ?? saved?.transcript_name ?? null;
  const checks = [
    { ok: true, label: 'เป็นนักศึกษาสาขาวิชาวิทยาการคอมพิวเตอร์ (ตรวจจากข้อมูลมหาวิทยาลัย)' },
    {
      ok: courses.completedAll && courses.averagePasses,
      label: `เคยศึกษาวิชาที่กำหนดครบ และเกรดเฉลี่ยกลุ่มไม่ต่ำกว่า ${COOP_CRITERIA.minGroupAverage.toFixed(2)}` +
        (courses.average != null ? ` (ของคุณ ${courses.average.toFixed(2)})` : ''),
    },
    { ok: courses.inProgressAll, label: 'กำลังศึกษาหรือเคยศึกษาวิชาที่กำหนดครบ' },
    { ok: declarations.mustPass, label: `รับทราบว่าต้องสอบได้ ${rule.mustPassBeforeCoop} ก่อนออกปฏิบัติงาน` },
    {
      ok: isGpaxEligible(gpax),
      label: `GPAX ไม่ต่ำกว่า ${MIN_GPAX.toFixed(2)}` + (gpax != null ? ` (ของคุณ ${gpax.toFixed(2)})` : ' (ยังไม่กรอก)'),
    },
    { ok: declarations.discipline, label: 'ไม่เคยถูกลงโทษทางวินัยนักศึกษา' },
    { ok: declarations.accept, label: 'รับทราบเกณฑ์และยอมรับเงื่อนไขสหกิจศึกษา' },
    { ok: !!transcriptName, label: 'แนบใบแสดงผลการเรียน (Transcript) ให้เจ้าหน้าที่ตรวจสอบ' },
  ];
  const allPass = checks.every((c) => c.ok);
  // เบอร์มือถือ 10 หลักขึ้นต้นด้วย 0 — ไม่ใช่เกณฑ์สหกิจ แต่ต้องมีให้สถานประกอบการติดต่อ
  const phoneValid = isMobilePhone(phone);
  const canSubmit = allPass && phoneValid;

  const setGrade = (code, value) => setGrades((prev) => ({ ...prev, [code]: value || undefined }));
  const toggle = (name) => setDeclarations((prev) => ({ ...prev, [name]: !prev[name] }));

  const handleTranscript = (e) => {
    const file = e.target.files[0] ?? null;
    setTranscriptError('');
    if (file && file.type !== 'application/pdf') {
      setTranscriptError('รองรับเฉพาะไฟล์ PDF');
      e.target.value = '';
      return;
    }
    if (file && file.size > MAX_TRANSCRIPT_MB * 1024 * 1024) {
      setTranscriptError(`ไฟล์ต้องไม่เกิน ${MAX_TRANSCRIPT_MB} MB`);
      e.target.value = '';
      return;
    }
    setTranscript(file);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    // TODO: PUT /api/students/me { gpax, phone, grades, declarations } + อัปโหลด transcript ไป S3 (presigned URL)
    //   backend ต้องคำนวณเกณฑ์ซ้ำเอง ไม่เชื่อผลจากหน้าเว็บ แล้วตั้งสถานะ submitted ให้เจ้าหน้าที่ตรวจ
    updateUser({
      gpax,
      phone,
      eligibility: {
        status: 'submitted',
        grades,
        declarations,
        transcript_name: transcriptName,
        submitted_at: new Date().toISOString(),
      },
    });
    setEditing(false);
  };

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">ข้อมูลส่วนตัว</h1>
        <span className="app-term">เกณฑ์สหกิจศึกษา ปีการศึกษา {COOP_CRITERIA.academicYear}</span>
      </div>

      {saved && !editing && (
        <div className="elig-status">
          <p>
            <strong>ส่งให้เจ้าหน้าที่ตรวจสอบแล้ว</strong> เมื่อ {formatDateTime(saved.submitted_at)} — รอเจ้าหน้าที่ตรวจเทียบกับใบแสดงผลการเรียน
          </p>
          <button type="button" className="app-btn app-btn--ghost elig-edit" onClick={() => setEditing(true)}>
            แก้ไขและส่งใหม่
          </button>
        </div>
      )}

      <form className="profile-form" onSubmit={handleSubmit} noValidate>
        {generalSection}

        <fieldset className="profile-section">
          <legend className="profile-section-title">ข้อมูลติดต่อ</legend>
          <label className="profile-label" htmlFor="phone">เบอร์โทรศัพท์มือถือ <span className="profile-required">*</span></label>
          <input
            id="phone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            className={`profile-input cp-half${phone && !phoneValid ? ' profile-input--error' : ''}`}
            value={phone}
            onChange={(e) => setPhone(normalizePhone(e.target.value))}
            placeholder="เช่น 0812345678"
            disabled={!editing}
          />
          {phone && !phoneValid && <p className="profile-error">เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก ขึ้นต้นด้วย 0</p>}
        </fieldset>

        <fieldset className="profile-section">
          <legend className="profile-section-title">ผลการเรียน</legend>

          <label className="profile-label" htmlFor="gpax">GPAX <span className="profile-required">*</span></label>
          <input
            id="gpax"
            type="number"
            inputMode="decimal"
            min="0"
            max="4"
            step="0.01"
            className={`profile-input${gpaxError ? ' profile-input--error' : ''}`}
            value={gpaxInput}
            onChange={(e) => setGpaxInput(e.target.value)}
            placeholder="เช่น 3.25"
            disabled={!editing}
          />
          {gpaxError ? (
            <p className="profile-error">{gpaxError}</p>
          ) : (
            <p className="profile-hint">
              GPAX ต้องไม่ต่ำกว่า {MIN_GPAX.toFixed(2)}
              {gpax != null && !isGpaxEligible(gpax) && <span className="profile-hint-warn"> — ต่ำกว่าเกณฑ์</span>}
            </p>
          )}

          <label className="profile-label" htmlFor="transcript">
            ใบแสดงผลการเรียน (Transcript) <span className="profile-required">*</span>
          </label>
          <FileInput
            id="transcript"
            accept="application/pdf"
            onChange={handleTranscript}
            disabled={!editing}
            error={transcriptError}
            fileName={transcriptName}
          />
          {transcriptError && <p className="profile-error">{transcriptError}</p>}
          <p className="profile-hint">
            ไฟล์ PDF ขนาดไม่เกิน {MAX_TRANSCRIPT_MB} MB เพื่อให้เจ้าหน้าที่ใช้ตรวจสอบ
          </p>
        </fieldset>

        <fieldset className="profile-section">
          <legend className="profile-section-title">วิชาที่ต้องเคยศึกษา</legend>
          <p className="profile-hint">
            กรอกเกรดที่ได้ (หากเรียนซ้ำให้ใส่เกรดที่ดีที่สุด) เกรดเฉลี่ยของกลุ่มนี้ต้องไม่ต่ำกว่า {COOP_CRITERIA.minGroupAverage.toFixed(2)}
          </p>
          <div className="elig-grid">
            {rule.completed.map((slot) => (
              <CourseSlot key={slot.join()} slot={slot} grades={grades} onChange={setGrade} disabled={!editing} />
            ))}
          </div>
          <p className="elig-average">
            <span className="elig-average-label">เกรดเฉลี่ยกลุ่มวิชา:</span>{' '}
            {courses.average == null ? (
              <span className="elig-average-pending">กรอกให้ครบทุกวิชาก่อน</span>
            ) : (
              <span className={courses.averagePasses ? 'elig-average--ok' : 'elig-average--no'}>
                {courses.average.toFixed(2)} {courses.averagePasses ? '✓ ผ่านเกณฑ์' : '✕ ต่ำกว่าเกณฑ์'}
              </span>
            )}
          </p>
        </fieldset>

        <fieldset className="profile-section">
          <legend className="profile-section-title">วิชาที่กำลังศึกษาหรือเคยศึกษา</legend>
          <div className="elig-grid">
            {rule.inProgressOrCompleted.map((slot) => (
              <CourseSlot key={slot.join()} slot={slot} grades={grades} onChange={setGrade} allowInProgress disabled={!editing} />
            ))}
          </div>
        </fieldset>

        <fieldset className="profile-section">
          <legend className="profile-section-title">การรับทราบและยอมรับ</legend>
          <label className="elig-declare">
            <input type="checkbox" checked={declarations.mustPass} onChange={() => toggle('mustPass')} disabled={!editing} />
            <span>รับทราบว่าจะต้องสอบได้วิชา {rule.mustPassBeforeCoop} ก่อนออกไปปฏิบัติงานจริง ณ สถานประกอบการ</span>
          </label>
          <label className="elig-declare">
            <input type="checkbox" checked={declarations.discipline} onChange={() => toggle('discipline')} disabled={!editing} />
            <span>ข้าพเจ้ามีความประพฤติเรียบร้อย ไม่เคยถูกลงโทษทางวินัยนักศึกษา</span>
          </label>
          <label className="elig-declare">
            <input type="checkbox" checked={declarations.accept} onChange={() => toggle('accept')} disabled={!editing} />
            <span>รับทราบเกณฑ์และยอมรับว่าจะปฏิบัติตามเงื่อนไขและกระบวนการสหกิจศึกษาอย่างครบถ้วน</span>
          </label>
        </fieldset>

        <div className="profile-section elig-summary">
          <p className="profile-section-title elig-summary-title">สรุปคุณสมบัติผู้สมัครสหกิจศึกษา</p>
          <ul className="elig-checks">
            {checks.map((c) => (
              <CheckItem key={c.label} ok={c.ok}>{c.label}</CheckItem>
            ))}
          </ul>
        </div>

        {editing && (
          <div className="profile-actions">
            {!allPass ? (
              <p className="profile-hint">ต้องผ่านคุณสมบัติทุกข้อ</p>
            ) : (
              !phoneValid && <p className="profile-hint">กรุณากรอกเบอร์โทรศัพท์มือถือ</p>
            )}
            <button type="submit" className="profile-submit" disabled={!canSubmit}>
              ส่งให้เจ้าหน้าที่ตรวจสอบ
            </button>
          </div>
        )}
      </form>
    </section>
  );
}
