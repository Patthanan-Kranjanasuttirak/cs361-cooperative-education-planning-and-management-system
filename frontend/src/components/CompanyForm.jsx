import { useState } from 'react';
import '../pages/CSS/studentProfile.css';

export default function CompanyForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(Object.fromEntries(['name','logo','description','province','location','application_start','application_end'].map((key) => [key, initial?.[key] ?? ''])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault(); if (saving) return; setSaving(true); setError('');
    try { await onSave(form); } catch (err) { setError(err.message); } finally { setSaving(false); }
  };
  return <form className="profile-form" onSubmit={submit}>
    <fieldset className="profile-section" disabled={saving}>
      <legend className="profile-section-title">ข้อมูลสถานประกอบการ</legend>
      {[
        ['name','ชื่อสถานประกอบการ',255],['logo','โลโก้ (ชื่อไฟล์หรือ URL)',255],['description','รายละเอียด',20000],
        ['province','จังหวัด',100],['location','ที่ตั้ง',10000],['application_start','วันเปิดรับสมัคร'],['application_end','วันปิดรับสมัคร'],
      ].map(([key,label,max]) => <div key={key}>
        <label className="profile-label" htmlFor={`company-${key}`}>{label}</label>
        {['description','location'].includes(key)
          ? <textarea id={`company-${key}`} className="profile-input cm-textarea" maxLength={max} value={form[key]} onChange={(e) => setForm((old) => ({ ...old, [key]: e.target.value }))} />
          : <input id={`company-${key}`} className="profile-input" type={key.startsWith('application_') ? 'date' : 'text'} required={key === 'name'} maxLength={max} value={form[key]} onChange={(e) => setForm((old) => ({ ...old, [key]: e.target.value }))} />}
      </div>)}
      {error && <p className="profile-error" role="alert">{error}</p>}
    </fieldset>
    <div className="profile-actions">{onCancel && <button className="app-btn" type="button" onClick={onCancel} disabled={saving}>ยกเลิก</button>}<button className="profile-submit" type="submit" disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึกข้อมูล'}</button></div>
  </form>;
}
