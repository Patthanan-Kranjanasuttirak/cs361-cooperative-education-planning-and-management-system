import { useCallback, useMemo, useState } from 'react';
import { AuthContext } from './authContext';
import { ROLES } from '../config/roles';

const STORAGE_KEY = 'coop-auth';
// เพิ่มเลขนี้เมื่อรูปแบบข้อมูลผู้ใช้เปลี่ยน — session เก่าจะถูกทิ้งและต้อง login ใหม่ แทนที่หน้าเว็บจะพังเพราะข้อมูลไม่ครบ
const SESSION_VERSION = 2;

// อ่าน session เดิมเพื่อให้ refresh หน้าแล้วยังไม่หลุด (localStorage อาจใช้ไม่ได้ เช่น private mode)
function loadSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY));
    if (session?.version !== SESSION_VERSION || !session.user || !ROLES[session.user.role]) return null;

    // ปรับ session จำลองเดิมที่เคยเก็บอีเมลเป็นชื่อและใช้อีเมลตัวอย่างตายตัว
    const user = { ...session.user };
    if (user.user_id === 0 && user.username?.includes('@')) {
      if (user.email === 'sample@dome.tu.ac.th') user.email = user.username.trim();
      if (user.th_name === user.username) user.th_name = user.username.split('@')[0];
    }
    return { ...session, user };
  } catch {
    return null;
  }
}

function saveSession(session) {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (session) {
      const storage = session.remember === false ? sessionStorage : localStorage;
      storage.setItem(STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // ไม่มี localStorage ก็ยังใช้งานได้ แค่ refresh แล้วต้อง login ใหม่
  }
}

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession);

  // MOCK: ยังไม่มี backend auth จึงให้เลือกบทบาทเองได้
  // TODO: เปลี่ยนเป็น POST /api/auth/login แล้วเก็บ { user, token } ที่ได้จาก API
  const login = useCallback(async ({ email, role, remember = true }) => {
    const accountEmail = email.trim();
    const next = {
      version: SESSION_VERSION,
      remember,
      // ค่าตัวอย่าง — ของจริงจะมาจาก TU API / ฐานข้อมูล
      user: {
        user_id: 0,
        username: accountEmail,
        role,
        // ชื่อชั่วคราวของบัญชีจำลอง — ใช้ชื่อจริงจาก API เมื่อเชื่อมระบบยืนยันตัวตน
        th_name: accountEmail.split('@')[0],
        en_name: 'Sample User',
        email: accountEmail,
        advisor_name: role === 'student' ? 'อาจารย์ตัวอย่าง' : undefined,
        gpax: null, // นักศึกษากรอกในหน้าข้อมูลส่วนตัว
        curriculum: role === 'student' ? '66' : undefined, // หลักสูตร 61 / 66 — ของจริงมาจาก TU API
        company_id: role === 'company' ? 6 : undefined, // ผู้ประสานงานของธนาคารไทยพาณิชย์ — ของจริงมาจาก company_users
      },
      token: null,
    };
    saveSession(next);
    setSession(next);
    return next.user;
  }, []);

  // อัปเดตข้อมูลผู้ใช้หลังบันทึกสำเร็จ (เช่น GPAX จากหน้าข้อมูลส่วนตัว)
  const updateUser = useCallback((changes) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = { ...prev, user: { ...prev.user, ...changes } };
      saveSession(next);
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    saveSession(null);
    setSession(null);
  }, []);

  const value = useMemo(
    () => ({ user: session?.user ?? null, token: session?.token ?? null, login, logout, updateUser }),
    [session, login, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
