import { useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useApi } from '../hooks/useApi';
import { api } from '../services/api';
import ApiState from './ApiState';
import '../pages/CSS/studentProfile.css';
import '../pages/CSS/myApplications.css';
import '../pages/CSS/manageCompanies.css';
import '../pages/CSS/myStudents.css';

function PositionEditor({ initial, companies, terms, companyMode, onSave, onCancel }) {
  const [form, setForm] = useState({ name: '', description: '', quota: '', term_id: '', company_id: '', ...initial });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const change = (key) => (event) => setForm((old) => ({ ...old, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault(); if (saving) return; setSaving(true); setError('');
    try { await onSave({ name: form.name, description: form.description, quota: form.quota === '' || form.quota === null ? null : Number(form.quota), term_id: form.term_id === '' || form.term_id === null ? null : Number(form.term_id), ...(!companyMode ? { company_id: Number(form.company_id) } : {}) }); }
    catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return <div className="cm-overlay" role="dialog" aria-modal="true" aria-labelledby="position-title"><div className="cm-backdrop" onClick={saving ? undefined : onCancel} />
    <form className="cm-dialog" onSubmit={submit}><div className="cm-dialog-head"><h2 id="position-title">{initial ? 'แก้ไขตำแหน่ง' : 'เพิ่มตำแหน่ง'}</h2></div>
      <fieldset className="cm-dialog-body" disabled={saving}>
        {!companyMode && <><label className="profile-label" htmlFor="position-company">สถานประกอบการ</label><select id="position-company" className="profile-input" value={form.company_id} onChange={change('company_id')} required disabled={Boolean(initial)}><option value="">เลือกสถานประกอบการ</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></>}
        <label className="profile-label" htmlFor="position-name">ชื่อตำแหน่ง</label><input id="position-name" className="profile-input" value={form.name} onChange={change('name')} maxLength={255} required />
        <label className="profile-label" htmlFor="position-description">รายละเอียด</label><textarea id="position-description" className="profile-input cm-textarea" value={form.description ?? ''} onChange={change('description')} maxLength={20000} />
        <label className="profile-label" htmlFor="position-quota">จำนวนรับ (เว้นว่างได้)</label><input id="position-quota" className="profile-input" type="number" min="0" step="1" value={form.quota ?? ''} onChange={change('quota')} />
        <label className="profile-label" htmlFor="position-term">ภาคการศึกษา</label><select id="position-term" className="profile-input" value={form.term_id ?? ''} onChange={change('term_id')}><option value="">ไม่จำกัดภาค</option>{terms.map((term) => <option key={term.term_id} value={term.term_id}>{term.code}</option>)}</select>
        {error && <p role="alert" className="profile-error">{error}</p>}
      </fieldset>
      <div className="cm-dialog-foot"><button className="app-btn" type="button" onClick={onCancel} disabled={saving}>ยกเลิก</button><button className="app-btn app-btn--primary" type="submit" disabled={saving}>บันทึก</button></div>
    </form>
  </div>;
}

export default function PositionManager() {
  const { user } = useAuth();
  const companyMode = user.role === 'company';
  const endpoint = companyMode ? '/company/positions' : '/positions';
  const { data: positions, reload, loading, error } = useApi(endpoint);
  const { data: companyResult } = useApi(companyMode ? null : '/companies', { data: [] });
  const { data: terms } = useApi('/terms');
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');
  const [companyId, setCompanyId] = useState('');
  const save = async (body) => {
    await api(editing === 'new' ? endpoint : `${endpoint}/${editing.position_id}`, { method: editing === 'new' ? 'POST' : 'PUT', body });
    await reload(); setEditing(null); setNotice('บันทึกตำแหน่งแล้ว');
  };
  const action = async (position, remove = false) => {
    if (remove && !window.confirm(`ลบตำแหน่ง ${position.name}?`)) return;
    try { await api(`${endpoint}/${position.position_id}`, { method: remove ? 'DELETE' : 'PATCH', ...(remove ? {} : { body: { is_open: !position.is_open } }) }); await reload(); setNotice('บันทึกการเปลี่ยนแปลงแล้ว'); }
    catch (err) { setNotice(err.message); }
  };
  return <section><div className="app-header"><h1 className="app-title">{companyMode ? 'ตำแหน่งของเรา' : 'จัดการตำแหน่งงาน'}</h1><button className="app-btn app-btn--primary" onClick={() => setEditing('new')}>+ เพิ่มตำแหน่ง</button></div>
    <ApiState loading={loading} error={error} />{notice && <p role="status">{notice}</p>}
    {!companyMode && <select className="profile-input" aria-label="กรองสถานประกอบการ" value={companyId} onChange={(e) => setCompanyId(e.target.value)}><option value="">ทุกสถานประกอบการ</option>{companyResult.data.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
    <ul className="app-list">{positions.filter((p) => !companyId || p.company_id === Number(companyId)).map((position) => <li className="app-card" key={position.position_id}>
      <h2 className="app-company">{position.name}</h2><p>{position.description}</p><p>{position.term_id ? terms.find((t) => t.term_id === position.term_id)?.code : 'ไม่จำกัดภาค'} · {position.is_open ? 'เปิดรับ' : 'ปิดรับ'}</p>
      <p>ผู้สมัคร {position.applicant_count} · รับแล้ว {position.accepted_count} · จำนวนรับ {position.quota ?? 'ไม่ระบุ'}</p>
      <div className="app-actions"><button className="app-btn" onClick={() => setEditing(position)}>แก้ไข</button><button className="app-btn" onClick={() => action(position)}>{position.is_open ? 'ปิดรับ' : 'เปิดรับ'}</button><button className="app-btn" onClick={() => action(position, true)}>ลบ</button></div>
    </li>)}</ul>
    {editing && <PositionEditor initial={editing === 'new' ? null : editing} companies={companyResult.data} terms={terms} companyMode={companyMode} onSave={save} onCancel={() => setEditing(null)} />}
  </section>;
}
