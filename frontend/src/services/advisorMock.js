// MOCK: ยังไม่มี API — TODO: GET /api/advisor/students
//   backend กรองเฉพาะ students.advisor_id = อาจารย์ที่ login
//   latest = ใบสมัครที่เปลี่ยนสถานะล่าสุดในภาคที่ active (ดูจาก application_history.changed_at)
//     ถ้ามีใบ confirmed ให้ใช้ใบนั้นเสมอ เพราะตอนยืนยันสิทธิ์ ใบอื่นเปลี่ยนเป็น released/withdrawn ในเวลาเดียวกัน
//   pending_count = จำนวนใบที่ยังเป็น submitted (รออาจารย์/เจ้าหน้าที่อนุมัติ)
export const MOCK_STUDENTS = [
  {
    student_id: 1,
    student_code: '6609611111',
    th_name: 'นักศึกษาตัวอย่าง หนึ่ง',
    gpax: 3.42,
    application_count: 3,
    pending_count: 1,
    latest: { status: 'submitted', company_name: 'บริษัท ที.ซี.ซี. เทคโนโลยี จำกัด', position_name: 'IT Support Intern', changed_at: '2026-10-10T16:20:00+07:00' },
  },
  {
    student_id: 2,
    student_code: '6609622222',
    th_name: 'นักศึกษาตัวอย่าง สอง',
    gpax: 2.87,
    application_count: 2,
    pending_count: 2,
    latest: { status: 'submitted', company_name: 'บริษัท ซีดีจี กรุ๊ป จำกัด', position_name: 'Software Developer Intern', changed_at: '2026-10-12T13:40:00+07:00' },
  },
  {
    student_id: 3,
    student_code: '6609633333',
    th_name: 'นักศึกษาตัวอย่าง สาม',
    gpax: null,
    application_count: 1,
    pending_count: 1,
    latest: { status: 'submitted', company_name: 'บริษัทกสิกร บิซิเนส-เทคโนโลยี กรุ๊ป', position_name: 'Software Developer Intern', changed_at: '2026-10-13T20:15:00+07:00' },
  },
  {
    student_id: 4,
    student_code: '6609644444',
    th_name: 'นักศึกษาตัวอย่าง สี่',
    gpax: 3.75,
    application_count: 4,
    pending_count: 0,
    latest: { status: 'confirmed', company_name: 'ธนาคารไทยพาณิชย์ จำกัด (มหาชน)', position_name: 'UX/UI Designer Intern', changed_at: '2026-10-08T11:00:00+07:00' },
  },
  {
    student_id: 5,
    student_code: '6609655555',
    th_name: 'นักศึกษาตัวอย่าง ห้า',
    gpax: 3.1,
    application_count: 2,
    pending_count: 0,
    latest: { status: 'accepted', company_name: 'บริษัท ไลน์แมน วงใน จำกัด', position_name: 'Software Developer Intern', changed_at: '2026-10-09T15:30:00+07:00' },
  },
  {
    student_id: 6,
    student_code: '6609666666',
    th_name: 'นักศึกษาตัวอย่าง หก',
    gpax: 2.65,
    application_count: 0,
    pending_count: 0,
    latest: null,
  },
];

// MOCK: รายละเอียดนักศึกษาแต่ละคน — TODO: GET /api/advisor/students/:id
//   backend ต้องเช็กว่า students.advisor_id = อาจารย์ที่ login ถ้าไม่ใช่ตอบ 404 (ไม่บอกว่ามีนักศึกษาคนนี้อยู่)
export const MOCK_STUDENT_DETAILS = {
  1: {
    email: '6609611111@dome.tu.ac.th',
    phone: '0835556666',
    curriculum: '66',
    eligibility: { status: 'submitted', submitted_at: '2026-10-01T09:00:00+07:00', group_average: 3.21, transcript_url: null },
    applications: [
      { application_id: 4, company_name: 'บริษัท ที.ซี.ซี. เทคโนโลยี จำกัด', position_name: 'IT Support Intern', status: 'submitted', submitted_at: '2026-10-10T16:20:00+07:00' },
      { application_id: 23, company_name: 'ธนาคารไทยพาณิชย์ จำกัด (มหาชน)', position_name: 'UX/UI Designer Intern', status: 'approved', submitted_at: '2026-10-09T10:00:00+07:00' },
      { application_id: 31, company_name: 'บริษัท ไลน์แมน วงใน จำกัด', position_name: 'Software Developer Intern', status: 'declined', submitted_at: '2026-09-25T13:00:00+07:00' },
    ],
  },
  2: {
    email: '6609622222@dome.tu.ac.th',
    phone: '0847778888',
    curriculum: '66',
    eligibility: { status: 'submitted', submitted_at: '2026-10-02T14:30:00+07:00', group_average: 2.79, transcript_url: null },
    applications: [
      { application_id: 6, company_name: 'ธนาคารไทยพาณิชย์ จำกัด (มหาชน)', position_name: 'IT Business Analyst Intern', status: 'submitted', submitted_at: '2026-10-11T09:05:00+07:00' },
      { application_id: 7, company_name: 'บริษัท ซีดีจี กรุ๊ป จำกัด', position_name: 'Software Developer Intern', status: 'submitted', submitted_at: '2026-10-12T13:40:00+07:00' },
    ],
  },
  3: {
    email: '6609633333@dome.tu.ac.th',
    phone: null,
    curriculum: '66',
    eligibility: null,
    applications: [
      { application_id: 8, company_name: 'บริษัทกสิกร บิซิเนส-เทคโนโลยี กรุ๊ป', position_name: 'Software Developer Intern', status: 'submitted', submitted_at: '2026-10-13T20:15:00+07:00' },
    ],
  },
  4: {
    email: '6609644444@dome.tu.ac.th',
    phone: '0811112222',
    curriculum: '66',
    eligibility: { status: 'submitted', submitted_at: '2026-09-10T10:00:00+07:00', group_average: 3.64, transcript_url: null },
    applications: [
      { application_id: 21, company_name: 'ธนาคารไทยพาณิชย์ จำกัด (มหาชน)', position_name: 'UX/UI Designer Intern', status: 'confirmed', submitted_at: '2026-09-20T10:15:00+07:00' },
      { application_id: 2, company_name: 'บริษัทกสิกร บิซิเนส-เทคโนโลยี กรุ๊ป', position_name: 'Software Developer Intern', status: 'released', submitted_at: '2026-09-21T09:00:00+07:00' },
      { application_id: 32, company_name: 'บริษัท จีเอเบิล จำกัด (มหาชน)', position_name: 'Data Analyst Intern', status: 'withdrawn', submitted_at: '2026-09-22T11:00:00+07:00' },
      { application_id: 33, company_name: 'บริษัท เอสซีบี เทคเอกซ์ จำกัด', position_name: 'Software Developer Intern', status: 'withdrawn', submitted_at: '2026-09-23T15:00:00+07:00' },
    ],
  },
  5: {
    email: '6609655555@dome.tu.ac.th',
    phone: '0859990000',
    curriculum: '66',
    eligibility: { status: 'submitted', submitted_at: '2026-09-15T08:00:00+07:00', group_average: 2.93, transcript_url: null },
    applications: [
      { application_id: 34, company_name: 'บริษัท ไลน์แมน วงใน จำกัด', position_name: 'Software Developer Intern', status: 'accepted', submitted_at: '2026-09-28T10:00:00+07:00' },
      { application_id: 25, company_name: 'ธนาคารไทยพาณิชย์ จำกัด (มหาชน)', position_name: 'IT Business Analyst Intern', status: 'approved', submitted_at: '2026-09-24T09:30:00+07:00' },
    ],
  },
  6: {
    email: '6609666666@dome.tu.ac.th',
    phone: null,
    curriculum: '66',
    eligibility: null,
    applications: [],
  },
};
