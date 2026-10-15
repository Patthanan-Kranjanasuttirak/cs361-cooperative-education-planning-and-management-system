// ดึงข้อมูลบุคคลจาก TU API ผ่าน backend (Application-Key ของ TU API ต้องอยู่ที่ backend เท่านั้น ห้ามอยู่ในหน้าเว็บ)
// MOCK: ยังไม่มี backend — TODO: GET /api/tu-users/:username?role=student|advisor|staff
//   คืน { th_name, en_name, email } (นักศึกษามี curriculum, advisor_name เพิ่ม) หรือ 404 ถ้าไม่พบใน TU
export async function lookupTuUser(username, role) {
  await new Promise((resolve) => setTimeout(resolve, 400));
  // ค่าตัวอย่างสำหรับทดสอบกรณีไม่พบ
  if (username === '0000000000' || username === 'notfound') {
    const error = new Error('not found');
    error.status = 404;
    throw error;
  }
  if (role === 'student') {
    return {
      th_name: `นักศึกษา ${username} (ข้อมูลตัวอย่างจาก TU)`,
      en_name: `Student ${username}`,
      email: `${username}@dome.tu.ac.th`,
      curriculum: Number(username.slice(0, 2)) >= 66 ? '66' : '61',
    };
  }
  return {
    th_name: `บุคลากร ${username} (ข้อมูลตัวอย่างจาก TU)`,
    en_name: `TU Staff ${username}`,
    email: `${username}@tu.ac.th`,
  };
}
