// Cognito trigger: Pre sign-up
// บัญชี TU: frontend สร้างผู้ใช้ใน User Pool ตอน login ครั้งแรก (signUp ด้วยรหัสสุ่มที่ไม่มีใครใช้)
// จึงยืนยันให้อัตโนมัติ ไม่ต้องส่งอีเมล — สิทธิ์จริงอยู่ที่ Verify (ตรวจกับ TU ทุกครั้ง) และตาราง users ใน backend
// App client ต้องเปิดเฉพาะ ALLOW_CUSTOM_AUTH + ALLOW_REFRESH_TOKEN_AUTH รหัสสุ่มนี้จึงใช้ login ไม่ได้
// Google (PreSignUp_ExternalProvider) ปล่อยผ่าน — backend ตรวจอีเมลกับตาราง users ก่อนให้ใช้งาน
// ชื่อผู้ใช้ TU / รหัสนักศึกษา หรืออีเมลของบัญชี mock (ตรวจรหัสที่ Verify)
const TU_USERNAME = /^[a-z0-9._@-]{3,100}$/;

export const handler = async (event) => {
  if (event.triggerSource === 'PreSignUp_SignUp') {
    if (!TU_USERNAME.test(event.userName)) throw new Error('ชื่อผู้ใช้ไม่ถูกต้อง');
    event.response.autoConfirmUser = true;
  }
  return event;
};
