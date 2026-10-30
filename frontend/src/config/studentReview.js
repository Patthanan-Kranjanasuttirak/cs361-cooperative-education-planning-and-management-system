// สถานะสหกิจศึกษาของนักศึกษา (students.profile_status + students.coop_result ใน database/init/001_schema.sql)
// - ยังไม่บันทึกข้อมูลส่วนตัว → บันทึกแล้วรอประกาศผล → เจ้าหน้าที่ประกาศว่าผ่าน/ไม่ผ่านเข้าแผนสหกิจศึกษา
// tone ใช้สีเดียวกับป้ายสถานะใบสมัคร
export const COOP_STATUS = {
  none: { label: 'ยังไม่บันทึกข้อมูล', tone: 'muted' },
  waiting: { label: 'รอประกาศผลสหกิจศึกษา', tone: 'pending' },
  passed: { label: 'ผ่านเข้าแผนสหกิจศึกษา', tone: 'success' },
  failed: { label: 'ไม่ผ่านเข้าแผนสหกิจศึกษา', tone: 'danger' },
};

export function coopStatus(student) {
  return student.coop_result ?? (student.profile_status ? 'waiting' : 'none');
}

// ยื่นใบสมัครได้เมื่อผ่านเข้าแผนสหกิจศึกษา (backend ตรวจซ้ำตอน POST /applications)
export function reviewBlockers(student) {
  return student.coop_result === 'passed' ? [] : ['ผ่านการคัดเลือกเข้าแผนสหกิจศึกษา'];
}
