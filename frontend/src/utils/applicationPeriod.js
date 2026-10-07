// สถานะการรับสมัคร (ใช้ทั้งป้ายสถานะและตัวกรอง; key ตรงกับค่า status ที่ส่งให้ API)
export const APPLICATION_STATUSES = {
  open: 'เปิดรับสมัคร',
  upcoming: 'ยังไม่เปิดรับสมัคร',
  closed: 'ปิดรับสมัครแล้ว',
};

// สถานะช่วงเวลาเปิดรับสมัคร จาก application_start / application_end (รูปแบบ YYYY-MM-DD)
// คืนค่า { key, label } โดย key เป็น 'open' | 'upcoming' | 'closed' | 'unknown'
export function getApplicationStatus(company, today = new Date()) {
  const { application_start: start, application_end: end } = company ?? {};
  if (!start || !end) {
    return { key: 'unknown', label: 'ไม่ระบุช่วงรับสมัคร' };
  }

  const todayStr = toDateString(today);
  const key = todayStr < start ? 'upcoming' : todayStr > end ? 'closed' : 'open';
  return { key, label: APPLICATION_STATUSES[key] };
}

// "2026-11-15" → "15 พ.ย. 2569"
export function formatThaiDate(dateStr) {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatApplicationPeriod(company) {
  if (!company?.application_start || !company?.application_end) return 'ไม่ระบุ';
  return `${formatThaiDate(company.application_start)} – ${formatThaiDate(company.application_end)}`;
}

// วันที่ตามเวลาเครื่องผู้ใช้ในรูปแบบ YYYY-MM-DD (ไม่ใช้ toISOString เพราะจะเพี้ยนเป็นเวลา UTC)
function toDateString(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
