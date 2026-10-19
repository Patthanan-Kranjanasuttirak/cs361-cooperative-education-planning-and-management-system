// Cognito trigger: Verify auth challenge response
// คำตอบของ challenge คือรหัสผ่าน TU — ส่งไปตรวจกับ TU API แล้วตอบแค่ถูก/ผิด ห้าม log หรือเก็บรหัสผ่าน
// env: TU_API_KEY (Application-Key จาก TU), TU_API_URL (ไม่บังคับ),
//      MOCK_LOGINS (อีเมลบัญชี mock คั่นด้วย ,) และ MOCK_PASSWORD — ใช้ค่าเดียวกับ backend
// Lambda นี้ต้องออก internet ได้ (ไม่ใส่ใน VPC ที่ไม่มี NAT) และ Cognito รอ trigger ได้ไม่เกิน 5 วินาที
// backend โหมด development import ไฟล์นี้ไปใช้ตรวจ TU ตอน login บนเครื่อง — เกณฑ์สาขาจึงอยู่ที่เดียว
import { timingSafeEqual } from 'node:crypto';

const TU_API_URL = process.env.TU_API_URL || 'https://restapi.tu.ac.th/api/v1/auth/Ad/verify';
const TIMEOUT_MS = 4000;

// เลขทะเบียนสาขาวิทยาการคอมพิวเตอร์: YY 09 61|65 xxxx (YY = ปีที่เข้า) เข้าระบบได้ทุกปี
// หลักสูตรและสิทธิ์สมัครตามชั้นปีอยู่ที่ backend/src/config/coopCriteria.js
const CS_STUDENT_ID = /^\d{2}09(?:61|65)\d{4}$/;
const TU_LOGIN = /^([a-z0-9._-]{1,50})(?:@(?:dome\.)?tu\.ac\.th)?$/;

export const isCsStudentId = (studentId) => CS_STUDENT_ID.test(studentId ?? '');
// เลข 10 หลักที่ไม่ใช่รหัสสาขา ไม่ต้องถาม TU
export const isOtherStudentId = (value) => /^\d{10}$/.test(value ?? '') && !isCsStudentId(value);

// ชื่อผู้ใช้ TU, รหัสนักศึกษา หรืออีเมลมหาวิทยาลัย (@dome.tu.ac.th / @tu.ac.th) → ชื่อที่ส่งให้ TU (ไม่ใช่รูปแบบนี้ได้ null)
export const tuLoginName = (value) => TU_LOGIN.exec(value?.trim().toLowerCase() ?? '')?.[1] ?? null;

// ผ่าน: คืนข้อมูลจาก TU (username ที่ TU ยืนยัน ประเภท ชื่อไทย/อังกฤษ อีเมล) ไม่ผ่าน: null
// username ที่คืนอาจต่างจากที่ส่งไป (เช่นส่งชื่อจากอีเมล TU ตอบรหัสนักศึกษา) — ผู้เรียกต้องใช้ค่าที่ TU ตอบเป็นตัวตน
export async function verifyWithTu(username, password) {
  if (!process.env.TU_API_KEY) throw new Error('TU_API_KEY is not configured');
  const response = await fetch(TU_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Application-Key': process.env.TU_API_KEY },
    body: JSON.stringify({ UserName: username, PassWord: password }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  // TU API ตอบ 4xx เมื่อรหัสผิด — ถือว่าไม่ผ่าน ส่วน 5xx ให้ throw เพื่อให้ login ล้มแบบ error ไม่ใช่ "รหัสผิด"
  if (response.status >= 500) throw new Error(`TU API error ${response.status}`);
  const data = await response.json().catch(() => null);
  // Application-Key ผิด TU ตอบ 403 "invalid token" — เป็นปัญหาการตั้งค่า ไม่ใช่รหัสผ่านผู้ใช้ผิด
  if (/token/i.test(data?.error ?? '')) {
    const error = new Error(`TU API rejected the Application-Key (${response.status})`);
    error.name = 'TuKeyError';
    throw error;
  }
  if (!response.ok || data?.status !== true || typeof data.username !== 'string' || !data.username) return null;
  const tuUsername = data.username.toLowerCase();
  return {
    username: tuUsername,
    type: data.type === 'student' || isCsStudentId(tuUsername) ? 'student' : 'employee',
    th_name: data.displayname_th || tuUsername,
    en_name: data.displayname_en || tuUsername,
    email: data.email || null,
  };
}

// บัญชี mock (อาจารย์ เจ้าหน้าที่ ผู้ประสานงาน): Cognito username = อีเมลที่อยู่ใน MOCK_LOGINS ใช้รหัส MOCK_PASSWORD ไม่ถาม TU
export const isMockLogin = (username) => (process.env.MOCK_LOGINS ?? '').split(',')
  .map((login) => login.trim().toLowerCase()).filter(Boolean).includes(username?.toLowerCase());

function mockPasswordMatches(answer) {
  const expected = Buffer.from(process.env.MOCK_PASSWORD ?? ''), supplied = Buffer.from(answer);
  return expected.length > 0 && expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

// เก็บชื่อ/อีเมลจาก TU ไว้ใน Cognito ให้มากับ ID token — backend ใช้สร้างบัญชีนักศึกษาตอนเข้าครั้งแรก
// ต้องเพิ่ม custom attribute en_name ใน User Pool และ execution role ต้องเรียก cognito-idp:AdminUpdateUserAttributes ได้
let writeAttributes = async (event, attributes) => {
  const { CognitoIdentityProviderClient, AdminUpdateUserAttributesCommand } = await import('@aws-sdk/client-cognito-identity-provider');
  await new CognitoIdentityProviderClient({}).send(new AdminUpdateUserAttributesCommand({ UserPoolId: event.userPoolId, Username: event.userName, UserAttributes: attributes }));
};
export function setAttributeWriterForTests(writer) { writeAttributes = writer; }

async function saveTuProfile(event, profile) {
  const current = event.request.userAttributes ?? {};
  const attributes = [['name', profile.th_name], ['custom:en_name', profile.en_name], ...(profile.email ? [['email', profile.email], ['email_verified', 'true']] : [])]
    .filter(([name, value]) => current[name] !== value).map(([Name, Value]) => ({ Name, Value }));
  if (!attributes.length) return;
  try {
    await writeAttributes(event, attributes);
  } catch (error) {
    // ไม่ให้ login ล้มเพราะเก็บชื่อไม่ได้ — backend ใช้รหัสนักศึกษาเป็นชื่อแทน
    console.error('Saving TU profile failed:', error.name, error.message);
  }
}

export const handler = async (event) => {
  const answer = event.request.challengeAnswer;
  if (typeof answer !== 'string' || !answer || isOtherStudentId(event.userName)) {
    event.response.answerCorrect = false;
    return event;
  }
  if (isMockLogin(event.userName)) {
    event.response.answerCorrect = mockPasswordMatches(answer);
    return event;
  }
  try {
    const profile = await verifyWithTu(event.userName, answer);
    // Cognito username กลายเป็นตัวตนใน token จึงต้องตรงกับที่ TU ยืนยัน และนักศึกษาต้องอยู่สาขา
    // อาจารย์/เจ้าหน้าที่ผ่านที่นี่ได้ — backend ตรวจกับตาราง users ว่าลงทะเบียนไว้หรือไม่
    event.response.answerCorrect = Boolean(profile) && profile.username === event.userName.toLowerCase() &&
      (profile.type !== 'student' || isCsStudentId(profile.username));
    if (event.response.answerCorrect && profile.type === 'student') await saveTuProfile(event, profile);
  } catch (error) {
    // log เฉพาะสาเหตุ ไม่มีรหัสผ่านหรือ response ของ TU
    console.error('TU verify failed:', error.name, error.message);
    throw new Error('ไม่สามารถตรวจสอบกับระบบ TU ได้ในขณะนี้');
  }
  return event;
};
