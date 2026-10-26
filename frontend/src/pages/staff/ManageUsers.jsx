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

const ROLE_ORDER = ['student', 'advisor', 'staff', 'company'];
// ชื่อบทบาทแบบสั้นสำหรับตาราง (ชื่อเต็มยาวจนดันตารางล้นกรอบ)
const ROLE_SHORT = { student: 'นักศึกษา', advisor: 'อาจารย์', staff: 'เจ้าหน้าที่', company: 'ผู้ประสานงาน' };
const ROLE_TONE = { student: 'info', advisor: 'success', staff: 'pending', company: 'muted' };

function UserEditor({ initial, users, companies, defaultCompanyId, onSave, onClose }) {
  const [form, setForm] = useState({ username: '', role: defaultCompanyId ? 'company' : 'student', th_name: '', en_name: '', email: '', phone: '', advisor_id: '', is_supervisor: false, company_id: defaultCompanyId ?? '', job_title: '', ...initial });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const advisors = users.filter((u) => u.role === 'advisor' && (u.is_active || u.user_id === form.advisor_id));
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
      if (form.role === 'student' && (!initial || String(form.advisor_id ?? '') !== String(initial.advisor_id ?? ''))) body.advisor_id = form.advisor_id ? Number(form.advisor_id) : null;
      if (form.role === 'company') { body.company_id = Number(form.company_id); body.job_title = form.job_title || null; }
      if (form.role === 'advisor' && (!initial || form.is_supervisor !== initial.is_supervisor)) body.is_supervisor = form.is_supervisor;
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
          {field('username', form.role === 'student' ? 'รหัสนักศึกษา / ชื่อบัญชี' : 'ชื่อบัญชี', { maxLength:50 })}
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
          {form.role === 'student' && <>
            <label className="profile-label" htmlFor="user-advisor">อาจารย์ที่ปรึกษา</label>
            <select id="user-advisor" className="profile-input" value={form.advisor_id ?? ''} onChange={change('advisor_id')}>
              <option value="">ยังไม่กำหนด</option>{advisors.map((u) => <option key={u.user_id} value={u.user_id} disabled={!u.is_active}>{u.th_name}{u.is_active ? '' : ' (ปิดใช้งาน)'}</option>)}
            </select>
          </>}
          {/* อาจารย์นิเทศก์ = สิทธิ์อนุมัติใบสมัครของนักศึกษาทุกคน ไม่ต้องจับคู่กับนักศึกษา */}
          {form.role === 'advisor' && <label className="elig-declare" htmlFor="user-supervisor">
            <input id="user-supervisor" type="checkbox" checked={Boolean(form.is_supervisor)} onChange={(e) => setForm((prev) => ({ ...prev, is_supervisor: e.target.checked }))} />
            <span>เป็นอาจารย์นิเทศก์ (อนุมัติใบสมัครของนักศึกษาได้ทุกคน)</span>
          </label>}
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

  const advisors = users.filter((u) => u.role === 'advisor' && u.is_active);
  const nameOf = (id) => users.find((u) => u.user_id === id)?.th_name;
  const companyName = (id) => companyResult.data.find((c) => c.id === id)?.name ?? '-';

  const filters = [
    { key: 'all', label: 'ทั้งหมด', match: () => true },
    ...ROLE_ORDER.map((r) => ({ key: r, label: ROLES[r].label, match: (u) => u.role === r })),
    { key: 'supervisor', label: 'อาจารย์นิเทศก์', match: (u) => u.role === 'advisor' && u.is_supervisor },
    { key: 'no-advisor', label: 'ยังไม่มีอาจารย์ที่ปรึกษา', match: (u) => u.role === 'student' && !u.advisor_id && u.is_active },
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
  const assignAdvisor = async (student, advisorId) => {
    if (busy) return;
    setBusy(true);
    try {
      await api(`/students/${student.student_id}`, { method:'PUT', body:{ advisor_id:advisorId ? Number(advisorId) : null } });
      await reload();
      setNotice(advisorId ? `กำหนดอาจารย์ที่ปรึกษาของ ${student.th_name} เป็น ${nameOf(Number(advisorId))} แล้ว` : `ยกเลิกอาจารย์ที่ปรึกษาของ ${student.th_name} แล้ว`);
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  };
  const toggleSupervisor = async (user) => {
    if (busy) return;
    setBusy(true);
    try {
      await api(`/users/${user.user_id}`, { method:'PATCH', body:{ is_supervisor:!user.is_supervisor } });
      await reload(); setNotice(`${user.is_supervisor ? 'ยกเลิก' : 'กำหนด'} ${user.th_name} เป็นอาจารย์นิเทศก์แล้ว`);
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  };
  const toggleActive = async (user) => {
    if (busy) return;
    const advisees = user.role === 'advisor' ? users.filter((u) => u.advisor_id === user.user_id && u.is_active).length : 0;
    if (user.is_active && !window.confirm(`ปิดการใช้งานบัญชี ${user.th_name}?\n\nผู้ใช้นี้จะเข้าสู่ระบบไม่ได้ แต่ข้อมูลเดิมยังอยู่ เปิดใช้งานใหม่ได้ภายหลัง` + (advisees ? `\nอาจารย์ท่านนี้ดูแลนักศึกษาอยู่ ${advisees} คน` : ''))) return;
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
                <th>อาจารย์ที่ปรึกษา / สถานประกอบการ</th>
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
                    {u.is_supervisor && <span className="status-badge status-badge--info user-inactive-badge">นิเทศก์</span>}
                  </td>
                  <td data-label={u.role === 'student' ? 'อาจารย์ที่ปรึกษา' : u.role === 'company' ? 'สถานประกอบการ' : ''}>
                    {u.role === 'student' ? (
                      <select
                        className={`profile-input user-advisor-select${u.advisor_id ? '' : ' user-advisor-select--empty'}`}
                        aria-label={`อาจารย์ที่ปรึกษาของ ${u.th_name}`}
                        value={u.advisor_id ?? ''}
                        onChange={(e) => assignAdvisor(u, e.target.value)}
                        disabled={!u.is_active || busy}
                      >
                        <option value="">ยังไม่กำหนด</option>
                        {/* อาจารย์ที่ถูกปิดบัญชีแล้วแต่ยังผูกอยู่ ให้แสดงไว้ด้วย */}
                        {[...advisors, ...users.filter((a) => a.user_id === u.advisor_id && !a.is_active)].map((a) => (
                          <option key={a.user_id} value={a.user_id}>{a.th_name}{a.is_active ? '' : ' (ปิดใช้งาน)'}</option>
                        ))}
                      </select>
                    ) : u.role === 'company' ? (
                      <>
                        <p>{companyName(u.company_id)}</p>
                        <p className="cm-muted">{[u.job_title, formatPhone(u.phone)].filter(Boolean).join(' · ')}</p>
                      </>
                    ) : u.role === 'advisor' ? (
                      <>
                        <p className="cm-muted">ที่ปรึกษาของนักศึกษา {users.filter((s) => s.advisor_id === u.user_id && s.is_active).length} คน</p>
                        <label className="cm-muted">
                          <input type="checkbox" checked={u.is_supervisor} onChange={() => toggleSupervisor(u)} disabled={!u.is_active || busy} /> อาจารย์นิเทศก์
                        </label>
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
          users={users}
          companies={companyResult.data}
          defaultCompanyId={companyId}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
