import { useState } from 'react';
import ApplicationStatusBadge from '../../components/ApplicationStatusBadge';
import DocumentLink from '../../components/DocumentLink';
import GpaxValue from '../../components/GpaxValue';
import ReviewPanel from '../../components/ReviewPanel';
import { APPLICATION_STATUS } from '../../config/applicationStatus';
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/pendingApplications.css';
import '../CSS/allApplications.css';

// MOCK: ยังไม่มี API — TODO: GET /api/staff/applications?term=&status=&company=&search=
//   เจ้าหน้าที่เห็นใบสมัครทุกใบ (ไม่กรองตาม advisor_id) พร้อม history จาก application_history
const MOCK_TERMS = ['2/2569', '1/2569'];
const MOCK_APPLICATIONS = [
  {
    application_id: 4,
    term: '2/2569',
    student: { student_code: '6609611111', th_name: 'นักศึกษาตัวอย่าง หนึ่ง', gpax: 3.42, advisor_name: 'อาจารย์ตัวอย่าง ก' },
    company_name: 'บริษัท ที.ซี.ซี. เทคโนโลยี จำกัด',
    position_name: 'IT Support Intern',
    status: 'submitted',
    submitted_at: '2026-10-10T16:20:00+07:00',
    history: [{ from: null, to: 'submitted', by: 'นักศึกษาตัวอย่าง หนึ่ง', at: '2026-10-10T16:20:00+07:00' }],
  },
  {
    application_id: 8,
    term: '2/2569',
    student: { student_code: '6609633333', th_name: 'นักศึกษาตัวอย่าง สาม', gpax: null, advisor_name: 'อาจารย์ตัวอย่าง ก' },
    company_name: 'บริษัทกสิกร บิซิเนส-เทคโนโลยี กรุ๊ป',
    position_name: 'Software Developer Intern',
    status: 'submitted',
    submitted_at: '2026-10-13T20:15:00+07:00',
    history: [{ from: null, to: 'submitted', by: 'นักศึกษาตัวอย่าง สาม', at: '2026-10-13T20:15:00+07:00' }],
  },
  {
    application_id: 9,
    term: '2/2569',
    student: { student_code: '6609677777', th_name: 'นักศึกษาตัวอย่าง เจ็ด', gpax: 3.05, advisor_name: 'อาจารย์ตัวอย่าง ข' },
    company_name: 'บริษัท ซีดีจี กรุ๊ป จำกัด',
    position_name: 'QA / Software Tester Intern',
    status: 'approved',
    submitted_at: '2026-10-02T13:45:00+07:00',
    history: [
      { from: null, to: 'submitted', by: 'นักศึกษาตัวอย่าง เจ็ด', at: '2026-10-02T13:45:00+07:00' },
      { from: 'submitted', to: 'approved', by: 'อาจารย์ตัวอย่าง ข', at: '2026-10-03T09:10:00+07:00' },
    ],
  },
  {
    application_id: 1,
    term: '2/2569',
    student: { student_code: '6609644444', th_name: 'นักศึกษาตัวอย่าง สี่', gpax: 3.75, advisor_name: 'อาจารย์ตัวอย่าง ก' },
    company_name: 'ธนาคารไทยพาณิชย์ จำกัด (มหาชน)',
    position_name: 'UX/UI Designer Intern',
    status: 'confirmed',
    submitted_at: '2026-09-20T10:15:00+07:00',
    history: [
      { from: null, to: 'submitted', by: 'นักศึกษาตัวอย่าง สี่', at: '2026-09-20T10:15:00+07:00' },
      { from: 'submitted', to: 'approved', by: 'อาจารย์ตัวอย่าง ก', at: '2026-09-22T14:00:00+07:00' },
      { from: 'approved', to: 'accepted', by: 'ผู้ประสานงาน ธนาคารไทยพาณิชย์', at: '2026-10-01T11:00:00+07:00' },
      { from: 'accepted', to: 'confirmed', by: 'นักศึกษาตัวอย่าง สี่', at: '2026-10-08T11:00:00+07:00' },
    ],
  },
  {
    application_id: 2,
    term: '2/2569',
    student: { student_code: '6609644444', th_name: 'นักศึกษาตัวอย่าง สี่', gpax: 3.75, advisor_name: 'อาจารย์ตัวอย่าง ก' },
    company_name: 'บริษัทกสิกร บิซิเนส-เทคโนโลยี กรุ๊ป',
    position_name: 'Software Developer Intern',
    status: 'released',
    submitted_at: '2026-09-21T09:00:00+07:00',
    history: [
      { from: null, to: 'submitted', by: 'นักศึกษาตัวอย่าง สี่', at: '2026-09-21T09:00:00+07:00' },
      { from: 'submitted', to: 'approved', by: 'เจ้าหน้าที่ตัวอย่าง', at: '2026-09-23T11:30:00+07:00' },
      { from: 'approved', to: 'accepted', by: 'ผู้ประสานงาน KBTG', at: '2026-10-02T15:00:00+07:00' },
      { from: 'accepted', to: 'released', by: 'นักศึกษาตัวอย่าง สี่', at: '2026-10-08T11:00:00+07:00' },
    ],
  },
  {
    application_id: 5,
    term: '2/2569',
    student: { student_code: '6609655555', th_name: 'นักศึกษาตัวอย่าง ห้า', gpax: 2.65, advisor_name: 'อาจารย์ตัวอย่าง ข' },
    company_name: 'บริษัท ไอบอทน้อย จำกัด',
    position_name: 'Data Analyst Intern',
    status: 'rejected',
    submitted_at: '2026-09-18T08:30:00+07:00',
    history: [
      { from: null, to: 'submitted', by: 'นักศึกษาตัวอย่าง ห้า', at: '2026-09-18T08:30:00+07:00' },
      { from: 'submitted', to: 'rejected', by: 'อาจารย์ตัวอย่าง ข', at: '2026-09-19T10:00:00+07:00' },
    ],
  },
  {
    application_id: 3,
    term: '1/2569',
    student: { student_code: '6509688888', th_name: 'นักศึกษาตัวอย่าง แปด', gpax: 3.3, advisor_name: 'อาจารย์ตัวอย่าง ข' },
    company_name: 'ธนาคารไทยพาณิชย์ จำกัด (มหาชน)',
    position_name: 'IT Business Analyst Intern',
    status: 'declined',
    submitted_at: '2026-03-05T10:00:00+07:00',
    history: [
      { from: null, to: 'submitted', by: 'นักศึกษาตัวอย่าง แปด', at: '2026-03-05T10:00:00+07:00' },
      { from: 'submitted', to: 'approved', by: 'เจ้าหน้าที่ตัวอย่าง', at: '2026-03-06T09:00:00+07:00' },
      { from: 'approved', to: 'declined', by: 'ผู้ประสานงาน ธนาคารไทยพาณิชย์', at: '2026-03-20T16:00:00+07:00' },
    ],
  },
];

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const statusLabel = (status) => APPLICATION_STATUS[status]?.label ?? status;

function History({ items }) {
  return (
    <ol className="history-list">
      {items.map((h) => (
        <li key={`${h.to}-${h.at}`} className="history-item">
          <span className="history-dot" aria-hidden="true" />
          <div>
            <p className="history-change">
              {h.from ? `${statusLabel(h.from)} → ${statusLabel(h.to)}` : `ส่งใบสมัคร (${statusLabel(h.to)})`}
            </p>
            <p className="history-meta">
              {h.by} · {formatDateTime(h.at)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function AllApplications() {
  const [applications, setApplications] = useState(MOCK_APPLICATIONS);
  const [term, setTerm] = useState(MOCK_TERMS[0]);
  const [status, setStatus] = useState('');
  const [company, setCompany] = useState('');
  const [search, setSearch] = useState('');
  const [openHistory, setOpenHistory] = useState(() => new Set());
  const [notice, setNotice] = useState('');

  const inTerm = applications.filter((a) => a.term === term);
  const companies = [...new Set(inTerm.map((a) => a.company_name))].sort((a, b) => a.localeCompare(b, 'th'));
  const keyword = search.trim().toLowerCase();
  const visible = inTerm.filter(
    (a) =>
      (!status || a.status === status) &&
      (!company || a.company_name === company) &&
      (!keyword || a.student.th_name.toLowerCase().includes(keyword) || a.student.student_code.includes(keyword))
  );
  const pendingCount = inTerm.filter((a) => a.status === 'submitted').length;

  const toggleHistory = (id) =>
    setOpenHistory((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submitReview = (app, decision) => {
    // TODO: POST /api/applications/:id/reviews { status, comment } — เจ้าหน้าที่ตรวจได้ทุกใบ
    //   backend ทำใน transaction เดียว: insert application_reviews + update status + insert application_history
    setApplications((prev) =>
      prev.map((a) =>
        a.application_id === app.application_id
          ? {
              ...a,
              status: decision,
              history: [...a.history, { from: a.status, to: decision, by: 'คุณ (เจ้าหน้าที่)', at: new Date().toISOString() }],
            }
          : a
      )
    );
    setNotice(`${decision === 'approved' ? 'อนุมัติ' : 'ไม่อนุมัติ'}ใบสมัครของ ${app.student.th_name} (${app.company_name}) แล้ว`);
  };

  const changeTerm = (value) => {
    setTerm(value);
    setCompany('');
  };

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">ใบสมัครทั้งหมด</h1>
        <span className="app-term">
          {inTerm.length} ใบ{pendingCount > 0 && <span className="all-pending"> · รออนุมัติ {pendingCount}</span>}
        </span>
      </div>

      {notice && <div className="app-banner">{notice}</div>}

      <div className="all-filters">
        <label className="all-filter">
          <span className="pending-label">ภาคการศึกษา</span>
          <select className="profile-input all-select" value={term} onChange={(e) => changeTerm(e.target.value)}>
            {MOCK_TERMS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="all-filter">
          <span className="pending-label">สถานะ</span>
          <select className="profile-input all-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">ทุกสถานะ</option>
            {Object.entries(APPLICATION_STATUS).map(([key, s]) => (
              <option key={key} value={key}>{s.label}</option>
            ))}
          </select>
        </label>
        <label className="all-filter all-filter--wide">
          <span className="pending-label">สถานประกอบการ</span>
          <select className="profile-input all-select" value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">ทุกสถานประกอบการ</option>
            {companies.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
      </div>

      <input
        className="pending-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ค้นหาชื่อ / รหัสนักศึกษา"
      />

      {visible.length === 0 ? (
        <div className="app-empty">
          <p>ไม่พบใบสมัครตามเงื่อนไขที่เลือก</p>
        </div>
      ) : (
        <ul className="app-list">
          {visible.map((app) => {
            const historyOpen = openHistory.has(app.application_id);
            return (
              <li key={app.application_id} className="app-card">
                <div className="app-card-head">
                  <div>
                    <p className="app-company">{app.student.th_name}</p>
                    <p className="pending-student-meta">
                      รหัส {app.student.student_code} · GPAX <GpaxValue gpax={app.student.gpax} /> · อ.ที่ปรึกษา {app.student.advisor_name}
                    </p>
                  </div>
                  <ApplicationStatusBadge status={app.status} />
                </div>

                <div className="pending-target">
                  <p className="pending-label">สมัคร</p>
                  <p className="pending-company">{app.company_name}</p>
                  <p className="app-position">{app.position_name}</p>
                </div>

                <div className="pending-docs">
                  <DocumentLink url={app.resume_url} label="ดูเรซูเม่" />
                  <DocumentLink url={app.transcript_url} label="ดู Transcript" />
                  <button
                    type="button"
                    className="pending-doc all-history-toggle"
                    aria-expanded={historyOpen}
                    onClick={() => toggleHistory(app.application_id)}
                  >
                    {historyOpen ? 'ซ่อนประวัติ' : `ประวัติสถานะ (${app.history.length})`}
                  </button>
                </div>

                {historyOpen && <History items={app.history} />}

                {app.status === 'submitted' ? (
                  <ReviewPanel
                    id={app.application_id}
                    onOpen={() => setNotice('')}
                    onSubmit={(decision) => submitReview(app, decision)}
                  />
                ) : (
                  <p className="app-date all-submitted">ส่งเมื่อ {formatDateTime(app.submitted_at)}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
