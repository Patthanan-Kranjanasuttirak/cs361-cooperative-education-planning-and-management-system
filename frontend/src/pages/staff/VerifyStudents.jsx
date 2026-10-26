import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import ApiState from '../../components/ApiState';
import CourseGradesFields from '../../components/CourseGradesFields';
import DocumentLink from '../../components/DocumentLink';
import GpaxValue from '../../components/GpaxValue';
import ReviewPanel from '../../components/ReviewPanel';
import StudentReviewBadge from '../../components/StudentReviewBadge';
import { curriculumLabel } from '../../config/coopCriteria';
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/pendingApplications.css';
import '../CSS/myStudents.css';

// ตัวกรองตามผลตรวจข้อมูลส่วนตัว (students.profile_status)
const FILTERS = [
  { key: 'pending', label: 'รอตรวจ', match: (s) => s.profile_status === 'pending' },
  { key: 'returned', label: 'ส่งกลับให้แก้ไข', match: (s) => s.profile_status === 'returned' },
  { key: 'verified', label: 'ข้อมูลถูกต้อง', match: (s) => s.profile_status === 'verified' },
  { key: 'none', label: 'ยังไม่ส่งข้อมูล', match: (s) => !s.profile_status },
  { key: 'all', label: 'ทั้งหมด', match: () => true },
];

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// เจ้าหน้าที่ตรวจข้อมูลส่วนตัวของนักศึกษาก่อนสมัคร (อาจารย์ที่ปรึกษารับรองความประพฤติแยกต่างหาก)
export default function VerifyStudents() {
  const { data: students, setData, loading, error } = useApi('/students');
  const [filter, setFilter] = useState('pending');
  const [search, setSearch] = useState('');
  const [openGrades, setOpenGrades] = useState(null);
  const [notice, setNotice] = useState('');

  const active = students.filter((s) => s.is_active);
  const keyword = search.trim().toLowerCase();
  const visible = active.filter(
    (s) => FILTERS.find((f) => f.key === filter).match(s) &&
      (!keyword || s.th_name.toLowerCase().includes(keyword) || s.student_code.includes(keyword))
  );

  const review = async (student, decision, comment) => {
    try {
      const result = await api(`/students/${student.student_id}/profile-review`, { method: 'POST', body: { status: decision === 'approved' ? 'verified' : 'returned', comment } });
      setData((prev) => prev.map((s) => (s.student_id === student.student_id ? { ...s, ...result } : s)));
      setNotice(decision === 'approved' ? `ยืนยันข้อมูลของ ${student.th_name} แล้ว` : `ส่งข้อมูลของ ${student.th_name} กลับให้แก้ไขแล้ว`);
      return true;
    } catch (err) { setNotice(err.message); return false; }
  };

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">ตรวจข้อมูลนักศึกษา</h1>
        <span className="app-term">รอตรวจ {active.filter(FILTERS[0].match).length} คน</span>
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
                  <StudentReviewBadge kind="profile" status={s.profile_status} />
                  <p className="pending-student-meta"><StudentReviewBadge kind="conduct" status={s.conduct_status} /></p>
                </div>
              </div>

              <div className="pending-docs">
                <DocumentLink url={s.transcript_s3_key ? `/documents/${encodeURIComponent(s.transcript_s3_key)}` : null} label="ดู Transcript" />
                <button
                  type="button"
                  className="pending-doc"
                  aria-expanded={openGrades === s.student_id}
                  onClick={() => setOpenGrades(openGrades === s.student_id ? null : s.student_id)}
                >
                  {openGrades === s.student_id ? 'ซ่อนผลการเรียนรายวิชา' : 'ดูผลการเรียนรายวิชา'}
                </button>
              </div>
              {openGrades === s.student_id && <CourseGradesFields curriculum={s.curriculum} grades={s.course_grades ?? {}} disabled />}

              {s.profile_comment && <p className="pending-student-meta">เหตุผลที่ส่งกลับ: “{s.profile_comment}”</p>}
              {s.profile_status === 'pending' ? (
                <ReviewPanel
                  id={`profile-${s.student_id}`}
                  labels={{ approved: 'ข้อมูลถูกต้อง', rejected: 'ส่งกลับให้แก้ไข' }}
                  rejectPlaceholder="เช่น GPAX ไม่ตรงกับ Transcript"
                  onOpen={() => setNotice('')}
                  onSubmit={(decision, comment) => review(s, decision, comment)}
                />
              ) : s.profile_reviewed_at && (
                <p className="app-date">ตรวจเมื่อ {formatDateTime(s.profile_reviewed_at)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
