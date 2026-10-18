import { Link, useParams } from 'react-router-dom';
import ApplicationStatusBadge from '../../components/ApplicationStatusBadge';
import DocumentLink from '../../components/DocumentLink';
import GpaxValue from '../../components/GpaxValue';
import { COOP_CRITERIA } from '../../config/coopCriteria';
import { useApi } from '../../hooks/useApi';
import ApiState from '../../components/ApiState';
import CourseGradesFields from '../../components/CourseGradesFields';
import { formatPhone } from '../../utils/phone';
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/pendingApplications.css';
import '../CSS/studentDetail.css';

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// รายละเอียดจาก API ที่ตรวจอาจารย์เจ้าของข้อมูลแล้ว
export default function StudentDetail() {
  const { studentId } = useParams();
  const { data: detail, loading, error } = useApi(`/advisor/students/${studentId}`, null);
  const summary = detail;

  const back = (
    <Link to="/advisor/students" className="sd-back">← นักศึกษาในความดูแล</Link>
  );

  if (loading || error) return <section>{back}<ApiState loading={loading} error={error} /></section>;

  if (!summary || !detail) {
    return (
      <section>
        {back}
        <div className="app-empty"><p>ไม่พบนักศึกษาคนนี้ในความดูแลของคุณ</p></div>
      </section>
    );
  }

  const pending = detail.applications.filter((a) => a.status === 'submitted').length;
  const info = [
    ['รหัสนักศึกษา', summary.student_code],
    ['GPAX', <GpaxValue key="gpax" gpax={summary.gpax} />],
    ['อีเมล', <a key="email" href={`mailto:${detail.email}`} className="sd-link">{detail.email}</a>],
    ['เบอร์โทรศัพท์', detail.phone ? <a key="phone" href={`tel:${detail.phone}`} className="sd-link">{formatPhone(detail.phone)}</a> : <span key="phone" className="sd-muted">ยังไม่กรอก</span>],
  ];

  return (
    <section>
      {back}
      <div className="app-header">
        <h1 className="app-title">{summary.th_name}</h1>
      </div>

      <div className="profile-form">
        <div className="profile-section">
          <p className="profile-section-title">ข้อมูลนักศึกษา</p>
          <dl className="sd-info">
            {info.map(([label, value]) => (
              <div key={label} className="sd-info-row">
                <dt className="pending-label">{label}</dt>
                <dd className="sd-info-value">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="profile-section">
          <p className="profile-section-title">คุณสมบัติสหกิจศึกษา</p>
          <p className="sd-muted">เกณฑ์ GPAX ไม่ต่ำกว่า {COOP_CRITERIA.minGpax.toFixed(2)} และผู้ตรวจตรวจคุณสมบัติรายวิชาจาก Transcript</p>
          <DocumentLink url={detail.transcript_s3_key ? `/documents/${encodeURIComponent(detail.transcript_s3_key)}` : null} label="ดู Transcript" />
        </div>

        <CourseGradesFields curriculum={detail.curriculum} grades={detail.course_grades ?? {}} disabled />

        <div className="profile-section">
          <div className="sd-section-head">
            <p className="profile-section-title">ใบสมัคร ({detail.applications.length})</p>
          </div>
          {pending > 0 && (
            <p className="sd-pending">
              มีใบสมัครรออนุมัติ {pending} ใบ — <Link to="/advisor" className="sd-link">ไปหน้าใบสมัครรออนุมัติ</Link>
            </p>
          )}
          {detail.applications.length === 0 ? (
            <p className="sd-muted sd-gap">ยังไม่มีใบสมัคร</p>
          ) : (
            <ul className="sd-apps">
              {detail.applications.map((a) => (
                <li key={a.application_id} className="sd-app">
                  <div className="sd-app-text">
                    <p className="pending-company">{a.company_name}</p>
                    <p className="sd-muted">{a.position_name} · ส่งเมื่อ {formatDateTime(a.submitted_at)}</p>
                  </div>
                  <ApplicationStatusBadge status={a.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
