import { COOP_STATUS, coopStatus } from '../config/studentReview';
import './CSS/ApplicationStatusBadge.css';

// ป้ายสถานะสหกิจศึกษา: ยังไม่บันทึกข้อมูล / รอประกาศผล / ผ่าน / ไม่ผ่านเข้าแผนสหกิจศึกษา
export default function CoopResultBadge({ student }) {
  const info = COOP_STATUS[coopStatus(student)];
  return <span className={`status-badge status-badge--${info.tone}`}>{info.label}</span>;
}
