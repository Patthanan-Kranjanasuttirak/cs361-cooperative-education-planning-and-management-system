// เบอร์โทรศัพท์: เก็บเป็นตัวเลขล้วน แสดงผลแบบมีขีด

// ตัดขีด/ช่องว่าง/ตัวอักษรที่พิมพ์หรือวางมา เหลือตัวเลขไม่เกิน 10 หลัก
export const normalizePhone = (value) => value.replace(/\D/g, '').slice(0, 10);

// มือถือ 10 หลัก (นักศึกษา)
export const isMobilePhone = (phone) => /^0\d{9}$/.test(phone);

// มือถือ 10 หลัก หรือเบอร์บ้าน/สำนักงาน 9 หลัก เช่น 02-123-4567 (ผู้ประสานงาน)
export const isPhone = (phone) => /^0\d{8,9}$/.test(phone);

// 0812345678 → 081-234-5678, 021234567 → 02-123-4567
export function formatPhone(phone) {
  if (!phone) return '';
  if (phone.length === 10) return `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
  if (phone.length === 9) return `${phone.slice(0, 2)}-${phone.slice(2, 5)}-${phone.slice(5)}`;
  return phone;
}
