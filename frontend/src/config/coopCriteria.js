// เกณฑ์คุณสมบัติผู้สมัครสหกิจศึกษา (ปีการศึกษา 2568)
// MOCK: TODO ย้ายไปเก็บในฐานข้อมูลรายภาคการศึกษา ให้เจ้าหน้าที่แก้ได้จากหน้า "ภาคการศึกษา"
//
// แต่ละ "ช่อง" (slot) คือรายการวิชาที่ใช้แทนกันได้ เช่น ['คพ.213', 'คพ.216'] = คพ.213 หรือ คพ.216
// ถ้าเรียนหลายวิชาในช่องเดียวกัน หรือเรียนซ้ำ ใช้เกรดที่ดีที่สุด / ทุกวิชา 3 หน่วยกิตจึงเฉลี่ยตรง ๆ ได้
export const COOP_CRITERIA = {
  academicYear: '2568',
  minGpax: 2.75,
  minGroupAverage: 2.5,
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
