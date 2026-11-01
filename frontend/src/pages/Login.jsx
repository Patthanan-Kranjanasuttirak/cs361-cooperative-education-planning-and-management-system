import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { ROLES } from '../config/roles';
import { cognitoEnabled } from '../services/cognito';
import campusPhoto from '../assets/login-campus.png';
import whiteLogo from '../assets/W-CSTU-LOGO.png';
import googleLogo from '../assets/google-g.svg';
import showPasswordIcon from '../assets/login-show-password.png';
import './CSS/login.css';

const LOGIN_ROLES = [
  { value: 'student', label: 'นักศึกษา (Student)' },
  { value: 'committee', label: 'กรรมการสหกิจศึกษา (Committee)' },
  { value: 'staff', label: 'เจ้าหน้าที่ (Staff)' },
  { value: 'company', label: 'ผู้ประสานงานสถานประกอบการ (Company Coordinator)' },
];

export default function Login() {
  const { user, login, loginWithGoogle, authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  if (user) return <Navigate to={ROLES[user.role].home} replace />;

  // นักศึกษาใช้บัญชี TU, บทบาทอื่นใช้อีเมลบัญชี mock ไปก่อน, ผู้ประสานงานเข้าด้วย Google ได้อีกทาง (Cognito)
  const tuLogin = role === 'student';

  const handleGoogle = async () => {
    if (!cognitoEnabled) {
      setNotice('การเข้าสู่ระบบด้วย Google ยังไม่เปิดให้ใช้งานในระบบทดสอบ');
      return;
    }
    setSubmitting(true);
    setNotice('');
    try {
      await loginWithGoogle({ remember });
    } catch (error) {
      setNotice(error.message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองอีกครั้ง');
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (!LOGIN_ROLES.some((item) => item.value === role)) {
      setNotice('กรุณาเลือกบทบาทที่เปิดให้ใช้งาน');
      return;
    }
    setSubmitting(true);
    setNotice('');
    try {
      const loggedIn = await login({ email: email.trim(), password, role, remember });
      const home = ROLES[loggedIn.role].home;
      const from = location.state?.from;
      const destination = from === home || from?.startsWith(`${home}/`) ? from : home;
      navigate(destination, { replace: true });
    } catch (error) {
      setNotice(error.message || 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองอีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="login-page">
      <Link to="/" className="login-back-link">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m10 6-6 6 6 6M4 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        กลับหน้าแรก
      </Link>
      <aside className="login-brand" aria-label="ระบบจัดการแผนสหกิจศึกษา">
        <img className="login-brand-photo" src={campusPhoto} alt="" />
        <div className="login-brand-content">
          <Link className="login-brand-link" to="/" aria-label="กลับหน้าแรก">
            <img className="login-brand-logo" src={whiteLogo} alt="Computer Science, Thammasat University" />
          </Link>
          <div className="login-brand-heading">
            <h2>ระบบจัดการแผนสหกิจศึกษา</h2>
            <p>Cooperative Education Planning &amp; Management System</p>
          </div>
        </div>
      </aside>
      <section className="login-form-panel" aria-labelledby="login-title">
        <div className="login-form-content">
          <header className="login-heading">
            <h1 id="login-title">เข้าสู่ระบบ</h1>
            <p>{role === 'company'
              ? 'สำหรับผู้ประสานงานสถานประกอบการ ใช้อีเมลทั่วไปหรือ Google'
              : tuLogin ? 'สำหรับนักศึกษา ใช้บัญชีมหาวิทยาลัย (TU)' : 'สำหรับกรรมการและเจ้าหน้าที่'}</p>
          </header>
          <form className="login-form" onSubmit={handleSubmit}>
            <div className="login-role-field">
              <label className="login-label" htmlFor="login-role">เข้าสู่ระบบในบทบาท</label>
              <div className="login-select-wrapper">
                <select id="login-role" value={role} onChange={(e) => { setRole(e.target.value); setNotice(''); }}>
                  {LOGIN_ROLES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <svg className="login-select-chevron" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
                  <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <div className="login-credentials">
              <div className="login-field">
                <label className="login-label" htmlFor="login-email">{role === 'student' ? 'ชื่อผู้ใช้ TU' : 'อีเมล'}</label>
                {/* นักศึกษาตรวจกับ TU API ด้วยรหัสนักศึกษา; กรรมการ/เจ้าหน้าที่/ผู้ประสานงานใช้บัญชี mock ไปก่อน */}
                <input id="login-email" className="login-input" type={role === 'student' ? 'text' : 'email'} autoComplete="username"
                  placeholder={role === 'student' ? 'รหัสนักศึกษา เช่น 6609611234' : role === 'company' ? 'name@company.com' : 'name@tu.ac.th'} required value={email}
                  onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="login-field">
                <label className="login-label" htmlFor="login-password">รหัสผ่าน</label>
                <div className="login-password-wrapper">
                  <input id="login-password" className="login-input" type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password" placeholder="**********" required value={password}
                    onChange={(e) => setPassword(e.target.value)} />
                  <button className="login-password-toggle" type="button" aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                    aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>
                    <img src={showPasswordIcon} width="29" height="29" alt="" />
                  </button>
                </div>
              </div>
            </div>
            <label className="login-remember" htmlFor="login-remember">
              <input id="login-remember" type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              <span>จดจำการเข้าสู่ระบบ</span>
            </label>
            <div className="login-actions">
              <button className="login-submit" type="submit" disabled={submitting}>
                {submitting ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ'}
              </button>
              <button className="login-forgot" type="button" onClick={() => setNotice(tuLogin
                ? 'ใช้รหัสผ่านเดียวกับบัญชีมหาวิทยาลัย (TU) หากลืมรหัสผ่านให้ดำเนินการผ่านช่องทางของมหาวิทยาลัย หรือติดต่อสาขาวิชาวิทยาการคอมพิวเตอร์ที่ scitu_cs@sci.tu.ac.th'
                : 'กรุณาติดต่อผู้ดูแลบัญชีของคุณ หรือสาขาวิชาวิทยาการคอมพิวเตอร์ที่ scitu_cs@sci.tu.ac.th เพื่อขอความช่วยเหลือเรื่องรหัสผ่าน')}>ลืมรหัสผ่าน?</button>
            </div>
          </form>
          {role === 'company' && (
            <>
              <div className="login-divider"><span>หรือ</span></div>
              <button className="login-tu-button" type="button" onClick={handleGoogle} disabled={submitting}>
                <img src={googleLogo} width="35" height="35" alt="" />
                <span>เข้าสู่ระบบด้วย Google</span>
              </button>
            </>
          )}
          {!cognitoEnabled && <p className="login-demo-note">ระบบพัฒนา: นักศึกษาใช้รหัสนักศึกษาและรหัสผ่าน TU บทบาทอื่นใช้อีเมลบัญชีทดสอบที่ทีมจัดเตรียมไว้</p>}
          {(notice || authError) && <p className="login-notice" role="status">{notice || authError}</p>}
        </div>
      </section>
    </main>
  );
}
