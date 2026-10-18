import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../../hooks/useApi';
import { api } from '../../services/api';
import ApiState from '../../components/ApiState';
import PositionCard from '../../components/PositionCard';
import { formatApplicationPeriod } from '../../utils/applicationPeriod';
import { getImageUrl } from '../../utils/image';
import { validateCompany } from '../../utils/companyValidation';
import { formatPhone } from '../../utils/phone';
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/pendingApplications.css';
import '../CSS/manageCompanies.css';

const PAGE_SIZE = 15;
const EMPTY_FORM = { logo: '', name: '', description: '', province: '', location: '', application_start: '', application_end: '' };

function CompanyDialog({ initial, provinces, onSave, onClose }) {
  const isNew = !initial;
  const [form, setForm] = useState(() => (initial ? { ...EMPTY_FORM, ...pick(initial) } : EMPTY_FORM));
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
    setErrors((prev) => ({ ...prev, [name]: undefined, period: name.startsWith('application_') ? undefined : prev.period }));
  };

  const submit = async (e) => {
    e.preventDefault(); if (saving) return;
    const nextErrors = validateCompany(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    try { await onSave({ ...form, name: form.name.trim(), province: form.province.trim() }); }
    catch (error) { setErrors((previous) => ({ ...previous, submit: error.message })); }
    finally { setSaving(false); }
  };

  const inputClass = (name) => `profile-input${errors[name] ? ' profile-input--error' : ''}`;

  return (
    <div className="cm-overlay" role="dialog" aria-modal="true" aria-labelledby="cm-dialog-title">
      <div className="cm-backdrop" onClick={saving ? undefined : onClose} />
      <form className="cm-dialog" onSubmit={submit} noValidate>
        <div className="cm-dialog-head">
          <h2 id="cm-dialog-title" className="cm-dialog-title">{isNew ? 'เพิ่มสถานประกอบการ' : 'แก้ไขสถานประกอบการ'}</h2>
          <button type="button" className="cm-close" onClick={onClose} disabled={saving} aria-label="ปิด">✕</button>
        </div>

        <div className="cm-dialog-body">
          <fieldset className="profile-section" disabled={saving}>
            <legend className="profile-section-title">ข้อมูลสถานประกอบการ</legend>

            <label className="profile-label" htmlFor="cm-name">ชื่อสถานประกอบการ <span className="profile-required">*</span></label>
            <input id="cm-name" name="name" className={inputClass('name')} value={form.name} onChange={change} autoFocus />
            {errors.name && <p className="profile-error">{errors.name}</p>}

            <label className="profile-label" htmlFor="cm-description">รายละเอียด</label>
            <textarea id="cm-description" name="description" rows={3} className="profile-input cm-textarea" value={form.description} onChange={change} />

            <label className="profile-label" htmlFor="cm-logo">โลโก้ (ชื่อไฟล์หรือ URL)</label>
            <input id="cm-logo" name="logo" className="profile-input" maxLength={255} value={form.logo} onChange={change} />

            <div className="cm-row">
              <div className="cm-col">
                <label className="profile-label" htmlFor="cm-province">จังหวัด</label>
                <input id="cm-province" name="province" list="cm-provinces" className="profile-input" value={form.province} onChange={change} />
                <datalist id="cm-provinces">
                  {provinces.map((p) => <option key={p} value={p} />)}
                </datalist>
              </div>
            </div>

            <label className="profile-label" htmlFor="cm-location">ที่ตั้ง</label>
            <textarea id="cm-location" name="location" rows={2} className="profile-input cm-textarea" value={form.location} onChange={change} />

            <div className="cm-row">
              <div className="cm-col">
                <label className="profile-label" htmlFor="cm-start">วันเปิดรับสมัคร</label>
                <input id="cm-start" type="date" name="application_start" className={`profile-input${errors.period ? ' profile-input--error' : ''}`} value={form.application_start} onChange={change} />
              </div>
              <div className="cm-col">
                <label className="profile-label" htmlFor="cm-end">วันปิดรับสมัคร</label>
                <input id="cm-end" type="date" name="application_end" className={`profile-input${errors.period ? ' profile-input--error' : ''}`} value={form.application_end} onChange={change} />
              </div>
            </div>
            {errors.period && <p className="profile-error">{errors.period}</p>}
          </fieldset>
          {isNew && <p className="profile-hint">บันทึกสถานประกอบการก่อน แล้วกด "ดูข้อมูล" เพื่อเพิ่มผู้ประสานงาน</p>}
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

// ดูข้อมูลบริษัท: ตำแหน่งงาน (อ่านอย่างเดียว — บริษัทเป็นผู้จัดการเอง) และผู้ประสานงาน (จัดการที่หน้าผู้ใช้งาน)
function CompanyInfoDialog({ company, coordinators, coordinatorsLoading, onClose }) {
  const { data: activeTerm, loading: termLoading, error: termError } = useApi('/terms/active', null);
  const { data: allPositions, loading: positionsLoading, error: positionsError } = useApi(`/positions?company_id=${company.id}`);
  const { data: applications, loading: appsLoading, error: appsError } = useApi(activeTerm ? `/staff/applications?term_id=${activeTerm.term_id}` : null);
  // ตำแหน่งของภาคที่ active หรือไม่ผูกภาค — ตรงกับที่ผู้ประสานงานเห็นในหน้า "ตำแหน่งของเรา"
  const positions = allPositions.filter((p) => p.term_id == null || p.term_id === activeTerm?.term_id);
  const loading = termLoading || positionsLoading || appsLoading;
  const error = termError || positionsError || appsError;

  // นับแบบเดียวกับหน้าผู้ประสานงาน: ผู้สมัคร = ใบที่ผ่านการอนุมัติจากอาจารย์แล้ว, ยืนยันสิทธิ์ = confirmed
  const statsOf = (positionId) => {
    const apps = applications.filter((a) => a.position_id === positionId && a.approved_at);
    return { applicants: apps.length, confirmed: apps.filter((a) => a.status === 'confirmed').length };
  };

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="cm-overlay" role="dialog" aria-modal="true" aria-labelledby="cm-info-title">
      <div className="cm-backdrop" onClick={onClose} />
      <div className="cm-dialog">
        <div className="cm-dialog-head">
          <div>
            <h2 id="cm-info-title" className="cm-dialog-title">{company.name}</h2>
            <p className="cm-muted">{company.province || 'ไม่ระบุจังหวัด'} · {formatApplicationPeriod(company)}</p>
          </div>
          <button type="button" className="cm-close" onClick={onClose} aria-label="ปิด">✕</button>
        </div>

        <div className="cm-dialog-body">
          <fieldset className="profile-section">
            <legend className="profile-section-title">ตำแหน่งงาน{activeTerm && ` · ภาคการศึกษา ${activeTerm.code}`}</legend>
            {loading ? (
              <p className="cm-empty">กำลังโหลด...</p>
            ) : error ? (
              <p className="profile-error">{error}</p>
            ) : positions.length === 0 ? (
              <p className="cm-empty">ยังไม่มีตำแหน่งในภาคการศึกษานี้</p>
            ) : (
              <ul className="app-list">
                {positions.map((p) => <PositionCard key={p.id} position={p} stats={statsOf(p.id)} />)}
              </ul>
            )}
          </fieldset>

          <fieldset className="profile-section">
            <legend className="profile-section-title">ผู้ประสานงาน</legend>
            <p className="profile-hint">อีเมลที่ผู้ประสานงานใช้สำหรับเข้าสู่ระบบ</p>

            {coordinatorsLoading ? (
              <p className="cm-empty">กำลังโหลด...</p>
            ) : coordinators.length === 0 ? (
              <p className="cm-empty">ยังไม่มีผู้ประสานงาน</p>
            ) : (
              <ul className="cm-coordinators">
                {coordinators.map((c) => (
                  <li key={c.user_id} className="cm-coordinator">
                    <div className="cm-coordinator-info">
                      <p className="cm-coordinator-name">{c.th_name}{c.job_title && <span className="cm-muted"> · {c.job_title}</span>}</p>
                      <p className="cm-muted">{c.email}{c.phone && ` · ${formatPhone(c.phone)}`}</p>
                    </div>
                    <Link className="app-btn pending-btn-cancel cm-small-btn" to={`/staff/users?company=${company.id}`}>จัดการ</Link>
                  </li>
                ))}
              </ul>
            )}

            <Link className="app-btn app-btn--primary cm-small-btn" to={`/staff/users?company=${company.id}`}>จัดการผู้ประสานงาน</Link>
          </fieldset>
        </div>

        <div className="cm-dialog-foot">
          <button type="button" className="app-btn pending-btn-cancel" onClick={onClose}>ปิด</button>
        </div>
      </div>
    </div>
  );
}

function pick(c) {
  return {
    name: c.name ?? '',
    logo: c.logo ?? '',
    description: c.description ?? '',
    province: c.province ?? '',
    location: c.location ?? '',
    application_start: c.application_start ?? '',
    application_end: c.application_end ?? '',
  };
}

export default function ManageCompanies() {
  const { data: result, reload, loading, error: loadError } = useApi('/companies', { data: [] });
  const { data: users, loading: usersLoading, error: usersError } = useApi('/users');
  const companies = result.data;
  const coordinators = users.filter((u) => u.role === 'company').reduce((groups, user) => {
    (groups[user.company_id] ??= []).push(user);
    return groups;
  }, {});
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  // บริษัทที่กำลังดูข้อมูล (null = ปิด)
  const [viewing, setViewing] = useState(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const edit = async (company) => {
    if (busy) return;
    setBusy(true); setNotice('');
    try {
      const detail = await api(`/staff/companies/${company.id}`);
      setEditing({ ...detail, id: detail.company_id });
    } catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  };

  const provinces = useMemo(
    () => [...new Set(companies.map((c) => c.province).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'th')),
    [companies]
  );

  const keyword = search.trim().toLowerCase();
  const filtered = companies.filter(
    (c) => !keyword || c.name.toLowerCase().includes(keyword) || c.province?.toLowerCase().includes(keyword)
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSave = async (form) => {
    await api(editing === 'new' ? '/companies' : `/companies/${editing.id}`, { method: editing === 'new' ? 'POST' : 'PUT', body: form });
    await reload(); setEditing(null); setNotice(`บันทึก ${form.name} แล้ว`);
  };
  const handleDelete = async (company) => {
    if (busy || !window.confirm(`ลบ ${company.name}?\n\nถ้ามีผู้ประสานงาน ตำแหน่งงาน หรือใบสมัครที่ใช้งานอยู่ ระบบจะไม่ให้ลบ`)) return;
    setBusy(true);
    try { await api(`/companies/${company.id}`, { method: 'DELETE' }); await reload(); setNotice(`ลบ ${company.name} แล้ว`); }
    catch (err) { setNotice(err.message); }
    finally { setBusy(false); }
  };

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">จัดการสถานประกอบการ</h1>
        <button type="button" className="app-btn app-btn--primary" onClick={() => { setEditing('new'); setNotice(''); }} disabled={loading || busy}>
          + เพิ่มสถานประกอบการ
        </button>
      </div>

      <ApiState loading={false} error={usersError} />
      {notice && <div className="app-banner" role="status">{notice}</div>}

      <input
        className="pending-search"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        placeholder={`ค้นหาชื่อหรือจังหวัด (ทั้งหมด ${companies.length} แห่ง)`}
        disabled={loading}
      />

      {loading ? (
        <div className="app-empty"><p>กำลังโหลด...</p></div>
      ) : loadError ? (
        <div className="app-empty"><p className="profile-error">{loadError}</p></div>
      ) : filtered.length === 0 ? (
        <div className="app-empty"><p>ไม่พบสถานประกอบการ</p></div>
      ) : (
        <>
          <div className="cm-table-wrap">
            <table className="cm-table">
              <thead>
                <tr>
                  <th>สถานประกอบการ</th>
                  <th>ช่วงรับสมัคร</th>
                  <th className="cm-num">ตำแหน่ง</th>
                  <th className="cm-num">ผู้ประสานงาน</th>
                  <th aria-label="จัดการ" />
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id}>
                    <td data-label="สถานประกอบการ">
                      <div className="cm-company">
                        {c.logo ? <img src={getImageUrl(c.logo)} alt="" className="cm-logo" /> : <span className="cm-logo cm-logo--empty" />}
                        <div className="cm-company-text">
                          <p className="cm-company-name">{c.name}</p>
                          <p className="cm-muted">{c.province || 'ไม่ระบุจังหวัด'}</p>
                        </div>
                      </div>
                    </td>
                    <td data-label="ช่วงรับสมัคร" className="cm-period">{formatApplicationPeriod(c)}</td>
                    <td data-label="ตำแหน่ง" className="cm-num">{c.positions?.length ?? 0}</td>
                    <td data-label="ผู้ประสานงาน" className="cm-num">
                      {usersLoading || usersError ? '—' : (coordinators[c.id]?.length ?? 0) || <span className="cm-muted" title="ยังไม่มีผู้ประสานงาน">-</span>}
                    </td>
                    <td className="cm-actions">
                      <button type="button" className="app-btn pending-btn-cancel cm-small-btn" onClick={() => { setViewing(c); setNotice(''); }} disabled={busy}>ดูข้อมูล</button>
                      <button type="button" className="app-btn pending-btn-cancel cm-small-btn" onClick={() => edit(c)} disabled={busy}>แก้ไข</button>
                      <button type="button" className="app-btn app-btn--ghost cm-small-btn" onClick={() => handleDelete(c)} disabled={busy}>ลบ</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pageCount > 1 && (
            <div className="cm-pager">
              <button type="button" className="app-btn pending-btn-cancel cm-small-btn" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>ก่อนหน้า</button>
              <span className="cm-muted">หน้า {currentPage} / {pageCount}</span>
              <button type="button" className="app-btn pending-btn-cancel cm-small-btn" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>ถัดไป</button>
            </div>
          )}
        </>
      )}

      {viewing && (
        <CompanyInfoDialog
          company={viewing}
          coordinators={coordinators[viewing.id] ?? []}
          coordinatorsLoading={usersLoading}
          onClose={() => setViewing(null)}
        />
      )}

      {editing && (
        <CompanyDialog
          initial={editing === 'new' ? null : editing}
          provinces={provinces}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
