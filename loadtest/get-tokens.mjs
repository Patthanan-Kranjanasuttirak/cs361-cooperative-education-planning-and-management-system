// ขอ Cognito ID token ของ lt.student01–08 สำหรับ k6 บน AWS test stack (Node 18+, ไม่ต้องติดตั้ง package)
// เงื่อนไข: อีเมลบัญชีทดสอบต้องอยู่ใน MOCK_LOGINS ของทั้ง verify-auth-challenge และ backend Lambda
//   COGNITO_REGION=ap-southeast-2 COGNITO_CLIENT_ID=<app client id> LT_PASSWORD='<MOCK_PASSWORD>' \
//   API_URL=https://<api>/prod/api node loadtest/get-tokens.mjs > loadtest/tokens.json
// ใช้ flow เดียวกับหน้าเว็บ: CUSTOM_AUTH (ถ้ายังไม่มีผู้ใช้ใน pool จะ SignUp ด้วยรหัสสุ่มที่ใช้ไม่ได้ก่อน)
// ไม่พิมพ์ token/รหัสผ่านออก stderr; tokens.json อยู่ใน .gitignore และหมดอายุตาม ID token (ปกติ 1 ชั่วโมง)
import { randomBytes } from 'node:crypto';

const { COGNITO_REGION: region, COGNITO_CLIENT_ID: clientId, LT_PASSWORD: password, API_URL } = process.env;
if (!region || !clientId || !password) {
  console.error('ต้องตั้ง COGNITO_REGION, COGNITO_CLIENT_ID และ LT_PASSWORD');
  process.exit(1);
}
const usernames = Array.from({ length: 8 }, (_, i) => `lt.student${String(i + 1).padStart(2, '0')}@loadtest.example.test`);

async function cognito(target, body) {
  const res = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-amz-json-1.1', 'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw Object.assign(new Error(`${target}: ${json.__type ?? res.status}`), { type: json.__type ?? '' });
  return json;
}

const startAuth = (username) => cognito('InitiateAuth', { AuthFlow: 'CUSTOM_AUTH', ClientId: clientId, AuthParameters: { USERNAME: username } });

async function idToken(username) {
  let init;
  try {
    init = await startAuth(username);
  } catch (error) {
    if (!error.type.includes('UserNotFoundException')) throw error;
    await cognito('SignUp', { ClientId: clientId, Username: username, Password: `Aa1!${randomBytes(24).toString('hex')}` });
    init = await startAuth(username);
  }
  if (init.ChallengeName !== 'CUSTOM_CHALLENGE') throw new Error(`${username}: challenge ไม่ถูกต้อง`);
  const result = await cognito('RespondToAuthChallenge', {
    ClientId: clientId, ChallengeName: 'CUSTOM_CHALLENGE', Session: init.Session,
    ChallengeResponses: { USERNAME: init.ChallengeParameters?.USERNAME ?? username, ANSWER: password },
  });
  const token = result.AuthenticationResult?.IdToken;
  if (!token) throw new Error(`${username}: ไม่ได้รับ token (รหัสผ่านหรือ MOCK_LOGINS ไม่ถูกต้อง)`);
  if (API_URL) {
    // เรียกครั้งแรกเพื่อให้ backend ผูก cognito_sub กับบัญชีใน users
    const me = await fetch(`${API_URL.replace(/\/$/, '')}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (me.status !== 200) throw new Error(`${username}: GET /auth/me ได้ ${me.status} (อีเมลต้องอยู่ใน MOCK_LOGINS ของ backend)`);
  }
  return token;
}

const tokens = [];
for (const username of usernames) {
  tokens.push(await idToken(username));
  console.error(`ok ${username}`);
}
process.stdout.write(`${JSON.stringify(tokens)}\n`);
