import { useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { fetchCompany } from '../../services/companyApi';
import { MOCK_ACTIVE_TERM, getPositionStats } from '../../services/companyPortalMock';
import PositionCard from '../../components/PositionCard';
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/pendingApplications.css';
import '../CSS/manageCompanies.css';
import '../CSS/companyPortal.css';
import '../../components/CSS/ApplicationStatusBadge.css';

const EMPTY_FORM = { name: '', description: '', quota: '' };

function validate(form, positions, editingId) {
  const errors = {};
  const name = form.name.trim();
  if (!name) errors.name = 'กรุณากรอกชื่อตำแหน่ง';
  else if (positions.some((p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== editingId)) errors.name = 'มีตำแหน่งชื่อนี้อยู่แล้ว';
  // ตรงกับ CHECK ใน positions: quota เป็นค่าว่างได้ หรือจำนวนเต็มไม่ติดลบ
  if (form.quota !== '' && !/^\d+$/.test(form.quota)) errors.quota = 'จำนวนที่เปิดรับต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป';
  return errors;
}

function PositionDialog({ initial, positions, onSave, onClose }) {
  const [form, setForm] = useState(() =>
    initial ? { name: initial.name, description: initial.description ?? '', quota: initial.quota == null ? '' : String(initial.quota) } : EMPTY_FORM
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

  const change = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const submit = (e) => {
    e.preventDefault();
    const nextErrors = validate(form, positions, initial?.id);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave({ name: form.name.trim(), description: form.description.trim() || null, quota: form.quota === '' ? null : Number(form.quota) });
  };

  return (
    <div className="cm-overlay" role="dialog" aria-modal="true" aria-labelledby="pos-dialog-title">
      <div className="cm-backdrop" onClick={onClose} />
      <form className="cm-dialog cp-dialog" onSubmit={submit} noValidate>
        <div className="cm-dialog-head">
          <h2 id="pos-dialog-title" className="cm-dialog-title">{initial ? 'แก้ไขตำแหน่ง' : 'เพิ่มตำแหน่ง'}</h2>
          <button type="button" className="cm-close" onClick={onClose} aria-label="ปิด">✕</button>
        </div>
        <div className="cm-dialog-body">
          <fieldset className="profile-section">
            <legend className="profile-section-title">ข้อมูลตำแหน่ง · ภาคการศึกษา {MOCK_ACTIVE_TERM}</legend>
            <label className="profile-label" htmlFor="pos-name">ชื่อตำแหน่ง <span className="profile-required">*</span></label>
            <input id="pos-name" name="name" className={`profile-input${errors.name ? ' profile-input--error' : ''}`} value={form.name} onChange={change} placeholder="เช่น Software Developer Intern" autoFocus />
            {errors.name && <p className="profile-error">{errors.name}</p>}

            <label className="profile-label" htmlFor="pos-description">รายละเอียดงาน</label>
            <textarea id="pos-description" name="description" rows={4} className="profile-input cm-textarea" value={form.description} onChange={change} />

            <label className="profile-label" htmlFor="pos-quota">จำนวนที่เปิดรับ (คน)</label>
            <input id="pos-quota" name="quota" inputMode="numeric" className={`profile-input cp-quota-input${errors.quota ? ' profile-input--error' : ''}`} value={form.quota} onChange={change} placeholder="ไม่ระบุ" />
            {errors.quota && <p className="profile-error">{errors.quota}</p>}
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

export default function CompanyPositions() {
  const { user } = useAuth();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // null = ปิด, 'new' = เพิ่มใหม่, object = แก้ไขตำแหน่งนั้น
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');

  // API คืนเฉพาะตำแหน่งของภาคที่ active อยู่แล้ว
  useEffect(() => {
    // ผู้ประสานงานที่ยังไม่ถูกผูกกับบริษัท (company_users) — ไม่ต้องเรียก API
    if (!user.company_id) {
      setLoadError('บัญชีนี้ยังไม่ได้ผูกกับสถานประกอบการ กรุณาติดต่อเจ้าหน้าที่');
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    fetchCompany(user.company_id, controller.signal)
      .then((c) => setPositions(c?.positions ?? []))
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadError('โหลดตำแหน่งไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      })
      .finally(() => {
        // คำขอที่ถูกยกเลิก (ออกจากหน้า หรือ StrictMode รัน effect ซ้ำ) ไม่ต้องปิดสถานะโหลด
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [user.company_id]);

  const handleSave = (data) => {
    if (editing === 'new') {
      // TODO: POST /api/company/positions — backend ใส่ company_id จากผู้ login และ term_id จากภาคที่ active
      const id = `new-${Date.now()}`;
      setPositions((prev) => [...prev, { id, is_open: true, ...data }]);
      setNotice(`เพิ่มตำแหน่ง ${data.name} แล้ว`);
    } else {
      // TODO: PUT /api/company/positions/:id
      setPositions((prev) => prev.map((p) => (p.id === editing.id ? { ...p, ...data } : p)));
      setNotice(`บันทึกตำแหน่ง ${data.name} แล้ว`);
    }
    setEditing(null);
  };

  const toggleOpen = (p) => {
    if (p.is_open && !window.confirm(`ปิดรับสมัครตำแหน่ง ${p.name}?\n\nนักศึกษาจะสมัครตำแหน่งนี้เพิ่มไม่ได้ แต่ผู้สมัครเดิมยังพิจารณาได้ตามปกติ`)) return;
    // TODO: PATCH /api/company/positions/:id { is_open }
    setPositions((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_open: !x.is_open } : x)));
    setNotice(`${p.is_open ? 'ปิด' : 'เปิด'}รับสมัครตำแหน่ง ${p.name} แล้ว`);
  };

  const remove = (p) => {
    if (!window.confirm(`ลบตำแหน่ง ${p.name}?`)) return;
    // TODO: DELETE /api/company/positions/:id — backend ตอบ 409 ถ้ามีใบสมัครแล้ว
    setPositions((prev) => prev.filter((x) => x.id !== p.id));
    setNotice(`ลบตำแหน่ง ${p.name} แล้ว`);
  };

  return (
    <section>
      <div className="app-header">
        <div>
          <h1 className="app-title">ตำแหน่งของเรา</h1>
          <p className="app-term">ภาคการศึกษา {MOCK_ACTIVE_TERM}</p>
        </div>
        <button type="button" className="app-btn app-btn--primary" onClick={() => { setEditing('new'); setNotice(''); }} disabled={loading || !!loadError}>
          + เพิ่มตำแหน่ง
        </button>
      </div>

      {notice && <div className="app-banner">{notice}</div>}

      {loading ? (
        <div className="app-empty"><p>กำลังโหลด...</p></div>
      ) : loadError ? (
        <div className="app-empty"><p className="profile-error">{loadError}</p></div>
      ) : positions.length === 0 ? (
        <div className="app-empty"><p>ยังไม่มีตำแหน่งในภาคการศึกษานี้</p></div>
      ) : (
        <ul className="app-list">
          {positions.map((p) => (
            <PositionCard key={p.id} position={p} fullHint={'ยืนยันสิทธิ์ครบตามจำนวนแล้ว — ถ้าไม่รับเพิ่ม กด "ปิดรับสมัคร" ได้'}>
              <div className="app-actions pending-actions">
                {/* ลบได้เฉพาะตำแหน่งที่ยังไม่มีผู้สมัคร (มีแล้วให้ปิดรับสมัครแทน) */}
                {getPositionStats(p.id).applicants === 0 && (
                  <button type="button" className="app-btn app-btn--ghost cm-small-btn" onClick={() => remove(p)}>ลบ</button>
                )}
                <button type="button" className="app-btn pending-btn-cancel cm-small-btn" onClick={() => { setEditing(p); setNotice(''); }}>แก้ไข</button>
                <button type="button" className={`app-btn cm-small-btn ${p.is_open ? 'pending-btn-cancel' : 'app-btn--primary'}`} onClick={() => toggleOpen(p)}>
                  {p.is_open ? 'ปิดรับสมัคร' : 'เปิดรับสมัคร'}
                </button>
              </div>
            </PositionCard>
          ))}
        </ul>
      )}

      {editing && (
        <PositionDialog initial={editing === 'new' ? null : editing} positions={positions} onSave={handleSave} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}
