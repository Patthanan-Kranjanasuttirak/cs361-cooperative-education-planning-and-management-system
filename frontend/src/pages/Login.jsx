import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/useAuth';
import { ROLES } from '../config/roles';
import './CSS/login.css';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [role, setRole] = useState('student');

  if (user) {
    return <Navigate to={ROLES[user.role].home} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const loggedIn = await login({ username: username.trim() || ROLES[role].label, role });
    // กลับไปหน้าที่ตั้งใจจะเข้าก่อนถูกส่งมา login ถ้าเป็นหน้าของบทบาทนี้ ไม่อย่างนั้นไปหน้าแรกของบทบาท
    const home = ROLES[loggedIn.role].home;
    const from = location.state?.from;
    navigate(from?.startsWith(home) ? from : home, { replace: true });
  };

  return (
    <div className="login-page-container">
      <Navbar />
      <form className="login-card" onSubmit={handleSubmit}>
        <h1 className="login-title">เข้าสู่ระบบ</h1>
        <p className="login-mock-note">โหมดทดสอบ: ยังไม่ตรวจรหัสผ่าน เลือกบทบาทที่ต้องการดูหน้าได้เลย</p>

        <label className="login-label" htmlFor="login-username">ชื่อผู้ใช้</label>
        <input
          id="login-username"
          className="login-input"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="เช่น 6609611111"
          autoComplete="username"
        />

        {/* MOCK: เมื่อมี /api/auth/login ให้เปลี่ยนช่องนี้เป็นรหัสผ่าน บทบาทจะมาจาก backend */}
        <label className="login-label" htmlFor="login-role">บทบาท</label>
        <select id="login-role" className="login-input" value={role} onChange={(e) => setRole(e.target.value)}>
          {Object.entries(ROLES).map(([key, r]) => (
            <option key={key} value={key}>{r.label}</option>
          ))}
        </select>

        <button type="submit" className="login-submit">เข้าสู่ระบบ</button>
      </form>
      <Footer />
    </div>
  );
}
