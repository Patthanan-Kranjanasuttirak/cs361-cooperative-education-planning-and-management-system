import { useState } from 'react';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import ApiState from '../../components/ApiState';
import CandidateDetails from '../../components/CandidateDetails';
import CoopResultBadge from '../../components/CoopResultBadge';
import GpaxValue from '../../components/GpaxValue';
import SelectionBadge from '../../components/SelectionBadge';
import { curriculumLabel } from '../../config/coopCriteria';
import { SCREENING_STATUS, isCandidate } from '../../config/studentReview';
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/pendingApplications.css';
import '../CSS/myStudents.css';
import '../CSS/allApplications.css';
import '../CSS/selection.css';

const FILTERS = [
  { key: 'round', label: 'ทั้งหมดในรอบนี้', match: isCandidate },
  { key: 'undecided', label: 'ยังไม่คัดเลือก', match: (s) => isCandidate(s) && !s.committee_result },
  { key: 'passed', label: 'ผ่านการคัดเลือก', match: (s) => isCandidate(s) && s.committee_result === 'passed' },
  { key: 'failed', label: 'ไม่ผ่านการคัดเลือก', match: (s) => isCandidate(s) && s.committee_result === 'failed' },
  { key: 'announced', label: 'ประกาศผลแล้ว', match: (s) => Boolean(s.coop_result) },
];

// เรียงตามเกรดได้ทั้งมากไปน้อยและน้อยไปมาก (ยังไม่กรอก GPAX อยู่ท้ายเสมอ)
const byGpax = (direction) => (a, b) => (a.gpax == null) - (b.gpax == null) || direction * ((a.gpax ?? 0) - (b.gpax ?? 0));
const SORTS = {
  gpax_desc: { label: 'GPAX มาก → น้อย', compare: byGpax(-1) },
  gpax_asc: { label: 'GPAX น้อย → มาก', compare: byGpax(1) },
  code: { label: 'รหัสนักศึกษา', compare: (a, b) => a.student_code.localeCompare(b.student_code) },
};

// กรรมการสหกิจศึกษา: ดูข้อมูลและโน้ตของเจ้าหน้าที่ แล้วเลือกผ่าน/ไม่ผ่าน (เจ้าหน้าที่ประกาศผลได้ทันทีหลังเลือก)
export default function SelectStudents() {
  const { data: students, setData, loading, error } = useApi('/students');
  const { data: selection, reload: reloadSelection, error: selectionError } = useApi('/coop-selection', null);
  const [filter, setFilter] = useState('round');
  // คนที่เพิ่งเลือกผลยังอยู่ในแท็บเดิมจนกว่าจะเปลี่ยนแท็บ การ์ดจะได้ไม่หายไปทันทีที่กด
  const [justDecided, setJustDecided] = useState(() => new Set());
  const changeFilter = (key) => { setFilter(key); setJustDecided(new Set()); };
  const [sort, setSort] = useState('gpax_desc');
  const [screening, setScreening] = useState('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const keyword = search.trim().toLowerCase();
  const visible = students
    .filter((s) => FILTERS.find((f) => f.key === filter).match(s) || justDecided.has(s.student_id))
    .filter((s) => screening === 'all' || (s.screening_status ?? 'none') === screening)
    .filter((s) => !keyword || s.th_name.toLowerCase().includes(keyword) || s.student_code.includes(keyword))
    .sort(SORTS[sort].compare);

  // เปลี่ยนผลได้โดยกดอีกตัวเลือก (แก้ได้จนกว่าเจ้าหน้าที่จะประกาศผล)
  const decide = async (student, value) => {
    if (busy || student.committee_result === value) return;
    setBusy(true); setNotice('');
    try {
      const result = await api(`/students/${student.student_id}/committee-result`, { method: 'PUT', body: { committee_result: value } });
      setData((prev) => prev.map((s) => (s.student_id === student.student_id ? { ...s, ...result } : s)));
      setJustDecided((prev) => new Set(prev).add(student.student_id));
      await reloadSelection();
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">คัดเลือกเข้าแผนสหกิจศึกษา</h1>
      </div>

      <ApiState loading={loading} error={error || selectionError} />
      {notice && <div className="app-banner" role="status">{notice}</div>}

      {selection && (
        <div className="selection-panel">
          <p className="selection-panel-title">คัดเลือกแล้ว {selection.candidates - selection.undecided} / {selection.candidates} คน</p>
          <p className="selection-panel-text">ผ่านการคัดเลือก {selection.passed} คน · ไม่ผ่านการคัดเลือก {selection.failed} คน · เจ้าหน้าที่ประกาศผลได้ทันทีหลังคัดเลือก ประกาศแล้วแก้ไขไม่ได้</p>
          <p className="selection-panel-text">เมื่อเริ่มคัดเลือก นักศึกษาที่สมัครแผนแล้วจะแก้ข้อมูลคุณสมบัติ (GPAX, เกรด, Transcript) ไม่ได้จนกว่าจะประกาศผล</p>
        </div>
      )}

      <div className="students-filters" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={`students-filter${filter === f.key ? ' students-filter--active' : ''}`}
            onClick={() => changeFilter(f.key)}
          >
            {f.label}
            <span className="students-filter-count">{students.filter(f.match).length}</span>
          </button>
        ))}
      </div>

      <div className="selection-toolbar">
        <input className="pending-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาชื่อ / รหัสนักศึกษา" />
        <select className="profile-input all-select" aria-label="ผลคัดกรองของเจ้าหน้าที่" value={screening} onChange={(e) => setScreening(e.target.value)}>
          <option value="all">ผลคัดกรอง: ทั้งหมด</option>
          {Object.entries(SCREENING_STATUS).map(([key, info]) => <option key={key} value={key}>{info.label}</option>)}
        </select>
        <select className="profile-input all-select" aria-label="เรียงตาม" value={sort} onChange={(e) => setSort(e.target.value)}>
          {Object.entries(SORTS).map(([key, { label }]) => <option key={key} value={key}>เรียง: {label}</option>)}
        </select>
      </div>

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
                  {s.coop_result ? <CoopResultBadge student={s} /> : <>
                    <SelectionBadge kind="committee" value={s.committee_result} />
                    <SelectionBadge kind="screening" value={s.screening_status} />
                  </>}
                </div>
              </div>

              {s.screening_note && <p className="selection-note"><span>โน้ตจากเจ้าหน้าที่</span>{s.screening_note}</p>}
              <CandidateDetails student={s} />

              {isCandidate(s) && (
                <div className="selection-choices" role="group" aria-label={`ผลการคัดเลือกของ ${s.th_name}`}>
                  {[['passed', 'ผ่าน'], ['failed', 'ไม่ผ่าน']].map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={s.committee_result === value}
                      className={`app-btn selection-choice selection-choice--${value}${s.committee_result === value ? ' selection-choice--active' : ''}`}
                      onClick={() => decide(s, value)}
                      disabled={busy}
                    >
                      {s.committee_result === value ? `✓ ${label}` : label}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
