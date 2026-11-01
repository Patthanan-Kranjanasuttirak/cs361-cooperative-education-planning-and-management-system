// สถานะใบสมัคร (ตรงกับ applications.status ใน database/init/001_schema.sql)
// tone ใช้เลือกสีของป้าย: pending | info | success | danger | muted
export const APPLICATION_STATUS = {
  submitted: { label: 'รอบริษัทพิจารณา', tone: 'pending', hint: 'ส่งใบสมัครถึงสถานประกอบการแล้ว รอการพิจารณา' },
  // approved / rejected: ใบสมัครเก่าจากขั้นอาจารย์นิเทศก์อนุมัติ (ยกเลิกแล้ว)
  approved: { label: 'รอบริษัทพิจารณา', tone: 'pending', hint: 'ส่งใบสมัครถึงสถานประกอบการแล้ว รอการพิจารณา' },
  rejected: { label: 'ไม่ผ่านการอนุมัติ', tone: 'danger', hint: 'ใบสมัครนี้ไม่ผ่านการอนุมัติ' },
  accepted: { label: 'ผ่านการคัดเลือกจากบริษัท', tone: 'success', hint: 'ผ่านการคัดเลือกจากบริษัทแล้ว กรุณายืนยันสิทธิ์หากต้องการไปที่นี่' },
  declined: { label: 'ไม่ผ่านการคัดเลือกจากบริษัท', tone: 'danger', hint: 'ไม่ผ่านการคัดเลือกจากบริษัท' },
  confirmed: { label: 'ยืนยันสิทธิ์แล้ว', tone: 'success', hint: 'ยืนยันสิทธิ์ฝึกสหกิจที่นี่แล้ว รอเจ้าหน้าที่ประกาศผล' },
  released: { label: 'สละสิทธิ์', tone: 'muted', hint: 'สละสิทธิ์เพราะยืนยันสิทธิ์ที่อื่นแล้ว' },
  withdrawn: { label: 'ถอนใบสมัครแล้ว', tone: 'muted', hint: 'ถอนใบสมัครนี้แล้ว' },
};

// สถานะที่ใช้เลือกกรองได้ (approved = submitted, rejected ไม่เกิดขึ้นแล้ว)
export const LEGACY_STATUSES = { approved: 'submitted' };
export const currentStatus = (status) => LEGACY_STATUSES[status] ?? status;
export const STATUS_FILTERS = Object.keys(APPLICATION_STATUS).filter((key) => !(key in LEGACY_STATUSES) && key !== 'rejected');

// ขั้นตอนหลักของใบสมัคร ใช้แสดงแถบความคืบหน้า
export const APPLICATION_STEPS = ['ส่งใบสมัคร', 'การคัดเลือกจากสถานประกอบการ', 'ยืนยันสิทธิ์'];

// ขั้นที่ทำเสร็จแล้ว (จำนวน) และขั้นที่ไม่ผ่าน ของแต่ละสถานะ — released / withdrawn ไม่แสดงแถบ
export const STATUS_PROGRESS = {
  submitted: { done: 1 },
  approved: { done: 1 },
  accepted: { done: 2 },
  confirmed: { done: 3 },
  rejected: { done: 1, failedAt: 1 },
  declined: { done: 1, failedAt: 1 },
};
