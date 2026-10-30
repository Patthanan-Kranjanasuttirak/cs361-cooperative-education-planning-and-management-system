import { api, uploadDocument } from '../../services/api';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import FileInput from '../../components/FileInput';
import DocumentLink from '../../components/DocumentLink';
import SaveSuccessDialog from '../../components/SaveSuccessDialog';
import { MIN_GPAX, isGpaxEligible } from '../../config/coopRules';
import { reviewBlockers } from '../../config/studentReview';
import { fetchCompanies } from '../../services/companyApi';
import { formatApplicationPeriod } from '../../utils/applicationPeriod';
import '../CSS/studentProfile.css';
import '../CSS/myApplications.css';
import '../CSS/eligibility.css';
import '../CSS/studentApply.css';

// ตรงกับขนาดสูงสุดที่ backend รับ (POST /documents)
const MAX_RESUME_MB = 4;
const MAX_SUGGESTIONS = 8;

const openPositions = (company) => (company?.positions ?? []).filter((p) => p.is_open !== false);

// useProfileCv = ใช้ CV จากข้อมูลส่วนตัว ไม่ต้องเลือกไฟล์
function validate({ company, positionId, resume, useProfileCv }) {
  const errors = {};
  if (!company) errors.company = 'กรุณาเลือกสถานประกอบการจากรายการ';
  if (!positionId) errors.position = 'กรุณาเลือกตำแหน่ง';
  if (useProfileCv) return errors;
  if (!resume) errors.resume = 'กรุณาอัปโหลดเรซูเม่';
  else if (resume.type !== 'application/pdf') errors.resume = 'รองรับเฉพาะไฟล์ PDF';
  else if (resume.size > MAX_RESUME_MB * 1024 * 1024) errors.resume = `ไฟล์ต้องไม่เกิน ${MAX_RESUME_MB} MB`;
  return errors;
}

export default function Apply() {
  const { user } = useAuth();
  const blockers = reviewBlockers(user);
  const eligible = isGpaxEligible(user.gpax) && blockers.length === 0;
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [query, setQuery] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [company, setCompany] = useState(null);
  const [positionId, setPositionId] = useState('');
  const [resume, setResume] = useState(null);
  // ค่าเริ่มต้นใช้ CV จากข้อมูลส่วนตัว (ถ้ามี)
  const [useProfileCv, setUseProfileCv] = useState(Boolean(user.cv_s3_key));
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadedResume, setUploadedResume] = useState(null);

  // เฉพาะบริษัทที่อยู่ในช่วงเปิดรับสมัคร และมีตำแหน่งที่ยังเปิดรับ (API คืนเฉพาะตำแหน่งของภาคที่ active)
  useEffect(() => {
    const controller = new AbortController();
    fetchCompanies({ status: 'open' }, controller.signal)
      .then((data) => setCompanies(data.filter((c) => openPositions(c).length > 0)))
      .catch((error) => {
        if (error.name !== 'AbortError') setLoadError('โหลดรายชื่อสถานประกอบการไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      })
      .finally(() => {
        // คำขอที่ถูกยกเลิก (ออกจากหน้า หรือ StrictMode รัน effect ซ้ำ) ไม่ต้องปิดสถานะโหลด
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const suggestions = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return companies
      .filter((c) => !keyword || c.name.toLowerCase().includes(keyword) || c.province?.toLowerCase().includes(keyword))
      .slice(0, MAX_SUGGESTIONS);
  }, [companies, query]);

  const positions = openPositions(company);
  const selectedPosition = positions.find((p) => String(p.id) === positionId);

  const clearError = (name) => {
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const handleQueryChange = (e) => {
    setQuery(e.target.value);
    setListOpen(true);
    // พิมพ์แก้หลังเลือกแล้ว = ยกเลิกบริษัทที่เลือกไว้
    if (company) {
      setCompany(null);
      setPositionId('');
    }
    clearError('company');
  };

  const selectCompany = (c) => {
    setCompany(c);
    setQuery(c.name);
    setListOpen(false);
    // ถ้ามีตำแหน่งเดียวเลือกให้เลย
    const open = openPositions(c);
    setPositionId(open.length === 1 ? String(open[0].id) : '');
    clearError('company');
    clearError('position');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!eligible || saving || submitted) return;
    const nextErrors = validate({ company, positionId, resume, useProfileCv });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const body = { position_id: Number(positionId) };
      if (!useProfileCv) {
        const document = uploadedResume?.file === resume ? uploadedResume : await uploadDocument(resume, 'resume');
        setUploadedResume({ ...document, file: resume });
        body.resume_s3_key = document.key;
      }
      await api('/applications', { method: 'POST', body });
      setSubmitted(true);
    } catch (error) { setErrors((prev) => ({ ...prev, submit: error.message })); }
    finally { setSaving(false); }
  };

  return (
    <section>
      <h1 className="profile-title">แบบสมัครสหกิจศึกษา</h1>
      {submitted && <SaveSuccessDialog title="ส่งใบสมัครเรียบร้อยแล้ว" to="/student" nextPageLabel="ใบสมัครของฉัน" />}

      {/* เช็กเกณฑ์ GPAX ก่อนให้กรอก (backend ต้องเช็กซ้ำตอนรับใบสมัคร) */}
      {user.gpax == null ? (
        <div className="apply-gate">
          <p>กรุณากรอกข้อมูลคุณสมบัติสหกิจศึกษาในหน้าข้อมูลส่วนตัว เพื่อสมัครเข้าแผ่นสหกิจศึกษา</p>
          <Link to="/student/profile" className="app-btn app-btn--primary">ไปหน้าข้อมูลส่วนตัว</Link>
        </div>
      ) : !isGpaxEligible(user.gpax) ? (
        <div className="apply-gate apply-gate--blocked">
          <p>
            GPAX ของคุณคือ <strong>{user.gpax.toFixed(2)}</strong> ต่ำกว่าเกณฑ์ขั้นต่ำ {MIN_GPAX.toFixed(2)} จึงไม่ผ่านเกณฑ์สมัครสหกิจศึกษา
          </p>
          <p className="apply-gate-note">หากข้อมูลไม่ถูกต้อง กรุณาแก้ไขในหน้าข้อมูลส่วนตัวหรือติดต่อเจ้าหน้าที่</p>
        </div>
      ) : blockers.length > 0 && (
        <div className="apply-gate">
          <p>ยังไม่สามารถยื่นใบสมัครได้ เนื่องจากต้อง{blockers.join(' และ ')}ก่อน</p>
          <Link to="/student/profile" className="app-btn app-btn--primary">ดูสถานะในหน้าข้อมูลส่วนตัว</Link>
        </div>
      )}

      <form className="profile-form" onSubmit={handleSubmit} noValidate>
        <fieldset className="apply-fieldset-group" disabled={!eligible || saving || submitted}>
          <fieldset className="profile-section">
            <legend className="profile-section-title">เลือกสถานประกอบการและตำแหน่ง</legend>

            <label className="profile-label" htmlFor="company-search">สถานประกอบการ <span className="profile-required">*</span></label>
            <div className="apply-combobox">
              <input
                id="company-search"
                className={`profile-input${errors.company ? ' profile-input--error' : ''}`}
                value={query}
                onChange={handleQueryChange}
                onFocus={() => setListOpen(true)}
                onBlur={() => setListOpen(false)}
                placeholder={loading ? 'กำลังโหลด...' : 'พิมพ์ชื่อบริษัทหรือจังหวัดเพื่อค้นหา'}
                disabled={loading || !!loadError}
                autoComplete="off"
                role="combobox"
                aria-expanded={listOpen}
                aria-controls="company-options"
              />
              {listOpen && !company && (
                <ul id="company-options" className="apply-options" role="listbox">
                  {suggestions.length === 0 ? (
                    <li className="apply-option apply-option--empty">ไม่พบสถานประกอบการที่เปิดรับ</li>
                  ) : (
                    suggestions.map((c) => (
                      // onMouseDown แทน onClick เพื่อให้เลือกได้ก่อน input blur แล้วรายการปิด
                      <li
                        key={c.id}
                        role="option"
                        aria-selected="false"
                        className="apply-option"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectCompany(c);
                        }}
                      >
                        <span className="apply-option-name">{c.name}</span>
                        <span className="apply-option-meta">
                          {c.province} · {openPositions(c).length} ตำแหน่ง
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
            {loadError && <p className="profile-error">{loadError}</p>}
            {errors.company && <p className="profile-error">{errors.company}</p>}
            {company && <p className="profile-hint">ช่วงรับสมัคร: {formatApplicationPeriod(company)}</p>}

            <label className="profile-label" htmlFor="position">ตำแหน่ง <span className="profile-required">*</span></label>
            <select
              id="position"
              className={`profile-input${errors.position ? ' profile-input--error' : ''}`}
              value={positionId}
              onChange={(e) => {
                setPositionId(e.target.value);
                clearError('position');
              }}
              disabled={!company}
            >
              <option value="">{company ? '— เลือกตำแหน่ง —' : 'เลือกสถานประกอบการก่อน'}</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.quota != null ? ` (รับ ${p.quota} คน)` : ''}
                </option>
              ))}
            </select>
            {errors.position && <p className="profile-error">{errors.position}</p>}
            {selectedPosition?.description && <p className="apply-position-desc">{selectedPosition.description}</p>}
          </fieldset>

          <fieldset className="profile-section">
            <legend className="profile-section-title">เอกสารประกอบการสมัคร</legend>

            <p className="profile-label">เรซูเม่ (Resume) หรือ CV <span className="profile-required">*</span></p>
            {user.cv_s3_key && <>
              <label className="elig-declare">
                <input type="radio" name="resume-source" checked={useProfileCv} onChange={() => { setUseProfileCv(true); clearError('resume'); }} />
                <span>ใช้ CV เริ่มต้นที่แนบในข้อมูลส่วนตัว</span>
              </label>
              {useProfileCv && <DocumentLink url={`/documents/${encodeURIComponent(user.cv_s3_key)}`} label="ดู CV จากข้อมูลส่วนตัว" />}
              <label className="elig-declare">
                <input type="radio" name="resume-source" checked={!useProfileCv} onChange={() => setUseProfileCv(false)} />
                <span>อัปโหลดไฟล์อื่นสำหรับบริษัทนี้</span>
              </label>
            </>}
            {!useProfileCv && <>
              <FileInput
                id="resume"
                accept="application/pdf"
                onChange={(e) => {
                  setResume(e.target.files[0] ?? null);
                  clearError('resume');
                }}
                error={errors.resume}
                fileName={resume?.name}
              />
              {errors.resume && <p className="profile-error">{errors.resume}</p>}
              <p className="profile-hint">ไฟล์ PDF ขนาดไม่เกิน {MAX_RESUME_MB} MB</p>
            </>}
          </fieldset>

          <div className="profile-actions">
            {errors.submit && <p className="profile-error" role="alert">{errors.submit}</p>}
            <button type="submit" className="profile-submit" disabled={saving || submitted}>{saving ? 'กำลังส่งใบสมัคร…' : submitted ? 'สมัครแล้ว' : 'สมัคร'}</button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
