import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../utils/httpError.js';
import { query } from '../config/db.js';
import { userById, userBySubject } from '../models/userModel.js';

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
      if (!claims || claims.iss !== issuer || claims.client_id !== client || claims.token_use !== 'access' || !Number.isFinite(Number(claims.exp)) || Number(claims.exp) <= Date.now() / 1000 || typeof claims.sub !== 'string') throw new Error('invalid authorizer claims');
      user = await userBySubject(claims.sub);
    } else {
      if (!process.env.COGNITO_USER_POOL_ID || !process.env.COGNITO_CLIENT_ID) throw new HttpError(503, 'ยังไม่ได้ตั้งค่า Cognito', 'AUTH_NOT_CONFIGURED');
      if (!verifier) {
        const { CognitoJwtVerifier } = await import('aws-jwt-verify');
        verifier = CognitoJwtVerifier.create({ userPoolId: process.env.COGNITO_USER_POOL_ID, clientId: process.env.COGNITO_CLIENT_ID, tokenUse: 'access' });
      }
      const claims = await verifier.verify(match[1]);
      user = await userBySubject(claims.sub);
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

export async function developmentLogin(req, res) {
  if (!developmentAuth()) throw new HttpError(404, 'ไม่พบเส้นทางนี้', 'NOT_FOUND');
  const { email, password } = req.body ?? {};
  const configured = process.env.DEV_AUTH_PASSWORD;
  if (!configured) throw new HttpError(503, 'ยังไม่ได้ตั้งค่ารหัสผ่านบัญชีทดสอบ', 'AUTH_NOT_CONFIGURED');
  if (typeof email !== 'string' || typeof password !== 'string') throw new HttpError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'INVALID_CREDENTIALS');
  const supplied = Buffer.from(password), expected = Buffer.from(configured);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new HttpError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'INVALID_CREDENTIALS');
  const { rows } = await query("SELECT user_id FROM users WHERE lower(email)=$1 AND auth_provider='dev' AND is_active", [email.trim().toLowerCase()]);
  if (rows.length !== 1) throw new HttpError(401, 'อีเมลหรือรหัสผ่านไม่ถูกต้อง', 'INVALID_CREDENTIALS');
  const user = await userById(rows[0].user_id);
  res.json({ user, token: issueDevelopmentToken(user.user_id), expires_in: 3600 });
}
