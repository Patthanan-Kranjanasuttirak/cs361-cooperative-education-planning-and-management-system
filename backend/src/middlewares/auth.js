import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../utils/httpError.js';
import { query } from '../config/db.js';
import { bindCognitoUser, fillTuNames, provisionTuStudent, registeredTuStaff, userById, userBySubject } from '../models/userModel.js';
import { isCsStudentId, isOtherStudentId, tuLoginName, verifyWithTu } from '../../cognito-triggers/verify-auth-challenge/index.mjs';

const localSecret = process.env.DEV_AUTH_SECRET || randomBytes(32).toString('hex');
export const developmentAuth = () => process.env.AUTH_MODE === 'development' && process.env.NODE_ENV !== 'production' && !process.env.AWS_LAMBDA_FUNCTION_NAME;
const sign = (value) => createHmac('sha256', localSecret).update(value).digest('base64url');
let verifier;
export const VERIFIED_COGNITO_CLAIMS = Symbol('Cognito claims from Lambda request context');

export function issueDevelopmentToken(userId, expiresIn = 3600) {
  const head = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ sub: String(userId), exp: Math.floor(Date.now() / 1000) + expiresIn, iss: 'cs361-development', aud: 'cs361-local' })).toString('base64url');
  return `${head}.${body}.${sign(`${head}.${body}`)}`;
}

export async function authenticate(req, _res, next) {
  try {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '');
    if (!match) throw new Error('missing token');
    let user;
    if (developmentAuth()) {
      const [head, body, signature, extra] = match[1].split('.');
      if (!signature || extra) throw new Error('invalid token');
      const expected = Buffer.from(sign(`${head}.${body}`));
      const supplied = Buffer.from(signature);
      if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new Error('invalid signature');
      const header = JSON.parse(Buffer.from(head, 'base64url'));
      const claims = JSON.parse(Buffer.from(body, 'base64url'));
      if (header.alg !== 'HS256' || claims.iss !== 'cs361-development' || claims.aud !== 'cs361-local' || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000 || !/^[1-9]\d*$/.test(claims.sub)) throw new Error('invalid claims');
      user = await userById(Number(claims.sub));
    } else if (process.env.AUTH_MODE === 'api-gateway') {
      // Only lambda.js can populate this Symbol; HTTP headers/body cannot supply it.
      const claims = req[VERIFIED_COGNITO_CLAIMS];
      const pool = process.env.COGNITO_USER_POOL_ID;
      const client = process.env.COGNITO_CLIENT_ID;
      if (!pool || !client) throw new HttpError(503, 'ยังไม่ได้ตั้งค่า Cognito', 'AUTH_NOT_CONFIGURED');
      const issuer = `https://cognito-idp.${pool.split('_')[0]}.amazonaws.com/${pool}`;
      // ID token ระบุ client ใน aud ส่วน access token ใช้ client_id
      const audience = claims?.token_use === 'id' ? claims.aud : claims?.token_use === 'access' ? claims.client_id : undefined;
      // HTTP API ส่ง exp เป็นวินาที ส่วน REST API (Cognito authorizer) ส่งเป็นข้อความวันที่ เช่น "Mon Oct 19 02:00:00 UTC 2026"
      const exp = /^\d+$/.test(String(claims?.exp)) ? Number(claims.exp) : Date.parse(claims?.exp) / 1000;
      if (!claims || claims.iss !== issuer || audience !== client || !Number.isFinite(exp) || exp <= Date.now() / 1000 || typeof claims.sub !== 'string') throw new Error('invalid authorizer claims');
      user = await fillTuNames(await userBySubject(claims.sub) ?? await bindCognitoUser(claims), claims);
    } else {
      if (!process.env.COGNITO_USER_POOL_ID || !process.env.COGNITO_CLIENT_ID) throw new HttpError(503, 'ยังไม่ได้ตั้งค่า Cognito', 'AUTH_NOT_CONFIGURED');
      if (!verifier) {
        const { CognitoJwtVerifier } = await import('aws-jwt-verify');
        // tokenUse null รับทั้ง ID token (frontend ส่งมา เพราะมีอีเมลไว้ผูกบัญชี Google) และ access token
        verifier = CognitoJwtVerifier.create({ userPoolId: process.env.COGNITO_USER_POOL_ID, clientId: process.env.COGNITO_CLIENT_ID, tokenUse: null });
      }
      const claims = await verifier.verify(match[1]);
      user = await fillTuNames(await userBySubject(claims.sub) ?? await bindCognitoUser(claims), claims);
    }
    if (!user || !user.is_active) throw new HttpError(403, 'บัญชีไม่ได้รับอนุญาตหรือถูกปิดใช้งาน', 'ACCOUNT_DISABLED');
    req.user = user; // Always resolve current permissions from PostgreSQL, never client claims/role.
    next();
  } catch (error) {
    if (error instanceof HttpError || /^[0-9A-Z]{5}$/.test(error.code ?? '') || error.code === 'ECONNREFUSED') return next(error);
    next(new HttpError(401, 'กรุณาเข้าสู่ระบบใหม่', 'UNAUTHENTICATED'));
  }
}

export const allowRoles = (...roles) => (req, _res, next) =>
  roles.includes(req.user.role) ? next() : next(new HttpError(403, 'ไม่มีสิทธิ์ดำเนินการ', 'FORBIDDEN'));

const invalidCredentials = () => new HttpError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง', 'INVALID_CREDENTIALS');

// ยืนยันตัวตนกับ TU API จริง แล้วตัดสินสิทธิ์จาก DB (เกณฑ์สาขาเดียวกับ Lambda ของ Cognito)
// - นักศึกษาสาขาวิทยาการคอมพิวเตอร์: เข้าได้ login ครั้งแรกสร้างบัญชีให้
// - อาจารย์/เจ้าหน้าที่: ต้องลงทะเบียนไว้ใน users (username หรืออีเมลตรงกับ TU)
async function tuLogin(input, password) {
  const loginName = tuLoginName(input);
  if (isOtherStudentId(loginName)) throw notCsStudent();
  if (!process.env.TU_API_KEY) throw new HttpError(503, 'ยังไม่ได้ตั้งค่า TU_API_KEY', 'AUTH_NOT_CONFIGURED');
  let profile;
  try {
    profile = await verifyWithTu(loginName, password);
  } catch (error) {
    // ไม่ log รหัสผ่านหรือ response ของ TU
    console.error('TU verify failed:', error.name, error.message);
    if (error.name === 'TuKeyError') throw new HttpError(503, 'TU_API_KEY (Application Key) ไม่ถูกต้อง กรุณาตรวจสอบค่าใน .env', 'TU_KEY_INVALID');
    throw new HttpError(502, 'ไม่สามารถตรวจสอบกับระบบ TU ได้ในขณะนี้', 'TU_UNAVAILABLE');
  }
  if (!profile) throw invalidCredentials();
  const typedEmail = input.includes('@') ? input.trim().toLowerCase() : null;
  let user;
  if (profile.type === 'student') {
    if (!isCsStudentId(profile.username)) throw notCsStudent();
    user = await provisionTuStudent({ ...profile, email: profile.email ?? typedEmail ?? `${profile.username}@dome.tu.ac.th` });
  } else {
    user = await registeredTuStaff(profile.username, [profile.email, typedEmail]);
    if (!user) throw new HttpError(403, 'บัญชีนี้ยังไม่ได้ลงทะเบียนในระบบ กรุณาติดต่อเจ้าหน้าที่', 'NOT_REGISTERED');
  }
  if (!user) throw new HttpError(403, 'บัญชีไม่ได้รับอนุญาตหรือถูกปิดใช้งาน', 'ACCOUNT_DISABLED');
  return user;
}
const notCsStudent = () => new HttpError(403, 'ระบบนี้เปิดให้เฉพาะนักศึกษาสาขาวิชาวิทยาการคอมพิวเตอร์', 'NOT_CS_STUDENT');

// บัญชี mock (ผู้ประสานงาน และบัญชีทดสอบใน seed) ใช้ DEV_AUTH_PASSWORD ร่วมกัน เข้าด้วยอีเมลหรือ username
async function mockAccount(login, password) {
  const configured = process.env.DEV_AUTH_PASSWORD;
  if (!configured) return null;
  const supplied = Buffer.from(password), expected = Buffer.from(configured);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
  const { rows } = await query("SELECT user_id FROM users WHERE (lower(email)=$1 OR lower(username)=$1) AND auth_provider='dev' AND is_active", [login.trim().toLowerCase()]);
  return rows.length === 1 ? userById(rows[0].user_id) : null;
}

export async function developmentLogin(req, res) {
  if (!developmentAuth()) throw new HttpError(404, 'ไม่พบเส้นทางนี้', 'NOT_FOUND');
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !password) throw invalidCredentials();
  // อีเมล/ชื่อผู้ใช้ของ มธ. ที่ไม่ใช่บัญชี mock ส่งไปตรวจกับ TU
  let user = await mockAccount(email, password);
  if (!user && tuLoginName(email)) user = await tuLogin(email, password);
  if (!user) {
    if (!process.env.DEV_AUTH_PASSWORD) throw new HttpError(503, 'ยังไม่ได้ตั้งค่ารหัสผ่านบัญชีทดสอบ', 'AUTH_NOT_CONFIGURED');
    throw invalidCredentials();
  }
  res.json({ user, token: issueDevelopmentToken(user.user_id), expires_in: 3600 });
}
