// สถานะใบสมัคร (ตรงกับ applications.status ใน database/init/01-schema.sql)
// tone ใช้เลือกสีของป้าย: pending | info | success | danger | muted
export const APPLICATION_STATUS = {
  submitted: { label: 'รออนุมัติ', tone: 'pending', hint: 'รออาจารย์ที่ปรึกษาหรือเจ้าหน้าที่ตรวจใบสมัคร' },
  approved: { label: 'รอบริษัทพิจารณา', tone: 'info', hint: 'ผ่านการอนุมัติแล้ว ส่งต่อให้บริษัทพิจารณา' },
  rejected: { label: 'ไม่ผ่านการอนุมัติ', tone: 'danger', hint: 'อาจารย์ที่ปรึกษาหรือเจ้าหน้าที่ไม่อนุมัติใบสมัครนี้' },
  accepted: { label: 'ผ่านการคัดเลือก', tone: 'success', hint: 'ผ่านการคัดเลือกจากบริษัทแล้ว กรุณายืนยันสิทธิ์หากต้องการไปที่นี่' },
  declined: { label: 'ไม่ผ่านการคัดเลือก', tone: 'danger', hint: 'ไม่ผ่านการคัดเลือกจากบริษัท' },
  confirmed: { label: 'ยืนยันสิทธิ์แล้ว', tone: 'success', hint: 'ยืนยันสิทธิ์ฝึกสหกิจที่นี่แล้ว' },
  released: { label: 'สละสิทธิ์', tone: 'muted', hint: 'สละสิทธิ์เพราะยืนยันสิทธิ์ที่อื่นแล้ว' },
  withdrawn: { label: 'ถอนใบสมัครแล้ว', tone: 'muted', hint: 'ถอนใบสมัครนี้แล้ว' },
};

// ขั้นตอนหลักของใบสมัคร ใช้แสดงแถบความคืบหน้า
export const APPLICATION_STEPS = ['ส่งใบสมัคร', 'อาจารย์/เจ้าหน้าที่อนุมัติ', 'การคัดเลือกจากสถานประกอบการ', 'ยืนยันสิทธิ์'];

// ขั้นที่ทำเสร็จแล้ว (จำนวน) และขั้นที่ไม่ผ่าน ของแต่ละสถานะ — released / withdrawn ไม่แสดงแถบ
export const STATUS_PROGRESS = {
  submitted: { done: 1 },
  approved: { done: 2 },
  accepted: { done: 3 },
  confirmed: { done: 4 },
  rejected: { done: 1, failedAt: 1 },
  declined: { done: 2, failedAt: 2 },
};
