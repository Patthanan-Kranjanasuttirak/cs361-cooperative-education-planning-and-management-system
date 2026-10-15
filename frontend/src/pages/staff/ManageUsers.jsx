import { useEffect, useState } from 'react';
import { ROLES } from '../../config/roles';
import { lookupTuUser } from '../../services/tuApi';
import { formatPhone, isPhone, normalizePhone } from '../../utils/phone';
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/pendingApplications.css';
import '../CSS/myStudents.css';
import '../CSS/manageCompanies.css';
import '../CSS/manageUsers.css';
import '../../components/CSS/ApplicationStatusBadge.css';

// MOCK: ยังไม่มี API — TODO: GET /api/users (เฉพาะเจ้าหน้าที่)
//   นักศึกษา อาจารย์ และเจ้าหน้าที่ เข้าสู่ระบบด้วยบัญชี TU (auth_provider = 'tu') จึงไม่มีรหัสผ่านในระบบ
//   ผู้ประสานงานสถานประกอบการไม่มีบัญชี TU ใช้บัญชีของระบบ (auth_provider = 'local') เข้าด้วยอีเมล
//   (username = อีเมล) และต้องตั้งรหัสผ่านเริ่มต้น
const MOCK_CURRENT_USER_ID = 301; // เจ้าหน้าที่ที่ login อยู่ — ปิดบัญชีตัวเองไม่ได้
const MOCK_COMPANIES = [
  { id: 1, name: 'บริษัท ซีดีจี กรุ๊ป จำกัด' },
  { id: 6, name: 'ธนาคารไทยพาณิชย์ จำกัด (มหาชน)' },
  { id: 21, name: 'บริษัทกสิกร บิซิเนส-เทคโนโลยี กรุ๊ป' },
];
const MOCK_USERS = [
  { user_id: 101, username: 'advisor.a', role: 'advisor', th_name: 'อาจารย์ตัวอย่าง ก', en_name: 'Advisor A', email: 'advisor.a@sci.tu.ac.th', is_active: true },
  { user_id: 102, username: 'advisor.b', role: 'advisor', th_name: 'อาจารย์ตัวอย่าง ข', en_name: 'Advisor B', email: 'advisor.b@sci.tu.ac.th', is_active: true },
  { user_id: 1, username: '6609611111', role: 'student', th_name: 'นักศึกษาตัวอย่าง หนึ่ง', en_name: 'Student One', email: '6609611111@dome.tu.ac.th', is_active: true, advisor_id: 101 },
  { user_id: 2, username: '6609622222', role: 'student', th_name: 'นักศึกษาตัวอย่าง สอง', en_name: 'Student Two', email: '6609622222@dome.tu.ac.th', is_active: true, advisor_id: 101 },
  { user_id: 3, username: '6609633333', role: 'student', th_name: 'นักศึกษาตัวอย่าง สาม', en_name: 'Student Three', email: '6609633333@dome.tu.ac.th', is_active: true, advisor_id: 102 },
  { user_id: 6, username: '6609666666', role: 'student', th_name: 'นักศึกษาตัวอย่าง หก', en_name: 'Student Six', email: '6609666666@dome.tu.ac.th', is_active: true, advisor_id: null },
  { user_id: 8, username: '6509688888', role: 'student', th_name: 'นักศึกษาตัวอย่าง แปด', en_name: 'Student Eight', email: '6509688888@dome.tu.ac.th', is_active: false, advisor_id: 102 },
  { user_id: 301, username: 'staff.coop', role: 'staff', th_name: 'เจ้าหน้าที่ตัวอย่าง', en_name: 'Coop Staff', email: 'coop@sci.tu.ac.th', is_active: true },
  { user_id: 201, username: 'hr@cdg.example.com', role: 'company', th_name: 'ผู้ประสานงานตัวอย่าง ซีดีจี', en_name: 'CDG Coordinator', email: 'hr@cdg.example.com', is_active: true, company_id: 1, job_title: 'HR Officer', phone: '021234567' },
  { user_id: 202, username: 'intern1@scb.example.com', role: 'company', th_name: 'ผู้ประสานงานตัวอย่าง SCB 1', en_name: 'SCB Coordinator', email: 'intern1@scb.example.com', is_active: true, company_id: 6, job_title: 'Talent Acquisition', phone: '0891112233' },
];

const ROLE_ORDER = ['student', 'advisor', 'staff', 'company'];
// ชื่อบทบาทแบบสั้นสำหรับตาราง (ชื่อเต็มยาวจนดันตารางล้นกรอบ)
const ROLE_SHORT = { student: 'นักศึกษา', advisor: 'อาจารย์ที่ปรึกษา', staff: 'เจ้าหน้าที่', company: 'ผู้ประสานงาน' };
const ROLE_TONE = { student: 'info', advisor: 'success', staff: 'pending', company: 'muted' };
const MIN_PASSWORD = 8;
// บทบาทที่เข้าสู่ระบบผ่าน TU API (ไม่ต้องตั้งรหัสผ่าน)
const TU_ROLES = ['student', 'advisor', 'staff'];
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// editingId = user_id ที่กำลังแก้ไข (null ถ้าเพิ่มใหม่) — ใช้ยกเว้นตัวเองตอนเช็กอีเมลซ้ำ
function validate(form, tu, users, editingId) {
  const errors = {};
  const emailTaken = (email) => users.some((u) => u.email === email && u.user_id !== editingId);
  if (TU_ROLES.includes(form.role)) {
    // ชื่อและอีเมลมาจาก TU API — ต้องดึงข้อมูลก่อนบันทึก
    if (!tu) errors.username = 'กรุณากด "ดึงข้อมูลจาก TU" ก่อนบันทึก';
    else if (emailTaken(tu.email)) errors.username = `อีเมล ${tu.email} ถูกใช้กับบัญชีอื่นแล้ว`;
    return errors;
  }
  if (!form.th_name.trim()) errors.th_name = 'กรุณากรอกชื่อ-นามสกุล (ภาษาไทย)';
  if (!form.en_name.trim()) errors.en_name = 'กรุณากรอกชื่อ-นามสกุล (ภาษาอังกฤษ)';
  const email = form.email.trim().toLowerCase();
  if (!email) errors.email = 'กรุณากรอกอีเมล';
  else if (!isEmail(email)) errors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
  else if (emailTaken(email)) errors.email = 'อีเมลนี้ถูกใช้แล้ว';
  if (editingId == null && form.password.length < MIN_PASSWORD) errors.password = `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD} ตัวอักษร`;
  if (!form.phone) errors.phone = 'กรุณากรอกเบอร์โทรศัพท์';
  else if (!isPhone(form.phone)) errors.phone = 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 9–10 หลัก ขึ้นต้นด้วย 0';
  if (!form.company_id) errors.company_id = 'กรุณาเลือกสถานประกอบการ';
  return errors;
}

function UserDialog({ initial, users, advisors, onSave, onClose }) {
  const isNew = !initial;
  const [form, setForm] = useState(() => ({
    role: initial?.role ?? 'student',
    username: initial?.username ?? '',
    th_name: initial?.th_name ?? '',
    en_name: initial?.en_name ?? '',
    email: initial?.email ?? '',
    password: '',
    advisor_id: initial?.advisor_id ? String(initial.advisor_id) : '',
    company_id: initial?.company_id ? String(initial.company_id) : '',
    job_title: initial?.job_title ?? '',
    phone: initial?.phone ?? '',
  }));
  const isTu = TU_ROLES.includes(form.role);
  // ข้อมูลจาก TU API (ชื่อ, อีเมล) — แก้ไขบัญชีเดิมใช้ข้อมูลที่มีอยู่ เพิ่มใหม่ต้องกดดึงก่อน
  const [tu, setTu] = useState(() =>
    initial && TU_ROLES.includes(initial.role) ? { th_name: initial.th_name, en_name: initial.en_name, email: initial.email } : null
  );
  const [lookingUp, setLookingUp] = useState(false);
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
    const { name } = e.target;
    let { value } = e.target;
    // รหัสนักศึกษา: เก็บเฉพาะตัวเลข 10 หลัก (กันสระ/ตัวอักษรที่พิมพ์ติดมาตอนคีย์บอร์ดเป็นภาษาไทย หรือช่องว่างตอนวาง)
    if (name === 'username' && form.role === 'student') value = value.replace(/\D/g, '').slice(0, 10);
    // ชื่อผู้ใช้ TU ไม่มีช่องว่าง
    else if (name === 'username') value = value.replace(/\s/g, '');
    else if (name === 'phone') value = normalizePhone(value);
    // เปลี่ยนบทบาท = ล้างรหัสเดิม (รหัสนักศึกษากับชื่อผู้ใช้ TU คนละรูปแบบกัน)
    setForm((prev) => ({ ...prev, [name]: value, ...(name === 'role' && { username: '' }) }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
    // เปลี่ยนบทบาทหรือรหัส = ข้อมูลที่ดึงมาเดิมใช้ไม่ได้แล้ว
    if (name === 'role' || name === 'username') {
      setTu(null);
      setErrors({});
    }
  };

  const fetchFromTu = async () => {
    const username = form.username.trim();
    let error = '';
    if (!username) error = form.role === 'student' ? 'กรุณากรอกรหัสนักศึกษา' : 'กรุณากรอกชื่อผู้ใช้ TU';
    else if (form.role === 'student' && !/^\d{10}$/.test(username)) error = 'รหัสนักศึกษาต้องเป็นตัวเลข 10 หลัก';
    else if (isNew && users.some((u) => u.username === username)) error = 'มีบัญชีนี้ในระบบอยู่แล้ว';
    if (error) {
      setErrors({ username: error });
      return;
    }
    setLookingUp(true);
    setErrors({});
    try {
      setTu(await lookupTuUser(username, form.role));
    } catch (err) {
      setTu(null);
      setErrors({ username: err.status === 404 ? 'ไม่พบผู้ใช้นี้ในระบบของ มธ.' : 'ดึงข้อมูลจาก TU ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' });
    } finally {
      setLookingUp(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const nextErrors = validate(form, tu, users, initial?.user_id ?? null);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    onSave(
      isTu
        ? {
            role: form.role,
            username: form.username.trim(),
            ...tu,
            advisor_id: form.role === 'student' && form.advisor_id ? Number(form.advisor_id) : null,
          }
        : {
            role: form.role,
            username: form.email.trim().toLowerCase(),
            th_name: form.th_name.trim(),
            en_name: form.en_name.trim(),
            email: form.email.trim().toLowerCase(),
            company_id: Number(form.company_id),
            job_title: form.job_title.trim() || null,
            phone: form.phone,
          }
    );
  };

  const field = (name, label, props = {}) => (
    <>
      <label className="profile-label" htmlFor={`user-${name}`}>{label}</label>
      <input id={`user-${name}`} name={name} className={`profile-input${errors[name] ? ' profile-input--error' : ''}`} value={form[name]} onChange={change} {...props} />
      {errors[name] && <p className="profile-error">{errors[name]}</p>}
    </>
  );

  return (
    <div className="cm-overlay" role="dialog" aria-modal="true" aria-labelledby="user-dialog-title">
      <div className="cm-backdrop" onClick={onClose} />
      <form className="cm-dialog" onSubmit={submit} noValidate>
        <div className="cm-dialog-head">
          <h2 id="user-dialog-title" className="cm-dialog-title">{isNew ? 'เพิ่มผู้ใช้งาน' : `แก้ไข ${initial.th_name}`}</h2>
          <button type="button" className="cm-close" onClick={onClose} aria-label="ปิด">✕</button>
        </div>

        <div className="cm-dialog-body">
          <fieldset className="profile-section">
            <legend className="profile-section-title">บัญชีผู้ใช้</legend>

            <label className="profile-label" htmlFor="user-role">บทบาท <span className="profile-required">*</span></label>
            {isNew ? (
              <select id="user-role" name="role" className="profile-input" value={form.role} onChange={change}>
                {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
              </select>
            ) : (
              <p className="profile-readonly-value user-readonly">{ROLES[form.role].label} · {form.username}</p>
            )}

            {isTu && (
              <>
                {isNew && (
                  <>
                    <label className="profile-label" htmlFor="user-username">
                      {form.role === 'student' ? 'รหัสนักศึกษา' : 'ชื่อผู้ใช้ TU'} <span className="profile-required">*</span>
                    </label>
                    <div className="user-lookup">
                      <input
                        id="user-username"
                        name="username"
                        className={`profile-input${errors.username ? ' profile-input--error' : ''}`}
                        value={form.username}
                        onChange={change}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            fetchFromTu();
                          }
                        }}
                        placeholder={form.role === 'student' ? 'เช่น 6609611111' : 'ชื่อผู้ใช้ที่ใช้เข้าระบบของ มธ.'}
                        inputMode={form.role === 'student' ? 'numeric' : undefined}
                        autoComplete="off"
                      />
                      <button type="button" className="app-btn app-btn--primary cm-small-btn user-lookup-btn" onClick={fetchFromTu} disabled={lookingUp}>
                        {lookingUp ? 'กำลังดึง...' : 'ดึงข้อมูลจาก TU'}
                      </button>
                    </div>
                  </>
                )}
                {!isNew && (
                  <button type="button" className="app-btn pending-btn-cancel cm-small-btn user-refresh-btn" onClick={fetchFromTu} disabled={lookingUp}>
                    {lookingUp ? 'กำลังดึง...' : 'ดึงข้อมูลล่าสุดจาก TU'}
                  </button>
                )}
                {errors.username && <p className="profile-error">{errors.username}</p>}
              </>
            )}

            {!isTu && isNew &&
              field('password', <>รหัสผ่านเริ่มต้น <span className="profile-required">*</span></>, {
                type: 'password',
                autoComplete: 'new-password',
                placeholder: `อย่างน้อย ${MIN_PASSWORD} ตัวอักษร`,
              })}
          </fieldset>

          <fieldset className="profile-section">
            <legend className="profile-section-title">ข้อมูลผู้ใช้</legend>

            {isTu ? (
              // ยังไม่ได้ดึงข้อมูล = แสดงช่องว่างไว้ก่อน
              <dl className="profile-readonly">
                {[
                  ['ชื่อ-นามสกุล (ภาษาไทย)', tu?.th_name],
                  ['ชื่อ-นามสกุล (ภาษาอังกฤษ)', tu?.en_name],
                  ['อีเมล', tu?.email],
                ].map(([label, value]) => (
                  <div key={label} className="profile-readonly-row">
                    <dt className="profile-label">{label}</dt>
                    <dd className={`profile-readonly-value${value ? '' : ' user-readonly-empty'}`}>{value || '—'}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <>
                <div className="cm-row">
                  <div className="cm-col">{field('th_name', <>ชื่อ-นามสกุล (ภาษาไทย) <span className="profile-required">*</span></>)}</div>
                  <div className="cm-col">{field('en_name', <>ชื่อ-นามสกุล (ภาษาอังกฤษ) <span className="profile-required">*</span></>)}</div>
                </div>
                {field('email', <>อีเมล (ใช้เข้าสู่ระบบ) <span className="profile-required">*</span></>, { type: 'email' })}
                <div className="cm-row">
                  <div className="cm-col">
                    <label className="profile-label" htmlFor="user-company_id">สถานประกอบการ <span className="profile-required">*</span></label>
                    <select id="user-company_id" name="company_id" className={`profile-input${errors.company_id ? ' profile-input--error' : ''}`} value={form.company_id} onChange={change}>
                      <option value="">เลือกสถานประกอบการ</option>
                      {MOCK_COMPANIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    {errors.company_id && <p className="profile-error">{errors.company_id}</p>}
                  </div>
                  <div className="cm-col">{field('job_title', 'ตำแหน่งงาน')}</div>
                </div>
                <div className="cm-row">
                  <div className="cm-col">
                    {field('phone', <>เบอร์โทรศัพท์ <span className="profile-required">*</span></>, {
                      type: 'tel',
                      inputMode: 'numeric',
                      placeholder: 'เช่น 0812345678 หรือ 021234567',
                    })}
                  </div>
                </div>
              </>
            )}

            {form.role === 'student' && (
              <>
                <label className="profile-label" htmlFor="user-advisor_id">อาจารย์ที่ปรึกษา</label>
                <select id="user-advisor_id" name="advisor_id" className="profile-input" value={form.advisor_id} onChange={change}>
                  <option value="">ยังไม่กำหนด</option>
                  {advisors.map((a) => <option key={a.user_id} value={a.user_id}>{a.th_name}</option>)}
                </select>
              </>
            )}
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

export default function ManageUsers() {
  const [users, setUsers] = useState(MOCK_USERS);
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  // null = ปิด, 'new' = เพิ่มใหม่, object = แก้ไขผู้ใช้นั้น
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');

  const advisors = users.filter((u) => u.role === 'advisor' && u.is_active);
  const nameOf = (id) => users.find((u) => u.user_id === id)?.th_name;
  const companyName = (id) => MOCK_COMPANIES.find((c) => c.id === id)?.name ?? '-';

  const filters = [
    { key: 'all', label: 'ทั้งหมด', match: () => true },
    ...ROLE_ORDER.map((r) => ({ key: r, label: ROLES[r].label, match: (u) => u.role === r })),
    { key: 'no-advisor', label: 'ยังไม่มีอาจารย์ที่ปรึกษา', match: (u) => u.role === 'student' && !u.advisor_id && u.is_active },
    { key: 'inactive', label: 'ปิดใช้งาน', match: (u) => !u.is_active },
  ];
  const activeFilter = filters.find((f) => f.key === roleFilter);
  const keyword = search.trim().toLowerCase();
  const visible = users
    .filter((u) => activeFilter.match(u))
    .filter((u) => !keyword || [u.th_name, u.en_name, u.username, u.email].some((v) => v?.toLowerCase().includes(keyword)))
    .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.username.localeCompare(b.username));

  const handleSave = (data) => {
    if (editing === 'new') {
      // TODO: POST /api/users — backend hash รหัสผ่าน (bcrypt) และสร้าง students / company_users ตามบทบาท
      const user_id = Math.max(0, ...users.map((u) => u.user_id)) + 1;
      setUsers((prev) => [...prev, { user_id, is_active: true, ...data }]);
      setNotice(`เพิ่มผู้ใช้ ${data.th_name} (${ROLES[data.role].label}) แล้ว`);
    } else {
      // TODO: PUT /api/users/:id
      setUsers((prev) => prev.map((u) => (u.user_id === editing.user_id ? { ...u, ...data } : u)));
      setNotice(`บันทึกข้อมูล ${data.th_name} แล้ว`);
    }
    setEditing(null);
  };

  const assignAdvisor = (student, advisorId) => {
    // TODO: PUT /api/students/:id/advisor { advisor_id }
    setUsers((prev) => prev.map((u) => (u.user_id === student.user_id ? { ...u, advisor_id: advisorId ? Number(advisorId) : null } : u)));
    setNotice(advisorId ? `กำหนดอาจารย์ที่ปรึกษาของ ${student.th_name} เป็น ${nameOf(Number(advisorId))} แล้ว` : `ยกเลิกอาจารย์ที่ปรึกษาของ ${student.th_name} แล้ว`);
  };

  const toggleActive = (user) => {
    if (user.is_active) {
      const advisees = user.role === 'advisor' ? users.filter((u) => u.advisor_id === user.user_id && u.is_active).length : 0;
      const ok = window.confirm(
        `ปิดการใช้งานบัญชี ${user.th_name}?\n\nผู้ใช้นี้จะเข้าสู่ระบบไม่ได้ แต่ข้อมูลเดิมยังอยู่ เปิดใช้งานใหม่ได้ภายหลัง` +
          (advisees > 0 ? `\n\nอาจารย์ท่านนี้ดูแลนักศึกษาอยู่ ${advisees} คน ควรกำหนดอาจารย์ที่ปรึกษาใหม่ให้นักศึกษาเหล่านี้` : '')
      );
      if (!ok) return;
    }
    // TODO: PATCH /api/users/:id { is_active } — backend ต้องไม่ให้ปิดบัญชีตัวเอง
    setUsers((prev) => prev.map((u) => (u.user_id === user.user_id ? { ...u, is_active: !u.is_active } : u)));
    setNotice(`${user.is_active ? 'ปิด' : 'เปิด'}การใช้งานบัญชี ${user.th_name} แล้ว`);
  };

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">จัดการผู้ใช้งาน</h1>
        <button type="button" className="app-btn app-btn--primary" onClick={() => { setEditing('new'); setNotice(''); }}>
          + เพิ่มผู้ใช้งาน
        </button>
      </div>

      {notice && <div className="app-banner">{notice}</div>}

      <div className="students-filters" role="tablist">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={roleFilter === f.key}
            className={`students-filter${roleFilter === f.key ? ' students-filter--active' : ''}`}
            onClick={() => setRoleFilter(f.key)}
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
                <th>อาจารย์ที่ปรึกษา</th>
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
                  <td data-label={u.role === 'student' ? 'อาจารย์ที่ปรึกษา' : u.role === 'company' ? 'สถานประกอบการ' : ''}>
                    {u.role === 'student' ? (
                      <select
                        className={`profile-input user-advisor-select${u.advisor_id ? '' : ' user-advisor-select--empty'}`}
                        aria-label={`อาจารย์ที่ปรึกษาของ ${u.th_name}`}
                        value={u.advisor_id ?? ''}
                        onChange={(e) => assignAdvisor(u, e.target.value)}
                        disabled={!u.is_active}
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
                      <p className="cm-muted">ดูแลนักศึกษา {users.filter((s) => s.advisor_id === u.user_id && s.is_active).length} คน</p>
                    ) : (
                      <p className="cm-muted">-</p>
                    )}
                  </td>
                  <td className="cm-actions">
                    <button type="button" className="app-btn pending-btn-cancel cm-small-btn" onClick={() => { setEditing(u); setNotice(''); }}>แก้ไข</button>
                    {u.user_id === MOCK_CURRENT_USER_ID ? (
                      <span className="cm-muted user-toggle user-self">บัญชีของคุณ</span>
                    ) : (
                      <button
                        type="button"
                        className={`app-btn cm-small-btn user-toggle ${u.is_active ? 'app-btn--ghost' : 'app-btn--primary'}`}
                        onClick={() => toggleActive(u)}
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
        <UserDialog
          initial={editing === 'new' ? null : editing}
          users={users}
          advisors={advisors}
          onSave={handleSave}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
