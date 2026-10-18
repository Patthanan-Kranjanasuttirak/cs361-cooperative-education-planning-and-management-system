import { useEffect, useState } from 'react';
import FileInput from '../../components/FileInput';
import { useAuth } from '../../context/useAuth';
import { fetchCompany } from '../../services/companyApi';
import { validateCompany } from '../../utils/companyValidation';
import { getImageUrl } from '../../utils/image';
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/manageCompanies.css';
import '../CSS/companyPortal.css';

const MAX_LOGO_MB = 2;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const toForm = (c) => ({
  name: c.name ?? '',
  description: c.description ?? '',
  province: c.province ?? '',
  location: c.location ?? '',
  application_start: c.application_start ?? '',
  application_end: c.application_end ?? '',
});

export default function CompanyProfile() {
  const { user } = useAuth();
  const [company, setCompany] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [errors, setErrors] = useState({});
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoError, setLogoError] = useState('');
  // MOCK: TODO เก็บเวลายืนยันล่าสุดในฐานข้อมูล (เช่น companies.confirmed_at, confirmed_by)
  const [confirmedAt, setConfirmedAt] = useState(null);

  useEffect(() => {
    // ผู้ประสานงานที่ยังไม่ถูกผูกกับบริษัท (company_users) — ไม่ต้องเรียก API
    if (!user.company_id) {
      setLoadError('บัญชีนี้ยังไม่ได้ผูกกับสถานประกอบการ กรุณาติดต่อเจ้าหน้าที่');
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    fetchCompany(user.company_id, controller.signal)
      .then((c) => {
        if (!c) {
          setLoadError('ไม่พบข้อมูลบริษัทของคุณ กรุณาติดต่อเจ้าหน้าที่');
          return;
        }
        setCompany(c);
        setForm(toForm(c));
      })
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadError('โหลดข้อมูลบริษัทไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      })
      .finally(() => {
        // คำขอที่ถูกยกเลิก (ออกจากหน้า หรือ StrictMode รัน effect ซ้ำ) ไม่ต้องปิดสถานะโหลด
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [user.company_id]);

  // คืน URL ของรูปตัวอย่างเมื่อเปลี่ยนรูปหรือออกจากหน้า
  useEffect(() => () => logoPreview && URL.revokeObjectURL(logoPreview), [logoPreview]);

  if (loading || (!company && !loadError)) return <div className="app-empty"><p>กำลังโหลด...</p></div>;
  if (loadError) return <div className="app-empty"><p className="profile-error">{loadError}</p></div>;

  const change = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined, ...(name.startsWith('application_') && { period: undefined }) }));
  };

  const handleLogo = (e) => {
    const file = e.target.files[0] ?? null;
    setLogoError('');
    if (file && !LOGO_TYPES.includes(file.type)) {
      setLogoError('รองรับเฉพาะไฟล์ PNG, JPG, WEBP หรือ SVG');
      e.target.value = '';
      return;
    }
    if (file && file.size > MAX_LOGO_MB * 1024 * 1024) {
      setLogoError(`ไฟล์ต้องไม่เกิน ${MAX_LOGO_MB} MB`);
      e.target.value = '';
      return;
    }
    setLogoFile(file);
    setLogoPreview(file ? URL.createObjectURL(file) : null);
  };

  const submit = (e) => {
    e.preventDefault();
    const nextErrors = validateCompany(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    // TODO: PUT /api/company/profile — backend ใช้ company_id จาก company_users ของคนที่ login (ไม่รับจาก client)
    //   โลโก้: ขอ presigned URL แล้วอัปโหลดไป S3 จากนั้นบันทึก companies.logo
    setCompany((prev) => ({ ...prev, ...form }));
    setConfirmedAt(new Date().toISOString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const logoSrc = logoPreview ?? (company.logo ? getImageUrl(company.logo) : null);
  const inputClass = (name) => `profile-input${errors[name] ? ' profile-input--error' : ''}`;

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">ข้อมูลบริษัท</h1>
      </div>

      {confirmedAt ? (
        <div className="app-banner">บันทึกและยืนยันข้อมูลแล้วเมื่อ {formatDateTime(confirmedAt)}</div>
      ) : (
        <div className="cp-notice">กรุณาตรวจสอบข้อมูลบริษัท แก้ไขส่วนที่ไม่ถูกต้อง แล้วกด "บันทึกและยืนยันข้อมูล"</div>
      )}

      <form className="profile-form" onSubmit={submit} noValidate>
        <fieldset className="profile-section">
          <legend className="profile-section-title">ข้อมูลทั่วไป</legend>

          <p className="profile-label">โลโก้</p>
          <div className="cp-logo-row">
            {logoSrc ? <img src={logoSrc} alt="โลโก้บริษัท" className="cp-logo" /> : <span className="cp-logo cp-logo--empty">ไม่มีโลโก้</span>}
            <div className="cp-logo-input">
              <FileInput id="logo" accept={LOGO_TYPES.join(',')} onChange={handleLogo} error={logoError} fileName={logoFile?.name} />
              {logoError ? <p className="profile-error">{logoError}</p> : <p className="profile-hint">PNG, JPG, WEBP หรือ SVG ขนาดไม่เกิน {MAX_LOGO_MB} MB</p>}
            </div>
          </div>

          <label className="profile-label" htmlFor="cp-name">ชื่อสถานประกอบการ <span className="profile-required">*</span></label>
          <input id="cp-name" name="name" className={inputClass('name')} value={form.name} onChange={change} />
          {errors.name && <p className="profile-error">{errors.name}</p>}

          <label className="profile-label" htmlFor="cp-description">รายละเอียด</label>
          <textarea id="cp-description" name="description" rows={4} className="profile-input cm-textarea" value={form.description} onChange={change} />
        </fieldset>

        <fieldset className="profile-section">
          <legend className="profile-section-title">ที่ตั้ง</legend>
          <label className="profile-label" htmlFor="cp-province">จังหวัด</label>
          <input id="cp-province" name="province" className="profile-input cp-half" value={form.province} onChange={change} />
          <label className="profile-label" htmlFor="cp-location">ที่อยู่</label>
          <textarea id="cp-location" name="location" rows={3} className="profile-input cm-textarea" value={form.location} onChange={change} />
        </fieldset>

        <fieldset className="profile-section">
          <legend className="profile-section-title">ช่วงเวลารับสมัคร</legend>
          <div className="cm-row">
            <div className="cm-col">
              <label className="profile-label" htmlFor="cp-start">วันเปิดรับสมัคร</label>
              <input id="cp-start" type="date" name="application_start" className={inputClass('period')} value={form.application_start} onChange={change} />
            </div>
            <div className="cm-col">
              <label className="profile-label" htmlFor="cp-end">วันปิดรับสมัคร</label>
              <input id="cp-end" type="date" name="application_end" className={inputClass('period')} value={form.application_end} onChange={change} />
            </div>
          </div>
          {errors.period && <p className="profile-error">{errors.period}</p>}
        </fieldset>

        <div className="profile-actions">
          <button type="submit" className="profile-submit">บันทึกและยืนยันข้อมูล</button>
        </div>
      </form>
    </section>
  );
}
