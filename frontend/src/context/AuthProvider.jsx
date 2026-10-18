import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthContext } from './authContext';
import { ROLES } from '../config/roles';
import { api } from '../services/api';
import { cognitoEnabled, onGoogleRedirect, signInWithGoogle, signInWithTu, signOutCognito } from '../services/cognito';

const STORAGE_KEY = 'coop-auth';
// ข้อความผิดพลาดที่ต้องอยู่รอดหลัง redirect (เช่น Google login แล้วไม่มีสิทธิ์ → signOut พาออกไป Hosted UI แล้วกลับมา)
const ERROR_KEY = 'coop-auth-error';
// เพิ่มเลขนี้เมื่อรูปแบบข้อมูลผู้ใช้เปลี่ยน — session เก่าจะถูกทิ้งและต้อง login ใหม่ แทนที่หน้าเว็บจะพังเพราะข้อมูลไม่ครบ
const SESSION_VERSION = 3;
const NOT_REGISTERED = 'บัญชีนี้ยังไม่ได้ลงทะเบียนในระบบ หรือถูกปิดใช้งาน กรุณาติดต่อเจ้าหน้าที่';

// อ่าน session เดิมเพื่อให้ refresh หน้าแล้วยังไม่หลุด (localStorage อาจใช้ไม่ได้ เช่น private mode)
// Cognito: token อยู่กับ Amplify จึงเก็บแค่ข้อมูลผู้ใช้
function loadSession() {
  try {
    const session = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(STORAGE_KEY));
    if (session?.version !== SESSION_VERSION || (!cognitoEnabled && !session.token) || !session.user || !ROLES[session.user.role]) return null;
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

function takeSavedError() {
  try {
    const message = sessionStorage.getItem(ERROR_KEY) ?? '';
    sessionStorage.removeItem(ERROR_KEY);
    return message;
  } catch {
    return '';
  }
}

// หลังได้ token จาก Cognito: ถาม backend ว่าเป็นใคร (ผูกบัญชีให้ตอน login ครั้งแรก) และบทบาทตรงที่เลือกไหม
async function fetchCognitoUser(role) {
  let user;
  try {
    user = await api('/auth/me');
  } catch (error) {
    await signOutCognito();
    throw error.status === 401 || error.status === 403 ? new Error(NOT_REGISTERED) : error;
  }
  if (user.role !== role) {
    await signOutCognito();
    throw new Error('บทบาทที่เลือกไม่ตรงกับบัญชีนี้');
  }
  return user;
}

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession);
  const [authError, setAuthError] = useState(takeSavedError);

  const start = useCallback((user, extra) => {
    const next = { version: SESSION_VERSION, ...extra, user };
    saveSession(next);
    setSession(next);
    setAuthError('');
    return user;
  }, []);

  const login = useCallback(async ({ email, password, role, remember = true }) => {
    if (cognitoEnabled) {
      // กรอกอีเมล มธ. ได้ — Cognito username คือชื่อหน้า @
      await signInWithTu(email.trim().toLowerCase().replace(/@(dome\.)?tu\.ac\.th$/, ''), password, remember);
      return start(await fetchCognitoUser(role), { remember });
    }
    const result = await api('/auth/login', { method: 'POST', body: { email: email.trim(), password }, anonymous: true });
    if (result.user.role !== role) throw new Error('บทบาทที่เลือกไม่ตรงกับบัญชีนี้');
    return start(result.user, { remember, token: result.token, expires_in: result.expires_in });
  }, [start]);

  // ออกไปหน้า Google — กลับมาแล้วไปต่อที่ onGoogleRedirect ด้านล่าง
  const loginWithGoogle = useCallback(async ({ remember = true }) => {
    if (!cognitoEnabled) throw new Error('การเข้าสู่ระบบด้วย Google ยังไม่เปิดให้ใช้งานในระบบทดสอบ');
    setAuthError('');
    await signInWithGoogle(remember);
  }, []);

  useEffect(() => {
    if (!cognitoEnabled) return undefined;
    return onGoogleRedirect(async (result) => {
      if (!result.ok) {
        setAuthError('เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองอีกครั้ง');
        return;
      }
      let remember = true;
      try { remember = localStorage.getItem('coop-auth-remember') !== 'false'; } catch { /* ค่าเริ่มต้น */ }
      try {
        // Google ใช้เฉพาะผู้ประสานงานสถานประกอบการ
        start(await fetchCognitoUser('company'), { remember });
      } catch (error) {
        try { sessionStorage.setItem(ERROR_KEY, error.message); } catch { /* แสดงได้เฉพาะถ้าไม่ถูก redirect */ }
        setAuthError(error.message);
      }
    });
  }, [start]);

  // ตรวจ session ทุกครั้งที่เปิดเว็บ: ข้อมูลผู้ใช้/สิทธิ์ล่าสุดจาก DB และหลุดเมื่อบัญชีถูกปิด
  const sessionKey = session?.token ?? session?.user?.user_id;
  useEffect(() => {
    if (!sessionKey) return;
    const controller = new AbortController();
    api('/auth/me', { signal: controller.signal }).then((user) => {
      setSession((prev) => { if (!prev) return prev; const next = { ...prev, user }; saveSession(next); return next; });
    }).catch((error) => {
      if (error.status === 401 || error.status === 403) { saveSession(null); setSession(null); }
    });
    return () => controller.abort();
  }, [sessionKey]);

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
    if (cognitoEnabled) signOutCognito();
  }, []);

  const value = useMemo(
    () => ({ user: session?.user ?? null, token: session?.token ?? null, authError, login, loginWithGoogle, logout, updateUser }),
    [session, authError, login, loginWithGoogle, logout, updateUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
