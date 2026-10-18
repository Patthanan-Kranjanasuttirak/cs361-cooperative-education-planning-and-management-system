import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import ApiState from '../../components/ApiState';
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
  const { data: applications, reload, loading, error } = useApi('/staff/applications');
  const { data: terms } = useApi('/terms');
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('');
  const [company, setCompany] = useState('');
  const [search, setSearch] = useState('');
  const [openHistory, setOpenHistory] = useState(() => new Set());
  const [notice, setNotice] = useState('');

  const inTerm = applications.filter((a) => !term || a.term === term);
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

  const submitReview = async (app, decision, comment) => {
    try {
      await api(`/applications/${app.application_id}/reviews`, { method: 'POST', body: { status: decision, comment } });
      await reload();
      setNotice(`บันทึกผลการพิจารณาของ ${app.student.th_name} แล้ว`);
      return true;
    } catch (err) { setNotice(err.message); return false; }
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

      <ApiState loading={loading} error={error} />
      {notice && <div className="app-banner">{notice}</div>}

      <div className="all-filters">
        <label className="all-filter">
          <span className="pending-label">ภาคการศึกษา</span>
          <select className="profile-input all-select" value={term} onChange={(e) => changeTerm(e.target.value)}>
            <option value="">ทุกภาคการศึกษา</option>
            {terms.map((t) => <option key={t.term_id} value={t.code}>{t.code}</option>)}
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
                    onSubmit={(decision, comment) => submitReview(app, decision, comment)}
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
