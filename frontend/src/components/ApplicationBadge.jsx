import { getApplicationStatus } from '../utils/applicationPeriod';
import './CSS/ApplicationBadge.css';

// ป้ายสถานะการเปิดรับสมัคร (เปิดรับ / ยังไม่เปิด / ปิดแล้ว)
export default function ApplicationBadge({ company }) {
  const status = getApplicationStatus(company);
  return (
    <span className={`application-badge application-badge--${status.key}`}>
      {status.label}
    </span>
  );
}
