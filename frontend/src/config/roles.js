// ข้อมูลของแต่ละบทบาท: ชื่อที่แสดง, หน้าแรกหลัง login และเมนูข้าง
// ถ้าเพิ่มหน้าใหม่ ให้เพิ่มเมนูที่นี่ และเพิ่ม <Route> ใน routes/approutes.jsx
export const ROLES = {
  student: {
    label: 'นักศึกษา',
    home: '/student',
    menu: [
      { name: 'ข้อมูลส่วนตัว', to: '/student/profile' },
      { name: 'สมัครสหกิจศึกษา', to: '/student/apply' },
      { name: 'ใบสมัครของฉัน', to: '/student', end: true },
    ],
  },
  committee: {
    label: 'กรรมการสหกิจศึกษา',
    home: '/committee',
    menu: [
      { name: 'คัดเลือกเข้าแผนสหกิจศึกษา', to: '/committee', end: true },
      { name: 'รายชื่อผู้ผ่านเข้าแผน', to: '/committee/report' },
    ],
  },
  staff: {
    label: 'เจ้าหน้าที่',
    home: '/staff',
    menu: [
      { name: 'ภาพรวมสหกิจศึกษา', to: '/staff', end: true },
      { name: 'คัดกรองและประกาศผล', to: '/staff/students' },
      { name: 'รายชื่อผู้ผ่านเข้าแผน', to: '/staff/report' },
      { name: 'รายชื่อยืนยันสิทธิ์แล้ว', to: '/staff/confirmed' },
      { name: 'สถานประกอบการ', to: '/staff/companies' },
      { name: 'ภาคการศึกษา', to: '/staff/terms' },
      { name: 'จัดการผู้ใช้งาน', to: '/staff/users' },
    ],
  },
  company: {
    label: 'ผู้ประสานงานสถานประกอบการ',
    home: '/company-portal',
    menu: [
      { name: 'ข้อมูลบริษัท', to: '/company-portal/profile' },
      { name: 'ตำแหน่ง', to: '/company-portal/positions' },
      { name: 'ผู้สมัคร', to: '/company-portal', end: true },
    ],
  },
};
