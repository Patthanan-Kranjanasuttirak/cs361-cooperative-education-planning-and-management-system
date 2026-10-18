import { useEffect, useMemo, useState } from 'react';
import { fetchCompanies } from '../../services/companyApi';
import { formatApplicationPeriod } from '../../utils/applicationPeriod';
import { getImageUrl } from '../../utils/image';
import { validateCompany } from '../../utils/companyValidation';
import { formatPhone, isPhone, normalizePhone } from '../../utils/phone';
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/pendingApplications.css';
import '../CSS/manageCompanies.css';

const PAGE_SIZE = 15;
const EMPTY_FORM = { name: '', description: '', province: '', location: '', application_start: '', application_end: '' };

// MOCK: ยังไม่มี API ผู้ประสานงาน — TODO: GET /api/companies/:id/coordinators (users role company + company_users)
const MOCK_COORDINATORS = {
  1: [{ user_id: 201, th_name: 'ผู้ประสานงานตัวอย่าง ซีดีจี', email: 'hr@cdg.example.com', job_title: 'HR Officer', phone: '021234567' }],
  6: [
    { user_id: 202, th_name: 'ผู้ประสานงานตัวอย่าง SCB 1', email: 'intern1@scb.example.com', job_title: 'Talent Acquisition', phone: '0891112233' },
    { user_id: 203, th_name: 'ผู้ประสานงานตัวอย่าง SCB 2', email: 'intern2@scb.example.com', job_title: null, phone: '0892223344' },
  ],
};

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function CompanyDialog({ initial, coordinators: initialCoordinators, provinces, onSave, onClose }) {
  const isNew = !initial;
  const [form, setForm] = useState(() => (initial ? { ...EMPTY_FORM, ...pick(initial) } : EMPTY_FORM));
  const [coordinators, setCoordinators] = useState(initialCoordinators ?? []);
  const [newCoordinator, setNewCoordinator] = useState({ th_name: '', email: '', phone: '', job_title: '' });
  const [errors, setErrors] = useState({});
  const [coordinatorError, setCoordinatorError] = useState('');

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
    setErrors((prev) => ({ ...prev, [name]: undefined, period: name.startsWith('application_') ? undefined : prev.period }));
  };

  const addCoordinator = () => {
    const c = {
      th_name: newCoordinator.th_name.trim(),
      email: newCoordinator.email.trim().toLowerCase(),
      phone: newCoordinator.phone,
      job_title: newCoordinator.job_title.trim() || null,
    };
    if (!c.th_name || !c.email || !c.phone) return setCoordinatorError('กรุณากรอกชื่อ อีเมล และเบอร์โทรศัพท์ของผู้ประสานงาน');
    if (!isEmail(c.email)) return setCoordinatorError('รูปแบบอีเมลไม่ถูกต้อง');
    if (!isPhone(c.phone)) return setCoordinatorError('เบอร์โทรศัพท์ต้องเป็นตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0');
    if (coordinators.some((x) => x.email === c.email)) return setCoordinatorError('อีเมลนี้เป็นผู้ประสานงานของบริษัทนี้อยู่แล้ว');
    setCoordinators((prev) => [...prev, { ...c, user_id: `new-${Date.now()}` }]);
    setNewCoordinator({ th_name: '', email: '', phone: '', job_title: '' });
    setCoordinatorError('');
  };

  const submit = (e) => {
    e.preventDefault();
    const nextErrors = validateCompany(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave({ ...form, name: form.name.trim(), province: form.province.trim() }, coordinators);
  };

  const inputClass = (name) => `profile-input${errors[name] ? ' profile-input--error' : ''}`;

  return (
    <div className="cm-overlay" role="dialog" aria-modal="true" aria-labelledby="cm-dialog-title">
      <div className="cm-backdrop" onClick={onClose} />
      <form className="cm-dialog" onSubmit={submit} noValidate>
        <div className="cm-dialog-head">
          <h2 id="cm-dialog-title" className="cm-dialog-title">{isNew ? 'เพิ่มสถานประกอบการ' : 'แก้ไขสถานประกอบการ'}</h2>
          <button type="button" className="cm-close" onClick={onClose} aria-label="ปิด">✕</button>
        </div>

        <div className="cm-dialog-body">
          <fieldset className="profile-section">
            <legend className="profile-section-title">ข้อมูลสถานประกอบการ</legend>

            <label className="profile-label" htmlFor="cm-name">ชื่อสถานประกอบการ <span className="profile-required">*</span></label>
            <input id="cm-name" name="name" className={inputClass('name')} value={form.name} onChange={change} autoFocus />
            {errors.name && <p className="profile-error">{errors.name}</p>}

            <label className="profile-label" htmlFor="cm-description">รายละเอียด</label>
            <textarea id="cm-description" name="description" rows={3} className="profile-input cm-textarea" value={form.description} onChange={change} />

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

          <fieldset className="profile-section">
            <legend className="profile-section-title">ผู้ประสานงาน</legend>
            <p className="profile-hint">อีเมลที่ผู้ประสานงานใช้สำหรับเข้าสู่ระบบ</p>

            {coordinators.length === 0 ? (
              <p className="cm-empty">ยังไม่มีผู้ประสานงาน</p>
            ) : (
              <ul className="cm-coordinators">
                {coordinators.map((c) => (
                  <li key={c.user_id} className="cm-coordinator">
                    <div className="cm-coordinator-info">
                      <p className="cm-coordinator-name">{c.th_name}{c.job_title && <span className="cm-muted"> · {c.job_title}</span>}</p>
                      <p className="cm-muted">{c.email}{c.phone && ` · ${formatPhone(c.phone)}`}</p>
                    </div>
                    <button
                      type="button"
                      className="app-btn app-btn--ghost cm-small-btn"
                      onClick={() => setCoordinators((prev) => prev.filter((x) => x.user_id !== c.user_id))}
                    >
                      นำออก
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="cm-add-coordinator">
              <input className="profile-input" placeholder="ชื่อ-นามสกุล" value={newCoordinator.th_name}
                onChange={(e) => { setNewCoordinator((p) => ({ ...p, th_name: e.target.value })); setCoordinatorError(''); }} />
              <input className="profile-input" type="email" placeholder="อีเมล" value={newCoordinator.email}
                onChange={(e) => { setNewCoordinator((p) => ({ ...p, email: e.target.value })); setCoordinatorError(''); }} />
              <input className="profile-input" type="tel" inputMode="numeric" placeholder="เบอร์โทรศัพท์" value={newCoordinator.phone}
                onChange={(e) => { setNewCoordinator((p) => ({ ...p, phone: normalizePhone(e.target.value) })); setCoordinatorError(''); }} />
              <input className="profile-input" placeholder="ตำแหน่งงาน (ไม่บังคับ)" value={newCoordinator.job_title}
                onChange={(e) => setNewCoordinator((p) => ({ ...p, job_title: e.target.value }))} />
              <button type="button" className="app-btn app-btn--primary cm-small-btn" onClick={addCoordinator}>เพิ่ม</button>
            </div>
            {coordinatorError && <p className="profile-error">{coordinatorError}</p>}
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

function pick(c) {
  return {
    name: c.name ?? '',
    description: c.description ?? '',
    province: c.province ?? '',
    location: c.location ?? '',
    application_start: c.application_start ?? '',
    application_end: c.application_end ?? '',
  };
}

export default function ManageCompanies() {
  const [companies, setCompanies] = useState([]);
  const [coordinators, setCoordinators] = useState(MOCK_COORDINATORS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  // null = ปิด, 'new' = เพิ่มใหม่, object = แก้ไขบริษัทนั้น
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    fetchCompanies({}, controller.signal)
      .then(setCompanies)
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadError('โหลดรายชื่อสถานประกอบการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      })
      .finally(() => {
        // คำขอที่ถูกยกเลิก (ออกจากหน้า หรือ StrictMode รัน effect ซ้ำ) ไม่ต้องปิดสถานะโหลด
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

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

  const handleSave = (form, nextCoordinators) => {
    if (editing === 'new') {
      // TODO: POST /api/companies แล้วใช้ id ที่ได้จาก backend
      const id = Math.max(0, ...companies.map((c) => c.id)) + 1;
      setCompanies((prev) => [...prev, { id, logo: null, positions: [], ...form }]);
      setCoordinators((prev) => ({ ...prev, [id]: nextCoordinators }));
      setNotice(`เพิ่ม ${form.name} แล้ว`);
      setSearch('');
      setPage(Math.ceil((companies.length + 1) / PAGE_SIZE));
    } else {
      // TODO: PUT /api/companies/:id และ POST/DELETE /api/companies/:id/coordinators
      //   เพิ่มผู้ประสานงาน = สร้าง users (role company) ถ้ายังไม่มี แล้ว insert company_users
      setCompanies((prev) => prev.map((c) => (c.id === editing.id ? { ...c, ...form } : c)));
      setCoordinators((prev) => ({ ...prev, [editing.id]: nextCoordinators }));
      setNotice(`บันทึก ${form.name} แล้ว`);
    }
    setEditing(null);
  };

  const handleDelete = (company) => {
    const ok = window.confirm(
      `ลบ ${company.name}?\n\nตำแหน่งงานของบริษัทนี้จะถูกลบไปด้วย และผู้ประสานงานจะเข้าจัดการบริษัทนี้ไม่ได้อีก\n` +
        'ถ้ามีนักศึกษาสมัครตำแหน่งของบริษัทนี้แล้ว ระบบจะไม่ให้ลบ (ให้ปิดรับสมัครแทน)'
    );
    if (!ok) return;
    // TODO: DELETE /api/companies/:id — backend ตอบ 409 ถ้ามีใบสมัครอยู่ (FK ของ applications → positions)
    setCompanies((prev) => prev.filter((c) => c.id !== company.id));
    setNotice(`ลบ ${company.name} แล้ว`);
  };

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">จัดการสถานประกอบการ</h1>
        <button type="button" className="app-btn app-btn--primary" onClick={() => { setEditing('new'); setNotice(''); }} disabled={loading}>
          + เพิ่มสถานประกอบการ
        </button>
      </div>

      {notice && <div className="app-banner">{notice}</div>}

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
                      {(coordinators[c.id]?.length ?? 0) || <span className="cm-muted" title="ยังไม่มีผู้ประสานงาน">-</span>}
                    </td>
                    <td className="cm-actions">
                      <button type="button" className="app-btn pending-btn-cancel cm-small-btn" onClick={() => { setEditing(c); setNotice(''); }}>แก้ไข</button>
                      <button type="button" className="app-btn app-btn--ghost cm-small-btn" onClick={() => handleDelete(c)}>ลบ</button>
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

      {editing && (
        <CompanyDialog
          initial={editing === 'new' ? null : editing}
          coordinators={editing === 'new' ? [] : coordinators[editing.id]}
          provinces={provinces}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
