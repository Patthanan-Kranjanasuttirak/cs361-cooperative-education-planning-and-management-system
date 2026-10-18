// MOCK: ข้อมูลตัวอย่างของหน้าผู้ประสานงาน (บริษัท id 6 = ธนาคารไทยพาณิชย์ ตำแหน่ง 8, 9 ตรงกับฐานข้อมูล)
// TODO: GET /api/company/applications — backend คืนเฉพาะใบสมัครของบริษัทตัวเอง (company_users.company_id)
//   และเฉพาะใบที่ผ่านการอนุมัติแล้ว (approved, accepted, declined, confirmed, released, withdrawn หลังอนุมัติ)
export const MOCK_ACTIVE_TERM = '2/2569';

export const MOCK_COMPANY_APPLICANTS = [
  {
    application_id: 21,
    position_id: 8,
    student: { student_code: '6609644444', email: '6609644444@dome.tu.ac.th', phone: '0811112222', th_name: 'นักศึกษาตัวอย่าง สี่', gpax: 3.75, curriculum: '66' },
    status: 'confirmed',
    approved_at: '2026-09-22T14:00:00+07:00',
  },
  {
    application_id: 22,
    position_id: 8,
    student: { student_code: '6609677777', email: '6609677777@dome.tu.ac.th', phone: '0823334444', th_name: 'นักศึกษาตัวอย่าง เจ็ด', gpax: 3.05, curriculum: '66' },
    status: 'accepted',
    approved_at: '2026-10-03T09:10:00+07:00',
  },
  {
    application_id: 23,
    position_id: 8,
    student: { student_code: '6609611111', email: '6609611111@dome.tu.ac.th', phone: '0835556666', th_name: 'นักศึกษาตัวอย่าง หนึ่ง', gpax: 3.42, curriculum: '66' },
    status: 'approved',
    approved_at: '2026-10-11T10:30:00+07:00',
  },
  {
    application_id: 24,
    position_id: 9,
    student: { student_code: '6609622222', email: '6609622222@dome.tu.ac.th', phone: '0847778888', th_name: 'นักศึกษาตัวอย่าง สอง', gpax: 2.87, curriculum: '66' },
    status: 'approved',
    approved_at: '2026-10-12T15:00:00+07:00',
  },
  {
    application_id: 25,
    position_id: 9,
    student: { student_code: '6609655555', email: '6609655555@dome.tu.ac.th', phone: '0859990000', th_name: 'นักศึกษาตัวอย่าง ห้า', gpax: 3.1, curriculum: '66' },
    status: 'released',
    approved_at: '2026-09-25T11:00:00+07:00',
  },
  {
    application_id: 26,
    position_id: 8,
    student: { student_code: '6509688888', email: '6509688888@dome.tu.ac.th', phone: '0861234567', th_name: 'นักศึกษาตัวอย่าง แปด', gpax: 3.3, curriculum: '61' },
    status: 'declined',
    approved_at: '2026-09-28T13:00:00+07:00',
  },
];

// สถานะที่บริษัทเห็นข้อมูลติดต่อของนักศึกษาได้ (ยังพิจารณาอยู่ หรือผ่านการคัดเลือกแล้ว)
export const CONTACT_VISIBLE_STATUSES = ['approved', 'accepted', 'confirmed'];

// สถานะที่นับว่า "รับแล้ว" (ใช้คิดเทียบกับ quota)
export const ACCEPTED_STATUSES = ['accepted', 'confirmed'];

// จำนวนผู้สมัครและผู้ยืนยันสิทธิ์ของตำแหน่ง — TODO: ให้ backend คืนมากับตำแหน่ง (นับจาก applications)
export function getPositionStats(positionId) {
  const apps = MOCK_COMPANY_APPLICANTS.filter((a) => a.position_id === positionId);
  return { applicants: apps.length, confirmed: apps.filter((a) => a.status === 'confirmed').length };
}
