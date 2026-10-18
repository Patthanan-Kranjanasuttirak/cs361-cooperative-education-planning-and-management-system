import { COOP_CRITERIA } from './coopCriteria';

// เกณฑ์การสมัครสหกิจศึกษา
// หน้าเว็บใช้แสดงผลและกันไว้ก่อน — backend ต้องเช็กซ้ำตอน POST /api/applications เสมอ
export const MIN_GPAX = COOP_CRITERIA.minGpax;

// GPAX ไม่ต่ำกว่าเกณฑ์ (2.75 พอดีสมัครได้)
export const isGpaxEligible = (gpax) => gpax != null && gpax >= MIN_GPAX;
