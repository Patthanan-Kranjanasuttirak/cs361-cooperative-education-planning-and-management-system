import { useEffect, useState } from 'react';
import FileInput from '../../components/FileInput';
import { useApi } from '../../hooks/useApi';
import { API_URL, api } from '../../services/api';
import ApiState from '../../components/ApiState';
import { validateCompany } from '../../utils/companyValidation';
import { getImageUrl } from '../../utils/image';
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/manageCompanies.css';
import '../CSS/companyPortal.css';

const MAX_LOGO_MB = 2;
const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_PDF_MB = 4;

const formatDateTime = (iso) =>
  new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const toForm = (c) => ({
  logo: c.logo ?? '',
  name: c.name ?? '',
  description: c.description ?? '',
  province: c.province ?? '',
  location: c.location ?? '',
  allowance: c.allowance ?? '',
  additional_info: c.additional_info ?? '',
  additional_file: c.additional_file ?? '',
  application_start: c.application_start ?? '',
  application_end: c.application_end ?? '',
});

function CompanyProfileForm({ company, onSaved }) {
  const [form, setForm] = useState(() => toForm(company));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmedAt, setConfirmedAt] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoError, setLogoError] = useState('');
  const [uploadedLogo, setUploadedLogo] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfError, setPdfError] = useState('');
  const [uploadedPdf, setUploadedPdf] = useState(null);
  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview); }, [logoPreview]);

  const handleLogo = (event) => {
    const file = event.target.files[0] ?? null;
    setLogoError('');
    if (file && (!LOGO_TYPES.includes(file.type) || file.size === 0 || file.size > MAX_LOGO_MB * 1024 * 1024)) {
      setLogoError('เลือกไฟล์ PNG, JPG, WEBP หรือ SVG ที่ไม่ว่างและขนาดไม่เกิน 2 MB');
      event.target.value = '';
      return;
    }
    setLogoFile(file); setLogoPreview(file ? URL.createObjectURL(file) : null); setUploadedLogo(null);
  };

  const handlePdf = (event) => {
    const file = event.target.files[0] ?? null;
    setPdfError('');
    if (file && (file.type !== 'application/pdf' || file.size === 0 || file.size > MAX_PDF_MB * 1024 * 1024)) {
      setPdfError(`เลือกไฟล์ PDF ที่ไม่ว่างและขนาดไม่เกิน ${MAX_PDF_MB} MB`);
      event.target.value = '';
      return;
    }
    setPdfFile(file); setUploadedPdf(null);
  };

  const change = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined, ...(name.startsWith('application_') && { period: undefined }) }));
  };

  const submit = async (e) => {
    e.preventDefault(); if (saving) return;
    const nextErrors = validateCompany(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    try {
      let logo = form.logo;
      if (logoFile) {
        const upload = uploadedLogo?.file === logoFile ? uploadedLogo : await api('/company/logo', { method:'POST', body:logoFile, headers:{'Content-Type':logoFile.type} });
        setUploadedLogo({ ...upload, file:logoFile });
        logo = upload.url;
      }
      let additional_file = form.additional_file || null;
      if (pdfFile) {
        const upload = uploadedPdf?.file === pdfFile ? uploadedPdf : await api('/company/details-file', { method:'POST', body:pdfFile, headers:{'Content-Type':'application/pdf'} });
        setUploadedPdf({ ...upload, file:pdfFile });
        additional_file = upload.key;
      }
      const result = await api('/company/profile', { method:'PUT', body:{ ...form, logo, additional_file, name:form.name.trim() } });
      onSaved(result); setForm(toForm(result)); setConfirmedAt(new Date().toISOString());
      setLogoFile(null); setLogoPreview(null); setUploadedLogo(null);
      setPdfFile(null); setUploadedPdf(null);
      window.scrollTo({ top:0, behavior:'smooth' });
    } catch (error) { setErrors((previous) => ({ ...previous, submit:error.message })); }
    finally { setSaving(false); }
  };

  const logoSrc = logoPreview ?? (form.logo ? getImageUrl(form.logo) : null);
  const inputClass = (name) => `profile-input${errors[name] ? ' profile-input--error' : ''}`;

  return (
    <section>
      <div className="app-header">
        <h1 className="app-title">ข้อมูลบริษัท</h1>
      </div>

      {confirmedAt ? (
        <div className="app-banner" role="status">บันทึกและยืนยันข้อมูลแล้วเมื่อ {formatDateTime(confirmedAt)}</div>
      ) : (
        <div className="cp-notice">กรุณาตรวจสอบข้อมูลบริษัท แก้ไขส่วนที่ไม่ถูกต้อง แล้วกด "บันทึกและยืนยันข้อมูล"</div>
      )}

      <form className="profile-form" onSubmit={submit} noValidate>
        <fieldset className="profile-section" disabled={saving}>
          <legend className="profile-section-title">ข้อมูลทั่วไป</legend>

          <p className="profile-label">โลโก้</p>
          <div className="cp-logo-row">
            {logoSrc ? <img src={logoSrc} alt="โลโก้บริษัท" className="cp-logo" /> : <span className="cp-logo cp-logo--empty">ไม่มีโลโก้</span>}
            <div className="cp-logo-input">
              <FileInput id="logo" accept={LOGO_TYPES.join(',')} onChange={handleLogo} disabled={saving} error={logoError} fileName={logoFile?.name} />
              {logoError ? <p className="profile-error">{logoError}</p> : <p className="profile-hint">PNG, JPG, WEBP หรือ SVG ขนาดไม่เกิน {MAX_LOGO_MB} MB</p>}
            </div>
          </div>

          <label className="profile-label" htmlFor="cp-name">ชื่อสถานประกอบการ <span className="profile-required">*</span></label>
          <input id="cp-name" name="name" className={inputClass('name')} value={form.name} onChange={change} />
          {errors.name && <p className="profile-error">{errors.name}</p>}

          <label className="profile-label" htmlFor="cp-description">รายละเอียด</label>
          <textarea id="cp-description" name="description" rows={4} className="profile-input cm-textarea" value={form.description} onChange={change} />
        </fieldset>

        <fieldset className="profile-section" disabled={saving}>
          <legend className="profile-section-title">ที่ตั้ง</legend>
          <label className="profile-label" htmlFor="cp-province">จังหวัด</label>
          <input id="cp-province" name="province" className="profile-input cp-half" value={form.province} onChange={change} />
          <label className="profile-label" htmlFor="cp-location">ที่อยู่</label>
          <textarea id="cp-location" name="location" rows={3} className="profile-input cm-textarea" value={form.location} onChange={change} />
        </fieldset>

        <fieldset className="profile-section" disabled={saving}>
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

        <fieldset className="profile-section" disabled={saving}>
          <legend className="profile-section-title">ค่าตอบแทนและรายละเอียดเพิ่มเติม</legend>
          <label className="profile-label" htmlFor="cp-allowance">เบี้ยเลี้ยง</label>
          <input id="cp-allowance" name="allowance" className="profile-input cp-half" maxLength={255} placeholder="เช่น 300 บาท/วัน หรือ ไม่มี" value={form.allowance} onChange={change} />
          <label className="profile-label" htmlFor="cp-additional">รายละเอียดเพิ่มเติม</label>
          <textarea id="cp-additional" name="additional_info" rows={4} className="profile-input cm-textarea" maxLength={20000} placeholder="เช่น สวัสดิการ ที่พัก การเดินทาง เวลาทำงาน" value={form.additional_info} onChange={change} />
          <label className="profile-label" htmlFor="cp-additional-file">ไฟล์รายละเอียดเพิ่มเติม (PDF)</label>
          {form.additional_file && !pdfFile && (
            <p className="profile-hint">
              ไฟล์ปัจจุบัน: <a href={`${API_URL}/companies/${company.company_id}/details-file`} target="_blank" rel="noopener noreferrer">เปิดดู</a>
              {' · '}<button type="button" className="cp-link-btn" onClick={() => setForm((prev) => ({ ...prev, additional_file: '' }))}>ลบไฟล์</button>
            </p>
          )}
          <FileInput id="cp-additional-file" accept="application/pdf" onChange={handlePdf} disabled={saving} error={pdfError} fileName={pdfFile?.name} />
          {pdfError ? <p className="profile-error">{pdfError}</p> : <p className="profile-hint">ไม่บังคับ · PDF ขนาดไม่เกิน {MAX_PDF_MB} MB · ลบไฟล์แล้วกดบันทึกเพื่อยืนยัน</p>}
        </fieldset>

        <div className="profile-actions">
          {errors.submit && <p className="profile-error" role="alert">{errors.submit}</p>}
          <button type="submit" className="profile-submit" disabled={saving}>{saving ? 'กำลังบันทึก…' : 'บันทึกและยืนยันข้อมูล'}</button>
        </div>
      </form>
    </section>
  );
}

export default function CompanyProfile() {
  const { data, setData, loading, error } = useApi('/company/profile', null);
  if (!data) return <section><h1 className="app-title">ข้อมูลบริษัท</h1><ApiState loading={loading} error={error} /></section>;
  return <CompanyProfileForm key={data.company_id} company={data} onSaved={setData} />;
}
