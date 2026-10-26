import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import ApiState from '../../components/ApiState';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import ApplicationStatusBadge from '../../components/ApplicationStatusBadge';
import { APPLICATION_STATUS, APPLICATION_STEPS, STATUS_PROGRESS } from '../../config/applicationStatus';
import '../CSS/myApplications.css';

// ผู้อนุมัติใบสมัครที่เป็นบัญชีอาจารย์คืออาจารย์นิเทศก์
const REVIEWER_ROLE = { advisor: 'อาจารย์นิเทศก์', staff: 'เจ้าหน้าที่' };
// ผลการตรวจ (application_reviews.status) ใช้ป้ายแยกจากสถานะใบสมัคร
const REVIEW_RESULT = {
  approved: { label: 'อนุมัติ', tone: 'success' },
  rejected: { label: 'ไม่อนุมัติ', tone: 'danger' },
};

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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
  const { data: applications, reload, loading, error } = useApi('/students/me/applications');
  const { data: activeTerm } = useApi('/terms/active', null);
  const [notice, setNotice] = useState('');
  const confirmed = applications.find((a) => a.status === 'confirmed');

  const handleConfirm = async (app) => {
    const others = applications.filter(
      (a) => a.application_id !== app.application_id && ['accepted', 'submitted', 'approved'].includes(a.status)
    ).length;
    const message =
      `ยืนยันสิทธิ์ฝึกสหกิจที่ ${app.company_name} ตำแหน่ง ${app.position_name}?` +
      (others > 0 ? `\n\nใบสมัครอื่นอีก ${others} ใบในภาคนี้จะถูกสละสิทธิ์/ถอนอัตโนมัติ และย้อนกลับไม่ได้` : '');
    if (!window.confirm(message)) return;
    try { await api(`/applications/${app.application_id}/confirm`, { method: 'POST' }); await reload(); setNotice('ยืนยันสิทธิ์แล้ว'); } catch (err) { setNotice(err.message); }
  };

  const handleWithdraw = async (app) => {
    if (!window.confirm(`ถอนใบสมัคร ${app.company_name} ตำแหน่ง ${app.position_name}?\n\nถอนแล้วย้อนกลับไม่ได้`)) return;
    try { await api(`/applications/${app.application_id}/withdraw`, { method: 'POST' }); await reload(); setNotice('ถอนใบสมัครแล้ว'); } catch (err) { setNotice(err.message); }
  };

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">ใบสมัครของฉัน</h1>
        <span className="app-term">ภาคการศึกษา {activeTerm?.code ?? '—'}</span>
      </div>

      <ApiState loading={loading} error={error} />
      {notice && <p role="status">{notice}</p>}
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
