// การตรวจข้อมูลนักศึกษาก่อนสมัคร (ตรงกับ students.profile_status / conduct_status ใน database/init/001_schema.sql)
// - เจ้าหน้าที่ตรวจข้อมูลส่วนตัว: null = ยังไม่ส่ง → pending → verified | returned (แก้แล้วกลับไป pending)
// - อาจารย์ที่ปรึกษารับรองความประพฤติ: null = รอรับรอง → certified | rejected
// tone ใช้สีเดียวกับป้ายสถานะใบสมัคร
export const PROFILE_STATUS = {
  none: { label: 'ยังไม่ส่งข้อมูล', tone: 'muted' },
  pending: { label: 'รอเจ้าหน้าที่ตรวจ', tone: 'pending' },
  verified: { label: 'ข้อมูลถูกต้อง', tone: 'success' },
  returned: { label: 'ส่งกลับให้แก้ไข', tone: 'danger' },
};

export const CONDUCT_STATUS = {
  none: { label: 'รอรับรองความประพฤติ', tone: 'pending' },
  certified: { label: 'รับรองความประพฤติแล้ว', tone: 'success' },
  rejected: { label: 'ไม่รับรองความประพฤติ', tone: 'danger' },
};

// ยื่นใบสมัครได้เมื่อผ่านทั้งสองขั้น (backend ตรวจซ้ำตอน POST /applications)
export function reviewBlockers(student) {
  const blockers = [];
  if (student.profile_status !== 'verified') blockers.push('เจ้าหน้าที่ยืนยันว่าข้อมูลส่วนตัวถูกต้อง');
  if (student.conduct_status !== 'certified') blockers.push('อาจารย์ที่ปรึกษารับรองความประพฤติ');
  return blockers;
}
