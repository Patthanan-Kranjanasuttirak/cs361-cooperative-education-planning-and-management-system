import { useCallback, useMemo, useState } from 'react';
import { AuthContext } from './authContext';
import { ROLES } from '../config/roles';

const STORAGE_KEY = 'coop-auth';
// เพิ่มเลขนี้เมื่อรูปแบบข้อมูลผู้ใช้เปลี่ยน — session เก่าจะถูกทิ้งและต้อง login ใหม่ แทนที่หน้าเว็บจะพังเพราะข้อมูลไม่ครบ
const SESSION_VERSION = 2;

// อ่าน session เดิมเพื่อให้ refresh หน้าแล้วยังไม่หลุด (localStorage อาจใช้ไม่ได้ เช่น private mode)
function loadSession() {
  try {
    const session = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return session?.version === SESSION_VERSION && session.user && ROLES[session.user.role] ? session : null;
  } catch {
    return null;
  }
}

function saveSession(session) {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ไม่มี localStorage ก็ยังใช้งานได้ แค่ refresh แล้วต้อง login ใหม่
  }
}

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession);

  // MOCK: ยังไม่มี backend auth จึงให้เลือกบทบาทเองได้
  // TODO: เปลี่ยนเป็น POST /api/auth/login แล้วเก็บ { user, token } ที่ได้จาก API
  const login = useCallback(async ({ username, role }) => {
    const next = {
      version: SESSION_VERSION,
      // ค่าตัวอย่าง — ของจริงจะมาจาก TU API / ฐานข้อมูล
      user: {
        user_id: 0,
        username,
        role,
        th_name: username,
        en_name: 'Sample User',
        email: 'sample@dome.tu.ac.th',
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
