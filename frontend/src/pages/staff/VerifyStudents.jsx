import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import ApiState from '../../components/ApiState';
import CandidateDetails from '../../components/CandidateDetails';
import CoopResultBadge from '../../components/CoopResultBadge';
import GpaxValue from '../../components/GpaxValue';
import SelectionBadge from '../../components/SelectionBadge';
import { curriculumLabel } from '../../config/coopCriteria';
import { COMMITTEE_RESULT, SCREENING_STATUS, isCandidate } from '../../config/studentReview';
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/pendingApplications.css';
import '../CSS/myStudents.css';
import '../CSS/allApplications.css';
import '../CSS/selection.css';
import '../../components/CSS/ApplicationStatusBadge.css';

// ผู้สมัครแผนที่ยังไม่ประกาศผล: รอคัดกรอง → รอกรรมการคัดเลือก → รอประกาศผล (ผ่าน) / ไม่ผ่านการคัดเลือก
const decided = (s) => isCandidate(s) && Boolean(s.committee_result);
// badge = ป้ายสถานะบนการ์ดของแต่ละขั้น (ขั้นประกาศผลแล้วใช้ป้ายผลจริงของนักศึกษา)
const FILTERS = [
  { key: 'unscreened', label: 'รอคัดกรอง', badge: { label: 'รอคัดกรอง', tone: 'pending' }, match: (s) => isCandidate(s) && !s.committee_result && !s.screening_status },
  { key: 'screened', label: 'รอกรรมการคัดเลือก', badge: { label: 'รอกรรมการคัดเลือก', tone: 'pending' }, match: (s) => isCandidate(s) && !s.committee_result && Boolean(s.screening_status) },
  { key: 'passed', label: 'รอประกาศผล', badge: { label: 'ผ่านการคัดเลือก · รอประกาศผล', tone: 'info' }, match: (s) => decided(s) && s.committee_result === 'passed', announce: true },
  { key: 'failed', label: 'ไม่ผ่านการคัดเลือก', badge: { label: 'ไม่ผ่านการคัดเลือก · รอประกาศผล', tone: 'danger' }, match: (s) => decided(s) && s.committee_result === 'failed', announce: true },
  { key: 'announced', label: 'ประกาศผลแล้ว', match: (s) => Boolean(s.coop_result) },
  { key: 'none', label: 'ยังไม่สมัครแผน', badge: { label: 'ยังไม่สมัครแผน', tone: 'muted' }, match: (s) => !s.profile_status },
  { key: 'all', label: 'ทั้งหมด', match: () => true },
];

// นักศึกษาแต่ละคนอยู่ได้ขั้นเดียว จึงแสดงป้ายเดียวตามขั้นปัจจุบัน
function StageBadge({ student }) {
  const stage = FILTERS.find((f) => f.key !== 'all' && f.match(student));
  if (!stage.badge) return <CoopResultBadge student={student} />;
  return <span className={`status-badge status-badge--${stage.badge.tone}`}>{stage.badge.label}</span>;
}

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// คัดกรองเบื้องต้นและโน้ตถึงกรรมการ (นักศึกษาไม่เห็น)
function ScreeningForm({ student, onSaved }) {
  const [status, setStatus] = useState(student.screening_status ?? '');
  const [note, setNote] = useState(student.screening_note ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const changed = status !== (student.screening_status ?? '') || note.trim() !== (student.screening_note ?? '');
  const save = async (event) => {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const result = await api(`/students/${student.student_id}/screening`, { method: 'PUT', body: { screening_status: status || null, screening_note: note.trim() || null } });
      onSaved(result);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  return <form className="selection-screening" onSubmit={save}>
    <fieldset disabled={saving} className="profile-fields">
      <label className="pending-label" htmlFor={`screening-${student.student_id}`}>คัดกรองเบื้องต้น</label>
      <select id={`screening-${student.student_id}`} className="profile-input all-select" value={status} onChange={(e) => setStatus(e.target.value)}>
        {Object.entries(SCREENING_STATUS).map(([key, info]) => <option key={key} value={key === 'none' ? '' : key}>{info.label}</option>)}
      </select>
      <label className="pending-label" htmlFor={`note-${student.student_id}`}>โน้ตถึงกรรมการ (นักศึกษาไม่เห็น)</label>
      <textarea id={`note-${student.student_id}`} className="profile-input" rows={2} maxLength={10000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="เช่น GPAX ตรงกับ Transcript" />
      {error && <p role="alert" className="profile-error">{error}</p>}
      <div className="selection-actions">
        <button type="submit" className="app-btn app-btn--primary" disabled={!changed}>{saving ? 'กำลังบันทึก…' : 'บันทึกการคัดกรอง'}</button>
      </div>
    </fieldset>
  </form>;
}

// เจ้าหน้าที่: คัดกรองนักศึกษาที่สมัครแผนพร้อมโน้ต แล้วประกาศผลทีละคนหรือทั้งแท็บทันทีที่กรรมการคัดเลือก
export default function VerifyStudents() {
  const { data: students, setData, reload, loading, error } = useApi('/students');
  const [filter, setFilter] = useState('unscreened');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const active = students.filter((s) => s.is_active);
  const keyword = search.trim().toLowerCase();
  const activeFilter = FILTERS.find((f) => f.key === filter);
  const visible = active.filter(
    (s) => activeFilter.match(s) &&
      (!keyword || s.th_name.toLowerCase().includes(keyword) || s.student_code.includes(keyword))
  );

  // ประกาศผลตามผลของกรรมการ: นักศึกษาเห็นผลทันทีและแก้ไขไม่ได้
  const announce = async (list) => {
    const who = list.length === 1 ? list[0].th_name : `นักศึกษา ${list.length} คน`;
    const result = list.length === 1 ? COMMITTEE_RESULT[list[0].committee_result].label : 'ตามผลของคณะกรรมการ';
    if (busy || !window.confirm(`ประกาศผลของ ${who} (${result})?\n\nนักศึกษาจะเห็นผลทันทีและแก้ไขผลไม่ได้`)) return;
    setBusy(true); setNotice('');
    try {
      const { announced } = await api('/coop-selection/announce', { method: 'POST', body: { student_ids: list.map((s) => s.student_id) } });
      await reload();
      setNotice(`ประกาศผลแล้ว ${announced} คน`);
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">คัดกรองและประกาศผล</h1>
        <Link to="/staff/report" className="app-btn app-btn--primary">รายชื่อผู้ผ่านเข้าแผน</Link>
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

      {activeFilter.announce && visible.length > 0 && (
        <div className="selection-actions selection-bulk">
          <p className="selection-panel-title selection-bulk-count">{activeFilter.label} {visible.length} คน</p>
          <button type="button" className="app-btn app-btn--primary" onClick={() => announce(visible)} disabled={busy}>ประกาศผลทั้งหมด ({visible.length} คน)</button>
        </div>
      )}

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
                    รหัส {s.student_code} · {curriculumLabel(s.curriculum)}{s.major ? ` · ${s.major}` : ''} · GPAX <GpaxValue gpax={s.gpax} />
                  </p>
                </div>
                <div className="selection-badges">
                  <StageBadge student={s} />
                  {isCandidate(s) && s.screening_status && <SelectionBadge kind="screening" value={s.screening_status} />}
                </div>
              </div>

              <CandidateDetails student={s} />

              {isCandidate(s) ? (
                <ScreeningForm
                  key={`${s.screening_status}-${s.screening_note}`}
                  student={s}
                  onSaved={(result) => {
                    setData((prev) => prev.map((row) => (row.student_id === s.student_id ? { ...row, ...result } : row)));
                    setNotice(`บันทึกการคัดกรองของ ${s.th_name} แล้ว`);
                  }}
                />
              ) : s.screening_note && (
                <p className="selection-note"><span>โน้ตจากการคัดกรอง</span>{s.screening_note}</p>
              )}
              {decided(s) && (
                <div className="selection-actions">
                  <button type="button" className="app-btn app-btn--primary" onClick={() => announce([s])} disabled={busy}>ประกาศผล</button>
                </div>
              )}
              {s.coop_result_at && <p className="app-date">ประกาศผลเมื่อ {formatDateTime(s.coop_result_at)}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
