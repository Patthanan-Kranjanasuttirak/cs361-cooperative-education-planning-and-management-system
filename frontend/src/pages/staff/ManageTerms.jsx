import { useEffect, useState } from 'react';
import { formatThaiDate } from '../../utils/applicationPeriod';
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/pendingApplications.css';
import '../CSS/manageCompanies.css';
import '../CSS/manageTerms.css';
import '../../components/CSS/ApplicationStatusBadge.css';

// MOCK: ยังไม่มี API — TODO: GET /api/terms (2/2569 ตรงกับข้อมูลใน 01-schema.sql)
const MOCK_TERMS = [
  { term_id: 1, code: '2/2569', plan_open_at: '2026-08-01', plan_close_at: '2027-01-15', coop_start: '2027-01-18', coop_end: '2027-05-14', is_active: true },
  { term_id: 2, code: '1/2569', plan_open_at: '2026-01-05', plan_close_at: '2026-05-31', coop_start: '2026-06-15', coop_end: '2026-10-16', is_active: false },
  { term_id: 3, code: '1/2570', plan_open_at: '2027-01-04', plan_close_at: '2027-05-31', coop_start: '2027-06-14', coop_end: '2027-10-15', is_active: false },
];

const EMPTY_FORM = { code: '', plan_open_at: '', plan_close_at: '', coop_start: '', coop_end: '' };

// "ภาค/ปี พ.ศ." เช่น 2/2569 (ภาค 1, 2 หรือ 3 = ภาคฤดูร้อน)
const CODE_PATTERN = /^[123]\/25\d{2}$/;

// เรียงใหม่ไปเก่า: ปีก่อน แล้วค่อยภาค
const sortKey = (code) => {
  const [sem, year] = code.split('/').map(Number);
  return year * 10 + sem;
};

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });

function planStatus(term) {
  const d = today();
  if (d < term.plan_open_at) return { key: 'upcoming', label: 'ยังไม่เปิดรับแผน' };
  if (d > term.plan_close_at) return { key: 'closed', label: 'ปิดรับแผนแล้ว' };
  return { key: 'open', label: 'เปิดรับแผนอยู่' };
}

function validate(form, terms, editingId) {
  const errors = {};
  const code = form.code.trim();
  if (!code) errors.code = 'กรุณากรอกภาคการศึกษา';
  else if (!CODE_PATTERN.test(code)) errors.code = 'รูปแบบต้องเป็น ภาค/ปี พ.ศ. เช่น 2/2569';
  else if (terms.some((t) => t.code === code && t.term_id !== editingId)) errors.code = 'มีภาคการศึกษานี้อยู่แล้ว';
  // ตรงกับ NOT NULL + CHECK ในตาราง terms
  if (!form.plan_open_at || !form.plan_close_at) errors.plan = 'กรุณากรอกวันเปิดและวันปิดรับแผนให้ครบ';
  else if (form.plan_close_at < form.plan_open_at) errors.plan = 'วันปิดรับแผนต้องไม่ก่อนวันเปิดรับแผน';
  if (!form.coop_start || !form.coop_end) errors.coop = 'กรุณากรอกวันเริ่มและวันสิ้นสุดการฝึกงานให้ครบ';
  else if (form.coop_end < form.coop_start) errors.coop = 'วันสิ้นสุดการฝึกงานต้องไม่ก่อนวันเริ่มฝึกงาน';
  return errors;
}

function TermDialog({ initial, terms, onSave, onClose }) {
  const [form, setForm] = useState(() =>
    initial
      ? { code: initial.code, plan_open_at: initial.plan_open_at, plan_close_at: initial.plan_close_at, coop_start: initial.coop_start, coop_end: initial.coop_end }
      : EMPTY_FORM
  );
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const change = (group) => (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [group]: undefined }));
  };

  const submit = (e) => {
    e.preventDefault();
    const nextErrors = validate(form, terms, initial?.term_id);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave({ ...form, code: form.code.trim() });
  };

  const dateClass = (group) => `profile-input${errors[group] ? ' profile-input--error' : ''}`;

  return (
    <div className="cm-overlay" role="dialog" aria-modal="true" aria-labelledby="term-dialog-title">
      <div className="cm-backdrop" onClick={onClose} />
      <form className="cm-dialog term-dialog" onSubmit={submit} noValidate>
        <div className="cm-dialog-head">
          <h2 id="term-dialog-title" className="cm-dialog-title">{initial ? `แก้ไขภาคการศึกษา ${initial.code}` : 'เพิ่มภาคการศึกษา'}</h2>
          <button type="button" className="cm-close" onClick={onClose} aria-label="ปิด">✕</button>
        </div>

        <div className="cm-dialog-body">
          <fieldset className="profile-section">
            <legend className="profile-section-title">ภาคการศึกษา</legend>
            <label className="profile-label" htmlFor="term-code">ภาค/ปีการศึกษา <span className="profile-required">*</span></label>
            <input id="term-code" name="code" className={dateClass('code')} value={form.code} onChange={change('code')} placeholder="เช่น 2/2569" autoFocus />
            {errors.code ? <p className="profile-error">{errors.code}</p> : <p className="profile-hint">ภาค 1, 2 หรือ 3 (ภาคฤดูร้อน) ตามด้วยปี พ.ศ.</p>}
          </fieldset>

          <fieldset className="profile-section">
            <legend className="profile-section-title">ช่วงส่งแผนสหกิจ</legend>
            <div className="cm-row">
              <div className="cm-col">
                <label className="profile-label" htmlFor="term-plan-open">วันเปิดรับแผน <span className="profile-required">*</span></label>
                <input id="term-plan-open" type="date" name="plan_open_at" className={dateClass('plan')} value={form.plan_open_at} onChange={change('plan')} />
              </div>
              <div className="cm-col">
                <label className="profile-label" htmlFor="term-plan-close">วันปิดรับแผน <span className="profile-required">*</span></label>
                <input id="term-plan-close" type="date" name="plan_close_at" className={dateClass('plan')} value={form.plan_close_at} onChange={change('plan')} />
              </div>
            </div>
            {errors.plan && <p className="profile-error">{errors.plan}</p>}
          </fieldset>

          <fieldset className="profile-section">
            <legend className="profile-section-title">ช่วงฝึกงาน</legend>
            <div className="cm-row">
              <div className="cm-col">
                <label className="profile-label" htmlFor="term-coop-start">วันเริ่มฝึกงาน <span className="profile-required">*</span></label>
                <input id="term-coop-start" type="date" name="coop_start" className={dateClass('coop')} value={form.coop_start} onChange={change('coop')} />
              </div>
              <div className="cm-col">
                <label className="profile-label" htmlFor="term-coop-end">วันสิ้นสุดฝึกงาน <span className="profile-required">*</span></label>
                <input id="term-coop-end" type="date" name="coop_end" className={dateClass('coop')} value={form.coop_end} onChange={change('coop')} />
              </div>
            </div>
            {errors.coop && <p className="profile-error">{errors.coop}</p>}
          </fieldset>
        </div>

        <div className="cm-dialog-foot">
          <button type="button" className="app-btn pending-btn-cancel" onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="app-btn app-btn--primary">บันทึก</button>
        </div>
      </form>
    </div>
  );
}

export default function ManageTerms() {
  const [terms, setTerms] = useState(MOCK_TERMS);
  // null = ปิด, 'new' = เพิ่มใหม่, object = แก้ไขภาคนั้น
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');

  const sorted = [...terms].sort((a, b) => sortKey(b.code) - sortKey(a.code));
  const active = terms.find((t) => t.is_active);

  const handleSave = (form) => {
    if (editing === 'new') {
      // TODO: POST /api/terms — ภาคใหม่ยังไม่เปิดใช้งาน (is_active = false)
      const term_id = Math.max(0, ...terms.map((t) => t.term_id)) + 1;
      setTerms((prev) => [...prev, { term_id, ...form, is_active: false }]);
      setNotice(`เพิ่มภาคการศึกษา ${form.code} แล้ว`);
    } else {
      // TODO: PUT /api/terms/:id
      setTerms((prev) => prev.map((t) => (t.term_id === editing.term_id ? { ...t, ...form } : t)));
      setNotice(`บันทึกภาคการศึกษา ${form.code} แล้ว`);
    }
    setEditing(null);
  };

  const activate = (term) => {
    const ok = window.confirm(
      `ตั้งภาค ${term.code} เป็นภาคที่ใช้งาน?\n\n` +
        (active ? `ภาค ${active.code} จะถูกปิดการใช้งาน ` : '') +
        'นักศึกษาจะเห็นและสมัครได้เฉพาะตำแหน่งของภาคนี้'
    );
    if (!ok) return;
    // TODO: POST /api/terms/:id/activate — backend ปิดภาคเดิมแล้วเปิดภาคนี้ใน transaction เดียว
    //   (unique index one_active_term ใน DB กันไม่ให้เปิดพร้อมกัน 2 ภาค)
    setTerms((prev) => prev.map((t) => ({ ...t, is_active: t.term_id === term.term_id })));
    setNotice(`ตั้งภาค ${term.code} เป็นภาคที่ใช้งานแล้ว`);
  };

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">จัดการภาคการศึกษา</h1>
        <button type="button" className="app-btn app-btn--primary" onClick={() => { setEditing('new'); setNotice(''); }}>
          + เพิ่มภาคการศึกษา
        </button>
      </div>

      {notice && <div className="app-banner">{notice}</div>}

      <ul className="app-list">
        {sorted.map((t) => {
          const status = planStatus(t);
          return (
            <li key={t.term_id} className={`app-card term-card${t.is_active ? ' term-card--active' : ''}`}>
              <div className="app-card-head">
                <div className="term-title">
                  <p className="term-code">ภาคการศึกษา {t.code}</p>
                  {t.is_active && <span className="status-badge status-badge--success">ใช้งานอยู่</span>}
                </div>
                <span className={`term-status term-status--${status.key}`}>{status.label}</span>
              </div>

              <div className="term-periods">
                <div className="term-period">
                  <p className="pending-label">ช่วงส่งแผนสหกิจ</p>
                  <p className="term-dates">{formatThaiDate(t.plan_open_at)} – {formatThaiDate(t.plan_close_at)}</p>
                </div>
                <div className="term-period">
                  <p className="pending-label">ช่วงฝึกงาน</p>
                  <p className="term-dates">{formatThaiDate(t.coop_start)} – {formatThaiDate(t.coop_end)}</p>
                </div>
              </div>

              <div className="app-actions pending-actions">
                <button type="button" className="app-btn pending-btn-cancel" onClick={() => { setEditing(t); setNotice(''); }}>
                  แก้ไข
                </button>
                {!t.is_active && (
                  <button type="button" className="app-btn app-btn--primary" onClick={() => activate(t)}>
                    ตั้งเป็นภาคที่ใช้งาน
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {editing && (
        <TermDialog initial={editing === 'new' ? null : editing} terms={terms} onSave={handleSave} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}
