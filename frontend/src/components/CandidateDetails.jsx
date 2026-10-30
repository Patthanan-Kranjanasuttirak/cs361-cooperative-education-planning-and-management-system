import { useState } from 'react';
import CourseGradesFields from './CourseGradesFields';
import DocumentLink from './DocumentLink';
import StudentPersonalInfo from './StudentPersonalInfo';
import '../pages/CSS/pendingApplications.css';

// เอกสารและรายละเอียดของนักศึกษา สำหรับเจ้าหน้าที่และกรรมการ (กดเปิด/ปิดแต่ละส่วน)
export default function CandidateDetails({ student }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [gradesOpen, setGradesOpen] = useState(false);
  return <>
    <div className="pending-docs">
      <DocumentLink url={student.transcript_s3_key ? `/documents/${encodeURIComponent(student.transcript_s3_key)}` : null} label="ดู Transcript" />
      <button type="button" className="pending-doc" aria-expanded={infoOpen} onClick={() => setInfoOpen(!infoOpen)}>
        {infoOpen ? 'ซ่อนข้อมูลส่วนตัว' : 'ดูข้อมูลส่วนตัว'}
      </button>
      <button type="button" className="pending-doc" aria-expanded={gradesOpen} onClick={() => setGradesOpen(!gradesOpen)}>
        {gradesOpen ? 'ซ่อนผลการเรียนรายวิชา' : 'ดูผลการเรียนรายวิชา'}
      </button>
    </div>
    {infoOpen && <StudentPersonalInfo student={student} />}
    {gradesOpen && <CourseGradesFields curriculum={student.curriculum} grades={student.course_grades ?? {}} disabled />}
  </>;
}
