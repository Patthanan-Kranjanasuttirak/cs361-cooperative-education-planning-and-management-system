// สถานะสหกิจศึกษาของนักศึกษา (students.profile_status + students.coop_result ใน database/init/001_schema.sql)
// - ยังไม่บันทึกข้อมูลส่วนตัว → บันทึกแล้วรอประกาศผล → เจ้าหน้าที่ประกาศว่าผ่าน/ไม่ผ่านเข้าแผนสหกิจศึกษา
// tone ใช้สีเดียวกับป้ายสถานะใบสมัคร
export const COOP_STATUS = {
  none: { label: 'ยังไม่บันทึกข้อมูล', tone: 'muted' },
  waiting: { label: 'รอประกาศผลสหกิจศึกษา', tone: 'pending' },
  passed: { label: 'ผ่านเข้าแผนสหกิจศึกษา', tone: 'success' },
  failed: { label: 'ไม่ผ่านเข้าแผนสหกิจศึกษา', tone: 'danger' },
};

// เจ้าหน้าที่คัดกรองเบื้องต้น และผลคัดเลือกของกรรมการ (เห็นเฉพาะเจ้าหน้าที่และกรรมการ)
export const SCREENING_STATUS = {
  none: { label: 'ยังไม่คัดกรอง', tone: 'muted' },
  passed: { label: 'ผ่านคัดกรองเบื้องต้น', tone: 'info' },
  failed: { label: 'ไม่ผ่านคัดกรองเบื้องต้น', tone: 'danger' },
};
export const COMMITTEE_RESULT = {
  none: { label: 'รอกรรมการคัดเลือก', tone: 'muted' },
  passed: { label: 'ผ่านการคัดเลือกจากคณะกรรมการ', tone: 'success' },
  failed: { label: 'ไม่ผ่านการคัดเลือกจากคณะกรรมการ', tone: 'danger' },
};

// สมัครแผนแล้วแต่ยังไม่ประกาศผล = อยู่ในรอบคัดเลือกปัจจุบัน
export const isCandidate = (student) => Boolean(student.profile_status) && !student.coop_result;

export function coopStatus(student) {
  return student.coop_result ?? (student.profile_status ? 'waiting' : 'none');
}

// ยื่นใบสมัครได้เมื่อผ่านเข้าแผนสหกิจศึกษา (backend ตรวจซ้ำตอน POST /applications)
export function reviewBlockers(student) {
  return student.coop_result === 'passed' ? [] : ['ผ่านการคัดเลือกเข้าแผนสหกิจศึกษา'];
}
