// Cognito trigger: Create auth challenge
// ไม่มีคำตอบที่ต้องเก็บไว้ฝั่ง Cognito — Verify ตรวจรหัสผ่านกับ TU API โดยตรง
export const handler = async (event) => {
  if (event.request.challengeName === 'CUSTOM_CHALLENGE') {
    event.response.publicChallengeParameters = { type: 'TU_PASSWORD' };
    event.response.privateChallengeParameters = {};
    event.response.challengeMetadata = 'TU_PASSWORD';
  }
  return event;
};
