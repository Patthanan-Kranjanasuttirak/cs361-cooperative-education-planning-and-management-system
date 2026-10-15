// ตรวจข้อมูลสถานประกอบการ — ใช้ทั้งหน้าเจ้าหน้าที่และหน้าผู้ประสานงาน
// ตรงกับ CHECK ในตาราง companies: วันเปิด/ปิดใส่ทั้งคู่หรือไม่ใส่ทั้งคู่ และวันปิดต้องไม่ก่อนวันเปิด
export function validateCompany(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = 'กรุณากรอกชื่อสถานประกอบการ';
  if (!!form.application_start !== !!form.application_end) errors.period = 'กรุณากรอกวันเปิดและวันปิดรับสมัครให้ครบทั้งคู่';
  else if (form.application_start && form.application_end < form.application_start) errors.period = 'วันปิดรับสมัครต้องไม่ก่อนวันเปิดรับสมัคร';
  return errors;
}
