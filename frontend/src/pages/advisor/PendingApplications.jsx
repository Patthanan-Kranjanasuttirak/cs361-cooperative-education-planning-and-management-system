import { useState } from 'react';
import GpaxValue from '../../components/GpaxValue';
import ReviewPanel from '../../components/ReviewPanel';
import DocumentLink from '../../components/DocumentLink';
import '../CSS/myApplications.css';
import '../CSS/pendingApplications.css';

// MOCK: ยังไม่มี API — TODO: GET /api/advisor/applications?status=submitted
//   backend กรองเฉพาะนักศึกษาที่ students.advisor_id = อาจารย์ที่ login (ไม่รับ advisor_id จาก client)
//   resume_url / transcript_url เป็น presigned URL ของ S3 ที่ backend สร้างให้ (หมดอายุเร็ว)
const MOCK_PENDING = [
  {
    application_id: 4,
    student: { student_code: '6609611111', th_name: 'นักศึกษาตัวอย่าง หนึ่ง', gpax: 3.42 },
    company_name: 'บริษัท ที.ซี.ซี. เทคโนโลยี จำกัด',
    position_name: 'IT Support Intern',
    submitted_at: '2026-10-10T16:20:00+07:00',
    resume_url: null,
    transcript_url: null,
  },
  {
    application_id: 6,
    student: { student_code: '6609622222', th_name: 'นักศึกษาตัวอย่าง สอง', gpax: 2.87 },
    company_name: 'ธนาคารไทยพาณิชย์ จำกัด (มหาชน)',
    position_name: 'IT Business Analyst Intern',
    submitted_at: '2026-10-11T09:05:00+07:00',
    resume_url: null,
    transcript_url: null,
  },
  {
    application_id: 7,
    student: { student_code: '6609622222', th_name: 'นักศึกษาตัวอย่าง สอง', gpax: 2.87 },
    company_name: 'บริษัท ซีดีจี กรุ๊ป จำกัด',
    position_name: 'Software Developer Intern',
    submitted_at: '2026-10-12T13:40:00+07:00',
    resume_url: null,
    transcript_url: null,
  },
  {
    application_id: 8,
    student: { student_code: '6609633333', th_name: 'นักศึกษาตัวอย่าง สาม', gpax: null },
    company_name: 'บริษัทกสิกร บิซิเนส-เทคโนโลยี กรุ๊ป',
    position_name: 'Software Developer Intern',
    submitted_at: '2026-10-13T20:15:00+07:00',
    resume_url: null,
    transcript_url: null,
  },
];

const DECISION_DONE = { approved: 'อนุมัติ', rejected: 'ไม่อนุมัติ' };

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function PendingApplications() {
  const [applications, setApplications] = useState(MOCK_PENDING);
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');

  const keyword = search.trim().toLowerCase();
  const visible = applications.filter(
    (a) =>
      !keyword ||
      a.student.th_name.toLowerCase().includes(keyword) ||
      a.student.student_code.includes(keyword) ||
      a.company_name.toLowerCase().includes(keyword)
  );

  const submitReview = (app, decision) => {
    // TODO: POST /api/applications/:id/reviews { status, comment }
    //   backend: insert application_reviews + เปลี่ยน applications.status (submitted → approved/rejected)
    //   + insert application_history ใน transaction เดียว และต้องเช็กว่ายังเป็น submitted อยู่
    //   และต้องเช็กว่าเป็นนักศึกษาในความดูแลของอาจารย์คนนี้ (students.advisor_id)
    setApplications((prev) => prev.filter((a) => a.application_id !== app.application_id));
    setNotice(
      `${DECISION_DONE[decision]}ใบสมัครของ ${app.student.th_name} (${app.company_name}) แล้ว` +
        (decision === 'approved' ? ' — ส่งต่อให้บริษัทพิจารณา' : '')
    );
  };

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">ใบสมัครรออนุมัติ</h1>
        <span className="app-term">{applications.length} ใบ</span>
      </div>

      {notice && <div className="app-banner">{notice}</div>}

      {applications.length > 0 && (
        <input
          className="pending-search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ค้นหาชื่อ / รหัสนักศึกษา / บริษัท"
        />
      )}

      {applications.length === 0 ? (
        <div className="app-empty">
          <p>ไม่มีใบสมัครที่รออนุมัติ</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="app-empty">
          <p>ไม่พบใบสมัครที่ตรงกับคำค้นหา</p>
        </div>
      ) : (
        <ul className="app-list">
          {visible.map((app) => (
            <li key={app.application_id} className="app-card">
              <div className="pending-student">
                <div>
                  <p className="app-company">{app.student.th_name}</p>
                  <p className="pending-student-meta">
                    รหัส {app.student.student_code} · GPAX{' '}
                    <GpaxValue gpax={app.student.gpax} />
                  </p>
                </div>
                <span className="app-date">ส่งเมื่อ {formatDateTime(app.submitted_at)}</span>
              </div>

              <div className="pending-target">
                <p className="pending-label">สมัคร</p>
                <p className="pending-company">{app.company_name}</p>
                <p className="app-position">{app.position_name}</p>
              </div>

              <div className="pending-docs">
                <DocumentLink url={app.resume_url} label="ดูเรซูเม่" />
                <DocumentLink url={app.transcript_url} label="ดู Transcript" />
              </div>

              <ReviewPanel
                id={app.application_id}
                onOpen={() => setNotice('')}
                onSubmit={(decision) => submitReview(app, decision)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
