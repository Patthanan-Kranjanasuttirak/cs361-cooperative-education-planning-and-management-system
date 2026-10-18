import { useEffect, useState } from 'react';
import { useAuth } from '../../context/useAuth';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
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

function PositionDialog({ initial, positions, termLabel, onSave, onClose }) {
  const [form, setForm] = useState(() =>
    initial ? { name: initial.name, description: initial.description ?? '', quota: initial.quota == null ? '' : String(initial.quota) } : EMPTY_FORM
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && !saving && onClose();
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose, saving]);

  const change = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault(); if (saving) return;
    const nextErrors = validate(form, positions, initial?.id);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    try { await onSave({ name: form.name.trim(), description: form.description.trim() || null, quota: form.quota === '' ? null : Number(form.quota) }); }
    catch (error) { setErrors((previous) => ({ ...previous, submit: error.message })); }
    finally { setSaving(false); }
  };

  return (
    <div className="cm-overlay" role="dialog" aria-modal="true" aria-labelledby="pos-dialog-title">
      <div className="cm-backdrop" onClick={saving ? undefined : onClose} />
      <form className="cm-dialog cp-dialog" onSubmit={submit} noValidate>
        <div className="cm-dialog-head">
          <h2 id="pos-dialog-title" className="cm-dialog-title">{initial ? 'แก้ไขตำแหน่ง' : 'เพิ่มตำแหน่ง'}</h2>
          <button type="button" className="cm-close" onClick={onClose} disabled={saving} aria-label="ปิด">✕</button>
        </div>
        <div className="cm-dialog-body">
          <fieldset className="profile-section" disabled={saving}>
            <legend className="profile-section-title">ข้อมูลตำแหน่ง · ภาคการศึกษา {termLabel}</legend>
            <label className="profile-label" htmlFor="pos-name">ชื่อตำแหน่ง <span className="profile-required">*</span></label>
            <input id="pos-name" name="name" className={`profile-input${errors.name ? ' profile-input--error' : ''}`} value={form.name} onChange={change} placeholder="เช่น Software Developer Intern" maxLength={255} autoFocus />
            {errors.name && <p className="profile-error">{errors.name}</p>}

            <label className="profile-label" htmlFor="pos-description">รายละเอียดงาน</label>
            <textarea id="pos-description" name="description" rows={4} className="profile-input cm-textarea" value={form.description} onChange={change} />

            <label className="profile-label" htmlFor="pos-quota">จำนวนที่เปิดรับ (คน)</label>
            <input id="pos-quota" name="quota" inputMode="numeric" className={`profile-input cp-quota-input${errors.quota ? ' profile-input--error' : ''}`} value={form.quota} onChange={change} placeholder="ไม่ระบุ" />
            {errors.quota && <p className="profile-error">{errors.quota}</p>}
          </fieldset>
        </div>
        <div className="cm-dialog-foot">
          <button type="button" className="app-btn pending-btn-cancel" onClick={onClose} disabled={saving}>ยกเลิก</button>
          {errors.submit && <p className="profile-error" role="alert">{errors.submit}</p>}
          <button type="submit" className="app-btn app-btn--primary" disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
        </div>
      </form>
    </div>
  );
}

export default function CompanyPositions() {
  const { user } = useAuth();
  const { data: allPositions, reload, loading: positionsLoading, error: positionsError } = useApi('/company/positions');
  const { data: activeTerm, loading: termLoading, error: termError } = useApi('/terms/active', null);
  const { data: applicants, loading: applicantsLoading, error: applicantsError } = useApi(activeTerm ? `/company/applications?term_id=${activeTerm.term_id}` : null);
  const positions = allPositions.filter((p) => p.term_id == null || p.term_id === activeTerm?.term_id);
  const loading = positionsLoading || termLoading || applicantsLoading;
  const loadError = !user.company_id ? 'บัญชีนี้ยังไม่ได้ผูกกับสถานประกอบการ กรุณาติดต่อเจ้าหน้าที่' : positionsError || termError || applicantsError;
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const statsOf = (positionId) => {
    const apps = applicants.filter((a) => a.position_id === positionId);
    return { applicants: apps.length, confirmed: apps.filter((a) => a.status === 'confirmed').length };
  };
  const handleSave = async (data) => {
    const body = editing === 'new' ? { ...data, term_id: activeTerm.term_id } : data;
    await api(editing === 'new' ? '/company/positions' : `/company/positions/${editing.id}`, { method: editing === 'new' ? 'POST' : 'PUT', body });
    await reload(); setEditing(null); setNotice(`บันทึกตำแหน่ง ${data.name} แล้ว`);
  };
  const toggleOpen = async (p) => {
    if (busy || (p.is_open && !window.confirm(`ปิดรับสมัครตำแหน่ง ${p.name}?\n\nนักศึกษาจะสมัครตำแหน่งนี้เพิ่มไม่ได้ แต่ผู้สมัครเดิมยังพิจารณาได้ตามปกติ`))) return;
    setBusy(true);
    try {
      await api(`/company/positions/${p.id}`, { method: 'PATCH', body: { is_open: !p.is_open } });
      await reload(); setNotice(`${p.is_open ? 'ปิด' : 'เปิด'}รับสมัครตำแหน่ง ${p.name} แล้ว`);
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  };
  const remove = async (p) => {
    if (busy || !window.confirm(`ลบตำแหน่ง ${p.name}?`)) return;
    setBusy(true);
    try { await api(`/company/positions/${p.id}`, { method: 'DELETE' }); await reload(); setNotice(`ลบตำแหน่ง ${p.name} แล้ว`); }
    catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <div className="app-header">
        <div>
          <h1 className="app-title">ตำแหน่งของเรา</h1>
          <p className="app-term">ภาคการศึกษา {activeTerm?.code ?? '—'}</p>
        </div>
        <button type="button" className="app-btn app-btn--primary" onClick={() => { setEditing('new'); setNotice(''); }} disabled={loading || !!loadError || busy || !activeTerm}>
          + เพิ่มตำแหน่ง
        </button>
      </div>

      {notice && <div className="app-banner" role="status">{notice}</div>}
      {!termLoading && !activeTerm && !termError && <div className="cp-notice">ยังไม่มีภาคการศึกษาที่เปิดใช้งาน กรุณาติดต่อเจ้าหน้าที่ก่อนเพิ่มตำแหน่ง</div>}

      {loading ? (
        <div className="app-empty"><p>กำลังโหลด...</p></div>
      ) : loadError ? (
        <div className="app-empty"><p className="profile-error">{loadError}</p></div>
      ) : positions.length === 0 ? (
        <div className="app-empty"><p>ยังไม่มีตำแหน่งในภาคการศึกษานี้</p></div>
      ) : (
        <ul className="app-list">
          {positions.map((p) => (
            <PositionCard key={p.id} position={p} stats={statsOf(p.id)} fullHint={'ยืนยันสิทธิ์ครบตามจำนวนแล้ว — ถ้าไม่รับเพิ่ม กด "ปิดรับสมัคร" ได้'}>
              <div className="app-actions pending-actions">
                {/* ลบได้เฉพาะตำแหน่งที่ยังไม่มีผู้สมัคร (มีแล้วให้ปิดรับสมัครแทน) */}
                {p.applicant_count === 0 && (
                  <button type="button" className="app-btn app-btn--ghost cm-small-btn" onClick={() => remove(p)} disabled={busy}>ลบ</button>
                )}
                <button type="button" className="app-btn pending-btn-cancel cm-small-btn" onClick={() => { setEditing(p); setNotice(''); }} disabled={busy}>แก้ไข</button>
                <button type="button" className={`app-btn cm-small-btn ${p.is_open ? 'pending-btn-cancel' : 'app-btn--primary'}`} onClick={() => toggleOpen(p)} disabled={busy}>
                  {p.is_open ? 'ปิดรับสมัคร' : 'เปิดรับสมัคร'}
                </button>
              </div>
            </PositionCard>
          ))}
        </ul>
      )}

      {editing && (
        <PositionDialog initial={editing === 'new' ? null : editing} positions={positions} termLabel={editing !== 'new' && editing.term_id == null ? 'ไม่จำกัดภาค' : activeTerm?.code ?? '—'} onSave={handleSave} onClose={() => setEditing(null)} />
      )}
    </section>
  );
}
