import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import ApiState from '../../components/ApiState';
import { useState } from 'react';
import GpaxValue from '../../components/GpaxValue';
import ReviewPanel from '../../components/ReviewPanel';
import DocumentLink from '../../components/DocumentLink';
import '../CSS/myApplications.css';
import '../CSS/pendingApplications.css';


const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export default function PendingApplications() {
  const { data: applications, reload, loading, error } = useApi('/advisor/applications?status=submitted');
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

  const submitReview = async (app, decision, comment) => {
    try {
      await api(`/applications/${app.application_id}/reviews`, { method: 'POST', body: { status: decision, comment } });
      await reload();
      setNotice(`บันทึกผลการพิจารณาของ ${app.student.th_name} แล้ว`);
      return true;
    } catch (err) { setNotice(err.message); return false; }
  };

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">ใบสมัครรออนุมัติ</h1>
        <span className="app-term">{applications.length} ใบ</span>
      </div>

      <ApiState loading={loading} error={error} />
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
                onSubmit={(decision, comment) => submitReview(app, decision, comment)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
