import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './authContext';
import { ROLES } from '../config/roles';
import { api } from '../services/api';

const STORAGE_KEY = 'coop-auth';
// เพิ่มเลขนี้เมื่อรูปแบบข้อมูลผู้ใช้เปลี่ยน — session เก่าจะถูกทิ้งและต้อง login ใหม่ แทนที่หน้าเว็บจะพังเพราะข้อมูลไม่ครบ
const SESSION_VERSION = 3;

// อ่าน session เดิมเพื่อให้ refresh หน้าแล้วยังไม่หลุด (localStorage อาจใช้ไม่ได้ เช่น private mode)
function loadSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY));
    if (session?.version !== SESSION_VERSION || !session.token || !session.user || !ROLES[session.user.role]) return null;
    return session;
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

  const login = useCallback(async ({ email, password, role, remember = true }) => {
    const result = await api('/auth/login', { method: 'POST', body: { email: email.trim(), password }, anonymous: true });
    if (result.user.role !== role) throw new Error('บทบาทที่เลือกไม่ตรงกับบัญชีนี้');
    const next = { version: SESSION_VERSION, remember, ...result };
    saveSession(next);
    setSession(next);
    return next.user;
  }, []);

  useEffect(() => {
    if (!session?.token) return;
    const controller = new AbortController();
    api('/auth/me', { signal: controller.signal }).then((user) => {
      setSession((prev) => { if (!prev) return prev; const next = { ...prev, user }; saveSession(next); return next; });
    }).catch((error) => {
      if (error.status === 401 || error.status === 403) { saveSession(null); setSession(null); }
    });
    return () => controller.abort();
  }, [session?.token]);

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
