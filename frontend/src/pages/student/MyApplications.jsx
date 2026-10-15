import { useState } from 'react';
import { Link } from 'react-router-dom';
import ApplicationStatusBadge from '../../components/ApplicationStatusBadge';
import { APPLICATION_STATUS, APPLICATION_STEPS, STATUS_PROGRESS } from '../../config/applicationStatus';
import '../CSS/myApplications.css';

// MOCK: ยังไม่มี API — TODO: GET /api/students/me/applications (ใบสมัครของภาคที่ active พร้อม reviews)
const MOCK_TERM = '2/2569';
const MOCK_APPLICATIONS = [
  {
    application_id: 1,
    company_name: 'ธนาคารไทยพาณิชย์ จำกัด (มหาชน)',
    position_name: 'UX/UI Designer Intern',
    status: 'accepted',
    submitted_at: '2026-09-20T10:15:00+07:00',
    reviews: [{ review_id: 1, reviewer_name: 'อาจารย์ตัวอย่าง', reviewer_role: 'advisor', status: 'approved', comment: 'พอร์ตโฟลิโอดี เหมาะกับตำแหน่ง', created_at: '2026-09-22T14:00:00+07:00' }],
  },
  {
    application_id: 2,
    company_name: 'บริษัทกสิกร บิซิเนส-เทคโนโลยี กรุ๊ป',
    position_name: 'Software Developer Intern',
    status: 'accepted',
    submitted_at: '2026-09-21T09:00:00+07:00',
    reviews: [{ review_id: 2, reviewer_name: 'เจ้าหน้าที่ตัวอย่าง', reviewer_role: 'staff', status: 'approved', comment: null, created_at: '2026-09-23T11:30:00+07:00' }],
  },
  {
    application_id: 3,
    company_name: 'บริษัท ซีดีจี กรุ๊ป จำกัด',
    position_name: 'QA / Software Tester Intern',
    status: 'approved',
    submitted_at: '2026-10-02T13:45:00+07:00',
    reviews: [{ review_id: 3, reviewer_name: 'อาจารย์ตัวอย่าง', reviewer_role: 'advisor', status: 'approved', comment: null, created_at: '2026-10-03T09:10:00+07:00' }],
  },
  {
    application_id: 4,
    company_name: 'บริษัท ที.ซี.ซี. เทคโนโลยี จำกัด',
    position_name: 'IT Support Intern',
    status: 'submitted',
    submitted_at: '2026-10-10T16:20:00+07:00',
    reviews: [],
  },
  {
    application_id: 5,
    company_name: 'บริษัท ไอบอทน้อย จำกัด',
    position_name: 'Data Analyst Intern',
    status: 'rejected',
    submitted_at: '2026-09-18T08:30:00+07:00',
    reviews: [{ review_id: 4, reviewer_name: 'อาจารย์ตัวอย่าง', reviewer_role: 'advisor', status: 'rejected', comment: 'GPAX ยังไม่ถึงเกณฑ์ที่บริษัทกำหนด', created_at: '2026-09-19T10:00:00+07:00' }],
  },
];

const REVIEWER_ROLE = { advisor: 'อาจารย์ที่ปรึกษา', staff: 'เจ้าหน้าที่' };
// ผลการตรวจ (application_reviews.status) ใช้ป้ายแยกจากสถานะใบสมัคร
const REVIEW_RESULT = {
  approved: { label: 'อนุมัติ', tone: 'success' },
  rejected: { label: 'ไม่อนุมัติ', tone: 'danger' },
};

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ยืนยันสิทธิ์: ใบที่เลือกเป็น confirmed, ใบอื่นที่ผ่านการคัดเลือกแล้วเป็น released, ใบที่ยังรอผลเป็น withdrawn
// (ตรงกับกฎใน 01-schema.sql — ของจริง backend ทำใน transaction เดียว)
function applyConfirm(applications, id) {
  return applications.map((a) => {
    if (a.application_id === id) return { ...a, status: 'confirmed' };
    if (a.status === 'accepted') return { ...a, status: 'released' };
    if (a.status === 'submitted' || a.status === 'approved') return { ...a, status: 'withdrawn' };
    return a;
  });
}

function StatusProgress({ status }) {
  const progress = STATUS_PROGRESS[status];
  if (!progress) return null;
  return (
    <ol className="app-steps">
      {APPLICATION_STEPS.map((step, index) => {
        const state =
          index === progress.failedAt ? 'failed' : index < progress.done ? 'done' : index === progress.done ? 'current' : 'todo';
        return (
          <li key={step} className={`app-step app-step--${state}`}>
            <span className="app-step-dot">{state === 'done' ? '✓' : state === 'failed' ? '✕' : index + 1}</span>
            <span className="app-step-label">{step}</span>
          </li>
        );
      })}
    </ol>
  );
}

export default function MyApplications() {
  const [applications, setApplications] = useState(MOCK_APPLICATIONS);
  const confirmed = applications.find((a) => a.status === 'confirmed');

  const handleConfirm = (app) => {
    const others = applications.filter(
      (a) => a.application_id !== app.application_id && ['accepted', 'submitted', 'approved'].includes(a.status)
    ).length;
    const message =
      `ยืนยันสิทธิ์ฝึกสหกิจที่ ${app.company_name} ตำแหน่ง ${app.position_name}?` +
      (others > 0 ? `\n\nใบสมัครอื่นอีก ${others} ใบในภาคนี้จะถูกสละสิทธิ์/ถอนอัตโนมัติ และย้อนกลับไม่ได้` : '');
    if (!window.confirm(message)) return;
    // TODO: POST /api/applications/:id/confirm
    setApplications((prev) => applyConfirm(prev, app.application_id));
  };

  const handleWithdraw = (app) => {
    if (!window.confirm(`ถอนใบสมัคร ${app.company_name} ตำแหน่ง ${app.position_name}?\n\nถอนแล้วย้อนกลับไม่ได้`)) return;
    // TODO: POST /api/applications/:id/withdraw
    setApplications((prev) =>
      prev.map((a) => (a.application_id === app.application_id ? { ...a, status: 'withdrawn' } : a))
    );
  };

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">ใบสมัครของฉัน</h1>
        <span className="app-term">ภาคการศึกษา {MOCK_TERM}</span>
      </div>

      {confirmed && (
        <div className="app-banner">
          คุณยืนยันสิทธิ์ฝึกสหกิจที่ <strong>{confirmed.company_name}</strong> ตำแหน่ง <strong>{confirmed.position_name}</strong> แล้ว
        </div>
      )}

      {applications.length === 0 ? (
        <div className="app-empty">
          <p>ยังไม่มีใบสมัครในภาคการศึกษานี้</p>
          <Link to="/student/apply" className="app-btn app-btn--primary">สมัครสหกิจศึกษา</Link>
        </div>
      ) : (
        <ul className="app-list">
          {applications.map((app) => (
            <li key={app.application_id} className={`app-card${app.status === 'confirmed' ? ' app-card--confirmed' : ''}`}>
              <div className="app-card-head">
                <div>
                  <p className="app-company">{app.company_name}</p>
                  <p className="app-position">{app.position_name}</p>
                </div>
                <ApplicationStatusBadge status={app.status} />
              </div>

              <StatusProgress status={app.status} />
              <p className="app-hint">{APPLICATION_STATUS[app.status]?.hint}</p>

              {app.reviews.length > 0 && (
                <div className="app-reviews">
                  <p className="app-reviews-title">ผลการตรวจ</p>
                  {app.reviews.map((r) => (
                    <div key={r.review_id} className="app-review">
                      <div className="app-review-head">
                        <span>{r.reviewer_name} ({REVIEWER_ROLE[r.reviewer_role] ?? r.reviewer_role})</span>
                        <span className={`status-badge status-badge--${REVIEW_RESULT[r.status]?.tone ?? 'muted'}`}>
                          {REVIEW_RESULT[r.status]?.label ?? r.status}
                        </span>
                      </div>
                      {r.comment && <p className="app-review-comment">“{r.comment}”</p>}
                      <p className="app-review-date">{formatDateTime(r.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="app-card-foot">
                <span className="app-date">ส่งเมื่อ {formatDateTime(app.submitted_at)}</span>
                <div className="app-actions">
                  {(app.status === 'submitted' || app.status === 'approved') && (
                    <button type="button" className="app-btn app-btn--ghost" onClick={() => handleWithdraw(app)}>
                      ถอนใบสมัคร
                    </button>
                  )}
                  {app.status === 'accepted' && !confirmed && (
                    <button type="button" className="app-btn app-btn--primary" onClick={() => handleConfirm(app)}>
                      ยืนยันสิทธิ์
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
