import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import { ROLES } from '../../config/roles';
import { formatPhone } from '../../utils/phone';
import ApiState from '../../components/ApiState';
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/pendingApplications.css';
import '../CSS/myStudents.css';
import '../CSS/manageCompanies.css';
import '../CSS/manageUsers.css';
import '../CSS/eligibility.css';
import '../../components/CSS/ApplicationStatusBadge.css';

// บัญชีนักศึกษาสร้างอัตโนมัติเมื่อเข้าสู่ระบบด้วยบัญชี TU จึงไม่จัดการในหน้านี้
const ROLE_ORDER = ['committee', 'staff', 'company'];
// ชื่อบทบาทแบบสั้นสำหรับตาราง (ชื่อเต็มยาวจนดันตารางล้นกรอบ)
const ROLE_SHORT = { committee: 'กรรมการ', staff: 'เจ้าหน้าที่', company: 'ผู้ประสานงาน' };
const ROLE_TONE = { committee: 'success', staff: 'pending', company: 'muted' };

function UserEditor({ initial, companies, defaultCompanyId, onSave, onClose }) {
  const [form, setForm] = useState({ username: '', role: defaultCompanyId ? 'company' : 'committee', th_name: '', en_name: '', email: '', phone: '', company_id: defaultCompanyId ?? '', job_title: '', ...initial });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const onKey = (event) => { if (event.key === 'Escape' && !saving) onClose(); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKey); };
  }, [onClose, saving]);
  const change = (key) => (event) => { setForm((prev) => ({ ...prev, [key]: event.target.value })); setError(''); };
  const save = async (event) => {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError('');
    try {
      const body = Object.fromEntries(['username','role','th_name','en_name','email','phone'].map((key) => [key, form[key]]));
      if (form.role === 'company') { body.company_id = Number(form.company_id); body.job_title = form.job_title || null; }
      await onSave(body);
    } catch (err) { setError(err.message); }
    finally { setSaving(false); }
  };
  const field = (key, label, { required = true, ...props } = {}) => <>
    <label className="profile-label" htmlFor={`user-${key}`}>{label}{required && <span className="profile-required"> *</span>}</label>
    <input id={`user-${key}`} className="profile-input" value={form[key] ?? ''} onChange={change(key)} required={required} {...props} />
  </>;
  return <div className="cm-overlay" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title">
    <div className="cm-backdrop" onClick={saving ? undefined : onClose} />
    <form className="cm-dialog" onSubmit={save}>
      <div className="cm-dialog-head">
        <h2 id="user-dialog-title" className="cm-dialog-title">{initial ? `แก้ไข ${initial.th_name}` : 'เพิ่มผู้ใช้งาน'}</h2>
        <button type="button" className="cm-close" onClick={onClose} disabled={saving} aria-label="ปิด">✕</button>
      </div>
      <fieldset className="cm-dialog-body" disabled={saving}>
        <fieldset className="profile-section">
          <legend className="profile-section-title">บัญชีผู้ใช้</legend>
          <label className="profile-label" htmlFor="user-role">บทบาท <span className="profile-required">*</span></label>
          {initial ? <p className="profile-readonly-value user-readonly">{ROLES[form.role].label} · {form.username}</p> :
            <select id="user-role" className="profile-input" value={form.role} onChange={change('role')}>{ROLE_ORDER.map((key) => <option key={key} value={key}>{ROLES[key].label}</option>)}</select>}
          {field('username', 'ชื่อบัญชี', { maxLength:50 })}
          {field('email', 'อีเมล (ใช้เข้าสู่ระบบ)', { type:'email', maxLength:255 })}
        </fieldset>
        <fieldset className="profile-section">
          <legend className="profile-section-title">ข้อมูลผู้ใช้</legend>
          <div className="cm-row">
            <div className="cm-col">{field('th_name', 'ชื่อ-นามสกุล (ภาษาไทย)', { maxLength:255 })}</div>
            <div className="cm-col">{field('en_name', 'ชื่อ-นามสกุล (ภาษาอังกฤษ)', { maxLength:255 })}</div>
          </div>
          {form.role === 'company' && <div className="cm-row">
            <div className="cm-col">
              <label className="profile-label" htmlFor="user-company">สถานประกอบการ <span className="profile-required">*</span></label>
              <select id="user-company" className="profile-input" value={form.company_id ?? ''} onChange={change('company_id')} required>
                <option value="">เลือกสถานประกอบการ</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="cm-col">{field('job_title', 'ตำแหน่งงาน', { required:false, maxLength:150 })}</div>
          </div>}
          <div className="cm-row"><div className="cm-col">{field('phone', 'เบอร์โทรศัพท์', { required:false, type:'tel', maxLength:20 })}</div></div>
        </fieldset>
        {error && <p role="alert" className="profile-error">{error}</p>}
      </fieldset>
      <div className="cm-dialog-foot">
        <button className="app-btn pending-btn-cancel" type="button" onClick={onClose} disabled={saving}>ยกเลิก</button>
        <button className="app-btn app-btn--primary" type="submit" disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึก'}</button>
      </div>
    </form>
  </div>;
}

export default function ManageUsers() {
  const { user: currentUser } = useAuth();
  const [params] = useSearchParams();
  const { data: users, reload, loading, error } = useApi('/users');
  const { data: companyResult, error: companyError } = useApi('/companies', { data: [] });
  const [companyId, setCompanyId] = useState(params.get('company') ?? '');
  const [busy, setBusy] = useState(false);
  const [roleFilter, setRoleFilter] = useState(params.has('company') ? 'company' : 'all');
  const [search, setSearch] = useState('');
  // null = ปิด, 'new' = เพิ่มใหม่, object = แก้ไขผู้ใช้นั้น
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');

  const companyName = (id) => companyResult.data.find((c) => c.id === id)?.name ?? '-';

  const filters = [
    { key: 'all', label: 'ทั้งหมด', match: () => true },
    ...ROLE_ORDER.map((r) => ({ key: r, label: ROLES[r].label, match: (u) => u.role === r })),
    { key: 'inactive', label: 'ปิดใช้งาน', match: (u) => !u.is_active },
  ];
  const activeFilter = filters.find((f) => f.key === roleFilter);
  const keyword = search.trim().toLowerCase();
  const visible = users
    .filter((u) => activeFilter.match(u) && (!companyId || u.company_id === Number(companyId)))
    .filter((u) => !keyword || [u.th_name, u.en_name, u.username, u.email].some((v) => v?.toLowerCase().includes(keyword)))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.username.localeCompare(b.username));

  const handleSave = async (data) => {
    await api(editing === 'new' ? '/users' : `/users/${editing.user_id}`, { method:editing === 'new' ? 'POST' : 'PUT', body:data });
    await reload(); setEditing(null); setNotice(`บันทึกข้อมูล ${data.th_name} แล้ว`);
  };
  const toggleActive = async (user) => {
    if (busy) return;
    if (user.is_active && !window.confirm(`ปิดการใช้งานบัญชี ${user.th_name}?\n\nผู้ใช้นี้จะเข้าสู่ระบบไม่ได้ แต่ข้อมูลเดิมยังอยู่ เปิดใช้งานใหม่ได้ภายหลัง`)) return;
    setBusy(true);
    try {
      await api(`/users/${user.user_id}`, { method:'PATCH', body:{is_active:!user.is_active} });
      await reload(); setNotice(`${user.is_active ? 'ปิด' : 'เปิด'}การใช้งานบัญชี ${user.th_name} แล้ว`);
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">จัดการผู้ใช้งาน</h1>
        <button type="button" className="app-btn app-btn--primary" onClick={() => { setEditing('new'); setNotice(''); }} disabled={loading || busy || Boolean(companyError)}>
          + เพิ่มผู้ใช้งาน
        </button>
      </div>

      <p className="app-hint user-student-hint">บัญชีนักศึกษาสร้างอัตโนมัติเมื่อนักศึกษาเข้าสู่ระบบด้วยบัญชี TU ดูข้อมูลนักศึกษาได้ที่หน้า "คัดกรองและประกาศผล"</p>
      <ApiState loading={loading} error={error || companyError} />
      {notice && <div className="app-banner" role="status">{notice}</div>}
      {companyId && <div className="app-banner">ผู้ประสานงานของ {companyName(Number(companyId))} <button type="button" className="app-btn pending-btn-cancel cm-small-btn" onClick={() => setCompanyId('')}>แสดงทุกบริษัท</button></div>}

      <div className="students-filters" role="tablist">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={roleFilter === f.key}
            className={`students-filter${roleFilter === f.key ? ' students-filter--active' : ''}`}
            onClick={() => { setRoleFilter(f.key); if (f.key !== 'company') setCompanyId(''); }}
          >
            {f.label}
            <span className="students-filter-count">{users.filter(f.match).length}</span>
          </button>
        ))}
      </div>

      <input
        className="pending-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="ค้นหาชื่อ / ชื่อผู้ใช้ / อีเมล"
      />

      {visible.length === 0 ? (
        <div className="app-empty"><p>ไม่พบผู้ใช้งาน</p></div>
      ) : (
        <div className="cm-table-wrap">
          <table className="cm-table">
            <thead>
              <tr>
                <th>ผู้ใช้งาน</th>
                <th>บทบาท</th>
                <th>สถานประกอบการ</th>
                <th aria-label="จัดการ" />
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.user_id} className={u.is_active ? '' : 'user-row--inactive'}>
                  <td data-label="ผู้ใช้งาน">
                    <p className="cm-company-name">
                      {u.th_name}
                      {!u.is_active && <span className="status-badge status-badge--danger user-inactive-badge">ปิดใช้งาน</span>}
                    </p>
                    <p className="cm-muted">{u.username === u.email ? u.email : `${u.username} · ${u.email}`}</p>
                  </td>
                  <td data-label="บทบาท">
                    <span className={`status-badge status-badge--${ROLE_TONE[u.role]}`} title={ROLES[u.role].label}>{ROLE_SHORT[u.role]}</span>
                  </td>
                  <td data-label={u.role === 'company' ? 'สถานประกอบการ' : ''}>
                    {u.role === 'company' ? (
                      <>
                        <p>{companyName(u.company_id)}</p>
                        <p className="cm-muted">{[u.job_title, formatPhone(u.phone)].filter(Boolean).join(' · ')}</p>
                      </>
                    ) : (
                      <p className="cm-muted">-</p>
                    )}
                  </td>
                  <td className="cm-actions">
                    <button type="button" className="app-btn pending-btn-cancel cm-small-btn" onClick={() => { setEditing(u); setNotice(''); }} disabled={busy}>แก้ไข</button>
                    {u.user_id === currentUser.user_id ? (
                      <span className="cm-muted user-toggle user-self">บัญชีของคุณ</span>
                    ) : (
                      <button
                        type="button"
                        className={`app-btn cm-small-btn user-toggle ${u.is_active ? 'app-btn--ghost' : 'app-btn--primary'}`}
                        onClick={() => toggleActive(u)} disabled={busy}
                      >
                        {u.is_active ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <UserEditor
          initial={editing === 'new' ? null : editing}
          companies={companyResult.data}
          defaultCompanyId={companyId}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
