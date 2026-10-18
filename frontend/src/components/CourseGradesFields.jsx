import { COOP_CRITERIA, GRADE_POINTS, IN_PROGRESS, evaluateCourses } from '../config/coopCriteria';
import '../pages/CSS/eligibility.css';

const choices = Object.keys(GRADE_POINTS);

export default function CourseGradesFields({ curriculum, grades = {}, disabled = false, onCurriculumChange, onGradeChange }) {
  const rule = COOP_CRITERIA.curricula[curriculum];
  const result = rule ? evaluateCourses(curriculum, grades) : null;
  const slots = (groups, allowInProgress) => groups.map((slot) => (
    <div key={slot.join()} className={`elig-slot${slot.length > 1 ? ' elig-slot--choice' : ''}`}>
      {slot.length > 1 && <p className="elig-slot-note">{slot.join(' หรือ ')} (เลือก 1 วิชา)</p>}
      {slot.map((code) => <div key={code} className="elig-course">
        <label className="elig-course-code" htmlFor={`grade-${code}`}>{code}</label>
        <select id={`grade-${code}`} className="profile-input elig-grade" value={grades[code] ?? ''}
          onChange={(event) => onGradeChange?.(code, event.target.value)} disabled={disabled}>
          <option value="">ไม่ได้ลงทะเบียนเรียน</option>
          {allowInProgress && <option value={IN_PROGRESS}>กำลังศึกษา</option>}
          {choices.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
        </select>
      </div>)}
    </div>
  ));

  return <>
    <fieldset className="profile-section" disabled={disabled}>
      <legend className="profile-section-title">หลักสูตร</legend>
      <label className="profile-label" htmlFor="profile-curriculum">หลักสูตรที่ศึกษา</label>
      <select id="profile-curriculum" className="profile-input" value={curriculum ?? ''}
        onChange={(event) => onCurriculumChange?.(event.target.value)}>
        <option value="">— เลือกหลักสูตร —</option>
        <option value="61">หลักสูตร พ.ศ. 2561</option>
        <option value="66">หลักสูตร พ.ศ. 2566</option>
      </select>
    </fieldset>
    {rule ? <>
      <fieldset className="profile-section" disabled={disabled}>
        <legend className="profile-section-title">วิชาที่ต้องเคยศึกษา</legend>
        <p className="profile-hint">กรอกเกรดที่ได้ หากเรียนซ้ำให้ใส่เกรดที่ดีที่สุด เกรดเฉลี่ยกลุ่มต้องไม่ต่ำกว่า {COOP_CRITERIA.minGroupAverage.toFixed(2)}</p>
        <div className="elig-grid">{slots(rule.completed, false)}</div>
        <p className="elig-average">
          <span className="elig-average-label">เกรดเฉลี่ยกลุ่มวิชา: </span>
          {result.average == null ? <span className="elig-average-pending">กรอกให้ครบทุกวิชาก่อน</span> :
            <span className={result.averagePasses ? 'elig-average--ok' : 'elig-average--no'}>{result.average.toFixed(2)} {result.averagePasses ? '✓ ผ่านเกณฑ์' : '✕ ต่ำกว่าเกณฑ์'}</span>}
        </p>
      </fieldset>
      <fieldset className="profile-section" disabled={disabled}>
        <legend className="profile-section-title">วิชาที่กำลังศึกษาหรือเคยศึกษา</legend>
        <div className="elig-grid">{slots(rule.inProgressOrCompleted, true)}</div>
      </fieldset>
    </> : <p className="profile-hint">เลือกหลักสูตรเพื่อแสดงรายวิชาที่ต้องกรอก</p>}
  </>;
}
