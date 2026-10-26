// เข้าสู่ระบบผ่าน Amplify + Cognito (เปิดเมื่อ VITE_AUTH_MODE=cognito)
// - นักศึกษา / อาจารย์ / เจ้าหน้าที่: custom auth — Lambda Verify ตรวจรหัสผ่านกับ TU API
// - ผู้ประสานงานสถานประกอบการ: Google ผ่าน Cognito Hosted UI
// สิทธิ์จริงอยู่ที่ backend (ตาราง users) — ที่นี่ทำแค่ได้ token มา
import { Amplify } from 'aws-amplify';
import { Hub, defaultStorage, sessionStorage } from 'aws-amplify/utils';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import { confirmSignIn, fetchAuthSession, signIn, signInWithRedirect, signOut, signUp } from 'aws-amplify/auth';
import 'aws-amplify/auth/enable-oauth-listener';

export const cognitoEnabled = import.meta.env.VITE_AUTH_MODE === 'cognito';

const REMEMBER_KEY = 'coop-auth-remember';

function readRemember() {
  try { return localStorage.getItem(REMEMBER_KEY) !== 'false'; } catch { return true; }
}

// จดจำการเข้าสู่ระบบ = เก็บ token ใน localStorage, ไม่จดจำ = sessionStorage (ปิดแท็บแล้วหลุด)
function setTokenStorage(remember) {
  try { localStorage.setItem(REMEMBER_KEY, String(remember)); } catch { /* ใช้ค่าเริ่มต้นต่อไป */ }
  cognitoUserPoolsTokenProvider.setKeyValueStorage(remember ? defaultStorage : sessionStorage);
}

// ผล signInWithRedirect (Google) เกิดตอนโหลดหน้าใหม่ อาจมาก่อน React mount — เก็บไว้ให้ผู้ฟังที่มาทีหลังได้รับ
let redirectResult = null;
const redirectListeners = new Set();

if (cognitoEnabled) {
  const origin = window.location.origin;
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
        userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
        loginWith: {
          oauth: {
            domain: import.meta.env.VITE_COGNITO_DOMAIN,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [`${origin}/login`],
            redirectSignOut: [`${origin}/login`],
            responseType: 'code',
            providers: ['Google'],
          },
        },
      },
    },
  });
  setTokenStorage(readRemember());

  Hub.listen('auth', ({ payload }) => {
    if (payload.event !== 'signInWithRedirect' && payload.event !== 'signInWithRedirect_failure') return;
    redirectResult = payload.event === 'signInWithRedirect' ? { ok: true } : { ok: false, error: payload.data?.error };
    redirectListeners.forEach((listener) => listener(redirectResult));
  });
}

export function onGoogleRedirect(listener) {
  if (redirectResult) listener(redirectResult);
  redirectListeners.add(listener);
  return () => redirectListeners.delete(listener);
}

const THAI_ERRORS = {
  NotAuthorizedException: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
  UserLambdaValidationException: 'ไม่สามารถตรวจสอบกับระบบ TU ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
  LimitExceededException: 'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่',
  TooManyRequestsException: 'พยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่',
  NetworkError: 'เชื่อมต่อเครือข่ายไม่ได้',
};

function toThaiError(error) {
  const message = THAI_ERRORS[error?.name];
  return message ? Object.assign(new Error(message), { cause: error }) : error;
}

// รหัสผ่านของผู้ใช้ใน User Pool — ไม่มีใครรู้และใช้ไม่ได้ (app client ไม่เปิด password flow) แค่ให้ signUp ผ่าน policy
function unusablePassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return `Aa1!${btoa(String.fromCharCode(...bytes))}`;
}

const startCustomAuth = (username) => signIn({ username, options: { authFlowType: 'CUSTOM_WITHOUT_SRP' } });

export async function signInWithTu(username, password, remember) {
  setTokenStorage(remember);
  await signOut().catch(() => {}); // เคลียร์ session ค้าง (เช่น login บัญชีอื่นไว้) ก่อนเริ่มใหม่
  try {
    let result;
    try {
      result = await startCustomAuth(username);
    } catch (error) {
      // login ครั้งแรก: ยังไม่มีผู้ใช้ใน User Pool — สร้างแล้วเริ่มใหม่ (Pre sign-up ยืนยันให้อัตโนมัติ)
      if (error.name !== 'UserNotFoundException') throw error;
      await signUp({ username, password: unusablePassword() });
      result = await startCustomAuth(username);
    }
    if (result.nextStep.signInStep !== 'CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE') throw new Error('ขั้นตอนเข้าสู่ระบบไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ');
    const confirmed = await confirmSignIn({ challengeResponse: password });
    if (!confirmed.isSignedIn) throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  } catch (error) {
    throw toThaiError(error);
  }
}

// ออกจากหน้าไป Google แล้วกลับมาที่ /login — ผลส่งผ่าน onGoogleRedirect
export async function signInWithGoogle(remember) {
  setTokenStorage(remember);
  await signOut().catch(() => {});
  await signInWithRedirect({ provider: 'Google' });
}

// ID token มีอีเมลที่ Google ยืนยันแล้ว backend ใช้ผูกบัญชีผู้ประสานงานตอน login ครั้งแรก
// fetchAuthSession ต่ออายุ token ให้เองเมื่อหมดอายุ
export async function cognitoIdToken() {
  const { tokens } = await fetchAuthSession();
  return tokens?.idToken?.toString() ?? null;
}

// ขอ token ใหม่จาก Cognito ทันที (ได้ข้อมูลผู้ใช้ล่าสุด เช่นชื่อที่ Verify เพิ่งเขียนจาก TU)
export async function refreshCognitoSession() {
  await fetchAuthSession({ forceRefresh: true });
}

export async function signOutCognito() {
  await signOut().catch(() => {});
}
