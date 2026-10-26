import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import ApiState from '../../components/ApiState';
import { useState } from 'react';
import ApplicationStatusBadge from '../../components/ApplicationStatusBadge';
import DocumentLink from '../../components/DocumentLink';
import GpaxValue from '../../components/GpaxValue';
import { useAuth } from '../../context/useAuth';
import { formatPhone } from '../../utils/phone';
const ACCEPTED_STATUSES = ['accepted', 'confirmed'];
const CONTACT_VISIBLE_STATUSES = ['approved', 'accepted', 'confirmed'];
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/pendingApplications.css';
import '../CSS/myStudents.css';
import '../CSS/allApplications.css';
import '../CSS/companyPortal.css';

// ป้ายในมุมมองของบริษัท (ต่างจากมุมมองนักศึกษาเล็กน้อย)
const FILTERS = [
  { key: 'all', label: 'ทั้งหมด', match: () => true },
  { key: 'approved', label: 'รอพิจารณา', match: (a) => a.status === 'approved' },
  { key: 'accepted', label: 'ผ่านการคัดเลือก', match: (a) => ACCEPTED_STATUSES.includes(a.status) },
  { key: 'declined', label: 'ไม่ผ่านการคัดเลือก', match: (a) => a.status === 'declined' },
  { key: 'released', label: 'สละสิทธิ์', match: (a) => a.status === 'released' || a.status === 'withdrawn' },
];

const formatDate = (iso) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Applicants() {
  const { user } = useAuth();
  const { data: allPositions, loading: positionsLoading, error: positionsError } = useApi('/company/positions');
  const { data: activeTerm, loading: termLoading, error: termError } = useApi('/terms/active', null);
  const { data: applicants, reload, loading: applicantsLoading, error: applicantsError } = useApi(activeTerm ? `/company/applications?term_id=${activeTerm.term_id}` : null);
  const positions = allPositions.filter((p) => p.term_id == null || p.term_id === activeTerm?.term_id);
  const loading = positionsLoading || termLoading || applicantsLoading;
  const error = positionsError || termError || applicantsError;
  const [filter, setFilter] = useState('approved');
  const [positionId, setPositionId] = useState('');
  const [notice, setNotice] = useState('');
  const [deciding, setDeciding] = useState(false);

  const positionOf = (id) => positions.find((p) => p.id === id);
  const acceptedCount = (id) => applicants.filter((a) => a.position_id === id && ACCEPTED_STATUSES.includes(a.status)).length;

  const activeFilter = FILTERS.find((f) => f.key === filter);
  const inPosition = applicants.filter((a) => !positionId || a.position_id === Number(positionId));
  const visible = inPosition.filter(activeFilter.match);

  const decide = async (app, decision) => {
    if (deciding) return;
    const position = positionOf(app.position_id);
    const name = app.student.th_name;
    let message =
      decision === 'accepted'
        ? `${name} ผ่านการคัดเลือก ตำแหน่ง ${position?.name ?? ''}?`
        : `${name} ไม่ผ่านการคัดเลือก ตำแหน่ง ${position?.name ?? ''}?`;
    if (decision === 'accepted' && position?.quota != null && acceptedCount(app.position_id) >= position.quota) {
      message += `\n\nตำแหน่งนี้มีผู้ผ่านการคัดเลือกครบ ${position.quota} คนแล้ว ยังต้องการให้ผ่านเพิ่มหรือไม่`;
    }
    message += '\n\nเปลี่ยนแปลงภายหลังไม่ได้';
    if (!window.confirm(message)) return;
    setDeciding(true);
    try {
      await api(`/company/applications/${app.application_id}/decision`, { method: 'PATCH', body: { status: decision } });
      await reload(); setNotice(decision === 'accepted' ? `${name} ผ่านการคัดเลือกแล้ว — รอนักศึกษายืนยันสิทธิ์` : `${name} ไม่ผ่านการคัดเลือก`);
    } catch (err) { setNotice(err.message); }
    finally { setDeciding(false); }
  };

  if (!user.company_id) {
    return (
      <section>
        <h1 className="app-title">ผู้สมัคร</h1>
        <div className="app-empty"><p className="profile-error">บัญชีนี้ยังไม่ได้ผูกกับสถานประกอบการ กรุณาติดต่อเจ้าหน้าที่</p></div>
      </section>
    );
  }

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">ผู้สมัคร</h1>
        <span className="app-term">ภาคการศึกษา {activeTerm?.code ?? '—'}</span>
      </div>

      <ApiState loading={loading} error={error} />
      {notice && <div className="app-banner">{notice}</div>}

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
            <span className="students-filter-count">{inPosition.filter(f.match).length}</span>
          </button>
        ))}
      </div>

      <select className="profile-input all-select cp-position-filter" value={positionId} onChange={(e) => setPositionId(e.target.value)} aria-label="ตำแหน่ง">
        <option value="">ทุกตำแหน่ง</option>
        {positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>

      {visible.length === 0 ? (
        <div className="app-empty"><p>ไม่มีผู้สมัครในกลุ่มนี้</p></div>
      ) : (
        <ul className="app-list">
          {visible.map((app) => (
            <li key={app.application_id} className="app-card">
              <div className="app-card-head">
                <div>
                  <p className="app-company">{app.student.th_name}</p>
                  <p className="pending-student-meta">
                    รหัส {app.student.student_code} · GPAX <GpaxValue gpax={app.student.gpax} />{app.student.curriculum && ` · หลักสูตร พ.ศ. 25${app.student.curriculum}`}
                  </p>
                </div>
                <ApplicationStatusBadge status={app.status} />
              </div>

              {CONTACT_VISIBLE_STATUSES.includes(app.status) && (
                <div className="cp-contact">
                  <a href={`mailto:${app.student.email}`} className="cp-contact-item">{app.student.email}</a>
                  {app.student.phone && (
                    <a href={`tel:${app.student.phone}`} className="cp-contact-item">{formatPhone(app.student.phone)}</a>
                  )}
                </div>
              )}

              <div className="pending-target">
                <p className="pending-label">สมัครตำแหน่ง</p>
                <p className="pending-company">{positionOf(app.position_id)?.name ?? '-'}</p>
              </div>

              <div className="pending-docs">
                <DocumentLink url={app.resume_url} label="ดูเรซูเม่" />
                <DocumentLink url={app.transcript_url} label="ดู Transcript" />
              </div>

              {app.status === 'released' && <p className="cp-released">นักศึกษาสละสิทธิ์ — ยืนยันไปฝึกที่สถานประกอบการอื่นแล้ว</p>}
              {app.status === 'withdrawn' && <p className="cp-released">นักศึกษาถอนใบสมัครแล้ว</p>}

              {app.status === 'approved' ? (
                <div className="app-actions pending-actions">
                  <button type="button" className="app-btn app-btn--ghost" onClick={() => decide(app, 'declined')} disabled={deciding}>ไม่ผ่านการคัดเลือก</button>
                  <button type="button" className="app-btn app-btn--primary" onClick={() => decide(app, 'accepted')} disabled={deciding}>ผ่านการคัดเลือก</button>
                </div>
              ) : (
                <p className="app-date all-submitted">อาจารย์นิเทศก์อนุมัติเมื่อ {formatDate(app.approved_at)}</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
