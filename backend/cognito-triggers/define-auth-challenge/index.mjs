// Cognito trigger: Define auth challenge
// ลำดับ custom auth ของบัญชี TU: ถาม CUSTOM_CHALLENGE (รหัสผ่าน TU) หนึ่งครั้ง ตอบถูกจึงออก token
// ให้ลองได้ครั้งเดียวต่อ session — ผิดแล้วต้องเริ่ม signIn ใหม่ ไม่ให้เดารหัสต่อใน session เดิม
export const handler = async (event) => {
  const session = event.request.session ?? [];
  const last = session.at(-1);

  if (event.request.userNotFound) {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  } else if (session.length === 0) {
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    event.response.challengeName = 'CUSTOM_CHALLENGE';
  } else if (session.length === 1 && last.challengeName === 'CUSTOM_CHALLENGE' && last.challengeResult === true) {
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  } else {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  }
  return event;
};
