import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import ApiState from '../../components/ApiState';
import CourseGradesFields from '../../components/CourseGradesFields';
import DocumentLink from '../../components/DocumentLink';
import GpaxValue from '../../components/GpaxValue';
import CoopResultBadge from '../../components/CoopResultBadge';
import StudentPersonalInfo from '../../components/StudentPersonalInfo';
import { curriculumLabel } from '../../config/coopCriteria';
import { COOP_STATUS, coopStatus } from '../../config/studentReview';
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/pendingApplications.css';
import '../CSS/myStudents.css';
import '../CSS/allApplications.css';

// ตัวกรองตามสถานะสหกิจศึกษา (ยังไม่บันทึกข้อมูล / รอประกาศผล / ผ่าน / ไม่ผ่าน)
const FILTERS = [
  ...['waiting', 'passed', 'failed', 'none'].map((key) => ({ key, label: COOP_STATUS[key].label, match: (s) => coopStatus(s) === key })),
  { key: 'all', label: 'ทั้งหมด', match: () => true },
];

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// เจ้าหน้าที่ดูข้อมูลนักศึกษาที่บันทึกแล้ว และประกาศผลการคัดเลือกเข้าแผนสหกิจศึกษา
export default function VerifyStudents() {
  const { data: students, setData, loading, error } = useApi('/students');
  const [filter, setFilter] = useState('waiting');
  const [search, setSearch] = useState('');
  const [openGrades, setOpenGrades] = useState(null);
  const [openInfo, setOpenInfo] = useState(null);
  const [notice, setNotice] = useState('');

  const active = students.filter((s) => s.is_active);
  const keyword = search.trim().toLowerCase();
  const visible = active.filter(
    (s) => FILTERS.find((f) => f.key === filter).match(s) &&
      (!keyword || s.th_name.toLowerCase().includes(keyword) || s.student_code.includes(keyword))
  );

  // ประกาศผลการคัดเลือกเข้าแผนสหกิจศึกษา ('' = กลับเป็นรอประกาศผล)
  const announce = async (student, value) => {
    setNotice('');
    try {
      const result = await api(`/students/${student.student_id}/coop-result`, { method: 'PUT', body: { coop_result: value || null } });
      setData((prev) => prev.map((s) => (s.student_id === student.student_id ? { ...s, ...result } : s)));
      setNotice(`บันทึกผลของ ${student.th_name}: ${COOP_STATUS[value || 'waiting'].label}`);
    } catch (err) { setNotice(err.message); }
  };

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">ประกาศผลสหกิจศึกษา</h1>
        <span className="app-term">รอประกาศผล {active.filter(FILTERS[0].match).length} คน</span>
      </div>

      <ApiState loading={loading} error={error} />
      {notice && <div className="app-banner" role="status">{notice}</div>}

      <div className="students-filters" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={`students-filter${filter === f.key ? ' students-filter--active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
            <span className="students-filter-count">{active.filter(f.match).length}</span>
          </button>
        ))}
      </div>

      <input
        className="pending-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ค้นหาชื่อ / รหัสนักศึกษา"
      />

      {visible.length === 0 ? (
        <div className="app-empty"><p>ไม่พบนักศึกษา</p></div>
      ) : (
        <ul className="app-list">
          {visible.map((s) => (
            <li key={s.student_id} className="app-card">
              <div className="pending-student">
                <div>
                  <p className="app-company">{s.th_name}</p>
                  <p className="pending-student-meta">
                    รหัส {s.student_code} · {curriculumLabel(s.curriculum)} · GPAX <GpaxValue gpax={s.gpax} />
                  </p>
                  <p className="pending-student-meta">
                    อ.ที่ปรึกษา {s.advisor_name ?? <Link to="/staff/users" className="students-pending-link">ยังไม่กำหนด</Link>}
                  </p>
                </div>
                <div>
                  <CoopResultBadge student={s} />
                </div>
              </div>

              <div className="pending-docs">
                <DocumentLink url={s.transcript_s3_key ? `/documents/${encodeURIComponent(s.transcript_s3_key)}` : null} label="ดู Transcript" />
                <button
                  type="button"
                  className="pending-doc"
                  aria-expanded={openInfo === s.student_id}
                  onClick={() => setOpenInfo(openInfo === s.student_id ? null : s.student_id)}
                >
                  {openInfo === s.student_id ? 'ซ่อนข้อมูลส่วนตัว' : 'ดูข้อมูลส่วนตัว'}
                </button>
                <button
                  type="button"
                  className="pending-doc"
                  aria-expanded={openGrades === s.student_id}
                  onClick={() => setOpenGrades(openGrades === s.student_id ? null : s.student_id)}
                >
                  {openGrades === s.student_id ? 'ซ่อนผลการเรียนรายวิชา' : 'ดูผลการเรียนรายวิชา'}
                </button>
              </div>
              {openInfo === s.student_id && <StudentPersonalInfo student={s} />}
              {openGrades === s.student_id && <CourseGradesFields curriculum={s.curriculum} grades={s.course_grades ?? {}} disabled />}

              {s.profile_status && (
                <label className="verify-coop-result">
                  <span className="pending-label">ผลการคัดเลือกเข้าแผนสหกิจศึกษา</span>
                  <select className="all-select" value={s.coop_result ?? ''} onChange={(e) => announce(s, e.target.value)}>
                    <option value="">{COOP_STATUS.waiting.label}</option>
                    <option value="passed">{COOP_STATUS.passed.label}</option>
                    <option value="failed">{COOP_STATUS.failed.label}</option>
                  </select>
                </label>
              )}
              {s.coop_result_at && <p className="app-date">ประกาศผลเมื่อ {formatDateTime(s.coop_result_at)}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
