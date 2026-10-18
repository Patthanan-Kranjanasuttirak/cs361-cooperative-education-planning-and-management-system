// เกณฑ์คุณสมบัติผู้สมัครสหกิจศึกษา (ปีการศึกษา 2568)
// Keep identical to backend/src/config/coopCriteria.js; backend/tests/run.py checks parity.
//
// แต่ละ "ช่อง" (slot) คือรายการวิชาที่ใช้แทนกันได้ เช่น ['คพ.213', 'คพ.216'] = คพ.213 หรือ คพ.216
// ถ้าเรียนหลายวิชาในช่องเดียวกัน หรือเรียนซ้ำ ใช้เกรดที่ดีที่สุด / ทุกวิชา 3 หน่วยกิตจึงเฉลี่ยตรง ๆ ได้
export const COOP_CRITERIA = {
  academicYear: '2568',
  minGpax: 2.75,
  minGroupAverage: 2.5,
  minStudyYear: 3,
  curricula: {
    61: {
      completed: [['คพ.101'], ['คพ.102'], ['คพ.111'], ['คพ.213', 'คพ.216'], ['คพ.251'], ['คพ.264']],
      inProgressOrCompleted: [['คพ.384'], ['คพ.266', 'คพ.322', 'คพ.348']],
      mustPassBeforeCoop: 'คพ.302',
    },
    66: {
      completed: [['คพ.100'], ['คพ.101'], ['คพ.102'], ['คพ.111'], ['คพ.213', 'คพ.216'], ['คพ.251'], ['คพ.261']],
      inProgressOrCompleted: [['คพ.180'], ['คพ.262', 'คพ.331', 'คพ.240']],
      mustPassBeforeCoop: 'คพ.301',
    },
  },
};

// เกรดตัวอักษรของ มธ. → แต้ม
export const GRADE_POINTS = { A: 4, 'B+': 3.5, B: 3, 'C+': 2.5, C: 2, 'D+': 1.5, D: 1, F: 0 };

// ค่าพิเศษสำหรับวิชาที่ "กำลังศึกษา"
export const IN_PROGRESS = 'IP';

// สองหลักแรกของเลขทะเบียนคือปีที่เข้า (พ.ศ.) เช่น 6609610001 = เข้าปี 2566
const entryYear = (studentId) => /^\d{10}$/.test(studentId ?? '') ? Number(studentId.slice(0, 2)) : null;

// หลักสูตรตามปีที่เข้า: ถึงปี 65 → 61, ตั้งแต่ปี 66 → 66 (null = เลขทะเบียนไม่ถูกรูปแบบ)
export function curriculumFor(studentId) {
  const year = entryYear(studentId);
  return year == null ? null : year <= 65 ? '61' : '66';
}

export const curriculumLabel = (curriculum) => (curriculum ? `หลักสูตร พ.ศ. 25${curriculum}` : '—');

// ปีการศึกษา (พ.ศ.) เปิดภาคเดือนสิงหาคม
export function academicYear(date = new Date()) {
  return date.getFullYear() + 543 - (date.getMonth() < 7 ? 1 : 0);
}

// ชั้นปี เช่น ปีการศึกษา 2569: รหัส 69 = ปี 1, รหัส 67 = ปี 3
export function studyYear(studentId, date = new Date()) {
  const year = entryYear(studentId);
  return year == null ? null : academicYear(date) % 100 - year + 1;
}

// แต้มที่ดีที่สุดของช่อง (null = ยังไม่มีเกรดในช่องนี้)
export function bestSlotPoints(slot, grades) {
  const points = slot.map((code) => GRADE_POINTS[grades[code]]).filter((p) => p != null);
  return points.length > 0 ? Math.max(...points) : null;
}

// ตรวจข้อ 2 และ 3 ของเกณฑ์ จากเกรดที่นักศึกษากรอก { 'คพ.101': 'A', 'คพ.384': 'IP', ... }
export function evaluateCourses(curriculum, grades) {
  const rule = COOP_CRITERIA.curricula[curriculum];
  if (!rule) return null;

  const slotPoints = rule.completed.map((slot) => bestSlotPoints(slot, grades));
  const completedAll = slotPoints.every((p) => p != null);
  const average = completedAll ? slotPoints.reduce((sum, p) => sum + p, 0) / slotPoints.length : null;

  const inProgressAll = rule.inProgressOrCompleted.every((slot) =>
    slot.some((code) => grades[code] === IN_PROGRESS || GRADE_POINTS[grades[code]] != null)
  );

  return {
    completedAll,
    average,
    averagePasses: average != null && average >= COOP_CRITERIA.minGroupAverage,
    inProgressAll,
  };
}

// Used by both the profile checklist and the API save guard.
export function qualificationChecks({ username, gpax, curriculum, course_grades = {}, declarations = {}, transcript_s3_key }) {
  const expectedCurriculum = curriculumFor(username);
  const hasCurriculum = Object.hasOwn(COOP_CRITERIA.curricula, curriculum) && curriculum === expectedCurriculum;
  const courses = hasCurriculum ? evaluateCourses(curriculum, course_grades) : null;
  const points = Number(gpax);
  const validGpax = gpax != null && gpax !== '' && Number.isFinite(points) &&
    points >= COOP_CRITERIA.minGpax && points <= 4 && Math.abs(points * 100 - Math.round(points * 100)) <= 1e-8;
  return [
    [studyYear(username) >= COOP_CRITERIA.minStudyYear, `ต้องเป็นนักศึกษาชั้นปีที่ ${COOP_CRITERIA.minStudyYear} ขึ้นไป`],
    [hasCurriculum, expectedCurriculum ? `หลักสูตรต้องเป็นหลักสูตร ${expectedCurriculum} ตามปีที่เข้าศึกษา` : 'ไม่พบหลักสูตรจากรหัสนักศึกษา กรุณาติดต่อเจ้าหน้าที่'],
    [validGpax, `GPAX ต้องอยู่ระหว่าง ${COOP_CRITERIA.minGpax.toFixed(2)}–4.00 และทศนิยมไม่เกิน 2 ตำแหน่ง`],
    [Boolean(courses?.completedAll), 'กรอกเกรดวิชาที่ต้องเคยศึกษาให้ครบทุกกลุ่ม (วิชาทดแทนเลือกอย่างน้อย 1 วิชา)'],
    [Boolean(courses?.averagePasses), `เกรดเฉลี่ยกลุ่มวิชาที่ต้องเคยศึกษาต้องไม่ต่ำกว่า ${COOP_CRITERIA.minGroupAverage.toFixed(2)}`],
    [Boolean(courses?.inProgressAll), 'กรอกวิชาที่กำลังศึกษาหรือเคยศึกษาให้ครบทุกกลุ่ม'],
    [declarations.mustPass === true, 'รับทราบวิชาที่ต้องสอบได้ก่อนออกปฏิบัติงาน'],
    [declarations.discipline === true, 'ยืนยันว่าไม่เคยถูกลงโทษทางวินัยนักศึกษา'],
    [declarations.accept === true, 'รับทราบเกณฑ์และยอมรับเงื่อนไขสหกิจศึกษา'],
    [Boolean(transcript_s3_key), 'แนบใบแสดงผลการเรียนให้ผู้ตรวจตรวจสอบ'],
  ];
}
