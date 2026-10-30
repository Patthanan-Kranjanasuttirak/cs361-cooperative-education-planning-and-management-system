import DocumentLink from './DocumentLink';
import StudentPhoto from './StudentPhoto';
import { MAJORS } from '../config/majors';
import { formatPhone } from '../utils/phone';
import '../pages/CSS/studentProfile.css';

// ข้อมูลส่วนตัวที่นักศึกษากรอก (อ่านอย่างเดียว) สำหรับเจ้าหน้าที่และอาจารย์
export default function StudentPersonalInfo({ student }) {
  const rows = [
    ['กลุ่มวิชาเอก', MAJORS[student.major]],
    ['ที่อยู่', student.address],
    ['ชื่อ-นามสกุลผู้ปกครอง', student.guardian_name],
    ['ความสัมพันธ์กับนักศึกษา', student.guardian_relation],
    ['ที่อยู่ผู้ปกครอง', student.guardian_address],
    ['เบอร์โทรศัพท์ผู้ปกครอง', student.guardian_phone && formatPhone(student.guardian_phone)],
  ];
  return <div className="student-info">
    <StudentPhoto s3Key={student.photo_s3_key} alt={`รูปของ ${student.th_name}`} />
    <div className="student-info-body">
      <dl className="profile-readonly">{rows.map(([label, value]) => <div key={label} className="profile-readonly-row">
        <dt className="profile-label">{label}</dt><dd className="student-info-value">{value || '—'}</dd>
      </div>)}</dl>
      <DocumentLink url={student.cv_s3_key ? `/documents/${encodeURIComponent(student.cv_s3_key)}` : null} label="ดู CV" />
    </div>
  </div>;
}
